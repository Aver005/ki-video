// Действия над проектом: каждое изменение проходит через commit с историей и отложенным сохранением.

import type { Clip, FrameKeyframe, FrameState, MediaAsset, Project, SubtitleCue, TextLayer } from "@shared/model";
import { clampFrame, defaultFrame, findKeyframeAt, interpolateFrame, removeKeyframeAt, upsertKeyframe } from "@shared/frame";
import { locate } from "@shared/timeline";
import { TEXT_PRESETS } from "@shared/presets";
import { api } from "@app/api";
import { getPlayer } from "@app/hooks/usePlayer";
import { getState, setState, type InspectorTab, type Selection } from "@app/store/store";

const HISTORY_LIMIT = 100;
const SAVE_DELAY_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: Project | null = null;
let saveChain: Promise<unknown> = Promise.resolve();
/** Состояние до начала непрерывного жеста: именно оно попадает в историю. */
let gestureBase: Project | null = null;

function scheduleSave(project: Project): void {
  pendingSave = project;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DELAY_MS);
}

/** Сохраняет накопленное изменение сразу; сохранения идут по очереди, чтобы не обгонять друг друга. */
export function flushSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const project = pendingSave;
  if (!project) return;
  pendingSave = null;
  saveChain = saveChain
    .then(() => api.saveProject(project))
    .catch((error: unknown) => notify(error instanceof Error ? error.message : "Не удалось сохранить"));
}

/** При закрытии вкладки отправляем последнее изменение без ожидания ответа. */
export function saveOnUnload(): void {
  if (!pendingSave) return;
  void fetch("/api/project", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingSave), keepalive: true });
  pendingSave = null;
}

export function notify(message: string | null): void {
  setState({ notice: message });
}

/** Фиксирует новую версию проекта. record=false — промежуточный шаг жеста, в историю не пишется. */
export function commit(project: Project, record = true): void {
  setState((s) => {
    if (!record) {
      gestureBase ??= s.project;
      return { project };
    }
    const snapshot = gestureBase ?? s.project;
    gestureBase = null;
    return {
      project,
      future: [],
      history: snapshot ? [...s.history.slice(1 - HISTORY_LIMIT), snapshot] : s.history,
    };
  });
  scheduleSave(project);
}

export function undo(): void {
  const { history, project } = getState();
  const prev = history[history.length - 1];
  if (!prev || !project) return;
  gestureBase = null;
  setState((s) => ({ project: prev, history: s.history.slice(0, -1), future: [project, ...s.future].slice(0, HISTORY_LIMIT) }));
  scheduleSave(prev);
}

export function redo(): void {
  const { future, project } = getState();
  const next = future[0];
  if (!next || !project) return;
  gestureBase = null;
  setState((s) => ({ project: next, future: s.future.slice(1), history: [...s.history.slice(1 - HISTORY_LIMIT), project] }));
  scheduleSave(next);
}

export function update(mutate: (draft: Project) => void, record = true): void {
  const { project } = getState();
  if (!project) return;
  const draft = structuredClone(project);
  mutate(draft);
  commit(draft, record);
}

export function select(selection: Selection): void {
  setState({ selection });
}

export function setTab(tab: InspectorTab): void {
  setState({ tab });
}

export function setZoom(pxPerSec: number): void {
  setState({ pxPerSec });
}

/** Перемотка идёт через плеер: он источник истины по времени и при воспроизведении, и на паузе. */
export function seek(time: number): void {
  getPlayer().seek(time);
}

export function addClipFromAsset(asset: MediaAsset): void {
  const clip: Clip = { id: crypto.randomUUID(), assetId: asset.id, in: 0, out: asset.duration, frame: [] };
  update((p) => {
    p.clips.push(clip);
  });
  select({ kind: "clip", id: clip.id });
  setTab("frame");
}

export function removeClip(id: string): void {
  update((p) => {
    p.clips = p.clips.filter((c) => c.id !== id);
  });
  select(null);
}

/** Файл, который используют клипы, убрать нельзя: сначала удаляются клипы. */
export function removeAsset(id: string): void {
  const { project } = getState();
  if (project?.clips.some((c) => c.assetId === id)) {
    notify("Файл используется на таймлайне: сначала удали его клипы");
    return;
  }
  void api.removeAsset(id).catch((error: unknown) => notify(error instanceof Error ? error.message : "Не удалось убрать файл"));
}

export function moveClip(id: string, direction: -1 | 1): void {
  update((p) => {
    const index = p.clips.findIndex((c) => c.id === id);
    const target = index + direction;
    const a = p.clips[index];
    const b = p.clips[target];
    if (!a || !b) return;
    p.clips[index] = b;
    p.clips[target] = a;
  });
}

export function trimClip(id: string, patch: Partial<Pick<Clip, "in" | "out">>, record = true): void {
  update((p) => {
    const clip = p.clips.find((c) => c.id === id);
    const asset = getState().assets[clip?.assetId ?? ""];
    if (!clip || !asset) return;
    const nextIn = Math.max(0, Math.min(patch.in ?? clip.in, clip.out - 0.1));
    const nextOut = Math.min(asset.duration, Math.max(patch.out ?? clip.out, nextIn + 0.1));
    clip.in = nextIn;
    clip.out = nextOut;
  }, record);
}

/** Разрезает клип под курсором на два. */
export function splitAtPlayhead(): void {
  const { project, time } = getState();
  if (!project) return;
  const at = locate(project.clips, time);
  if (!at || at.localT <= 0.05 || at.localT >= at.placement.duration - 0.05) return;
  const { clip, index } = at.placement;
  const cut = clip.in + at.localT;
  update((p) => {
    const left: Clip = { ...clip, out: cut, frame: clip.frame.filter((k) => k.t <= at.localT) };
    const right: Clip = {
      ...clip,
      id: crypto.randomUUID(),
      in: cut,
      frame: clip.frame.filter((k) => k.t >= at.localT).map((k) => ({ ...k, t: k.t - at.localT })),
    };
    p.clips.splice(index, 1, left, right);
  });
}

export interface CurrentClip {
  clip: Clip;
  asset: MediaAsset;
  /** Начало клипа на таймлайне проекта. */
  start: number;
  localT: number;
  frame: FrameState;
  keyframe: FrameKeyframe | undefined;
}

/** Клип под курсором вместе с интерполированным окном кадрирования. Не хук: читает стор напрямую. */
export function currentClip(): CurrentClip | null {
  const { project, time, assets } = getState();
  if (!project) return null;
  const at = locate(project.clips, time);
  const asset = at ? assets[at.placement.clip.assetId] : undefined;
  if (!at || !asset) return null;
  const clip = at.placement.clip;
  return {
    clip,
    asset,
    start: at.placement.start,
    localT: at.localT,
    frame: interpolateFrame(clip.frame, at.localT, defaultFrame(asset)),
    keyframe: findKeyframeAt(clip.frame, at.localT),
  };
}

/** Меняет окно в текущий момент: если ключи уже есть — правит/создаёт ключ, иначе статичное значение. */
export function setFrame(patch: Partial<FrameState>, record = true): void {
  const current = currentClip();
  if (!current) return;
  const { project } = getState();
  if (!project) return;
  const next = clampFrame({ ...current.frame, ...patch }, current.asset, project.output);
  update((p) => {
    const clip = p.clips.find((c) => c.id === current.clip.id);
    if (!clip) return;
    clip.frame = clip.frame.length === 0 ? [{ t: 0, ...next }] : upsertKeyframe(clip.frame, { t: current.localT, ...next });
  }, record);
}

export function addKeyframe(): void {
  const current = currentClip();
  if (!current) return;
  update((p) => {
    const clip = p.clips.find((c) => c.id === current.clip.id);
    if (!clip) return;
    clip.frame = upsertKeyframe(clip.frame, { t: current.localT, ...current.frame });
  });
}

export function removeKeyframe(): void {
  const current = currentClip();
  if (!current) return;
  update((p) => {
    const clip = p.clips.find((c) => c.id === current.clip.id);
    if (!clip) return;
    clip.frame = removeKeyframeAt(clip.frame, current.localT);
  });
}

export function clearKeyframes(): void {
  const current = currentClip();
  if (!current) return;
  update((p) => {
    const clip = p.clips.find((c) => c.id === current.clip.id);
    if (clip) clip.frame = [];
  });
}

export function addText(presetId: string): void {
  const preset = TEXT_PRESETS.find((p) => p.id === presetId) ?? TEXT_PRESETS[0];
  if (!preset) return;
  const { time } = getState();
  const layer: TextLayer = {
    id: crypto.randomUUID(),
    text: "Текст",
    start: time,
    end: time + 3,
    x: 0.5,
    y: 0.2,
    ...preset.value,
  };
  update((p) => {
    p.texts.push(layer);
  });
  select({ kind: "text", id: layer.id });
  setTab("text");
}

export function updateText(id: string, patch: Partial<TextLayer>, record = true): void {
  update((p) => {
    const layer = p.texts.find((t) => t.id === id);
    if (layer) Object.assign(layer, patch);
  }, record);
}

export function removeText(id: string): void {
  update((p) => {
    p.texts = p.texts.filter((t) => t.id !== id);
  });
  select(null);
}

export function setCues(cues: SubtitleCue[]): void {
  update((p) => {
    p.subtitles.cues = cues;
  });
}

export function deleteSelection(): void {
  const { selection } = getState();
  if (!selection) return;
  if (selection.kind === "clip") removeClip(selection.id);
  if (selection.kind === "text") removeText(selection.id);
  if (selection.kind === "cue") {
    update((p) => {
      p.subtitles.cues = p.subtitles.cues.filter((c) => c.id !== selection.id);
    });
    select(null);
  }
}
