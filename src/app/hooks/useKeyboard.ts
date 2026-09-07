// Горячие клавиши редактора: пробел, стрелки, удаление, отмена, разрез, ключевой кадр. По e.code, чтобы раскладка не мешала.

import { useEffect } from 'react'
import { addKeyframe, deleteSelection, redo, undo } from '@entities/project'
import { splitAtPlayhead } from '@features/split-item'
import { getPlayer, seek } from '@entities/player'
import { projectDuration } from '@core/timeline'
import { getState } from '@shared/model/store'

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTyping(target: EventTarget | null): boolean
{
    return (
        target instanceof HTMLElement &&
        (TYPING_TAGS.has(target.tagName) || target.isContentEditable)
    )
}

const STEP = 1 / 30

type Handler = (e: KeyboardEvent) => boolean

const withoutModifiers =
    (fn: () => void): Handler =>
    (e) =>
    {
        if (e.ctrlKey || e.metaKey || e.altKey) return false
        fn()
        return true
    }

const HANDLERS: Record<string, Handler> =
{
    Space: withoutModifiers(() => getPlayer().toggle()),
    ArrowLeft: (e) =>
    {
        seek(getState().time - (e.shiftKey ? 1 : STEP))
        return true
    },
    ArrowRight: (e) =>
    {
        seek(getState().time + (e.shiftKey ? 1 : STEP))
        return true
    },
    Home: withoutModifiers(() => seek(0)),
    End: withoutModifiers(() =>
    {
        const project = getState().project
        if (project) seek(projectDuration(project))
    }),
    Delete: withoutModifiers(deleteSelection),
    Backspace: withoutModifiers(deleteSelection),
    KeyS: withoutModifiers(splitAtPlayhead),
    KeyK: withoutModifiers(addKeyframe),
    KeyZ: (e) =>
    {
        if (!e.ctrlKey && !e.metaKey) return false
        if (e.shiftKey) redo()
        else undo()
        return true
    },
    KeyY: (e) =>
    {
        if (!e.ctrlKey && !e.metaKey) return false
        redo()
        return true
    },
}

export function useKeyboard(): void
{
    useEffect(() =>
    {
        const onKey = (e: KeyboardEvent) =>
        {
            if (
                e.isComposing ||
                isTyping(e.target) ||
                document.querySelector('.modal')
            )
                return
            const handler = HANDLERS[e.code]
            if (handler?.(e)) e.preventDefault()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])
}
