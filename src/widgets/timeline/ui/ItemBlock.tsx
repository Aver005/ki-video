// Элемент на дорожке: миниатюры, пики, ключи и ручки по краям.

import { cva } from 'class-variance-authority'
import {
    isMediaItem,
    isTextItem,
    MIN_ITEM_SECONDS,
    type Item,
    type Track,
} from '@core/model'
import { maxDuration, placeItem, snapPoints } from '@entities/project'
import { thumbUrl } from '@shared/api/client'
import { select, setTab } from '@shared/model/editor'
import { useStore } from '@shared/model/store'
import { startSpanDrag, type DragEdge } from '@widgets/timeline/lib/drag'
import { Waveform } from '@widgets/timeline/ui/Waveform'

export interface ItemBlockProps
{
    item: Item
    track: Track
    pxPerSec: number
    height: number
    /** Ищет дорожку под курсором: перенос между дорожками. */
    trackAt: (event: PointerEvent) => string | undefined
}

const THUMB_WIDTH = 64
const WAVE_HEIGHT = 20

export const block = cva(
    'absolute top-1 cursor-grab overflow-hidden rounded-md border select-none',
    {
        variants:
        {
            tone:
            {
                media: 'border-border bg-card',
                text: 'border-amber-400/55 bg-amber-400/20',
                cue: 'border-emerald-400/50 bg-emerald-400/20',
            },
            selected: { true: 'border-primary ring-1 ring-primary', false: '' },
        },
    },
)

export const handle = cva(
    'absolute inset-y-0 w-2 cursor-ew-resize hover:bg-primary/50',
    { variants: { edge: { start: 'left-0', end: 'right-0' } } },
)

export const label =
    'pointer-events-none absolute inset-x-1.5 bottom-px truncate text-[11px] leading-[14px] [text-shadow:0_1px_2px_#000]'

export function ItemBlock({
    item,
    track,
    pxPerSec,
    height,
    trackAt,
}: ItemBlockProps)
{
    const asset = useStore((s) =>
        isMediaItem(item) ? s.assets[item.assetId] : undefined,
    )
    const selected = useStore(
        (s) => s.selection?.kind === 'item' && s.selection.id === item.id,
    )
    const width = Math.max(6, item.duration * pxPerSec)
    const media = isMediaItem(item) ? item : null
    const keys = media
        ? track.kind === 'content'
            ? media.frame
            : media.boxKeys
        : []
    const caption = isTextItem(item) ? item.text : (asset?.name ?? '')
    const limit = media && asset ? maxDuration(media, asset) : Infinity
    const headroom =
        media && asset && asset.kind !== 'image' ? media.offset : Infinity

    const drag = (event: React.PointerEvent, edge: DragEdge) =>
    {
        select({ kind: 'item', id: item.id })
        setTab('item')
        startSpanDrag(event,
        {
            edge,
            start: item.start,
            duration: item.duration,
            pxPerSec,
            snap: snapPoints(item.id),
            minDuration: MIN_ITEM_SECONDS,
            maxDuration: limit,
            headroom,
            trackAt,
            onChange: (next, final) => placeItem(item.id, next, final),
        })
    }

    const thumbs = asset?.thumbs
    const showThumbs = height >= 60 && thumbs && thumbs.count > 0
    const count = Math.max(1, Math.floor(width / THUMB_WIDTH))
    const thumbIndexes = Array.from({ length: count }, (_, i) =>
    {
        if (!media || !thumbs) return 1
        const t = media.offset + ((i + 0.5) / count) * item.duration
        return Math.min(
            thumbs.count,
            Math.max(1, Math.floor(t * thumbs.fps) + 1),
        )
    })

    return (
        <div
            className={block(
            {
                tone: isTextItem(item) ? 'text' : 'media',
                selected,
            })}
            style={{ left: item.start * pxPerSec, width, height }}
            onPointerDown={(e) => drag(e, 'move')}
            title={`${caption || '—'} · ${item.duration.toFixed(2)}s`}
        >
            {showThumbs && asset && (
                <div className="flex h-[54px] overflow-hidden">
                    {thumbIndexes.map((n, i) => (
                        <img
                            key={i}
                            src={thumbUrl(asset.id, n)}
                            alt=""
                            className="pointer-events-none h-full flex-none object-cover"
                            style={{ width: width / count }}
                            draggable={false}
                        />
                    ))}
                </div>
            )}
            {media && asset?.peaks && asset.peaks.length > 0 && (
                <Waveform
                    peaks={asset.peaks}
                    from={media.offset}
                    to={media.offset + item.duration}
                    width={Math.round(width)}
                    height={Math.min(WAVE_HEIGHT, height - 4)}
                />
            )}
            <span className={label}>{caption || '…'}</span>
            {keys.length > 0 && (
                <div className="pointer-events-none absolute inset-x-0 top-0.5 h-2.5">
                    {keys.map((k) => (
                        <span
                            key={k.t}
                            className="absolute size-2 -translate-x-1 rotate-45 bg-amber-300"
                            style={{ left: k.t * pxPerSec }}
                            title={`ключ ${k.t.toFixed(2)}s`}
                        />
                    ))}
                </div>
            )}
            <div
                className={handle({ edge: 'start' })}
                title="Тянуть начало"
                onPointerDown={(e) => drag(e, 'start')}
            />
            <div
                className={handle({ edge: 'end' })}
                title="Тянуть конец"
                onPointerDown={(e) => drag(e, 'end')}
            />
        </div>
    )
}
