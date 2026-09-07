import { Pencil } from 'lucide-react'
import { useStore } from '@shared/model/store'
import { addText, currentContent, selectedItem } from '@entities/project'
import { select, setTab } from '@shared/model/editor'
import { PresetRow } from '@shared/ui/kit/PresetRow'
import { QuickPreset } from '@app/components/QuickPreset'
import { FrameEditor } from '@app/components/editors/FrameEditor'
import { BoxEditor } from '@app/components/editors/BoxEditor'
import { TextEditor } from '@app/components/editors/TextEditor'
import { TEXT_PRESETS } from '@core/presets'
import { isMediaItem, isTextItem } from '@core/model'

/** Свойства выделенного элемента; без выделения — кадр под курсором и что можно добавить. */
export function ItemTab()
{
    // Читает проект, выделение, время и файлы: подписываемся на всё, иначе панель отстаёт.
    useStore((s) => s.project)
    useStore((s) => s.selection)
    useStore((s) => s.time)
    useStore((s) => s.assets)

    const selected = selectedItem()
    if (selected)
    {
        const { item, track, asset } = selected
        if (isTextItem(item)) return <TextEditor item={item} />
        if (isMediaItem(item) && track.kind === 'content' && asset)
            return <FrameEditor item={item} asset={asset} />
        if (isMediaItem(item))
            return (
                <BoxEditor
                    item={item}
                    asset={asset}
                    withGeometry={track.kind === 'overlay'}
                />
            )
    }

    const current = currentContent()
    return (
        <div className="tab-body">
            {current ? (
                <button
                    className="btn"
                    onClick={() =>
                    {
                        select({ kind: 'item', id: current.item.id })
                        setTab('item')
                    }}
                >
                    <Pencil />
                    Править кадр: {current.asset.name}
                </button>
            ) : (
                <p className="muted">
                    Выдели элемент на таймлайне или перетащи файл из списка
                    слева на дорожку.
                </p>
            )}
            <div className="section-title">Добавить текст под курсором</div>
            <PresetRow
                presets={TEXT_PRESETS}
                onPick={(preset) => addText(preset.id)}
            />
            <QuickPreset />
        </div>
    )
}
