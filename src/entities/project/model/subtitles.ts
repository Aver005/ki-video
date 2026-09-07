// Реплики субтитров проекта.

import type { SubtitleCue } from '@core/model'
import { select } from '@shared/model/editor'
import { update } from '@entities/project/model/session'

export function setCues(cues: SubtitleCue[]): void
{
    update((p) =>
    {
        p.subtitles.cues = [...cues].sort((a, b) => a.start - b.start)
    })
}

export function updateCue(
    id: string,
    patch: Partial<SubtitleCue>,
    record = true,
): void
{
    update((p) =>
    {
        const cue = p.subtitles.cues.find((c) => c.id === id)
        if (cue) Object.assign(cue, patch)
        if (record) p.subtitles.cues.sort((a, b) => a.start - b.start)
    }, record)
}

export function removeCue(id: string): void
{
    update((p) =>
    {
        p.subtitles.cues = p.subtitles.cues.filter((c) => c.id !== id)
    })
    select(null)
}
