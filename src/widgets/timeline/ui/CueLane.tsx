// Дорожка субтитров: реплики тянутся так же, как элементы.

import { MIN_ITEM_SECONDS, type SubtitleCue } from '@core/model'
import { seek } from '@entities/player'
import { updateCue } from '@entities/project'
import { select, setTab } from '@shared/model/editor'
import { useStore } from '@shared/model/store'
import { startSpanDrag, type DragEdge } from '@widgets/timeline/lib/drag'
import { block, handle, label } from '@widgets/timeline/ui/ItemBlock'
import { laneBody, laneHead, laneRow } from '@widgets/timeline/ui/TrackLane'

export interface CueLaneProps
{
    pxPerSec: number
    width: number
    height: number
}

const NO_CUES: readonly SubtitleCue[] = []

export function CueLane({ pxPerSec, width, height }: CueLaneProps)
{
    const cues = useStore((s) => s.project?.subtitles.cues ?? NO_CUES)
    const selection = useStore((s) => s.selection)

    const drag = (
        event: React.PointerEvent,
        cue: SubtitleCue,
        edge: DragEdge,
    ) =>
    {
        select({ kind: 'cue', id: cue.id })
        setTab('subtitles')
        startSpanDrag(event,
        {
            edge,
            start: cue.start,
            duration: cue.end - cue.start,
            pxPerSec,
            snap: [],
            minDuration: MIN_ITEM_SECONDS,
            maxDuration: Infinity,
            headroom: Infinity,
            onChange: (next, final) =>
                updateCue(
                    cue.id,
                    { start: next.start, end: next.start + next.duration },
                    final,
                ),
        })
    }

    return (
        <div className={laneRow()} style={{ height }}>
            <div className={laneHead()}>
                <span className="truncate text-xs text-foreground/75">
                    Субтитры
                </span>
            </div>
            <div
                className={laneBody({ kind: 'cues' })}
                style={{ width }}
                onPointerDown={() => select(null)}
            >
                {cues.map((cue) => (
                    <div
                        key={cue.id}
                        className={block(
                        {
                            tone: 'cue',
                            selected:
                                selection?.kind === 'cue' &&
                                selection.id === cue.id,
                        })}
                        style={
                        {
                            left: cue.start * pxPerSec,
                            width: Math.max(
                                6,
                                (cue.end - cue.start) * pxPerSec,
                            ),
                            height: height - 8,
                        }}
                        onDoubleClick={() => seek(cue.start)}
                        onPointerDown={(e) => drag(e, cue, 'move')}
                        title={cue.text}
                    >
                        <span className={label}>{cue.text}</span>
                        <div
                            className={handle({ edge: 'start' })}
                            onPointerDown={(e) => drag(e, cue, 'start')}
                        />
                        <div
                            className={handle({ edge: 'end' })}
                            onPointerDown={(e) => drag(e, cue, 'end')}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
