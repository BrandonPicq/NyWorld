import type { CombatActionCategory } from "../combat/CombatActionDef";
import type {
  EquipmentArmorSlot,
  EquipmentWeaponType,
} from "../classes/ClassDef";
import type {
  EquipmentBonusKey,
  EquipmentSlot,
} from "../items/ItemDef";
import type { NpcImportance, NpcRace } from "../npcs/NpcDef";
import type { StatPath } from "../stats/characterStats";

export const ITEM_CATEGORY_OPTIONS = [
  "quest",
  "consumable",
  "material",
  "equipment",
  "misc",
] as const;

export const COMBAT_ACTION_CATEGORY_OPTIONS = [
  "offense",
  "defense",
  "utility",
] as const satisfies readonly CombatActionCategory[];

export const CORE_ATTRIBUTE_OPTIONS = [
  "strength",
  "vitality",
  "agility",
  "intelligence",
  "spirit",
  "willpower",
  "perception",
  "charisma",
] as const;

export const EQUIPMENT_WEAPON_TYPE_OPTIONS = [
  "sword",
  "hammer",
  "bow",
  "staff",
] as const satisfies readonly EquipmentWeaponType[];

export const EQUIPMENT_ARMOR_SLOT_OPTIONS = [
  "offHand",
  "head",
  "body",
  "hands",
  "feet",
  "accessory",
] as const satisfies readonly EquipmentArmorSlot[];

export const EQUIPMENT_SLOT_OPTIONS = [
  "weapon",
  ...EQUIPMENT_ARMOR_SLOT_OPTIONS,
] as const satisfies readonly EquipmentSlot[];

export const EQUIPMENT_BONUS_OPTIONS = [
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
  "resources.maxHp",
  "resources.maxMp",
  "resources.maxSp",
  "resources.maxEnergy",
] as const satisfies readonly EquipmentBonusKey[];

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
