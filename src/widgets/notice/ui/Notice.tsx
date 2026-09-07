// Уведомление внизу экрана: живёт до закрытия, потому что сообщает об отказе.

import { X } from 'lucide-react'
import { notify } from '@shared/model/editor'
import { useStore } from '@shared/model/store'
import { Button } from '@shared/ui/button'

export function Notice()
{
    const notice = useStore((s) => s.notice)
    if (!notice) return null
    return (
        <div
            role="status"
            className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-lg"
        >
            <span>{notice}</span>
            <Button variant="ghost" size="sm" onPress={() => notify(null)}>
                <X />
                Закрыть
            </Button>
        </div>
    )
}
