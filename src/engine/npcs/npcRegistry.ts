import { hasDialogue } from "../dialogues/dialogueRegistry";
import type { NpcDef, NpcDefMap, NpcImportance, NpcRace } from "./NpcDef";

const npcDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/npcs/*.json", {
    eager: true,
    import: "default",
  }),
);

const fallback: NpcDef = {
  npcId: "unknown_npc",
  name: "Unknown NPC",
  race: "unknown",
  defaultDialogueId: "unknown_npc.default",
};

const registry = buildRegistry(npcDefs);

export function hasNpcDef(npcId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, npcId);
}

export function getNpcDef(npcId: string): NpcDef {
  return cloneNpcDef(registry[npcId] ?? fallback);
}

export function getAllNpcDefs(): NpcDef[] {
  return Object.values(registry).map(cloneNpcDef);
}

function buildRegistry(defs: unknown[]): NpcDefMap {
  const nextRegistry: NpcDefMap = {};

  for (const def of defs) {
    assertNpcDef(def);

    if (nextRegistry[def.npcId]) {
      throw new Error(`Duplicate NPC definition "${def.npcId}".`);
    }

    nextRegistry[def.npcId] = {
      ...def,
      presentation: def.presentation ? { ...def.presentation } : undefined,
    };
  }

  return nextRegistry;
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function cloneNpcDef(def: NpcDef): NpcDef {
  return {
    ...def,
    presentation: def.presentation ? { ...def.presentation } : undefined,
  };
}

function assertNpcDef(value: unknown): asserts value is NpcDef {
  if (!isRecord(value)) {
    throw new Error("NPC definition must be an object.");
  }

  if (typeof value.npcId !== "string" || !value.npcId.trim()) {
    throw new Error("NPC definition has invalid or missing npcId.");
  }

  if (typeof value.name !== "string" || !value.name.trim()) {
    throw new Error(`NPC definition "${value.npcId}" has invalid or missing name.`);
  }

  if (!isNpcRace(value.race)) {
    throw new Error(`NPC definition "${value.npcId}" has invalid or missing race.`);
  }

  if (value.importance !== undefined && !isNpcImportance(value.importance)) {
    throw new Error(`NPC definition "${value.npcId}" has invalid importance.`);
  }

  if (value.presentation !== undefined) {
    assertNpcPresentation(value.presentation, value.npcId);
  }

  if (
    typeof value.defaultDialogueId !== "string" ||
    !value.defaultDialogueId.trim()
  ) {
    throw new Error(
      `NPC definition "${value.npcId}" has invalid or missing defaultDialogueId.`,
    );
  }

  if (!hasDialogue(value.defaultDialogueId)) {
    throw new Error(
      `NPC definition "${value.npcId}" references unknown defaultDialogueId "${value.defaultDialogueId}".`,
    );
  }
}

function assertNpcPresentation(value: unknown, npcId: string): void {
  if (!isRecord(value)) {
    throw new Error(`NPC definition "${npcId}" presentation must be an object.`);
  }

  if (typeof value.glyph !== "string" || value.glyph.length !== 1) {
    throw new Error(
      `NPC definition "${npcId}" presentation has invalid glyph.`,
    );
  }

  if (typeof value.color !== "string" || !value.color.trim()) {
    throw new Error(
      `NPC definition "${npcId}" presentation has invalid color.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNpcRace(value: unknown): value is NpcRace {
  return (
    value === "human" ||
    value === "elf" ||
    value === "dwarf" ||
    value === "orc" ||
    value === "unknown"
  );
}

function isNpcImportance(value: unknown): value is NpcImportance {
  return value === "common" || value === "notable" || value === "story";
}
