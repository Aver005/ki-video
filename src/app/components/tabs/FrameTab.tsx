import { useStore } from "@app/store/store";
import { addKeyframe, clearKeyframes, currentClip, moveClip, removeClip, removeKeyframe, seek, setFrame } from "@app/store/actions";
import { Slider } from "@app/components/Slider";
import { QuickPreset } from "@app/components/QuickPreset";
import { KEYFRAME_EPSILON, MAX_ZOOM } from "@shared/frame";

export function FrameTab() {
  // currentClip читает time, project и assets: подписываемся на все три, чтобы не показывать устаревший клип.
  useStore((s) => s.time);
  useStore((s) => s.project);
  useStore((s) => s.assets);
  const current = currentClip();
  if (!current) {
    return (
      <div className="tab-body">
        <p className="muted">Поставь курсор на клип, чтобы задать окно кадра.</p>
        <QuickPreset />
      </div>
    );
  }
  const { clip, asset, frame, keyframe, localT, start } = current;
  return (
    <div className="tab-body">
      <div className="section-title">
        Клип · {asset.name}
        <span className="muted">
          {" "}
          {clip.in.toFixed(2)}–{clip.out.toFixed(2)}s
        </span>
      </div>
      <Slider label="Центр X" value={frame.cx} min={0} max={asset.width} step={1} onChange={(v, final) => setFrame({ cx: v }, final)} />
      <Slider label="Центр Y" value={frame.cy} min={0} max={asset.height} step={1} onChange={(v, final) => setFrame({ cy: v }, final)} />
      <Slider label="Зум" value={frame.zoom} min={1} max={MAX_ZOOM} step={0.01} format={(v) => `${v.toFixed(2)}×`} onChange={(v, final) => setFrame({ zoom: v }, final)} />
      <div className="row-actions">
        <button className={`btn ${keyframe ? "btn--active" : ""}`} onClick={() => (keyframe ? removeKeyframe() : addKeyframe())}>
          ◆ {keyframe ? "Убрать ключ" : `Ключ на ${localT.toFixed(2)}s`}
        </button>
        <button className="btn btn--ghost" onClick={clearKeyframes} disabled={clip.frame.length === 0}>
          Сбросить
        </button>
      </div>
      {clip.frame.length > 0 && (
        <div className="presets">
          {clip.frame.map((k) => (
            <button key={k.t} className={`chip ${Math.abs(k.t - localT) <= KEYFRAME_EPSILON ? "chip--active" : ""}`} onClick={() => seek(start + k.t)}>
              {k.t.toFixed(2)}s · {k.zoom.toFixed(1)}×
            </button>
          ))}
        </div>
      )}
      <div className="section-title">Порядок</div>
      <div className="row-actions">
        <button className="btn btn--ghost" onClick={() => moveClip(clip.id, -1)}>
          ← Раньше
        </button>
        <button className="btn btn--ghost" onClick={() => moveClip(clip.id, 1)}>
          Позже →
        </button>
        <button className="btn btn--danger" onClick={() => removeClip(clip.id)}>
          Удалить
        </button>
      </div>
      <QuickPreset />
    </div>
  );
}
