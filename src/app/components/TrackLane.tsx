import { ASSET_DRAG_TYPE } from '@entities/asset'
import { Eye, EyeOff, Volume2, VolumeX, X } from 'lucide-react'
import { getState, useStore } from '@shared/model/store'
import { addAssetToTimeline, removeTrack, updateTrack } from '@entities/project'
import { select } from '@shared/model/editor'
import { ItemBlock } from '@app/components/ItemBlock'
import { sortedItems } from '@core/timeline'
import type { Track } from '@core/model'

interface TrackLaneProps
{
    track: Track
    pxPerSec: number
    width: number
    height: number
    trackAt: (event: PointerEvent) => string | undefined
}

export function TrackLane({
    track,
    pxPerSec,
    width,
    height,
    trackAt,
}: TrackLaneProps)
{
    useStore((s) => s.assets)
    const drop = (event: React.DragEvent) =>
    {
        event.preventDefault()
        const id = event.dataTransfer.getData(ASSET_DRAG_TYPE)
        const asset = getState().assets[id]
        if (!asset || asset.status !== 'ready') return
        const rect = event.currentTarget.getBoundingClientRect()
        addAssetToTimeline(
            asset,
            track.id,
            Math.max(0, (event.clientX - rect.left) / pxPerSec),
        )
    }

    return (
        <div className="lane" style={{ height }}>
            <div className="lane__head">
                <span className="lane__name" title={track.name}>
                    {track.name}
                </span>
                <div className="lane__buttons">
                    {track.kind !== 'audio' && (
                        <button
                            className={`btn btn--small btn--ghost ${track.hidden ? 'btn--off' : ''}`}
                            onClick={() =>
                                updateTrack(track.id, { hidden: !track.hidden })
                            }
                            title={track.hidden ? 'Показать' : 'Скрыть'}
                        >
                            {track.hidden ? <EyeOff /> : <Eye />}
                        </button>
                    )}
                    <button
                        className={`btn btn--small btn--ghost ${track.muted ? 'btn--off' : ''}`}
                        onClick={() =>
                            updateTrack(track.id, { muted: !track.muted })
                        }
                        title={track.muted ? 'Включить звук' : 'Заглушить'}
                    >
                        {track.muted ? <VolumeX /> : <Volume2 />}
                    </button>
                    {track.kind !== 'content' && (
                        <button
                            className="btn btn--small btn--ghost btn--danger"
                            onClick={() => removeTrack(track.id)}
                            title="Убрать дорожку"
                            aria-label="Убрать дорожку"
                        >
                            <X />
                        </button>
                    )}
                </div>
            </div>
            <div
                className={`lane__body lane__body--${track.kind} ${track.hidden ? 'lane__body--hidden' : ''}`}
                style={{ width }}
                data-track={track.id}
                onPointerDown={() => select(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={drop}
            >
                {sortedItems(track).map((item) => (
                    <ItemBlock
                        key={item.id}
                        item={item}
                        track={track}
                        pxPerSec={pxPerSec}
                        height={height - 8}
                        trackAt={trackAt}
                    />
                ))}
            </div>
        </div>
    )
}
