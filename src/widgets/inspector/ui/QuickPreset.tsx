import { Button } from '@shared/ui/button'
import { Sparkles } from 'lucide-react'
import { setColor, update } from '@entities/project'
import { AUDIO_PRESETS, COLOR_PRESETS } from '@core/presets'

/** Один пресет на весь сценарий: сочный цвет, чистый голос, жирные субтитры. */
function applyQuickPreset(): void
{
    const color = COLOR_PRESETS.find((p) => p.id === 'punchy')
    const audio = AUDIO_PRESETS.find((p) => p.id === 'voice')
    if (color) setColor(color.value)
    update((p) =>
    {
        if (audio) p.audio = { ...audio.value }
        p.subtitles.preset = 'bold'
    })
}

export function QuickPreset()
{
    return (
        <>
            <div className="text-xs tracking-wider text-muted-foreground uppercase">
                Всё сразу
            </div>
            <Button variant="outline" onPress={applyQuickPreset}>
                <Sparkles />
                Быстрый ТикТок-пресет
            </Button>
        </>
    )
}
