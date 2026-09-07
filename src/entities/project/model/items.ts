// Элементы дорожек: создание, перенос, растягивание, удаление.

import type { Item, MediaAsset, MediaItem, TextItem, Track } from '@core/model'
import {
    DEFAULT_BOX,
    IMAGE_MAX_SECONDS,
    IMAGE_SECONDS,
    MIN_ITEM_SECONDS,
    isMediaItem,
    itemEnd,
} from '@core/model'
import { TEXT_PRESETS } from '@core/presets'
import {
    clampContentStart,
    contentTrack,
    findItem,
    trackDuration,
} from '@core/timeline'
import { notify, select, setTab } from '@shared/model/editor'
import { getState } from '@shared/model/store'
import { update } from '@entities/project/model/session'
import { trackAccepts } from '@entities/project/model/tracks'
import { removeCue } from '@entities/project/model/subtitles'

/** Сколько элемент может длиться: видео и звук ограничены остатком исходника, картинка — почти нет. */
export function maxDuration(item: MediaItem, asset: MediaAsset): number
{
    return asset.kind === 'image'
        ? IMAGE_MAX_SECONDS
        : Math.max(MIN_ITEM_SECONDS, asset.duration - item.offset)
}

export function createMediaItem(
    asset: MediaAsset,
    start: number,
    duration: number,
): MediaItem
{
    return {
        kind: 'media',
        id: crypto.randomUUID(),
        assetId: asset.id,
        start,
        duration,
        offset: 0,
        frame: [],
        box: { ...DEFAULT_BOX },
        boxKeys: [],
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        transition: 'fade',
    }
}

/** Кладёт файл на дорожку: содержимое встаёт в конец ленты, остальное — под курсор. */
export function addAssetToTimeline(
    asset: MediaAsset,
    trackId?: string,
    at?: number,
): void
{
    const { project, time } = getState()
    if (!project) return
    const target =
        project.tracks.find((t) => t.id === trackId) ??
        (asset.kind === 'audio'
            ? project.tracks.find((t) => t.kind === 'audio')
            : contentTrack(project))
    if (!target)
    {
        notify('Нет подходящей дорожки')
        return
    }
    const duration =
        asset.kind === 'image'
            ? IMAGE_SECONDS
            : Math.max(MIN_ITEM_SECONDS, asset.duration)
    const start =
        at ?? (target.kind === 'content' ? trackDuration(target) : time)
    const item = createMediaItem(asset, Math.max(0, start), duration)
    update((p) =>
    {
        p.tracks.find((t) => t.id === target.id)?.items.push(item)
    })
    select({ kind: 'item', id: item.id })
    setTab('item')
}

export function addText(presetId: string): void
{
    const preset =
        TEXT_PRESETS.find((p) => p.id === presetId) ?? TEXT_PRESETS[0]
    const { project, time } = getState()
    if (!preset || !project) return
    const target = project.tracks.find((t) => t.kind === 'overlay')
    if (!target)
    {
        notify('Нужна дорожка наложений')
        return
    }
    const item: TextItem =
    {
        kind: 'text',
        id: crypto.randomUUID(),
        text: 'Текст',
        start: time,
        duration: 3,
        x: 0.5,
        y: 0.2,
        ...preset.value,
    }
    update((p) =>
    {
        p.tracks.find((t) => t.id === target.id)?.items.push(item)
    })
    select({ kind: 'item', id: item.id })
    setTab('item')
}

export function updateItem(
    id: string,
    patch: Partial<MediaItem> | Partial<TextItem>,
    record = true,
): void
{
    update((p) =>
    {
        const found = findItem(p, id)
        if (found) Object.assign(found.item, patch)
    }, record)
}

export interface ItemPlacement
{
    start: number
    duration: number
    trackId?: string
}

/** Перенос и растягивание: ограничения по исходнику, ключи едут вместе с левым краем. */
export function placeItem(id: string, next: ItemPlacement, record = true): void
{
    const { assets } = getState()
    update((p) =>
    {
        const found = findItem(p, id)
        if (!found) return
        const { item } = found
        const asset = isMediaItem(item) ? assets[item.assetId] : undefined
        const target =
            next.trackId === undefined
                ? found.track
                : (p.tracks.find((t) => t.id === next.trackId) ?? found.track)
        if (!trackAccepts(target, item, asset)) return

        const limit =
            isMediaItem(item) && asset ? maxDuration(item, asset) : Infinity
        const duration = Math.max(
            MIN_ITEM_SECONDS,
            Math.min(next.duration, limit),
        )
        const shift = next.start - item.start
        if (isMediaItem(item) && asset && asset.kind !== 'image')
        {
            // Левый край режет исходник, а не сдвигает элемент, только когда меняется длительность.
            const trimmed = Math.abs(duration - item.duration) > 0.0005
            if (trimmed) item.offset = Math.max(0, item.offset + shift)
        }
        if (isMediaItem(item) && Math.abs(duration - item.duration) > 0.0005)
        {
            item.frame = item.frame
                .map((k) => ({ ...k, t: k.t - shift }))
                .filter((k) => k.t >= -0.001 && k.t <= duration + 0.001)
        }
        item.start = Math.max(0, next.start)
        item.duration = duration
        if (target.kind === 'content')
            item.start = clampContentStart(target, item, item.start)
        if (target.id !== found.track.id)
        {
            found.track.items = found.track.items.filter((i) => i.id !== id)
            target.items.push(item)
        }
    }, record)
}

export function removeItem(id: string): void
{
    update((p) =>
    {
        for (const track of p.tracks)
            track.items = track.items.filter((i) => i.id !== id)
    })
    select(null)
}

export interface SelectedItem
{
    track: Track
    item: Item
    asset: MediaAsset | undefined
}

export function selectedItem(): SelectedItem | null
{
    const { project, selection, assets } = getState()
    if (!project || selection?.kind !== 'item') return null
    const found = findItem(project, selection.id)
    if (!found) return null
    return {
        track: found.track,
        item: found.item,
        asset: isMediaItem(found.item) ? assets[found.item.assetId] : undefined,
    }
}

/** Края всех соседей и курсор: к ним прилипает перетаскивание. */
export function snapPoints(exceptId: string): number[]
{
    const { project, time } = getState()
    if (!project) return [time]
    const points = [0, time]
    for (const track of project.tracks)
    {
        for (const item of track.items)
        {
            if (item.id === exceptId) continue
            points.push(item.start, itemEnd(item))
        }
    }
    return points
}

export function deleteSelection(): void
{
    const { selection } = getState()
    if (!selection) return
    if (selection.kind === 'item') removeItem(selection.id)
    if (selection.kind === 'cue') removeCue(selection.id)
}
