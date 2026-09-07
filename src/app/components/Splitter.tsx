interface SplitterProps
{
    axis: 'x' | 'y'
    value: number
    min: number
    max: number
    onChange: (value: number, final: boolean) => void
}

/** Граница панели: тянется мышью. Панель растёт влево или вверх, поэтому смещение со знаком минус. */
export function Splitter({ axis, value, min, max, onChange }: SplitterProps)
{
    const down = (event: React.PointerEvent) =>
    {
        event.preventDefault()
        const origin = axis === 'x' ? event.clientX : event.clientY
        const apply = (ev: PointerEvent, final: boolean) =>
        {
            const now = axis === 'x' ? ev.clientX : ev.clientY
            const next = Math.min(max, Math.max(min, value - (now - origin)))
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
            className={`splitter splitter--${axis}`}
            onPointerDown={down}
            role="separator"
            aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
        />
    )
}
