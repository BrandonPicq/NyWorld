import { useMemo, useState } from "react";
import { createRuntimeContentCatalogSnapshot } from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { ContentTab } from "./ContentTab";
import { useItemDraft } from "./useItemDraft";
import { ZoneViewerPanel } from "./zone/ZoneViewerPanel";

type ContentEditorScreenProps = {
  onBack: () => void;
};

type EditorTab = "content" | "zones";

export function ContentEditorScreen({ onBack }: ContentEditorScreenProps) {
  const baseSnapshot = useMemo(() => createRuntimeContentCatalogSnapshot(), []);
  const [tab, setTab] = useState<EditorTab>("content");
  const draft = useItemDraft(baseSnapshot);

  return (
    <main
      className="app-shell app-shell--bounded editor-screen"
      aria-labelledby="editor-heading"
    >
      <div className="editor-shell">
        <header className="editor-header">
          <div>
            <p className="terminal-kicker">NYWARUDO // DEV CONTENT</p>
            <h1 className="terminal-heading-md" id="editor-heading">
              Content Editor
            </h1>
          </div>
          <TerminalButton className="editor-header__back" onClick={onBack}>
            Back
          </TerminalButton>
        </header>

        <nav className="editor-tabs" aria-label="Editor sections">
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "content"}
            onClick={() => setTab("content")}
          >
            Content
          </TerminalButton>
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "zones"}
            onClick={() => setTab("zones")}
          >
            Zones
          </TerminalButton>
        </nav>

        {tab === "zones" ? (
          <ZoneViewerPanel snapshot={baseSnapshot} />
        ) : (
          <ContentTab draft={draft} />
        )}
      </div>
    </main>
  );
}
