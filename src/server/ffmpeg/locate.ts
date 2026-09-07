// Поиск ffmpeg/ffprobe и определение возможностей: NVENC, аппаратное декодирование.

import { join } from 'node:path'
import type { EncoderCaps } from '@core/ffmpeg/export-args'
import { SOFTWARE_CAPS } from '@core/ffmpeg/export-args'

export interface FfmpegTools
{
    ffmpeg: string
    ffprobe: string
    version: string
    caps: EncoderCaps
}

const EXE = process.platform === 'win32' ? '.exe' : ''

/** Типовое место на Windows; остальное задаётся в ki.config.json или KI_FFMPEG_DIR. */
const KNOWN_DIRS = ['C:/ffmpeg/bin']

function candidateDirs(configured: string | null): string[]
{
    const dirs = configured ? [configured] : []
    const fromPath = Bun.which('ffmpeg')
    if (fromPath) dirs.push(join(fromPath, '..'))
    return [...dirs, ...KNOWN_DIRS]
}

async function exists(path: string): Promise<boolean>
{
    return Bun.file(path).exists()
}

async function readOutput(cmd: string[]): Promise<string>
{
    const proc = Bun.spawn(cmd,
    {
        stdout: 'pipe',
        stderr: 'pipe',
        windowsHide: true,
    })
    const [out, err] = await Promise.all([
        proc.stdout.text(),
        proc.stderr.text(),
    ])
    await proc.exited
    return out + err
}

export async function detectCaps(ffmpeg: string): Promise<EncoderCaps>
{
    const encoders = await readOutput([ffmpeg, '-hide_banner', '-encoders'])
    const hwaccels = await readOutput([ffmpeg, '-hide_banner', '-hwaccels'])
    const has = (name: string) => new RegExp(`\\s${name}\\s`).test(encoders)
    const hasCuda = /\bcuda\b/.test(hwaccels)
    const nvencWorks =
        has('h264_nvenc') && hasCuda && (await nvencSmokeTest(ffmpeg))
    if (!nvencWorks) return SOFTWARE_CAPS
    return {
        encoders:
        {
            h264: 'h264_nvenc',
            hevc: has('hevc_nvenc') ? 'hevc_nvenc' : 'libx265',
        },
        hwaccel: 'cuda',
    }
}

/** NVENC может быть в сборке, но без драйвера: проверяем кодированием одного кадра. */
async function nvencSmokeTest(ffmpeg: string): Promise<boolean>
{
    const proc = Bun.spawn(
        [
            ffmpeg,
            '-hide_banner',
            '-loglevel',
            'error',
            '-f',
            'lavfi',
            '-i',
            'color=c=black:s=256x256:d=0.1',
            '-frames:v',
            '1',
            '-c:v',
            'h264_nvenc',
            '-f',
            'null',
            '-',
        ],
        { stdout: 'ignore', stderr: 'pipe', windowsHide: true },
    )
    await proc.stderr.text()
    return (await proc.exited) === 0
}

export async function locateFfmpeg(
    configuredDir: string | null,
): Promise<FfmpegTools>
{
    for (const dir of candidateDirs(configuredDir))
    {
        const ffmpeg = join(dir, `ffmpeg${EXE}`)
        const ffprobe = join(dir, `ffprobe${EXE}`)
        if (!(await exists(ffmpeg)) || !(await exists(ffprobe))) continue
        const banner = await readOutput([ffmpeg, '-version'])
        const version = banner.split('\n')[0]?.trim() ?? 'ffmpeg'
        return { ffmpeg, ffprobe, version, caps: await detectCaps(ffmpeg) }
    }
    throw new Error(
        'ffmpeg не найден: укажи ffmpegDir в ki.config.json или KI_FFMPEG_DIR',
    )
}
