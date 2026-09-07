import { useBootstrap } from '@app/hooks/useBootstrap'
import { useKeyboard } from '@app/hooks/useKeyboard'
import { usePlayerBinding } from '@app/hooks/usePlayer'
import { Header } from '@app/components/Header'
import { MediaBin } from '@app/components/MediaBin'
import { Preview } from '@app/components/Preview'
import { Transport } from '@app/components/Transport'
import { Inspector } from '@app/components/Inspector'
import { Timeline } from '@app/components/Timeline'
import { Splitter } from '@app/components/Splitter'
import { Notice } from '@app/components/Notice'
import { getState, saveLayout, setState, useStore } from '@app/store/store'

function resize(
    patch: { inspectorWidth?: number; timelineHeight?: number },
    final: boolean,
): void
{
    setState(patch)
    if (!final) return
    const { inspectorWidth, timelineHeight } = getState()
    saveLayout({ inspectorWidth, timelineHeight })
}

export function App()
{
    useBootstrap()
    usePlayerBinding()
    useKeyboard()
    const inspectorWidth = useStore((s) => s.inspectorWidth)
    const timelineHeight = useStore((s) => s.timelineHeight)
    return (
        <div
            className="app"
            style={
            {
                gridTemplateColumns: `260px minmax(0, 1fr) ${inspectorWidth}px`,
                gridTemplateRows: `44px minmax(0, 1fr) ${timelineHeight}px`,
            }}
        >
            <Header />
            <aside className="app__bin">
                <MediaBin />
            </aside>
            <main className="app__stage">
                <Preview />
                <Transport />
            </main>
            <aside className="app__inspector">
                <Splitter
                    axis="x"
                    value={inspectorWidth}
                    min={280}
                    max={720}
                    onChange={(v, final) =>
                        resize({ inspectorWidth: v }, final)
                    }
                />
                <Inspector />
            </aside>
            <footer className="app__timeline">
                <Splitter
                    axis="y"
                    value={timelineHeight}
                    min={160}
                    max={800}
                    onChange={(v, final) =>
                        resize({ timelineHeight: v }, final)
                    }
                />
                <Timeline />
            </footer>
            <Notice />
        </div>
    )
}
