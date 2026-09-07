// Разрез элемента дорожки содержимого под курсором.

import type { MediaItem } from '@core/model'
import { isMediaItem } from '@core/model'
import { contentAt, findItem } from '@core/timeline'
import { getState } from '@shared/model/store'
import { update } from '@entities/project'

/** Разрезает элемент дорожки содержимого под курсором на два. */
export function splitAtPlayhead(): void
{
    const { project, time } = getState()
    if (!project) return
    const at = contentAt(project, time)
    if (!at) return
    const { item, localT } = at
    if (localT <= 0.05 || localT >= item.duration - 0.05) return
    update((p) =>
    {
        const found = findItem(p, item.id)
        if (!found || !isMediaItem(found.item)) return
        const left = found.item
        const right: MediaItem =
        {
            ...structuredClone(left),
            id: crypto.randomUUID(),
            start: left.start + localT,
            duration: left.duration - localT,
            offset: left.offset + localT,
            frame: left.frame
                .filter((k) => k.t >= localT)
                .map((k) => ({ ...k, t: k.t - localT })),
        }
        left.duration = localT
        left.frame = left.frame.filter((k) => k.t <= localT)
        found.track.items.push(right)
    })
}
