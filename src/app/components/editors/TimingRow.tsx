import { Trash } from 'lucide-react'
import { maxDuration, placeItem, removeItem } from '@entities/project'
import { NumberField } from '@shared/ui/kit/NumberField'
import { MIN_ITEM_SECONDS, isMediaItem } from '@core/model'
import type { Item, MediaAsset } from '@core/model'

interface TimingRowProps
{
    item: Item
    asset: MediaAsset | undefined
}

/** Время и длина элемента числами: то же, что тянуть за края на таймлайне. */
export function TimingRow({ item, asset }: TimingRowProps)
{
    const limit =
        isMediaItem(item) && asset ? maxDuration(item, asset) : Infinity
    return (
        <>
            <div className="field-row">
                <NumberField
                    label="Начало, с"
                    className="flex-1"
                    value={item.start}
                    min={0}
                    step={0.1}
                    onChange={(start) =>
                        placeItem(item.id, { start, duration: item.duration })
                    }
                />
                <NumberField
                    label="Длина, с"
                    className="flex-1"
                    value={item.duration}
                    min={MIN_ITEM_SECONDS}
                    step={0.1}
                    onChange={(duration) =>
                        placeItem(item.id,
                        {
                            start: item.start,
                            duration: Math.min(duration, limit),
                        })
                    }
                />
            </div>
            <button
                className="btn btn--danger"
                onClick={() => removeItem(item.id)}
            >
                <Trash />
                Удалить элемент
            </button>
        </>
    )
}
