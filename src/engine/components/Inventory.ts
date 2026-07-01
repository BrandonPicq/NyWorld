import type { Component } from "../ecs/types";

export type InventoryItemCategory = "quest" | "consumable" | "material" | "misc";

export interface InventoryStack {
  itemId: string;
  name: string;
  description: string;
  category: InventoryItemCategory;
  quantity: number;
}

export interface Inventory extends Component {
  readonly type: "Inventory";
  items: InventoryStack[];
}
