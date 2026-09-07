// Один плеер на приложение: связывает стор с Player и отдаёт его компонентам.

import { useEffect } from 'react'
import { Player } from '@entities/player/lib/Player'
import { getState, setState, useStore } from '@shared/model/store'

const player = new Player()

export function getPlayer(): Player
{
    return player
}

/** Перемотка идёт через плеер: он источник истины по времени и при воспроизведении, и на паузе. */
export function seek(time: number): void
{
    player.seek(time)
}

/** Подписки плеера на стор: источник данных и обратная связь по времени. Вызывать один раз в корне. */
export function usePlayerBinding(): void
{
    const project = useStore((s) => s.project)
    const assets = useStore((s) => s.assets)

    useEffect(() =>
    {
        player.setSource({ project, assets })
    }, [project, assets])

    useEffect(() =>
    {
        const off = player.onTime((t, playing) =>
        {
            const s = getState()
            if (s.playing !== playing || Math.abs(s.time - t) > 0.001)
                setState({ time: t, playing })
        })
        return () =>
        {
            off()
            player.destroy()
        }
    }, [])
}
