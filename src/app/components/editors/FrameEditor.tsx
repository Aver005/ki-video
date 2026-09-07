import { Crosshair, Diamond, RotateCcw, Scissors } from 'lucide-react'
import {
    addKeyframe,
    clearKeyframes,
    currentContent,
    removeKeyframe,
    seek,
    setFrame,
    splitAtPlayhead,
    updateItem,
} from '@app/store/actions'
import { SliderField } from '@shared/ui/kit/SliderField'
import { TimingRow } from '@app/components/editors/TimingRow'
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
            <div className="tab-body">
                <p className="muted">
                    Курсор стоит вне этого элемента: окно кадра правится там,
                    где его видно.
                </p>
                <button className="btn" onClick={() => seek(item.start + 0.1)}>
                    <Crosshair />
                    Перейти к элементу
                </button>
                <TimingRow item={item} asset={asset} />
            </div>
        )
    }
    const { frame, keyframe, localT } = current
    return (
        <div className="tab-body">
            <div className="section-title">
                Кадр · {asset.name}
                <span className="muted"> {localT.toFixed(2)}s</span>
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
            <div className="row-actions">
                <button
                    className={`btn ${keyframe ? 'btn--active' : ''}`}
                    onClick={() =>
                        keyframe ? removeKeyframe() : addKeyframe()
                    }
                >
                    <Diamond />
                    {keyframe ? 'Убрать ключ' : `Ключ на ${localT.toFixed(2)}s`}
                </button>
                <button
                    className="btn btn--ghost"
                    onClick={clearKeyframes}
                    disabled={item.frame.length === 0}
                >
                    <RotateCcw />
                    Сбросить
                </button>
                <button className="btn btn--ghost" onClick={splitAtPlayhead}>
                    <Scissors />
                    Разрезать
                </button>
            </div>
            {item.frame.length > 0 && (
                <div className="presets">
                    {item.frame.map((k) => (
                        <button
                            key={k.t}
                            className={`chip ${Math.abs(k.t - localT) <= KEY_EPSILON ? 'chip--active' : ''}`}
                            onClick={() => seek(item.start + k.t)}
                        >
                            {k.t.toFixed(2)}s · {k.zoom.toFixed(1)}×
                        </button>
                    ))}
                </div>
            )}
            <div className="section-title">Звук и переход</div>
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
            <label className="field">
                <span>Переход при наезде на предыдущий</span>
                <select
                    value={item.transition}
                    onChange={(e) =>
                        isTransition(e.target.value) &&
                        updateItem(item.id, { transition: e.target.value })
                    }
                >
                    {TRANSITIONS.map((t) => (
                        <option key={t.id} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </label>
            <p className="muted">
                Наезд элементов на дорожке содержимого и есть длительность
                перехода.
            </p>
            <TimingRow item={item} asset={asset} />
        </div>
    )
}
