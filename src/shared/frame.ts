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

/** Дальше не отдаляем: окно кадрирования растёт как 1/zoom, а вместе с ним и холст под ffmpeg. */
export const MIN_ZOOM = 0.2

export function evenFloor(value: number): number
{
    return Math.floor(value / 2) * 2
}

export function evenCeil(value: number): number
{
    return Math.ceil(value / 2) * 2
}

/** Положение окна по одной оси: внутри исходника прижимаем к краю, шире исходника — центрируем. */
function place(center: number, window: number, source: number): number
{
    return window >= source
        ? (source - window) / 2
        : clamp(center - window / 2, 0, source - window)
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

/** Регион исходника, попадающий в кадр: окно / zoom вокруг центра. При отдалении вылезает за края. */
export function frameToRegion(
    frame: FrameState,
    source: Size,
    output: Size,
): Region
{
    const base = baseWindow(source, output)
    const zoom = clamp(frame.zoom, MIN_ZOOM, MAX_ZOOM)
    const w = base.width / zoom
    const h = base.height / zoom
    return {
        x: place(frame.cx, w, source.width),
        y: place(frame.cy, h, source.height),
        w,
        h,
    }
}

/** Прижимает центр и зум: окно не выходит за исходник, а при отдалении встаёт по центру. */
export function clampFrame(
    frame: FrameState,
    source: Size,
    output: Size,
): FrameState
{
    const base = baseWindow(source, output)
    const zoom = clamp(frame.zoom, MIN_ZOOM, MAX_ZOOM)
    const w = base.width / zoom
    const h = base.height / zoom
    return {
        cx: place(frame.cx, w, source.width) + w / 2,
        cy: place(frame.cy, h, source.height) + h / 2,
        zoom,
    }
}
