import { useState } from "react";

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onCommit: (value: number) => void;
}

/** Числовое поле, которое не мешает печатать: значение уходит наружу на blur или Enter. */
export function NumberField({ label, value, min = 0, step = 0.1, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const parsed = Number(draft);
    if (draft !== null && draft.trim() !== "" && Number.isFinite(parsed)) onCommit(Math.max(min, parsed));
    setDraft(null);
  };
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        value={draft ?? value.toFixed(2)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </label>
  );
}
