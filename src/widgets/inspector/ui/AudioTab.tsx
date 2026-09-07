import { CheckboxField } from '@shared/ui/kit/CheckboxField'
import { NativeSelect, NativeSelectOption } from '@shared/ui/native-select'
import { Field } from '@shared/ui/kit/Field'
import { useStore } from '@shared/model/store'
import { update } from '@entities/project'
import { SliderField } from '@shared/ui/kit/SliderField'
import { PresetRow } from '@shared/ui/kit/PresetRow'
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
        <div className="flex flex-col gap-2.5 p-3">
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
            <CheckboxField
                isSelected={audio.highpass}
                onChange={(on) => patch({ highpass: on })}
            >
                Срез низов (80 Гц)
            </CheckboxField>
            <CheckboxField
                isSelected={audio.compressor}
                onChange={(on) => patch({ compressor: on })}
            >
                Компрессор
            </CheckboxField>
            <Field label="Громкость">
                <NativeSelect
                    value={audio.loudness}
                    onChange={(e) =>
                        patch({ loudness: Number(e.target.value) })
                    }
                >
                    {LOUDNESS.map((o) => (
                        <NativeSelectOption key={o.value} value={o.value}>
                            {o.label}
                        </NativeSelectOption>
                    ))}
                </NativeSelect>
            </Field>
            <p className="text-muted-foreground">
                Звуковая цепочка применяется при экспорте; превью играет
                исходный звук.
            </p>
        </div>
    )
}
