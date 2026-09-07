// Файлы медиатеки.

import { isMediaItem } from '@core/model'
import { api } from '@shared/api/client'
import { notify } from '@shared/model/editor'
import { getState } from '@shared/model/store'

/** Файл, который используют элементы, убрать нельзя: сначала удаляются элементы. */
export function removeAsset(id: string): void
{
    const { project } = getState()
    const used = project?.tracks.some((track) =>
        track.items.some((item) => isMediaItem(item) && item.assetId === id),
    )
    if (used)
    {
        notify('Файл стоит на таймлайне: сначала удали его элементы')
        return
    }
    void api
        .removeAsset(id)
        .catch((error: unknown) =>
            notify(
                error instanceof Error
                    ? error.message
                    : 'Не удалось убрать файл',
            ),
        )
}
