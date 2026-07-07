import type { InventoryStack, InventoryItemCategory } from "../../engine";

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
