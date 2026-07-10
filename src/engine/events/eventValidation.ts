import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import type { ContentValidationContext } from "../content/ContentValidationContext";
import { CONTENT_TYPES } from "../content/contentTypes";
import type {
  EventAction,
  EventArea,
  EventCondition,
  EventDef,
  EventQuestState,
  EventRepeatPolicy,
  EventTrigger,
} from "./EventDef";

export type EventValidationContext = Pick<
  ContentValidationContext,
  "itemIds" | "npcIds" | "dialogueIds" | "enemyIds" | "questIds" | "zones"
>;

const EVENT_ID_PATTERN = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/;
const FLAG_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/;
const EVENT_QUEST_STATES: readonly EventQuestState[] = [
  "not_started",
  "active",
  "readyToComplete",
  "completed",
];

export function validateEventRegistry(
  defs: readonly unknown[],
  context: EventValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const ids = new Set<string>();

  for (const def of defs) {
    diagnostics.push(...validateEventDef(def, context));
    if (!isRecord(def) || typeof def.eventId !== "string") continue;
    if (ids.has(def.eventId)) {
      addError(
        diagnostics,
        def,
        "eventId",
        `Duplicate event definition "${def.eventId}".`,
      );
    }
    ids.add(def.eventId);
  }

  return diagnostics;
}

export function validateEventDef(
  value: unknown,
  context: EventValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  if (!isRecord(value)) {
    addError(diagnostics, undefined, "$", "Event definition must be an object.");
    return diagnostics;
  }

  const eventId = typeof value.eventId === "string" ? value.eventId : "";
  if (!EVENT_ID_PATTERN.test(eventId)) {
    addError(
      diagnostics,
      value,
      "eventId",
      "Event definition eventId must use lowercase letters, digits, underscores, or hyphens and start with a letter.",
    );
  }

  validateTrigger(value.trigger, eventId, value, context, diagnostics);
  validateConditions(value.conditions, eventId, value, context, diagnostics);
  validateActions(value.actions, eventId, value, context, diagnostics);

  const repeatPolicy = value.repeatPolicy;
  if (!isValidRepeatPolicy(repeatPolicy)) {
    addError(
      diagnostics,
      value,
      "repeatPolicy",
      `Event "${eventId || "?"}" has an invalid repeatPolicy.`,
    );
  }
  if (
    typeof value.priority !== "number" ||
    !Number.isInteger(value.priority)
  ) {
    addError(
      diagnostics,
      value,
      "priority",
      `Event "${eventId || "?"}" priority must be an integer.`,
    );
  }

  return diagnostics;
}

export function buildEventRegistry(
  defs: readonly unknown[],
  context: EventValidationContext,
): Record<string, EventDef> {
  const diagnostics = validateEventRegistry(defs, context);
  const firstError = diagnostics.find((diagnostic) => diagnostic.severity === "error");
  if (firstError) throw new Error(firstError.message);

  return Object.fromEntries(
    defs.map((def) => {
      const event = def as EventDef;
      return [event.eventId, cloneEventDef(event)];
    }),
  );
}

export function cloneEventDef(def: EventDef): EventDef {
  return {
    ...def,
    trigger: cloneTrigger(def.trigger),
    conditions: def.conditions.map((condition) => ({ ...condition })),
    actions: def.actions.map((action) => ({ ...action })),
    repeatPolicy:
      typeof def.repeatPolicy === "string"
        ? def.repeatPolicy
        : { ...def.repeatPolicy },
  };
}

function validateTrigger(
  value: unknown,
  eventId: string,
  event: Record<string, unknown>,
  context: EventValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value) || typeof value.type !== "string") {
    addError(diagnostics, event, "trigger", `Event "${eventId || "?"}" has an invalid trigger.`);
    return;
  }

  if (value.type === "enter_zone") {
    validateZoneReference(value.zoneId, "trigger.zoneId", eventId, event, context, diagnostics);
  } else if (value.type === "step_on_area" || value.type === "interact_on_area") {
    validateZoneReference(value.zoneId, "trigger.zoneId", eventId, event, context, diagnostics);
    validateArea(value.area, "trigger.area", eventId, event, diagnostics);
  } else if (value.type === "dialogue_end") {
    if (value.dialogueId !== undefined) {
      validateDialogueReference(value.dialogueId, "trigger.dialogueId", eventId, event, context, diagnostics);
    }
  } else if (value.type === "quest_state_change") {
    validateQuestReference(value.questId, "trigger.questId", eventId, event, context, diagnostics);
    validateQuestState(value.state, "trigger.state", eventId, event, diagnostics);
  } else if (value.type === "calendar_time") {
    validateCalendarTime(value.day, value.minutes, "trigger", eventId, event, diagnostics);
  } else {
    addError(diagnostics, event, "trigger.type", `Event "${eventId || "?"}" has unknown trigger type "${value.type}".`);
  }
}

function validateConditions(
  value: unknown,
  eventId: string,
  event: Record<string, unknown>,
  context: EventValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    addError(diagnostics, event, "conditions", `Event "${eventId || "?"}" conditions must be an array.`);
    return;
  }

  value.forEach((condition, index) => {
    const path = `conditions[${index}]`;
    if (!isRecord(condition) || typeof condition.type !== "string") {
      addError(diagnostics, event, path, `Event "${eventId || "?"}" condition ${index} is invalid.`);
      return;
    }
    if (condition.type === "quest_state") {
      validateQuestReference(condition.questId, `${path}.questId`, eventId, event, context, diagnostics);
      validateQuestState(condition.state, `${path}.state`, eventId, event, diagnostics);
    } else if (condition.type === "world_flag") {
      validateFlag(condition.flag, `${path}.flag`, eventId, event, diagnostics);
      if (typeof condition.value !== "boolean") addError(diagnostics, event, `${path}.value`, `Event "${eventId || "?"}" flag condition value must be boolean.`);
    } else if (condition.type === "has_item") {
      validateItemReference(condition.itemId, `${path}.itemId`, eventId, event, context, diagnostics);
      validatePositiveInteger(condition.quantity, `${path}.quantity`, eventId, event, diagnostics);
    } else if (condition.type === "min_global_level") {
      validatePositiveInteger(condition.level, `${path}.level`, eventId, event, diagnostics);
    } else if (condition.type === "time_window") {
      validateMinutes(condition.startMinutes, `${path}.startMinutes`, eventId, event, diagnostics);
      validateMinutes(condition.endMinutes, `${path}.endMinutes`, eventId, event, diagnostics);
    } else {
      addError(diagnostics, event, `${path}.type`, `Event "${eventId || "?"}" has unknown condition type "${condition.type}".`);
    }
  });
}

function validateActions(
  value: unknown,
  eventId: string,
  event: Record<string, unknown>,
  context: EventValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    addError(diagnostics, event, "actions", `Event "${eventId || "?"}" actions must be a non-empty array.`);
    return;
  }

  value.forEach((action, index) => {
    const path = `actions[${index}]`;
    if (!isRecord(action) || typeof action.type !== "string") {
      addError(diagnostics, event, path, `Event "${eventId || "?"}" action ${index} is invalid.`);
      return;
    }
    const refPath = (field: string) => `${path}.${field}`;
    if (action.type === "dialogue") validateDialogueReference(action.dialogueId, refPath("dialogueId"), eventId, event, context, diagnostics);
    else if (action.type === "grant_xp" || action.type === "grant_gold" || action.type === "remove_gold") validatePositiveInteger(action.amount, refPath("amount"), eventId, event, diagnostics);
    else if (action.type === "give_item" || action.type === "remove_item") {
      validateItemReference(action.itemId, refPath("itemId"), eventId, event, context, diagnostics);
      validatePositiveInteger(action.quantity, refPath("quantity"), eventId, event, diagnostics);
    } else if (action.type === "set_flag" || action.type === "clear_flag") validateFlag(action.flag, refPath("flag"), eventId, event, diagnostics);
    else if (action.type === "notice") {
      if (typeof action.message !== "string" || !action.message.trim()) addError(diagnostics, event, refPath("message"), `Event "${eventId || "?"}" notice message must not be empty.`);
    } else if (action.type === "spawn_enemy") {
      validateEnemyReference(action.enemyId, refPath("enemyId"), eventId, event, context, diagnostics);
      validateCoordinates(action.x, action.y, path, eventId, event, diagnostics);
    } else if (action.type === "despawn_enemy" || action.type === "start_combat") validateEnemyReference(action.enemyId, refPath("enemyId"), eventId, event, context, diagnostics);
    else if (action.type === "spawn_npc") {
      validateNpcReference(action.npcId, refPath("npcId"), eventId, event, context, diagnostics);
      validateCoordinates(action.x, action.y, path, eventId, event, diagnostics);
      if (action.dialogueId !== undefined) validateDialogueReference(action.dialogueId, refPath("dialogueId"), eventId, event, context, diagnostics);
    } else if (action.type === "despawn_npc") validateNpcReference(action.npcId, refPath("npcId"), eventId, event, context, diagnostics);
    else if (action.type === "teleport" || action.type === "set_respawn") {
      validateZoneReference(action.zoneId, refPath("zoneId"), eventId, event, context, diagnostics);
      validateCoordinates(action.x, action.y, path, eventId, event, diagnostics);
    } else if (action.type === "reveal_area") {
      validateZoneReference(action.zoneId, refPath("zoneId"), eventId, event, context, diagnostics);
      validateCoordinates(action.x, action.y, path, eventId, event, diagnostics);
      validatePositiveInteger(action.width, refPath("width"), eventId, event, diagnostics);
      validatePositiveInteger(action.height, refPath("height"), eventId, event, diagnostics);
    } else if (action.type === "start_quest" || action.type === "advance_quest") validateQuestReference(action.questId, refPath("questId"), eventId, event, context, diagnostics);
    else addError(diagnostics, event, `${path}.type`, `Event "${eventId || "?"}" has unknown action type "${action.type}".`);
  });
}

function validateArea(value: unknown, path: string, eventId: string, event: Record<string, unknown>, diagnostics: ContentDiagnostic[]): void {
  if (!isRecord(value)) {
    addError(diagnostics, event, path, `Event "${eventId || "?"}" area must be an object.`);
    return;
  }
  validateCoordinates(value.x, value.y, path, eventId, event, diagnostics);
  validatePositiveInteger(value.width, `${path}.width`, eventId, event, diagnostics);
  validatePositiveInteger(value.height, `${path}.height`, eventId, event, diagnostics);
}

function validateCalendarTime(day: unknown, minutes: unknown, path: string, eventId: string, event: Record<string, unknown>, diagnostics: ContentDiagnostic[]): void {
  if (day !== undefined && (typeof day !== "number" || !Number.isInteger(day) || day < 1)) addError(diagnostics, event, `${path}.day`, `Event "${eventId || "?"}" calendar day must be a positive integer.`);
  validateMinutes(minutes, `${path}.minutes`, eventId, event, diagnostics);
}

function validateCoordinates(x: unknown, y: unknown, path: string, eventId: string, event: Record<string, unknown>, diagnostics: ContentDiagnostic[]): void {
  if (typeof x !== "number" || !Number.isInteger(x) || x < 0) addError(diagnostics, event, `${path}.x`, `Event "${eventId || "?"}" x must be a non-negative integer.`);
  if (typeof y !== "number" || !Number.isInteger(y) || y < 0) addError(diagnostics, event, `${path}.y`, `Event "${eventId || "?"}" y must be a non-negative integer.`);
}

function validateMinutes(value: unknown, path: string, eventId: string, event: Record<string, unknown>, diagnostics: ContentDiagnostic[]): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= 1440) addError(diagnostics, event, path, `Event "${eventId || "?"}" ${path} must be an integer from 0 to 1439.`);
}

function validatePositiveInteger(value: unknown, path: string, eventId: string, event: Record<string, unknown>, diagnostics: ContentDiagnostic[]): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) addError(diagnostics, event, path, `Event "${eventId || "?"}" ${path} must be a positive integer.`);
}

function validateFlag(value: unknown, path: string, eventId: string, event: Record<string, unknown>, diagnostics: ContentDiagnostic[]): void {
  if (typeof value !== "string" || !FLAG_PATTERN.test(value)) addError(diagnostics, event, path, `Event "${eventId || "?"}" flag names must use lowercase letters, digits, underscores, and dots.`);
}

function validateReference(value: unknown, path: string, label: string, known: ReadonlySet<string>, eventId: string, event: Record<string, unknown>, diagnostics: ContentDiagnostic[]): void {
  if (typeof value !== "string" || !known.has(value)) addError(diagnostics, event, path, `Event "${eventId || "?"}" references unknown ${label} "${value}".`);
}

function validateZoneReference(value: unknown, path: string, eventId: string, event: Record<string, unknown>, context: EventValidationContext, diagnostics: ContentDiagnostic[]): void { validateReference(value, path, "zoneId", new Set(context.zones.keys()), eventId, event, diagnostics); }
function validateItemReference(value: unknown, path: string, eventId: string, event: Record<string, unknown>, context: EventValidationContext, diagnostics: ContentDiagnostic[]): void { validateReference(value, path, "itemId", context.itemIds, eventId, event, diagnostics); }
function validateNpcReference(value: unknown, path: string, eventId: string, event: Record<string, unknown>, context: EventValidationContext, diagnostics: ContentDiagnostic[]): void { validateReference(value, path, "npcId", context.npcIds, eventId, event, diagnostics); }
function validateDialogueReference(value: unknown, path: string, eventId: string, event: Record<string, unknown>, context: EventValidationContext, diagnostics: ContentDiagnostic[]): void { validateReference(value, path, "dialogueId", context.dialogueIds, eventId, event, diagnostics); }
function validateEnemyReference(value: unknown, path: string, eventId: string, event: Record<string, unknown>, context: EventValidationContext, diagnostics: ContentDiagnostic[]): void { validateReference(value, path, "enemyId", context.enemyIds, eventId, event, diagnostics); }
function validateQuestReference(value: unknown, path: string, eventId: string, event: Record<string, unknown>, context: EventValidationContext, diagnostics: ContentDiagnostic[]): void { validateReference(value, path, "questId", context.questIds, eventId, event, diagnostics); }
function validateQuestState(value: unknown, path: string, eventId: string, event: Record<string, unknown>, diagnostics: ContentDiagnostic[]): void {
  if (!EVENT_QUEST_STATES.includes(value as EventQuestState)) addError(diagnostics, event, path, `Event "${eventId || "?"}" has invalid quest state "${value}".`);
}

function isValidRepeatPolicy(value: unknown): value is EventRepeatPolicy {
  return value === "once_per_playthrough" || value === "once_per_visit" || (isRecord(value) && value.type === "cooldown" && typeof value.ticks === "number" && Number.isInteger(value.ticks) && value.ticks > 0);
}

function cloneTrigger(trigger: EventTrigger): EventTrigger {
  if (trigger.type === "step_on_area" || trigger.type === "interact_on_area") return { ...trigger, area: { ...trigger.area } };
  return { ...trigger };
}

function addError(diagnostics: ContentDiagnostic[], event: Record<string, unknown> | undefined, path: string, message: string): void {
  diagnostics.push({ severity: "error", contentType: CONTENT_TYPES.event, contentId: typeof event?.eventId === "string" ? event.eventId : undefined, path, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { EventAction, EventArea, EventCondition, EventTrigger };
