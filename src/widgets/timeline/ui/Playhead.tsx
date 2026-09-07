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
        <div
            className="pointer-events-none absolute inset-y-0 z-[2] w-px bg-white before:absolute before:top-0 before:-left-[5px] before:border-5 before:border-transparent before:border-t-7 before:border-t-white before:content-['']"
            style={{ left: offset + time * pxPerSec }}
        />
    )
}
