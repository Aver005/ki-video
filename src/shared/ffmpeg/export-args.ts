// Сборка аргументов ffmpeg для экспорта проекта. Чистая функция: удобно тестировать.

import type { MediaAsset, Project, VideoCodec } from "@shared/model";
import { clipDuration } from "@shared/timeline";
import { AUDIO_FORMAT, VIDEO_FORMAT, audioFilters, colorFilters, frameFilters } from "@shared/ffmpeg/filters";
import { num } from "@shared/math";

export interface EncoderCaps {
  /** Имя кодировщика ffmpeg для каждого кодека. */
  encoders: Record<VideoCodec, string>;
  /** Аппаратный декодер, если есть. */
  hwaccel: "cuda" | null;
}

export const SOFTWARE_CAPS: EncoderCaps = { encoders: { h264: "libx264", hevc: "libx265" }, hwaccel: null };

/** Имя файла с графом в рабочей папке задания: командная строка Windows ограничена 32 767 символами. */
export const GRAPH_FILE = "graph.txt";

export interface ExportPlan {
  args: string[];
  /** Содержимое filter_complex; сервер кладёт его в GRAPH_FILE. */
  graph: string;
  assFile: string | null;
  duration: number;
}

export class ExportError extends Error {}

function encoderArgs(codec: VideoCodec, encoder: string, quality: number): string[] {
  const tag = codec === "hevc" ? ["-tag:v", "hvc1"] : [];
  if (encoder.endsWith("_nvenc")) {
    return ["-c:v", encoder, "-preset", "p4", "-tune", "hq", "-rc", "vbr", "-cq", String(quality), "-b:v", "0", ...tag];
  }
  if (encoder === "libx265") return ["-c:v", encoder, "-preset", "fast", "-crf", String(quality), ...tag];
  return ["-c:v", encoder, "-preset", "veryfast", "-crf", String(quality)];
}

export function buildExportPlan(
  project: Project,
  assets: ReadonlyMap<string, MediaAsset>,
  caps: EncoderCaps,
  outFile: string,
  assFile: string | null,
): ExportPlan {
  if (project.clips.length === 0) throw new ExportError("В проекте нет клипов");
  const inputs: string[] = [];
  const graph: string[] = [];
  const labels: string[] = [];
  let duration = 0;

  project.clips.forEach((clip, i) => {
    const asset = assets.get(clip.assetId);
    if (!asset) throw new ExportError(`Файл клипа не найден: ${clip.assetId}`);
    const length = clipDuration(clip);
    if (length <= 0) throw new ExportError(`Клип ${i + 1} нулевой длины`);
    duration += length;
    if (caps.hwaccel) inputs.push("-hwaccel", caps.hwaccel);
    inputs.push("-ss", num(clip.in, 3), "-t", num(length, 3), "-i", asset.path);

    const video = [...frameFilters(clip, asset, project.output), ...colorFilters(project.color), VIDEO_FORMAT];
    graph.push(`[${i}:v]${video.join(",")}[v${i}]`);
    if (asset.audioCodec) {
      graph.push(`[${i}:a]${AUDIO_FORMAT}[a${i}]`);
    } else {
      graph.push(`aevalsrc=0:d=${num(length, 3)}:s=48000:c=stereo,${AUDIO_FORMAT}[a${i}]`);
    }
    labels.push(`[v${i}][a${i}]`);
  });

  graph.push(`${labels.join("")}concat=n=${project.clips.length}:v=1:a=1[vc][ac]`);
  const videoTail = assFile ? [`ass=${assFile}`] : [];
  graph.push(`[vc]${[...videoTail, "copy"].join(",")}[vo]`);
  graph.push(`[ac]${[...audioFilters(project.audio), "acopy"].join(",")}[ao]`);

  const args = [
    "-hide_banner",
    "-y",
    "-nostats",
    "-loglevel",
    "error",
    "-progress",
    "pipe:1",
    ...inputs,
    "-filter_complex_script",
    GRAPH_FILE,
    "-map",
    "[vo]",
    "-map",
    "[ao]",
    ...encoderArgs(project.output.codec, caps.encoders[project.output.codec], project.output.quality),
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(project.output.fps),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    outFile,
  ];
  return { args, graph: graph.join(";\n"), assFile, duration };
}
