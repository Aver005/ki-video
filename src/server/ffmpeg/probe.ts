// ffprobe: сведения о файле в плоскую структуру.

export interface ProbeResult
{
    duration: number
    width: number
    height: number
    fps: number
    videoCodec: string | null
    audioCodec: string | null
}

interface ProbeStream
{
    codec_type?: string
    codec_name?: string
    width?: number
    height?: number
    r_frame_rate?: string
    avg_frame_rate?: string
}

interface ProbeJson
{
    streams?: ProbeStream[]
    format?: { duration?: string }
}

export function parseRate(rate: string | undefined): number
{
    if (!rate) return 0
    const [n, d] = rate.split('/').map(Number)
    if (!n || !d) return n && Number.isFinite(n) ? n : 0
    return n / d
}

export function toProbeResult(json: ProbeJson): ProbeResult
{
    const video = json.streams?.find(
        (s) => s.codec_type === 'video' && s.width && s.height,
    )
    const audio = json.streams?.find((s) => s.codec_type === 'audio')
    if (!video && !audio)
        throw new Error('В файле нет ни видеодорожки, ни звука')
    const fps =
        parseRate(video?.avg_frame_rate) || parseRate(video?.r_frame_rate) || 30
    return {
        duration: Number(json.format?.duration ?? '0') || 0,
        width: video?.width ?? 0,
        height: video?.height ?? 0,
        fps: Math.round(fps * 1000) / 1000,
        videoCodec: video ? (video.codec_name ?? 'unknown') : null,
        audioCodec: audio?.codec_name ?? null,
    }
}

export async function probe(
    ffprobe: string,
    path: string,
): Promise<ProbeResult>
{
    const proc = Bun.spawn(
        [
            ffprobe,
            '-v',
            'error',
            '-show_entries',
            'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate',
            '-of',
            'json',
            path,
        ],
        { stdout: 'pipe', stderr: 'pipe', windowsHide: true },
    )
    const [out, err, code] = await Promise.all([
        proc.stdout.text(),
        proc.stderr.text(),
        proc.exited,
    ])
    if (code !== 0)
        throw new Error(err.trim() || `ffprobe завершился с кодом ${code}`)
    return toProbeResult(JSON.parse(out) as ProbeJson)
}
