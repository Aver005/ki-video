// Ряд инспектора: подпись, ползунок с засечками и числовой ввод.

import { useRef } from 'react'
import { NumberField } from '@shared/ui/kit/NumberField'
import { Slider } from '@shared/ui/slider'

export interface SliderFieldProps
{
    label: string
    value: number
    min: number
    max: number
    step?: number
    /** Опорное значение: высокая засечка, прилипание при перетаскивании, сброс двойным щелчком. */
    neutral?: number
    /** Приписка после числа: «×», «с». */
    unit?: string
    /** Число делений шкалы. */
    divisions?: number
    onChange: (value: number, final: boolean) => void
}

/** Доля шкалы, внутри которой перетаскивание встаёт ровно в опорное значение. */
const SNAP_FRACTION = 0.02

export function SliderField({
    label,
    value,
    min,
    max,
    step = 0.01,
    neutral,
    unit,
    divisions = 8,
    onChange,
}: SliderFieldProps)
{
    const span = max - min
    // Прилипание только для мыши: с клавиатуры шаг рядом с нейтралью иначе не выйдет из неё.
    // Слушаем на перехвате: react-aria гасит pointerdown на цели, до обёртки он не доходит.
    const dragging = useRef(false)
    const apply = (v: number, final: boolean): void =>
    {
        const snapped =
            dragging.current &&
            neutral !== undefined &&
            Math.abs(v - neutral) <= span * SNAP_FRACTION
                ? neutral
                : v
        if (final) dragging.current = false
        onChange(snapped, final)
    }
    return (
        <div className="grid grid-cols-[minmax(4.5rem,7.5rem)_1fr_4.5rem] items-center gap-2">
            <span className="truncate text-muted-foreground">{label}</span>
            <div
                onPointerDownCapture={() =>
                {
                    dragging.current = true
                }}
                onKeyDownCapture={() =>
                {
                    dragging.current = false
                }}
                onDoubleClick={() =>
                    neutral !== undefined && onChange(neutral, true)
                }
            >
                <Slider
                    aria-label={label}
                    minValue={min}
                    maxValue={max}
                    step={step}
                    value={value}
                    onChange={(v) => apply(v, false)}
                    onChangeEnd={(v) => apply(v, true)}
                />
                <div className="relative mt-1 h-2">
                    {Array.from({ length: divisions + 1 }, (_, i) => (
                        <span
                            key={i}
                            style={{ left: `${(i / divisions) * 100}%` }}
                            className="absolute top-0 h-1 w-px -translate-x-1/2 bg-muted-foreground/45"
                        />
                    ))}
                    {neutral !== undefined && (
                        <span
                            style={
                            {
                                left: `${((neutral - min) / span) * 100}%`,
                            }}
                            className="absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full bg-primary"
                        />
                    )}
                </div>
            </div>
            <NumberField
                label={label}
                labelHidden
                value={value}
                min={min}
                max={max}
                step={step}
                digits={step >= 1 ? 0 : 2}
                unit={unit}
                onChange={(v) => onChange(v, true)}
            />
        </div>
    )
}
