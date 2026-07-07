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

/**
 * Component storing the item stacks carried by an entity.
 */
export interface Inventory extends Component {
  readonly type: "Inventory";
  items: InventoryStack[];
}
