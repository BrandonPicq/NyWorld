import type { InventoryItemCategory } from "../components/Inventory";

export interface ItemDef {
  name: string;
  description: string;
  category: InventoryItemCategory;
  defaultQuantity: number;
}

export type ItemDefMap = Record<string, ItemDef>;
