import oldScholarData from "../../content/npcs/old_scholar.json";
import oldWizardData from "../../content/npcs/old_wizard.json";
import youngPageData from "../../content/npcs/young_page.json";
import type { NpcDef, NpcDefMap, NpcImportance, NpcRace } from "./NpcDef";

const npcDefs = [
  oldScholarData,
  oldWizardData,
  youngPageData,
] as unknown[];

const fallback: NpcDef = {
  npcId: "unknown_npc",
  name: "Unknown NPC",
  race: "unknown",
  dialogue: [
    {
      speaker: "Unknown NPC",
      text: "They have nothing to say yet.",
      pitch: 1,
    },
  ],
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
      dialogue: def.dialogue.map((node) => ({ ...node })),
      presentation: def.presentation ? { ...def.presentation } : undefined,
    };
  }

  return nextRegistry;
}

function cloneNpcDef(def: NpcDef): NpcDef {
  return {
    ...def,
    dialogue: def.dialogue.map((node) => ({ ...node })),
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

  assertDialogueNodes(value.dialogue, value.npcId);
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

function assertDialogueNodes(value: unknown, npcId: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`NPC definition "${npcId}" dialogue must contain nodes.`);
  }

  for (let i = 0; i < value.length; i++) {
    const node = value[i];

    if (!isRecord(node)) {
      throw new Error(`NPC definition "${npcId}" dialogue node ${i} must be an object.`);
    }

    if (typeof node.speaker !== "string" || !node.speaker.trim()) {
      throw new Error(
        `NPC definition "${npcId}" dialogue node ${i} has invalid speaker.`,
      );
    }

    if (typeof node.text !== "string" || !node.text.trim()) {
      throw new Error(
        `NPC definition "${npcId}" dialogue node ${i} has invalid text.`,
      );
    }

    if (
      typeof node.pitch !== "number" ||
      !Number.isFinite(node.pitch) ||
      node.pitch < 0.1
    ) {
      throw new Error(
        `NPC definition "${npcId}" dialogue node ${i} has invalid pitch.`,
      );
    }
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
