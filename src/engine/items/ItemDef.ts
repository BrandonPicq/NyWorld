import type { InventoryItemCategory } from "../components/Inventory";

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
}

/**
 * Map of item ids to catalog definitions as loaded from content.
 */
export type ItemDefMap = Record<string, ItemDef>;
