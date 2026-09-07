import { NativeSelect, NativeSelectOption } from '@shared/ui/native-select'
import { Field } from '@shared/ui/kit/Field'
import { Button } from '@shared/ui/button'
import { Download, FolderOpen, X } from 'lucide-react'
import { api } from '@shared/api/client'
import { getState, useStore } from '@shared/model/store'
import { update } from '@entities/project'
import { notify } from '@shared/model/editor'
import { getPlayer } from '@entities/player'
import { SliderField } from '@shared/ui/kit/SliderField'
import { formatTime } from '@core/math'
import { projectDuration } from '@core/timeline'
import type { VideoCodec } from '@core/model'

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
        <div className="flex flex-col gap-2.5 p-3">
            <Field label="Размер">
                <NativeSelect
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
                        <NativeSelectOption key={s.label} value={i}>
                            {s.label}
                        </NativeSelectOption>
                    ))}
                </NativeSelect>
            </Field>
            <div className="flex gap-2">
                <Field label="Кодек">
                    <NativeSelect
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
                        <NativeSelectOption value="h264">
                            H.264 · {status?.encoders?.h264 ?? '…'}
                        </NativeSelectOption>
                        <NativeSelectOption value="hevc">
                            H.265 · {status?.encoders?.hevc ?? '…'}
                        </NativeSelectOption>
                    </NativeSelect>
                </Field>
                <Field label="FPS">
                    <NativeSelect
                        value={output.fps}
                        onChange={(e) =>
                            update((p) =>
                            {
                                p.output.fps = Number(e.target.value)
                            })
                        }
                    >
                        <NativeSelectOption value={30}>30</NativeSelectOption>
                        <NativeSelectOption value={60}>60</NativeSelectOption>
                    </NativeSelect>
                </Field>
            </div>
            <SliderField
                label="Качество, CQ"
                value={output.quality}
                min={16}
                max={34}
                step={1}
                onChange={(v, final) =>
                    update((p) =>
                    {
                        p.output.quality = v
                    }, final)
                }
            />
            <div className="flex flex-wrap items-center gap-1.5">
                <Button
                    isDisabled={running || duration === 0 || !status?.ok}
                    onPress={() => void startExport()}
                >
                    <Download />
                    {running ? 'Идёт экспорт…' : 'Экспортировать'}
                </Button>
                {running && job && (
                    <Button
                        variant="ghost"
                        onPress={() => void api.cancelExport(job.id)}
                    >
                        <X />
                        Отменить
                    </Button>
                )}
            </div>
            {job && (
                <div className="flex flex-col gap-1.5">
                    <div className="h-1 overflow-hidden rounded-sm bg-muted">
                        <div
                            className={`h-full transition-[width] duration-200 ${job.status === 'error' ? 'bg-destructive' : 'bg-primary'}`}
                            style={
                            {
                                width: `${Math.round(job.percent * 100)}%`,
                            }}
                        />
                    </div>
                    <div className="text-muted-foreground">
                        {job.status === 'running' &&
                            `${formatTime(job.outTime, false)} / ${formatTime(job.duration, false)} · ${job.speed}`}
                        {job.status === 'done' &&
                            `Готово за ${(((job.finishedAt ?? 0) - job.startedAt) / 1000).toFixed(1)} с`}
                        {job.status === 'error' && (
                            <span className="text-destructive">
                                {job.error}
                            </span>
                        )}
                        {job.status === 'cancelled' && 'Отменено'}
                    </div>
                    {job.status === 'done' && (
                        <span title={job.outFile} className="inline-flex">
                            <Button
                                variant="outline"
                                onPress={() => void api.reveal(job.outFile)}
                            >
                                <FolderOpen />
                                Показать файл
                            </Button>
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
