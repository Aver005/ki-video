// Фильтры ffmpeg для одного клипа и для итоговой дорожки. Только чистые функции.

import type { AudioChain, Clip, ColorGrade, FrameKeyframe, MediaAsset, OutputSpec } from "@shared/model";
import { NEUTRAL_COLOR } from "@shared/model";
import { baseWindow, defaultFrame, MAX_ZOOM } from "@shared/frame";
import { num } from "@shared/math";
import { clipExpr, piecewiseLinear, type TimePoint } from "@shared/ffmpeg/expr";

function points(keyframes: readonly FrameKeyframe[], pickValue: (k: FrameKeyframe) => number): TimePoint[] {
  return keyframes.map((k) => ({ t: k.t, v: pickValue(k) }));
}

/** Цепочка кадрирования: crop с панорамой по t → scale → zoompan для зума. */
export function frameFilters(clip: Clip, asset: MediaAsset, output: OutputSpec): string[] {
  const source = { width: asset.width, height: asset.height };
  const { width: bw, height: bh } = baseWindow(source, output);
  const keyframes = clip.frame.length > 0 ? clip.frame : [{ t: 0, ...defaultFrame(source) }];

  const cx = piecewiseLinear(points(keyframes, (k) => k.cx), "t");
  const cy = piecewiseLinear(points(keyframes, (k) => k.cy), "t");
  const x = clipExpr(`${cx}-${num(bw / 2)}`, 0, asset.width - bw);
  const y = clipExpr(`${cy}-${num(bh / 2)}`, 0, asset.height - bh);
  // exact=1: без округления x/y к чётным пикселям панорама идёт плавно.
  const filters = [`fps=${output.fps}`, `crop=${bw}:${bh}:'${x}':'${y}':exact=1`, `scale=${output.width}:${output.height}:flags=bicubic`];

  const hasZoom = keyframes.some((k) => k.zoom > 1.0001);
  if (hasZoom) {
    const zoom = clipExpr(piecewiseLinear(points(keyframes, (k) => Math.min(MAX_ZOOM, k.zoom)), "it"), 1, MAX_ZOOM);
    const sx = output.width / bw;
    const sy = output.height / bh;
    const cxIt = piecewiseLinear(points(keyframes, (k) => k.cx), "it");
    const cyIt = piecewiseLinear(points(keyframes, (k) => k.cy), "it");
    const baseX = clipExpr(`${cxIt}-${num(bw / 2)}`, 0, asset.width - bw);
    const baseY = clipExpr(`${cyIt}-${num(bh / 2)}`, 0, asset.height - bh);
    const centerX = `(${cxIt}-${baseX})*${num(sx)}`;
    const centerY = `(${cyIt}-${baseY})*${num(sy)}`;
    const zx = `clip(${centerX}-iw/zoom/2,0,iw-iw/zoom)`;
    const zy = `clip(${centerY}-ih/zoom/2,0,ih-ih/zoom)`;
    filters.push(`zoompan=z='${zoom}':x='${zx}':y='${zy}':d=1:s=${output.width}x${output.height}:fps=${output.fps}`);
  }
  return filters;
}

export function colorFilters(color: ColorGrade): string[] {
  const filters: string[] = [];
  const eqNeutral =
    color.brightness === NEUTRAL_COLOR.brightness &&
    color.contrast === NEUTRAL_COLOR.contrast &&
    color.saturation === NEUTRAL_COLOR.saturation &&
    color.gamma === NEUTRAL_COLOR.gamma;
  if (!eqNeutral) {
    filters.push(
      `eq=brightness=${num(color.brightness)}:contrast=${num(color.contrast)}:saturation=${num(color.saturation)}:gamma=${num(color.gamma)}`,
    );
  }
  if (color.vibrance !== 0) filters.push(`vibrance=intensity=${num(color.vibrance)}`);
  if (color.sharpen > 0) filters.push(`unsharp=5:5:${num(color.sharpen)}:5:5:0`);
  return filters;
}

/** loudnorm в один проход работает в динамическом режиме; точный двухпроходный — в планах. */
export function audioFilters(audio: AudioChain): string[] {
  const filters: string[] = [];
  if (audio.highpass) filters.push("highpass=f=80");
  if (audio.denoise > 0) filters.push(`afftdn=nr=${num(6 + 24 * audio.denoise)}:nf=-40:tn=1`);
  if (audio.compressor) filters.push("acompressor=threshold=-18dB:ratio=3:attack=5:release=60:makeup=2");
  if (audio.loudness !== 0) filters.push(`loudnorm=I=${num(audio.loudness)}:TP=-1.5:LRA=11`);
  return filters;
}

export const AUDIO_FORMAT = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
export const VIDEO_FORMAT = "format=yuv420p,setsar=1";
