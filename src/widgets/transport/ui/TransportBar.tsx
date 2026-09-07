// Транспорт под превью: перемотка, воспроизведение, ключевой кадр, разрез и масштаб таймлайна.

import type { ReactNode } from 'react'
import { Diamond, Pause, Play, Scissors, SkipBack } from 'lucide-react'
import { formatTime } from '@core/math'
import { useProjectDuration } from '@entities/project'
import { useCurrentContent } from '@entities/timeline'
import { useStore } from '@shared/model/store'
import { Button } from '@shared/ui/button'
import { Slider } from '@shared/ui/slider'
import { Toggle } from '@shared/ui/toggle'

export interface TransportBarProps
{
    onRewind: () => void
    onTogglePlay: () => void
    onKeyframeChange: (add: boolean) => void
    onSplit: () => void
    onZoom: (pxPerSec: number) => void
}

/** Подсказка нативным title: кнопки бывают отключены, а всплывашка RAC на таких не показывается. */
function Hint({ text, children }: { text: string; children: ReactNode })
{
    return (
        <span title={text} className="inline-flex">
            {children}
        </span>
    )
}

export function TransportBar({
    onRewind,
    onTogglePlay,
    onKeyframeChange,
    onSplit,
    onZoom,
}: TransportBarProps)
{
    const time = useStore((s) => s.time)
    const playing = useStore((s) => s.playing)
    const pxPerSec = useStore((s) => s.pxPerSec)
    const duration = useProjectDuration()
    const current = useCurrentContent()
    const hasKey = current?.keyframe !== undefined
    return (
        <div className="flex flex-wrap items-center gap-2 border-t bg-card px-3 py-2">
            <Hint text="В начало (Home)">
                <Button
                    variant="outline"
                    size="icon"
                    onPress={onRewind}
                    aria-label="В начало"
                >
                    <SkipBack />
                </Button>
            </Hint>
            <Hint text="Пробел">
                <Button
                    size="icon"
                    onPress={onTogglePlay}
                    isDisabled={duration === 0}
                    aria-label={playing ? 'Пауза' : 'Играть'}
                >
                    {playing ? <Pause /> : <Play />}
                </Button>
            </Hint>
            <span className="font-mono whitespace-nowrap tabular-nums">
                {formatTime(time)}{' '}
                <span className="text-muted-foreground">
                    / {formatTime(duration)}
                </span>
            </span>
            <span className="flex-1" />
            <Hint text="Ключевой кадр (K)">
                <Toggle
                    isSelected={hasKey}
                    isDisabled={!current}
                    onChange={onKeyframeChange}
                >
                    <Diamond />
                    {hasKey ? 'Убрать ключ' : 'Ключ'}
                </Toggle>
            </Hint>
            <Hint text="Разрезать (S)">
                <Button
                    variant="outline"
                    isDisabled={!current}
                    onPress={onSplit}
                >
                    <Scissors />
                    Разрезать
                </Button>
            </Hint>
            <Slider
                aria-label="Масштаб таймлайна"
                className="w-30"
                minValue={10}
                maxValue={200}
                value={pxPerSec}
                onChange={onZoom}
            />
        </div>
    )
}
