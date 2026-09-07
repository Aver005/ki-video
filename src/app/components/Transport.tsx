import { getPlayer } from "@app/hooks/usePlayer";
import { useStore } from "@app/store/store";
import { addKeyframe, currentClip, removeKeyframe, seek, setZoom, splitAtPlayhead } from "@app/store/actions";
import { formatTime } from "@shared/math";
import { projectDuration } from "@shared/timeline";

export function Transport() {
  const time = useStore((s) => s.time);
  const playing = useStore((s) => s.playing);
  const project = useStore((s) => s.project);
  const pxPerSec = useStore((s) => s.pxPerSec);
  useStore((s) => s.assets);
  const duration = project ? projectDuration(project) : 0;
  const current = currentClip();
  const hasKey = current?.keyframe !== undefined;
  return (
    <div className="transport">
      <button className="btn btn--icon" onClick={() => seek(0)} title="В начало (Home)" aria-label="В начало">
        ⏮
      </button>
      <button className="btn btn--icon btn--primary" onClick={() => getPlayer().toggle()} title="Пробел" aria-label={playing ? "Пауза" : "Играть"} disabled={duration === 0}>
        {playing ? "❚❚" : "▶"}
      </button>
      <span className="transport__time">
        {formatTime(time)} <span className="muted">/ {formatTime(duration)}</span>
      </span>
      <span className="transport__spacer" />
      <button className={`btn ${hasKey ? "btn--active" : ""}`} disabled={!current} onClick={() => (hasKey ? removeKeyframe() : addKeyframe())} title="Ключевой кадр (K)">
        ◆ {hasKey ? "Убрать ключ" : "Ключ"}
      </button>
      <button className="btn" disabled={!current} onClick={splitAtPlayhead} title="Разрезать (S)">
        Разрезать
      </button>
      <input
        className="transport__zoom"
        type="range"
        min={10}
        max={200}
        value={pxPerSec}
        onChange={(e) => setZoom(Number(e.target.value))}
        title="Масштаб таймлайна"
        aria-label="Масштаб таймлайна"
      />
    </div>
  );
}
