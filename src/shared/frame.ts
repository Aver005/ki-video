// Окно кадрирования: интерполяция ключевых кадров и пересчёт в регион исходника.

import type { FrameKeyframe, FrameState } from '@shared/model'
import { clamp, lerp } from '@shared/math'

export interface Region
{
    x: number
    y: number
    w: number
    h: number
}

export interface Size
{
    width: number
    height: number
}

export const MAX_ZOOM = 8

function evenFloor(value: number): number
{
    return Math.floor(value / 2) * 2
}

/** Базовое окно: максимум по высоте исходника с пропорциями выхода. Размеры чётные, как требует кодек. */
export function baseWindow(source: Size, output: Size): Size
{
    const aspect = output.width / output.height
    const byHeight = { width: source.height * aspect, height: source.height }
    const raw =
        byHeight.width <= source.width
            ? byHeight
            : { width: source.width, height: source.width / aspect }
    return { width: evenFloor(raw.width), height: evenFloor(raw.height) }
}

export function defaultFrame(source: Size): FrameState
{
    return { cx: source.width / 2, cy: source.height / 2, zoom: 1 }
}

/** Линейная интерполяция по отсортированным ключевым кадрам. */
export function interpolateFrame(
    keyframes: readonly FrameKeyframe[],
    t: number,
    fallback: FrameState,
): FrameState
{
    const first = keyframes[0]
    if (!first) return fallback
    if (t <= first.t) return pick(first)
    const last = keyframes[keyframes.length - 1] ?? first
    if (t >= last.t) return pick(last)
    for (let i = 1; i < keyframes.length; i += 1)
    {
        const a = keyframes[i - 1]
        const b = keyframes[i]
        if (!a || !b) break
        if (t <= b.t)
        {
            const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t)
            return {
                cx: lerp(a.cx, b.cx, k),
                cy: lerp(a.cy, b.cy, k),
                zoom: lerp(a.zoom, b.zoom, k),
            }
        }
    }
    return pick(last)
}

function pick(k: FrameKeyframe): FrameState
{
    return { cx: k.cx, cy: k.cy, zoom: k.zoom }
}

/** Регион исходника, попадающий в кадр: окно / zoom вокруг центра, прижатое к границам. */
export function frameToRegion(
    frame: FrameState,
    source: Size,
    output: Size,
): Region
{
    const base = baseWindow(source, output)
    const zoom = clamp(frame.zoom, 1, MAX_ZOOM)
    const w = base.width / zoom
    const h = base.height / zoom
    const x = clamp(frame.cx - w / 2, 0, source.width - w)
    const y = clamp(frame.cy - h / 2, 0, source.height - h)
    return { x, y, w, h }
}

/** Прижимает центр и зум, чтобы окно не выходило за исходник. */
export function clampFrame(
    frame: FrameState,
    source: Size,
    output: Size,
): FrameState
{
    const base = baseWindow(source, output)
    const zoom = clamp(frame.zoom, 1, MAX_ZOOM)
    const w = base.width / zoom
    const h = base.height / zoom
    return {
        cx: clamp(frame.cx, w / 2, source.width - w / 2),
        cy: clamp(frame.cy, h / 2, source.height - h / 2),
        zoom,
    }
}

/** Полкадра при 60 fps: ключи на соседних кадрах остаются разными. */
export const KEYFRAME_EPSILON = 0.008

/** Вставляет или заменяет ключевой кадр в момент t, сохраняя сортировку. */
export function upsertKeyframe(
    keyframes: readonly FrameKeyframe[],
    keyframe: FrameKeyframe,
): FrameKeyframe[]
{
    const next = keyframes.filter(
        (k) => Math.abs(k.t - keyframe.t) > KEYFRAME_EPSILON,
    )
    next.push(keyframe)
    next.sort((a, b) => a.t - b.t)
    return next
}

export function removeKeyframeAt(
    keyframes: readonly FrameKeyframe[],
    t: number,
): FrameKeyframe[]
{
    return keyframes.filter((k) => Math.abs(k.t - t) > KEYFRAME_EPSILON)
}

export function findKeyframeAt(
    keyframes: readonly FrameKeyframe[],
    t: number,
): FrameKeyframe | undefined
{
    return keyframes.find((k) => Math.abs(k.t - t) <= KEYFRAME_EPSILON)
}
