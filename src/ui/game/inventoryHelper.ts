import type { InventoryStack, InventoryItemCategory, EquipmentSlot } from "../../engine";

export const EQUIPMENT_SLOT_LABEL: Record<EquipmentSlot, string> = {
  weapon: "Weapon",
  offHand: "Off Hand",
  head: "Head",
  body: "Body",
  hands: "Hands",
  feet: "Feet",
  accessory: "Accessory",
};

export const EQUIPMENT_SLOT_ORDER: readonly EquipmentSlot[] = [
  "weapon",
  "offHand",
  "head",
  "body",
  "hands",
  "feet",
  "accessory",
];

export interface EquipmentSlotGroup {
  slot: EquipmentSlot;
  label: string;
  /**
   * `globalIndex` is the sequential index in the grouped DISPLAY order —
   * the keyboard cursor order — not the index in the input array.
   */
  items: Array<{ stack: InventoryStack; globalIndex: number }>;
}

export function computeEquipmentSlotGroups(
  items: InventoryStack[],
  getEquipmentSlot: (itemId: string) => EquipmentSlot | undefined
): EquipmentSlotGroup[] {
  const stacksBySlot = new Map<EquipmentSlot, InventoryStack[]>();

  for (const stack of items) {
    const slot = getEquipmentSlot(stack.itemId);
    if (!slot) continue;
    if (!stacksBySlot.has(slot)) stacksBySlot.set(slot, []);
    stacksBySlot.get(slot)!.push(stack);
  }

  let nextIndex = 0;
  return EQUIPMENT_SLOT_ORDER
    .filter((slot) => stacksBySlot.has(slot))
    .map((slot) => ({
      slot,
      label: EQUIPMENT_SLOT_LABEL[slot],
      items: stacksBySlot.get(slot)!.map((stack) => ({
        stack,
        globalIndex: nextIndex++,
      })),
    }));
}

/**
 * Returns a list of unique item categories present in the given inventory items,
 * ordered by a stable system order: quest -> consumable -> material -> equipment -> misc.
 */
export function getCategoriesPresent(
  items: InventoryStack[],
  getItemCategory: (itemId: string) => InventoryItemCategory
): InventoryItemCategory[] {
  const present = new Set<InventoryItemCategory>();
  for (const stack of items) {
    const category = getItemCategory(stack.itemId);
    present.add(category);
  }

  const order: InventoryItemCategory[] = [
    "quest",
    "consumable",
    "material",
    "equipment",
    "misc",
  ];

  return order.filter((cat) => present.has(cat));
}
