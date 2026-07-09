import type { World } from "../ecs/World";
import type { NpcStateMap } from "../npcs/NpcState";
import type { NpcSpawnData, ItemSpawnData } from "../ZoneTypes";
import type { Npc, Position, Renderable, Item } from "../components";
import { getNpcDef } from "../npcs/npcRegistry";
import { getNpcMapPresentation } from "../npcs/npcMapPresentation";
import { getDialogue } from "../dialogues/dialogueRegistry";
import { getItemDef } from "../items/itemRegistry";
import { getItemMapPresentation } from "../items/itemMapPresentation";

/**
 * Rebuilds NPC entities for the active map from spawn data and character state.
 *
 * Existing NPC entities are removed first because zone entry, save restore, and
 * schedule changes all treat the active map as the source of truth for current
 * NPC presence.
 */
export function spawnNpcsInWorld(
  world: World,
  npcSpawns: NpcSpawnData[],
  npcStates: NpcStateMap,
): void {
  const existingNpcs = world.entitiesWith("Npc");
  for (const npcId of existingNpcs) {
    world.destroyEntity(npcId);
  }

  for (const npcData of npcSpawns) {
    spawnNpcInWorld(world, npcData, npcStates);
  }
}

export function spawnNpcInWorld(
  world: World,
  npcData: NpcSpawnData,
  npcStates: NpcStateMap,
): void {
  const npcDef = getNpcDef(npcData.npcId);
  const presentation = getNpcMapPresentation(npcDef);
  const dialogueId =
    npcData.dialogueId ??
    npcStates[npcDef.npcId]?.currentDialogueId ??
    npcDef.defaultDialogueId;
  const dialogue = getDialogue(dialogueId);
  const entityId = world.createEntity();

  world.addComponent(entityId, {
    type: "Position",
    x: npcData.x,
    y: npcData.y,
  } as Position);
  world.addComponent(entityId, {
    type: "Renderable",
    glyph: presentation.glyph,
    color: presentation.color,
  } as Renderable);
  world.addComponent(entityId, {
    type: "Npc",
    npcId: npcDef.npcId,
    name: npcDef.name,
    race: npcDef.race,
    importance: npcDef.importance ?? "common",
    baseDialogueId: dialogueId,
    dialogueId,
    dialogue,
  } as Npc);
}

export function despawnNpcInWorld(world: World, npcId: string): boolean {
  for (const entityId of world.entitiesWith("Npc")) {
    const npc = world.getComponent<Npc>(entityId, "Npc");
    if (npc?.npcId === npcId) {
      world.destroyEntity(entityId);
      return true;
    }
  }
  return false;
}

/**
 * Rebuilds uncollected ground item entities for the active map.
 *
 * pickedUpKeys stores collected spawn ids, allowing content files to stay
 * unchanged while the engine remembers which placed stacks are gone in this
 * playthrough.
 */
export function spawnItemsInWorld(
  world: World,
  items: ItemSpawnData[],
  pickedUpKeys: Set<string>,
  zoneId: string,
): void {
  const existingItems = world.entitiesWith("Item");
  for (const itemId of existingItems) {
    world.destroyEntity(itemId);
  }

  for (const itemData of items) {
    const spawnKey = `${zoneId}:${itemData.itemId}:${itemData.x},${itemData.y}`;
    if (pickedUpKeys.has(spawnKey)) {
      continue;
    }

    const itemDef = getItemDef(itemData.itemId);
    const presentation = getItemMapPresentation(itemData.itemId);
    const entityId = world.createEntity();

    world.addComponent(entityId, {
      type: "Position",
      x: itemData.x,
      y: itemData.y,
    } as Position);

    world.addComponent(entityId, {
      type: "Renderable",
      glyph: presentation.glyph,
      color: presentation.color,
    } as Renderable);

    world.addComponent(entityId, {
      type: "Item",
      itemId: itemData.itemId,
      quantity: itemData.quantity,
      spawnKey,
    } as Item);
  }
}
