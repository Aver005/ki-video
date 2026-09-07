import { Button } from '@shared/ui/button'
import { Pencil } from 'lucide-react'
import { useStore } from '@shared/model/store'
import { addText, currentContent, selectedItem } from '@entities/project'
import { select, setTab } from '@shared/model/editor'
import { PresetRow } from '@shared/ui/kit/PresetRow'
import { QuickPreset } from '@widgets/inspector/ui/QuickPreset'
import { FrameEditor } from '@widgets/inspector/ui/FrameEditor'
import { BoxEditor } from '@widgets/inspector/ui/BoxEditor'
import { TextEditor } from '@widgets/inspector/ui/TextEditor'
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
        <div className="flex flex-col gap-2.5 p-3">
            {current ? (
                <Button
                    variant="outline"
                    onPress={() =>
                    {
                        select({ kind: 'item', id: current.item.id })
                        setTab('item')
                    }}
                >
                    <Pencil />
                    Править кадр: {current.asset.name}
                </Button>
            ) : (
                <p className="text-muted-foreground">
                    Выдели элемент на таймлайне или перетащи файл из списка
                    слева на дорожку.
                </p>
            )}
            <div className="text-xs tracking-wider text-muted-foreground uppercase">
                Добавить текст под курсором
            </div>
            <PresetRow
                presets={TEXT_PRESETS}
                onPick={(preset) => addText(preset.id)}
            />
            <QuickPreset />
        </div>
    )
}
