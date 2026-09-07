import { seek } from '@entities/player'
import { Diamond, RotateCcw } from 'lucide-react'
import { useStore } from '@shared/model/store'
import {
    addColorKey,
    clearColorKeys,
    colorAt,
    removeColorKey,
    setColor,
} from '@entities/project'
import { SliderField } from '@shared/ui/kit/SliderField'
import { PresetRow } from '@app/components/PresetRow'
import { COLOR_PRESETS } from '@core/presets'
import { NEUTRAL_COLOR } from '@core/model'
import { KEY_EPSILON } from '@core/keys'
import type { ColorGrade, ColorKeyframe } from '@core/model'

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

const NO_KEYS: readonly ColorKeyframe[] = []

export function ColorTab()
{
    // Значения зависят от курсора: при ключах цвет меняется по времени.
    const time = useStore((s) => s.time)
    const keys = useStore((s) => s.project?.colorKeys ?? NO_KEYS)
    const hasProject = useStore((s) => s.project !== null)
    if (!hasProject) return null
    const { color, keyframe } = colorAt()
    const activeId = COLOR_PRESETS.find((p) => sameGrade(p.value, color))?.id
    return (
        <div className="tab-body">
            <PresetRow
                presets={COLOR_PRESETS}
                activeId={activeId}
                onPick={(preset) => setColor(preset.value)}
            />
            {FIELDS.map((f) => (
                <SliderField
                    key={f.key}
                    label={f.label}
                    value={color[f.key]}
                    min={f.min}
                    max={f.max}
                    neutral={NEUTRAL_COLOR[f.key]}
                    onChange={(v, final) => setColor({ [f.key]: v }, final)}
                />
            ))}
            <div className="row-actions">
                <button
                    className={`btn ${keyframe ? 'btn--active' : ''}`}
                    onClick={() =>
                        keyframe ? removeColorKey() : addColorKey()
                    }
                    title="Ключ цвета на шкале проекта"
                >
                    <Diamond />
                    {keyframe ? 'Убрать ключ' : `Ключ на ${time.toFixed(2)}s`}
                </button>
                <button
                    className="btn btn--ghost"
                    onClick={clearColorKeys}
                    disabled={keys.length === 0}
                >
                    <RotateCcw />
                    Сбросить ключи
                </button>
            </div>
            {keys.length > 0 && (
                <div className="presets">
                    {keys.map((k) => (
                        <button
                            key={k.t}
                            className={`chip ${Math.abs(k.t - time) <= KEY_EPSILON ? 'chip--active' : ''}`}
                            onClick={() => seek(k.t)}
                        >
                            {k.t.toFixed(2)}s
                        </button>
                    ))}
                </div>
            )}
            <p className="muted">
                В превью видны яркость, контраст и насыщенность. Гамма, сочность
                и резкость — при экспорте. По ключам меняются яркость, контраст,
                насыщенность и гамма; сочность и резкость остаются постоянными.
            </p>
        </div>
    )
}
