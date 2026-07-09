import { describe, expect, it } from "vitest";
import {
  computeEquipmentSlotGroups,
  EQUIPMENT_SLOT_LABEL,
  EQUIPMENT_SLOT_ORDER,
  getCategoriesPresent,
} from "./inventoryHelper";
import type {
  EquipmentSlot,
  InventoryItemCategory,
  InventoryStack,
} from "../../engine";

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

describe("EQUIPMENT_SLOT_LABEL", () => {
  it("covers every EquipmentSlot", () => {
    for (const slot of EQUIPMENT_SLOT_ORDER) {
      expect(EQUIPMENT_SLOT_LABEL[slot]).toBeTypeOf("string");
      expect(EQUIPMENT_SLOT_LABEL[slot].length).toBeGreaterThan(0);
    }
  });

  it("has stable labels for known slots", () => {
    expect(EQUIPMENT_SLOT_LABEL.weapon).toBe("Weapon");
    expect(EQUIPMENT_SLOT_LABEL.offHand).toBe("Off Hand");
    expect(EQUIPMENT_SLOT_LABEL.head).toBe("Head");
    expect(EQUIPMENT_SLOT_LABEL.body).toBe("Body");
    expect(EQUIPMENT_SLOT_LABEL.hands).toBe("Hands");
    expect(EQUIPMENT_SLOT_LABEL.feet).toBe("Feet");
    expect(EQUIPMENT_SLOT_LABEL.accessory).toBe("Accessory");
  });
});

describe("EQUIPMENT_SLOT_ORDER", () => {
  it("respects the expected body-top-to-bottom order", () => {
    expect(EQUIPMENT_SLOT_ORDER).toEqual([
      "weapon",
      "offHand",
      "head",
      "body",
      "hands",
      "feet",
      "accessory",
    ]);
  });
});

describe("computeEquipmentSlotGroups", () => {
  const slots: Record<string, EquipmentSlot> = {
    sword: "weapon",
    shield: "offHand",
    helmet: "head",
  };

  const getSlot = (id: string): EquipmentSlot | undefined => slots[id];

  it("returns empty for an empty list", () => {
    expect(computeEquipmentSlotGroups([], getSlot)).toEqual([]);
  });

  it("filters out items without a slot", () => {
    const items: InventoryStack[] = [
      { itemId: "potion", quantity: 2 },
      { itemId: "sword", quantity: 1 },
    ];
    const groups = computeEquipmentSlotGroups(items, getSlot);
    expect(groups).toHaveLength(1);
    expect(groups[0].slot).toBe("weapon");
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].globalIndex).toBe(0);
  });

  it("groups items by slot in stable order", () => {
    const items: InventoryStack[] = [
      { itemId: "helmet", quantity: 1 },
      { itemId: "sword", quantity: 1 },
      { itemId: "shield", quantity: 1 },
    ];
    const groups = computeEquipmentSlotGroups(items, getSlot);
    expect(groups.map((g) => g.slot)).toEqual(["weapon", "offHand", "head"]);
    expect(groups[0].items[0].stack.itemId).toBe("sword");
    expect(groups[1].items[0].stack.itemId).toBe("shield");
    expect(groups[2].items[0].stack.itemId).toBe("helmet");
  });

  it("assigns sequential indexes in grouped display order", () => {
    // Input order differs from display order: indexes must follow the
    // rendered (grouped) order, not the input order.
    const items: InventoryStack[] = [
      { itemId: "helmet", quantity: 1 },
      { itemId: "sword", quantity: 1 },
      { itemId: "shield", quantity: 1 },
    ];
    const groups = computeEquipmentSlotGroups(items, getSlot);
    expect(groups[0].items[0].globalIndex).toBe(0); // sword (weapon)
    expect(groups[1].items[0].globalIndex).toBe(1); // shield (offHand)
    expect(groups[2].items[0].globalIndex).toBe(2); // helmet (head)
  });

  it("keeps multiple items of the same slot together", () => {
    const multiSlots: Record<string, EquipmentSlot> = {
      ring_a: "accessory",
      ring_b: "accessory",
      amulet: "accessory",
    };
    const items: InventoryStack[] = [
      { itemId: "ring_a", quantity: 1 },
      { itemId: "ring_b", quantity: 1 },
      { itemId: "amulet", quantity: 1 },
    ];
    const groups = computeEquipmentSlotGroups(items, (id) => multiSlots[id]);
    expect(groups).toHaveLength(1);
    expect(groups[0].slot).toBe("accessory");
    expect(groups[0].items).toHaveLength(3);
    expect(groups[0].items[0].globalIndex).toBe(0);
    expect(groups[0].items[1].globalIndex).toBe(1);
    expect(groups[0].items[2].globalIndex).toBe(2);
  });
});
