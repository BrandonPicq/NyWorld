import type { Inventory } from "./components";
import type { NewGameConfig } from "./content/contentBundle";

/**
 * Fallback starting stacks used when no authored new-game config is injected,
 * so tests and isolated engine instances stay self-contained.
 */
const DEFAULT_STARTING_INVENTORY = [
  { itemId: "academy_notebook", quantity: 1 },
  { itemId: "travel_ration", quantity: 3 },
  { itemId: "chalk_piece", quantity: 2 },
] as const;

/**
 * Builds the player's starting inventory for a fresh playthrough.
 *
 * Saves restore the full inventory afterwards, so this only shapes new games.
 */
export function createStartingInventory(config?: NewGameConfig): Inventory {
  const stacks = config?.startingInventory ?? DEFAULT_STARTING_INVENTORY;

  return {
    type: "Inventory",
    items: stacks.map((stack) => ({ ...stack })),
    equipped: {},
  };
}
