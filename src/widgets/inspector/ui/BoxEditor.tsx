import { Toggle } from '@shared/ui/toggle'
import { Button } from '@shared/ui/button'
import { KeyChip } from '@widgets/inspector/ui/KeyChip'
import { seek } from '@entities/player'
import { Diamond, RotateCcw } from 'lucide-react'
import {
    addBoxKey,
    boxAt,
    clearBoxKeys,
    removeBoxKey,
    setBox,
    updateItem,
} from '@entities/project'
import { SliderField } from '@shared/ui/kit/SliderField'
import { TimingRow } from '@widgets/inspector/ui/TimingRow'
import { KEY_EPSILON } from '@core/keys'
import type { MediaAsset, MediaItem, OverlayBox } from '@core/model'
import { DEFAULT_BOX } from '@core/model'

interface BoxEditorProps
{
    item: MediaItem
    asset: MediaAsset | undefined
    /** Наложение показывает геометрию, звуковая дорожка — только громкость и фейды. */
    withGeometry: boolean
}

const GEOMETRY:
{
    key: keyof OverlayBox
    label: string
    min: number
    max: number
}[] = [
    { key: 'x', label: 'Центр X', min: 0, max: 1 },
    { key: 'y', label: 'Центр Y', min: 0, max: 1 },
    { key: 'width', label: 'Ширина', min: 0.005, max: 2 },
    { key: 'rotation', label: 'Поворот', min: -180, max: 180 },
    { key: 'opacity', label: 'Непрозрачность', min: 0, max: 1 },
]

export function BoxEditor({ item, asset, withGeometry }: BoxEditorProps)
{
    const at = boxAt(item)
    const hasSound = asset !== undefined && asset.audioCodec !== null
    return (
        <div className="flex flex-col gap-2.5 p-3">
            <div className="text-xs tracking-wider text-muted-foreground uppercase">
                {withGeometry ? 'Наложение' : 'Звук'} · {asset?.name ?? '—'}
            </div>
            {withGeometry && (
                <>
                    {GEOMETRY.map((field) => (
                        <SliderField
                            key={field.key}
                            label={field.label}
                            value={at.box[field.key]}
                            min={field.min}
                            max={field.max}
                            neutral={DEFAULT_BOX[field.key]}
                            step={
                                field.key === 'width'
                                    ? 0.005
                                    : field.key === 'rotation'
                                      ? 1
                                      : 0.01
                            }
                            onChange={(v, final) =>
                                setBox(item.id, { [field.key]: v }, final)
                            }
                        />
                    ))}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Toggle
                            isSelected={at.keyframe !== undefined}
                            isDisabled={!at.inside}
                            onChange={(add) =>
                                add ? addBoxKey(item.id) : removeBoxKey(item.id)
                            }
                        >
                            <Diamond />
                            {at.keyframe
                                ? 'Убрать ключ'
                                : `Ключ на ${at.localT.toFixed(2)}s`}
                        </Toggle>
                        <Button
                            variant="ghost"
                            onPress={() => clearBoxKeys(item.id)}
                            isDisabled={item.boxKeys.length === 0}
                        >
                            <RotateCcw />
                            Сбросить
                        </Button>
                    </div>
                    {!at.inside && (
                        <p className="text-muted-foreground">
                            Курсор вне элемента: ключ ставится там, где видно
                            наложение.
                        </p>
                    )}
                    {item.boxKeys.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {item.boxKeys.map((k) => (
                                <KeyChip
                                    key={k.t}
                                    active={
                                        Math.abs(k.t - at.localT) <= KEY_EPSILON
                                    }
                                    onPress={() => seek(item.start + k.t)}
                                >
                                    {k.t.toFixed(2)}s
                                </KeyChip>
                            ))}
                        </div>
                    )}
                </>
            )}
            <div className="text-xs tracking-wider text-muted-foreground uppercase">
                Появление
            </div>
            <SliderField
                label="Ввод, с"
                value={item.fadeIn}
                min={0}
                max={Math.max(0.5, item.duration / 2)}
                neutral={0}
                onChange={(v, final) =>
                    updateItem(item.id, { fadeIn: v }, final)
                }
            />
            <SliderField
                label="Уход, с"
                value={item.fadeOut}
                min={0}
                max={Math.max(0.5, item.duration / 2)}
                neutral={0}
                onChange={(v, final) =>
                    updateItem(item.id, { fadeOut: v }, final)
                }
            />
            {hasSound && (
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
            )}
            <TimingRow item={item} asset={asset} />
        </div>
    )
}
