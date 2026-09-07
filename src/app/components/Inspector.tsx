import { useStore, type InspectorTab } from '@app/store/store'
import { setTab } from '@app/store/actions'
import { FrameTab } from '@app/components/tabs/FrameTab'
import { ColorTab } from '@app/components/tabs/ColorTab'
import { AudioTab } from '@app/components/tabs/AudioTab'
import { TextTab } from '@app/components/tabs/TextTab'
import { SubtitlesTab } from '@app/components/tabs/SubtitlesTab'
import { ExportTab } from '@app/components/tabs/ExportTab'

const TABS: { id: InspectorTab; label: string; view: () => React.ReactNode }[] =
    [
        { id: 'frame', label: 'Кадр', view: () => <FrameTab /> },
        { id: 'color', label: 'Цвет', view: () => <ColorTab /> },
        { id: 'audio', label: 'Звук', view: () => <AudioTab /> },
        { id: 'text', label: 'Текст', view: () => <TextTab /> },
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
