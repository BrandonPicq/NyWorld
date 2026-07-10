import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import type { ContentValidationContext } from "../content/ContentValidationContext";
import { CONTENT_TYPES } from "../content/contentTypes";
import {
  defaultContentBundle,
  resolveAllZonesFromBundle,
} from "../content/contentBundle";
import { getAllDialogueIds } from "../dialogues/dialogueRegistry";
import { getAllItemIds } from "../items/itemRegistry";
import { getAllNpcDefs } from "../npcs/npcRegistry";
import { isStatPath } from "../stats/characterStats";
import type { QuestDef, QuestDefMap } from "./QuestDef";

const QUEST_CONTENT_TYPE = CONTENT_TYPES.quest;

/**
 * Catalog subset that quest validation checks references against.
 *
 * Full editor contexts satisfy this shape structurally; the runtime registry
 * builds only this subset from its direct upstream content modules.
 */
export type QuestValidationContext = Pick<
  ContentValidationContext,
  "itemIds" | "npcIds" | "dialogueIds" | "zones"
>;

const questDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/quests/*.json", {
    eager: true,
    import: "default",
  }),
);

let overlayRegistry: QuestDefMap | null = null;

const registry = buildRegistry(questDefs, createQuestRuntimeContext());

function createQuestRuntimeContext(): QuestValidationContext {
  return {
    itemIds: new Set(getAllItemIds()),
    npcIds: new Set(getAllNpcDefs().map((npc) => npc.npcId)),
    dialogueIds: new Set(getAllDialogueIds()),
    zones: resolveAllZonesFromBundle(defaultContentBundle),
  };
}

export function hasQuestDef(questId: string): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), questId);
}

export function getQuestDef(questId: string): QuestDef | undefined {
  const def = getActiveRegistry()[questId];
  return def ? cloneQuestDef(def) : undefined;
}

export function getAllQuestDefs(): QuestDef[] {
  return Object.values(getActiveRegistry()).map(cloneQuestDef);
}

export function installQuestContentOverlay(
  defs: readonly QuestDef[],
  context: QuestValidationContext,
): void {
  if (!import.meta.env.DEV) return;
  overlayRegistry = buildRegistry(defs, context);
}

export function clearQuestContentOverlay(): void {
  overlayRegistry = null;
}

function getActiveRegistry(): QuestDefMap {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearQuestContentOverlay);
}

/**
 * Validates a full quest registry without throwing.
 *
 * This is the editor-facing path for checks that need knowledge of other quest
 * definitions, such as duplicate ids and dialogue trigger collisions.
 */
export function validateQuestRegistry(
  defs: readonly unknown[],
  context: QuestValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const questIds = new Set<string>();
  const startTriggers = new Set<string>();
  const completeTriggers = new Set<string>();

  for (const def of defs) {
    diagnostics.push(...validateQuestDef(def, context));

    if (!isRecord(def)) {
      continue;
    }

    const questId = getValidQuestId(def);
    if (!questId) {
      continue;
    }

    if (questIds.has(questId)) {
      addQuestError(
        diagnostics,
        def,
        "questId",
        `Duplicate quest definition "${questId}".`,
      );
    } else {
      questIds.add(questId);
    }

    const startDialogueId = getTriggerDialogueId(def, "start");
    const completeDialogueId = getTriggerDialogueId(def, "complete");

    if (
      startDialogueId &&
      completeDialogueId &&
      startDialogueId === completeDialogueId
    ) {
      addQuestError(
        diagnostics,
        def,
        "triggers.complete.dialogueId",
        `Quest "${questId}" has the same dialogueId "${startDialogueId}" for both start and complete triggers.`,
      );
    }

    if (startDialogueId) {
      if (startTriggers.has(startDialogueId)) {
        addQuestError(
          diagnostics,
          def,
          "triggers.start.dialogueId",
          `Quest "${questId}" triggers start from dialogueId "${startDialogueId}", which is already registered by another quest.`,
        );
      }
      if (completeTriggers.has(startDialogueId)) {
        addQuestError(
          diagnostics,
          def,
          "triggers.start.dialogueId",
          `Quest "${questId}" triggers start from dialogueId "${startDialogueId}", which is already registered as a completion trigger.`,
        );
      }
    }

    if (completeDialogueId) {
      if (startTriggers.has(completeDialogueId)) {
        addQuestError(
          diagnostics,
          def,
          "triggers.complete.dialogueId",
          `Quest "${questId}" triggers complete from dialogueId "${completeDialogueId}", which is already registered as a start trigger.`,
        );
      }
      if (completeTriggers.has(completeDialogueId)) {
        addQuestError(
          diagnostics,
          def,
          "triggers.complete.dialogueId",
          `Quest "${questId}" triggers complete from dialogueId "${completeDialogueId}", which is already registered by another quest.`,
        );
      }
    }

    if (startDialogueId) {
      startTriggers.add(startDialogueId);
    }

    if (completeDialogueId) {
      completeTriggers.add(completeDialogueId);
    }
  }

  return diagnostics;
}

/**
 * Validates one quest definition against an explicit content context.
 *
 * The context keeps this function independent from runtime registries, which is
 * what future editor drafts and mod bundles need.
 */
export function validateQuestDef(
  value: unknown,
  context: QuestValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addQuestError(
      diagnostics,
      undefined,
      "$",
      "Quest definition must be an object.",
    );
    return diagnostics;
  }

  const questId = getValidQuestId(value);
  if (!questId) {
    addQuestError(
      diagnostics,
      value,
      "questId",
      "Quest definition has invalid or missing questId.",
    );
  }

  const questLabel = getQuestLabel(value);

  if (typeof value.name !== "string" || !value.name.trim()) {
    addQuestError(
      diagnostics,
      value,
      "name",
      `Quest "${questLabel}" has invalid or missing name.`,
    );
  }

  if (typeof value.description !== "string" || !value.description.trim()) {
    addQuestError(
      diagnostics,
      value,
      "description",
      `Quest "${questLabel}" has invalid or missing description.`,
    );
  }

  if (
    value.targetNpcId !== undefined &&
    (typeof value.targetNpcId !== "string" ||
      (value.targetNpcId !== "" && !context.npcIds.has(value.targetNpcId)))
  ) {
    addQuestError(
      diagnostics,
      value,
      "targetNpcId",
      `Quest "${questLabel}" references unknown targetNpcId "${value.targetNpcId}".`,
    );
  }

  validateTriggers(value.triggers, questLabel, value, context, diagnostics);
  validateNpcOverrides(
    value.npcOverrides,
    questLabel,
    value,
    context,
    diagnostics,
  );
  validateObjectives(value.objectives, questLabel, value, context, diagnostics);
  validateRewards(value.rewards, questLabel, value, context, diagnostics);

  return diagnostics;
}

function buildRegistry(
  defs: readonly unknown[],
  context: QuestValidationContext,
): QuestDefMap {
  const diagnostics = validateQuestRegistry(defs, context);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(firstError.message);
  }

  const nextRegistry: QuestDefMap = {};
  for (const def of defs) {
    const questDef = def as QuestDef;
    nextRegistry[questDef.questId] = cloneQuestDef(questDef);
  }

  return nextRegistry;
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function cloneQuestDef(def: QuestDef): QuestDef {
  return {
    ...def,
    triggers: {
      start: { ...def.triggers.start },
      complete: { ...def.triggers.complete },
    },
    npcOverrides: Object.fromEntries(
      Object.entries(def.npcOverrides).map(([npcId, override]) => [
        npcId,
        { ...override },
      ]),
    ),
    objectives: def.objectives.map((obj) => ({ ...obj })),
    rewards: {
      ...def.rewards,
      items: def.rewards.items?.map((item) => ({ ...item })),
    },
  };
}

function validateTriggers(
  value: unknown,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addQuestError(
      diagnostics,
      questData,
      "triggers",
      `Quest "${questId}" has missing or invalid triggers.`,
    );
    return;
  }

  validateTrigger(
    value.start,
    questId,
    questData,
    context,
    diagnostics,
    "start",
  );
  validateTrigger(
    value.complete,
    questId,
    questData,
    context,
    diagnostics,
    "complete",
  );
}

function validateTrigger(
  value: unknown,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
  triggerType: "start" | "complete",
): void {
  if (!isRecord(value)) {
    addQuestError(
      diagnostics,
      questData,
      `triggers.${triggerType}`,
      `Quest "${questId}" has an invalid ${triggerType} trigger.`,
    );
    return;
  }

  const dialogueId = value.dialogueId;

  if (
    dialogueId !== undefined &&
    (typeof dialogueId !== "string" ||
      (dialogueId !== "" && !context.dialogueIds.has(dialogueId)))
  ) {
    addQuestError(
      diagnostics,
      questData,
      `triggers.${triggerType}.dialogueId`,
      `Quest "${questId}" ${triggerType} trigger references unknown dialogueId "${dialogueId}".`,
    );
  }
}

function validateNpcOverrides(
  value: unknown,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addQuestError(
      diagnostics,
      questData,
      "npcOverrides",
      `Quest "${questId}" has missing or invalid npcOverrides.`,
    );
    return;
  }

  for (const [npcId, override] of Object.entries(value)) {
    if (!context.npcIds.has(npcId)) {
      addQuestError(
        diagnostics,
        questData,
        `npcOverrides.${npcId}`,
        `Quest "${questId}" npcOverrides references unknown npcId "${npcId}".`,
      );
    }

    if (!isRecord(override)) {
      addQuestError(
        diagnostics,
        questData,
        `npcOverrides.${npcId}`,
        `Quest "${questId}" npcOverrides for "${npcId}" must be an object.`,
      );
      continue;
    }

    validateOptionalDialogueOverride(
      override.active,
      questData,
      context,
      diagnostics,
      `npcOverrides.${npcId}.active`,
      `Quest "${questId}" npcOverrides for "${npcId}" active dialogue references unknown dialogueId "${override.active}".`,
    );
    validateOptionalDialogueOverride(
      override.activeReady,
      questData,
      context,
      diagnostics,
      `npcOverrides.${npcId}.activeReady`,
      `Quest "${questId}" npcOverrides for "${npcId}" activeReady dialogue references unknown dialogueId "${override.activeReady}".`,
    );
    validateOptionalDialogueOverride(
      override.completed,
      questData,
      context,
      diagnostics,
      `npcOverrides.${npcId}.completed`,
      `Quest "${questId}" npcOverrides for "${npcId}" completed dialogue references unknown dialogueId "${override.completed}".`,
    );
  }
}

function validateOptionalDialogueOverride(
  value: unknown,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
  path: string,
  message: string,
): void {
  if (
    value !== undefined &&
    (typeof value !== "string" || !context.dialogueIds.has(value))
  ) {
    addQuestError(diagnostics, questData, path, message);
  }
}

function validateObjectives(
  value: unknown,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    addQuestError(
      diagnostics,
      questData,
      "objectives",
      `Quest "${questId}" must contain at least one objective.`,
    );
    return;
  }

  const objIds = new Set<string>();

  for (let i = 0; i < value.length; i++) {
    const obj = value[i];
    const path = `objectives[${i}]`;

    if (!isRecord(obj)) {
      addQuestError(
        diagnostics,
        questData,
        path,
        `Quest "${questId}" objective ${i} must be an object.`,
      );
      continue;
    }

    const objectiveId = getValidObjectiveId(obj);
    const objectiveLabel = objectiveId ?? String(i);

    if (!objectiveId) {
      addQuestError(
        diagnostics,
        questData,
        `${path}.id`,
        `Quest "${questId}" objective ${i} is missing an objective id.`,
      );
    } else if (objIds.has(objectiveId)) {
      addQuestError(
        diagnostics,
        questData,
        `${path}.id`,
        `Quest "${questId}" duplicate objective id "${objectiveId}".`,
      );
    } else {
      objIds.add(objectiveId);
    }

    if (typeof obj.description !== "string" || !obj.description.trim()) {
      addQuestError(
        diagnostics,
        questData,
        `${path}.description`,
        `Quest "${questId}" objective "${objectiveLabel}" has invalid description.`,
      );
    }

    validateObjectiveByType(
      obj,
      questId,
      questData,
      context,
      diagnostics,
      path,
      objectiveLabel,
    );
  }
}

function validateObjectiveByType(
  obj: Record<string, unknown>,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
  path: string,
  objectiveId: string,
): void {
  if (obj.type === "fetch_item") {
    validateFetchItemObjective(
      obj,
      questId,
      questData,
      context,
      diagnostics,
      path,
      objectiveId,
    );
  } else if (obj.type === "visit_coordinate") {
    validateVisitCoordinateObjective(
      obj,
      questId,
      questData,
      context,
      diagnostics,
      path,
      objectiveId,
    );
  } else if (obj.type === "stat_threshold") {
    validateStatThresholdObjective(
      obj,
      questId,
      questData,
      diagnostics,
      path,
      objectiveId,
    );
  } else if (obj.type === "defeat_npc") {
    validateDefeatNpcObjective(
      obj,
      questId,
      questData,
      context,
      diagnostics,
      path,
      objectiveId,
    );
  } else {
    addQuestError(
      diagnostics,
      questData,
      `${path}.type`,
      `Quest "${questId}" objective "${objectiveId}" has unsupported type "${obj.type}".`,
    );
  }
}

function validateFetchItemObjective(
  obj: Record<string, unknown>,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
  path: string,
  objectiveId: string,
): void {
  if (typeof obj.itemId !== "string" || !context.itemIds.has(obj.itemId)) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.itemId`,
      `Quest "${questId}" objective "${objectiveId}" references unknown itemId "${obj.itemId}".`,
    );
  }

  if (
    typeof obj.quantity !== "number" ||
    !Number.isInteger(obj.quantity) ||
    obj.quantity <= 0
  ) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.quantity`,
      `Quest "${questId}" objective "${objectiveId}" has invalid quantity. Must be a positive integer.`,
    );
  }
}

function validateVisitCoordinateObjective(
  obj: Record<string, unknown>,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
  path: string,
  objectiveId: string,
): void {
  if (typeof obj.zoneId !== "string" || !obj.zoneId.trim()) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.zoneId`,
      `Quest "${questId}" objective "${objectiveId}" has invalid or missing zoneId.`,
    );
  }

  const hasValidX =
    typeof obj.x === "number" && Number.isInteger(obj.x) && obj.x >= 0;
  const hasValidY =
    typeof obj.y === "number" && Number.isInteger(obj.y) && obj.y >= 0;

  if (!hasValidX) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.x`,
      `Quest "${questId}" objective "${objectiveId}" has invalid x coordinate.`,
    );
  }

  if (!hasValidY) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.y`,
      `Quest "${questId}" objective "${objectiveId}" has invalid y coordinate.`,
    );
  }

  if (typeof obj.zoneId !== "string" || !obj.zoneId.trim()) {
    return;
  }

  const zone = context.zones.get(obj.zoneId);
  if (!zone) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.zoneId`,
      `Quest "${questId}" objective "${objectiveId}" references unknown zoneId "${obj.zoneId}".`,
    );
    return;
  }

  if (!hasValidX || !hasValidY) {
    return;
  }

  const x = obj.x as number;
  const y = obj.y as number;

  if (!zone.isInBounds(x, y)) {
    addQuestError(
      diagnostics,
      questData,
      path,
      `Quest "${questId}" objective "${objectiveId}" points outside zone "${obj.zoneId}".`,
    );
    return;
  }

  if (!zone.isWalkable(x, y)) {
    addQuestError(
      diagnostics,
      questData,
      path,
      `Quest "${questId}" objective "${objectiveId}" must target a walkable coordinate in zone "${obj.zoneId}".`,
    );
  }
}

function validateStatThresholdObjective(
  obj: Record<string, unknown>,
  questId: string,
  questData: Record<string, unknown>,
  diagnostics: ContentDiagnostic[],
  path: string,
  objectiveId: string,
): void {
  const statName = obj.statName;
  if (typeof statName !== "string" || !isStatPath(statName)) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.statName`,
      `Quest "${questId}" objective "${objectiveId}" has invalid or missing statName "${statName}".`,
    );
  }

  if (
    typeof obj.threshold !== "number" ||
    !Number.isInteger(obj.threshold) ||
    obj.threshold <= 0
  ) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.threshold`,
      `Quest "${questId}" objective "${objectiveId}" has invalid threshold.`,
    );
  }
}

function validateDefeatNpcObjective(
  obj: Record<string, unknown>,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
  path: string,
  objectiveId: string,
): void {
  if (typeof obj.npcId !== "string" || !context.npcIds.has(obj.npcId)) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.npcId`,
      `Quest "${questId}" objective "${objectiveId}" references unknown npcId "${obj.npcId}".`,
    );
  }

  if (
    typeof obj.quantity !== "number" ||
    !Number.isInteger(obj.quantity) ||
    obj.quantity !== 1
  ) {
    addQuestError(
      diagnostics,
      questData,
      `${path}.quantity`,
      `Quest "${questId}" objective "${objectiveId}" has invalid quantity. Defeat objectives currently support quantity 1.`,
    );
  }
}

function validateRewards(
  value: unknown,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addQuestError(
      diagnostics,
      questData,
      "rewards",
      `Quest "${questId}" is missing rewards.`,
    );
    return;
  }

  if (
    value.currency !== undefined &&
    (typeof value.currency !== "number" ||
      !Number.isInteger(value.currency) ||
      value.currency < 0)
  ) {
    addQuestError(
      diagnostics,
      questData,
      "rewards.currency",
      `Quest "${questId}" reward currency must be a non-negative integer.`,
    );
  }

  if (
    value.xp !== undefined &&
    (typeof value.xp !== "number" ||
      !Number.isInteger(value.xp) ||
      value.xp < 0)
  ) {
    addQuestError(
      diagnostics,
      questData,
      "rewards.xp",
      `Quest "${questId}" reward XP must be a non-negative integer.`,
    );
  }

  if (value.items !== undefined) {
    validateRewardItems(value.items, questId, questData, context, diagnostics);
  }
}

function validateRewardItems(
  value: unknown,
  questId: string,
  questData: Record<string, unknown>,
  context: QuestValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    addQuestError(
      diagnostics,
      questData,
      "rewards.items",
      `Quest "${questId}" reward items must be an array.`,
    );
    return;
  }

  for (let i = 0; i < value.length; i++) {
    const rewardItem = value[i];
    const path = `rewards.items[${i}]`;

    if (!isRecord(rewardItem)) {
      addQuestError(
        diagnostics,
        questData,
        path,
        `Quest "${questId}" reward item ${i} must be an object.`,
      );
      continue;
    }

    if (
      typeof rewardItem.itemId !== "string" ||
      !context.itemIds.has(rewardItem.itemId)
    ) {
      addQuestError(
        diagnostics,
        questData,
        `${path}.itemId`,
        `Quest "${questId}" reward item ${i} references unknown itemId "${rewardItem.itemId}".`,
      );
    }

    if (
      typeof rewardItem.quantity !== "number" ||
      !Number.isInteger(rewardItem.quantity) ||
      rewardItem.quantity <= 0
    ) {
      addQuestError(
        diagnostics,
        questData,
        `${path}.quantity`,
        `Quest "${questId}" reward item ${i} has invalid quantity. Must be a positive integer.`,
      );
    }
  }
}

function addQuestError(
  diagnostics: ContentDiagnostic[],
  questData: Record<string, unknown> | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: QUEST_CONTENT_TYPE,
    contentId: getQuestContentId(questData),
    path,
    message,
  });
}

function getQuestContentId(
  questData: Record<string, unknown> | undefined,
): string | undefined {
  return typeof questData?.questId === "string" ? questData.questId : undefined;
}

function getQuestLabel(questData: Record<string, unknown>): string {
  return typeof questData.questId === "string" ? questData.questId : "unknown";
}

function getValidQuestId(questData: Record<string, unknown>): string | undefined {
  return typeof questData.questId === "string" && questData.questId.trim()
    ? questData.questId
    : undefined;
}

function getValidObjectiveId(
  objectiveData: Record<string, unknown>,
): string | undefined {
  return typeof objectiveData.id === "string" && objectiveData.id.trim()
    ? objectiveData.id
    : undefined;
}

function getTriggerDialogueId(
  questData: Record<string, unknown>,
  triggerType: "start" | "complete",
): string | undefined {
  const triggers = questData.triggers;
  if (!isRecord(triggers)) {
    return undefined;
  }

  const trigger = triggers[triggerType];
  if (!isRecord(trigger)) {
    return undefined;
  }

  return typeof trigger.dialogueId === "string" && trigger.dialogueId.trim()
    ? trigger.dialogueId
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
