// Подготовка файла к монтажу за один проход ffmpeg: прокси H.264, миниатюры, PCM для пиков.

import { join } from 'node:path'
import { mkdir, readdir } from 'node:fs/promises'
import { PEAKS_PER_SECOND, type MediaAsset } from '@shared/model'
import type { FfmpegTools } from '@server/ffmpeg/locate'
import { runFfmpeg } from '@server/ffmpeg/run'
import { probe } from '@server/ffmpeg/probe'
import { computePeaks } from '@server/peaks'
import { num } from '@shared/math'

export const PROXY_FILE = 'proxy.mp4'
export const THUMBS_DIR = 'thumbs'
const PCM_FILE = 'pcm.raw'
const PCM_RATE = 8000
const PROXY_HEIGHT = 720
const THUMB_HEIGHT = 90
const MAX_THUMBS = 120

export interface IngestResult
{
    proxy: { width: number; height: number }
    thumbs: { count: number; fps: number }
    peaks: number[]
}

export function thumbFps(duration: number): number
{
    if (duration <= 0) return 1
    return Math.min(1, MAX_THUMBS / duration)
}

function proxyEncoder(tools: FfmpegTools): string[]
{
    const encoder = tools.caps.encoders.h264
    if (encoder === 'h264_nvenc')
        return [
            '-c:v',
            encoder,
            '-preset',
            'p1',
            '-rc',
            'vbr',
            '-cq',
            '30',
            '-b:v',
            '0',
        ]
    return ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28']
}

export function ingestArgs(
    tools: FfmpegTools,
    asset: MediaAsset,
    threads: number,
): string[]
{
    const fps = thumbFps(asset.duration)
    const args = [
        '-hide_banner',
        '-y',
        '-nostats',
        '-loglevel',
        'error',
        '-progress',
        'pipe:1',
        '-threads',
        String(threads),
    ]
    if (tools.caps.hwaccel) args.push('-hwaccel', tools.caps.hwaccel)
    args.push('-i', asset.path)
    // Высота тоже приводится к чётной: yuv420p не принимает нечётные размеры.
    args.push(
        '-map',
        '0:v:0',
        '-vf',
        `scale=-2:'2*trunc(min(${PROXY_HEIGHT},ih)/2)'`,
        ...proxyEncoder(tools),
        '-g',
        '30',
        '-pix_fmt',
        'yuv420p',
    )
    if (asset.audioCodec)
        args.push('-map', '0:a:0', '-c:a', 'aac', '-b:a', '96k')
    args.push('-movflags', '+faststart', PROXY_FILE)
    args.push(
        '-map',
        '0:v:0',
        '-vf',
        `fps=${num(fps, 5)},scale=-2:${THUMB_HEIGHT}`,
        '-q:v',
        '5',
        join(THUMBS_DIR, '%04d.jpg'),
    )
    if (asset.audioCodec)
        args.push(
            '-map',
            '0:a:0',
            '-ac',
            '1',
            '-ar',
            String(PCM_RATE),
            '-f',
            's16le',
            PCM_FILE,
        )
    return args
}

async function readPeaks(dir: string, allowNative: boolean): Promise<number[]>
{
    const file = Bun.file(join(dir, PCM_FILE))
    if (!(await file.exists())) return []
    const bytes = await file.arrayBuffer()
    const samples = new Int16Array(bytes, 0, Math.floor(bytes.byteLength / 2))
    const bucket = Math.round(PCM_RATE / PEAKS_PER_SECOND)
    const peaks = computePeaks(samples, bucket, allowNative)
    await file.delete()
    return Array.from(peaks)
}

export async function ingest(
    tools: FfmpegTools,
    asset: MediaAsset,
    cacheDir: string,
    threads: number,
    allowNative: boolean,
    signal: AbortSignal,
    onProgress: (percent: number) => void,
): Promise<IngestResult>
{
    await mkdir(join(cacheDir, THUMBS_DIR), { recursive: true })
    await runFfmpeg(tools.ffmpeg, ingestArgs(tools, asset, threads),
    {
        cwd: cacheDir,
        signal,
        onProgress: (p) =>
            onProgress(
                asset.duration > 0
                    ? Math.min(1, p.outTime / asset.duration)
                    : 0,
            ),
    })
    const proxyInfo = await probe(tools.ffprobe, join(cacheDir, PROXY_FILE))
    const thumbFiles = (await readdir(join(cacheDir, THUMBS_DIR))).filter((f) =>
        f.endsWith('.jpg'),
    )
    return {
        proxy: { width: proxyInfo.width, height: proxyInfo.height },
        thumbs: { count: thumbFiles.length, fps: thumbFps(asset.duration) },
        peaks: await readPeaks(cacheDir, allowNative),
    }
}
