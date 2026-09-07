import { seek } from '@entities/player'
import { Plus } from 'lucide-react'
import { useStore } from '@shared/model/store'
import { addTrack } from '@entities/project'
import { TrackLane } from '@app/components/TrackLane'
import { CueLane } from '@app/components/CueLane'
import { Playhead } from '@app/components/Playhead'
import { projectDuration } from '@core/timeline'
import { formatTime } from '@core/math'

const PAD_SEC = 5
export const HEAD_WIDTH = 132

const ROW_HEIGHT: Record<string, number> =
{
    content: 118,
    overlay: 48,
    audio: 48,
}
const CUE_HEIGHT = 30

function tickStep(pxPerSec: number): number
{
    if (pxPerSec >= 120) return 0.5
    if (pxPerSec >= 60) return 1
    if (pxPerSec >= 25) return 2
    return 5
}

/** Клик и протяжка по линейке двигают курсор. */
function scrub(e: React.PointerEvent<HTMLDivElement>, pxPerSec: number): void
{
    const rect = e.currentTarget.getBoundingClientRect()
    const toTime = (clientX: number) => (clientX - rect.left) / pxPerSec
    seek(toTime(e.clientX))
    const move = (ev: PointerEvent) => seek(toTime(ev.clientX))
    const up = () =>
    {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
}

/** Дорожка под курсором: перенос элемента с одной на другую. */
function trackAt(event: PointerEvent): string | undefined
{
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const lane = element?.closest('[data-track]')
    return lane instanceof HTMLElement ? lane.dataset['track'] : undefined
}

export function Timeline()
{
    const project = useStore((s) => s.project)
    const pxPerSec = useStore((s) => s.pxPerSec)
    if (!project) return null

    const duration = projectDuration(project)
    const width = (duration + PAD_SEC) * pxPerSec
    const step = tickStep(pxPerSec)
    const ticks = Array.from(
        { length: Math.ceil((duration + PAD_SEC) / step) + 1 },
        (_, i) => i * step,
    )

    return (
        <div className="timeline">
            <div
                className="timeline__inner"
                style={{ width: width + HEAD_WIDTH }}
            >
                <div className="lane lane--ruler">
                    <div className="lane__head">
                        <button
                            className="btn btn--small"
                            onClick={() => addTrack('overlay')}
                            title="Добавить дорожку наложений"
                        >
                            <Plus />
                            слой
                        </button>
                        <button
                            className="btn btn--small"
                            onClick={() => addTrack('audio')}
                            title="Добавить звуковую дорожку"
                        >
                            <Plus />
                            звук
                        </button>
                    </div>
                    <div
                        className="ruler"
                        style={{ width }}
                        onPointerDown={(e) => scrub(e, pxPerSec)}
                    >
                        {ticks.map((t) => (
                            <span
                                key={t}
                                className="ruler__tick"
                                style={{ left: t * pxPerSec }}
                            >
                                {Number.isInteger(t)
                                    ? formatTime(t, false)
                                    : ''}
                            </span>
                        ))}
                    </div>
                </div>
                {project.tracks.map((track) => (
                    <TrackLane
                        key={track.id}
                        track={track}
                        pxPerSec={pxPerSec}
                        width={width}
                        height={ROW_HEIGHT[track.kind] ?? 48}
                        trackAt={trackAt}
                    />
                ))}
                <CueLane
                    pxPerSec={pxPerSec}
                    width={width}
                    height={CUE_HEIGHT}
                />
                <Playhead pxPerSec={pxPerSec} offset={HEAD_WIDTH} />
            </div>
        </div>
    )
}
