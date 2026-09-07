// Загрузка при старте: статус сервера, файлы, проект; затем подписка на события и сохранение при закрытии.

import { useEffect } from 'react'
import { api } from '@shared/api/client'
import { connectEvents } from '@app/ws'
import { setState } from '@shared/model/store'
import { saveOnUnload } from '@entities/project'
import { notify } from '@shared/model/editor'
import type { MediaAsset } from '@core/model'

function byId(list: MediaAsset[]): Record<string, MediaAsset>
{
    return Object.fromEntries(list.map((a) => [a.id, a]))
}

export function useBootstrap(): void
{
    useEffect(() =>
    {
        let cancelled = false
        void (async () =>
        {
            try
            {
                const [status, assets, { project }] = await Promise.all([
                    api.status(),
                    api.assets(),
                    api.project(),
                ])
                if (cancelled) return
                setState({ status, assets: byId(assets), project })
                if (!status.ok) notify(status.error ?? 'ffmpeg не найден')
            }
            catch (error)
            {
                notify(
                    error instanceof Error
                        ? error.message
                        : 'Сервер недоступен',
                )
            }
        })()
        const disconnect = connectEvents()
        window.addEventListener('pagehide', saveOnUnload)
        return () =>
        {
            cancelled = true
            disconnect()
            window.removeEventListener('pagehide', saveOnUnload)
        }
    }, [])
}
