// Заготовки для тестов: файл, элемент и проект с дорожками.

import {
    createProject,
    DEFAULT_BOX,
    type MediaAsset,
    type MediaItem,
    type Project,
    type TextItem,
    type Track,
    type TrackKind,
} from '@core/model'

export const videoAsset: MediaAsset =
{
    id: 'a1',
    kind: 'video',
    name: 'clip.mp4',
    path: 'E:/clip.mp4',
    duration: 30,
    width: 1728,
    height: 1080,
    fps: 60,
    videoCodec: 'hevc',
    audioCodec: 'aac',
    status: 'ready',
}

export const imageAsset: MediaAsset =
{
    id: 'i1',
    kind: 'image',
    name: 'logo.png',
    path: 'E:/logo.png',
    duration: 0,
    width: 512,
    height: 512,
    fps: 30,
    videoCodec: 'png',
    audioCodec: null,
    status: 'ready',
}

export const musicAsset: MediaAsset =
{
    id: 'm1',
    kind: 'audio',
    name: 'track.mp3',
    path: 'E:/track.mp3',
    duration: 60,
    width: 0,
    height: 0,
    fps: 30,
    videoCodec: null,
    audioCodec: 'mp3',
    status: 'ready',
}

export function item(patch: Partial<MediaItem> = {}): MediaItem
{
    return {
        kind: 'media',
        id: 'x',
        assetId: videoAsset.id,
        start: 0,
        duration: 5,
        offset: 0,
        frame: [],
        box: { ...DEFAULT_BOX },
        boxKeys: [],
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        transition: 'fade',
        ...patch,
    }
}

export function text(patch: Partial<TextItem> = {}): TextItem
{
    return {
        kind: 'text',
        id: 't',
        start: 0,
        duration: 2,
        text: 'Текст',
        x: 0.5,
        y: 0.2,
        size: 64,
        color: '#ffffff',
        outline: '#000000',
        animation: 'none',
        ...patch,
    }
}

export function track(kind: TrackKind, items: Track['items']): Track
{
    return {
        id: `${kind}-track`,
        kind,
        name: kind,
        hidden: false,
        muted: false,
        items,
    }
}

/** Проект из готовых дорожек: порядок как в редакторе — содержимое, наложения, звук. */
export function project(tracks: Track[]): Project
{
    return { ...createProject('p'), tracks }
}

export const assetMap = new Map<string, MediaAsset>([
    [videoAsset.id, videoAsset],
    [imageAsset.id, imageAsset],
    [musicAsset.id, musicAsset],
])
