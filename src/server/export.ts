// Экспорт: одно задание за раз, ASS во временной папке, прогресс наружу через слушателя.

import { join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import type { MediaAsset, Project } from "@shared/model";
import type { ExportJob } from "@shared/api";
import { buildAss, hasOverlays } from "@shared/ffmpeg/ass";
import { buildExportPlan, GRAPH_FILE } from "@shared/ffmpeg/export-args";
import type { FfmpegTools } from "@server/ffmpeg/locate";
import { runFfmpeg } from "@server/ffmpeg/run";

export type ExportListener = (job: ExportJob) => void;

function safeName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return cleaned === "" ? "export" : cleaned;
}

function stamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export class ExportService {
  private readonly jobs = new Map<string, ExportJob>();
  private readonly listeners = new Set<ExportListener>();
  private active: { id: string; controller: AbortController } | null = null;

  constructor(
    private readonly tools: FfmpegTools | null,
    private readonly dataDir: string,
    private readonly threads: number,
  ) {}

  subscribe(listener: ExportListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(id: string): ExportJob | undefined {
    return this.jobs.get(id);
  }

  get exportsDir(): string {
    return join(this.dataDir, "exports");
  }

  private emit(job: ExportJob): void {
    this.jobs.set(job.id, job);
    for (const listener of this.listeners) listener(job);
  }

  async start(project: Project, assets: ReadonlyMap<string, MediaAsset>): Promise<ExportJob> {
    if (!this.tools) throw new Error("ffmpeg не настроен");
    if (this.active) throw new Error("Экспорт уже идёт");
    // Слот занимается до первого await, иначе два запроса подряд проскочат проверку.
    const id = crypto.randomUUID();
    const controller = new AbortController();
    this.active = { id, controller };
    try {
      const workDir = join(this.dataDir, "jobs", id);
      await mkdir(workDir, { recursive: true });
      await mkdir(this.exportsDir, { recursive: true });
      const outFile = join(this.exportsDir, `${safeName(project.name)}-${stamp()}.mp4`);
      const assFile = hasOverlays(project) ? "subs.ass" : null;
      if (assFile) await Bun.write(join(workDir, assFile), buildAss(project));
      const plan = buildExportPlan(project, assets, this.tools.caps, outFile, assFile);
      await Bun.write(join(workDir, GRAPH_FILE), plan.graph);
      const job: ExportJob = {
        id,
        status: "running",
        percent: 0,
        outTime: 0,
        duration: plan.duration,
        speed: "",
        outFile,
        error: null,
        startedAt: Date.now(),
        finishedAt: null,
      };
      this.emit(job);
      void this.run(job, plan.args, workDir, controller);
      return job;
    } catch (error) {
      this.active = null;
      throw error;
    }
  }

  private async run(job: ExportJob, args: string[], cwd: string, controller: AbortController): Promise<void> {
    const ffmpeg = this.tools?.ffmpeg;
    if (!ffmpeg) return;
    try {
      await runFfmpeg(ffmpeg, ["-threads", String(this.threads), ...args], {
        cwd,
        signal: controller.signal,
        onProgress: (p) => {
          const percent = job.duration > 0 ? Math.min(0.999, p.outTime / job.duration) : 0;
          this.emit({ ...(this.jobs.get(job.id) ?? job), percent, outTime: p.outTime, speed: p.speed });
        },
      });
      this.emit({ ...job, status: "done", percent: 1, outTime: job.duration, finishedAt: Date.now() });
    } catch (error) {
      const cancelled = controller.signal.aborted;
      // Недописанный файл никому не нужен.
      await rm(job.outFile, { force: true }).catch(() => undefined);
      this.emit({
        ...job,
        status: cancelled ? "cancelled" : "error",
        error: cancelled ? null : error instanceof Error ? error.message : String(error),
        finishedAt: Date.now(),
      });
    } finally {
      if (this.active?.id === job.id) this.active = null;
      await rm(cwd, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  cancel(id: string): boolean {
    if (this.active?.id !== id) return false;
    this.active.controller.abort();
    return true;
  }
}
