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
  items: Array<{ stack: InventoryStack; globalIndex: number }>;
}

export function computeEquipmentSlotGroups(
  items: InventoryStack[],
  getEquipmentSlot: (itemId: string) => EquipmentSlot | undefined
): EquipmentSlotGroup[] {
  const groups = new Map<EquipmentSlot, Array<{ stack: InventoryStack; globalIndex: number }>>();

  items.forEach((stack, index) => {
    const slot = getEquipmentSlot(stack.itemId);
    if (!slot) return;
    if (!groups.has(slot)) groups.set(slot, []);
    groups.get(slot)!.push({ stack, globalIndex: index });
  });

  return EQUIPMENT_SLOT_ORDER
    .filter((slot) => groups.has(slot))
    .map((slot) => ({
      slot,
      label: EQUIPMENT_SLOT_LABEL[slot],
      items: groups.get(slot)!,
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
