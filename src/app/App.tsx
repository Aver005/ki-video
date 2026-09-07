import { useBootstrap } from "@app/hooks/useBootstrap";
import { useKeyboard } from "@app/hooks/useKeyboard";
import { usePlayerBinding } from "@app/hooks/usePlayer";
import { Header } from "@app/components/Header";
import { MediaBin } from "@app/components/MediaBin";
import { Preview } from "@app/components/Preview";
import { Transport } from "@app/components/Transport";
import { Inspector } from "@app/components/Inspector";
import { Timeline } from "@app/components/Timeline";
import { Notice } from "@app/components/Notice";

export function App() {
  useBootstrap();
  usePlayerBinding();
  useKeyboard();
  return (
    <div className="app">
      <Header />
      <aside className="app__bin">
        <MediaBin />
      </aside>
      <main className="app__stage">
        <Preview />
        <Transport />
      </main>
      <aside className="app__inspector">
        <Inspector />
      </aside>
      <footer className="app__timeline">
        <Timeline />
      </footer>
      <Notice />
    </div>
  );
}
