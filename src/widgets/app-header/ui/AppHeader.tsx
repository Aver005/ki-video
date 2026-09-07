// Верхняя полоса: имя проекта, состояние сервера и вход в экспорт.

import { Download } from 'lucide-react'
import { TextField } from 'react-aria-components'
import { formatTime } from '@core/math'
import {
    useExportJob,
    useProject,
    useProjectDuration,
    useServerStatus,
} from '@entities/project'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'

export interface AppHeaderProps
{
    /** Действия приходят из слоя app: виджет не знает, как устроен стор действий. */
    onRename: (name: string) => void
    onExport: () => void
}

export function AppHeader({ onRename, onExport }: AppHeaderProps)
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
                onChange={onRename}
                className="max-w-90 flex-1"
            >
                <Input
                    placeholder="Название проекта"
                    className="border-transparent bg-transparent hover:border-input"
                />
            </TextField>
            <div className="ml-auto flex items-center gap-2 font-mono text-muted-foreground tabular-nums">
                <span>{formatTime(duration, false)}</span>
                <span
                    title={status?.ffmpeg ?? status?.error ?? '…'}
                    className={`inline-block size-2 rounded-full ${
                        status?.ok ? 'bg-emerald-500' : 'bg-destructive'
                    }`}
                />
                <span>{status?.hwaccel ? 'NVENC' : status ? 'CPU' : ''}</span>
            </div>
            <Button onPress={onExport} isDisabled={!project || duration === 0}>
                <Download />
                {running ? `Экспорт ${percent}%` : 'Экспорт'}
            </Button>
        </header>
    )
}
