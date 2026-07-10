import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CONTENT_TYPES,
  createRuntimeContentCatalogSnapshot,
  type ContentBundle,
  type ContentRef,
  type ContentTypeName,
} from "../../engine";
import { EditorButton } from "./components/EditorButton";
import { getFocusableElements } from "../hooks/focusTrap";
import { getNextTabIndex, resolveTabKeyAction } from "../menu/tabNavigation";
import { ActionsTab } from "./actions/ActionsTab";
import { ClassTab } from "./classes/ClassTab";
import { ContentTab } from "./ContentTab";
import type { EditorContentNavigationTarget } from "./DiagnosticList";
import { DialogueTab } from "./dialogues/DialogueTab";
import { EnemyTab } from "./enemies/EnemyTab";
import { GameConfigPanel } from "./GameConfigPanel";
import { NpcTab } from "./npcs/NpcTab";
import { PresenceTab } from "./presence/PresenceTab";
import { prepareEditorPlaytest } from "./playtestLaunch";
import { QuestTab } from "./quests/QuestTab";
import { RaceTab } from "./races/RaceTab";
import { PatternTab } from "./patterns/PatternTab";
import { EventTab } from "./events/EventTab";
import {
  controlOwnsVerticalArrowKeys,
  getNextEditorRegionIndex,
  isEditorFocusRecoveryKey,
  resolveEditorRegionKeyAction,
} from "./editorRegionNavigation";
import { useEditorDrafts } from "./useEditorDrafts";
import { ZoneEditorPanel } from "./zone/ZoneEditorPanel";
import type { EditorPlaytestStart } from "./playtestStart";

type ContentEditorScreenProps = {
  onBack: () => void;
  onStartPlaytest?: (
    contentBundle: ContentBundle,
    start: EditorPlaytestStart,
  ) => void;
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
  | "classes"
  | "races"
  | "quests"
  | "patterns"
  | "events";

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "zones", label: "Zones" },
  { id: "game", label: "Game" },
  { id: "dialogues", label: "Dialogues" },
  { id: "npcs", label: "NPCs" },
  { id: "presence", label: "Presence" },
  { id: "enemies", label: "Enemies" },
  { id: "actions", label: "Actions" },
  { id: "classes", label: "Classes" },
  { id: "races", label: "Races" },
  { id: "quests", label: "Quests" },
  { id: "patterns", label: "Patterns" },
  { id: "events", label: "Events" },
];

export function ContentEditorScreen({
  onBack,
  onStartPlaytest,
}: ContentEditorScreenProps) {
  const baseSnapshot = useMemo(() => createRuntimeContentCatalogSnapshot(), []);
  const [tab, setTab] = useState<EditorTab>("content");
  const [selectedRegionIndex, setSelectedRegionIndex] = useState(0);
  const screenRef = useRef<HTMLElement>(null);
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const pendingRegionFocusRef = useRef(false);
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

  useEffect(() => {
    const regions = getEditorRegions(tabContentRef.current);
    const nextRegionIndex = Math.min(
      selectedRegionIndex,
      Math.max(0, regions.length - 1),
    );

    regions.forEach((region, index) => {
      region.dataset.editorRegion = "true";
      region.tabIndex = index === nextRegionIndex ? 0 : -1;
      if (index === nextRegionIndex) {
        region.dataset.regionSelected = "true";
      } else {
        delete region.dataset.regionSelected;
      }
    });

    if (pendingRegionFocusRef.current) {
      pendingRegionFocusRef.current = false;
      requestAnimationFrame(() => focusEditorRegion(tabContentRef.current, 0));
    }
  });

  useEffect(() => {
    setSelectedRegionIndex(0);
  }, [tab]);

  // Nothing is focused when the screen mounts, and every key handler lives
  // inside the screen — without an initial focus the keyboard is inert.
  useEffect(() => {
    const index = EDITOR_TABS.findIndex((entry) => entry.id === tab);
    tabButtonRefs.current[index]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Focus can drop to document.body (background click, focused element
  // unmounting after a save/delete/filter); once there, no editor handler
  // receives keys anymore. Pull focus back on the first navigation key.
  useEffect(() => {
    function handleWindowKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.defaultPrevented || !isEditorFocusRecoveryKey(event.key)) {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        screenRef.current?.contains(activeElement)
      ) {
        return;
      }

      event.preventDefault();
      const regions = getEditorRegions(tabContentRef.current);
      const selectedRegion = regions.find(
        (region) => region.dataset.regionSelected === "true",
      );
      if (selectedRegion) {
        selectedRegion.focus();
      } else {
        focusActiveTab();
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  });

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

    const result = prepareEditorPlaytest(drafts.combined, {
      selectedZoneId: drafts.zone.selectedZoneId,
      pinnedInspectCell: drafts.zone.pinnedInspectCell,
    });
    if (!result.ok) {
      setPlaytestError(result.message);
      return;
    }

    setPlaytestError(null);
    onStartPlaytest(result.contentBundle, result.start);
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
      case CONTENT_TYPES.class:
        drafts.class.selectClass(target.id);
        setTab("classes");
        return;
      case CONTENT_TYPES.race:
        drafts.race.selectRace(target.id);
        setTab("races");
        return;
      case CONTENT_TYPES.quest:
        drafts.quest.selectQuest(target.id);
        setTab("quests");
        return;
      case CONTENT_TYPES.qtePattern:
        drafts.pattern.selectPattern(target.id);
        setTab("patterns");
        return;
      case CONTENT_TYPES.event:
        drafts.event.selectEvent(target.id);
        setTab("events");
        return;
      default:
        setTab("content");
    }
  }

  function selectTab(
    nextTab: EditorTab,
    options: { focus?: boolean; focusRegion?: boolean } = {},
  ): void {
    setTab(nextTab);
    setSelectedRegionIndex(0);
    // Re-selecting the current tab bails out of rendering, so the pending-focus
    // effect would never run; its regions are already in the DOM — focus now.
    if (options.focusRegion && nextTab === tab) {
      pendingRegionFocusRef.current = false;
      focusEditorRegion(tabContentRef.current, 0);
    } else {
      pendingRegionFocusRef.current = options.focusRegion ?? false;
    }
    if (options.focus) {
      const index = EDITOR_TABS.findIndex((entry) => entry.id === nextTab);
      requestAnimationFrame(() => tabButtonRefs.current[index]?.focus());
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLElement>): void {
    const action = resolveTabKeyAction(event.key, {
      tabCount: EDITOR_TABS.length,
    });

    if (action.kind === "none" || action.kind === "cancel") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (action.kind === "move") {
      const activeIndex = EDITOR_TABS.findIndex((entry) => entry.id === tab);
      const nextIndex = getNextTabIndex(
        activeIndex,
        EDITOR_TABS.length,
        action.direction,
      );
      selectTab(EDITOR_TABS[nextIndex].id, { focus: true });
      return;
    }

    selectTab(EDITOR_TABS[action.index].id, { focus: true });
  }

  function focusActiveTab(): void {
    const index = EDITOR_TABS.findIndex((entry) => entry.id === tab);
    tabButtonRefs.current[index]?.focus();
  }

  function handleEditorKeyDownCapture(event: KeyboardEvent<HTMLElement>): void {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".editor-coordinate-picker")
    ) {
      return;
    }

    const regions = getEditorRegions(tabContentRef.current);
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const activeRegionIndex = activeElement
      ? regions.findIndex((region) => region.contains(activeElement))
      : -1;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      if (
        activeElement?.closest(".editor-tabs") ||
        activeElement?.closest(".editor-header__actions")
      ) {
        handleBack();
        return;
      }

      if (activeRegionIndex >= 0) {
        setSelectedRegionIndex(activeRegionIndex);
        if (activeElement === regions[activeRegionIndex]) {
          focusActiveTab();
        } else {
          focusEditorRegion(tabContentRef.current, activeRegionIndex);
        }
        return;
      }

      focusActiveTab();
      return;
    }

    if (activeRegionIndex < 0 || !activeElement) {
      return;
    }

    if (activeElement !== regions[activeRegionIndex]) {
      handleRegionControlKeyDown(
        event,
        regions[activeRegionIndex],
        activeElement,
      );
      return;
    }

    const action = resolveEditorRegionKeyAction(event.key, {
      regionCount: regions.length,
    });
    if (action.kind === "none" || action.kind === "previous") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (action.kind === "enter") {
      const firstFocusable = getFocusableElements(regions[activeRegionIndex])[0];
      firstFocusable?.focus();
      return;
    }

    const nextIndex = getNextEditorRegionIndex(
      activeRegionIndex,
      regions.length,
      action.direction,
    );
    setSelectedRegionIndex(nextIndex);
    focusEditorRegion(tabContentRef.current, nextIndex);
  }

  return (
    <main
      className="app-shell app-shell--bounded editor-screen"
      aria-labelledby="editor-heading"
      onKeyDownCapture={handleEditorKeyDownCapture}
      ref={screenRef}
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
              <EditorButton
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
              </EditorButton>
            ) : null}
            <EditorButton className="editor-header__back" onClick={handleBack}>
              Back
            </EditorButton>
          </div>
        </header>

        <nav
          className="editor-tabs"
          aria-label="Editor sections"
          onKeyDown={handleTabKeyDown}
        >
          {EDITOR_TABS.map((entry, index) => (
            <EditorTabButton
              hasUnsavedChanges={tabHasUnsavedChanges(
                entry.id,
                drafts.unsavedChanges,
              )}
              isSelected={tab === entry.id}
              key={entry.id}
              label={entry.label}
              onClick={() => selectTab(entry.id, { focusRegion: true })}
              ref={(button) => {
                tabButtonRefs.current[index] = button;
              }}
            />
          ))}
        </nav>

        <div className="editor-tab-content" ref={tabContentRef}>
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
          ) : tab === "classes" ? (
            <ClassTab draft={drafts.class} onNavigate={navigateToContent} />
          ) : tab === "races" ? (
            <RaceTab draft={drafts.race} onNavigate={navigateToContent} />
          ) : tab === "quests" ? (
            <QuestTab
              draft={drafts.quest}
              onNavigate={navigateToContent}
              snapshot={drafts.combined.snapshot}
            />
          ) : tab === "patterns" ? (
            <PatternTab draft={drafts.pattern} onNavigate={navigateToContent} />
          ) : tab === "events" ? (
            <EventTab draft={drafts.event} onNavigate={navigateToContent} snapshot={drafts.combined.snapshot} />
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

function handleRegionControlKeyDown(
  event: KeyboardEvent<HTMLElement>,
  region: HTMLElement,
  control: HTMLElement,
): void {
  if (event.key === "Enter" && control instanceof HTMLSelectElement) {
    event.preventDefault();
    event.stopPropagation();
    openSelectPicker(control);
    return;
  }

  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
    return;
  }

  // Modifier combos stay native (e.g. Alt+ArrowDown opens a select).
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (
    controlOwnsVerticalArrowKeys(
      control.tagName,
      control instanceof HTMLInputElement ? control.type : null,
    )
  ) {
    return;
  }

  const focusable = getFocusableElements(region);
  const currentIndex = focusable.indexOf(control);
  if (currentIndex < 0 || focusable.length < 2) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const direction = event.key === "ArrowDown" ? 1 : -1;
  focusable[
    (currentIndex + direction + focusable.length) % focusable.length
  ].focus();
}

function openSelectPicker(select: HTMLSelectElement): void {
  try {
    select.showPicker();
  } catch {
    // Unsupported or blocked; Space still opens the picker natively.
  }
}

function getEditorRegions(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(".editor-panel"),
  ).filter((region) => !region.closest(".editor-coordinate-picker"));
}

function focusEditorRegion(
  container: HTMLElement | null,
  index: number,
): void {
  const regions = getEditorRegions(container);
  regions[index]?.focus();
}

const EditorTabButton = forwardRef<HTMLButtonElement, {
  label: string;
  isSelected: boolean;
  hasUnsavedChanges: boolean;
  onClick: () => void;
}>(function EditorTabButton({
  label,
  isSelected,
  hasUnsavedChanges,
  onClick,
}, ref) {
  return (
    <EditorButton
      aria-label={hasUnsavedChanges ? `${label} (unsaved)` : label}
      className="editor-tab"
      isSelected={isSelected}
      onClick={onClick}
      ref={ref}
      tabIndex={isSelected ? 0 : -1}
    >
      <span className="editor-tab__label">{label}</span>
      {hasUnsavedChanges ? (
        <span aria-hidden="true" className="editor-tab__dirty" />
      ) : null}
    </EditorButton>
  );
});

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
    case "classes":
      return changes.class;
    case "races":
      return changes.race;
    case "quests":
      return changes.quest;
    case "patterns":
      return changes.pattern;
    case "events":
      return changes.event;
  }
}
