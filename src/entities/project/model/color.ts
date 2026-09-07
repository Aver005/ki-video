// Цветокор проекта и его ключи.

import type { ColorGrade, ColorKeyframe } from '@core/model'
import { NEUTRAL_COLOR } from '@core/model'
import { findKeyAt, interpolateKeys, removeKeyAt, upsertKey } from '@core/keys'
import { getState } from '@shared/model/store'
import { update } from '@entities/project/model/session'

export interface ColorAt
{
    color: ColorGrade
    keyframe: ColorKeyframe | undefined
}

/** Цветокор в момент курсора: по ключам проекта, если они есть. */
export function colorAt(): ColorAt
{
    const { project, time } = getState()
    if (!project) return { color: { ...NEUTRAL_COLOR }, keyframe: undefined }
    return {
        color:
            project.colorKeys.length > 0
                ? interpolateKeys(project.colorKeys, time, project.color)
                : project.color,
        keyframe: findKeyAt(project.colorKeys, time),
    }
}

export function setColor(patch: Partial<ColorGrade>, record = true): void
{
    const time = getState().time
    update((p) =>
    {
        const current =
            p.colorKeys.length > 0
                ? interpolateKeys(p.colorKeys, time, p.color)
                : p.color
        const next = { ...current, ...patch }
        if (p.colorKeys.length === 0) p.color = next
        else p.colorKeys = upsertKey(p.colorKeys, { t: time, ...next })
    }, record)
}

export function addColorKey(): void
{
    const { color } = colorAt()
    const time = getState().time
    update((p) =>
    {
        p.colorKeys = upsertKey(p.colorKeys, { t: time, ...color })
    })
}

export function removeColorKey(): void
{
    const time = getState().time
    update((p) =>
    {
        p.colorKeys = removeKeyAt(p.colorKeys, time)
    })
}

export function clearColorKeys(): void
{
    update((p) =>
    {
        p.colorKeys = []
    })
}
