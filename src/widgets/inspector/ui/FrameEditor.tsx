import { NativeSelect, NativeSelectOption } from '@shared/ui/native-select'
import { Field } from '@shared/ui/kit/Field'
import { Toggle } from '@shared/ui/toggle'
import { Button } from '@shared/ui/button'
import { KeyChip } from '@widgets/inspector/ui/KeyChip'
import { seek } from '@entities/player'
import { Crosshair, Diamond, RotateCcw, Scissors } from 'lucide-react'
import {
    addKeyframe,
    clearKeyframes,
    currentContent,
    removeKeyframe,
    setFrame,
    updateItem,
} from '@entities/project'
import { splitAtPlayhead } from '@features/split-item'
import { SliderField } from '@shared/ui/kit/SliderField'
import { TimingRow } from '@widgets/inspector/ui/TimingRow'
import { MAX_ZOOM, MIN_ZOOM } from '@core/frame'
import { KEY_EPSILON } from '@core/keys'
import { TRANSITIONS } from '@core/presets'
import type { MediaAsset, MediaItem, TransitionKind } from '@core/model'

interface FrameEditorProps
{
    item: MediaItem
    asset: MediaAsset
}

function isTransition(value: string): value is TransitionKind
{
    return TRANSITIONS.some((t) => t.value === value)
}

/** Кадр элемента дорожки содержимого: окно, ключи, звук и переход с предыдущим. */
export function FrameEditor({ item, asset }: FrameEditorProps)
{
    const current = currentContent()
    if (!current || current.item.id !== item.id)
    {
        return (
            <div className="flex flex-col gap-2.5 p-3">
                <p className="text-muted-foreground">
                    Курсор стоит вне этого элемента: окно кадра правится там,
                    где его видно.
                </p>
                <Button
                    variant="outline"
                    onPress={() => seek(item.start + 0.1)}
                >
                    <Crosshair />
                    Перейти к элементу
                </Button>
                <TimingRow item={item} asset={asset} />
            </div>
        )
    }
    const { frame, keyframe, localT } = current
    return (
        <div className="flex flex-col gap-2.5 p-3">
            <div className="text-xs tracking-wider text-muted-foreground uppercase">
                Кадр · {asset.name}
                <span className="text-muted-foreground">
                    {' '}
                    {localT.toFixed(2)}s
                </span>
            </div>
            <SliderField
                label="Центр X"
                value={frame.cx}
                min={0}
                max={asset.width}
                step={1}
                neutral={asset.width / 2}
                onChange={(v, final) => setFrame({ cx: v }, final)}
            />
            <SliderField
                label="Центр Y"
                value={frame.cy}
                min={0}
                max={asset.height}
                step={1}
                neutral={asset.height / 2}
                onChange={(v, final) => setFrame({ cy: v }, final)}
            />
            <SliderField
                label="Зум"
                value={frame.zoom}
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                neutral={1}
                unit="×"
                onChange={(v, final) => setFrame({ zoom: v }, final)}
            />
            <div className="flex flex-wrap items-center gap-1.5">
                <Toggle
                    isSelected={keyframe !== undefined}
                    onChange={() =>
                        keyframe ? removeKeyframe() : addKeyframe()
                    }
                >
                    <Diamond />
                    {keyframe ? 'Убрать ключ' : `Ключ на ${localT.toFixed(2)}s`}
                </Toggle>
                <Button
                    variant="ghost"
                    onPress={clearKeyframes}
                    isDisabled={item.frame.length === 0}
                >
                    <RotateCcw />
                    Сбросить
                </Button>
                <Button variant="ghost" onPress={splitAtPlayhead}>
                    <Scissors />
                    Разрезать
                </Button>
            </div>
            {item.frame.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {item.frame.map((k) => (
                        <KeyChip
                            key={k.t}
                            active={Math.abs(k.t - localT) <= KEY_EPSILON}
                            onPress={() => seek(item.start + k.t)}
                        >
                            {k.t.toFixed(2)}s · {k.zoom.toFixed(1)}×
                        </KeyChip>
                    ))}
                </div>
            )}
            <div className="text-xs tracking-wider text-muted-foreground uppercase">
                Звук и переход
            </div>
            <SliderField
                label="Громкость"
                value={item.volume}
                min={0}
                max={2}
                neutral={1}
                onChange={(v, final) =>
                    updateItem(item.id, { volume: v }, final)
                }
            />
            <Field label="Переход при наезде на предыдущий">
                <NativeSelect
                    value={item.transition}
                    onChange={(e) =>
                        isTransition(e.target.value) &&
                        updateItem(item.id, { transition: e.target.value })
                    }
                >
                    {TRANSITIONS.map((t) => (
                        <NativeSelectOption key={t.id} value={t.value}>
                            {t.label}
                        </NativeSelectOption>
                    ))}
                </NativeSelect>
            </Field>
            <p className="text-muted-foreground">
                Наезд элементов на дорожке содержимого и есть длительность
                перехода.
            </p>
            <TimingRow item={item} asset={asset} />
        </div>
    )
}
