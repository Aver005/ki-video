// Элемент дорожки содержимого под курсором. Чистая выборка плюс хук над стором.

import type { MediaAsset, MediaItem, Project } from '@core/model'
import type { FrameKeyframe, FrameState } from '@core/model'
import { defaultFrame, interpolateFrame } from '@core/frame'
import { findKeyAt } from '@core/keys'
import { contentAt } from '@core/timeline'
import { useStore } from '@shared/model/store'

export interface CurrentContent
{
    item: MediaItem
    asset: MediaAsset
    localT: number
    frame: FrameState
    keyframe: FrameKeyframe | undefined
}

export function contentAtTime(
    project: Project | null,
    time: number,
    assets: Record<string, MediaAsset>,
): CurrentContent | null
{
    if (!project) return null
    const at = contentAt(project, time)
    const asset = at ? assets[at.item.assetId] : undefined
    if (!at || !asset) return null
    return {
        item: at.item,
        asset,
        localT: at.localT,
        frame: interpolateFrame(at.item.frame, at.localT, defaultFrame(asset)),
        keyframe: findKeyAt(at.item.frame, at.localT),
    }
}

/** Подписка идёт на сырые куски стора: выборка возвращает новый объект и в useStore не годится. */
export function useCurrentContent(): CurrentContent | null
{
    const project = useStore((s) => s.project)
    const time = useStore((s) => s.time)
    const assets = useStore((s) => s.assets)
    return contentAtTime(project, time, assets)
}
