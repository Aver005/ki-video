// Модель проекта: дорожки и элементы на общей шкале времени. Общая для сервера и интерфейса.

export type Id = string

export type VideoCodec = 'h264' | 'hevc'

/** Что за файл: видео, картинка или только звук. */
export type MediaKind = 'video' | 'image' | 'audio'

/** Содержимое — базовая дорожка кадра, наложения рисуются поверх, звук только слышен. */
export type TrackKind = 'content' | 'overlay' | 'audio'

export interface OutputSpec
{
    width: number
    height: number
    fps: number
    codec: VideoCodec
    /** Качество кодека: CQ/CRF, 0..51, меньше — лучше. */
    quality: number
}

/** Ключевой кадр окна кадрирования: центр в пикселях исходника и зум (>= 1). */
export interface FrameKeyframe
{
    /** Секунды от начала элемента. */
    t: number
    cx: number
    cy: number
    zoom: number
}

export type FrameState = Omit<FrameKeyframe, 't'>

/** Геометрия наложения: центр и ширина в долях кадра, поворот в градусах. */
export interface OverlayBox
{
    x: number
    y: number
    width: number
    rotation: number
    /** 0..1 */
    opacity: number
}

/** Ключ геометрии наложения: время от начала элемента. */
export interface BoxKeyframe extends OverlayBox
{
    t: number
}

export type TransitionKind =
    | 'fade'
    | 'dissolve'
    | 'wipeleft'
    | 'wiperight'
    | 'wipeup'
    | 'wipedown'
    | 'slideleft'
    | 'slideright'
    | 'circleopen'

export type TextAnimation = 'none' | 'fade' | 'pop'

export interface ItemBase
{
    id: Id
    /** Начало на таймлайне проекта, сек. */
    start: number
    /** Длительность на таймлайне, сек. */
    duration: number
}

export interface MediaItem extends ItemBase
{
    kind: 'media'
    assetId: Id
    /** Смещение внутри исходного файла, сек. У картинки всегда 0. */
    offset: number
    /** Кадрирование, когда элемент лежит на дорожке содержимого. */
    frame: FrameKeyframe[]
    /** Геометрия, когда элемент лежит на дорожке наложений. */
    box: OverlayBox
    /** Ключи геометрии; пустой список — неподвижное наложение. */
    boxKeys: BoxKeyframe[]
    /** Громкость 0..2. */
    volume: number
    fadeIn: number
    fadeOut: number
    /** Переход при наезде на предыдущий элемент дорожки содержимого. */
    transition: TransitionKind
}

export interface TextItem extends ItemBase
{
    kind: 'text'
    text: string
    /** Позиция центра, доли ширины и высоты кадра. */
    x: number
    y: number
    /** Кегль в пикселях кадра экспорта. */
    size: number
    color: string
    outline: string
    animation: TextAnimation
}

export type Item = MediaItem | TextItem

export interface Track
{
    id: Id
    kind: TrackKind
    name: string
    /** Скрытая дорожка не идёт ни в превью, ни в экспорт. */
    hidden: boolean
    muted: boolean
    items: Item[]
}

export interface ColorGrade
{
    /** -1..1 */
    brightness: number
    /** 0..2, нейтраль 1 */
    contrast: number
    /** 0..3, нейтраль 1 */
    saturation: number
    /** 0.1..10, нейтраль 1 */
    gamma: number
    /** -2..2, нейтраль 0 */
    vibrance: number
    /** 0..3, нейтраль 0 */
    sharpen: number
}

/** Ключ цветокора: время от начала проекта. */
export interface ColorKeyframe extends ColorGrade
{
    t: number
}

export interface AudioChain
{
    /** 0..1, 0 — выключено */
    denoise: number
    highpass: boolean
    compressor: boolean
    /** Целевая громкость LUFS, 0 — выключено */
    loudness: number
}

export interface SubtitleCue
{
    id: Id
    start: number
    end: number
    text: string
}

export type SubtitlePreset = 'bold' | 'clean' | 'yellow'

export interface Subtitles
{
    preset: SubtitlePreset
    /** Позиция строки по вертикали, доля высоты кадра. */
    y: number
    cues: SubtitleCue[]
}

export interface Project
{
    version: 2
    id: Id
    name: string
    output: OutputSpec
    tracks: Track[]
    color: ColorGrade
    /** Ключи цвета по шкале проекта; пустой список — неподвижный цветокор. */
    colorKeys: ColorKeyframe[]
    audio: AudioChain
    subtitles: Subtitles
}

export type AssetStatus = 'processing' | 'ready' | 'error'

export interface MediaAsset
{
    id: Id
    kind: MediaKind
    name: string
    path: string
    /** Для картинки 0: длительность задаёт элемент на таймлайне. */
    duration: number
    width: number
    height: number
    fps: number
    videoCodec: string | null
    audioCodec: string | null
    status: AssetStatus
    error?: string
    /** Размер уменьшенной копии, чтобы пересчитывать координаты окна. */
    proxy?: { width: number; height: number }
    thumbs?: { count: number; fps: number }
    /** Пики громкости 0..255, PEAKS_PER_SECOND значений в секунду. */
    peaks?: number[]
}

export const PEAKS_PER_SECOND = 50

/** Короче этого элементы не режутся и не тянутся. */
export const MIN_ITEM_SECONDS = 0.1

/** Сколько длится картинка, когда её кладут на таймлайн, и до скольких её можно растянуть. */
export const IMAGE_SECONDS = 5
export const IMAGE_MAX_SECONDS = 3600

export const DEFAULT_OUTPUT: OutputSpec =
{
    width: 1080,
    height: 1920,
    fps: 60,
    codec: 'h264',
    quality: 23,
}

export const NEUTRAL_COLOR: ColorGrade =
{
    brightness: 0,
    contrast: 1,
    saturation: 1,
    gamma: 1,
    vibrance: 0,
    sharpen: 0,
}

export const SILENT_AUDIO: AudioChain =
{
    denoise: 0,
    highpass: false,
    compressor: false,
    loudness: 0,
}

export const DEFAULT_BOX: OverlayBox =
{
    x: 0.5,
    y: 0.5,
    width: 0.4,
    rotation: 0,
    opacity: 1,
}

export function isMediaItem(item: Item): item is MediaItem
{
    return item.kind === 'media'
}

export function isTextItem(item: Item): item is TextItem
{
    return item.kind === 'text'
}

export function itemEnd(item: Item): number
{
    return item.start + item.duration
}

export function createTrack(kind: TrackKind, name: string): Track
{
    return {
        id: crypto.randomUUID(),
        kind,
        name,
        hidden: false,
        muted: false,
        items: [],
    }
}

export function createProject(id: Id, name = 'Без названия'): Project
{
    return {
        version: 2,
        id,
        name,
        output: { ...DEFAULT_OUTPUT },
        tracks: [
            createTrack('content', 'Содержимое'),
            createTrack('overlay', 'Наложения'),
            createTrack('audio', 'Звук'),
        ],
        color: { ...NEUTRAL_COLOR },
        colorKeys: [],
        audio: { ...SILENT_AUDIO },
        subtitles: { preset: 'bold', y: 0.8, cues: [] },
    }
}
