// Карточка файла в медиатеке. Три вида отличаются только раскладкой.

import { Music, Plus, X } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { formatTime } from '@core/math'
import type { MediaAsset } from '@core/model'
import { ASSET_DRAG_TYPE, removeAsset } from '@entities/asset'
import { addAssetToTimeline } from '@entities/project'
import { thumbUrl } from '@shared/api/client'
import type { BinView } from '@shared/model/store'
import { Button } from '@shared/ui/button'

export interface AssetCardProps
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

const card = cva(
    'items-center gap-2 overflow-hidden rounded-lg border bg-card p-1.5',
    {
        variants:
        {
            view:
            {
                list: 'grid grid-cols-[64px_1fr_auto]',
                compact: 'grid grid-cols-[28px_1fr_auto] px-1.5 py-1',
                grid: 'flex flex-col gap-1',
            },
            busy: { true: 'opacity-80', false: '' },
        },
    },
)

const thumb = cva('overflow-hidden rounded bg-black',
{
    variants:
    {
        view:
        {
            list: 'h-10 w-16',
            compact: 'h-[18px] w-7',
            grid: 'aspect-video h-auto w-full',
        },
    },
})

const actions = cva('flex gap-1',
{
    variants:
    {
        view:
        {
            list: 'flex-col',
            compact: 'flex-row',
            grid: 'flex-row justify-end',
        },
    },
})

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
            className={card({ view, busy: !ready })}
            title={asset.path}
            draggable={ready}
            onDragStart={(e) =>
            {
                e.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id)
                e.dataTransfer.effectAllowed = 'copy'
            }}
        >
            <div className={thumb({ view })}>
                {ready && asset.kind !== 'audio' && (
                    <img
                        src={thumbUrl(asset.id, 1)}
                        alt=""
                        className="block size-full object-cover"
                    />
                )}
                {asset.kind === 'audio' && (
                    <span className="flex h-full items-center justify-center text-muted-foreground">
                        <Music />
                    </span>
                )}
            </div>
            <div className="min-w-0">
                <div className="truncate">{asset.name}</div>
                <div className="truncate text-muted-foreground">
                    {details(asset, view)}
                </div>
                {asset.status === 'processing' && (
                    <div className="mt-1 h-1 overflow-hidden rounded-sm bg-muted">
                        <div
                            className="h-full bg-primary transition-[width] duration-200"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                    </div>
                )}
                {asset.status === 'error' && (
                    <div className="text-destructive">{asset.error}</div>
                )}
            </div>
            <div className={actions({ view })}>
                <span
                    className="inline-flex"
                    title={`На таймлайн (${KIND_LABEL[asset.kind]}); можно и перетащить на дорожку`}
                >
                    <Button
                        size="icon-xs"
                        variant="outline"
                        isDisabled={!ready}
                        onPress={() => addAssetToTimeline(asset)}
                        aria-label="Добавить на таймлайн"
                    >
                        <Plus />
                    </Button>
                </span>
                <Button
                    size="icon-xs"
                    variant="ghost"
                    onPress={() => removeAsset(asset.id)}
                    aria-label="Убрать из списка"
                >
                    <X />
                </Button>
            </div>
        </div>
    )
}
