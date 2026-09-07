interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (value: number, final: boolean) => void;
}

export function Slider({ label, value, min, max, step = 0.01, format, onChange }: SliderProps) {
  const shown = format ? format(value) : value.toFixed(step >= 1 ? 0 : 2);
  return (
    <label className="slider">
      <span className="slider__label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value), false)}
        onPointerUp={(e) => onChange(Number((e.target as HTMLInputElement).value), true)}
        onKeyUp={(e) => onChange(Number((e.target as HTMLInputElement).value), true)}
      />
      <span className="slider__value">{shown}</span>
    </label>
  );
}
