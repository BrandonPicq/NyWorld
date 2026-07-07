import { useEffect, useMemo, useState } from "react";
import {
  CONTENT_TYPES,
  createRuntimeContentCatalogSnapshot,
  type ContentBundle,
  type ContentRef,
  type ContentTypeName,
} from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { ActionsTab } from "./actions/ActionsTab";
import { ContentTab } from "./ContentTab";
import type { EditorContentNavigationTarget } from "./DiagnosticList";
import { DialogueTab } from "./dialogues/DialogueTab";
import { EnemyTab } from "./enemies/EnemyTab";
import { GameConfigPanel } from "./GameConfigPanel";
import { NpcTab } from "./npcs/NpcTab";
import { PresenceTab } from "./presence/PresenceTab";
import { prepareEditorPlaytest } from "./playtestLaunch";
import { QuestTab } from "./quests/QuestTab";
import { useEditorDrafts } from "./useEditorDrafts";
import { ZoneEditorPanel } from "./zone/ZoneEditorPanel";

type ContentEditorScreenProps = {
  onBack: () => void;
  onStartPlaytest?: (contentBundle: ContentBundle) => void;
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

export function ContentEditorScreen({
  onBack,
  onStartPlaytest,
}: ContentEditorScreenProps) {
  const baseSnapshot = useMemo(() => createRuntimeContentCatalogSnapshot(), []);
  const [tab, setTab] = useState<EditorTab>("content");
  const [playtestError, setPlaytestError] = useState<string | null>(null);
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

  function handleStartPlaytest(): void {
    if (!onStartPlaytest) return;

    const result = prepareEditorPlaytest(drafts.combined);
    if (!result.ok) {
      setPlaytestError(result.message);
      return;
    }

    setPlaytestError(null);
    onStartPlaytest(result.contentBundle);
  }

  function navigateToContent(target: EditorContentNavigationTarget): void {
    const ref = toContentRef(target);
    if (ref) {
      drafts.item.setSelectedRef(ref);
    }

    switch (target.type) {
      case CONTENT_TYPES.game:
        setTab("game");
        return;
      case CONTENT_TYPES.zone:
        drafts.zone.selectZone(target.id);
        setTab("zones");
        return;
      case CONTENT_TYPES.item:
      case CONTENT_TYPES.tile:
        setTab("content");
        return;
      case CONTENT_TYPES.dialogue: {
        const stem = findDialogueStem(
          drafts.combined.snapshot.dialogueFiles,
          target.id,
        );
        if (stem) {
          drafts.dialogue.selectFile(stem);
          drafts.dialogue.selectDialogue(target.id);
          setTab("dialogues");
          return;
        }
        setTab("content");
        return;
      }
      case CONTENT_TYPES.npc:
        drafts.npc.selectNpc(target.id);
        setTab("npcs");
        return;
      case CONTENT_TYPES.npcPresence:
        drafts.presence.selectNpc(target.id);
        setTab("presence");
        return;
      case CONTENT_TYPES.enemy:
        drafts.enemy.selectNpc(target.id);
        setTab("enemies");
        return;
      case CONTENT_TYPES.combatAction:
        drafts.action.selectAction(target.id);
        setTab("actions");
        return;
      case CONTENT_TYPES.quest:
        drafts.quest.selectQuest(target.id);
        setTab("quests");
        return;
      default:
        setTab("content");
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
            {playtestError ? (
              <p className="editor-header__notice">{playtestError}</p>
            ) : null}
          </div>
          <div className="editor-header__actions">
            {onStartPlaytest ? (
              <TerminalButton
                className="editor-header__playtest"
                disabled={drafts.combined.errorCount > 0}
                onClick={handleStartPlaytest}
                title={
                  drafts.combined.errorCount > 0
                    ? "Fix validation errors before playtesting."
                    : "Launch a playtest from the current draft."
                }
              >
                Playtest
              </TerminalButton>
            ) : null}
            <TerminalButton className="editor-header__back" onClick={handleBack}>
              Back
            </TerminalButton>
          </div>
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
              onNavigate={navigateToContent}
              snapshot={drafts.combined.snapshot}
            />
          ) : tab === "game" ? (
            <GameConfigPanel
              draft={drafts.game}
              onNavigate={navigateToContent}
              snapshot={drafts.combined.snapshot}
            />
          ) : tab === "dialogues" ? (
            <DialogueTab
              draft={drafts.dialogue}
              onNavigate={navigateToContent}
            />
          ) : tab === "npcs" ? (
            <NpcTab draft={drafts.npc} onNavigate={navigateToContent} />
          ) : tab === "presence" ? (
            <PresenceTab
              draft={drafts.presence}
              onNavigate={navigateToContent}
              snapshot={drafts.combined.snapshot}
            />
          ) : tab === "enemies" ? (
            <EnemyTab draft={drafts.enemy} onNavigate={navigateToContent} />
          ) : tab === "actions" ? (
            <ActionsTab draft={drafts.action} />
          ) : tab === "quests" ? (
            <QuestTab
              draft={drafts.quest}
              onNavigate={navigateToContent}
              snapshot={drafts.combined.snapshot}
            />
          ) : (
            <ContentTab draft={drafts.item} onNavigate={navigateToContent} />
          )}
        </div>
      </div>
    </main>
  );
}

function toContentRef(
  target: EditorContentNavigationTarget,
): ContentRef | null {
  if (!isContentTypeName(target.type)) {
    return null;
  }
  return { type: target.type, id: target.id };
}

function isContentTypeName(type: string): type is ContentTypeName {
  return Object.values(CONTENT_TYPES).includes(type as ContentTypeName);
}

function findDialogueStem(
  files: Record<string, Record<string, unknown>>,
  dialogueId: string,
): string | null {
  return (
    Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .find(([, dialogues]) => dialogueId in dialogues)?.[0] ?? null
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
