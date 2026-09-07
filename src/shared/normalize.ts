// Разбор проекта из JSON: проверка полей, значения по умолчанию и перенос старой версии 1 на дорожки.

import type {
    AudioChain,
    ColorGrade,
    Item,
    MediaItem,
    OutputSpec,
    OverlayBox,
    Project,
    SubtitleCue,
    Subtitles,
    TextAnimation,
    TextItem,
    Track,
    TrackKind,
    TransitionKind,
} from '@shared/model'
import {
    createProject,
    createTrack,
    DEFAULT_BOX,
    DEFAULT_OUTPUT,
    MIN_ITEM_SECONDS,
    NEUTRAL_COLOR,
    SILENT_AUDIO,
} from '@shared/model'

type Raw = Record<string, unknown>

const ANIMATIONS: readonly TextAnimation[] = ['none', 'fade', 'pop']
const TRACK_KINDS: readonly TrackKind[] = ['content', 'overlay', 'audio']
const SUBTITLE_PRESETS = ['bold', 'clean', 'yellow'] as const
export const TRANSITION_KINDS: readonly TransitionKind[] = [
    'fade',
    'dissolve',
    'wipeleft',
    'wiperight',
    'wipeup',
    'wipedown',
    'slideleft',
    'slideright',
    'circleopen',
]

function isRecord(value: unknown): value is Raw
{
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown, fallback: number, min?: number): number
{
    const parsed =
        typeof value === 'number' && Number.isFinite(value) ? value : fallback
    return min === undefined ? parsed : Math.max(min, parsed)
}

function asString(value: unknown, fallback: string): string
{
    return typeof value === 'string' ? value : fallback
}

function asBool(value: unknown, fallback: boolean): boolean
{
    return typeof value === 'boolean' ? value : fallback
}

function asEnum<T extends string>(
    value: unknown,
    values: readonly T[],
    fallback: T,
): T
{
    return values.includes(value as T) ? (value as T) : fallback
}

function asArray(value: unknown): unknown[]
{
    return Array.isArray(value) ? value : []
}

function id(value: unknown): string
{
    return typeof value === 'string' && value !== ''
        ? value
        : crypto.randomUUID()
}

function normalizeOutput(value: unknown): OutputSpec
{
    const raw = isRecord(value) ? value : {}
    return {
        width: Math.round(asNumber(raw['width'], DEFAULT_OUTPUT.width, 16)),
        height: Math.round(asNumber(raw['height'], DEFAULT_OUTPUT.height, 16)),
        fps: asNumber(raw['fps'], DEFAULT_OUTPUT.fps, 1),
        codec: raw['codec'] === 'hevc' ? 'hevc' : 'h264',
        quality: asNumber(raw['quality'], DEFAULT_OUTPUT.quality, 0),
    }
}

function normalizeColor(value: unknown): ColorGrade
{
    const raw = isRecord(value) ? value : {}
    return {
        brightness: asNumber(raw['brightness'], NEUTRAL_COLOR.brightness),
        contrast: asNumber(raw['contrast'], NEUTRAL_COLOR.contrast),
        saturation: asNumber(raw['saturation'], NEUTRAL_COLOR.saturation),
        gamma: asNumber(raw['gamma'], NEUTRAL_COLOR.gamma),
        vibrance: asNumber(raw['vibrance'], NEUTRAL_COLOR.vibrance),
        sharpen: asNumber(raw['sharpen'], NEUTRAL_COLOR.sharpen),
    }
}

function normalizeAudio(value: unknown): AudioChain
{
    const raw = isRecord(value) ? value : {}
    return {
        denoise: asNumber(raw['denoise'], SILENT_AUDIO.denoise),
        highpass: asBool(raw['highpass'], SILENT_AUDIO.highpass),
        compressor: asBool(raw['compressor'], SILENT_AUDIO.compressor),
        loudness: asNumber(raw['loudness'], SILENT_AUDIO.loudness),
    }
}

function normalizeBox(value: unknown): OverlayBox
{
    const raw = isRecord(value) ? value : {}
    return {
        x: asNumber(raw['x'], DEFAULT_BOX.x),
        y: asNumber(raw['y'], DEFAULT_BOX.y),
        width: Math.max(0.01, asNumber(raw['width'], DEFAULT_BOX.width)),
        rotation: asNumber(raw['rotation'], DEFAULT_BOX.rotation),
        opacity: Math.min(1, asNumber(raw['opacity'], DEFAULT_BOX.opacity, 0)),
    }
}

function normalizeBoxKeys(value: unknown): MediaItem['boxKeys']
{
    return asArray(value)
        .filter(isRecord)
        .map((raw) => ({ ...normalizeBox(raw), t: asNumber(raw['t'], 0, 0) }))
        .sort((a, b) => a.t - b.t)
}

function normalizeColorKeys(value: unknown): Project['colorKeys']
{
    return asArray(value)
        .filter(isRecord)
        .map((raw) => ({ ...normalizeColor(raw), t: asNumber(raw['t'], 0, 0) }))
        .sort((a, b) => a.t - b.t)
}

function normalizeFrame(value: unknown): MediaItem['frame']
{
    return asArray(value)
        .filter(isRecord)
        .map((raw) => (
        {
            t: asNumber(raw['t'], 0, 0),
            cx: asNumber(raw['cx'], 0),
            cy: asNumber(raw['cy'], 0),
            zoom: asNumber(raw['zoom'], 1, 1),
        }))
        .sort((a, b) => a.t - b.t)
}

function normalizeCues(value: unknown): SubtitleCue[]
{
    return asArray(value)
        .filter(isRecord)
        .map((raw) => (
        {
            id: id(raw['id']),
            start: asNumber(raw['start'], 0, 0),
            end: asNumber(raw['end'], 0, 0),
            text: asString(raw['text'], ''),
        }))
        .filter((cue) => cue.end > cue.start)
        .sort((a, b) => a.start - b.start)
}

function normalizeSubtitles(value: unknown): Subtitles
{
    const raw = isRecord(value) ? value : {}
    return {
        preset: asEnum(raw['preset'], SUBTITLE_PRESETS, 'bold'),
        y: asNumber(raw['y'], 0.8),
        cues: normalizeCues(raw['cues']),
    }
}

function normalizeMediaItem(
    raw: Raw,
    start: number,
    duration: number,
): MediaItem
{
    return {
        kind: 'media',
        id: id(raw['id']),
        assetId: asString(raw['assetId'], ''),
        start,
        duration,
        offset: asNumber(raw['offset'], 0, 0),
        frame: normalizeFrame(raw['frame']),
        box: normalizeBox(raw['box']),
        boxKeys: normalizeBoxKeys(raw['boxKeys']),
        volume: asNumber(raw['volume'], 1, 0),
        fadeIn: asNumber(raw['fadeIn'], 0, 0),
        fadeOut: asNumber(raw['fadeOut'], 0, 0),
        transition: asEnum(raw['transition'], TRANSITION_KINDS, 'fade'),
    }
}

function normalizeTextItem(raw: Raw, start: number, duration: number): TextItem
{
    return {
        kind: 'text',
        id: id(raw['id']),
        start,
        duration,
        text: asString(raw['text'], ''),
        x: asNumber(raw['x'], 0.5),
        y: asNumber(raw['y'], 0.2),
        size: asNumber(raw['size'], 64, 8),
        color: asString(raw['color'], '#ffffff'),
        outline: asString(raw['outline'], '#000000'),
        animation: asEnum(raw['animation'], ANIMATIONS, 'none'),
    }
}

function normalizeItem(value: unknown): Item | null
{
    if (!isRecord(value)) return null
    const start = asNumber(value['start'], 0, 0)
    const duration = asNumber(value['duration'], 0, MIN_ITEM_SECONDS)
    if (value['kind'] === 'text')
        return normalizeTextItem(value, start, duration)
    const item = normalizeMediaItem(value, start, duration)
    return item.assetId === '' ? null : item
}

function normalizeTrack(value: unknown): Track | null
{
    if (!isRecord(value)) return null
    const kind = asEnum(value['kind'], TRACK_KINDS, 'overlay')
    return {
        id: id(value['id']),
        kind,
        name: asString(
            value['name'],
            kind === 'content' ? 'Содержимое' : 'Дорожка',
        ),
        hidden: asBool(value['hidden'], false),
        muted: asBool(value['muted'], false),
        items: asArray(value['items'])
            .map(normalizeItem)
            .filter((item): item is Item => item !== null),
    }
}

/** Проект версии 1: клипы шли подряд одной лентой, тексты лежали отдельным списком. */
function fromVersion1(raw: Raw, project: Project): Project
{
    const content = project.tracks[0]
    const overlay = project.tracks[1]
    if (!content || !overlay) return project
    let cursor = 0
    for (const value of asArray(raw['clips']))
    {
        if (!isRecord(value)) continue
        const from = asNumber(value['in'], 0, 0)
        const to = asNumber(value['out'], 0, 0)
        const duration = Math.max(MIN_ITEM_SECONDS, to - from)
        const item = normalizeMediaItem(value, cursor, duration)
        item.offset = from
        if (item.assetId !== '') content.items.push(item)
        cursor += duration
    }
    for (const value of asArray(raw['texts']))
    {
        if (!isRecord(value)) continue
        const start = asNumber(value['start'], 0, 0)
        const end = asNumber(value['end'], 0, 0)
        overlay.items.push(
            normalizeTextItem(
                value,
                start,
                Math.max(MIN_ITEM_SECONDS, end - start),
            ),
        )
    }
    return project
}

/** Разбирает сохранённый проект известной версии. null — это не проект. */
export function normalizeProject(value: unknown): Project | null
{
    if (!isRecord(value)) return null
    const version = value['version']
    if (version !== 1 && version !== 2) return null
    const project: Project =
    {
        ...createProject(
            id(value['id']),
            asString(value['name'], 'Без названия'),
        ),
        output: normalizeOutput(value['output']),
        color: normalizeColor(value['color']),
        colorKeys: normalizeColorKeys(value['colorKeys']),
        audio: normalizeAudio(value['audio']),
        subtitles: normalizeSubtitles(value['subtitles']),
    }
    if (version === 1) return fromVersion1(value, project)
    const tracks = asArray(value['tracks'])
        .map(normalizeTrack)
        .filter((track): track is Track => track !== null)
    if (tracks.length === 0) return project
    if (!tracks.some((t) => t.kind === 'content'))
        tracks.unshift(createTrack('content', 'Содержимое'))
    project.tracks = tracks
    return project
}
