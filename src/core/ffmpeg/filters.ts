// Фильтры ffmpeg для элементов таймлайна и для итоговых дорожек. Только чистые функции.

import type {
    AudioChain,
    BoxKeyframe,
    ColorGrade,
    ColorKeyframe,
    FrameKeyframe,
    MediaAsset,
    MediaItem,
    OutputSpec,
    OverlayBox,
} from '@core/model'
import { NEUTRAL_COLOR } from '@core/model'
import {
    baseWindow,
    defaultFrame,
    evenCeil,
    evenFloor,
    MAX_ZOOM,
    MIN_ZOOM,
} from '@core/frame'
import { keyPoints, varies } from '@core/keys'
import { clamp, num } from '@core/math'
import { clipExpr, piecewiseLinear, type TimePoint } from '@core/ffmpeg/expr'

function points(
    keyframes: readonly FrameKeyframe[],
    pickValue: (k: FrameKeyframe) => number,
): TimePoint[]
{
    return keyframes.map((k) => ({ t: k.t, v: pickValue(k) }))
}

/** Цепочка кадрирования: холст под отдаление → crop с панорамой по t → scale → zoompan для зума. */
export function frameFilters(
    item: MediaItem,
    asset: MediaAsset,
    output: OutputSpec,
): string[]
{
    const source = { width: asset.width, height: asset.height }
    const base = baseWindow(source, output)
    const keyframes =
        item.frame.length > 0 ? item.frame : [{ t: 0, ...defaultFrame(source) }]
    const zooms = keyframes.map((k) => clamp(k.zoom, MIN_ZOOM, MAX_ZOOM))

    // Режем по самому дальнему плану: дальше zoompan только приближает.
    const far = Math.min(1, ...zooms)
    const window =
    {
        width: evenFloor(base.width / far),
        height: evenFloor(base.height / far),
    }
    const wide = window.width > source.width || window.height > source.height
    const canvas = wide
        ?
          {
              width: evenCeil(Math.max(source.width, window.width)),
              height: evenCeil(Math.max(source.height, window.height)),
          }
        : source
    const offset =
    {
        x: evenFloor((canvas.width - source.width) / 2),
        y: evenFloor((canvas.height - source.height) / 2),
    }

    const filters = [`fps=${output.fps}`]
    // При отдалении окно шире исходника, поэтому исходник кладём на чёрный холст.
    if (wide)
    {
        filters.push(
            `pad=${canvas.width}:${canvas.height}:${offset.x}:${offset.y}:black`,
        )
    }

    const shifted = (k: FrameKeyframe, axis: 'cx' | 'cy') =>
        k[axis] + (axis === 'cx' ? offset.x : offset.y)
    const cx = piecewiseLinear(
        points(keyframes, (k) => shifted(k, 'cx')),
        't',
    )
    const cy = piecewiseLinear(
        points(keyframes, (k) => shifted(k, 'cy')),
        't',
    )
    const x = clipExpr(
        `${cx}-${num(window.width / 2)}`,
        0,
        canvas.width - window.width,
    )
    const y = clipExpr(
        `${cy}-${num(window.height / 2)}`,
        0,
        canvas.height - window.height,
    )
    // exact=1: без округления x/y к чётным пикселям панорама идёт плавно.
    filters.push(
        `crop=${window.width}:${window.height}:'${x}':'${y}':exact=1`,
        `scale=${output.width}:${output.height}:flags=bicubic`,
    )

    const hasZoom = zooms.some((z) => z > far * 1.0001)
    if (hasZoom)
    {
        const zoom = clipExpr(
            piecewiseLinear(
                points(
                    keyframes,
                    (k) => clamp(k.zoom, MIN_ZOOM, MAX_ZOOM) / far,
                ),
                'it',
            ),
            1,
            MAX_ZOOM / far,
        )
        const sx = output.width / window.width
        const sy = output.height / window.height
        const cxIt = piecewiseLinear(
            points(keyframes, (k) => shifted(k, 'cx')),
            'it',
        )
        const cyIt = piecewiseLinear(
            points(keyframes, (k) => shifted(k, 'cy')),
            'it',
        )
        const baseX = clipExpr(
            `${cxIt}-${num(window.width / 2)}`,
            0,
            canvas.width - window.width,
        )
        const baseY = clipExpr(
            `${cyIt}-${num(window.height / 2)}`,
            0,
            canvas.height - window.height,
        )
        const centerX = `(${cxIt}-${baseX})*${num(sx)}`
        const centerY = `(${cyIt}-${baseY})*${num(sy)}`
        const zx = `clip(${centerX}-iw/zoom/2,0,iw-iw/zoom)`
        const zy = `clip(${centerY}-ih/zoom/2,0,ih-ih/zoom)`
        filters.push(
            `zoompan=z='${zoom}':x='${zx}':y='${zy}':d=1:s=${output.width}x${output.height}:fps=${output.fps}`,
        )
    }
    return filters
}

function evenRound(value: number): number
{
    return Math.max(2, Math.round(value / 2) * 2)
}

export interface OverlayPlacement
{
    filters: string[]
    /** Выражения overlay для левого верхнего угла: считаются по времени базы. */
    x: string
    y: string
}

function sourceRatio(asset: Pick<MediaAsset, 'width' | 'height'>): number
{
    return asset.width > 0 ? asset.height / asset.width : 1
}

/** Размер наложения в пикселях кадра: ширина из доли, высота по пропорциям источника. */
export function overlaySize(
    box: OverlayBox,
    asset: Pick<MediaAsset, 'width' | 'height'>,
    output: OutputSpec,
): { width: number; height: number }
{
    const width = evenRound(box.width * output.width)
    return { width, height: evenRound(width * sourceRatio(asset)) }
}

/** Габарит после поворота: описанный прямоугольник. */
export function rotatedSize(
    size: { width: number; height: number },
    degrees: number,
): { width: number; height: number }
{
    const a = radians(degrees)
    const cos = Math.abs(Math.cos(a))
    const sin = Math.abs(Math.sin(a))
    return {
        width: Math.round(size.width * cos + size.height * sin),
        height: Math.round(size.width * sin + size.height * cos),
    }
}

function radians(degrees: number): number
{
    return (degrees * Math.PI) / 180
}

/** Масштаб: неподвижный размер или выражение по времени с чётными сторонами. */
function scaleFilter(
    keys: readonly BoxKeyframe[],
    asset: MediaAsset,
    output: OutputSpec,
    first: BoxKeyframe,
): string
{
    if (!varies(keys, (k) => k.width))
    {
        const size = overlaySize(first, asset, output)
        return `scale=${size.width}:${size.height}:flags=bicubic`
    }
    const width = piecewiseLinear(
        keyPoints(keys, (k) => k.width),
        't',
    )
    // Ниже двух пикселей scale не принимает размер, поэтому пол при крошечной ширине.
    const w = `max(2,2*trunc((${width})*${output.width}/2))`
    const h = `max(2,2*trunc((${width})*${num(output.width * sourceRatio(asset))}/2))`
    return `scale=w='${w}':h='${h}':eval=frame:flags=bicubic`
}

/** Поворот: при анимации выходной кадр берём по диагонали, иначе углы срежет. */
function rotateFilter(
    keys: readonly BoxKeyframe[],
    first: BoxKeyframe,
): string | null
{
    if (varies(keys, (k) => k.rotation))
    {
        const angle = piecewiseLinear(
            keyPoints(keys, (k) => radians(k.rotation)),
            't',
        )
        // Запятые в значении ломают разбор, а c=none не чистит буфер: углы накапливаются кадр за кадром.
        return `rotate=a='${angle}':c=black@0:ow='hypot(iw,ih)':oh='hypot(iw,ih)'`
    }
    if (Math.abs(first.rotation) <= 0.01) return null
    const a = num(radians(first.rotation), 5)
    return `rotate=${a}:c=black@0:ow='rotw(${a})':oh='roth(${a})'`
}

/** Прозрачность: постоянная — дешёвым фильтром, по ключам — попиксельно через geq. */
function opacityFilter(
    keys: readonly BoxKeyframe[],
    first: BoxKeyframe,
): string | null
{
    if (varies(keys, (k) => k.opacity))
    {
        const alpha = piecewiseLinear(
            keyPoints(keys, (k) => k.opacity),
            'T',
        )
        return `geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='alpha(X,Y)*(${alpha})'`
    }
    return first.opacity < 0.999
        ? `colorchannelmixer=aa=${num(first.opacity)}`
        : null
}

/** Цепочка наложения: масштаб, поворот по прозрачному фону, прозрачность, фейды, сдвиг во времени. */
export function overlayFilters(
    item: MediaItem,
    asset: MediaAsset,
    output: OutputSpec,
): OverlayPlacement
{
    const keys: BoxKeyframe[] =
        item.boxKeys.length > 0 ? item.boxKeys : [{ t: 0, ...item.box }]
    const first = keys[0] ?? { t: 0, ...item.box }
    const filters = [
        `fps=${output.fps}`,
        scaleFilter(keys, asset, output, first),
        'format=yuva420p',
    ]
    const rotate = rotateFilter(keys, first)
    if (rotate) filters.push(rotate)
    const opacity = opacityFilter(keys, first)
    if (opacity) filters.push(opacity)
    if (item.fadeIn > 0.01)
        filters.push(`fade=t=in:st=0:d=${num(item.fadeIn, 3)}:alpha=1`)
    if (item.fadeOut > 0.01)
    {
        const at = Math.max(0, item.duration - item.fadeOut)
        filters.push(
            `fade=t=out:st=${num(at, 3)}:d=${num(item.fadeOut, 3)}:alpha=1`,
        )
    }
    filters.push(`setpts=PTS-STARTPTS+${num(item.start, 3)}/TB`)
    // w и h внутри overlay — размер наложения на текущем кадре, поэтому центр держится сам.
    const x = piecewiseLinear(
        keyPoints(keys, (k) => k.x, item.start),
        't',
    )
    const y = piecewiseLinear(
        keyPoints(keys, (k) => k.y, item.start),
        't',
    )
    return { filters, x: `(${x})*W-w/2`, y: `(${y})*H-h/2` }
}

/** Звук одного элемента: громкость, фейды, сдвиг к своему месту на таймлайне. */
export function itemAudioFilters(
    item: MediaItem,
    fadeIn: number,
    fadeOut: number,
): string[]
{
    const filters = [AUDIO_FORMAT]
    if (Math.abs(item.volume - 1) > 0.001)
        filters.push(`volume=${num(item.volume)}`)
    if (fadeIn > 0.01) filters.push(`afade=t=in:st=0:d=${num(fadeIn, 3)}`)
    if (fadeOut > 0.01)
    {
        const at = Math.max(0, item.duration - fadeOut)
        filters.push(`afade=t=out:st=${num(at, 3)}:d=${num(fadeOut, 3)}`)
    }
    const delay = Math.round(item.start * 1000)
    if (delay > 0) filters.push(`adelay=${delay}:all=1`)
    return filters
}

const EQ_FIELDS = ['brightness', 'contrast', 'saturation', 'gamma'] as const

/** Цветокор: eq умеет выражения по времени, сочность и резкость — только постоянные. */
export function colorFilters(
    color: ColorGrade,
    keys: readonly ColorKeyframe[] = [],
): string[]
{
    const filters: string[] = []
    const base = keys[0] ?? color
    const animated =
        keys.length > 1 && EQ_FIELDS.some((f) => varies(keys, (k) => k[f]))
    if (animated)
    {
        const expr = (field: (typeof EQ_FIELDS)[number]) =>
            `${field}='${piecewiseLinear(
                keyPoints(keys, (k) => k[field]),
                't',
            )}'`
        filters.push(`eq=${EQ_FIELDS.map(expr).join(':')}:eval=frame`)
    }
    else if (EQ_FIELDS.some((f) => base[f] !== NEUTRAL_COLOR[f]))
    {
        filters.push(
            `eq=brightness=${num(base.brightness)}:contrast=${num(base.contrast)}:saturation=${num(base.saturation)}:gamma=${num(base.gamma)}`,
        )
    }
    if (base.vibrance !== 0)
        filters.push(`vibrance=intensity=${num(base.vibrance)}`)
    if (base.sharpen > 0) filters.push(`unsharp=5:5:${num(base.sharpen)}:5:5:0`)
    return filters
}

/** loudnorm в один проход работает в динамическом режиме; точный двухпроходный — в планах. */
export function audioFilters(audio: AudioChain): string[]
{
    const filters: string[] = []
    if (audio.highpass) filters.push('highpass=f=80')
    if (audio.denoise > 0)
        filters.push(`afftdn=nr=${num(6 + 24 * audio.denoise)}:nf=-40:tn=1`)
    if (audio.compressor)
        filters.push(
            'acompressor=threshold=-18dB:ratio=3:attack=5:release=60:makeup=2',
        )
    if (audio.loudness !== 0)
        filters.push(`loudnorm=I=${num(audio.loudness)}:TP=-1.5:LRA=11`)
    return filters
}

export const AUDIO_FORMAT =
    'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'
export const VIDEO_FORMAT = 'format=yuv420p,setsar=1'
