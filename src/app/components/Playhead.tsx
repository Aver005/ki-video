import { useStore } from '@shared/model/store'

/** Отдельный компонент: только он перерисовывается на каждом кадре воспроизведения. */
export function Playhead({
    pxPerSec,
    offset = 0,
}: {
    pxPerSec: number
    offset?: number
})
{
    const time = useStore((s) => s.time)
    return (
        <div className="playhead" style={{ left: offset + time * pxPerSec }} />
    )
}
