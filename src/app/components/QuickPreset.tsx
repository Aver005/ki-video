import { setColor, update } from '@app/store/actions'
import { AUDIO_PRESETS, COLOR_PRESETS } from '@shared/presets'

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
            <div className="section-title">Всё сразу</div>
            <button className="btn" onClick={applyQuickPreset}>
                Быстрый ТикТок-пресет
            </button>
        </>
    )
}
