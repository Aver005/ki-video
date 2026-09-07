import { useStore } from '@app/store/store'

/** Отдельный компонент: только он перерисовывается на каждом кадре воспроизведения. */
export function Playhead({ pxPerSec }: { pxPerSec: number })
{
    const time = useStore((s) => s.time)
    return <div className="playhead" style={{ left: time * pxPerSec }} />
}
