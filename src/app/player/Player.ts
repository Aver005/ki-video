// Плеер превью: прокси-видео в скрытых <video>, композиция кадра на canvas той же математикой, что и экспорт.

import type { MediaAsset, Project } from '@shared/model'
import { defaultFrame, frameToRegion, interpolateFrame } from '@shared/frame'
import { locate, projectDuration, type Located } from '@shared/timeline'
import { proxyUrl } from '@app/api'
import { drawOverlays } from '@app/player/overlays'

export interface PlayerSource
{
    project: Project | null
    assets: Record<string, MediaAsset>
}

export type TimeListener = (time: number, playing: boolean) => void

const SEEK_EPSILON = 0.04
/** Расхождение, после которого видео принудительно перематывается на нужное место. */
const DRIFT_LIMIT = 0.5
const END_EPSILON = 0.02

export class Player
{
    private readonly videos = new Map<string, HTMLVideoElement>()
    private canvas: HTMLCanvasElement | null = null
    private source: PlayerSource = { project: null, assets: {} }
    private time = 0
    private playing = false
    private raf = 0
    private activeAssetId: string | null = null
    private readonly listeners = new Set<TimeListener>()

    attach(canvas: HTMLCanvasElement): void
    {
        this.canvas = canvas
        this.render()
    }

    setSource(source: PlayerSource): void
    {
        this.source = source
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
        if (this.playing)
        {
            const current = this.located()
            if (current) this.switchTo(current.asset, current.at.sourceT)
        }
        else
        {
            this.render()
        }
        this.emit()
    }

    play(): void
    {
        if (this.playing || !this.source.project) return
        if (this.time >= this.duration - END_EPSILON) this.time = 0
        this.playing = true
        this.emit()
        this.loop()
    }

    pause(): void
    {
        if (!this.playing) return
        this.playing = false
        cancelAnimationFrame(this.raf)
        for (const video of this.videos.values()) video.pause()
        this.emit()
        this.render()
    }

    toggle(): void
    {
        if (this.playing) this.pause()
        else this.play()
    }

    /** Освобождает видео удалённого файла. */
    release(assetId: string): void
    {
        const video = this.videos.get(assetId)
        if (!video) return
        video.pause()
        video.removeAttribute('src')
        video.load()
        this.videos.delete(assetId)
        if (this.activeAssetId === assetId) this.activeAssetId = null
    }

    destroy(): void
    {
        this.pause()
        for (const id of this.videos.keys()) this.release(id)
    }

    private emit(): void
    {
        for (const listener of this.listeners) listener(this.time, this.playing)
    }

    private video(asset: MediaAsset): HTMLVideoElement
    {
        const existing = this.videos.get(asset.id)
        if (existing) return existing
        const video = document.createElement('video')
        video.src = proxyUrl(asset.id)
        video.preload = 'auto'
        video.playsInline = true
        video.muted = true
        video.addEventListener('seeked', () =>
        {
            if (!this.playing) this.render()
        })
        video.addEventListener('loadeddata', () => this.render())
        this.videos.set(asset.id, video)
        return video
    }

    private located(): { at: Located; asset: MediaAsset } | null
    {
        const project = this.source.project
        if (!project) return null
        const at = locate(project.clips, this.time)
        const asset = at
            ? this.source.assets[at.placement.clip.assetId]
            : undefined
        if (!at || !asset || asset.status !== 'ready') return null
        return { at, asset }
    }

    /** Кадр анимации: время берём у играющего видео, чтобы звук и картинка не расходились. */
    private loop = (): void =>
    {
        if (!this.playing) return
        const current = this.located()
        if (!current)
        {
            this.pause()
            return
        }
        const { clip, start, duration } = current.at.placement
        const video = this.video(current.asset)
        const clipEnd = start + duration
        const isActive =
            this.activeAssetId === current.asset.id && !video.paused
        const finished =
            video.ended || video.currentTime >= clip.out - END_EPSILON

        if (isActive && finished)
        {
            this.time = clipEnd
        }
        else if (
            !isActive ||
            Math.abs(video.currentTime - current.at.sourceT) > DRIFT_LIMIT
        )
        {
            this.switchTo(current.asset, current.at.sourceT)
        }
        else
        {
            this.time = start + (video.currentTime - clip.in)
        }

        if (
            this.time >= clipEnd - END_EPSILON &&
            clipEnd >= this.duration - END_EPSILON
        )
        {
            this.time = this.duration
            this.pause()
            return
        }
        this.render()
        this.emit()
        this.raf = requestAnimationFrame(this.loop)
    }

    private switchTo(asset: MediaAsset, sourceT: number): void
    {
        const video = this.video(asset)
        for (const [id, other] of this.videos)
        {
            if (id === asset.id) continue
            other.muted = true
            if (!other.paused) other.pause()
        }
        this.activeAssetId = asset.id
        video.muted = false
        if (Math.abs(video.currentTime - sourceT) > SEEK_EPSILON)
            video.currentTime = sourceT
        void video.play().catch(() => undefined)
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
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)

        const current = this.located()
        if (current)
        {
            const video = this.video(current.asset)
            if (
                !this.playing &&
                Math.abs(video.currentTime - current.at.sourceT) > SEEK_EPSILON
            )
            {
                video.currentTime = current.at.sourceT
            }
            const frame = interpolateFrame(
                current.at.placement.clip.frame,
                current.at.localT,
                defaultFrame(current.asset),
            )
            const region = frameToRegion(frame, current.asset, project.output)
            const proxy = current.asset.proxy ?? current.asset
            const k = proxy.width / current.asset.width
            const { color } = project
            ctx.filter = `brightness(${1 + color.brightness}) contrast(${color.contrast}) saturate(${color.saturation})`
            if (video.readyState >= 2)
            {
                ctx.drawImage(
                    video,
                    region.x * k,
                    region.y * k,
                    region.w * k,
                    region.h * k,
                    0,
                    0,
                    width,
                    height,
                )
            }
            ctx.filter = 'none'
        }
        drawOverlays(ctx, project, this.time, width / project.output.width)
    }
}
