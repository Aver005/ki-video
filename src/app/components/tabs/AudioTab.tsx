import { useStore } from '@shared/model/store'
import { update } from '@entities/project'
import { SliderField } from '@shared/ui/kit/SliderField'
import { PresetRow } from '@app/components/PresetRow'
import { AUDIO_PRESETS } from '@core/presets'
import type { AudioChain } from '@core/model'

const LOUDNESS = [
    { value: 0, label: 'Выкл' },
    { value: -12, label: '-12 LUFS громко' },
    { value: -14, label: '-14 LUFS ТикТок' },
    { value: -16, label: '-16 LUFS мягко' },
]

function sameChain(a: AudioChain, b: AudioChain): boolean
{
    return (
        a.denoise === b.denoise &&
        a.highpass === b.highpass &&
        a.compressor === b.compressor &&
        a.loudness === b.loudness
    )
}

export function AudioTab()
{
    const audio = useStore((s) => s.project?.audio)
    if (!audio) return null
    const patch = (value: Partial<AudioChain>, record = true) =>
        update((p) =>
        {
            Object.assign(p.audio, value)
        }, record)
    return (
        <div className="tab-body">
            <PresetRow
                presets={AUDIO_PRESETS}
                activeId={
                    AUDIO_PRESETS.find((p) => sameChain(p.value, audio))?.id
                }
                onPick={(preset) => patch({ ...preset.value })}
            />
            <SliderField
                label="Шумодав"
                value={audio.denoise}
                min={0}
                max={1}
                neutral={0}
                onChange={(v, final) => patch({ denoise: v }, final)}
            />
            <label className="check">
                <input
                    type="checkbox"
                    checked={audio.highpass}
                    onChange={(e) => patch({ highpass: e.target.checked })}
                />
                Срез низов (80 Гц)
            </label>
            <label className="check">
                <input
                    type="checkbox"
                    checked={audio.compressor}
                    onChange={(e) => patch({ compressor: e.target.checked })}
                />
                Компрессор
            </label>
            <label className="field">
                <span>Громкость</span>
                <select
                    value={audio.loudness}
                    onChange={(e) =>
                        patch({ loudness: Number(e.target.value) })
                    }
                >
                    {LOUDNESS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </label>
            <p className="muted">
                Звуковая цепочка применяется при экспорте; превью играет
                исходный звук.
            </p>
        </div>
    )
}
