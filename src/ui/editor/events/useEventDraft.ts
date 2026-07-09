import { useEffect, useMemo, useState } from "react";
import {
  buildContentReferenceGraph,
  CONTENT_TYPES,
  validateEventDef,
  type ContentCatalogSnapshot,
  type ContentDiagnostic,
  type ContentReference,
  type EventDef,
} from "../../../engine";
import { deleteEditorContent, saveEditorContent } from "../editorSaveClient";
import { draftHasBlockingErrors, type SaveStatus } from "../editorModel";
import type { CombinedDraftView, DraftSlot } from "../editorDraftTypes";
import {
  cloneEventDefs,
  createEventDef,
  eventContentPath,
  listEventDefs,
  removeEventDef,
  serializeEventDef,
  serializeEventDefsById,
  updateEventDef,
  upsertEventDef,
  validateNewEventId,
  type EventEntry,
} from "./eventEditorModel";

export interface EventDraftController {
  events: Array<EventEntry & { hasUnsavedChanges: boolean }>;
  selectedEventId: string;
  selectedEvent: EventDef | null;
  selectedEventDiagnostics: ContentDiagnostic[];
  selectedEventReferences: ContentReference[];
  outgoingEventReferences: ContentReference[];
  zoneIds: string[];
  itemIds: string[];
  npcIds: string[];
  enemyIds: string[];
  dialogueIds: string[];
  questIds: string[];
  errorCount: number;
  warningCount: number;
  hasUnsavedChanges: boolean;
  selectedEventHasUnsavedChanges: boolean;
  canSaveSelectedEvent: boolean;
  canResetSelectedEvent: boolean;
  canDeleteSelectedEvent: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  newEventIdDraft: string;
  canCreateEvent: boolean;
  setNewEventIdDraft: (value: string) => void;
  selectEvent: (eventId: string) => void;
  createEvent: () => void;
  updateSelectedEvent: (updater: (event: EventDef) => EventDef) => void;
  resetSelectedEvent: () => void;
  saveSelectedEvent: () => Promise<void>;
  deleteSelectedEvent: () => Promise<void>;
}

export function createEventDraftState(base: ContentCatalogSnapshot): EventDef[] {
  return cloneEventDefs(base.events ?? []);
}

export function useEventDraft(
  slot: DraftSlot<EventDef[]>,
  savedSlot: DraftSlot<EventDef[]>,
  combined: CombinedDraftView,
): EventDraftController {
  const [selectedEventId, setSelectedEventId] = useState(() => firstEventId(slot.value));
  const [newEventIdDraft, setNewEventIdDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle", message: "No changes." });
  const savedJson = useMemo(() => serializeEventDefsById(savedSlot.value), [savedSlot.value]);
  const events = useMemo(() => listEventDefs(slot.value).map((entry) => ({ ...entry, hasUnsavedChanges: serializeEventDef(slot.value.find((event) => event.eventId === entry.eventId)!) !== savedJson.get(entry.eventId) })), [savedJson, slot.value]);
  const selectedEvent = slot.value.find((event) => event.eventId === selectedEventId) ?? null;
  const selectedEventDiagnostics = combined.diagnostics.filter((diagnostic) => diagnostic.contentType === CONTENT_TYPES.event && diagnostic.contentId === selectedEventId);
  const graph = selectedEvent ? buildContentReferenceGraph(combined.snapshot) : null;
  const selectedEventReferences = graph?.getReferencesTo({ type: CONTENT_TYPES.event, id: selectedEventId }) ?? [];
  const outgoingEventReferences = graph?.getReferencesFrom({ type: CONTENT_TYPES.event, id: selectedEventId }) ?? [];
  const selectedEventHasUnsavedChanges = selectedEvent ? serializeEventDef(selectedEvent) !== savedJson.get(selectedEventId) : false;
  const hasUnsavedChanges = slot.value.some((event) => serializeEventDef(event) !== savedJson.get(event.eventId)) || savedSlot.value.some((event) => !slot.value.some((draft) => draft.eventId === event.eventId));
  const isSaving = saveStatus.state === "saving";
  const newEventErrors = validateNewEventId(newEventIdDraft, slot.value);

  useEffect(() => {
    if (!selectedEventId || slot.value.some((event) => event.eventId === selectedEventId)) return;
    setSelectedEventId(firstEventId(slot.value));
  }, [selectedEventId, slot.value]);

  function updateSelectedEvent(updater: (event: EventDef) => EventDef): void {
    if (!selectedEventId) return;
    slot.set((events) => updateEventDef(events, selectedEventId, updater));
    setSaveStatus({ state: "idle", message: "" });
  }
  function createEvent(): void {
    if (newEventErrors.length > 0) return;
    const event = createEventDef(newEventIdDraft, Object.keys(combined.snapshot.zones).sort()[0] ?? "");
    slot.set((events) => upsertEventDef(events, event));
    setSelectedEventId(event.eventId);
    setNewEventIdDraft("");
  }
  function resetSelectedEvent(): void {
    if (!selectedEventId) return;
    const saved = savedSlot.value.find((event) => event.eventId === selectedEventId);
    slot.set((events) => saved ? upsertEventDef(events, saved) : removeEventDef(events, selectedEventId));
    setSaveStatus({ state: "idle", message: "" });
  }
  async function saveSelectedEvent(): Promise<void> {
    if (!selectedEvent || !selectedEventHasUnsavedChanges) return;
    if (draftHasBlockingErrors(combined.snapshot, combined.context) || validateEventDef(selectedEvent, combined.context).length > 0) {
      setSaveStatus({ state: "error", message: "Resolve errors before saving." });
      return;
    }
    setSaveStatus({ state: "saving", message: "Saving..." });
    const result = await saveEditorContent(eventContentPath(selectedEvent.eventId), serializeEventDef(selectedEvent));
    if (!result.ok) { setSaveStatus({ state: "error", message: result.error }); return; }
    savedSlot.set((events) => upsertEventDef(events, selectedEvent));
    setSaveStatus({ state: "saved", message: `Saved ${result.path}.` });
  }
  async function deleteSelectedEvent(): Promise<void> {
    if (!selectedEvent || selectedEventReferences.length > 0) return;
    if (!savedSlot.value.some((event) => event.eventId === selectedEvent.eventId)) {
      slot.set((events) => removeEventDef(events, selectedEvent.eventId));
      return;
    }
    setSaveStatus({ state: "saving", message: "Deleting..." });
    const result = await deleteEditorContent(eventContentPath(selectedEvent.eventId));
    if (!result.ok) { setSaveStatus({ state: "error", message: result.error }); return; }
    slot.set((events) => removeEventDef(events, selectedEvent.eventId));
    savedSlot.set((events) => removeEventDef(events, selectedEvent.eventId));
    setSaveStatus({ state: "saved", message: `Deleted ${result.path}.` });
  }

  return {
    events, selectedEventId, selectedEvent, selectedEventDiagnostics,
    selectedEventReferences, outgoingEventReferences,
    zoneIds: Object.keys(combined.snapshot.zones).sort(),
    itemIds: Object.keys(combined.snapshot.items).sort(),
    npcIds: combined.snapshot.npcs.map((npc) => npc.npcId).sort(),
    enemyIds: combined.snapshot.enemies.map((enemy) => enemy.npcId).sort(),
    dialogueIds: Object.keys(combined.snapshot.dialogues).sort(),
    questIds: combined.snapshot.quests.map((quest) => quest.questId).sort(),
    errorCount: combined.errorCount, warningCount: combined.warningCount,
    hasUnsavedChanges, selectedEventHasUnsavedChanges,
    canSaveSelectedEvent: !!selectedEvent && selectedEventHasUnsavedChanges && combined.errorCount === 0 && !isSaving,
    canResetSelectedEvent: !!selectedEvent && selectedEventHasUnsavedChanges && !isSaving,
    canDeleteSelectedEvent: !!selectedEvent && selectedEventReferences.length === 0 && !isSaving,
    isSaving, saveStatus: saveStatus.state === "idle" ? { state: "idle", message: hasUnsavedChanges ? "Unsaved changes." : "No changes." } : saveStatus,
    newEventIdDraft, canCreateEvent: newEventErrors.length === 0 && !isSaving,
    setNewEventIdDraft, selectEvent: setSelectedEventId, createEvent, updateSelectedEvent,
    resetSelectedEvent, saveSelectedEvent, deleteSelectedEvent,
  };
}

function firstEventId(events: readonly EventDef[]): string { return [...events].sort((a, b) => a.eventId.localeCompare(b.eventId))[0]?.eventId ?? ""; }
