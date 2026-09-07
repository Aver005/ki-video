// Геометрия наложения и её ключи.

import type { BoxKeyframe, MediaItem, OverlayBox } from '@core/model'
import { isMediaItem } from '@core/model'
import { findKeyAt, interpolateKeys, removeKeyAt, upsertKey } from '@core/keys'
import { findItem } from '@core/timeline'
import { getState } from '@shared/model/store'
import { update } from '@entities/project/model/session'

export interface BoxAt
{
    /** Время внутри элемента, прижатое к его краям. */
    localT: number
    /** Курсор действительно стоит на элементе. */
    inside: boolean
    box: OverlayBox
    keyframe: BoxKeyframe | undefined
}

/** Геометрия наложения в момент курсора: по ключам, если они есть. */
export function boxAt(item: MediaItem): BoxAt
{
    const localT = getState().time - item.start
    const clamped = Math.max(0, Math.min(localT, item.duration))
    return {
        localT: clamped,
        inside: localT >= 0 && localT <= item.duration,
        box:
            item.boxKeys.length > 0
                ? interpolateKeys(item.boxKeys, clamped, item.box)
                : item.box,
        keyframe: findKeyAt(item.boxKeys, clamped),
    }
}

function withOverlay(
    id: string,
    change: (item: MediaItem, at: BoxAt) => void,
    record = true,
): void
{
    update((p) =>
    {
        const found = findItem(p, id)
        if (found && isMediaItem(found.item))
            change(found.item, boxAt(found.item))
    }, record)
}

/** Меняет геометрию: с ключами правит или создаёт ключ под курсором, иначе неподвижное значение. */
export function setBox(
    id: string,
    patch: Partial<OverlayBox>,
    record = true,
): void
{
    withOverlay(
        id,
        (item, at) =>
        {
            const next = { ...at.box, ...patch }
            if (item.boxKeys.length === 0) item.box = next
            else
                item.boxKeys = upsertKey(item.boxKeys,
                {
                    t: at.localT,
                    ...next,
                })
        },
        record,
    )
}

export function addBoxKey(id: string): void
{
    withOverlay(id, (item, at) =>
    {
        item.boxKeys = upsertKey(item.boxKeys, { t: at.localT, ...at.box })
    })
}

export function removeBoxKey(id: string): void
{
    withOverlay(id, (item, at) =>
    {
        item.boxKeys = removeKeyAt(item.boxKeys, at.localT)
    })
}

export function clearBoxKeys(id: string): void
{
    withOverlay(id, (item) =>
    {
        item.boxKeys = []
    })
}
