// Окно кадрирования элемента и его ключи.

import type { FrameState, MediaItem } from '@core/model'
import { isMediaItem } from '@core/model'
import { clampFrame } from '@core/frame'
import { removeKeyAt, upsertKey } from '@core/keys'
import { findItem } from '@core/timeline'
import { getState } from '@shared/model/store'
import {
    contentAtTime,
    type CurrentContent,
} from '@entities/project/model/current'
import { update } from '@entities/project/model/session'

/** Элемент дорожки содержимого под курсором. Сама выборка живёт в entities/timeline. */
export function currentContent(): CurrentContent | null
{
    const { project, time, assets } = getState()
    return contentAtTime(project, time, assets)
}

/** Меняет окно в текущий момент: если ключи уже есть — правит или создаёт ключ, иначе статичное значение. */
export function setFrame(patch: Partial<FrameState>, record = true): void
{
    const current = currentContent()
    const { project } = getState()
    if (!current || !project) return
    const next = clampFrame(
        { ...current.frame, ...patch },
        current.asset,
        project.output,
    )
    update((p) =>
    {
        const found = findItem(p, current.item.id)
        if (!found || !isMediaItem(found.item)) return
        found.item.frame =
            found.item.frame.length === 0
                ? [{ t: 0, ...next }]
                : upsertKey(found.item.frame,
                  {
                      t: current.localT,
                      ...next,
                  })
    }, record)
}

function withCurrentFrame(
    change: (item: MediaItem, localT: number, frame: FrameState) => void,
): void
{
    const current = currentContent()
    if (!current) return
    update((p) =>
    {
        const found = findItem(p, current.item.id)
        if (found && isMediaItem(found.item))
            change(found.item, current.localT, current.frame)
    })
}

export function addKeyframe(): void
{
    withCurrentFrame((item, localT, frame) =>
    {
        item.frame = upsertKey(item.frame, { t: localT, ...frame })
    })
}

export function removeKeyframe(): void
{
    withCurrentFrame((item, localT) =>
    {
        item.frame = removeKeyAt(item.frame, localT)
    })
}

export function clearKeyframes(): void
{
    withCurrentFrame((item) =>
    {
        item.frame = []
    })
}
