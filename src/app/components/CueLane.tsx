import { seek } from '@entities/player'
import { useStore } from '@shared/model/store'
import { updateCue } from '@entities/project'
import { select, setTab } from '@shared/model/editor'
import { startSpanDrag, type DragEdge } from '@app/components/drag'
import { MIN_ITEM_SECONDS, type SubtitleCue } from '@core/model'

interface CueLaneProps
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
        <div className="lane" style={{ height }}>
            <div className="lane__head">
                <span className="lane__name">Субтитры</span>
            </div>
            <div
                className="lane__body lane__body--cues"
                style={{ width }}
                onPointerDown={() => select(null)}
            >
                {cues.map((cue) => (
                    <div
                        key={cue.id}
                        className={`item item--cue ${selection?.kind === 'cue' && selection.id === cue.id ? 'item--selected' : ''}`}
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
                        <span className="item__label">{cue.text}</span>
                        <div
                            className="item__handle item__handle--l"
                            onPointerDown={(e) => drag(e, cue, 'start')}
                        />
                        <div
                            className="item__handle item__handle--r"
                            onPointerDown={(e) => drag(e, cue, 'end')}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
