import type { Inventory, Item, Position, Stats } from "../components";
import type { EntityId } from "../ecs/types";
import type { World } from "../ecs/World";
import { WORLD_TIME_ACTION_COST } from "../time/WorldCalendar";
import { getItemDef } from "./itemRegistry";

export type InventoryEffect =
  | {
      type: "ItemCollected";
      itemId: string;
      quantity: number;
      source?: "ground";
    }
  | {
      type: "ItemUsed";
      itemId: string;
      energyRestored: number;
    }
  | {
      type: "ItemUseRejected";
      itemId: string;
      reason: "energy_full" | "no_effect";
      message: string;
    };

export interface InventoryExecuteResult {
  success: boolean;
  effects?: InventoryEffect[];
}

export interface InventorySystemContext {
  world: World;
  getPlayerInventory: () => Inventory;
  getPlayerStats: () => Stats;
  addLog: (message: string) => void;
  advanceTick: () => void;
  advanceWorldTime: (minutes: number) => void;
  markItemSpawnPickedUp: (spawnKey: string) => void;
}

/**
 * Owns ground item pickup and exploration item use.
 *
 * Combat item use stays in CombatSystem because it depends on combat phases and
 * HP restoration rather than exploration time and energy restoration.
 */
export class InventorySystem {
  constructor(private readonly context: InventorySystemContext) {}

  getItemAt(
    x: number,
    y: number,
  ): { entity: EntityId; component: Item } | undefined {
    const itemEntities = this.context.world.entitiesWith("Position", "Item");

    for (const itemEntityId of itemEntities) {
      const itemPos = this.context.world.getComponent<Position>(
        itemEntityId,
        "Position",
      )!;

      if (itemPos.x === x && itemPos.y === y) {
        const component = this.context.world.getComponent<Item>(
          itemEntityId,
          "Item",
        )!;
        return { entity: itemEntityId, component };
      }
    }

    return undefined;
  }

  pickupItem(entity: EntityId, item: Item): InventoryEffect {
    const def = getItemDef(item.itemId);
    const inventory = this.context.getPlayerInventory();
    const existingStack = inventory.items.find(
      (stack) => stack.itemId === item.itemId,
    );

    if (existingStack) {
      existingStack.quantity += item.quantity;
    } else {
      inventory.items.push({
        itemId: item.itemId,
        quantity: item.quantity,
      });
    }

    this.context.world.destroyEntity(entity);
    this.context.markItemSpawnPickedUp(item.spawnKey);

    this.context.addLog(
      `Picked up ${def.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}.`,
    );

    return {
      type: "ItemCollected",
      itemId: item.itemId,
      quantity: item.quantity,
    };
  }

  useItem(itemId: string): InventoryExecuteResult {
    const inventory = this.context.getPlayerInventory();
    const stackIndex = inventory.items.findIndex(
      (stack) => stack.itemId === itemId,
    );

    if (stackIndex === -1) {
      this.context.addLog("You don't have that item.");
      return { success: false };
    }

    const def = getItemDef(itemId);

    if (def.category !== "consumable") {
      this.context.addLog(`${def.name} cannot be used.`);
      return { success: false };
    }

    const energyRestored = def.effects?.energyRestore;

    if (energyRestored === undefined) {
      const message = `${def.name} has no usable effect yet.`;
      this.context.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "no_effect", message },
        ],
      };
    }

    const stats = this.context.getPlayerStats();
    if (stats.resources.energy >= stats.resources.maxEnergy) {
      const message = `${def.name} would have no effect right now.`;
      this.context.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "energy_full", message },
        ],
      };
    }

    const nextEnergy = Math.min(
      stats.resources.maxEnergy,
      stats.resources.energy + energyRestored,
    );
    const actualEnergyRestored = nextEnergy - stats.resources.energy;
    stats.resources.energy = nextEnergy;

    const stack = inventory.items[stackIndex];
    stack.quantity -= 1;

    if (stack.quantity <= 0) {
      inventory.items.splice(stackIndex, 1);
    }

    this.context.advanceTick();
    this.context.advanceWorldTime(WORLD_TIME_ACTION_COST.useItem);
    this.context.addLog(
      `Used ${def.name}. Recovered ${actualEnergyRestored} energy.`,
    );

    return {
      success: true,
      effects: [
        { type: "ItemUsed", itemId, energyRestored: actualEnergyRestored },
      ],
    };
  }
}
