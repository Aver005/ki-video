import { useStore } from "@app/store/store";
import { seek, select, setTab, updateText } from "@app/store/actions";
import { placeClips, projectDuration } from "@shared/timeline";
import { ClipBlock } from "@app/components/ClipBlock";
import { Playhead } from "@app/components/Playhead";
import { formatTime } from "@shared/math";

const PAD_SEC = 5;

function tickStep(pxPerSec: number): number {
  if (pxPerSec >= 120) return 0.5;
  if (pxPerSec >= 60) return 1;
  if (pxPerSec >= 25) return 2;
  return 5;
}

/** Перетаскивание текстового блока по времени. */
function startMove(e: React.PointerEvent, id: string, start: number, end: number, pxPerSec: number): void {
  e.stopPropagation();
  const startX = e.clientX;
  const apply = (ev: PointerEvent, final: boolean) => {
    const nextStart = Math.max(0, start + (ev.clientX - startX) / pxPerSec);
    updateText(id, { start: nextStart, end: nextStart + (end - start) }, final);
  };
  const move = (ev: PointerEvent) => apply(ev, false);
  const up = (ev: PointerEvent) => {
    apply(ev, true);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/** Клик и протяжка по линейке двигают курсор. rect.left уже учитывает прокрутку. */
function scrub(e: React.PointerEvent<HTMLDivElement>, pxPerSec: number): void {
  const rect = e.currentTarget.getBoundingClientRect();
  const toTime = (clientX: number) => (clientX - rect.left) / pxPerSec;
  seek(toTime(e.clientX));
  const move = (ev: PointerEvent) => seek(toTime(ev.clientX));
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

export function Timeline() {
  const project = useStore((s) => s.project);
  const pxPerSec = useStore((s) => s.pxPerSec);
  const selection = useStore((s) => s.selection);
  if (!project) return null;

  const duration = projectDuration(project);
  const total = (duration + PAD_SEC) * pxPerSec;
  const step = tickStep(pxPerSec);
  const ticks = Array.from({ length: Math.ceil((duration + PAD_SEC) / step) + 1 }, (_, i) => i * step);

  return (
    <div className="timeline">
      <div className="timeline__inner" style={{ width: total }}>
        <div className="ruler" onPointerDown={(e) => scrub(e, pxPerSec)}>
          {ticks.map((t) => (
            <span key={t} className="ruler__tick" style={{ left: t * pxPerSec }}>
              {Number.isInteger(t) ? formatTime(t, false) : ""}
            </span>
          ))}
        </div>
        <div className="track track--text" onPointerDown={() => select(null)}>
          {project.texts.map((layer) => (
            <div
              key={layer.id}
              className={`block block--text ${selection?.kind === "text" && selection.id === layer.id ? "block--selected" : ""}`}
              style={{ left: layer.start * pxPerSec, width: Math.max(6, (layer.end - layer.start) * pxPerSec) }}
              onPointerDown={(e) => {
                select({ kind: "text", id: layer.id });
                setTab("text");
                startMove(e, layer.id, layer.start, layer.end, pxPerSec);
              }}
            >
              {layer.text}
            </div>
          ))}
        </div>
        <div className="track track--subs" onPointerDown={() => select(null)}>
          {project.subtitles.cues.map((cue) => (
            <div
              key={cue.id}
              className={`block block--sub ${selection?.kind === "cue" && selection.id === cue.id ? "block--selected" : ""}`}
              style={{ left: cue.start * pxPerSec, width: Math.max(6, (cue.end - cue.start) * pxPerSec) }}
              onPointerDown={(e) => {
                e.stopPropagation();
                select({ kind: "cue", id: cue.id });
                setTab("subtitles");
                seek(cue.start);
              }}
            >
              {cue.text}
            </div>
          ))}
        </div>
        <div className="track track--video" onPointerDown={() => select(null)}>
          {placeClips(project.clips).map((placement) => (
            <ClipBlock key={placement.clip.id} placement={placement} pxPerSec={pxPerSec} />
          ))}
        </div>
        <Playhead pxPerSec={pxPerSec} />
      </div>
    </div>
  );
}
