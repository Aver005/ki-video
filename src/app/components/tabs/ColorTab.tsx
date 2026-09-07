import { useStore } from '@app/store/store'
import { update } from '@app/store/actions'
import { Slider } from '@app/components/Slider'
import { PresetRow } from '@app/components/PresetRow'
import { COLOR_PRESETS } from '@shared/presets'
import type { ColorGrade } from '@shared/model'

const FIELDS:
{
    key: keyof ColorGrade
    label: string
    min: number
    max: number
}[] = [
    { key: 'brightness', label: 'Яркость', min: -0.5, max: 0.5 },
    { key: 'contrast', label: 'Контраст', min: 0.5, max: 2 },
    { key: 'saturation', label: 'Насыщенность', min: 0, max: 3 },
    { key: 'gamma', label: 'Гамма', min: 0.5, max: 2 },
    { key: 'vibrance', label: 'Сочность', min: -1, max: 1 },
    { key: 'sharpen', label: 'Резкость', min: 0, max: 2 },
]

function sameGrade(a: ColorGrade, b: ColorGrade): boolean
{
    return FIELDS.every((f) => Math.abs(a[f.key] - b[f.key]) < 0.001)
}

export function ColorTab()
{
    const color = useStore((s) => s.project?.color)
    if (!color) return null
    const activeId = COLOR_PRESETS.find((p) => sameGrade(p.value, color))?.id
    return (
        <div className="tab-body">
            <PresetRow
                presets={COLOR_PRESETS}
                activeId={activeId}
                onPick={(preset) =>
                    update((p) =>
                    {
                        p.color = { ...preset.value }
                    })
                }
            />
            {FIELDS.map((f) => (
                <Slider
                    key={f.key}
                    label={f.label}
                    value={color[f.key]}
                    min={f.min}
                    max={f.max}
                    onChange={(v, final) =>
                        update((p) =>
                        {
                            p.color[f.key] = v
                        }, final)
                    }
                />
            ))}
            <p className="muted">
                В превью видны яркость, контраст и насыщенность. Гамма, сочность
                и резкость — при экспорте.
            </p>
        </div>
    )
}
