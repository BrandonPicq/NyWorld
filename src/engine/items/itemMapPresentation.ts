import type { InventoryItemCategory } from "../components/Inventory";
import { getItemDef } from "./itemRegistry";

export interface ItemMapPresentation {
  glyph: string;
  color: string;
}

const ITEM_GLYPH = "*";

const CATEGORY_COLORS: Record<InventoryItemCategory, string> = {
  quest: "#cba6f7",
  consumable: "#a6e3a1",
  material: "#cdd6f4",
  equipment: "#89b4fa",
  misc: "#f9e2af",
};

/**
 * Returns the glyph and color used to render a ground item, derived from
 * its category. The single shared glyph keeps the map readable while the
 * color distinguishes item families at a glance.
 */
export function getItemMapPresentation(itemId: string): ItemMapPresentation {
  const def = getItemDef(itemId);
  return {
    glyph: ITEM_GLYPH,
    color: CATEGORY_COLORS[def.category],
  };
}
