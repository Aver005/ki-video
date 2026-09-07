// Точка входа: Bun.serve отдаёт интерфейс из HTML-импорта, API и WebSocket с событиями.

import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import index from '@app/index.html'
import type { ImportRequest, ServerEvent, StatusResponse } from '@core/api'
import { loadConfig } from '@server/config'
import { locateFfmpeg, type FfmpegTools } from '@server/ffmpeg/locate'
import { ASSET_ID_PATTERN, AssetStore } from '@server/assets'
import { ProjectStore, parseProject } from '@server/project'
import { ExportService } from '@server/export'
import { serveFile } from '@server/http/range'
import { guard, json, fail, readBody, type Handler } from '@server/http/guard'
import { isDialogSupported, openFileDialog } from '@server/http/dialog'
import { defaultDir, listDir } from '@server/http/fs'
import { openAppWindow, revealInExplorer } from '@server/window'
import { mediaFile, THUMBS_DIR } from '@server/ffmpeg/ingest'
import { isNativePeaksAvailable } from '@server/peaks'
import pkg from '../../package.json' with { type: 'json' }

const EVENTS_TOPIC = 'events'
const config = await loadConfig()
await mkdir(config.dataDir, { recursive: true })

let tools: FfmpegTools | null = null
let ffmpegError: string | null = null
try
{
    tools = await locateFfmpeg(config.ffmpegDir)
}
catch (error)
{
    ffmpegError = error instanceof Error ? error.message : String(error)
}

const assets = new AssetStore(tools,
{
    dataDir: config.dataDir,
    threads: config.threads,
    nativePeaks: true,
})
await assets.load()
const projects = new ProjectStore(config.dataDir)
const exporter = new ExportService(tools, config.dataDir, config.threads)

// В exe define подставляет NODE_ENV в process.env; Bun.env его не видит.
const isDev =
    process.env.NODE_ENV !== 'production' && Bun.embeddedFiles.length === 0

/** Файл кэша только для известного id: параметр из URL не должен превращаться в путь. */
function cacheFile(id: string, relative: string): string | null
{
    if (!ASSET_ID_PATTERN.test(id) || !assets.get(id)) return null
    return join(assets.cacheDir(id), relative)
}

const status: Handler = () =>
    json(
    {
        ok: tools !== null,
        version: pkg.version,
        ffmpeg: tools?.version ?? null,
        encoders: tools?.caps.encoders ?? null,
        hwaccel: tools?.caps.hwaccel ?? null,
        error: ffmpegError,
        platform: `${process.platform} · bun ${Bun.version} · peaks ${isNativePeaksAvailable() ? 'C' : 'ts'} · dialog ${isDialogSupported() ? 'yes' : 'no'}`,
        dataDir: config.dataDir,
    } satisfies StatusResponse)

const server = Bun.serve(
{
    port: config.port,
    hostname: '127.0.0.1',
    development: isDev ? { hmr: true, console: true } : false,
    routes:
    {
        '/': index,
        '/api/status': guard(status),

        '/api/assets':
        {
            GET: guard(() => json(assets.list())),
            POST: guard(async (req) =>
            {
                const body = await readBody<ImportRequest>(req)
                if (
                    !Array.isArray(body.paths) ||
                    body.paths.some((p) => typeof p !== 'string')
                )
                    return fail('Нужен список путей')
                return json(await assets.import(body.paths))
            }),
        },
        '/api/assets/:id':
        {
            DELETE: guard(async (req) =>
                json({ removed: await assets.remove(req.params.id) }),
            ),
        },
        '/api/assets/:id/media': guard((req) =>
        {
            const asset = assets.get(req.params.id)
            const file = asset ? mediaFile(asset.kind) : null
            const path = file ? cacheFile(req.params.id, file.name) : null
            return path && file
                ? serveFile(req, path, file.type)
                : fail('Файл не найден', 404)
        }),
        '/api/assets/:id/thumbs/:n': guard((req) =>
        {
            const n = Number(req.params.n)
            if (!Number.isInteger(n) || n < 1 || n > 9999)
                return fail('Неверный номер', 400)
            const path = cacheFile(
                req.params.id,
                join(THUMBS_DIR, `${String(n).padStart(4, '0')}.jpg`),
            )
            return path
                ? serveFile(req, path, 'image/jpeg')
                : fail('Файл не найден', 404)
        }),

        '/api/project':
        {
            GET: guard(async () => json({ project: await projects.load() })),
            PUT: guard(async (req) =>
            {
                const project = parseProject(await readBody<unknown>(req))
                if (!project) return fail('Некорректный проект')
                await projects.save(project)
                return json({ ok: true })
            }),
        },

        '/api/export':
        {
            POST: guard(async (req) =>
            {
                const project = parseProject(await readBody<unknown>(req))
                if (!project) return fail('Некорректный проект')
                await projects.save(project)
                return json(await exporter.start(project, assets.map()))
            }),
        },
        '/api/export/:id':
        {
            GET: guard((req) =>
            {
                const job = exporter.get(req.params.id)
                return job ? json(job) : fail('Задание не найдено', 404)
            }),
            DELETE: guard((req) =>
                json({ cancelled: exporter.cancel(req.params.id) }),
            ),
        },

        '/api/dialog/open':
        {
            POST: guard(async () =>
            {
                try
                {
                    return json({ paths: await openFileDialog() })
                }
                catch (error)
                {
                    return fail(error, 501)
                }
            }),
        },
        '/api/fs': guard(async (req) =>
        {
            const dir = new URL(req.url).searchParams.get('dir') || defaultDir()
            try
            {
                return json(await listDir(dir))
            }
            catch (error)
            {
                return fail(error, 404)
            }
        }),
        '/api/reveal':
        {
            POST: guard(async (req) =>
            {
                const body = await readBody<{ path?: unknown }>(req)
                if (typeof body.path !== 'string') return fail('Нужен путь')
                revealInExplorer(body.path)
                return json({ ok: true })
            }),
        },
    },
    fetch(req, srv)
    {
        const url = new URL(req.url)
        if (url.pathname === '/ws')
        {
            return srv.upgrade(req)
                ? undefined
                : new Response('WebSocket only', { status: 426 })
        }
        return new Response('Not found', { status: 404 })
    },
    websocket:
    {
        open(ws)
        {
            ws.subscribe(EVENTS_TOPIC)
        },
        message()
        {},
        close(ws)
        {
            ws.unsubscribe(EVENTS_TOPIC)
        },
    },
})

function broadcast(event: ServerEvent): void
{
    server.publish(EVENTS_TOPIC, JSON.stringify(event))
}
assets.subscribe(broadcast)
exporter.subscribe((job) => broadcast({ type: 'export', job }))

const url = `http://127.0.0.1:${server.port}`
console.log(`ki-video ${pkg.version} → ${url}${isDev ? ' (dev)' : ''}`)
console.log(
    tools
        ? `ffmpeg: ${tools.version} · ${tools.caps.encoders.h264}/${tools.caps.encoders.hevc} · hwaccel ${tools.caps.hwaccel ?? 'нет'}`
        : `ffmpeg: ${ffmpegError}`,
)
if (config.openWindow)
{
    const appWindow = await openAppWindow(url, config.dataDir)
    console.log(`окно: ${appWindow.opener}`)
    // Закрыли окно — приложению больше незачем жить.
    void appWindow.process?.exited.then(() =>
    {
        console.log('окно закрыто, останавливаюсь')
        exporter.stopActive()
        void server.stop(true)
        process.exit(0)
    })
}
