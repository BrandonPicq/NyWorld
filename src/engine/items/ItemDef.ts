import type { InventoryItemCategory } from "../components/Inventory";
import type {
  EquipmentArmorSlot,
  EquipmentWeaponType,
} from "../classes/ClassDef";

export type EquipmentSlot = "weapon" | EquipmentArmorSlot;

/**
 * Combat minigame a weapon drives when its wielder attacks. Authored as an
 * optional override on a weapon; when omitted the mechanic is derived from the
 * weapon archetype (see `resolveWeaponMinigameType`).
 */
export type EquipmentMinigameType = "sequence" | "mash";

export type EquipmentBonusKey =
  | "attributes.strength"
  | "attributes.vitality"
  | "attributes.agility"
  | "attributes.intelligence"
  | "attributes.spirit"
  | "attributes.willpower"
  | "attributes.perception"
  | "attributes.charisma"
  | "combat.attack"
  | "combat.magicAttack"
  | "combat.defense"
  | "combat.magicDefense"
  | "resources.maxHp"
  | "resources.maxMp"
  | "resources.maxSp"
  | "resources.maxEnergy";

export type EquipmentBonusMap = Partial<Record<EquipmentBonusKey, number>>;

/**
 * Authored gameplay effects applied when a consumable item is used.
 *
 * Systems read only the effect fields they support: exploration item use reads
 * energy restoration, combat item use reads HP restoration.
 */
export interface ItemEffects {
  /** Energy restored when used outside combat. */
  energyRestore?: number;
  /** HP restored when used during combat. */
  hpRestore?: number;
}

export interface EquipmentDef {
  slot: EquipmentSlot;
  weaponType?: EquipmentWeaponType;
  /**
   * Optional override of the weapon's combat minigame. Only valid on weapons;
   * when omitted the archetype default applies.
   */
  minigame?: EquipmentMinigameType;
  bonuses: EquipmentBonusMap;
}

/**
 * Catalog entry for an item type.
 *
 * The catalog owns player-facing metadata. Inventories and ground spawns store
 * only itemId and quantity so names, descriptions, and categories can evolve in
 * one place.
 */
export interface ItemDef {
  /** Display name shown in inventory and logs. */
  name: string;
  /** Short flavor or gameplay description shown by inventory UI. */
  description: string;
  /** Broad item family used by UI labels, colors, and future rules. */
  category: InventoryItemCategory;
  /** Suggested stack amount for systems that create this item without one. */
  defaultQuantity: number;
  /** Optional use effects; consumables without effects are rejected on use. */
  effects?: ItemEffects;
  /** Optional equipment data; only valid for category "equipment". */
  equipment?: EquipmentDef;
}

/**
 * Map of item ids to catalog definitions as loaded from content.
 */
export type ItemDefMap = Record<string, ItemDef>;
