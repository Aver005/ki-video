// Окно кадрирования: интерполяция ключевых кадров и пересчёт в регион исходника.

import type { FrameKeyframe, FrameState } from '@shared/model'
import { clamp } from '@shared/math'
import { interpolateKeys } from '@shared/keys'

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

/** Окно кадра в момент t: ключи элемента или неподвижное значение. */
export function interpolateFrame(
    keyframes: readonly FrameKeyframe[],
    t: number,
    fallback: FrameState,
): FrameState
{
    return interpolateKeys(keyframes, t, fallback)
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
