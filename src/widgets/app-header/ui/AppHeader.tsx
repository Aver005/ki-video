// Верхняя полоса: имя проекта, состояние сервера и вход в экспорт.

import { Download } from 'lucide-react'
import { TextField } from 'react-aria-components'
import { formatTime } from '@core/math'
import {
    update,
    useExportJob,
    useProject,
    useProjectDuration,
    useServerStatus,
} from '@entities/project'
import { setTab } from '@shared/model/editor'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Separator } from '@shared/ui/separator'

export function AppHeader()
{
    const project = useProject()
    const status = useServerStatus()
    const exportJob = useExportJob()
    const duration = useProjectDuration()
    const running = exportJob?.status === 'running'
    const percent = Math.round((exportJob?.percent ?? 0) * 100)
    return (
        <header className="flex items-center gap-3 border-b bg-card px-3 [grid-area:header]">
            <span className="font-semibold tracking-wide">ki-video</span>
            <TextField
                aria-label="Название проекта"
                value={project?.name ?? ''}
                onChange={(name) =>
                    update((p) =>
                    {
                        p.name = name
                    }, false)
                }
                className="w-56"
            >
                <Input
                    placeholder="Название проекта"
                    className="h-7 border-transparent bg-transparent hover:border-input"
                />
            </TextField>
            <div
                className="ml-auto flex items-center gap-2 font-mono text-muted-foreground tabular-nums"
                title={status?.ffmpeg ?? status?.error ?? '…'}
            >
                <span
                    className={`inline-block size-2 rounded-full ${
                        status?.ok ? 'bg-emerald-500' : 'bg-destructive'
                    }`}
                />
                <span>{status?.hwaccel ? 'NVENC' : status ? 'CPU' : ''}</span>
            </div>
            <Separator orientation="vertical" className="h-5" />
            <span
                className="font-mono tabular-nums"
                title="Длительность проекта"
            >
                {formatTime(duration, false)}
            </span>
            <Button
                onPress={() => setTab('export')}
                isDisabled={!project || duration === 0}
            >
                <Download />
                {running ? `Экспорт ${percent}%` : 'Экспорт'}
            </Button>
        </header>
    )
}
