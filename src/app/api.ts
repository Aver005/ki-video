// HTTP-клиент к серверу. Все ответы типизированы контрактами из @shared/api.

import type {
    ExportJob,
    FsListing,
    ProjectResponse,
    StatusResponse,
} from '@shared/api'
import type { MediaAsset, Project } from '@shared/model'

async function request<T>(url: string, init?: RequestInit): Promise<T>
{
    const res = await fetch(url,
    {
        ...init,
        headers:
        {
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    })
    const body = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
    return body
}

export const api =
{
    status: () => request<StatusResponse>('/api/status'),
    assets: () => request<MediaAsset[]>('/api/assets'),
    importPaths: (paths: string[]) =>
        request<MediaAsset[]>('/api/assets',
        {
            method: 'POST',
            body: JSON.stringify({ paths }),
        }),
    removeAsset: (id: string) =>
        request<{ removed: boolean }>(`/api/assets/${id}`,
        {
            method: 'DELETE',
        }),
    project: () => request<ProjectResponse>('/api/project'),
    saveProject: (project: Project) =>
        request<{ ok: boolean }>('/api/project',
        {
            method: 'PUT',
            body: JSON.stringify(project),
        }),
    startExport: (project: Project) =>
        request<ExportJob>('/api/export',
        {
            method: 'POST',
            body: JSON.stringify(project),
        }),
    cancelExport: (id: string) =>
        request<{ cancelled: boolean }>(`/api/export/${id}`,
        {
            method: 'DELETE',
        }),
    openDialog: () =>
        request<{ paths: string[] }>('/api/dialog/open', { method: 'POST' }),
    listDir: (dir?: string) =>
        request<FsListing>(
            `/api/fs${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`,
        ),
    reveal: (path: string) =>
        request<{ ok: boolean }>('/api/reveal',
        {
            method: 'POST',
            body: JSON.stringify({ path }),
        }),
}

export function mediaUrl(assetId: string): string
{
    return `/api/assets/${assetId}/media`
}

export function thumbUrl(assetId: string, index: number): string
{
    return `/api/assets/${assetId}/thumbs/${index}`
}
