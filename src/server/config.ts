// Конфиг сервера: ki.config.json рядом с запуском, переменные окружения, значения по умолчанию.

import { resolve } from "node:path";

export interface AppConfig {
  port: number;
  dataDir: string;
  /** Папка с ffmpeg.exe и ffprobe.exe; пусто — искать в PATH и известных местах. */
  ffmpegDir: string | null;
  /** Открывать окно браузера при старте. */
  openWindow: boolean;
  /** Сколько потоков отдавать ffmpeg; бережём машину, если она занята. */
  threads: number;
}

const DEFAULTS: AppConfig = {
  port: 4777,
  dataDir: ".ki-data",
  ffmpegDir: null,
  openWindow: true,
  threads: 4,
};

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function fromFile(raw: unknown): Partial<AppConfig> {
  if (typeof raw !== "object" || raw === null) return {};
  const obj = raw as Record<string, unknown>;
  const ffmpegDir = readString(obj["ffmpegDir"]);
  return {
    port: readNumber(obj["port"], DEFAULTS.port),
    dataDir: readString(obj["dataDir"]) ?? DEFAULTS.dataDir,
    openWindow: readBoolean(obj["openWindow"], DEFAULTS.openWindow),
    threads: readNumber(obj["threads"], DEFAULTS.threads),
    ...(ffmpegDir ? { ffmpegDir } : {}),
  };
}

export async function loadConfig(cwd = process.cwd()): Promise<AppConfig> {
  const file = Bun.file(resolve(cwd, "ki.config.json"));
  let fileValues: Partial<AppConfig> = {};
  if (await file.exists()) {
    try {
      fileValues = fromFile(await file.json());
    } catch {
      throw new Error("ki.config.json не читается: проверь JSON, пути пиши через прямые слэши");
    }
  }
  const env = Bun.env;
  const envFfmpeg = readString(env["KI_FFMPEG_DIR"]);
  const merged: AppConfig = {
    ...DEFAULTS,
    ...fileValues,
    ...(envFfmpeg ? { ffmpegDir: envFfmpeg } : {}),
    ...(env["KI_PORT"] ? { port: readNumber(Number(env["KI_PORT"]), fileValues.port ?? DEFAULTS.port) } : {}),
    ...(env["KI_NO_WINDOW"] ? { openWindow: false } : {}),
  };
  return { ...merged, dataDir: resolve(cwd, merged.dataDir) };
}
