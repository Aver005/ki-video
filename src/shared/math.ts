// Мелкая числовая математика без зависимостей.

export function clamp(value: number, min: number, max: number): number
{
    return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, k: number): number
{
    return a + (b - a) * k
}

/** Округление до кратного шагу: кодеки требуют чётные размеры. */
export function roundTo(value: number, step: number): number
{
    return Math.round(value / step) * step
}

export function formatTime(seconds: number, showMs = true): string
{
    const total = Math.max(0, Math.round(seconds * 100))
    const cs = total % 100
    const whole = Math.floor(total / 100)
    const m = Math.floor(whole / 60)
    const base = `${String(m).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
    return showMs ? `${base}.${String(cs).padStart(2, '0')}` : base
}

/** Числа для ffmpeg-выражений: без экспоненты, с точкой, без хвостовых нулей. */
export function num(value: number, digits = 4): string
{
    const fixed = value.toFixed(digits)
    const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
    return trimmed === '-0' ? '0' : trimmed
}
