import { updateItem } from '@app/store/actions'
import { Slider } from '@app/components/Slider'
import { TimingRow } from '@app/components/editors/TimingRow'
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
    { key: 'width', label: 'Ширина', min: 0.02, max: 2 },
    { key: 'rotation', label: 'Поворот', min: -180, max: 180 },
    { key: 'opacity', label: 'Непрозрачность', min: 0, max: 1 },
]

export function BoxEditor({ item, asset, withGeometry }: BoxEditorProps)
{
    const patchBox = (patch: Partial<OverlayBox>, final: boolean) =>
        updateItem(item.id, { box: { ...item.box, ...patch } }, final)
    const hasSound = asset?.audioCodec !== null && asset !== undefined
    return (
        <div className="tab-body">
            <div className="section-title">
                {withGeometry ? 'Наложение' : 'Звук'} · {asset?.name ?? '—'}
            </div>
            {withGeometry &&
                GEOMETRY.map((field) => (
                    <Slider
                        key={field.key}
                        label={field.label}
                        value={item.box[field.key]}
                        min={field.min}
                        max={field.max}
                        step={field.key === 'rotation' ? 1 : 0.01}
                        onChange={(v, final) =>
                            patchBox({ [field.key]: v }, final)
                        }
                    />
                ))}
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
