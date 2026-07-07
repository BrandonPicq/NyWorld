import { describe, expect, it } from "vitest";
import { getCategoriesPresent } from "./inventoryHelper";
import type { InventoryItemCategory, InventoryStack } from "../../engine";

describe("inventoryHelper", () => {
  it("returns categories in the correct predefined order", () => {
    const items: InventoryStack[] = [
      { itemId: "item_misc", quantity: 1 },
      { itemId: "item_quest", quantity: 1 },
      { itemId: "item_consumable", quantity: 1 },
    ];

    const categoryMap: Record<string, InventoryItemCategory> = {
      item_misc: "misc",
      item_quest: "quest",
      item_consumable: "consumable",
    };

    const categories = getCategoriesPresent(items, (id) => categoryMap[id]);
    expect(categories).toEqual(["quest", "consumable", "misc"]);
  });

  it("handles empty inventory", () => {
    const categories = getCategoriesPresent([], () => "misc");
    expect(categories).toEqual([]);
  });

  it("handles duplicates gracefully", () => {
    const items: InventoryStack[] = [
      { itemId: "item_quest_1", quantity: 1 },
      { itemId: "item_quest_2", quantity: 1 },
      { itemId: "item_equipment", quantity: 1 },
    ];

    const categoryMap: Record<string, InventoryItemCategory> = {
      item_quest_1: "quest",
      item_quest_2: "quest",
      item_equipment: "equipment",
    };

    const categories = getCategoriesPresent(items, (id) => categoryMap[id]);
    expect(categories).toEqual(["quest", "equipment"]);
  });
});
