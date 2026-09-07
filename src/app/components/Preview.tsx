import { useEffect, useRef } from 'react'
import { getPlayer } from '@app/hooks/usePlayer'
import { useStore } from '@shared/model/store'
import { currentContent, setFrame } from '@app/store/actions'
import { frameToRegion } from '@core/frame'

const CANVAS_HEIGHT = 960
const ZOOM_STEP = 1.1
/** Серия колёсика — один шаг истории. */
const WHEEL_SETTLE_MS = 300

/** Перетаскивание по превью двигает окно кадрирования, колесо — зум. */
function useFrameGestures(
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
): void
{
    useEffect(() =>
    {
        const canvas = canvasRef.current
        if (!canvas) return
        let dragging = false
        let last = { x: 0, y: 0 }
        let wheelTimer: ReturnType<typeof setTimeout> | null = null
        const sourcePerPixel = () =>
        {
            const current = currentContent()
            if (!current) return 0
            const region = frameToRegion(current.frame, current.asset,
            {
                width: canvas.width,
                height: canvas.height,
            })
            return region.w / canvas.clientWidth
        }
        const down = (e: PointerEvent) =>
        {
            if (!currentContent()) return
            dragging = true
            last = { x: e.clientX, y: e.clientY }
            canvas.setPointerCapture(e.pointerId)
        }
        const move = (e: PointerEvent) =>
        {
            if (!dragging) return
            const k = sourcePerPixel()
            const current = currentContent()
            if (!current) return
            setFrame(
                {
                    cx: current.frame.cx - (e.clientX - last.x) * k,
                    cy: current.frame.cy - (e.clientY - last.y) * k,
                },
                false,
            )
            last = { x: e.clientX, y: e.clientY }
        }
        const up = () =>
        {
            if (!dragging) return
            dragging = false
            if (currentContent()) setFrame({}, true)
        }
        const wheel = (e: WheelEvent) =>
        {
            const current = currentContent()
            if (!current) return
            e.preventDefault()
            const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
            setFrame({ zoom: current.frame.zoom * factor }, false)
            if (wheelTimer) clearTimeout(wheelTimer)
            wheelTimer = setTimeout(
                () => currentContent() && setFrame({}, true),
                WHEEL_SETTLE_MS,
            )
        }
        canvas.addEventListener('pointerdown', down)
        canvas.addEventListener('pointermove', move)
        canvas.addEventListener('pointerup', up)
        canvas.addEventListener('pointercancel', up)
        canvas.addEventListener('wheel', wheel, { passive: false })
        return () =>
        {
            if (wheelTimer) clearTimeout(wheelTimer)
            canvas.removeEventListener('pointerdown', down)
            canvas.removeEventListener('pointermove', move)
            canvas.removeEventListener('pointerup', up)
            canvas.removeEventListener('pointercancel', up)
            canvas.removeEventListener('wheel', wheel)
        }
    }, [canvasRef])
}

export function Preview()
{
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const output = useStore((s) => s.project?.output)
    const hasClips = useStore((s) =>
        s.project ? s.project.tracks.some((t) => t.items.length > 0) : false,
    )
    const width = output
        ? Math.round((CANVAS_HEIGHT * output.width) / output.height)
        : 540

    useEffect(() =>
    {
        const canvas = canvasRef.current
        if (canvas) getPlayer().attach(canvas)
    }, [width])
    useFrameGestures(canvasRef)

    return (
        <div className="preview">
            <canvas
                ref={canvasRef}
                className="preview__canvas"
                width={width}
                height={CANVAS_HEIGHT}
                aria-label="Превью кадра"
            />
            {!hasClips && (
                <div className="preview__hint">
                    Добавь файл слева и нажми «+»
                </div>
            )}
            {hasClips && (
                <div className="preview__tip muted">
                    тяни — панорама · колесо — зум · K — ключ
                </div>
            )}
        </div>
    )
}
