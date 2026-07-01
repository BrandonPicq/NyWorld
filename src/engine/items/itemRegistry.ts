import itemsData from "../../content/items/items.json";
import type { ItemDef, ItemDefMap } from "./ItemDef";

const registry = itemsData as ItemDefMap;

const fallback: ItemDef = {
  name: "Unknown Item",
  description: "An item that is not yet defined.",
  category: "misc",
  defaultQuantity: 1,
};

export function hasItemDef(itemId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, itemId);
}

export function getItemDef(itemId: string): ItemDef {
  return registry[itemId] ?? fallback;
}
