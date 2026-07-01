import type { InventoryItemCategory } from "../components/Inventory";

export interface ItemDef {
  name: string;
  description: string;
  category: InventoryItemCategory;
  defaultQuantity: number;
  glyph: string;
  color: string;
}

export type ItemDefMap = Record<string, ItemDef>;
