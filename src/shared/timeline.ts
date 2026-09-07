// Таймлайн: клипы идут подряд одной дорожкой. Пересчёт времени проекта во время клипа.

import type { Clip, Project } from "@shared/model";

export interface ClipPlacement {
  clip: Clip;
  index: number;
  /** Начало клипа на таймлайне проекта, сек. */
  start: number;
  duration: number;
}

export function clipDuration(clip: Clip): number {
  return Math.max(0, clip.out - clip.in);
}

export function placeClips(clips: readonly Clip[]): ClipPlacement[] {
  let cursor = 0;
  return clips.map((clip, index) => {
    const duration = clipDuration(clip);
    const placement = { clip, index, start: cursor, duration };
    cursor += duration;
    return placement;
  });
}

export function projectDuration(project: Pick<Project, "clips">): number {
  return project.clips.reduce((sum, clip) => sum + clipDuration(clip), 0);
}

export interface Located {
  placement: ClipPlacement;
  /** Секунды от начала клипа. */
  localT: number;
  /** Секунды внутри исходного файла. */
  sourceT: number;
}

/** Какой клип играет в момент t проекта. За концом — последний клип, до начала — первый. */
export function locate(clips: readonly Clip[], t: number): Located | undefined {
  const placements = placeClips(clips);
  const last = placements[placements.length - 1];
  if (!last) return undefined;
  const found = placements.find((p) => t >= p.start && t < p.start + p.duration) ?? last;
  const localT = Math.min(found.duration, Math.max(0, t - found.start));
  return { placement: found, localT, sourceT: found.clip.in + localT };
}
