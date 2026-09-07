// Контракты HTTP и WebSocket между сервером и интерфейсом.

import type { MediaAsset, Project, VideoCodec } from '@shared/model'

export interface StatusResponse
{
    ok: boolean
    version: string
    ffmpeg: string | null
    encoders: Record<VideoCodec, string> | null
    hwaccel: string | null
    error: string | null
    platform: string
    dataDir: string
}

export interface ImportRequest
{
    paths: string[]
}

export type ExportStatus = 'running' | 'done' | 'error' | 'cancelled'

export interface ExportJob
{
    id: string
    status: ExportStatus
    /** 0..1 */
    percent: number
    outTime: number
    duration: number
    speed: string
    outFile: string
    error: string | null
    startedAt: number
    finishedAt: number | null
}

export interface FsEntry
{
    name: string
    path: string
    kind: 'dir' | 'file'
    size: number
}

export interface FsListing
{
    dir: string
    parent: string | null
    entries: FsEntry[]
}

export type ServerEvent =
    | { type: 'asset'; asset: MediaAsset }
    | { type: 'asset-progress'; id: string; percent: number }
    | { type: 'asset-removed'; id: string }
    | { type: 'export'; job: ExportJob }

export interface ProjectResponse
{
    project: Project
}

export const VIDEO_EXTENSIONS = [
    '.mp4',
    '.mkv',
    '.mov',
    '.m4v',
    '.webm',
    '.ts',
    '.avi',
]
