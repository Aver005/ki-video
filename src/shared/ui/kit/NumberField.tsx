// Числовой ввод. RAC берёт значение на blur, стрелках и колесе, поэтому черновик не нужен.

import { NumberField as NumberFieldPrimitive } from 'react-aria-components'
import { cn } from 'cn'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'

export interface NumberFieldProps
{
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    /** Знаков после запятой. */
    digits?: number
    /** Приписка после числа: «×», «с». */
    unit?: string
    /** Подпись только для чтения с экрана: нужна в ряду с ползунком. */
    labelHidden?: boolean
    onChange: (value: number) => void
    className?: string
}

export function NumberField({
    label,
    value,
    min,
    max,
    step,
    digits = 2,
    unit,
    labelHidden = false,
    onChange,
    className,
}: NumberFieldProps)
{
    return (
        <NumberFieldPrimitive
            value={value}
            onChange={onChange}
            minValue={min}
            maxValue={max}
            step={step}
            // Колесо по сфокусированному полю: значение по умолчанию у RAC не описано.
            isWheelDisabled={false}
            formatOptions={
            {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
            }}
            className={cn('flex flex-col gap-1', className)}
        >
            <Label
                className={
                    labelHidden ? 'sr-only' : 'text-xs text-muted-foreground'
                }
            >
                {label}
            </Label>
            <div className="relative">
                <Input
                    className={cn(
                        'text-right font-mono tabular-nums',
                        unit && 'pr-5',
                    )}
                />
                {unit && (
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
                        {unit}
                    </span>
                )}
            </div>
        </NumberFieldPrimitive>
    )
}
