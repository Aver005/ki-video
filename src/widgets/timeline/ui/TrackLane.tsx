// Дорожка: заголовок с кнопками слева и полоса с элементами справа.

import { Eye, EyeOff, Volume2, VolumeX, X } from 'lucide-react'
import { cva } from 'class-variance-authority'
import type { Track } from '@core/model'
import { sortedItems } from '@core/timeline'
import { ASSET_DRAG_TYPE } from '@entities/asset'
import { addAssetToTimeline, removeTrack, updateTrack } from '@entities/project'
import { select } from '@shared/model/editor'
import { getState, useStore } from '@shared/model/store'
import { Button } from '@shared/ui/button'
import { ItemBlock } from '@widgets/timeline/ui/ItemBlock'

export interface TrackLaneProps
{
    track: Track
    pxPerSec: number
    width: number
    height: number
    trackAt: (event: PointerEvent) => string | undefined
}

export const laneRow = cva('flex items-stretch border-b')

export const laneHead = cva(
    'sticky left-0 z-[3] flex w-[132px] flex-none flex-col justify-center gap-[3px] border-r bg-card px-1.5 py-1',
    { variants: { ruler: { true: 'flex-row items-center gap-1', false: '' } } },
)

export const laneBody = cva('relative flex-none',
{
    variants:
    {
        kind:
        {
            content: 'bg-blue-500/5',
            overlay: '',
            audio: 'bg-emerald-500/5',
            cues: '',
        },
        hidden: { true: 'opacity-35', false: '' },
    },
})

/** Кнопка дорожки: подсказка нативная, кнопки бывают отключены. */
function LaneButton({
    hint,
    dim,
    onPress,
    children,
}: {
    hint: string
    dim: boolean
    onPress: () => void
    children: React.ReactNode
})
{
    return (
        <span title={hint} className="inline-flex">
            <Button
                size="icon-xs"
                variant="ghost"
                className={dim ? 'opacity-50' : ''}
                onPress={onPress}
                aria-label={hint}
            >
                {children}
            </Button>
        </span>
    )
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
        <div className={laneRow()} style={{ height }}>
            <div className={laneHead()}>
                <span
                    className="truncate text-[11px] text-muted-foreground"
                    title={track.name}
                >
                    {track.name}
                </span>
                <div className="flex gap-0.5">
                    {track.kind !== 'audio' && (
                        <LaneButton
                            hint={track.hidden ? 'Показать' : 'Скрыть'}
                            dim={track.hidden === true}
                            onPress={() =>
                                updateTrack(track.id, { hidden: !track.hidden })
                            }
                        >
                            {track.hidden ? <EyeOff /> : <Eye />}
                        </LaneButton>
                    )}
                    <LaneButton
                        hint={track.muted ? 'Включить звук' : 'Заглушить'}
                        dim={track.muted === true}
                        onPress={() =>
                            updateTrack(track.id, { muted: !track.muted })
                        }
                    >
                        {track.muted ? <VolumeX /> : <Volume2 />}
                    </LaneButton>
                    {track.kind !== 'content' && (
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            className="text-destructive"
                            onPress={() => removeTrack(track.id)}
                            aria-label="Убрать дорожку"
                        >
                            <X />
                        </Button>
                    )}
                </div>
            </div>
            <div
                className={laneBody(
                {
                    kind: track.kind,
                    hidden: track.hidden === true,
                })}
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
