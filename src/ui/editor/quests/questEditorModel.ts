import {
  QUEST_STAT_NAME_OPTIONS,
  type ContentCatalogSnapshot,
  type ContentValidationContext,
  type QuestDef,
  type QuestNpcOverride,
  type QuestObjective,
} from "../../../engine";

export type QuestObjectiveType = QuestObjective["type"];

export const QUEST_OBJECTIVE_TYPE_OPTIONS: readonly QuestObjectiveType[] = [
  "fetch_item",
  "visit_coordinate",
  "stat_threshold",
  "defeat_npc",
];

const QUEST_ID_PATTERN = /^[a-z0-9_]+$/;

export interface EditorQuestEntry {
  questId: string;
  name: string;
}

export function listQuestDefs(quests: readonly QuestDef[]): EditorQuestEntry[] {
  return quests
    .map((quest) => ({ questId: quest.questId, name: quest.name }))
    .sort((a, b) => a.questId.localeCompare(b.questId));
}

/** Content path a quest draft saves to; the file name is the stable questId. */
export function questContentPath(questId: string): string {
  return `src/content/quests/${questId}.json`;
}

export function cloneQuestDef(quest: QuestDef): QuestDef {
  return structuredClone(quest);
}

export function cloneQuestDefs(quests: readonly QuestDef[]): QuestDef[] {
  return quests.map(cloneQuestDef);
}

export function createQuestDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftQuests: readonly QuestDef[],
): ContentCatalogSnapshot {
  return { ...snapshot, quests: cloneQuestDefs(draftQuests) };
}

export function createQuestDraftValidationContext(
  context: ContentValidationContext,
  draftQuests: readonly QuestDef[],
): ContentValidationContext {
  return {
    ...context,
    questIds: new Set(draftQuests.map((quest) => quest.questId)),
  };
}

export function serializeQuestDef(quest: QuestDef): string {
  return JSON.stringify(quest, null, 2);
}

export function serializeQuestDefsById(
  quests: readonly QuestDef[],
): Map<string, string> {
  return new Map(quests.map((quest) => [quest.questId, serializeQuestDef(quest)]));
}

/**
 * Validates a new quest id before it is created. Quest ids are persisted in
 * saves, so they must stay a stable, unique slug.
 */
export function validateNewQuestId(
  questIdDraft: string,
  quests: readonly QuestDef[],
): string[] {
  const errors: string[] = [];
  const questId = questIdDraft.trim();

  if (!questId) {
    errors.push("Quest id is required.");
  } else if (!QUEST_ID_PATTERN.test(questId)) {
    errors.push("Quest id must be lowercase letters, digits, or underscores.");
  } else if (quests.some((quest) => quest.questId === questId)) {
    errors.push(`Quest "${questId}" already exists.`);
  }

  return errors;
}

/** Builds a blank quest; NPC and dialogue links are optional for event-driven quests. */
export function createQuestDef(input: {
  questId: string;
  name: string;
}): QuestDef {
  return {
    questId: input.questId.trim(),
    name: input.name.trim(),
    description: "",
    triggers: {
      start: {},
      complete: {},
    },
    npcOverrides: {},
    objectives: [],
    rewards: {},
  };
}

export function upsertQuestDef(
  quests: readonly QuestDef[],
  quest: QuestDef,
): QuestDef[] {
  const exists = quests.some((entry) => entry.questId === quest.questId);
  const next = exists
    ? quests.map((entry) =>
        entry.questId === quest.questId
          ? cloneQuestDef(quest)
          : cloneQuestDef(entry),
      )
    : [...quests, cloneQuestDef(quest)];

  return next.sort((a, b) => a.questId.localeCompare(b.questId));
}

export function updateQuestDef(
  quests: readonly QuestDef[],
  questId: string,
  updater: (quest: QuestDef) => QuestDef,
): QuestDef[] {
  return quests.map((quest) =>
    quest.questId === questId
      ? cloneQuestDef(updater(cloneQuestDef(quest)))
      : cloneQuestDef(quest),
  );
}

export function removeQuestDef(
  quests: readonly QuestDef[],
  questId: string,
): QuestDef[] {
  return quests
    .filter((quest) => quest.questId !== questId)
    .map(cloneQuestDef);
}

/** Sets a trigger dialogue id ("start" or "complete"). */
export function setQuestTrigger(
  quest: QuestDef,
  trigger: "start" | "complete",
  dialogueId: string,
): QuestDef {
  const next = cloneQuestDef(quest);
  next.triggers[trigger] = dialogueId.trim()
    ? { dialogueId: dialogueId.trim() }
    : {};
  return next;
}

/** Adds an empty NPC override row keyed by npcId (no-op if it already exists). */
export function addQuestOverride(quest: QuestDef, npcId: string): QuestDef {
  if (!npcId || quest.npcOverrides[npcId]) {
    return cloneQuestDef(quest);
  }
  const next = cloneQuestDef(quest);
  next.npcOverrides[npcId] = {};
  return next;
}

/** Patches one NPC override's dialogue ids, dropping empty fields. */
export function setQuestOverride(
  quest: QuestDef,
  npcId: string,
  patch: Partial<QuestNpcOverride>,
): QuestDef {
  const next = cloneQuestDef(quest);
  const merged: QuestNpcOverride = { ...next.npcOverrides[npcId], ...patch };
  const cleaned: QuestNpcOverride = {};
  if (merged.active) cleaned.active = merged.active;
  if (merged.activeReady) cleaned.activeReady = merged.activeReady;
  if (merged.completed) cleaned.completed = merged.completed;
  next.npcOverrides[npcId] = cleaned;
  return next;
}

export function removeQuestOverride(quest: QuestDef, npcId: string): QuestDef {
  const next = cloneQuestDef(quest);
  delete next.npcOverrides[npcId];
  return next;
}

/** Sets the reward currency, dropping the field when empty or zero. */
export function setRewardCurrency(
  quest: QuestDef,
  value: number | undefined,
): QuestDef {
  const next = cloneQuestDef(quest);
  if (value === undefined || Number.isNaN(value)) {
    delete next.rewards.currency;
  } else {
    next.rewards.currency = value;
  }
  return next;
}

/** Sets the reward XP, dropping the field when empty. */
export function setRewardXp(
  quest: QuestDef,
  value: number | undefined,
): QuestDef {
  const next = cloneQuestDef(quest);
  if (value === undefined || Number.isNaN(value)) {
    delete next.rewards.xp;
  } else {
    next.rewards.xp = value;
  }
  return next;
}

export function addRewardItem(quest: QuestDef, itemId: string): QuestDef {
  if (!itemId) {
    return cloneQuestDef(quest);
  }
  const next = cloneQuestDef(quest);
  next.rewards.items = [...(next.rewards.items ?? []), { itemId, quantity: 1 }];
  return next;
}

export function updateRewardItem(
  quest: QuestDef,
  index: number,
  patch: Partial<{ itemId: string; quantity: number }>,
): QuestDef {
  const next = cloneQuestDef(quest);
  const items = next.rewards.items ?? [];
  if (index < 0 || index >= items.length) {
    return next;
  }
  items[index] = { ...items[index], ...patch };
  next.rewards.items = items;
  return next;
}

export function removeRewardItem(quest: QuestDef, index: number): QuestDef {
  const next = cloneQuestDef(quest);
  const items = (next.rewards.items ?? []).filter(
    (_, itemIndex) => itemIndex !== index,
  );
  if (items.length > 0) {
    next.rewards.items = items;
  } else {
    delete next.rewards.items;
  }
  return next;
}

/** Builds a default objective of `type`, keeping the given id and description. */
export function createObjective(
  type: QuestObjectiveType,
  id: string,
  description = "",
): QuestObjective {
  switch (type) {
    case "fetch_item":
      return { type, id, itemId: "", quantity: 1, description };
    case "visit_coordinate":
      return { type, id, zoneId: "", x: 0, y: 0, description };
    case "stat_threshold":
      return {
        type,
        id,
        statName: QUEST_STAT_NAME_OPTIONS[0],
        threshold: 1,
        description,
      };
    case "defeat_npc":
      return { type, id, npcId: "", quantity: 1, description };
  }
}

/** A fresh `objective_N` id unique within the quest. */
export function nextObjectiveId(quest: QuestDef): string {
  const used = new Set(quest.objectives.map((objective) => objective.id));
  let index = quest.objectives.length + 1;
  let candidate = `objective_${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `objective_${index}`;
  }
  return candidate;
}

export function addObjective(
  quest: QuestDef,
  type: QuestObjectiveType,
): QuestDef {
  const next = cloneQuestDef(quest);
  next.objectives.push(createObjective(type, nextObjectiveId(quest)));
  return next;
}

/** Patches fields of the objective at `index`; the caller passes valid fields. */
export function updateObjectiveAt(
  quest: QuestDef,
  index: number,
  patch: Record<string, unknown>,
): QuestDef {
  const next = cloneQuestDef(quest);
  if (index < 0 || index >= next.objectives.length) {
    return next;
  }
  next.objectives[index] = {
    ...next.objectives[index],
    ...patch,
  } as QuestObjective;
  return next;
}

/** Switches an objective's type, rebuilding defaults but keeping id + description. */
export function setObjectiveType(
  quest: QuestDef,
  index: number,
  type: QuestObjectiveType,
): QuestDef {
  const next = cloneQuestDef(quest);
  const existing = next.objectives[index];
  if (!existing) {
    return next;
  }
  next.objectives[index] = createObjective(type, existing.id, existing.description);
  return next;
}

export function removeObjectiveAt(quest: QuestDef, index: number): QuestDef {
  const next = cloneQuestDef(quest);
  next.objectives = next.objectives.filter(
    (_, objectiveIndex) => objectiveIndex !== index,
  );
  return next;
}

/** Moves the objective at `index` by `delta` positions, clamped in range. */
export function moveObjective(
  quest: QuestDef,
  index: number,
  delta: number,
): QuestDef {
  const target = index + delta;
  if (
    index < 0 ||
    index >= quest.objectives.length ||
    target < 0 ||
    target >= quest.objectives.length
  ) {
    return cloneQuestDef(quest);
  }
  const next = cloneQuestDef(quest);
  const [moved] = next.objectives.splice(index, 1);
  next.objectives.splice(target, 0, moved);
  return next;
}
