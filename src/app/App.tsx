import { useBootstrap } from '@app/hooks/useBootstrap'
import { useKeyboard } from '@app/hooks/useKeyboard'
import { usePlayerBinding } from '@entities/player'
import { MediaBin } from '@widgets/media-bin'
import { Preview } from '@widgets/preview'
import { Inspector } from '@widgets/inspector'
import { Timeline } from '@widgets/timeline'
import { Splitter } from '@shared/ui/kit/Splitter'
import { Notice } from '@widgets/notice'
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
            className="grid h-screen"
            style={
            {
                gridTemplateColumns: `${binWidth}px minmax(0, 1fr) ${inspectorWidth}px`,
                gridTemplateRows: `44px minmax(0, 1fr) ${timelineHeight}px`,
                gridTemplateAreas:
                    "'header header header' 'bin stage inspector' 'timeline timeline timeline'",
            }}
        >
            <AppHeader />
            <aside className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r bg-card [grid-area:bin]">
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
            <main className="flex min-h-0 min-w-0 flex-col [grid-area:stage]">
                <Preview />
                <TransportBar />
            </main>
            <aside className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-l bg-card [grid-area:inspector]">
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
            <footer className="relative min-h-0 border-t bg-card [grid-area:timeline]">
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
