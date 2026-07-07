import type { Component } from "../ecs/types";

/**
 * Broad item families used by UI grouping and future gameplay rules.
 */
export type InventoryItemCategory =
  | "quest"
  | "consumable"
  | "material"
  | "equipment"
  | "misc";

/**
 * Quantity of one item type held by an inventory.
 *
 * Item display data is resolved from the item catalog by itemId.
 */
export interface InventoryStack {
  itemId: string;
  quantity: number;
}

export const EQUIPPED_SLOT_IDS = [
  "weapon",
  "offHand",
  "head",
  "body",
  "hands",
  "feet",
  "accessory1",
  "accessory2",
] as const;

export type EquippedSlot = (typeof EQUIPPED_SLOT_IDS)[number];

export type EquippedItems = Partial<Record<EquippedSlot, string>>;

/**
 * Component storing the item stacks carried by an entity and the items
 * currently assigned to equipment slots.
 */
export interface Inventory extends Component {
  readonly type: "Inventory";
  items: InventoryStack[];
  equipped: EquippedItems;
}
