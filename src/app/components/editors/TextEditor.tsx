import { updateItem } from '@app/store/actions'
import { Slider } from '@app/components/Slider'
import { TimingRow } from '@app/components/editors/TimingRow'
import type { TextAnimation, TextItem } from '@shared/model'

const ANIMATIONS: { value: TextAnimation; label: string }[] = [
    { value: 'none', label: 'Без анимации' },
    { value: 'fade', label: 'Плавно' },
    { value: 'pop', label: 'Выскок' },
]

function isAnimation(value: string): value is TextAnimation
{
    return ANIMATIONS.some((a) => a.value === value)
}

export function TextEditor({ item }: { item: TextItem })
{
    const patch = (value: Partial<TextItem>, record = true) =>
        updateItem(item.id, value, record)
    return (
        <div className="tab-body">
            <div className="section-title">Текст</div>
            <textarea
                value={item.text}
                rows={3}
                aria-label="Текст слоя"
                onChange={(e) => patch({ text: e.target.value }, false)}
                onBlur={() => patch({}, true)}
            />
            <Slider
                label="X"
                value={item.x}
                min={0}
                max={1}
                onChange={(v, final) => patch({ x: v }, final)}
            />
            <Slider
                label="Y"
                value={item.y}
                min={0}
                max={1}
                onChange={(v, final) => patch({ y: v }, final)}
            />
            <Slider
                label="Кегль"
                value={item.size}
                min={24}
                max={200}
                step={1}
                onChange={(v, final) => patch({ size: v }, final)}
            />
            <div className="field-row">
                <label className="field">
                    <span>Цвет</span>
                    <input
                        type="color"
                        value={item.color}
                        onChange={(e) =>
                            patch({ color: e.target.value }, false)
                        }
                        onBlur={() => patch({}, true)}
                    />
                </label>
                <label className="field">
                    <span>Обводка</span>
                    <input
                        type="color"
                        value={item.outline}
                        onChange={(e) =>
                            patch({ outline: e.target.value }, false)
                        }
                        onBlur={() => patch({}, true)}
                    />
                </label>
                <label className="field">
                    <span>Анимация</span>
                    <select
                        value={item.animation}
                        onChange={(e) =>
                            isAnimation(e.target.value) &&
                            patch({ animation: e.target.value })
                        }
                    >
                        {ANIMATIONS.map((a) => (
                            <option key={a.value} value={a.value}>
                                {a.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <TimingRow item={item} asset={undefined} />
        </div>
    )
}
