import { useStore } from "@app/store/store";
import { addText, select, seek } from "@app/store/actions";
import { PresetRow } from "@app/components/PresetRow";
import { LayerEditor } from "@app/components/LayerEditor";
import { TEXT_PRESETS } from "@shared/presets";
import type { TextLayer } from "@shared/model";

/** Стабильная пустая ссылка: селектор не должен возвращать новый массив на каждый вызов. */
const NO_TEXTS: readonly TextLayer[] = [];

export function TextTab() {
  const texts = useStore((s) => s.project?.texts ?? NO_TEXTS);
  const selection = useStore((s) => s.selection);
  const selected = selection?.kind === "text" ? texts.find((t) => t.id === selection.id) : undefined;
  return (
    <div className="tab-body">
      <div className="section-title">Добавить под курсором</div>
      <PresetRow presets={TEXT_PRESETS} onPick={(preset) => addText(preset.id)} />
      {texts.length > 0 && (
        <div className="list">
          {texts.map((layer) => (
            <button
              key={layer.id}
              className={`row ${layer.id === selected?.id ? "row--active" : ""}`}
              onClick={() => {
                select({ kind: "text", id: layer.id });
                seek(layer.start);
              }}
            >
              <span className="row__name">{layer.text || "…"}</span>
              <span className="muted">
                {layer.start.toFixed(1)}–{layer.end.toFixed(1)}s
              </span>
            </button>
          ))}
        </div>
      )}
      {selected && <LayerEditor layer={selected} />}
    </div>
  );
}
