import { useMemo, useState } from "react";
import { createRuntimeContentCatalogSnapshot } from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { ContentTab } from "./ContentTab";
import { DialogueTab } from "./dialogues/DialogueTab";
import { useDialogueDraft } from "./dialogues/useDialogueDraft";
import { GameConfigPanel } from "./GameConfigPanel";
import { NpcTab } from "./npcs/NpcTab";
import { useNpcDraft } from "./npcs/useNpcDraft";
import { useItemDraft } from "./useItemDraft";
import { ZoneEditorPanel } from "./zone/ZoneEditorPanel";

type ContentEditorScreenProps = {
  onBack: () => void;
};

type EditorTab = "content" | "zones" | "game" | "dialogues" | "npcs";

export function ContentEditorScreen({ onBack }: ContentEditorScreenProps) {
  const baseSnapshot = useMemo(() => createRuntimeContentCatalogSnapshot(), []);
  const [tab, setTab] = useState<EditorTab>("content");
  const itemDraft = useItemDraft(baseSnapshot);
  const dialogueDraft = useDialogueDraft(baseSnapshot);
  const npcDraft = useNpcDraft(baseSnapshot);
  const shellClasses = ["editor-shell", tab === "zones" && "editor-shell--zones"]
    .filter(Boolean)
    .join(" ");

  return (
    <main
      className="app-shell app-shell--bounded editor-screen"
      aria-labelledby="editor-heading"
    >
      <div className={shellClasses}>
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
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "game"}
            onClick={() => setTab("game")}
          >
            Game
          </TerminalButton>
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "dialogues"}
            onClick={() => setTab("dialogues")}
          >
            Dialogues
          </TerminalButton>
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "npcs"}
            onClick={() => setTab("npcs")}
          >
            NPCs
          </TerminalButton>
        </nav>

        {tab === "zones" ? (
          <ZoneEditorPanel snapshot={baseSnapshot} />
        ) : tab === "game" ? (
          <GameConfigPanel snapshot={baseSnapshot} />
        ) : tab === "dialogues" ? (
          <DialogueTab draft={dialogueDraft} />
        ) : tab === "npcs" ? (
          <NpcTab draft={npcDraft} />
        ) : (
          <ContentTab draft={itemDraft} />
        )}
      </div>
    </main>
  );
}
