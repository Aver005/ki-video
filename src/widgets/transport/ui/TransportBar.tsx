// Транспорт под превью: перемотка вокруг воспроизведения, ключ, разрез и масштаб таймлайна.

import type { ReactNode } from 'react'
import {
    Diamond,
    Pause,
    Play,
    Scissors,
    SkipBack,
    SkipForward,
    StepBack,
    StepForward,
    ZoomIn,
} from 'lucide-react'
import { formatTime } from '@core/math'
import { getPlayer, seek } from '@entities/player'
import {
    addKeyframe,
    removeKeyframe,
    useCurrentContent,
    useProjectDuration,
} from '@entities/project'
import { splitAtPlayhead } from '@features/split-item'
import { setZoom } from '@shared/model/editor'
import { useStore } from '@shared/model/store'
import { Button } from '@shared/ui/button'
import { Separator } from '@shared/ui/separator'
import { Slider } from '@shared/ui/slider'
import { Toggle } from '@shared/ui/toggle'

/** Шаг кадра при перемотке кнопками — тот же, что у стрелок на клавиатуре. */
const STEP = 1 / 30

/** Подсказка нативным title: кнопки бывают отключены, а всплывашка RAC на таких не показывается. */
function Hint({ text, children }: { text: string; children: ReactNode })
{
    return (
        <span title={text} className="inline-flex">
            {children}
        </span>
    )
}

export function TransportBar()
{
    const time = useStore((s) => s.time)
    const playing = useStore((s) => s.playing)
    const pxPerSec = useStore((s) => s.pxPerSec)
    const duration = useProjectDuration()
    const current = useCurrentContent()
    const empty = duration === 0
    return (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t bg-card px-3 py-2">
            <span className="justify-self-start font-mono text-sm whitespace-nowrap tabular-nums">
                {formatTime(time)}
                <span className="text-muted-foreground">
                    {' '}
                    / {formatTime(duration)}
                </span>
            </span>

            <div className="flex items-center gap-1">
                <Hint text="В начало (Home)">
                    <Button
                        variant="ghost"
                        size="icon"
                        onPress={() => seek(0)}
                        aria-label="В начало"
                    >
                        <SkipBack />
                    </Button>
                </Hint>
                <Hint text="Кадр назад (←)">
                    <Button
                        variant="ghost"
                        size="icon"
                        onPress={() => seek(time - STEP)}
                        aria-label="Кадр назад"
                    >
                        <StepBack />
                    </Button>
                </Hint>
                <Hint text="Пробел">
                    <Button
                        size="icon-lg"
                        className="rounded-full"
                        onPress={() => getPlayer().toggle()}
                        isDisabled={empty}
                        aria-label={playing ? 'Пауза' : 'Играть'}
                    >
                        {playing ? <Pause /> : <Play />}
                    </Button>
                </Hint>
                <Hint text="Кадр вперёд (→)">
                    <Button
                        variant="ghost"
                        size="icon"
                        onPress={() => seek(time + STEP)}
                        aria-label="Кадр вперёд"
                    >
                        <StepForward />
                    </Button>
                </Hint>
                <Hint text="В конец (End)">
                    <Button
                        variant="ghost"
                        size="icon"
                        onPress={() => seek(duration)}
                        isDisabled={empty}
                        aria-label="В конец"
                    >
                        <SkipForward />
                    </Button>
                </Hint>
            </div>

            <div className="flex items-center justify-end gap-2">
                <Hint text="Ключевой кадр (K)">
                    <Toggle
                        isSelected={current?.keyframe !== undefined}
                        isDisabled={!current}
                        onChange={(add) =>
                            add ? addKeyframe() : removeKeyframe()
                        }
                    >
                        <Diamond />
                        Ключ
                    </Toggle>
                </Hint>
                <Hint text="Разрезать (S)">
                    <Button
                        variant="outline"
                        isDisabled={!current}
                        onPress={splitAtPlayhead}
                    >
                        <Scissors />
                        Разрезать
                    </Button>
                </Hint>
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-1.5">
                    <ZoomIn className="text-muted-foreground" />
                    <Slider
                        aria-label="Масштаб таймлайна"
                        className="w-28"
                        minValue={10}
                        maxValue={200}
                        value={pxPerSec}
                        onChange={setZoom}
                    />
                </div>
            </div>
        </div>
    )
}
