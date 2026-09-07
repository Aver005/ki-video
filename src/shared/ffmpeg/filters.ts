// Фильтры ffmpeg для элементов таймлайна и для итоговых дорожек. Только чистые функции.

import type {
    AudioChain,
    ColorGrade,
    FrameKeyframe,
    MediaAsset,
    MediaItem,
    OutputSpec,
    OverlayBox,
} from '@shared/model'
import { NEUTRAL_COLOR } from '@shared/model'
import { baseWindow, defaultFrame, MAX_ZOOM } from '@shared/frame'
import { num } from '@shared/math'
import { clipExpr, piecewiseLinear, type TimePoint } from '@shared/ffmpeg/expr'

function points(
    keyframes: readonly FrameKeyframe[],
    pickValue: (k: FrameKeyframe) => number,
): TimePoint[]
{
    return keyframes.map((k) => ({ t: k.t, v: pickValue(k) }))
}

/** Цепочка кадрирования: crop с панорамой по t → scale → zoompan для зума. */
export function frameFilters(
    item: MediaItem,
    asset: MediaAsset,
    output: OutputSpec,
): string[]
{
    const source = { width: asset.width, height: asset.height }
    const { width: bw, height: bh } = baseWindow(source, output)
    const keyframes =
        item.frame.length > 0 ? item.frame : [{ t: 0, ...defaultFrame(source) }]

    const cx = piecewiseLinear(
        points(keyframes, (k) => k.cx),
        't',
    )
    const cy = piecewiseLinear(
        points(keyframes, (k) => k.cy),
        't',
    )
    const x = clipExpr(`${cx}-${num(bw / 2)}`, 0, asset.width - bw)
    const y = clipExpr(`${cy}-${num(bh / 2)}`, 0, asset.height - bh)
    // exact=1: без округления x/y к чётным пикселям панорама идёт плавно.
    const filters = [
        `fps=${output.fps}`,
        `crop=${bw}:${bh}:'${x}':'${y}':exact=1`,
        `scale=${output.width}:${output.height}:flags=bicubic`,
    ]

    const hasZoom = keyframes.some((k) => k.zoom > 1.0001)
    if (hasZoom)
    {
        const zoom = clipExpr(
            piecewiseLinear(
                points(keyframes, (k) => Math.min(MAX_ZOOM, k.zoom)),
                'it',
            ),
            1,
            MAX_ZOOM,
        )
        const sx = output.width / bw
        const sy = output.height / bh
        const cxIt = piecewiseLinear(
            points(keyframes, (k) => k.cx),
            'it',
        )
        const cyIt = piecewiseLinear(
            points(keyframes, (k) => k.cy),
            'it',
        )
        const baseX = clipExpr(`${cxIt}-${num(bw / 2)}`, 0, asset.width - bw)
        const baseY = clipExpr(`${cyIt}-${num(bh / 2)}`, 0, asset.height - bh)
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
    /** Левый верхний угол наложения в пикселях кадра. */
    x: number
    y: number
}

/** Размер наложения в пикселях кадра: ширина из доли, высота по пропорциям источника. */
export function overlaySize(
    box: OverlayBox,
    asset: Pick<MediaAsset, 'width' | 'height'>,
    output: OutputSpec,
): { width: number; height: number }
{
    const width = evenRound(box.width * output.width)
    const ratio = asset.width > 0 ? asset.height / asset.width : 1
    return { width, height: evenRound(width * ratio) }
}

/** Габарит после поворота: описанный прямоугольник. */
export function rotatedSize(
    size: { width: number; height: number },
    degrees: number,
): { width: number; height: number }
{
    const a = (degrees * Math.PI) / 180
    const cos = Math.abs(Math.cos(a))
    const sin = Math.abs(Math.sin(a))
    return {
        width: Math.round(size.width * cos + size.height * sin),
        height: Math.round(size.width * sin + size.height * cos),
    }
}

/** Цепочка наложения: масштаб, поворот с прозрачным фоном, непрозрачность, фейды, сдвиг во времени. */
export function overlayFilters(
    item: MediaItem,
    asset: MediaAsset,
    output: OutputSpec,
): OverlayPlacement
{
    const box = item.box
    const size = overlaySize(box, asset, output)
    const filters = [
        `fps=${output.fps}`,
        `scale=${size.width}:${size.height}:flags=bicubic`,
        'format=yuva420p',
    ]
    if (Math.abs(box.rotation) > 0.01)
    {
        const a = num((box.rotation * Math.PI) / 180, 5)
        filters.push(`rotate=${a}:c=none:ow=rotw(${a}):oh=roth(${a})`)
    }
    if (box.opacity < 0.999)
        filters.push(`colorchannelmixer=aa=${num(box.opacity)}`)
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
    const outer = rotatedSize(size, box.rotation)
    return {
        filters,
        x: Math.round(box.x * output.width - outer.width / 2),
        y: Math.round(box.y * output.height - outer.height / 2),
    }
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

export function colorFilters(color: ColorGrade): string[]
{
    const filters: string[] = []
    const eqNeutral =
        color.brightness === NEUTRAL_COLOR.brightness &&
        color.contrast === NEUTRAL_COLOR.contrast &&
        color.saturation === NEUTRAL_COLOR.saturation &&
        color.gamma === NEUTRAL_COLOR.gamma
    if (!eqNeutral)
    {
        filters.push(
            `eq=brightness=${num(color.brightness)}:contrast=${num(color.contrast)}:saturation=${num(color.saturation)}:gamma=${num(color.gamma)}`,
        )
    }
    if (color.vibrance !== 0)
        filters.push(`vibrance=intensity=${num(color.vibrance)}`)
    if (color.sharpen > 0)
        filters.push(`unsharp=5:5:${num(color.sharpen)}:5:5:0`)
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
