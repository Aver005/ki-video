// Пресеты: цвет, звук, текст, субтитры. Одни данные для интерфейса, превью и экспорта.

import type {
    AudioChain,
    ColorGrade,
    SubtitlePreset,
    TextAnimation,
    TransitionKind,
} from '@shared/model'
import { NEUTRAL_COLOR, SILENT_AUDIO } from '@shared/model'

export interface Preset<T>
{
    id: string
    label: string
    value: T
}

export const COLOR_PRESETS: readonly Preset<ColorGrade>[] = [
    { id: 'neutral', label: 'Нейтрально', value: { ...NEUTRAL_COLOR } },
    {
        id: 'punchy',
        label: 'Сочно',
        value:
        {
            brightness: 0.02,
            contrast: 1.15,
            saturation: 1.3,
            gamma: 1,
            vibrance: 0.3,
            sharpen: 0.6,
        },
    },
    {
        id: 'cinema',
        label: 'Кино',
        value:
        {
            brightness: -0.03,
            contrast: 1.2,
            saturation: 0.9,
            gamma: 0.95,
            vibrance: 0.1,
            sharpen: 0.3,
        },
    },
    {
        id: 'bright',
        label: 'Светло',
        value:
        {
            brightness: 0.08,
            contrast: 1.05,
            saturation: 1.1,
            gamma: 1.1,
            vibrance: 0.15,
            sharpen: 0.2,
        },
    },
    {
        id: 'cool',
        label: 'Холодно',
        value:
        {
            brightness: 0,
            contrast: 1.1,
            saturation: 0.8,
            gamma: 1,
            vibrance: -0.2,
            sharpen: 0.4,
        },
    },
    {
        id: 'mono',
        label: 'Ч/Б',
        value:
        {
            brightness: 0,
            contrast: 1.2,
            saturation: 0,
            gamma: 1,
            vibrance: 0,
            sharpen: 0.5,
        },
    },
]

export const AUDIO_PRESETS: readonly Preset<AudioChain>[] = [
    { id: 'raw', label: 'Как есть', value: { ...SILENT_AUDIO } },
    {
        id: 'voice',
        label: 'Голос чисто',
        value:
        {
            denoise: 0.6,
            highpass: true,
            compressor: true,
            loudness: -14,
        },
    },
    {
        id: 'game',
        label: 'Игра громко',
        value:
        {
            denoise: 0.2,
            highpass: false,
            compressor: true,
            loudness: -12,
        },
    },
    {
        id: 'soft',
        label: 'Мягко',
        value:
        {
            denoise: 0.3,
            highpass: true,
            compressor: false,
            loudness: -16,
        },
    },
]

export interface TextStyle
{
    size: number
    color: string
    outline: string
    animation: TextAnimation
}

export const TEXT_PRESETS: readonly Preset<TextStyle>[] = [
    {
        id: 'title',
        label: 'Заголовок',
        value:
        {
            size: 96,
            color: '#ffffff',
            outline: '#000000',
            animation: 'pop',
        },
    },
    {
        id: 'caption',
        label: 'Подпись',
        value:
        {
            size: 56,
            color: '#ffffff',
            outline: '#000000',
            animation: 'fade',
        },
    },
    {
        id: 'accent',
        label: 'Акцент',
        value:
        {
            size: 84,
            color: '#ffe600',
            outline: '#1a1a1a',
            animation: 'pop',
        },
    },
]

export interface SubtitleStyle
{
    label: string
    fontSize: number
    color: string
    outline: string
    /** Толщина обводки в пикселях кадра. */
    outlineWidth: number
    bold: boolean
}

export const SUBTITLE_STYLES: Record<SubtitlePreset, SubtitleStyle> =
{
    bold:
    {
        label: 'Жирные',
        fontSize: 72,
        color: '#ffffff',
        outline: '#000000',
        outlineWidth: 4,
        bold: true,
    },
    clean:
    {
        label: 'Тонкие',
        fontSize: 56,
        color: '#ffffff',
        outline: '#000000',
        outlineWidth: 2,
        bold: false,
    },
    yellow:
    {
        label: 'Жёлтые',
        fontSize: 72,
        color: '#ffe600',
        outline: '#000000',
        outlineWidth: 4,
        bold: true,
    },
}

export const TRANSITIONS: readonly Preset<TransitionKind>[] = [
    { id: 'fade', label: 'Плавно', value: 'fade' },
    { id: 'dissolve', label: 'Растворение', value: 'dissolve' },
    { id: 'wipeleft', label: 'Шторка влево', value: 'wipeleft' },
    { id: 'wiperight', label: 'Шторка вправо', value: 'wiperight' },
    { id: 'wipeup', label: 'Шторка вверх', value: 'wipeup' },
    { id: 'wipedown', label: 'Шторка вниз', value: 'wipedown' },
    { id: 'slideleft', label: 'Сдвиг влево', value: 'slideleft' },
    { id: 'slideright', label: 'Сдвиг вправо', value: 'slideright' },
    { id: 'circleopen', label: 'Круг', value: 'circleopen' },
]

export const TEXT_FONT = 'Arial'
