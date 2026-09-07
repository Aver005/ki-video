import { thumbUrl } from '@app/api'
import { useStore } from '@app/store/store'
import { select, seek, setTab, trimClip } from '@app/store/actions'
import { Waveform } from '@app/components/Waveform'
import type { ClipPlacement } from '@shared/timeline'

interface ClipBlockProps
{
    placement: ClipPlacement
    pxPerSec: number
}

const THUMB_WIDTH = 64
const WAVE_HEIGHT = 22

/** Перетаскивание края клипа меняет in/out; фиксация в историю на отпускании. */
function startTrim(
    e: React.PointerEvent,
    clipId: string,
    edge: 'in' | 'out',
    pxPerSec: number,
    initial: number,
): void
{
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const apply = (ev: PointerEvent, final: boolean) =>
    {
        const value = initial + (ev.clientX - startX) / pxPerSec
        trimClip(clipId, edge === 'in' ? { in: value } : { out: value }, final)
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

export function ClipBlock({ placement, pxPerSec }: ClipBlockProps)
{
    const { clip, start, duration } = placement
    const asset = useStore((s) => s.assets[clip.assetId])
    const selected = useStore(
        (s) => s.selection?.kind === 'clip' && s.selection.id === clip.id,
    )
    const width = Math.max(4, duration * pxPerSec)
    const thumbs = asset?.thumbs
    const count = Math.max(1, Math.floor(width / THUMB_WIDTH))
    const thumbIndexes = Array.from({ length: count }, (_, i) =>
    {
        const t = clip.in + ((i + 0.5) / count) * duration
        return thumbs
            ? Math.min(
                  thumbs.count,
                  Math.max(1, Math.floor(t * thumbs.fps) + 1),
              )
            : 1
    })

    return (
        <div
            className={`clip ${selected ? 'clip--selected' : ''}`}
            style={{ left: start * pxPerSec, width }}
            onPointerDown={(e) =>
            {
                e.stopPropagation()
                select({ kind: 'clip', id: clip.id })
                setTab('frame')
                const rect = e.currentTarget.getBoundingClientRect()
                seek(start + (e.clientX - rect.left) / pxPerSec)
            }}
            title={asset?.name}
        >
            <div className="clip__thumbs">
                {asset?.status === 'ready' &&
                    thumbIndexes.map((n, i) => (
                        <img
                            key={i}
                            src={thumbUrl(asset.id, n)}
                            alt=""
                            style={{ width: width / count }}
                            draggable={false}
                        />
                    ))}
            </div>
            {asset?.peaks && (
                <Waveform
                    peaks={asset.peaks}
                    from={clip.in}
                    to={clip.out}
                    width={Math.round(width)}
                    height={WAVE_HEIGHT}
                />
            )}
            <div className="clip__keys">
                {clip.frame.map((k) => (
                    <span
                        key={k.t}
                        className="key"
                        style={{ left: k.t * pxPerSec }}
                        title={`ключ ${k.t.toFixed(2)}s`}
                    />
                ))}
            </div>
            <div
                className="clip__handle clip__handle--l"
                onPointerDown={(e) =>
                    startTrim(e, clip.id, 'in', pxPerSec, clip.in)
                }
            />
            <div
                className="clip__handle clip__handle--r"
                onPointerDown={(e) =>
                    startTrim(e, clip.id, 'out', pxPerSec, clip.out)
                }
            />
        </div>
    )
}
