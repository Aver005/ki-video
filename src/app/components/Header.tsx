import { Download } from 'lucide-react'
import { useStore } from '@app/store/store'
import { update, setTab } from '@app/store/actions'
import { projectDuration } from '@shared/timeline'
import { formatTime } from '@shared/math'

export function Header()
{
    const project = useStore((s) => s.project)
    const status = useStore((s) => s.status)
    const exportJob = useStore((s) => s.exportJob)
    const duration = project ? projectDuration(project) : 0
    const running = exportJob?.status === 'running'
    return (
        <header className="header">
            <div className="header__brand">ki-video</div>
            <input
                className="header__name"
                value={project?.name ?? ''}
                placeholder="Название проекта"
                onChange={(e) =>
                    update((p) =>
                    {
                        p.name = e.target.value
                    }, false)
                }
            />
            <div className="header__meta">
                <span>{formatTime(duration, false)}</span>
                <span
                    className={`dot ${status?.ok ? 'dot--ok' : 'dot--bad'}`}
                    title={status?.ffmpeg ?? status?.error ?? '…'}
                />
                <span className="muted">
                    {status?.hwaccel ? 'NVENC' : status ? 'CPU' : ''}
                </span>
            </div>
            <button
                className="btn btn--primary"
                onClick={() => setTab('export')}
                disabled={!project || duration === 0}
            >
                <Download />
                {running
                    ? `Экспорт ${Math.round((exportJob?.percent ?? 0) * 100)}%`
                    : 'Экспорт'}
            </button>
        </header>
    )
}
