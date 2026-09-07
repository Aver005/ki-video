import { X } from 'lucide-react'
import { useStore } from '@shared/model/store'
import { notify } from '@app/store/actions'

export function Notice()
{
    const notice = useStore((s) => s.notice)
    if (!notice) return null
    return (
        <div className="notice" role="status">
            <span>{notice}</span>
            <button className="btn btn--ghost" onClick={() => notify(null)}>
                <X />
                Закрыть
            </button>
        </div>
    )
}
