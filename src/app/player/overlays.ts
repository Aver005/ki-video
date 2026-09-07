// Текст и субтитры на canvas превью в тех же пропорциях, что задаёт ASS при экспорте.

import type { Project, TextItem } from '@shared/model'
import { itemEnd } from '@shared/model'
import { textItems } from '@shared/ffmpeg/ass'
import { SUBTITLE_STYLES, TEXT_FONT } from '@shared/presets'

interface DrawTextOptions
{
    x: number
    y: number
    size: number
    color: string
    outline: string
    outlineWidth: number
    bold: boolean
    scale: number
    alpha: number
}

function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    o: DrawTextOptions,
): void
{
    const lines = text.split('\n')
    const size = o.size * o.scale
    ctx.save()
    ctx.globalAlpha = o.alpha
    ctx.font = `${o.bold ? 'bold ' : ''}${size}px ${TEXT_FONT}, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = o.outlineWidth * 2 * o.scale
    ctx.strokeStyle = o.outline
    ctx.fillStyle = o.color
    const lineHeight = size * 1.2
    const top = o.y - ((lines.length - 1) * lineHeight) / 2
    lines.forEach((line, i) =>
    {
        const y = top + i * lineHeight
        ctx.strokeText(line, o.x, y)
        ctx.fillText(line, o.x, y)
    })
    ctx.restore()
}

/** Прозрачность и масштаб по анимации слоя в момент t, как в тегах ASS. */
function animationState(
    layer: TextItem,
    t: number,
): { alpha: number; grow: number }
{
    const sinceStart = t - layer.start
    const untilEnd = itemEnd(layer) - t
    if (layer.animation === 'fade')
    {
        return {
            alpha: Math.min(1, sinceStart / 0.15, untilEnd / 0.15),
            grow: 1,
        }
    }
    if (layer.animation === 'pop')
    {
        return { alpha: 1, grow: 0.6 + 0.4 * Math.min(1, sinceStart / 0.12) }
    }
    return { alpha: 1, grow: 1 }
}

export function drawOverlays(
    ctx: CanvasRenderingContext2D,
    project: Project,
    t: number,
    scale: number,
): void
{
    const width = project.output.width * scale
    const height = project.output.height * scale
    const sub = SUBTITLE_STYLES[project.subtitles.preset]
    for (const cue of project.subtitles.cues)
    {
        if (t < cue.start || t >= cue.end) continue
        drawText(ctx, cue.text,
        {
            x: width / 2,
            y: project.subtitles.y * height,
            size: sub.fontSize,
            color: sub.color,
            outline: sub.outline,
            outlineWidth: sub.outlineWidth,
            bold: sub.bold,
            scale,
            alpha: 1,
        })
    }
    for (const layer of textItems(project))
    {
        if (t < layer.start || t >= itemEnd(layer)) continue
        const anim = animationState(layer, t)
        drawText(ctx, layer.text,
        {
            x: layer.x * width,
            y: layer.y * height,
            size: layer.size * anim.grow,
            color: layer.color,
            outline: layer.outline,
            outlineWidth: Math.max(2, layer.size / 18),
            bold: true,
            scale,
            alpha: anim.alpha,
        })
    }
}
