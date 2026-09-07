// Действия над проектом: каждое изменение проходит через commit с историей и отложенным сохранением.

import type {
    FrameKeyframe,
    FrameState,
    Item,
    MediaAsset,
    MediaItem,
    Project,
    SubtitleCue,
    TextItem,
    Track,
    TrackKind,
} from '@shared/model'
import {
    IMAGE_MAX_SECONDS,
    IMAGE_SECONDS,
    MIN_ITEM_SECONDS,
    createTrack,
    DEFAULT_BOX,
    isMediaItem,
    isTextItem,
    itemEnd,
} from '@shared/model'
import {
    clampFrame,
    defaultFrame,
    findKeyframeAt,
    interpolateFrame,
    removeKeyframeAt,
    upsertKeyframe,
} from '@shared/frame'
import {
    clampContentStart,
    contentAt,
    contentTrack,
    findItem,
    trackDuration,
} from '@shared/timeline'
import { TEXT_PRESETS } from '@shared/presets'
import { api } from '@app/api'
import { getPlayer } from '@app/hooks/usePlayer'
import {
    getState,
    setState,
    type InspectorTab,
    type Selection,
} from '@app/store/store'

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

export function notify(message: string | null): void
{
    setState({ notice: message })
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

export function select(selection: Selection): void
{
    setState({ selection })
}

export function setTab(tab: InspectorTab): void
{
    setState({ tab })
}

export function setZoom(pxPerSec: number): void
{
    setState({ pxPerSec })
}

/** Перемотка идёт через плеер: он источник истины по времени и при воспроизведении, и на паузе. */
export function seek(time: number): void
{
    getPlayer().seek(time)
}

/** Какая дорожка примет этот элемент: картинка и видео — в кадр или наложения, звук — только в звук. */
export function trackAccepts(
    track: Track,
    item: Item,
    asset: MediaAsset | undefined,
): boolean
{
    if (isTextItem(item)) return track.kind === 'overlay'
    if (asset?.kind === 'audio') return track.kind === 'audio'
    return track.kind === 'content' || track.kind === 'overlay'
}

export function addTrack(kind: TrackKind): void
{
    update((p) =>
    {
        const count = p.tracks.filter((t) => t.kind === kind).length + 1
        const name = kind === 'audio' ? `Звук ${count}` : `Наложения ${count}`
        p.tracks.push(createTrack(kind, name))
    })
}

export function removeTrack(id: string): void
{
    update((p) =>
    {
        const track = p.tracks.find((t) => t.id === id)
        if (!track || track.kind === 'content') return
        p.tracks = p.tracks.filter((t) => t.id !== id)
    })
    select(null)
}

export function updateTrack(id: string, patch: Partial<Track>): void
{
    update((p) =>
    {
        const track = p.tracks.find((t) => t.id === id)
        if (track) Object.assign(track, patch)
    })
}

/** Сколько элемент может длиться: видео и звук ограничены остатком исходника, картинка — почти нет. */
export function maxDuration(item: MediaItem, asset: MediaAsset): number
{
    return asset.kind === 'image'
        ? IMAGE_MAX_SECONDS
        : Math.max(MIN_ITEM_SECONDS, asset.duration - item.offset)
}

export function createMediaItem(
    asset: MediaAsset,
    start: number,
    duration: number,
): MediaItem
{
    return {
        kind: 'media',
        id: crypto.randomUUID(),
        assetId: asset.id,
        start,
        duration,
        offset: 0,
        frame: [],
        box: { ...DEFAULT_BOX },
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        transition: 'fade',
    }
}

/** Кладёт файл на дорожку: содержимое встаёт в конец ленты, остальное — под курсор. */
export function addAssetToTimeline(
    asset: MediaAsset,
    trackId?: string,
    at?: number,
): void
{
    const { project, time } = getState()
    if (!project) return
    const target =
        project.tracks.find((t) => t.id === trackId) ??
        (asset.kind === 'audio'
            ? project.tracks.find((t) => t.kind === 'audio')
            : contentTrack(project))
    if (!target)
    {
        notify('Нет подходящей дорожки')
        return
    }
    const duration =
        asset.kind === 'image'
            ? IMAGE_SECONDS
            : Math.max(MIN_ITEM_SECONDS, asset.duration)
    const start =
        at ?? (target.kind === 'content' ? trackDuration(target) : time)
    const item = createMediaItem(asset, Math.max(0, start), duration)
    update((p) =>
    {
        p.tracks.find((t) => t.id === target.id)?.items.push(item)
    })
    select({ kind: 'item', id: item.id })
    setTab('item')
}

export function addText(presetId: string): void
{
    const preset =
        TEXT_PRESETS.find((p) => p.id === presetId) ?? TEXT_PRESETS[0]
    const { project, time } = getState()
    if (!preset || !project) return
    const target = project.tracks.find((t) => t.kind === 'overlay')
    if (!target)
    {
        notify('Нужна дорожка наложений')
        return
    }
    const item: TextItem =
    {
        kind: 'text',
        id: crypto.randomUUID(),
        text: 'Текст',
        start: time,
        duration: 3,
        x: 0.5,
        y: 0.2,
        ...preset.value,
    }
    update((p) =>
    {
        p.tracks.find((t) => t.id === target.id)?.items.push(item)
    })
    select({ kind: 'item', id: item.id })
    setTab('item')
}

export function updateItem(
    id: string,
    patch: Partial<MediaItem> | Partial<TextItem>,
    record = true,
): void
{
    update((p) =>
    {
        const found = findItem(p, id)
        if (found) Object.assign(found.item, patch)
    }, record)
}

export interface ItemPlacement
{
    start: number
    duration: number
    trackId?: string
}

/** Перенос и растягивание: ограничения по исходнику, ключи едут вместе с левым краем. */
export function placeItem(id: string, next: ItemPlacement, record = true): void
{
    const { assets } = getState()
    update((p) =>
    {
        const found = findItem(p, id)
        if (!found) return
        const { item } = found
        const asset = isMediaItem(item) ? assets[item.assetId] : undefined
        const target =
            next.trackId === undefined
                ? found.track
                : (p.tracks.find((t) => t.id === next.trackId) ?? found.track)
        if (!trackAccepts(target, item, asset)) return

        const limit =
            isMediaItem(item) && asset ? maxDuration(item, asset) : Infinity
        const duration = Math.max(
            MIN_ITEM_SECONDS,
            Math.min(next.duration, limit),
        )
        const shift = next.start - item.start
        if (isMediaItem(item) && asset && asset.kind !== 'image')
        {
            // Левый край режет исходник, а не сдвигает элемент, только когда меняется длительность.
            const trimmed = Math.abs(duration - item.duration) > 0.0005
            if (trimmed) item.offset = Math.max(0, item.offset + shift)
        }
        if (isMediaItem(item) && Math.abs(duration - item.duration) > 0.0005)
        {
            item.frame = item.frame
                .map((k) => ({ ...k, t: k.t - shift }))
                .filter((k) => k.t >= -0.001 && k.t <= duration + 0.001)
        }
        item.start = Math.max(0, next.start)
        item.duration = duration
        if (target.kind === 'content')
            item.start = clampContentStart(target, item, item.start)
        if (target.id !== found.track.id)
        {
            found.track.items = found.track.items.filter((i) => i.id !== id)
            target.items.push(item)
        }
    }, record)
}

export function removeItem(id: string): void
{
    update((p) =>
    {
        for (const track of p.tracks)
            track.items = track.items.filter((i) => i.id !== id)
    })
    select(null)
}

/** Разрезает элемент дорожки содержимого под курсором на два. */
export function splitAtPlayhead(): void
{
    const { project, time } = getState()
    if (!project) return
    const at = contentAt(project, time)
    if (!at) return
    const { item, localT } = at
    if (localT <= 0.05 || localT >= item.duration - 0.05) return
    update((p) =>
    {
        const found = findItem(p, item.id)
        if (!found || !isMediaItem(found.item)) return
        const left = found.item
        const right: MediaItem =
        {
            ...structuredClone(left),
            id: crypto.randomUUID(),
            start: left.start + localT,
            duration: left.duration - localT,
            offset: left.offset + localT,
            frame: left.frame
                .filter((k) => k.t >= localT)
                .map((k) => ({ ...k, t: k.t - localT })),
        }
        left.duration = localT
        left.frame = left.frame.filter((k) => k.t <= localT)
        found.track.items.push(right)
    })
}

export interface CurrentContent
{
    item: MediaItem
    asset: MediaAsset
    localT: number
    frame: FrameState
    keyframe: FrameKeyframe | undefined
}

/** Элемент дорожки содержимого под курсором вместе с интерполированным окном кадрирования. */
export function currentContent(): CurrentContent | null
{
    const { project, time, assets } = getState()
    if (!project) return null
    const at = contentAt(project, time)
    const asset = at ? assets[at.item.assetId] : undefined
    if (!at || !asset) return null
    return {
        item: at.item,
        asset,
        localT: at.localT,
        frame: interpolateFrame(at.item.frame, at.localT, defaultFrame(asset)),
        keyframe: findKeyframeAt(at.item.frame, at.localT),
    }
}

export interface SelectedItem
{
    track: Track
    item: Item
    asset: MediaAsset | undefined
}

export function selectedItem(): SelectedItem | null
{
    const { project, selection, assets } = getState()
    if (!project || selection?.kind !== 'item') return null
    const found = findItem(project, selection.id)
    if (!found) return null
    return {
        track: found.track,
        item: found.item,
        asset: isMediaItem(found.item) ? assets[found.item.assetId] : undefined,
    }
}

/** Меняет окно в текущий момент: если ключи уже есть — правит или создаёт ключ, иначе статичное значение. */
export function setFrame(patch: Partial<FrameState>, record = true): void
{
    const current = currentContent()
    const { project } = getState()
    if (!current || !project) return
    const next = clampFrame(
        { ...current.frame, ...patch },
        current.asset,
        project.output,
    )
    update((p) =>
    {
        const found = findItem(p, current.item.id)
        if (!found || !isMediaItem(found.item)) return
        found.item.frame =
            found.item.frame.length === 0
                ? [{ t: 0, ...next }]
                : upsertKeyframe(found.item.frame,
                  {
                      t: current.localT,
                      ...next,
                  })
    }, record)
}

function withCurrentFrame(
    change: (item: MediaItem, localT: number, frame: FrameState) => void,
): void
{
    const current = currentContent()
    if (!current) return
    update((p) =>
    {
        const found = findItem(p, current.item.id)
        if (found && isMediaItem(found.item))
            change(found.item, current.localT, current.frame)
    })
}

export function addKeyframe(): void
{
    withCurrentFrame((item, localT, frame) =>
    {
        item.frame = upsertKeyframe(item.frame, { t: localT, ...frame })
    })
}

export function removeKeyframe(): void
{
    withCurrentFrame((item, localT) =>
    {
        item.frame = removeKeyframeAt(item.frame, localT)
    })
}

export function clearKeyframes(): void
{
    withCurrentFrame((item) =>
    {
        item.frame = []
    })
}

/** Файл, который используют элементы, убрать нельзя: сначала удаляются элементы. */
export function removeAsset(id: string): void
{
    const { project } = getState()
    const used = project?.tracks.some((track) =>
        track.items.some((item) => isMediaItem(item) && item.assetId === id),
    )
    if (used)
    {
        notify('Файл стоит на таймлайне: сначала удали его элементы')
        return
    }
    void api
        .removeAsset(id)
        .catch((error: unknown) =>
            notify(
                error instanceof Error
                    ? error.message
                    : 'Не удалось убрать файл',
            ),
        )
}

export function setCues(cues: SubtitleCue[]): void
{
    update((p) =>
    {
        p.subtitles.cues = [...cues].sort((a, b) => a.start - b.start)
    })
}

export function updateCue(
    id: string,
    patch: Partial<SubtitleCue>,
    record = true,
): void
{
    update((p) =>
    {
        const cue = p.subtitles.cues.find((c) => c.id === id)
        if (cue) Object.assign(cue, patch)
        if (record) p.subtitles.cues.sort((a, b) => a.start - b.start)
    }, record)
}

export function removeCue(id: string): void
{
    update((p) =>
    {
        p.subtitles.cues = p.subtitles.cues.filter((c) => c.id !== id)
    })
    select(null)
}

export function deleteSelection(): void
{
    const { selection } = getState()
    if (!selection) return
    if (selection.kind === 'item') removeItem(selection.id)
    if (selection.kind === 'cue') removeCue(selection.id)
}

/** Края всех соседей и курсор: к ним прилипает перетаскивание. */
export function snapPoints(exceptId: string): number[]
{
    const { project, time } = getState()
    if (!project) return [time]
    const points = [0, time]
    for (const track of project.tracks)
    {
        for (const item of track.items)
        {
            if (item.id === exceptId) continue
            points.push(item.start, itemEnd(item))
        }
    }
    return points
}
