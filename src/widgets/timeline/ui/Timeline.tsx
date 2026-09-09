// Таймлайн: линейка сверху, дорожки, субтитры и курсор.

import { Plus } from 'lucide-react'
import { formatTime } from '@core/math'
import { projectDuration } from '@core/timeline'
import { seek } from '@entities/player'
import { addTrack } from '@entities/project'
import { useStore } from '@shared/model/store'
import { Button } from '@shared/ui/button'
import { CueLane } from '@widgets/timeline/ui/CueLane'
import { Playhead } from '@widgets/timeline/ui/Playhead'
import { laneHead, laneRow, TrackLane } from '@widgets/timeline/ui/TrackLane'

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
        <div className="relative h-full overflow-auto">
            <div
                className="relative min-w-full"
                style={{ width: width + HEAD_WIDTH }}
            >
                <div
                    className={`${laneRow()} sticky top-0 z-[4] h-[30px] bg-card`}
                >
                    <div className={laneHead({ ruler: true })}>
                        <Button
                            size="xs"
                            variant="ghost"
                            onPress={() => addTrack('overlay')}
                        >
                            <Plus />
                            слой
                        </Button>
                        <Button
                            size="xs"
                            variant="ghost"
                            onPress={() => addTrack('audio')}
                        >
                            <Plus />
                            звук
                        </Button>
                    </div>
                    <div
                        className="relative h-full flex-none cursor-pointer select-none"
                        style={{ width }}
                        onPointerDown={(e) => scrub(e, pxPerSec)}
                    >
                        {ticks.map((t) => (
                            <span
                                key={t}
                                className="absolute top-0 h-full border-l pl-1 font-mono text-[10px] text-muted-foreground"
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
