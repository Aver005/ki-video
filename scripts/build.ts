// Сборка одного exe: сервер, интерфейс и C-исходник пиков внутри. ffmpeg остаётся внешним.

import tailwind from 'bun-plugin-tailwind'
import { mkdir, rm } from 'node:fs/promises'
import pkg from '../package.json' with { type: 'json' }

const outdir = 'dist'
const isWindows = process.platform === 'win32'
const outfile = `${outdir}/ki-video${isWindows ? '.exe' : ''}`

/** Windows держит работающий exe: ни удалить папку, ни перезаписать файл нельзя. */
function isLocked(error: unknown): boolean
{
    const code = (error as { code?: string } | null)?.code
    return code === 'EPERM' || code === 'EBUSY' || code === 'ENOTEMPTY'
}

// Сносим только свой exe: рядом лежит .ki-data с проектом и кэшем пользователя.
try
{
    await mkdir(outdir, { recursive: true })
    await rm(outfile, { force: true })
}
catch (error)
{
    if (!isLocked(error)) throw error
    console.error(
        `не могу заменить ${outfile}: файл занят. Закрой запущенный ki-video и повтори сборку.`,
    )
    process.exit(1)
}

const result = await Bun.build(
{
    entrypoints: ['./src/server/main.ts'],
    target: 'bun',
    plugins: [tailwind],
    minify: true,
    sourcemap: 'none',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    compile:
    {
        outfile,
        ...(isWindows
            ?
              {
                  windows:
                  {
                      hideConsole: true,
                      title: 'ki-video',
                      description: 'Быстрый монтаж вертикальных роликов',
                      version: `${pkg.version}.0`,
                  },
              }
            : {}),
    },
})

if (!result.success)
{
    for (const log of result.logs) console.error(log)
    process.exit(1)
}

const size = Bun.file(outfile).size
console.log(`собрано: ${outfile} (${(size / 1024 / 1024).toFixed(1)} МБ)`)

/** Конфиг кладём рядом с exe: сервер читает его из папки запуска. */
async function copyIfExists(name: string): Promise<boolean>
{
    const file = Bun.file(name)
    if (!(await file.exists())) return false
    await Bun.write(`${outdir}/${name}`, file)
    return true
}

const copied = await copyIfExists('ki.config.json')
await copyIfExists('ki.config.example.json')
console.log(
    copied
        ? `конфиг скопирован: ${outdir}/ki.config.json`
        : 'конфига рядом нет: положи ki.config.json (см. ki.config.example.json) или задай KI_FFMPEG_DIR',
)
