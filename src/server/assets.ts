// Хранилище медиафайлов: индекс в JSON, кэш прокси и миниатюр, очередь подготовки по одному.

import { basename, join } from "node:path";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import type { MediaAsset } from "@shared/model";
import type { FfmpegTools } from "@server/ffmpeg/locate";
import { probe } from "@server/ffmpeg/probe";
import { ingest } from "@server/ffmpeg/ingest";

export type AssetEvent =
  | { type: "asset"; asset: MediaAsset }
  | { type: "asset-progress"; id: string; percent: number }
  | { type: "asset-removed"; id: string };

export type AssetListener = (event: AssetEvent) => void;

export interface AssetStoreOptions {
  dataDir: string;
  threads: number;
  nativePeaks: boolean;
}

export const ASSET_ID_PATTERN = /^[0-9a-f]{16}$/;

/** Идентификатор по пути, размеру и дате изменения: тот же файл — тот же кэш. */
export function assetIdFor(path: string, size: number, mtimeMs: number): string {
  return Bun.hash(`${path}|${size}|${Math.floor(mtimeMs)}`).toString(16).padStart(16, "0");
}

function isAssetLike(value: unknown): value is MediaAsset {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  return typeof a["id"] === "string" && typeof a["path"] === "string" && typeof a["duration"] === "number" && a["status"] === "ready";
}

export class AssetStore {
  private readonly assets = new Map<string, MediaAsset>();
  private readonly listeners = new Set<AssetListener>();
  private readonly importing = new Map<string, Promise<MediaAsset>>();
  private readonly processing = new Map<string, { controller: AbortController; done: Promise<void> }>();
  private queue: Promise<void> = Promise.resolve();
  private saving: Promise<void> = Promise.resolve();
  private readonly indexFile: string;

  constructor(
    private readonly tools: FfmpegTools | null,
    private readonly options: AssetStoreOptions,
  ) {
    this.indexFile = join(options.dataDir, "assets.json");
  }

  cacheDir(id: string): string {
    return join(this.options.dataDir, "cache", id);
  }

  async load(): Promise<void> {
    await mkdir(join(this.options.dataDir, "cache"), { recursive: true });
    const file = Bun.file(this.indexFile);
    if (!(await file.exists())) return;
    const list: unknown = await file.json().catch(() => null);
    if (!Array.isArray(list)) {
      console.warn("[assets] assets.json повреждён, начинаем с пустого списка");
      return;
    }
    // Незавершённая подготовка после перезапуска не восстанавливается: файл добавляется заново.
    for (const asset of list) if (isAssetLike(asset)) this.assets.set(asset.id, asset);
  }

  /** Запись через временный файл и по очереди: индекс не рвётся при падении и не откатывается старой копией. */
  private save(): void {
    const snapshot = JSON.stringify([...this.assets.values()], null, 2);
    this.saving = this.saving
      .then(async () => {
        const tmp = `${this.indexFile}.tmp`;
        await Bun.write(tmp, snapshot);
        await rename(tmp, this.indexFile);
      })
      .catch((error: unknown) => console.warn("[assets] не удалось сохранить индекс:", error));
  }

  subscribe(listener: AssetListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: AssetEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  list(): MediaAsset[] {
    return [...this.assets.values()];
  }

  get(id: string): MediaAsset | undefined {
    return this.assets.get(id);
  }

  map(): ReadonlyMap<string, MediaAsset> {
    return this.assets;
  }

  async import(paths: readonly string[]): Promise<MediaAsset[]> {
    const result: MediaAsset[] = [];
    for (const path of paths) result.push(await this.importOne(path));
    return result;
  }

  private async importOne(path: string): Promise<MediaAsset> {
    if (!this.tools) throw new Error("ffmpeg не настроен");
    const info = await stat(path);
    if (!info.isFile()) throw new Error("Это не файл");
    const id = assetIdFor(path, info.size, info.mtimeMs);
    const existing = this.assets.get(id);
    if (existing) return existing;
    const inFlight = this.importing.get(id);
    if (inFlight) return inFlight;
    const pending = this.register(id, path).finally(() => this.importing.delete(id));
    this.importing.set(id, pending);
    return pending;
  }

  private async register(id: string, path: string): Promise<MediaAsset> {
    if (!this.tools) throw new Error("ffmpeg не настроен");
    const probed = await probe(this.tools.ffprobe, path);
    const asset: MediaAsset = { id, name: basename(path), path, status: "processing", ...probed };
    this.assets.set(id, asset);
    this.emit({ type: "asset", asset });
    const controller = new AbortController();
    const done = this.queue.then(() => this.process(asset, controller.signal));
    this.processing.set(id, { controller, done });
    this.queue = done.catch(() => undefined);
    return asset;
  }

  private async process(asset: MediaAsset, signal: AbortSignal): Promise<void> {
    if (!this.tools || signal.aborted) return;
    const dir = this.cacheDir(asset.id);
    try {
      await rm(dir, { recursive: true, force: true });
      const result = await ingest(this.tools, asset, dir, this.options.threads, this.options.nativePeaks, signal, (percent) =>
        this.emit({ type: "asset-progress", id: asset.id, percent }),
      );
      this.update({ ...asset, ...result, status: "ready" });
    } catch (error) {
      if (!signal.aborted) this.update({ ...asset, status: "error", error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.processing.delete(asset.id);
    }
  }

  private update(asset: MediaAsset): void {
    if (!this.assets.has(asset.id)) return;
    this.assets.set(asset.id, asset);
    this.emit({ type: "asset", asset });
    this.save();
  }

  /** Убирает файл из списка; идущая подготовка прерывается, кэш чистится по возможности. */
  async remove(id: string): Promise<boolean> {
    if (!this.assets.delete(id)) return false;
    const active = this.processing.get(id);
    if (active) {
      active.controller.abort();
      await active.done.catch(() => undefined);
    }
    this.emit({ type: "asset-removed", id });
    this.save();
    await rm(this.cacheDir(id), { recursive: true, force: true }).catch((error: unknown) =>
      console.warn(`[assets] кэш ${id} не удалился:`, error),
    );
    return true;
  }
}
