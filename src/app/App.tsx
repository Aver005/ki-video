import { useBootstrap } from '@app/hooks/useBootstrap'
import { useKeyboard } from '@app/hooks/useKeyboard'
import { usePlayerBinding } from '@entities/player'
import { MediaBin } from '@app/components/MediaBin'
import { Preview } from '@app/components/Preview'
import { Inspector } from '@app/components/Inspector'
import { Timeline } from '@app/components/Timeline'
import { Splitter } from '@app/components/Splitter'
import { Notice } from '@app/components/Notice'
import { AppHeader } from '@widgets/app-header'
import { TransportBar } from '@widgets/transport'
import { resizeLayout, useStore } from '@shared/model/store'

export function App()
{
    useBootstrap()
    usePlayerBinding()
    useKeyboard()
    const binWidth = useStore((s) => s.binWidth)
    const inspectorWidth = useStore((s) => s.inspectorWidth)
    const timelineHeight = useStore((s) => s.timelineHeight)
    return (
        <div
            className="app"
            style={
            {
                gridTemplateColumns: `${binWidth}px minmax(0, 1fr) ${inspectorWidth}px`,
                gridTemplateRows: `44px minmax(0, 1fr) ${timelineHeight}px`,
            }}
        >
            <AppHeader />
            <aside className="app__bin">
                <MediaBin />
                <Splitter
                    side="right"
                    value={binWidth}
                    min={180}
                    max={560}
                    onChange={(v, final) =>
                        resizeLayout({ binWidth: v }, final)
                    }
                />
            </aside>
            <main className="app__stage">
                <Preview />
                <TransportBar />
            </main>
            <aside className="app__inspector">
                <Splitter
                    side="left"
                    value={inspectorWidth}
                    min={280}
                    max={720}
                    onChange={(v, final) =>
                        resizeLayout({ inspectorWidth: v }, final)
                    }
                />
                <Inspector />
            </aside>
            <footer className="app__timeline">
                <Splitter
                    side="top"
                    value={timelineHeight}
                    min={160}
                    max={800}
                    onChange={(v, final) =>
                        resizeLayout({ timelineHeight: v }, final)
                    }
                />
                <Timeline />
            </footer>
            <Notice />
        </div>
    )
}
