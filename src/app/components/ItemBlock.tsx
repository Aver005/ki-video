import { thumbUrl } from '@app/api'
import { useStore } from '@app/store/store'
import {
    maxDuration,
    placeItem,
    select,
    setTab,
    snapPoints,
} from '@app/store/actions'
import { Waveform } from '@app/components/Waveform'
import { startSpanDrag, type DragEdge } from '@app/components/drag'
import {
    isMediaItem,
    isTextItem,
    MIN_ITEM_SECONDS,
    type Item,
    type Track,
} from '@shared/model'

interface ItemBlockProps
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
            className={`item item--${item.kind} ${selected ? 'item--selected' : ''}`}
            style={{ left: item.start * pxPerSec, width, height }}
            onPointerDown={(e) => drag(e, 'move')}
            title={`${caption || '—'} · ${item.duration.toFixed(2)}s`}
        >
            {showThumbs && asset && (
                <div className="item__thumbs">
                    {thumbIndexes.map((n, i) => (
                        <img
                            key={i}
                            src={thumbUrl(asset.id, n)}
                            alt=""
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
            <span className="item__label">{caption || '…'}</span>
            {keys.length > 0 && (
                <div className="item__keys">
                    {keys.map((k) => (
                        <span
                            key={k.t}
                            className="key"
                            style={{ left: k.t * pxPerSec }}
                            title={`ключ ${k.t.toFixed(2)}s`}
                        />
                    ))}
                </div>
            )}
            <div
                className="item__handle item__handle--l"
                title="Тянуть начало"
                onPointerDown={(e) => drag(e, 'start')}
            />
            <div
                className="item__handle item__handle--r"
                title="Тянуть конец"
                onPointerDown={(e) => drag(e, 'end')}
            />
        </div>
    )
}
