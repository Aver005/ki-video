import type { Preset } from '@core/presets'

interface PresetRowProps<T>
{
    presets: readonly Preset<T>[]
    activeId?: string | undefined
    onPick: (preset: Preset<T>) => void
}

export function PresetRow<T>({ presets, activeId, onPick }: PresetRowProps<T>)
{
    return (
        <div className="presets">
            {presets.map((preset) => (
                <button
                    key={preset.id}
                    className={`chip ${preset.id === activeId ? 'chip--active' : ''}`}
                    onClick={() => onPick(preset)}
                >
                    {preset.label}
                </button>
            ))}
        </div>
    )
}
