// Разбор и печать реплик: простой формат «старт конец текст» построчно и SRT.

import type { SubtitleCue } from '@shared/model'

const SRT_TIME = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/
const SRT_LINE =
    /\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/

export function parseSrtTime(text: string): number | null
{
    const m = SRT_TIME.exec(text)
    if (!m) return null
    const [, h, mm, ss, ms] = m
    return (
        Number(h) * 3600 +
        Number(mm) * 60 +
        Number(ss) +
        Number((ms ?? '0').padEnd(3, '0')) / 1000
    )
}

function parseSeconds(text: string): number | null
{
    if (text.includes(':'))
    {
        const parts = text.split(':').map(Number)
        if (parts.some((p) => !Number.isFinite(p))) return null
        return parts.reduce((sum, p) => sum * 60 + p, 0)
    }
    const value = Number(text)
    return Number.isFinite(value) ? value : null
}

function makeCue(
    start: number | null,
    end: number | null,
    text: string,
): SubtitleCue | null
{
    if (start === null || end === null || end <= start || text === '')
        return null
    return { id: crypto.randomUUID(), start, end, text }
}

function sorted(cues: SubtitleCue[]): SubtitleCue[]
{
    return cues.sort((a, b) => a.start - b.start)
}

/** SRT: блоки «номер / время --> время / текст». */
export function parseSrt(text: string): SubtitleCue[]
{
    const cues: SubtitleCue[] = []
    for (const block of text.replace(/\r/g, '').split(/\n\s*\n/))
    {
        const lines = block.split('\n').filter((l) => l.trim() !== '')
        const timeLine = lines.find((l) => SRT_LINE.test(l))
        if (!timeLine) continue
        const [from, to] = timeLine.split('-->')
        const body = lines
            .slice(lines.indexOf(timeLine) + 1)
            .join('\n')
            .trim()
        const cue = makeCue(
            parseSrtTime(from ?? ''),
            parseSrtTime(to ?? ''),
            body,
        )
        if (cue) cues.push(cue)
    }
    return sorted(cues)
}

/** Простой формат: «0.5 2.0 Текст» или «0:01 0:03 Текст», по одной реплике на строку. */
export function parseSimple(text: string): SubtitleCue[]
{
    const cues: SubtitleCue[] = []
    for (const raw of text.replace(/\r/g, '').split('\n'))
    {
        const line = raw.trim()
        if (line === '') continue
        const m = /^(\S+)\s+(\S+)\s+(.+)$/.exec(line)
        if (!m) continue
        const cue = makeCue(
            parseSeconds(m[1] ?? ''),
            parseSeconds(m[2] ?? ''),
            (m[3] ?? '').replace(/\\n/g, '\n'),
        )
        if (cue) cues.push(cue)
    }
    return sorted(cues)
}

export function parseCues(text: string): SubtitleCue[]
{
    return SRT_LINE.test(text) ? parseSrt(text) : parseSimple(text)
}

export function printSimple(cues: readonly SubtitleCue[]): string
{
    return cues
        .map(
            (c) =>
                `${c.start.toFixed(2)} ${c.end.toFixed(2)} ${c.text.replace(/\n/g, '\\n')}`,
        )
        .join('\n')
}
