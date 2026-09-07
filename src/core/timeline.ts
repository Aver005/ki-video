// Таймлайн: дорожки на общей шкале. Раскладка содержимого, поиск элементов, ограничения наездов.

import type { Item, MediaItem, Project, Track } from '@core/model'
import { isMediaItem, itemEnd, MIN_ITEM_SECONDS } from '@core/model'

/** Порог, ниже которого зазор или наезд считаем нулём. */
export const TIME_EPSILON = 0.001

/** Наезд не может съесть больше половины короткого из двух элементов. */
export const MAX_OVERLAP_RATIO = 0.5

export function sortedItems(track: Track): Item[]
{
    return [...track.items].sort((a, b) => a.start - b.start)
}

export function trackDuration(track: Track): number
{
    return track.items.reduce((max, item) => Math.max(max, itemEnd(item)), 0)
}

export function projectDuration(project: Pick<Project, 'tracks'>): number
{
    return project.tracks.reduce(
        (max, track) => Math.max(max, trackDuration(track)),
        0,
    )
}

export function contentTrack(
    project: Pick<Project, 'tracks'>,
): Track | undefined
{
    return project.tracks.find((t) => t.kind === 'content')
}

export interface FoundItem
{
    track: Track
    item: Item
}

export function findItem(
    project: Pick<Project, 'tracks'>,
    itemId: string,
): FoundItem | undefined
{
    for (const track of project.tracks)
    {
        const item = track.items.find((i) => i.id === itemId)
        if (item) return { track, item }
    }
    return undefined
}

export function findTrackOf(
    project: Pick<Project, 'tracks'>,
    itemId: string,
): Track | undefined
{
    return findItem(project, itemId)?.track
}

/** Элементы, звучащие или видимые в момент t. */
export function itemsAt(track: Track, t: number): Item[]
{
    return track.items.filter(
        (item) => t >= item.start && t < itemEnd(item) - TIME_EPSILON,
    )
}

export interface ContentAt
{
    item: MediaItem
    /** Секунды от начала элемента. */
    localT: number
    /** Секунды внутри исходного файла. */
    sourceT: number
}

/** Что показывает дорожка содержимого в момент t. При наезде побеждает верхний (поздний) элемент. */
export function contentAt(
    project: Pick<Project, 'tracks'>,
    t: number,
): ContentAt | null
{
    const track = contentTrack(project)
    if (!track) return null
    const active = itemsAt(track, t).filter(isMediaItem)
    const item = active[active.length - 1]
    if (!item) return null
    const localT = t - item.start
    return { item, localT, sourceT: item.offset + localT }
}

/** Кусок базовой дорожки: элемент или чёрный зазор, с наездом на предыдущий кусок. */
export interface ContentSegment
{
    item: MediaItem | null
    start: number
    duration: number
    /** Длительность перехода с предыдущим куском, сек. */
    overlap: number
}

/** Раскладка дорожки содержимого в непрерывную ленту: зазоры чёрным, наезды переходами. */
export function contentSegments(
    track: Track | undefined,
    totalDuration: number,
): ContentSegment[]
{
    const segments: ContentSegment[] = []
    let cursor = 0
    for (const item of track ? sortedItems(track) : [])
    {
        if (!isMediaItem(item) || item.duration <= TIME_EPSILON) continue
        const gap = item.start - cursor
        if (gap > TIME_EPSILON)
        {
            segments.push(
            {
                item: null,
                start: cursor,
                duration: gap,
                overlap: 0,
            })
        }
        const previous = segments[segments.length - 1]
        const room = previous
            ? Math.min(previous.duration, item.duration) - MIN_ITEM_SECONDS
            : 0
        const overlap = Math.max(
            0,
            Math.min(cursor - item.start, Math.max(0, room)),
        )
        segments.push(
        {
            item,
            start: item.start,
            duration: item.duration,
            overlap,
        })
        cursor = Math.max(cursor, itemEnd(item))
    }
    const tail = totalDuration - cursor
    if (tail > TIME_EPSILON)
    {
        segments.push(
        {
            item: null,
            start: cursor,
            duration: tail,
            overlap: 0,
        })
    }
    return segments
}

/** Длина ленты, которую даст contentSegments: сумма кусков за вычетом переходов. */
export function segmentsDuration(segments: readonly ContentSegment[]): number
{
    return segments.reduce(
        (sum, segment) => sum + segment.duration - segment.overlap,
        0,
    )
}

/** Куда можно поставить элемент дорожки содержимого: соседям оставляем половину длины. */
export function clampContentStart(
    track: Track,
    item: Item,
    start: number,
): number
{
    const others = sortedItems(track).filter((i) => i.id !== item.id)
    const previous = [...others]
        .reverse()
        .find((i) => i.start <= start + TIME_EPSILON)
    const next = others.find((i) => i.start > start + TIME_EPSILON)
    let min = 0
    let max = Number.POSITIVE_INFINITY
    if (previous)
    {
        const room =
            Math.min(previous.duration, item.duration) * MAX_OVERLAP_RATIO
        min = Math.max(0, itemEnd(previous) - room)
    }
    if (next)
    {
        const room = Math.min(next.duration, item.duration) * MAX_OVERLAP_RATIO
        max = next.start + room - item.duration
    }
    return Math.max(0, Math.min(Math.max(start, min), max))
}
