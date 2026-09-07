// Внешний стор без библиотек: одно состояние, подписка через useSyncExternalStore.

import { useSyncExternalStore } from 'react'
import type { MediaAsset, Project } from '@shared/model'
import type { ExportJob, StatusResponse } from '@shared/api'

export type InspectorTab =
    | 'frame'
    | 'color'
    | 'audio'
    | 'text'
    | 'subtitles'
    | 'export'

export type Selection =
    | { kind: 'clip'; id: string }
    | { kind: 'text'; id: string }
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
    notice: string | null
}

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
    tab: 'frame',
    history: [],
    future: [],
    pxPerSec: 40,
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
