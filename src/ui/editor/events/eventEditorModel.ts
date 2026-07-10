import {
  type ContentCatalogSnapshot,
  type EventAction,
  type EventCondition,
  type EventDef,
  type EventTrigger,
} from "../../../engine";

export const EVENT_TRIGGER_TYPES = [
  "enter_zone",
  "step_on_area",
  "interact_on_area",
  "dialogue_end",
  "quest_state_change",
  "calendar_time",
] as const;
export const EVENT_CONDITION_TYPES = [
  "quest_state",
  "world_flag",
  "has_item",
  "min_global_level",
  "time_window",
] as const;
export const EVENT_ACTION_TYPES = [
  "dialogue",
  "grant_xp",
  "grant_gold",
  "remove_gold",
  "give_item",
  "remove_item",
  "set_flag",
  "clear_flag",
  "notice",
  "spawn_enemy",
  "despawn_enemy",
  "spawn_npc",
  "despawn_npc",
  "start_combat",
  "teleport",
  "set_respawn",
  "reveal_area",
  "start_quest",
  "advance_quest",
] as const;

export type EventEntry = Pick<EventDef, "eventId" | "priority" | "repeatPolicy" | "trigger">;

export type EventListGroup = {
  key: string;
  label: string;
  entries: EventEntry[];
};

export type EventGroupingMode = "type" | "zone";

export function cloneEventDef(event: EventDef): EventDef {
  return structuredClone(event);
}

export function cloneEventDefs(events: readonly EventDef[]): EventDef[] {
  return events.map(cloneEventDef);
}

export function listEventDefs(events: readonly EventDef[]): EventEntry[] {
  return [...events]
    .sort((a, b) => a.eventId.localeCompare(b.eventId))
    .map(({ eventId, priority, repeatPolicy, trigger }) => ({
      eventId,
      priority,
      repeatPolicy,
      trigger: structuredClone(trigger),
    }));
}

export function groupEventEntries(
  entries: readonly EventEntry[],
  mode: EventGroupingMode,
): EventListGroup[] {
  const groups = new Map<string, EventListGroup>();

  for (const entry of entries) {
    const zoneId = eventTriggerZoneId(entry.trigger) ?? "Global";
    const groupValue = mode === "type" ? entry.trigger.type : zoneId;
    const key = `${mode}:${groupValue}`;
    const group = groups.get(key) ?? {
      key,
      label: groupValue,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort((a, b) =>
        a.eventId.localeCompare(b.eventId),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function eventTriggerZoneId(trigger: EventTrigger): string | undefined {
  return "zoneId" in trigger ? trigger.zoneId : undefined;
}

export function eventContentPath(eventId: string): string {
  return `src/content/events/${eventId}.json`;
}

export function serializeEventDef(event: EventDef): string {
  return JSON.stringify(event, null, 2);
}

export function serializeEventDefsById(events: readonly EventDef[]): Map<string, string> {
  return new Map(events.map((event) => [event.eventId, serializeEventDef(event)]));
}

export function createEventDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  events: readonly EventDef[],
): ContentCatalogSnapshot {
  return { ...snapshot, events: cloneEventDefs(events) };
}

export function validateNewEventId(idDraft: string, events: readonly EventDef[]): string[] {
  const id = idDraft.trim();
  if (!id) return ["Event id is required."];
  if (!/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/.test(id)) {
    return ["Event id must start with a lowercase letter and use lowercase letters, digits, underscores, or hyphens."];
  }
  if (events.some((event) => event.eventId === id)) return [`Event "${id}" already exists.`];
  return [];
}

export function createEventDef(eventId: string, zoneId: string): EventDef {
  return {
    eventId: eventId.trim(),
    trigger: { type: "enter_zone", zoneId },
    conditions: [],
    actions: [{ type: "notice", message: "New world event." }],
    repeatPolicy: "once_per_playthrough",
    priority: 0,
  };
}

export function updateEventDef(
  events: readonly EventDef[],
  eventId: string,
  updater: (event: EventDef) => EventDef,
): EventDef[] {
  return events.map((event) =>
    event.eventId === eventId ? cloneEventDef(updater(cloneEventDef(event))) : cloneEventDef(event),
  );
}

export function upsertEventDef(events: readonly EventDef[], event: EventDef): EventDef[] {
  const next = events.some((entry) => entry.eventId === event.eventId)
    ? events.map((entry) => (entry.eventId === event.eventId ? cloneEventDef(event) : cloneEventDef(entry)))
    : [...events, cloneEventDef(event)];
  return next.sort((a, b) => a.eventId.localeCompare(b.eventId));
}

export function removeEventDef(events: readonly EventDef[], eventId: string): EventDef[] {
  return events.filter((event) => event.eventId !== eventId).map(cloneEventDef);
}

export function setEventTrigger(event: EventDef, trigger: EventTrigger): EventDef {
  return { ...cloneEventDef(event), trigger: structuredClone(trigger) };
}

export function addEventCondition(event: EventDef, type: EventCondition["type"]): EventDef {
  const next = cloneEventDef(event);
  switch (type) {
    case "quest_state": next.conditions.push({ type, questId: "", state: "active" }); break;
    case "world_flag": next.conditions.push({ type, flag: "story.flag", value: true }); break;
    case "has_item": next.conditions.push({ type, itemId: "", quantity: 1 }); break;
    case "min_global_level": next.conditions.push({ type, level: 1 }); break;
    case "time_window": next.conditions.push({ type, startMinutes: 8 * 60, endMinutes: 18 * 60 }); break;
  }
  return next;
}

export function addEventAction(event: EventDef, type: EventAction["type"]): EventDef {
  const next = cloneEventDef(event);
  switch (type) {
    case "dialogue": next.actions.push({ type, dialogueId: "" }); break;
    case "grant_xp":
    case "grant_gold":
    case "remove_gold": next.actions.push({ type, amount: 1 }); break;
    case "give_item":
    case "remove_item": next.actions.push({ type, itemId: "", quantity: 1 }); break;
    case "set_flag":
    case "clear_flag": next.actions.push({ type, flag: "story.flag" }); break;
    case "notice": next.actions.push({ type, message: "Event notice." }); break;
    case "spawn_enemy":
    case "spawn_npc": next.actions.push({ type, npcId: "", x: 0, y: 0 } as EventAction); break;
    case "despawn_enemy":
    case "start_combat": next.actions.push({ type, enemyId: "" }); break;
    case "despawn_npc": next.actions.push({ type, npcId: "" }); break;
    case "teleport": next.actions.push({ type, zoneId: "", x: 0, y: 0 }); break;
    case "set_respawn": next.actions.push({ type, zoneId: "", x: 0, y: 0 }); break;
    case "reveal_area": next.actions.push({ type, zoneId: "", x: 0, y: 0, width: 1, height: 1 }); break;
    case "start_quest":
    case "advance_quest": next.actions.push({ type, questId: "" }); break;
  }
  return next;
}

export function removeEventCondition(event: EventDef, index: number): EventDef {
  const next = cloneEventDef(event);
  next.conditions.splice(index, 1);
  return next;
}

export function removeEventAction(event: EventDef, index: number): EventDef {
  const next = cloneEventDef(event);
  next.actions.splice(index, 1);
  return next;
}
