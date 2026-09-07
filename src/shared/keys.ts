// Ключевые кадры: одна механика для окна кадра, геометрии наложения и цветокора.

import { lerp } from '@shared/math'
import type { TimePoint } from '@shared/ffmpeg/expr'

export interface Keyed
{
    /** Секунды: у элемента — от его начала, у проекта — от нуля таймлайна. */
    t: number
}

/** Полкадра при 60 fps: ключи на соседних кадрах остаются разными. */
export const KEY_EPSILON = 0.008

// Ключ хранит числовые поля состояния; у интерфейсов модели нет индексной подписи, отсюда приведения.
type Numbers = Record<string, number>

function shapeOf<T extends object>(key: object, shape: T): T
{
    const source = key as Numbers
    const target = shape as Numbers
    const out: Numbers = {}
    for (const name of Object.keys(target))
        out[name] = source[name] ?? target[name] ?? 0
    return out as T
}

function mix<T extends object>(a: object, b: object, k: number, shape: T): T
{
    const from = a as Numbers
    const to = b as Numbers
    const target = shape as Numbers
    const out: Numbers = {}
    for (const name of Object.keys(target))
    {
        const start = from[name] ?? target[name] ?? 0
        const end = to[name] ?? target[name] ?? 0
        out[name] = lerp(start, end, k)
    }
    return out as T
}

/** Линейная интерполяция по отсортированным ключам; за краями держится крайний ключ. */
export function interpolateKeys<T extends object>(
    keys: readonly (T & Keyed)[],
    t: number,
    fallback: T,
): T
{
    const first = keys[0]
    if (!first) return { ...fallback }
    const last = keys[keys.length - 1] ?? first
    if (t <= first.t) return shapeOf(first, fallback)
    if (t >= last.t) return shapeOf(last, fallback)
    for (let i = 1; i < keys.length; i += 1)
    {
        const a = keys[i - 1]
        const b = keys[i]
        if (!a || !b) break
        if (t > b.t) continue
        const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t)
        return mix(a, b, k, fallback)
    }
    return shapeOf(last, fallback)
}

/** Вставляет или заменяет ключ в момент t, сохраняя сортировку. */
export function upsertKey<T extends Keyed>(keys: readonly T[], key: T): T[]
{
    const next = keys.filter((k) => Math.abs(k.t - key.t) > KEY_EPSILON)
    next.push(key)
    next.sort((a, b) => a.t - b.t)
    return next
}

export function removeKeyAt<T extends Keyed>(
    keys: readonly T[],
    t: number,
): T[]
{
    return keys.filter((k) => Math.abs(k.t - t) > KEY_EPSILON)
}

export function findKeyAt<T extends Keyed>(
    keys: readonly T[],
    t: number,
): T | undefined
{
    return keys.find((k) => Math.abs(k.t - t) <= KEY_EPSILON)
}

/** Точки для выражения ffmpeg: одно поле по времени, со сдвигом на начало элемента. */
export function keyPoints<T extends Keyed>(
    keys: readonly T[],
    value: (key: T) => number,
    offset = 0,
): TimePoint[]
{
    return keys.map((key) => ({ t: key.t + offset, v: value(key) }))
}

/** Меняется ли поле от ключа к ключу: если нет, выражение не нужно. */
export function varies<T extends Keyed>(
    keys: readonly T[],
    value: (key: T) => number,
): boolean
{
    const first = keys[0]
    if (!first) return false
    return keys.some((key) => Math.abs(value(key) - value(first)) > 0.0001)
}
