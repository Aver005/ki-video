import { removeText, updateText } from "@app/store/actions";
import { Slider } from "@app/components/Slider";
import { NumberField } from "@app/components/NumberField";
import type { TextAnimation, TextLayer } from "@shared/model";

const ANIMATIONS: { value: TextAnimation; label: string }[] = [
  { value: "none", label: "Без анимации" },
  { value: "fade", label: "Плавно" },
  { value: "pop", label: "Выскок" },
];

function isAnimation(value: string): value is TextAnimation {
  return ANIMATIONS.some((a) => a.value === value);
}

export function LayerEditor({ layer }: { layer: TextLayer }) {
  const patch = (value: Partial<TextLayer>, record = true) => updateText(layer.id, value, record);
  return (
    <div className="editor">
      <textarea value={layer.text} rows={2} aria-label="Текст слоя" onChange={(e) => patch({ text: e.target.value }, false)} onBlur={() => patch({}, true)} />
      <div className="field-row">
        <NumberField label="Начало" value={layer.start} onCommit={(start) => patch({ start, end: Math.max(layer.end, start + 0.1) })} />
        <NumberField label="Конец" value={layer.end} min={layer.start + 0.1} onCommit={(end) => patch({ end })} />
      </div>
      <Slider label="X" value={layer.x} min={0} max={1} onChange={(v, final) => patch({ x: v }, final)} />
      <Slider label="Y" value={layer.y} min={0} max={1} onChange={(v, final) => patch({ y: v }, final)} />
      <Slider label="Кегль" value={layer.size} min={24} max={200} step={1} onChange={(v, final) => patch({ size: v }, final)} />
      <div className="field-row">
        <label className="field">
          <span>Цвет</span>
          <input type="color" value={layer.color} onChange={(e) => patch({ color: e.target.value }, false)} onBlur={() => patch({}, true)} />
        </label>
        <label className="field">
          <span>Обводка</span>
          <input type="color" value={layer.outline} onChange={(e) => patch({ outline: e.target.value }, false)} onBlur={() => patch({}, true)} />
        </label>
        <label className="field">
          <span>Анимация</span>
          <select value={layer.animation} onChange={(e) => isAnimation(e.target.value) && patch({ animation: e.target.value })}>
            {ANIMATIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="btn btn--danger" onClick={() => removeText(layer.id)}>
        Удалить текст
      </button>
    </div>
  );
}
