import { thumbUrl } from '@app/api'
import { addClipFromAsset, removeAsset } from '@app/store/actions'
import { formatTime } from '@shared/math'
import type { MediaAsset } from '@shared/model'

interface AssetCardProps
{
    asset: MediaAsset
    progress: number
}

export function AssetCard({ asset, progress }: AssetCardProps)
{
    const ready = asset.status === 'ready'
    return (
        <div
            className={`asset ${ready ? '' : 'asset--busy'}`}
            title={asset.path}
        >
            <div className="asset__thumb">
                {ready && <img src={thumbUrl(asset.id, 1)} alt="" />}
            </div>
            <div className="asset__body">
                <div className="asset__name">{asset.name}</div>
                <div className="muted">
                    {formatTime(asset.duration, false)} · {asset.width}×
                    {asset.height} · {asset.videoCodec}
                </div>
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
                    onClick={() => addClipFromAsset(asset)}
                    title="На таймлайн"
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
