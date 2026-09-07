// Один проект на приложение: читаем и пишем project.json в папке данных.

import { join } from 'node:path'
import { createProject, type Project } from '@shared/model'
import { normalizeProject } from '@shared/normalize'

/** Разбор входящего проекта: приводит поля к модели и переносит старую версию. */
export function parseProject(value: unknown): Project | null
{
    return normalizeProject(value)
}

export class ProjectStore
{
    private readonly file: string
    private current: Project | null = null

    constructor(dataDir: string)
    {
        this.file = join(dataDir, 'project.json')
    }

    async load(): Promise<Project>
    {
        if (this.current) return this.current
        const file = Bun.file(this.file)
        if (await file.exists())
        {
            const parsed = parseProject(await file.json().catch(() => null))
            if (parsed)
            {
                this.current = parsed
                return this.current
            }
            console.warn('[project] project.json повреждён, создаём новый')
        }
        this.current = createProject(crypto.randomUUID())
        await this.save(this.current)
        return this.current
    }

    async save(project: Project): Promise<void>
    {
        this.current = project
        await Bun.write(this.file, JSON.stringify(project, null, 2))
    }
}
