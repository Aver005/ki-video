// Сборка аргументов ffmpeg для экспорта проекта. Чистая функция: удобно тестировать.

import type {
    MediaAsset,
    MediaItem,
    OutputSpec,
    Project,
    Track,
    VideoCodec,
} from '@core/model'
import { isMediaItem } from '@core/model'
import {
    contentSegments,
    projectDuration,
    sortedItems,
    TIME_EPSILON,
    type ContentSegment,
} from '@core/timeline'
import {
    AUDIO_FORMAT,
    VIDEO_FORMAT,
    audioFilters,
    colorFilters,
    frameFilters,
    itemAudioFilters,
    overlayFilters,
} from '@core/ffmpeg/filters'
import { num } from '@core/math'

export interface EncoderCaps
{
    /** Имя кодировщика ffmpeg для каждого кодека. */
    encoders: Record<VideoCodec, string>
    /** Аппаратный декодер, если есть. */
    hwaccel: 'cuda' | null
}

export const SOFTWARE_CAPS: EncoderCaps =
{
    encoders: { h264: 'libx264', hevc: 'libx265' },
    hwaccel: null,
}

/** Имя файла с графом в рабочей папке задания: командная строка Windows ограничена 32 767 символами. */
export const GRAPH_FILE = 'graph.txt'

/** Чтение значения из файла: `-filter_complex_script` убрали в ffmpeg 9, эта запись работает с 7.0. */
export const GRAPH_OPTION = '-/filter_complex'

export interface ExportPlan
{
    args: string[]
    /** Содержимое filter_complex; сервер кладёт его в GRAPH_FILE. */
    graph: string
    assFile: string | null
    duration: number
}

export class ExportError extends Error {}

function encoderArgs(
    codec: VideoCodec,
    encoder: string,
    quality: number,
): string[]
{
    const tag = codec === 'hevc' ? ['-tag:v', 'hvc1'] : []
    if (encoder.endsWith('_nvenc'))
    {
        return [
            '-c:v',
            encoder,
            '-preset',
            'p4',
            '-tune',
            'hq',
            '-rc',
            'vbr',
            '-cq',
            String(quality),
            '-b:v',
            '0',
            ...tag,
        ]
    }
    if (encoder === 'libx265')
        return [
            '-c:v',
            encoder,
            '-preset',
            'fast',
            '-crf',
            String(quality),
            ...tag,
        ]
    return ['-c:v', encoder, '-preset', 'veryfast', '-crf', String(quality)]
}

function inputArgs(
    item: MediaItem,
    asset: MediaAsset,
    caps: EncoderCaps,
    output: OutputSpec,
): string[]
{
    if (asset.kind === 'image')
    {
        return [
            '-loop',
            '1',
            '-framerate',
            String(output.fps),
            '-t',
            num(item.duration, 3),
            '-i',
            asset.path,
        ]
    }
    const hwaccel =
        caps.hwaccel && asset.kind === 'video' ? ['-hwaccel', caps.hwaccel] : []
    return [
        ...hwaccel,
        '-ss',
        num(item.offset, 3),
        '-t',
        num(item.duration, 3),
        '-i',
        asset.path,
    ]
}

/** Переходы на дорожке содержимого дают и звуковой кроссфейд: наезд гасит один и вводит другой. */
function crossfades(
    segments: readonly ContentSegment[],
): Map<string, { in: number; out: number }>
{
    const fades = new Map<string, { in: number; out: number }>()
    const get = (id: string) =>
        fades.get(id) ?? fades.set(id, { in: 0, out: 0 }).get(id)!
    segments.forEach((segment, index) =>
    {
        if (segment.overlap <= TIME_EPSILON || !segment.item) return
        get(segment.item.id).in = segment.overlap
        const previous = segments[index - 1]?.item
        if (previous) get(previous.id).out = segment.overlap
    })
    return fades
}

class GraphBuilder
{
    readonly inputs: string[] = []
    readonly lines: string[] = []
    readonly audioLabels: string[] = []
    private inputCount = 0
    private readonly indexes = new Map<string, number>()

    constructor(
        private readonly assets: ReadonlyMap<string, MediaAsset>,
        private readonly caps: EncoderCaps,
        private readonly output: OutputSpec,
    )
    {}

    asset(item: MediaItem): MediaAsset
    {
        const asset = this.assets.get(item.assetId)
        if (!asset) throw new ExportError(`Файл элемента не найден`)
        if (asset.status !== 'ready')
            throw new ExportError(`Файл ещё готовится: ${asset.name}`)
        if (
            asset.kind !== 'image' &&
            item.offset + item.duration > asset.duration + 0.05
        )
            throw new ExportError(`Элемент длиннее исходника: ${asset.name}`)
        return asset
    }

    /** Один вход ffmpeg на элемент: и картинка, и звук берутся из него. */
    input(item: MediaItem, asset: MediaAsset): number
    {
        const known = this.indexes.get(item.id)
        if (known !== undefined) return known
        this.inputs.push(...inputArgs(item, asset, this.caps, this.output))
        const index = this.inputCount
        this.inputCount += 1
        this.indexes.set(item.id, index)
        return index
    }

    line(value: string): void
    {
        this.lines.push(value)
    }

    audio(
        index: number,
        item: MediaItem,
        fadeIn: number,
        fadeOut: number,
    ): void
    {
        const label = `am${this.audioLabels.length}`
        this.line(
            `[${index}:a]${itemAudioFilters(item, fadeIn, fadeOut).join(',')}[${label}]`,
        )
        this.audioLabels.push(label)
    }
}

/** Базовая лента: куски дорожки содержимого, зазоры чёрным, наезды через xfade. */
function buildBase(
    builder: GraphBuilder,
    segments: readonly ContentSegment[],
    output: OutputSpec,
    fades: ReadonlyMap<string, { in: number; out: number }>,
    muted: boolean,
): string
{
    const labels:
    {
        label: string
        duration: number
        overlap: number
        transition: string
    }[] = []
    segments.forEach((segment, i) =>
    {
        const label = `bs${i}`
        if (!segment.item)
        {
            builder.line(
                `color=c=black:s=${output.width}x${output.height}:r=${output.fps}:d=${num(segment.duration, 3)},${VIDEO_FORMAT}[${label}]`,
            )
        }
        else
        {
            const item = segment.item
            const asset = builder.asset(item)
            const index = builder.input(item, asset)
            const chain = [
                ...frameFilters(item, asset, output),
                VIDEO_FORMAT,
                'setpts=PTS-STARTPTS',
            ]
            builder.line(`[${index}:v]${chain.join(',')}[${label}]`)
            if (asset.audioCodec && !muted && item.volume > 0)
            {
                const fade = fades.get(item.id)
                builder.audio(
                    index,
                    item,
                    Math.max(item.fadeIn, fade?.in ?? 0),
                    Math.max(item.fadeOut, fade?.out ?? 0),
                )
            }
        }
        labels.push(
        {
            label,
            duration: segment.duration,
            overlap: segment.overlap,
            transition: segment.item?.transition ?? 'fade',
        })
    })

    const first = labels[0]
    if (!first) throw new ExportError('Нечего показывать')
    let current = first.label
    let covered = first.duration
    for (let i = 1; i < labels.length; i += 1)
    {
        const next = labels[i]
        if (!next) break
        const label = `bx${i}`
        if (next.overlap > TIME_EPSILON)
        {
            builder.line(
                `[${current}][${next.label}]xfade=transition=${next.transition}:duration=${num(next.overlap, 3)}:offset=${num(covered - next.overlap, 3)}[${label}]`,
            )
            covered += next.duration - next.overlap
        }
        else
        {
            builder.line(
                `[${current}][${next.label}]concat=n=2:v=1:a=0[${label}]`,
            )
            covered += next.duration
        }
        current = label
    }
    return current
}

/** Наложения поверх базы: каждое со своей геометрией, прозрачностью и окном показа. */
function buildOverlays(
    builder: GraphBuilder,
    tracks: readonly Track[],
    output: OutputSpec,
    base: string,
): string
{
    let current = base
    let counter = 0
    for (const track of tracks)
    {
        for (const item of sortedItems(track))
        {
            if (!isMediaItem(item)) continue
            const asset = builder.asset(item)
            const index = builder.input(item, asset)
            if (asset.kind !== 'audio')
            {
                const placement = overlayFilters(item, asset, output)
                const layer = `ov${counter}`
                const next = `bo${counter}`
                builder.line(
                    `[${index}:v]${placement.filters.join(',')}[${layer}]`,
                )
                builder.line(
                    `[${current}][${layer}]overlay=x='${placement.x}':y='${placement.y}':eof_action=pass:enable='between(t,${num(item.start, 3)},${num(item.start + item.duration, 3)})'[${next}]`,
                )
                current = next
                counter += 1
            }
            if (asset.audioCodec && !track.muted && item.volume > 0)
                builder.audio(index, item, item.fadeIn, item.fadeOut)
        }
    }
    return current
}

function buildAudioTracks(
    builder: GraphBuilder,
    tracks: readonly Track[],
): void
{
    for (const track of tracks)
    {
        if (track.muted) continue
        for (const item of sortedItems(track))
        {
            if (!isMediaItem(item)) continue
            const asset = builder.asset(item)
            if (!asset.audioCodec || item.volume <= 0) continue
            const index = builder.input(item, asset)
            builder.audio(index, item, item.fadeIn, item.fadeOut)
        }
    }
}

export function buildExportPlan(
    project: Project,
    assets: ReadonlyMap<string, MediaAsset>,
    caps: EncoderCaps,
    outFile: string,
    assFile: string | null,
): ExportPlan
{
    const duration = projectDuration(project)
    if (duration <= 0) throw new ExportError('В проекте нечего экспортировать')
    const output = project.output
    const visible = project.tracks.filter((track) => !track.hidden)
    const content = visible.find((track) => track.kind === 'content')
    const segments = contentSegments(content, duration)
    const builder = new GraphBuilder(assets, caps, output)

    const base = buildBase(
        builder,
        segments,
        output,
        crossfades(segments),
        content?.muted ?? true,
    )
    const graded = colorFilters(project.color, project.colorKeys)
    const colored = `bc`
    builder.line(`[${base}]${[...graded, 'copy'].join(',')}[${colored}]`)

    const withOverlays = buildOverlays(
        builder,
        visible.filter((track) => track.kind === 'overlay'),
        output,
        colored,
    )
    buildAudioTracks(
        builder,
        visible.filter((track) => track.kind === 'audio'),
    )

    const videoTail = assFile ? [`ass=${assFile}`] : []
    builder.line(`[${withOverlays}]${[...videoTail, 'copy'].join(',')}[vo]`)

    const mixed = 'amixed'
    if (builder.audioLabels.length === 0)
    {
        builder.line(
            `anullsrc=r=48000:cl=stereo,atrim=0:${num(duration, 3)}[${mixed}]`,
        )
    }
    else if (builder.audioLabels.length === 1)
    {
        builder.line(`[${builder.audioLabels[0]}]${AUDIO_FORMAT}[${mixed}]`)
    }
    else
    {
        builder.line(
            `${builder.audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${builder.audioLabels.length}:normalize=0:dropout_transition=0[${mixed}]`,
        )
    }
    builder.line(
        `[${mixed}]${[...audioFilters(project.audio), 'acopy'].join(',')}[ao]`,
    )

    const args = [
        '-hide_banner',
        '-y',
        '-nostats',
        '-loglevel',
        'error',
        '-progress',
        'pipe:1',
        ...builder.inputs,
        GRAPH_OPTION,
        GRAPH_FILE,
        '-map',
        '[vo]',
        '-map',
        '[ao]',
        '-t',
        num(duration, 3),
        ...encoderArgs(
            output.codec,
            caps.encoders[output.codec],
            output.quality,
        ),
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(output.fps),
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-ar',
        '48000',
        '-movflags',
        '+faststart',
        outFile,
    ]
    return { args, graph: builder.lines.join(';\n'), assFile, duration }
}
