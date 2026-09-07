// Отдача файла с поддержкой Range: браузерное видео перематывает только так.

export type RangeResult =
    | { start: number; end: number }
    | 'unsatisfiable'
    | null

export function parseRange(header: string | null, size: number): RangeResult
{
    if (!header) return null
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
    if (!match) return null
    const [, from, to] = match
    if (from === '' && to === '') return null
    if (from === '')
    {
        const suffix = Math.min(size, Number(to))
        if (suffix === 0) return 'unsatisfiable'
        return { start: size - suffix, end: size - 1 }
    }
    const start = Number(from)
    const end = to === '' ? size - 1 : Math.min(size - 1, Number(to))
    if (start >= size || start > end) return 'unsatisfiable'
    return { start, end }
}

export async function serveFile(
    req: Request,
    path: string,
    contentType?: string,
): Promise<Response>
{
    const file = Bun.file(path)
    if (!(await file.exists()))
        return new Response('Not found', { status: 404 })
    const size = file.size
    const type = contentType ?? file.type
    const range = parseRange(req.headers.get('range'), size)
    if (range === 'unsatisfiable')
    {
        return new Response(null,
        {
            status: 416,
            headers: { 'Content-Range': `bytes */${size}` },
        })
    }
    if (!range)
    {
        return new Response(file,
        {
            headers:
            {
                'Content-Type': type,
                'Accept-Ranges': 'bytes',
                'Content-Length': String(size),
            },
        })
    }
    return new Response(file.slice(range.start, range.end + 1),
    {
        status: 206,
        headers:
        {
            'Content-Type': type,
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
            'Content-Length': String(range.end - range.start + 1),
        },
    })
}
