// Ряд пресетов: выбранный подсвечен заливкой.

import type { Preset } from '@core/presets'
import { Button } from '@shared/ui/button'

export interface PresetRowProps<T>
{
    presets: readonly Preset<T>[]
    activeId?: string | undefined
    onPick: (preset: Preset<T>) => void
}

export function PresetRow<T>({ presets, activeId, onPick }: PresetRowProps<T>)
{
    return (
        <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
                <Button
                    key={preset.id}
                    size="xs"
                    variant={preset.id === activeId ? 'default' : 'outline'}
                    className="rounded-full"
                    onPress={() => onPick(preset)}
                >
                    {preset.label}
                </Button>
            ))}
        </div>
    )
}
