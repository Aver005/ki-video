// Документ проекта: история, отложенное сохранение и единственная точка правки.

import type { Project } from '@core/model'
import { api } from '@shared/api/client'
import { notify } from '@shared/model/editor'
import { getState, setState } from '@shared/model/store'

const HISTORY_LIMIT = 100

const SAVE_DELAY_MS = 400

let saveTimer: ReturnType<typeof setTimeout> | null = null

let pendingSave: Project | null = null

let saveChain: Promise<unknown> = Promise.resolve()

/** Состояние до начала непрерывного жеста: именно оно попадает в историю. */
let gestureBase: Project | null = null

function scheduleSave(project: Project): void
{
    pendingSave = project
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(flushSave, SAVE_DELAY_MS)
}

/** Сохраняет накопленное изменение сразу; сохранения идут по очереди, чтобы не обгонять друг друга. */
export function flushSave(): void
{
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    const project = pendingSave
    if (!project) return
    pendingSave = null
    saveChain = saveChain
        .then(() => api.saveProject(project))
        .catch((error: unknown) =>
            notify(
                error instanceof Error ? error.message : 'Не удалось сохранить',
            ),
        )
}

/** При закрытии вкладки отправляем последнее изменение без ожидания ответа. */
export function saveOnUnload(): void
{
    if (!pendingSave) return
    void fetch('/api/project',
    {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingSave),
        keepalive: true,
    })
    pendingSave = null
}

/** Фиксирует новую версию проекта. record=false — промежуточный шаг жеста, в историю не пишется. */
export function commit(project: Project, record = true): void
{
    setState((s) =>
    {
        if (!record)
        {
            gestureBase ??= s.project
            return { project }
        }
        const snapshot = gestureBase ?? s.project
        gestureBase = null
        return {
            project,
            future: [],
            history: snapshot
                ? [...s.history.slice(1 - HISTORY_LIMIT), snapshot]
                : s.history,
        }
    })
    scheduleSave(project)
}

export function undo(): void
{
    const { history, project } = getState()
    const prev = history[history.length - 1]
    if (!prev || !project) return
    gestureBase = null
    setState((s) => (
    {
        project: prev,
        history: s.history.slice(0, -1),
        future: [project, ...s.future].slice(0, HISTORY_LIMIT),
    }))
    scheduleSave(prev)
}

export function redo(): void
{
    const { future, project } = getState()
    const next = future[0]
    if (!next || !project) return
    gestureBase = null
    setState((s) => (
    {
        project: next,
        future: s.future.slice(1),
        history: [...s.history.slice(1 - HISTORY_LIMIT), project],
    }))
    scheduleSave(next)
}

export function update(mutate: (draft: Project) => void, record = true): void
{
    const { project } = getState()
    if (!project) return
    const draft = structuredClone(project)
    mutate(draft)
    commit(draft, record)
}
