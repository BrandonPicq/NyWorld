import type {
  ContentCatalogSnapshot,
  ContentValidationContext,
  QuestDef,
  QuestNpcOverride,
} from "../../../engine";

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

/** Builds a blank quest; dialogue triggers and target start empty for the form. */
export function createQuestDef(input: {
  questId: string;
  name: string;
}): QuestDef {
  return {
    questId: input.questId.trim(),
    name: input.name.trim(),
    description: "",
    targetNpcId: "",
    triggers: {
      start: { dialogueId: "" },
      complete: { dialogueId: "" },
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
  next.triggers[trigger] = { dialogueId };
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
