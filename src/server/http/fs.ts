// Просмотр папок для выбора файлов там, где нет системного диалога (Docker, Linux).

import { readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { VIDEO_EXTENSIONS, type FsEntry, type FsListing } from '@shared/api'

export function defaultDir(): string
{
    return join(homedir(), 'Videos')
}

export async function listDir(dir: string): Promise<FsListing>
{
    const abs = resolve(dir)
    const names = await readdir(abs, { withFileTypes: true })
    const entries: FsEntry[] = []
    for (const entry of names)
    {
        if (entry.name.startsWith('.')) continue
        const path = join(abs, entry.name)
        if (entry.isDirectory())
        {
            entries.push({ name: entry.name, path, kind: 'dir', size: 0 })
            continue
        }
        if (
            !entry.isFile() ||
            !VIDEO_EXTENSIONS.includes(extname(entry.name).toLowerCase())
        )
            continue
        const info = await stat(path).catch(() => null)
        entries.push(
        {
            name: entry.name,
            path,
            kind: 'file',
            size: info?.size ?? 0,
        })
    }
    entries.sort((a, b) =>
        a.kind === b.kind
            ? a.name.localeCompare(b.name)
            : a.kind === 'dir'
              ? -1
              : 1,
    )
    const parent = dirname(abs)
    return { dir: abs, parent: parent === abs ? null : parent, entries }
}
