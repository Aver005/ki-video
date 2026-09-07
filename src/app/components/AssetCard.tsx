import { Music, Plus, X } from 'lucide-react'
import { thumbUrl } from '@app/api'
import { addAssetToTimeline, removeAsset } from '@app/store/actions'
import { ASSET_DRAG_TYPE } from '@app/components/TrackLane'
import { formatTime } from '@shared/math'
import type { BinView } from '@app/store/store'
import type { MediaAsset } from '@shared/model'

interface AssetCardProps
{
    asset: MediaAsset
    view: BinView
    progress: number
}

const KIND_LABEL: Record<MediaAsset['kind'], string> =
{
    video: 'видео',
    image: 'картинка',
    audio: 'звук',
}

/** В узких видах строка короче: кодек не влезает и всё равно виден в подсказке. */
function details(asset: MediaAsset, view: BinView): string
{
    const size = `${asset.width}×${asset.height}`
    const time = formatTime(asset.duration, false)
    const short = view !== 'list'
    if (asset.kind === 'image') return short ? size : `картинка · ${size}`
    if (asset.kind === 'audio')
        return short
            ? `звук · ${time}`
            : `звук · ${time} · ${asset.audioCodec ?? '—'}`
    return short
        ? `${time} · ${size}`
        : `${time} · ${size} · ${asset.videoCodec ?? '—'}`
}

export function AssetCard({ asset, view, progress }: AssetCardProps)
{
    const ready = asset.status === 'ready'
    return (
        <div
            className={`asset asset--${view} ${ready ? '' : 'asset--busy'}`}
            title={asset.path}
            draggable={ready}
            onDragStart={(e) =>
            {
                e.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id)
                e.dataTransfer.effectAllowed = 'copy'
            }}
        >
            <div className="asset__thumb">
                {ready && asset.kind !== 'audio' && (
                    <img src={thumbUrl(asset.id, 1)} alt="" />
                )}
                {asset.kind === 'audio' && (
                    <span className="asset__kind">
                        <Music />
                    </span>
                )}
            </div>
            <div className="asset__body">
                <div className="asset__name">{asset.name}</div>
                <div className="asset__meta muted">{details(asset, view)}</div>
                {asset.status === 'processing' && (
                    <div className="progress">
                        <div
                            className="progress__bar"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                    </div>
                )}
                {asset.status === 'error' && (
                    <div className="error">{asset.error}</div>
                )}
            </div>
            <div className="asset__actions">
                <button
                    className="btn btn--small"
                    disabled={!ready}
                    onClick={() => addAssetToTimeline(asset)}
                    title={`На таймлайн (${KIND_LABEL[asset.kind]}); можно и перетащить на дорожку`}
                    aria-label="Добавить на таймлайн"
                >
                    <Plus />
                </button>
                <button
                    className="btn btn--small btn--ghost"
                    onClick={() => removeAsset(asset.id)}
                    title="Убрать"
                    aria-label="Убрать из списка"
                >
                    <X />
                </button>
            </div>
        </div>
    )
}
