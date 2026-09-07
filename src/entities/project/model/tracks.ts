// Дорожки проекта.

import type { Item, MediaAsset, Track, TrackKind } from '@core/model'
import { createTrack, isTextItem } from '@core/model'
import { select } from '@shared/model/editor'
import { update } from '@entities/project/model/session'

/** Какая дорожка примет этот элемент: картинка и видео — в кадр или наложения, звук — только в звук. */
export function trackAccepts(
    track: Track,
    item: Item,
    asset: MediaAsset | undefined,
): boolean
{
    if (isTextItem(item)) return track.kind === 'overlay'
    if (asset?.kind === 'audio') return track.kind === 'audio'
    return track.kind === 'content' || track.kind === 'overlay'
}

export function addTrack(kind: TrackKind): void
{
    update((p) =>
    {
        const count = p.tracks.filter((t) => t.kind === kind).length + 1
        const name = kind === 'audio' ? `Звук ${count}` : `Наложения ${count}`
        p.tracks.push(createTrack(kind, name))
    })
}

export function removeTrack(id: string): void
{
    update((p) =>
    {
        const track = p.tracks.find((t) => t.id === id)
        if (!track || track.kind === 'content') return
        p.tracks = p.tracks.filter((t) => t.id !== id)
    })
    select(null)
}

export function updateTrack(id: string, patch: Partial<Track>): void
{
    update((p) =>
    {
        const track = p.tracks.find((t) => t.id === id)
        if (track) Object.assign(track, patch)
    })
}
