// Запуск ffmpeg с разбором `-progress pipe:1`. Один процесс на задание, отменяемый.

export interface Progress
{
    /** Секунды готового вывода. */
    outTime: number
    fps: number
    speed: string
}

export interface RunOptions
{
    cwd?: string
    signal?: AbortSignal
    onProgress?: (progress: Progress) => void
}

export class FfmpegError extends Error
{
    constructor(
        message: string,
        readonly exitCode: number,
    )
    {
        super(message)
    }
}

/** Разбирает блок `key=value` строк прогресса ffmpeg. */
export function parseProgressBlock(lines: readonly string[]): Progress
{
    const map = new Map<string, string>()
    for (const line of lines)
    {
        const eq = line.indexOf('=')
        if (eq > 0) map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim())
    }
    const outTimeUs = Number(
        map.get('out_time_us') ?? map.get('out_time_ms') ?? '0',
    )
    return {
        outTime:
            Number.isFinite(outTimeUs) && outTimeUs > 0
                ? outTimeUs / 1_000_000
                : 0,
        fps: Number(map.get('fps') ?? '0') || 0,
        speed: map.get('speed') ?? '',
    }
}

async function readProgress(
    stream: ReadableStream<Uint8Array>,
    onProgress: (p: Progress) => void,
): Promise<void>
{
    const decoder = new TextDecoder()
    let buffer = ''
    let block: string[] = []
    for await (const chunk of stream)
    {
        buffer += decoder.decode(chunk, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines)
        {
            block.push(line)
            if (line.startsWith('progress='))
            {
                onProgress(parseProgressBlock(block))
                block = []
            }
        }
    }
}

export async function runFfmpeg(
    ffmpeg: string,
    args: string[],
    options: RunOptions = {},
): Promise<void>
{
    const proc = Bun.spawn([ffmpeg, ...args],
    {
        cwd: options.cwd ?? process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
        windowsHide: true,
        ...(options.signal ? { signal: options.signal } : {}),
    })
    const progress = options.onProgress
        ? readProgress(proc.stdout, options.onProgress)
        : proc.stdout.text()
    const [stderr, code] = await Promise.all([
        proc.stderr.text(),
        proc.exited,
        progress,
    ]).then(([err, exit]) => [err, exit] as const)
    if (code !== 0)
    {
        if (options.signal?.aborted) throw new FfmpegError('Отменено', code)
        const meaningful = stderr
            .split('\n')
            .filter((l) => l.trim() !== '' && !l.includes('Fontconfig'))
            .slice(-5)
            .join('\n')
        throw new FfmpegError(
            meaningful || `ffmpeg завершился с кодом ${code}`,
            code,
        )
    }
}
