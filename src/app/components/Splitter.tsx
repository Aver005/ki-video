/** С какой стороны панели стоит ручка: от этого зависит, куда панель растёт. */
export type SplitterSide = 'left' | 'right' | 'top'

interface SplitterProps
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

/** Ручка слева и сверху: панель растёт против движения курсора, справа — по движению. */
const SIGN: Record<SplitterSide, 1 | -1> = { left: -1, right: 1, top: -1 }

export function Splitter({ side, value, min, max, onChange }: SplitterProps)
{
    const axis = AXIS[side]
    const down = (event: React.PointerEvent) =>
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
            className={`splitter splitter--${side}`}
            onPointerDown={down}
            role="separator"
            aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
        />
    )
}
