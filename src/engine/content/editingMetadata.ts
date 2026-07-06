import type { CombatActionCategory } from "../combat/CombatActionDef";
import type { NpcImportance, NpcRace } from "../npcs/NpcDef";
import type { StatPath } from "../stats/characterStats";

export const ITEM_CATEGORY_OPTIONS = [
  "quest",
  "consumable",
  "material",
  "misc",
] as const;

export const COMBAT_ACTION_CATEGORY_OPTIONS = [
  "offense",
  "defense",
  "utility",
] as const satisfies readonly CombatActionCategory[];

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

/**
 * Stat paths a quest `stat_threshold` objective may target.
 *
 * Single source of truth: `characterStats.isStatPath` reads this list so the
 * editor's stat picker and runtime validation never diverge.
 */
export const QUEST_STAT_NAME_OPTIONS = [
  "resources.hp",
  "resources.maxHp",
  "resources.mp",
  "resources.maxMp",
  "resources.sp",
  "resources.maxSp",
  "resources.energy",
  "resources.maxEnergy",
  "attributes.strength",
  "attributes.vitality",
  "attributes.agility",
  "attributes.intelligence",
  "attributes.spirit",
  "attributes.willpower",
  "attributes.perception",
  "attributes.charisma",
  "combat.attack",
  "combat.magicAttack",
  "combat.defense",
  "combat.magicDefense",
  "skills.melee",
  "skills.ranged",
  "skills.guard",
  "skills.evasion",
  "skills.spellcasting",
  "skills.focus",
  "skills.athletics",
  "skills.scholarship",
  "skills.speech",
  "progression.academicProgress",
] as const satisfies readonly StatPath[];
