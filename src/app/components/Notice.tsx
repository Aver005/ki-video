import { useStore } from '@app/store/store'
import { notify } from '@app/store/actions'

export function Notice()
{
    const notice = useStore((s) => s.notice)
    if (!notice) return null
    return (
        <div className="notice" role="status">
            <span>{notice}</span>
            <button className="btn btn--ghost" onClick={() => notify(null)}>
                Закрыть
            </button>
        </div>
    )
}
