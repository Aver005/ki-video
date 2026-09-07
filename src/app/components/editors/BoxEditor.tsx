import {
    addBoxKey,
    boxAt,
    clearBoxKeys,
    removeBoxKey,
    seek,
    setBox,
    updateItem,
} from '@app/store/actions'
import { Slider } from '@app/components/Slider'
import { TimingRow } from '@app/components/editors/TimingRow'
import { KEY_EPSILON } from '@shared/keys'
import type { MediaAsset, MediaItem, OverlayBox } from '@shared/model'

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
        <div className="tab-body">
            <div className="section-title">
                {withGeometry ? 'Наложение' : 'Звук'} · {asset?.name ?? '—'}
            </div>
            {withGeometry && (
                <>
                    {GEOMETRY.map((field) => (
                        <Slider
                            key={field.key}
                            label={field.label}
                            value={at.box[field.key]}
                            min={field.min}
                            max={field.max}
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
                    <div className="row-actions">
                        <button
                            className={`btn ${at.keyframe ? 'btn--active' : ''}`}
                            disabled={!at.inside}
                            onClick={() =>
                                at.keyframe
                                    ? removeBoxKey(item.id)
                                    : addBoxKey(item.id)
                            }
                            title="Ключ движения наложения"
                        >
                            ◆{' '}
                            {at.keyframe
                                ? 'Убрать ключ'
                                : `Ключ на ${at.localT.toFixed(2)}s`}
                        </button>
                        <button
                            className="btn btn--ghost"
                            onClick={() => clearBoxKeys(item.id)}
                            disabled={item.boxKeys.length === 0}
                        >
                            Сбросить
                        </button>
                    </div>
                    {!at.inside && (
                        <p className="muted">
                            Курсор вне элемента: ключ ставится там, где видно
                            наложение.
                        </p>
                    )}
                    {item.boxKeys.length > 0 && (
                        <div className="presets">
                            {item.boxKeys.map((k) => (
                                <button
                                    key={k.t}
                                    className={`chip ${Math.abs(k.t - at.localT) <= KEY_EPSILON ? 'chip--active' : ''}`}
                                    onClick={() => seek(item.start + k.t)}
                                >
                                    {k.t.toFixed(2)}s
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
            <div className="section-title">Появление</div>
            <Slider
                label="Ввод, с"
                value={item.fadeIn}
                min={0}
                max={Math.max(0.5, item.duration / 2)}
                onChange={(v, final) =>
                    updateItem(item.id, { fadeIn: v }, final)
                }
            />
            <Slider
                label="Уход, с"
                value={item.fadeOut}
                min={0}
                max={Math.max(0.5, item.duration / 2)}
                onChange={(v, final) =>
                    updateItem(item.id, { fadeOut: v }, final)
                }
            />
            {hasSound && (
                <Slider
                    label="Громкость"
                    value={item.volume}
                    min={0}
                    max={2}
                    onChange={(v, final) =>
                        updateItem(item.id, { volume: v }, final)
                    }
                />
            )}
            <TimingRow item={item} asset={asset} />
        </div>
    )
}
