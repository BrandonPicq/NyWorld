import { useMemo, useState } from "react";
import { createRuntimeContentCatalogSnapshot } from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { ActionsTab } from "./actions/ActionsTab";
import { ContentTab } from "./ContentTab";
import { DialogueTab } from "./dialogues/DialogueTab";
import { EnemyTab } from "./enemies/EnemyTab";
import { GameConfigPanel } from "./GameConfigPanel";
import { NpcTab } from "./npcs/NpcTab";
import { PresenceTab } from "./presence/PresenceTab";
import { useEditorDrafts } from "./useEditorDrafts";
import { ZoneEditorPanel } from "./zone/ZoneEditorPanel";

type ContentEditorScreenProps = {
  onBack: () => void;
};

type EditorTab =
  | "content"
  | "zones"
  | "game"
  | "dialogues"
  | "npcs"
  | "presence"
  | "enemies"
  | "actions";

export function ContentEditorScreen({ onBack }: ContentEditorScreenProps) {
  const baseSnapshot = useMemo(() => createRuntimeContentCatalogSnapshot(), []);
  const [tab, setTab] = useState<EditorTab>("content");
  const drafts = useEditorDrafts(baseSnapshot);
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
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "presence"}
            onClick={() => setTab("presence")}
          >
            Presence
          </TerminalButton>
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "enemies"}
            onClick={() => setTab("enemies")}
          >
            Enemies
          </TerminalButton>
          <TerminalButton
            className="editor-tab"
            isSelected={tab === "actions"}
            onClick={() => setTab("actions")}
          >
            Actions
          </TerminalButton>
        </nav>

        {tab === "zones" ? (
          <ZoneEditorPanel draft={drafts.zone} snapshot={baseSnapshot} />
        ) : tab === "game" ? (
          <GameConfigPanel draft={drafts.game} />
        ) : tab === "dialogues" ? (
          <DialogueTab draft={drafts.dialogue} />
        ) : tab === "npcs" ? (
          <NpcTab draft={drafts.npc} />
        ) : tab === "presence" ? (
          <PresenceTab draft={drafts.presence} />
        ) : tab === "enemies" ? (
          <EnemyTab draft={drafts.enemy} />
        ) : tab === "actions" ? (
          <ActionsTab draft={drafts.action} />
        ) : (
          <ContentTab draft={drafts.item} />
        )}
      </div>
    </main>
  );
}
