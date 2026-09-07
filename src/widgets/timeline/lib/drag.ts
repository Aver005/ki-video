// Перетаскивание отрезка на таймлайне: перенос целиком и растягивание за края, с прилипанием.

export type DragEdge = 'move' | 'start' | 'end'

export interface SpanChange
{
    start: number
    duration: number
    /** Дорожка под курсором, если перенос между дорожками разрешён. */
    trackId?: string
}

export interface SpanDragOptions
{
    edge: DragEdge
    start: number
    duration: number
    pxPerSec: number
    /** Точки прилипания в секундах: курсор, края соседей. */
    snap: readonly number[]
    minDuration: number
    maxDuration: number
    /** Насколько можно уйти левым краем внутрь исходника (сек от текущего края). */
    headroom: number
    trackAt?: (event: PointerEvent) => string | undefined
    onChange: (next: SpanChange, final: boolean) => void
}

/** Прилипание к ближайшей точке, если она ближе восьми пикселей. */
const SNAP_PX = 8

function snapTime(
    value: number,
    snap: readonly number[],
    pxPerSec: number,
): number
{
    const limit = SNAP_PX / pxPerSec
    let best = value
    let bestDistance = limit
    for (const point of snap)
    {
        const distance = Math.abs(point - value)
        if (distance < bestDistance)
        {
            best = point
            bestDistance = distance
        }
    }
    return best
}

function nextSpan(options: SpanDragOptions, seconds: number): SpanChange
{
    const { start, duration, snap, pxPerSec, minDuration, maxDuration } =
        options
    const end = start + duration
    if (options.edge === 'move')
    {
        const moved = Math.max(0, start + seconds)
        const byStart = snapTime(moved, snap, pxPerSec)
        const byEnd = snapTime(moved + duration, snap, pxPerSec) - duration
        const chosen =
            Math.abs(byStart - moved) <= Math.abs(byEnd - moved)
                ? byStart
                : byEnd
        return { start: Math.max(0, chosen), duration }
    }
    if (options.edge === 'start')
    {
        const limit = Math.max(0, start - options.headroom)
        const raw = snapTime(start + seconds, snap, pxPerSec)
        const bounded = Math.min(Math.max(raw, limit), end - minDuration)
        return { start: bounded, duration: end - bounded }
    }
    const raw = snapTime(end + seconds, snap, pxPerSec)
    const bounded = Math.min(
        Math.max(raw, start + minDuration),
        start + maxDuration,
    )
    return { start, duration: bounded - start }
}

/** Ведёт жест до отпускания кнопки: промежуточные шаги без записи в историю, последний — с записью. */
export function startSpanDrag(
    event: React.PointerEvent,
    options: SpanDragOptions,
): void
{
    event.stopPropagation()
    event.preventDefault()
    const originX = event.clientX
    const apply = (ev: PointerEvent, final: boolean) =>
    {
        const seconds = (ev.clientX - originX) / options.pxPerSec
        const next = nextSpan(options, seconds)
        const trackId =
            options.edge === 'move' ? options.trackAt?.(ev) : undefined
        options.onChange(
            trackId === undefined ? next : { ...next, trackId },
            final,
        )
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
