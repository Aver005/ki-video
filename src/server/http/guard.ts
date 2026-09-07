// Обёртка маршрутов: только свой Host и своя страница, любые исключения — в ответ 400.

export type Handler<P extends string = string> = (
    req: Bun.BunRequest<P>,
) => Response | Promise<Response>

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

export function json(data: unknown, status = 200): Response
{
    return Response.json(data, { status })
}

export function fail(error: unknown, status = 400): Response
{
    return json(
        { error: error instanceof Error ? error.message : String(error) },
        status,
    )
}

export async function readBody<T>(req: Request): Promise<T>
{
    const body = (await req.json().catch(() => null)) as T | null
    if (body === null || typeof body !== 'object')
        throw new Error('Ожидался JSON-объект')
    return body
}

/** Запрос пришёл со своей страницы: Host локальный, а для изменяющих методов ещё и та же вкладка. */
export function isOwnRequest(req: Request): boolean
{
    const host = req.headers.get('host') ?? ''
    const hostname = host.replace(/:\d+$/, '')
    if (!LOCAL_HOSTS.has(hostname)) return false
    if (req.method === 'GET' || req.method === 'HEAD') return true
    const site = req.headers.get('sec-fetch-site')
    if (site) return site === 'same-origin' || site === 'none'
    const origin = req.headers.get('origin')
    return origin === null || origin === `http://${host}`
}

export function guard<P extends string>(handler: Handler<P>): Handler<P>
{
    return async (req) =>
    {
        if (!isOwnRequest(req)) return fail('Запрос не со своей страницы', 403)
        try
        {
            return await handler(req)
        }
        catch (error)
        {
            return fail(error)
        }
    }
}
