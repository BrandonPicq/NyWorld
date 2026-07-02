import { hasDialogue } from "../dialogues/dialogueRegistry";
import { parseScheduleTime } from "../systems/NpcScheduleSystem";
import { hasNpcDef } from "./npcRegistry";
import type { NpcPresenceDef, NpcPresenceDefMap } from "./NpcPresenceDef";

const presenceDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/npc-presence/*.json", {
    eager: true,
    import: "default",
  }),
);

const registry = buildRegistry(presenceDefs);

export function hasNpcPresenceDef(npcId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, npcId);
}

export function getNpcPresenceDef(npcId: string): NpcPresenceDef | undefined {
  const def = registry[npcId];
  return def ? cloneNpcPresenceDef(def) : undefined;
}

export function getAllNpcPresenceDefs(): NpcPresenceDef[] {
  return Object.values(registry).map(cloneNpcPresenceDef);
}

function buildRegistry(defs: unknown[]): NpcPresenceDefMap {
  const nextRegistry: NpcPresenceDefMap = {};

  for (const def of defs) {
    assertNpcPresenceDef(def);

    if (nextRegistry[def.npcId]) {
      throw new Error(`Duplicate NPC presence definition "${def.npcId}".`);
    }

    nextRegistry[def.npcId] = cloneNpcPresenceDef(def);
  }

  return nextRegistry;
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function cloneNpcPresenceDef(def: NpcPresenceDef): NpcPresenceDef {
  return {
    ...def,
    schedule: def.schedule.map((entry) => ({ ...entry })),
  };
}

function assertNpcPresenceDef(value: unknown): asserts value is NpcPresenceDef {
  if (!isRecord(value)) {
    throw new Error("NPC presence definition must be an object.");
  }

  if (typeof value.npcId !== "string" || !value.npcId.trim()) {
    throw new Error("NPC presence definition has invalid or missing npcId.");
  }

  if (!hasNpcDef(value.npcId)) {
    throw new Error(
      `NPC presence definition references unknown npcId "${value.npcId}".`,
    );
  }

  assertSchedule(value.schedule, value.npcId);
}

function assertSchedule(value: unknown, npcId: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `NPC presence definition "${npcId}" schedule must contain entries.`,
    );
  }

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];

    if (!isRecord(entry)) {
      throw new Error(
        `NPC presence definition "${npcId}" schedule entry ${i} must be an object.`,
      );
    }

    assertScheduleEntry(entry, npcId, i);
  }
}

function assertScheduleEntry(
  entry: Record<string, unknown>,
  npcId: string,
  index: number,
): void {
  if (
    typeof entry.time !== "string" ||
    parseScheduleTime(entry.time) === undefined
  ) {
    throw new Error(
      `NPC presence definition "${npcId}" schedule entry ${index} has invalid time.`,
    );
  }

  if (typeof entry.zoneId !== "string" || !entry.zoneId.trim()) {
    throw new Error(
      `NPC presence definition "${npcId}" schedule entry ${index} has invalid zoneId.`,
    );
  }

  if (
    typeof entry.x !== "number" ||
    !Number.isInteger(entry.x) ||
    entry.x < 0
  ) {
    throw new Error(
      `NPC presence definition "${npcId}" schedule entry ${index} has invalid x.`,
    );
  }

  if (
    typeof entry.y !== "number" ||
    !Number.isInteger(entry.y) ||
    entry.y < 0
  ) {
    throw new Error(
      `NPC presence definition "${npcId}" schedule entry ${index} has invalid y.`,
    );
  }

  if (entry.dialogueId !== undefined) {
    if (typeof entry.dialogueId !== "string" || !hasDialogue(entry.dialogueId)) {
      throw new Error(
        `NPC presence definition "${npcId}" schedule entry ${index} references unknown dialogueId "${entry.dialogueId}".`,
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
