// Плеер превью: уменьшенные копии в скрытых элементах, композиция кадра на canvas той же математикой, что и экспорт.

import type { MediaAsset, MediaItem, Project, Track } from '@shared/model'
import { isMediaItem, itemEnd } from '@shared/model'
import { defaultFrame, frameToRegion, interpolateFrame } from '@shared/frame'
import { interpolateKeys } from '@shared/keys'
import { contentAt, projectDuration } from '@shared/timeline'
import { mediaUrl } from '@app/api'
import { drawOverlays } from '@app/player/overlays'

export interface PlayerSource
{
    project: Project | null
    assets: Record<string, MediaAsset>
}

export type TimeListener = (time: number, playing: boolean) => void

type Playable = HTMLVideoElement | HTMLAudioElement
type Element = Playable | HTMLImageElement

const SEEK_EPSILON = 0.04
/** Расхождение, после которого источник принудительно перематывается на нужное место. */
const DRIFT_LIMIT = 0.5
const END_EPSILON = 0.02

interface Active
{
    item: MediaItem
    asset: MediaAsset
    track: Track
    localT: number
}

function isPlayable(element: Element): element is Playable
{
    return !(element instanceof HTMLImageElement)
}

function dispose(element: Element): void
{
    if (!isPlayable(element)) return
    element.pause()
    element.removeAttribute('src')
    element.load()
}

export class Player
{
    private readonly elements = new Map<string, Element>()
    private canvas: HTMLCanvasElement | null = null
    private source: PlayerSource = { project: null, assets: {} }
    private time = 0
    private playing = false
    private raf = 0
    private wallClock = 0
    private readonly listeners = new Set<TimeListener>()

    attach(canvas: HTMLCanvasElement): void
    {
        this.canvas = canvas
        this.sync()
        this.render()
    }

    /** sync создаёт источники под курсором: без него на паузе рисовать нечего. */
    setSource(source: PlayerSource): void
    {
        this.source = source
        this.sync()
        this.render()
    }

    onTime(listener: TimeListener): () => void
    {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    get currentTime(): number
    {
        return this.time
    }

    get isPlaying(): boolean
    {
        return this.playing
    }

    private get duration(): number
    {
        return this.source.project ? projectDuration(this.source.project) : 0
    }

    seek(time: number): void
    {
        this.time = Math.min(this.duration, Math.max(0, time))
        this.sync()
        this.render()
        this.emit()
    }

    play(): void
    {
        if (this.playing || !this.source.project) return
        if (this.time >= this.duration - END_EPSILON) this.time = 0
        this.playing = true
        this.wallClock = performance.now()
        this.emit()
        this.loop()
    }

    pause(): void
    {
        if (!this.playing) return
        this.playing = false
        cancelAnimationFrame(this.raf)
        for (const element of this.elements.values())
            if (isPlayable(element)) element.pause()
        this.emit()
        this.render()
    }

    toggle(): void
    {
        if (this.playing) this.pause()
        else this.play()
    }

    /** Освобождает источники удалённого файла. */
    release(assetId: string): void
    {
        for (const [key, element] of this.elements)
        {
            if (!key.startsWith(`${assetId}:`)) continue
            dispose(element)
            this.elements.delete(key)
        }
    }

    destroy(): void
    {
        this.pause()
        for (const element of this.elements.values()) dispose(element)
        this.elements.clear()
    }

    private emit(): void
    {
        for (const listener of this.listeners) listener(this.time, this.playing)
    }

    /** Свой источник на элемент таймлайна: один файл может стоять в нескольких местах сразу. */
    private element(active: Active): Element
    {
        const key = `${active.asset.id}:${active.item.id}`
        const existing = this.elements.get(key)
        if (existing) return existing
        const url = mediaUrl(active.asset.id)
        if (active.asset.kind === 'image')
        {
            const image = new Image()
            image.src = url
            image.addEventListener('load', () => this.render())
            this.elements.set(key, image)
            return image
        }
        const media =
            active.asset.kind === 'audio'
                ? new Audio(url)
                : document.createElement('video')
        if (media instanceof HTMLVideoElement)
        {
            media.src = url
            media.playsInline = true
            media.addEventListener('loadeddata', () => this.render())
            media.addEventListener('seeked', () =>
            {
                if (!this.playing) this.render()
            })
        }
        media.preload = 'auto'
        this.elements.set(key, media)
        return media
    }

    /** Все элементы всех видимых дорожек, попадающие в момент t. */
    private activeAt(t: number): Active[]
    {
        const project = this.source.project
        if (!project) return []
        const found: Active[] = []
        for (const track of project.tracks)
        {
            if (track.hidden) continue
            for (const item of track.items)
            {
                if (!isMediaItem(item)) continue
                if (t < item.start || t >= itemEnd(item)) continue
                const asset = this.source.assets[item.assetId]
                if (!asset || asset.status !== 'ready') continue
                found.push({ item, asset, track, localT: t - item.start })
            }
        }
        return found
    }

    /** Ставит все источники на нужное место и решает, кому звучать. */
    private sync(): void
    {
        const active = this.activeAt(this.time)
        const keys = new Set(active.map((a) => `${a.asset.id}:${a.item.id}`))
        for (const [key, element] of this.elements)
        {
            if (!keys.has(key) && isPlayable(element) && !element.paused)
                element.pause()
        }
        for (const item of active)
        {
            const element = this.element(item)
            if (!isPlayable(element)) continue
            const target = item.item.offset + item.localT
            element.muted = item.track.muted || item.item.volume <= 0
            element.volume = Math.min(1, Math.max(0, item.item.volume))
            const drift = Math.abs(element.currentTime - target)
            if (this.playing)
            {
                if (element.paused || drift > DRIFT_LIMIT)
                {
                    element.currentTime = target
                    void element.play().catch(() => undefined)
                }
            }
            else
            {
                if (!element.paused) element.pause()
                if (drift > SEEK_EPSILON) element.currentTime = target
            }
        }
    }

    /** Кадр анимации: время ведёт видео под курсором, а на картинке и в зазоре — часы. */
    private loop = (): void =>
    {
        if (!this.playing) return
        const now = performance.now()
        const wall = (now - this.wallClock) / 1000
        this.wallClock = now
        const project = this.source.project
        const at = project ? contentAt(project, this.time) : null
        const asset = at ? this.source.assets[at.item.assetId] : undefined
        const key = at && asset ? `${asset.id}:${at.item.id}` : null
        const leader = key ? this.elements.get(key) : undefined

        if (
            leader &&
            isPlayable(leader) &&
            !leader.paused &&
            at &&
            asset?.kind === 'video'
        )
        {
            const local = leader.currentTime - at.item.offset
            this.time = at.item.start + Math.max(0, local)
        }
        else
        {
            this.time += wall
        }
        if (this.time >= this.duration - END_EPSILON)
        {
            this.time = this.duration
            this.sync()
            this.pause()
            return
        }
        this.sync()
        this.render()
        this.emit()
        this.raf = requestAnimationFrame(this.loop)
    }

    private drawContent(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ): void
    {
        const project = this.source.project
        const at = project ? contentAt(project, this.time) : null
        if (!project || !at) return
        const asset = this.source.assets[at.item.assetId]
        if (!asset || asset.status !== 'ready') return
        const element = this.elements.get(`${asset.id}:${at.item.id}`)
        if (!element || !isDrawable(element)) return
        const frame = interpolateFrame(
            at.item.frame,
            at.localT,
            defaultFrame(asset),
        )
        const region = frameToRegion(frame, asset, project.output)
        const proxy = asset.proxy ?? asset
        const k = proxy.width > 0 ? proxy.width / asset.width : 1
        const color = interpolateKeys(
            project.colorKeys,
            this.time,
            project.color,
        )
        ctx.filter = `brightness(${1 + color.brightness}) contrast(${color.contrast}) saturate(${color.saturation})`
        ctx.drawImage(
            element,
            region.x * k,
            region.y * k,
            region.w * k,
            region.h * k,
            0,
            0,
            width,
            height,
        )
        ctx.filter = 'none'
    }

    private drawOverlayItems(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
    ): void
    {
        for (const active of this.activeAt(this.time))
        {
            if (active.track.kind !== 'overlay') continue
            const element = this.elements.get(
                `${active.asset.id}:${active.item.id}`,
            )
            if (!element || !isDrawable(element)) continue
            const { duration, fadeIn, fadeOut } = active.item
            const box =
                active.item.boxKeys.length > 0
                    ? interpolateKeys(
                          active.item.boxKeys,
                          active.localT,
                          active.item.box,
                      )
                    : active.item.box
            const w = box.width * width
            const ratio =
                active.asset.width > 0
                    ? active.asset.height / active.asset.width
                    : 1
            const fade = Math.min(
                fadeIn > 0 ? active.localT / fadeIn : 1,
                fadeOut > 0 ? (duration - active.localT) / fadeOut : 1,
                1,
            )
            ctx.save()
            ctx.globalAlpha = box.opacity * Math.max(0, fade)
            ctx.translate(box.x * width, box.y * height)
            ctx.rotate((box.rotation * Math.PI) / 180)
            ctx.drawImage(element, -w / 2, (-w * ratio) / 2, w, w * ratio)
            ctx.restore()
        }
    }

    render(): void
    {
        const canvas = this.canvas
        const project = this.source.project
        if (!canvas || !project) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const { width, height } = canvas
        ctx.filter = 'none'
        ctx.globalAlpha = 1
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)
        this.drawContent(ctx, width, height)
        this.drawOverlayItems(ctx, width, height)
        drawOverlays(ctx, project, this.time, width / project.output.width)
    }
}

function isDrawable(
    element: Element,
): element is HTMLVideoElement | HTMLImageElement
{
    if (element instanceof HTMLImageElement) return element.complete
    return element instanceof HTMLVideoElement && element.readyState >= 2
}
