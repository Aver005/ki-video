// Внешний стор без библиотек: одно состояние, подписка через useSyncExternalStore.

import { useSyncExternalStore } from 'react'
import type { MediaAsset, Project } from '@shared/model'
import type { ExportJob, StatusResponse } from '@shared/api'

export type InspectorTab = 'item' | 'color' | 'audio' | 'subtitles' | 'export'

export type Selection =
    | { kind: 'item'; id: string }
    | { kind: 'cue'; id: string }
    | null

export interface EditorState
{
    project: Project | null
    assets: Record<string, MediaAsset>
    assetProgress: Record<string, number>
    status: StatusResponse | null
    selection: Selection
    time: number
    playing: boolean
    exportJob: ExportJob | null
    tab: InspectorTab
    history: Project[]
    future: Project[]
    /** Пикселей на секунду на таймлайне. */
    pxPerSec: number
    /** Размеры панелей: тянутся мышью и переживают перезапуск. */
    inspectorWidth: number
    timelineHeight: number
    notice: string | null
}

const LAYOUT_KEY = 'ki-video:layout'

interface Layout
{
    inspectorWidth: number
    timelineHeight: number
}

const DEFAULT_LAYOUT: Layout = { inspectorWidth: 380, timelineHeight: 300 }

function readLayout(): Layout
{
    try
    {
        const raw = localStorage.getItem(LAYOUT_KEY)
        const parsed = raw ? (JSON.parse(raw) as Partial<Layout>) : {}
        return {
            inspectorWidth:
                typeof parsed.inspectorWidth === 'number'
                    ? parsed.inspectorWidth
                    : DEFAULT_LAYOUT.inspectorWidth,
            timelineHeight:
                typeof parsed.timelineHeight === 'number'
                    ? parsed.timelineHeight
                    : DEFAULT_LAYOUT.timelineHeight,
        }
    }
    catch
    {
        return DEFAULT_LAYOUT
    }
}

export function saveLayout(layout: Layout): void
{
    try
    {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
    }
    catch
    {
        // Приватный режим браузера: размеры просто не запомнятся.
    }
}

const layout = readLayout()

const initial: EditorState =
{
    project: null,
    assets: {},
    assetProgress: {},
    status: null,
    selection: null,
    time: 0,
    playing: false,
    exportJob: null,
    tab: 'item',
    history: [],
    future: [],
    pxPerSec: 40,
    inspectorWidth: layout.inspectorWidth,
    timelineHeight: layout.timelineHeight,
    notice: null,
}

type Listener = () => void

let state: EditorState = initial
const listeners = new Set<Listener>()

export function getState(): EditorState
{
    return state
}

export function setState(
    patch: Partial<EditorState> | ((prev: EditorState) => Partial<EditorState>),
): void
{
    const next = typeof patch === 'function' ? patch(state) : patch
    state = { ...state, ...next }
    for (const listener of listeners) listener()
}

function subscribe(listener: Listener): () => void
{
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function useStore<T>(selector: (s: EditorState) => T): T
{
    return useSyncExternalStore(
        subscribe,
        () => selector(state),
        () => selector(state),
    )
}

export function useProject(): Project | null
{
    return useStore((s) => s.project)
}
