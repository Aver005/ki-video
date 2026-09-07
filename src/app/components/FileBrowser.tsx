import { useEffect, useState } from 'react'
import { api } from '@app/api'
import type { FsListing } from '@shared/api'

interface FileBrowserProps
{
    onPick: (paths: string[]) => void
    onClose: () => void
}

function formatSize(bytes: number): string
{
    return bytes > 1 << 30
        ? `${(bytes / (1 << 30)).toFixed(1)} ГБ`
        : `${Math.round(bytes / (1 << 20))} МБ`
}

export function FileBrowser({ onPick, onClose }: FileBrowserProps)
{
    const [listing, setListing] = useState<FsListing | null>(null)
    const [chosen, setChosen] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)

    const open = (dir?: string) =>
    {
        api.listDir(dir)
            .then((l) =>
            {
                setListing(l)
                setError(null)
            })
            .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : 'Не открылось'),
            )
    }

    useEffect(() =>
    {
        open()
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const toggle = (path: string) =>
    {
        setChosen((prev) =>
        {
            const next = new Set(prev)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
        })
    }

    return (
        <div className="modal" onClick={onClose}>
            <div
                className="modal__card"
                role="dialog"
                aria-modal="true"
                aria-label="Выбор файлов"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal__head">
                    <button
                        className="btn btn--ghost"
                        disabled={!listing?.parent}
                        onClick={() => open(listing?.parent ?? undefined)}
                        aria-label="Вверх"
                    >
                        ↑
                    </button>
                    <input
                        className="modal__path"
                        aria-label="Папка"
                        value={listing?.dir ?? ''}
                        onChange={(e) =>
                            setListing((l) =>
                                l ? { ...l, dir: e.target.value } : l,
                            )
                        }
                        onKeyDown={(e) =>
                            e.key === 'Enter' && open(listing?.dir)
                        }
                    />
                </div>
                {error && <div className="error">{error}</div>}
                <div className="modal__list">
                    {listing?.entries.map((entry) =>
                        entry.kind === 'dir' ? (
                            <button
                                key={entry.path}
                                className="row"
                                onClick={() => open(entry.path)}
                            >
                                📁 {entry.name}
                            </button>
                        ) : (
                            <label
                                key={entry.path}
                                className={`row ${chosen.has(entry.path) ? 'row--active' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={chosen.has(entry.path)}
                                    onChange={() => toggle(entry.path)}
                                />
                                <span className="row__name">{entry.name}</span>
                                <span className="muted">
                                    {formatSize(entry.size)}
                                </span>
                            </label>
                        ),
                    )}
                </div>
                <div className="modal__foot">
                    <button className="btn btn--ghost" onClick={onClose}>
                        Отмена
                    </button>
                    <button
                        className="btn btn--primary"
                        disabled={chosen.size === 0}
                        onClick={() => onPick([...chosen])}
                    >
                        Добавить {chosen.size > 0 ? chosen.size : ''}
                    </button>
                </div>
            </div>
        </div>
    )
}
