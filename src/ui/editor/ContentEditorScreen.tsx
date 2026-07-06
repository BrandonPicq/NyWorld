import { useEffect, useMemo, useState } from "react";
import { createRuntimeContentCatalogSnapshot } from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { ActionsTab } from "./actions/ActionsTab";
import { ContentTab } from "./ContentTab";
import { DialogueTab } from "./dialogues/DialogueTab";
import { EnemyTab } from "./enemies/EnemyTab";
import { GameConfigPanel } from "./GameConfigPanel";
import { NpcTab } from "./npcs/NpcTab";
import { PresenceTab } from "./presence/PresenceTab";
import { QuestTab } from "./quests/QuestTab";
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
  | "actions"
  | "quests";

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "zones", label: "Zones" },
  { id: "game", label: "Game" },
  { id: "dialogues", label: "Dialogues" },
  { id: "npcs", label: "NPCs" },
  { id: "presence", label: "Presence" },
  { id: "enemies", label: "Enemies" },
  { id: "actions", label: "Actions" },
  { id: "quests", label: "Quests" },
];

export function ContentEditorScreen({ onBack }: ContentEditorScreenProps) {
  const baseSnapshot = useMemo(() => createRuntimeContentCatalogSnapshot(), []);
  const [tab, setTab] = useState<EditorTab>("content");
  const drafts = useEditorDrafts(baseSnapshot);

  useEffect(() => {
    if (!drafts.hasAnyUnsavedChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [drafts.hasAnyUnsavedChanges]);

  function handleBack(): void {
    if (
      !drafts.hasAnyUnsavedChanges ||
      window.confirm("Leave the editor? Unsaved changes will be lost.")
    ) {
      onBack();
    }
  }

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
          <TerminalButton className="editor-header__back" onClick={handleBack}>
            Back
          </TerminalButton>
        </header>

        <nav className="editor-tabs" aria-label="Editor sections">
          {EDITOR_TABS.map((entry) => (
            <EditorTabButton
              hasUnsavedChanges={tabHasUnsavedChanges(
                entry.id,
                drafts.unsavedChanges,
              )}
              isSelected={tab === entry.id}
              key={entry.id}
              label={entry.label}
              onClick={() => setTab(entry.id)}
            />
          ))}
        </nav>

        <div className="editor-tab-content">
          {tab === "zones" ? (
            <ZoneEditorPanel
              draft={drafts.zone}
              snapshot={drafts.combined.snapshot}
            />
          ) : tab === "game" ? (
            <GameConfigPanel
              draft={drafts.game}
              snapshot={drafts.combined.snapshot}
            />
          ) : tab === "dialogues" ? (
            <DialogueTab draft={drafts.dialogue} />
          ) : tab === "npcs" ? (
            <NpcTab draft={drafts.npc} />
          ) : tab === "presence" ? (
            <PresenceTab
              draft={drafts.presence}
              snapshot={drafts.combined.snapshot}
            />
          ) : tab === "enemies" ? (
            <EnemyTab draft={drafts.enemy} />
          ) : tab === "actions" ? (
            <ActionsTab draft={drafts.action} />
          ) : tab === "quests" ? (
            <QuestTab
              draft={drafts.quest}
              snapshot={drafts.combined.snapshot}
            />
          ) : (
            <ContentTab draft={drafts.item} />
          )}
        </div>
      </div>
    </main>
  );
}

function EditorTabButton({
  label,
  isSelected,
  hasUnsavedChanges,
  onClick,
}: {
  label: string;
  isSelected: boolean;
  hasUnsavedChanges: boolean;
  onClick: () => void;
}) {
  return (
    <TerminalButton
      aria-label={hasUnsavedChanges ? `${label} (unsaved)` : label}
      className="editor-tab"
      isSelected={isSelected}
      onClick={onClick}
    >
      <span className="editor-tab__label">{label}</span>
      {hasUnsavedChanges ? (
        <span aria-hidden="true" className="editor-tab__dirty" />
      ) : null}
    </TerminalButton>
  );
}

function tabHasUnsavedChanges(
  tab: EditorTab,
  changes: ReturnType<typeof useEditorDrafts>["unsavedChanges"],
): boolean {
  switch (tab) {
    case "content":
      return changes.item;
    case "zones":
      return changes.zone;
    case "game":
      return changes.game;
    case "dialogues":
      return changes.dialogue;
    case "npcs":
      return changes.npc;
    case "presence":
      return changes.presence;
    case "enemies":
      return changes.enemy;
    case "actions":
      return changes.action;
    case "quests":
      return changes.quest;
  }
}
