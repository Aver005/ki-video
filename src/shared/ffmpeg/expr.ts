// Выражения ffmpeg: кусочно-линейная интерполяция по времени для crop и zoompan.

import { num } from "@shared/math";

export interface TimePoint {
  t: number;
  v: number;
}

/** Строит выражение по точкам: до первой — её значение, между — линейно, после последней — её значение. */
export function piecewiseLinear(points: readonly TimePoint[], timeVar: string): string {
  const first = points[0];
  if (!first) return "0";
  if (points.length === 1) return num(first.v);
  const allSame = points.every((p) => p.v === first.v);
  if (allSame) return num(first.v);
  const body = buildSegment(points, 0, timeVar);
  return first.t > 0 ? `if(lt(${timeVar},${num(first.t)}),${num(first.v)},${body})` : body;
}

function buildSegment(points: readonly TimePoint[], index: number, timeVar: string): string {
  const a = points[index];
  const b = points[index + 1];
  if (!a) return "0";
  if (!b) return num(a.v);
  const span = b.t - a.t;
  const segment =
    span <= 0 ? num(b.v) : `${num(a.v)}+(${num(b.v)}-${num(a.v)})*(${timeVar}-${num(a.t)})/${num(span)}`;
  return `if(lt(${timeVar},${num(b.t)}),${segment},${buildSegment(points, index + 1, timeVar)})`;
}

export function clipExpr(inner: string, min: number, max: number): string {
  return `clip(${inner},${num(min)},${num(max)})`;
}
