import { Textarea } from '@shared/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@shared/ui/native-select'
import { Field } from '@shared/ui/kit/Field'
import { updateItem } from '@entities/project'
import { SliderField } from '@shared/ui/kit/SliderField'
import { TimingRow } from '@widgets/inspector/ui/TimingRow'
import type { TextAnimation, TextItem } from '@core/model'

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
        <div className="flex flex-col gap-2.5 p-3">
            <div className="text-xs tracking-wider text-muted-foreground uppercase">
                Текст
            </div>
            <Textarea
                value={item.text}
                rows={3}
                aria-label="Текст слоя"
                onChange={(e) => patch({ text: e.target.value }, false)}
                onBlur={() => patch({}, true)}
            />
            <SliderField
                label="X"
                value={item.x}
                min={0}
                max={1}
                neutral={0.5}
                onChange={(v, final) => patch({ x: v }, final)}
            />
            <SliderField
                label="Y"
                value={item.y}
                min={0}
                max={1}
                neutral={0.5}
                onChange={(v, final) => patch({ y: v }, final)}
            />
            <SliderField
                label="Кегль"
                value={item.size}
                min={24}
                max={200}
                step={1}
                onChange={(v, final) => patch({ size: v }, final)}
            />
            <div className="flex gap-2">
                <Field label="Цвет">
                    <input
                        type="color"
                        className="h-8 w-full cursor-pointer rounded-lg border border-input bg-transparent p-1"
                        value={item.color}
                        onChange={(e) =>
                            patch({ color: e.target.value }, false)
                        }
                        onBlur={() => patch({}, true)}
                    />
                </Field>
                <Field label="Обводка">
                    <input
                        type="color"
                        className="h-8 w-full cursor-pointer rounded-lg border border-input bg-transparent p-1"
                        value={item.outline}
                        onChange={(e) =>
                            patch({ outline: e.target.value }, false)
                        }
                        onBlur={() => patch({}, true)}
                    />
                </Field>
                <Field label="Анимация">
                    <NativeSelect
                        value={item.animation}
                        onChange={(e) =>
                            isAnimation(e.target.value) &&
                            patch({ animation: e.target.value })
                        }
                    >
                        {ANIMATIONS.map((a) => (
                            <NativeSelectOption key={a.value} value={a.value}>
                                {a.label}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                </Field>
            </div>
            <TimingRow item={item} asset={undefined} />
        </div>
    )
}
