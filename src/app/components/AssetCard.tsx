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

function details(asset: MediaAsset): string
{
    if (asset.kind === 'image')
        return `картинка · ${asset.width}×${asset.height}`
    if (asset.kind === 'audio')
        return `звук · ${formatTime(asset.duration, false)} · ${asset.audioCodec ?? '—'}`
    return `${formatTime(asset.duration, false)} · ${asset.width}×${asset.height} · ${asset.videoCodec ?? '—'}`
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
                    <span className="asset__kind">♪</span>
                )}
            </div>
            <div className="asset__body">
                <div className="asset__name">{asset.name}</div>
                <div className="muted">{details(asset)}</div>
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
                    +
                </button>
                <button
                    className="btn btn--small btn--ghost"
                    onClick={() => removeAsset(asset.id)}
                    title="Убрать"
                    aria-label="Убрать из списка"
                >
                    ×
                </button>
            </div>
        </div>
    )
}
