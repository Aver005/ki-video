// Инспектор: пять панелей на вкладках shadcn.

import { setTab } from '@shared/model/editor'
import { useStore, type InspectorTab } from '@shared/model/store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import { AudioTab } from '@widgets/inspector/ui/AudioTab'
import { ColorTab } from '@widgets/inspector/ui/ColorTab'
import { ExportTab } from '@widgets/inspector/ui/ExportTab'
import { ItemTab } from '@widgets/inspector/ui/ItemTab'
import { SubtitlesTab } from '@widgets/inspector/ui/SubtitlesTab'

const TABS: { id: InspectorTab; label: string; view: () => React.ReactNode }[] =
    [
        { id: 'item', label: 'Элемент', view: () => <ItemTab /> },
        { id: 'color', label: 'Цвет', view: () => <ColorTab /> },
        { id: 'audio', label: 'Звук', view: () => <AudioTab /> },
        { id: 'subtitles', label: 'Субтитры', view: () => <SubtitlesTab /> },
        { id: 'export', label: 'Экспорт', view: () => <ExportTab /> },
    ]

export function Inspector()
{
    const tab = useStore((s) => s.tab)
    return (
        <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => setTab(key as InspectorTab)}
            className="flex h-full flex-col"
        >
            <TabsList className="w-full">
                {TABS.map((t) => (
                    <TabsTrigger key={t.id} id={t.id} className="flex-1">
                        {t.label}
                    </TabsTrigger>
                ))}
            </TabsList>
            {TABS.map((t) => (
                <TabsContent
                    key={t.id}
                    id={t.id}
                    className="flex-1 overflow-y-auto"
                >
                    {t.view()}
                </TabsContent>
            ))}
        </Tabs>
    )
}
