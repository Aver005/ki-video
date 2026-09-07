import { api } from '@app/api'
import { getState, useStore } from '@app/store/store'
import { notify, update } from '@app/store/actions'
import { getPlayer } from '@app/hooks/usePlayer'
import { Slider } from '@app/components/Slider'
import { formatTime } from '@shared/math'
import { projectDuration } from '@shared/timeline'
import type { VideoCodec } from '@shared/model'

function isCodec(value: string): value is VideoCodec
{
    return value === 'h264' || value === 'hevc'
}

const SIZES = [
    { label: '1080×1920 (9:16)', width: 1080, height: 1920 },
    { label: '720×1280 (9:16)', width: 720, height: 1280 },
    { label: '1080×1350 (4:5)', width: 1080, height: 1350 },
    { label: '1920×1080 (16:9)', width: 1920, height: 1080 },
]

async function startExport(): Promise<void>
{
    const project = getState().project
    if (!project) return
    getPlayer().pause()
    try
    {
        await api.startExport(project)
    }
    catch (error)
    {
        notify(error instanceof Error ? error.message : 'Экспорт не запустился')
    }
}

export function ExportTab()
{
    const output = useStore((s) => s.project?.output)
    const job = useStore((s) => s.exportJob)
    const status = useStore((s) => s.status)
    const project = useStore((s) => s.project)
    const duration = project ? projectDuration(project) : 0
    if (!output) return null
    const running = job?.status === 'running'
    const sizeIndex = SIZES.findIndex(
        (s) => s.width === output.width && s.height === output.height,
    )
    return (
        <div className="tab-body">
            <label className="field">
                <span>Размер</span>
                <select
                    value={sizeIndex}
                    onChange={(e) =>
                    {
                        const size = SIZES[Number(e.target.value)]
                        if (size)
                            update((p) =>
                            {
                                p.output.width = size.width
                                p.output.height = size.height
                            })
                    }}
                >
                    {SIZES.map((s, i) => (
                        <option key={s.label} value={i}>
                            {s.label}
                        </option>
                    ))}
                </select>
            </label>
            <div className="field-row">
                <label className="field">
                    <span>Кодек</span>
                    <select
                        value={output.codec}
                        onChange={(e) =>
                        {
                            const codec = e.target.value
                            if (isCodec(codec))
                                update((p) =>
                                {
                                    p.output.codec = codec
                                })
                        }}
                    >
                        <option value="h264">
                            H.264 · {status?.encoders?.h264 ?? '…'}
                        </option>
                        <option value="hevc">
                            H.265 · {status?.encoders?.hevc ?? '…'}
                        </option>
                    </select>
                </label>
                <label className="field">
                    <span>FPS</span>
                    <select
                        value={output.fps}
                        onChange={(e) =>
                            update((p) =>
                            {
                                p.output.fps = Number(e.target.value)
                            })
                        }
                    >
                        <option value={30}>30</option>
                        <option value={60}>60</option>
                    </select>
                </label>
            </div>
            <Slider
                label="Качество"
                value={output.quality}
                min={16}
                max={34}
                step={1}
                format={(v) => `CQ ${v}`}
                onChange={(v, final) =>
                    update((p) =>
                    {
                        p.output.quality = v
                    }, final)
                }
            />
            <div className="row-actions">
                <button
                    className="btn btn--primary"
                    disabled={running || duration === 0 || !status?.ok}
                    onClick={() => void startExport()}
                >
                    {running ? 'Идёт экспорт…' : 'Экспортировать'}
                </button>
                {running && job && (
                    <button
                        className="btn btn--ghost"
                        onClick={() => void api.cancelExport(job.id)}
                    >
                        Отменить
                    </button>
                )}
            </div>
            {job && (
                <div className="export-status">
                    <div className="progress">
                        <div
                            className={`progress__bar ${job.status === 'error' ? 'progress__bar--error' : ''}`}
                            style={
                            {
                                width: `${Math.round(job.percent * 100)}%`,
                            }}
                        />
                    </div>
                    <div className="muted">
                        {job.status === 'running' &&
                            `${formatTime(job.outTime, false)} / ${formatTime(job.duration, false)} · ${job.speed}`}
                        {job.status === 'done' &&
                            `Готово за ${(((job.finishedAt ?? 0) - job.startedAt) / 1000).toFixed(1)} с`}
                        {job.status === 'error' && (
                            <span className="error">{job.error}</span>
                        )}
                        {job.status === 'cancelled' && 'Отменено'}
                    </div>
                    {job.status === 'done' && (
                        <button
                            className="btn"
                            onClick={() => void api.reveal(job.outFile)}
                            title={job.outFile}
                        >
                            Показать файл
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
