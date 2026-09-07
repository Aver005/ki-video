// Ручка для растягивания панели. Слева и сверху панель растёт против движения курсора.

import type { PointerEvent as ReactPointerEvent } from 'react'

export type SplitterSide = 'left' | 'right' | 'top'

export interface SplitterProps
{
    side: SplitterSide
    value: number
    min: number
    max: number
    onChange: (value: number, final: boolean) => void
}

const AXIS: Record<SplitterSide, 'x' | 'y'> =
{
    left: 'x',
    right: 'x',
    top: 'y',
}
const SIGN: Record<SplitterSide, 1 | -1> = { left: -1, right: 1, top: -1 }
const BOX: Record<SplitterSide, string> =
{
    left: 'inset-y-0 -left-[3px] w-1.5 cursor-col-resize',
    right: 'inset-y-0 -right-[3px] w-1.5 cursor-col-resize',
    top: '-top-[3px] inset-x-0 h-1.5 cursor-row-resize',
}

export function Splitter({ side, value, min, max, onChange }: SplitterProps)
{
    const axis = AXIS[side]
    const down = (event: ReactPointerEvent) =>
    {
        event.preventDefault()
        const origin = axis === 'x' ? event.clientX : event.clientY
        const apply = (ev: PointerEvent, final: boolean) =>
        {
            const now = axis === 'x' ? ev.clientX : ev.clientY
            const next = Math.min(
                max,
                Math.max(min, value + SIGN[side] * (now - origin)),
            )
            onChange(Math.round(next), final)
        }
        const move = (ev: PointerEvent) => apply(ev, false)
        const up = (ev: PointerEvent) =>
        {
            apply(ev, true)
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
    }
    return (
        <div
            className={`absolute z-[5] transition-colors hover:bg-primary ${BOX[side]}`}
            onPointerDown={down}
            role="separator"
            aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
        />
    )
}
