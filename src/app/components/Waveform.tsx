import { useEffect, useRef } from 'react'
import { PEAKS_PER_SECOND } from '@core/model'

interface WaveformProps
{
    peaks: readonly number[]
    from: number
    to: number
    width: number
    height: number
}

/** Рисует пики отрезка [from, to] в столбики по пикселям. */
export function Waveform({ peaks, from, to, width, height }: WaveformProps)
{
    const ref = useRef<HTMLCanvasElement | null>(null)
    useEffect(() =>
    {
        const canvas = ref.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return
        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = 'rgba(120, 200, 160, 0.7)'
        const span = Math.max(0.001, to - from)
        for (let px = 0; px < width; px += 1)
        {
            const t0 = from + (px / width) * span
            const t1 = from + ((px + 1) / width) * span
            const i0 = Math.floor(t0 * PEAKS_PER_SECOND)
            const i1 = Math.max(i0 + 1, Math.floor(t1 * PEAKS_PER_SECOND))
            let peak = 0
            for (let i = i0; i < i1; i += 1)
                peak = Math.max(peak, peaks[i] ?? 0)
            const h = Math.max(1, (peak / 255) * height)
            ctx.fillRect(px, (height - h) / 2, 1, h)
        }
    }, [peaks, from, to, width, height])
    return (
        <canvas
            ref={ref}
            width={Math.max(1, width)}
            height={height}
            className="waveform"
        />
    )
}
