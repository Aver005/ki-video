// WebSocket с сервером: события о файлах и экспорте попадают в стор. Переподключение с паузой.

import type { ServerEvent } from '@core/api'
import type { MediaAsset } from '@core/model'
import { setState } from '@shared/model/store'
import { api } from '@shared/api/client'
import { getPlayer } from '@app/hooks/usePlayer'

const RECONNECT_MS = 1500

function apply(event: ServerEvent): void
{
    switch (event.type)
    {
        case 'asset':
            setState((s) => (
            {
                assets: { ...s.assets, [event.asset.id]: event.asset },
            }))
            break
        case 'asset-progress':
            setState((s) => (
            {
                assetProgress:
                {
                    ...s.assetProgress,
                    [event.id]: event.percent,
                },
            }))
            break
        case 'asset-removed':
            getPlayer().release(event.id)
            setState((s) =>
            {
                const assets = { ...s.assets }
                delete assets[event.id]
                return { assets }
            })
            break
        case 'export':
            setState({ exportJob: event.job })
            break
    }
}

/** После (пере)подключения перечитываем список файлов: события за время разрыва могли потеряться. */
function resync(): void
{
    void api
        .assets()
        .then((list: MediaAsset[]) =>
            setState(
            {
                assets: Object.fromEntries(list.map((a) => [a.id, a])),
            }),
        )
        .catch(() => undefined)
}

export function connectEvents(): () => void
{
    let socket: WebSocket | null = null
    let closed = false
    const open = () =>
    {
        if (closed) return
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
        socket = new WebSocket(`${protocol}://${location.host}/ws`)
        socket.onopen = resync
        socket.onmessage = (msg) =>
            apply(JSON.parse(String(msg.data)) as ServerEvent)
        socket.onclose = () =>
        {
            if (!closed) setTimeout(open, RECONNECT_MS)
        }
    }
    open()
    return () =>
    {
        closed = true
        socket?.close()
    }
}
