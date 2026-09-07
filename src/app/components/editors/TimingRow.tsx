import { maxDuration, placeItem, removeItem } from '@app/store/actions'
import { NumberField } from '@app/components/NumberField'
import { MIN_ITEM_SECONDS, isMediaItem } from '@shared/model'
import type { Item, MediaAsset } from '@shared/model'

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
                    value={item.start}
                    onCommit={(start) =>
                        placeItem(item.id, { start, duration: item.duration })
                    }
                />
                <NumberField
                    label="Длина, с"
                    value={item.duration}
                    min={MIN_ITEM_SECONDS}
                    onCommit={(duration) =>
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
                Удалить элемент
            </button>
        </>
    )
}
