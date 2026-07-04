import itemsData from "../../content/items/items.json";
import type { ItemDef, ItemDefMap } from "./ItemDef";

const registry = itemsData as ItemDefMap;

const fallback: ItemDef = {
  name: "Unknown Item",
  description: "An item that is not yet defined.",
  category: "misc",
  defaultQuantity: 1,
};

/**
 * Returns true when an item id is defined in the item catalog.
 *
 * Loaders use this to reject broken content references before gameplay starts.
 */
export function hasItemDef(itemId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, itemId);
}

/**
 * Returns every registered item id in deterministic order.
 */
export function getAllItemIds(): string[] {
  return Object.keys(registry).sort();
}

/**
 * Returns catalog metadata for an item id.
 *
 * Unknown ids resolve to a safe fallback for display code, but content loaders
 * should still validate ids with hasItemDef before accepting authored data.
 */
export function getItemDef(itemId: string): ItemDef {
  return registry[itemId] ?? fallback;
}
