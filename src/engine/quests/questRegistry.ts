import { hasItemDef } from "../items/itemRegistry";
import { hasNpcDef } from "../npcs/npcRegistry";
import { hasDialogue } from "../dialogues/dialogueRegistry";
import {
  defaultContentBundle,
  resolveZoneFromBundle,
} from "../content/contentBundle";
import type { GameMap } from "../GameMap";
import { isStatPath } from "../stats/characterStats";
import type { QuestDef, QuestDefMap } from "./QuestDef";

const questDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/quests/*.json", {
    eager: true,
    import: "default",
  }),
);

const zoneRegistry = buildZoneRegistry(defaultContentBundle);
const registry = buildRegistry(questDefs);

export function hasQuestDef(questId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, questId);
}

export function getQuestDef(questId: string): QuestDef | undefined {
  const def = registry[questId];
  return def ? cloneQuestDef(def) : undefined;
}

export function getAllQuestDefs(): QuestDef[] {
  return Object.values(registry).map(cloneQuestDef);
}

function buildRegistry(defs: unknown[]): QuestDefMap {
  const nextRegistry: QuestDefMap = {};
  const startTriggers = new Set<string>();
  const completeTriggers = new Set<string>();

  for (const def of defs) {
    assertQuestDef(def);

    if (nextRegistry[def.questId]) {
      throw new Error(`Duplicate quest definition "${def.questId}".`);
    }

    // Uniqueness validation of trigger dialogues across the entire game
    const startDiag = def.triggers.start.dialogueId;
    const completeDiag = def.triggers.complete.dialogueId;

    if (startDiag === completeDiag) {
      throw new Error(
        `Quest "${def.questId}" has the same dialogueId "${startDiag}" for both start and complete triggers.`,
      );
    }

    if (startTriggers.has(startDiag)) {
      throw new Error(
        `Quest "${def.questId}" triggers start from dialogueId "${startDiag}", which is already registered by another quest.`,
      );
    }
    if (completeTriggers.has(startDiag)) {
      throw new Error(
        `Quest "${def.questId}" triggers start from dialogueId "${startDiag}", which is already registered as a completion trigger.`,
      );
    }
    if (startTriggers.has(completeDiag)) {
      throw new Error(
        `Quest "${def.questId}" triggers complete from dialogueId "${completeDiag}", which is already registered as a start trigger.`,
      );
    }
    if (completeTriggers.has(completeDiag)) {
      throw new Error(
        `Quest "${def.questId}" triggers complete from dialogueId "${completeDiag}", which is already registered by another quest.`,
      );
    }

    startTriggers.add(startDiag);
    completeTriggers.add(completeDiag);

    nextRegistry[def.questId] = cloneQuestDef(def);
  }

  return nextRegistry;
}

function buildZoneRegistry(
  bundle: typeof defaultContentBundle,
): Map<string, GameMap> {
  const zones = new Map<string, GameMap>();

  for (const zoneId of Object.keys(bundle.zones)) {
    const zone = resolveZoneFromBundle(bundle, zoneId);
    if (!zone) {
      throw new Error(`Zone definition "${zoneId}" is not available.`);
    }
    zones.set(zone.zoneId, zone);
  }

  return zones;
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

function assertQuestDef(value: unknown): asserts value is QuestDef {
  if (!isRecord(value)) {
    throw new Error("Quest definition must be an object.");
  }

  if (typeof value.questId !== "string" || !value.questId.trim()) {
    throw new Error("Quest definition has invalid or missing questId.");
  }

  if (typeof value.name !== "string" || !value.name.trim()) {
    throw new Error(`Quest "${value.questId}" has invalid or missing name.`);
  }

  if (typeof value.description !== "string" || !value.description.trim()) {
    throw new Error(`Quest "${value.questId}" has invalid or missing description.`);
  }

  if (typeof value.targetNpcId !== "string" || !hasNpcDef(value.targetNpcId)) {
    throw new Error(
      `Quest "${value.questId}" references unknown targetNpcId "${value.targetNpcId}".`,
    );
  }

  assertTriggers(value.triggers, value.questId);
  assertNpcOverrides(value.npcOverrides, value.questId);
  assertObjectives(value.objectives, value.questId);
  assertRewards(value.rewards, value.questId);
}

function assertTriggers(value: unknown, questId: string): void {
  if (!isRecord(value)) {
    throw new Error(`Quest "${questId}" has missing or invalid triggers.`);
  }

  const start = value.start;
  const complete = value.complete;

  if (!isRecord(start) || typeof (start as Record<string, unknown>).dialogueId !== "string" || !hasDialogue((start as Record<string, unknown>).dialogueId as string)) {
    throw new Error(
      `Quest "${questId}" start trigger references unknown dialogueId "${(start as Record<string, unknown>)?.dialogueId}".`,
    );
  }

  if (!isRecord(complete) || typeof (complete as Record<string, unknown>).dialogueId !== "string" || !hasDialogue((complete as Record<string, unknown>).dialogueId as string)) {
    throw new Error(
      `Quest "${questId}" complete trigger references unknown dialogueId "${(complete as Record<string, unknown>)?.dialogueId}".`,
    );
  }
}

function assertNpcOverrides(value: unknown, questId: string): void {
  if (!isRecord(value)) {
    throw new Error(`Quest "${questId}" has missing or invalid npcOverrides.`);
  }

  for (const [npcId, override] of Object.entries(value)) {
    if (!hasNpcDef(npcId)) {
      throw new Error(
        `Quest "${questId}" npcOverrides references unknown npcId "${npcId}".`,
      );
    }

    if (!isRecord(override)) {
      throw new Error(
        `Quest "${questId}" npcOverrides for "${npcId}" must be an object.`,
      );
    }

    if (override.active !== undefined) {
      if (typeof override.active !== "string" || !hasDialogue(override.active)) {
        throw new Error(
          `Quest "${questId}" npcOverrides for "${npcId}" active dialogue references unknown dialogueId "${override.active}".`,
        );
      }
    }

    if (override.activeReady !== undefined) {
      if (typeof override.activeReady !== "string" || !hasDialogue(override.activeReady)) {
        throw new Error(
          `Quest "${questId}" npcOverrides for "${npcId}" activeReady dialogue references unknown dialogueId "${override.activeReady}".`,
        );
      }
    }

    if (override.completed !== undefined) {
      if (typeof override.completed !== "string" || !hasDialogue(override.completed)) {
        throw new Error(
          `Quest "${questId}" npcOverrides for "${npcId}" completed dialogue references unknown dialogueId "${override.completed}".`,
        );
      }
    }
  }
}

function assertObjectives(value: unknown, questId: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Quest "${questId}" must contain at least one objective.`);
  }

  const objIds = new Set<string>();

  for (let i = 0; i < value.length; i++) {
    const obj = value[i];
    if (!isRecord(obj)) {
      throw new Error(`Quest "${questId}" objective ${i} must be an object.`);
    }

    if (typeof obj.id !== "string" || !obj.id.trim()) {
      throw new Error(`Quest "${questId}" objective ${i} is missing an objective id.`);
    }

    if (objIds.has(obj.id)) {
      throw new Error(`Quest "${questId}" duplicate objective id "${obj.id}".`);
    }
    objIds.add(obj.id);

    if (typeof obj.description !== "string" || !obj.description.trim()) {
      throw new Error(`Quest "${questId}" objective "${obj.id}" has invalid description.`);
    }

    if (obj.type === "fetch_item") {
      if (typeof obj.itemId !== "string" || !hasItemDef(obj.itemId)) {
        throw new Error(
          `Quest "${questId}" objective "${obj.id}" references unknown itemId "${obj.itemId}".`,
        );
      }

      if (typeof obj.quantity !== "number" || !Number.isInteger(obj.quantity) || obj.quantity <= 0) {
        throw new Error(
          `Quest "${questId}" objective "${obj.id}" has invalid quantity. Must be a positive integer.`,
        );
      }
    } else if (obj.type === "visit_coordinate") {
      if (typeof obj.zoneId !== "string" || !obj.zoneId.trim()) {
        throw new Error(`Quest "${questId}" objective "${obj.id}" has invalid or missing zoneId.`);
      }

      if (typeof obj.x !== "number" || !Number.isInteger(obj.x) || obj.x < 0) {
        throw new Error(`Quest "${questId}" objective "${obj.id}" has invalid x coordinate.`);
      }

      if (typeof obj.y !== "number" || !Number.isInteger(obj.y) || obj.y < 0) {
        throw new Error(`Quest "${questId}" objective "${obj.id}" has invalid y coordinate.`);
      }

      const zone = zoneRegistry.get(obj.zoneId);
      if (!zone) {
        throw new Error(
          `Quest "${questId}" objective "${obj.id}" references unknown zoneId "${obj.zoneId}".`,
        );
      }

      if (!zone.isInBounds(obj.x, obj.y)) {
        throw new Error(
          `Quest "${questId}" objective "${obj.id}" points outside zone "${obj.zoneId}".`,
        );
      }

      if (!zone.isWalkable(obj.x, obj.y)) {
        throw new Error(
          `Quest "${questId}" objective "${obj.id}" must target a walkable coordinate in zone "${obj.zoneId}".`,
        );
      }
    } else if (obj.type === "stat_threshold") {
      const statName = obj.statName;
      if (typeof statName !== "string" || !isStatPath(statName)) {
        throw new Error(
          `Quest "${questId}" objective "${obj.id}" has invalid or missing statName "${statName}".`,
        );
      }

      if (typeof obj.threshold !== "number" || !Number.isInteger(obj.threshold) || obj.threshold <= 0) {
        throw new Error(`Quest "${questId}" objective "${obj.id}" has invalid threshold.`);
      }
    } else if (obj.type === "defeat_npc") {
      if (typeof obj.npcId !== "string" || !hasNpcDef(obj.npcId)) {
        throw new Error(
          `Quest "${questId}" objective "${obj.id}" references unknown npcId "${obj.npcId}".`,
        );
      }

      if (typeof obj.quantity !== "number" || !Number.isInteger(obj.quantity) || obj.quantity !== 1) {
        throw new Error(
          `Quest "${questId}" objective "${obj.id}" has invalid quantity. Defeat objectives currently support quantity 1.`,
        );
      }
    } else {
      throw new Error(`Quest "${questId}" objective "${obj.id}" has unsupported type "${obj.type}".`);
    }
  }
}

function assertRewards(value: unknown, questId: string): void {
  if (!isRecord(value)) {
    throw new Error(`Quest "${questId}" is missing rewards.`);
  }

  if (value.currency !== undefined) {
    if (typeof value.currency !== "number" || !Number.isInteger(value.currency) || value.currency < 0) {
      throw new Error(`Quest "${questId}" reward currency must be a non-negative integer.`);
    }
  }

  if (value.items !== undefined) {
    if (!Array.isArray(value.items)) {
      throw new Error(`Quest "${questId}" reward items must be an array.`);
    }

    for (let i = 0; i < value.items.length; i++) {
      const rewardItem = value.items[i];
      if (!isRecord(rewardItem)) {
        throw new Error(`Quest "${questId}" reward item ${i} must be an object.`);
      }

      if (typeof rewardItem.itemId !== "string" || !hasItemDef(rewardItem.itemId)) {
        throw new Error(
          `Quest "${questId}" reward item ${i} references unknown itemId "${rewardItem.itemId}".`,
        );
      }

      if (typeof rewardItem.quantity !== "number" || !Number.isInteger(rewardItem.quantity) || rewardItem.quantity <= 0) {
        throw new Error(
          `Quest "${questId}" reward item ${i} has invalid quantity. Must be a positive integer.`,
        );
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
