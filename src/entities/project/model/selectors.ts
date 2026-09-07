// Чтение проекта из стора: одно место, где виджеты узнают о текущем проекте.

import type { ExportJob, StatusResponse } from '@core/api'
import type { Project } from '@core/model'
import { projectDuration } from '@core/timeline'
import { useStore } from '@shared/model/store'

export function useProject(): Project | null
{
    return useStore((s) => s.project)
}

export function useProjectDuration(): number
{
    return useStore((s) => (s.project ? projectDuration(s.project) : 0))
}

export function useServerStatus(): StatusResponse | null
{
    return useStore((s) => s.status)
}

export function useExportJob(): ExportJob | null
{
    return useStore((s) => s.exportJob)
}
