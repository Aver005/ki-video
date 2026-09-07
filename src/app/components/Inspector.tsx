import { useStore, type InspectorTab } from '@shared/model/store'
import { setTab } from '@shared/model/editor'
import { ItemTab } from '@app/components/tabs/ItemTab'
import { ColorTab } from '@app/components/tabs/ColorTab'
import { AudioTab } from '@app/components/tabs/AudioTab'
import { SubtitlesTab } from '@app/components/tabs/SubtitlesTab'
import { ExportTab } from '@app/components/tabs/ExportTab'

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
    const active = TABS.find((t) => t.id === tab) ?? TABS[0]
    return (
        <div className="inspector">
            <nav className="tabs" role="tablist">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        role="tab"
                        aria-selected={t.id === tab}
                        className={`tab ${t.id === tab ? 'tab--active' : ''}`}
                        onClick={() => setTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>
            <div className="inspector__body" role="tabpanel">
                {active?.view()}
            </div>
        </div>
    )
}
