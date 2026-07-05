import type { NpcImportance, NpcRace } from "../npcs/NpcDef";

export const ITEM_CATEGORY_OPTIONS = [
  "quest",
  "consumable",
  "material",
  "misc",
] as const;

export const NPC_RACE_OPTIONS = [
  "human",
  "elf",
  "dwarf",
  "orc",
  "unknown",
] as const satisfies readonly NpcRace[];

export const NPC_IMPORTANCE_OPTIONS = [
  "common",
  "notable",
  "story",
] as const satisfies readonly NpcImportance[];
