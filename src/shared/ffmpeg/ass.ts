// Генератор ASS-файла: субтитры и текстовые слои в одном файле для фильтра `ass`.

import type { Project, SubtitleCue, TextItem } from '@shared/model'
import { isTextItem, itemEnd } from '@shared/model'
import { SUBTITLE_STYLES, TEXT_FONT } from '@shared/presets'

/** Цвет #RGB или #RRGGBB в формат ASS &HAABBGGRR. */
export function assColor(hex: string, alpha = 0): string
{
    let clean = hex.replace('#', '').toLowerCase()
    if (clean.length === 3) clean = clean.replace(/./g, (c) => c + c)
    clean = clean.padEnd(6, '0').slice(0, 6)
    const r = clean.slice(0, 2)
    const g = clean.slice(2, 4)
    const b = clean.slice(4, 6)
    const a = alpha.toString(16).padStart(2, '0')
    return `&H${a}${b}${g}${r}`.toUpperCase()
}

export function assTime(seconds: number): string
{
    const total = Math.max(0, Math.round(seconds * 100))
    const cs = total % 100
    const s = Math.floor(total / 100)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function assText(text: string): string
{
    return text.replace(/[{}]/g, '').replace(/\r?\n/g, '\\N')
}

const ANIMATION_TAGS =
{
    none: '',
    fade: '\\fad(150,150)',
    pop: '\\fscx60\\fscy60\\t(0,120,\\fscx100\\fscy100)',
} as const

function textItemLine(layer: TextItem, width: number, height: number): string
{
    const x = Math.round(layer.x * width)
    const y = Math.round(layer.y * height)
    const tags = [
        '\\an5',
        `\\pos(${x},${y})`,
        `\\fs${Math.round(layer.size)}`,
        `\\c${assColor(layer.color)}`,
        `\\3c${assColor(layer.outline)}`,
        `\\bord${Math.max(2, Math.round(layer.size / 18))}`,
        ANIMATION_TAGS[layer.animation],
    ].join('')
    return `Dialogue: 1,${assTime(layer.start)},${assTime(itemEnd(layer))},Text,,0,0,0,,{${tags}}${assText(layer.text)}`
}

function cueLine(
    cue: SubtitleCue,
    width: number,
    height: number,
    y: number,
): string
{
    const px = Math.round(width / 2)
    const py = Math.round(y * height)
    return `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Sub,,0,0,0,,{\\an5\\pos(${px},${py})}${assText(cue.text)}`
}

/** Текстовые элементы всех видимых дорожек по порядку. */
export function textItems(project: Project): TextItem[]
{
    return project.tracks
        .filter((track) => !track.hidden)
        .flatMap((track) => track.items.filter(isTextItem))
        .sort((a, b) => a.start - b.start)
}

export function hasOverlays(project: Project): boolean
{
    return textItems(project).length > 0 || project.subtitles.cues.length > 0
}

export function buildAss(project: Project): string
{
    const { width, height } = project.output
    const sub = SUBTITLE_STYLES[project.subtitles.preset]
    const bold = sub.bold ? -1 : 0
    const header = [
        '[Script Info]',
        'ScriptType: v4.00+',
        `PlayResX: ${width}`,
        `PlayResY: ${height}`,
        'WrapStyle: 0',
        'ScaledBorderAndShadow: yes',
        '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        `Style: Sub,${TEXT_FONT},${sub.fontSize},${assColor(sub.color)},${assColor(sub.color)},${assColor(sub.outline)},${assColor('#000000', 128)},${bold},0,0,0,100,100,0,0,1,${sub.outlineWidth},0,5,40,40,40,1`,
        `Style: Text,${TEXT_FONT},64,${assColor('#ffffff')},${assColor('#ffffff')},${assColor('#000000')},${assColor('#000000', 128)},-1,0,0,0,100,100,0,0,1,4,0,5,40,40,40,1`,
        '',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ]
    const cues = project.subtitles.cues.map((cue) =>
        cueLine(cue, width, height, project.subtitles.y),
    )
    const texts = textItems(project).map((layer) =>
        textItemLine(layer, width, height),
    )
    return [...header, ...cues, ...texts, ''].join('\n')
}
