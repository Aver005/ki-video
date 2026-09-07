// Пики громкости из сырого PCM s16le. Основной путь — C через bun:ffi cc(), запасной — TypeScript.

import { cc, ptr } from "bun:ffi";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import peaksSource from "./peaks.c" with { type: "text" };

const MAX_SAMPLE = 32767;

export function peaksTs(samples: Int16Array, bucket: number): Uint8Array {
  const out = new Uint8Array(Math.ceil(samples.length / bucket));
  for (let b = 0; b < out.length; b += 1) {
    const end = Math.min(samples.length, (b + 1) * bucket);
    let peak = 0;
    for (let i = b * bucket; i < end; i += 1) {
      const v = Math.abs(samples[i] ?? 0);
      if (v > peak) peak = v;
    }
    out[b] = Math.min(MAX_SAMPLE, peak) >> 7;
  }
  return out;
}

const SYMBOLS = {
  ki_peaks: { args: ["ptr", "i32", "i32", "ptr", "i32"], returns: "i32" },
} as const;

type PeaksFn = ReturnType<typeof cc<typeof SYMBOLS>>["symbols"]["ki_peaks"];

let native: PeaksFn | null | undefined;

/** TinyCC читает только настоящий файл, поэтому исходник (встроенный в exe как текст) пишем во временную папку. */
function loadNative(): PeaksFn | null {
  if (native !== undefined) return native;
  try {
    const path = join(tmpdir(), `ki-video-peaks-${Bun.hash(peaksSource).toString(16)}.c`);
    writeFileSync(path, peaksSource);
    native = cc({ source: path, symbols: SYMBOLS }).symbols.ki_peaks;
  } catch (error) {
    console.warn("[peaks] C-путь недоступен, используем TypeScript:", error instanceof Error ? error.message : error);
    native = null;
  }
  return native;
}

export function computePeaks(samples: Int16Array, bucket: number, allowNative = true): Uint8Array {
  const fn = allowNative ? loadNative() : null;
  if (!fn) return peaksTs(samples, bucket);
  const out = new Uint8Array(Math.ceil(samples.length / bucket));
  const written = fn(ptr(samples), samples.length, bucket, ptr(out), out.length);
  return written === out.length ? out : peaksTs(samples, bucket);
}

export function isNativePeaksAvailable(): boolean {
  return loadNative() !== null;
}
