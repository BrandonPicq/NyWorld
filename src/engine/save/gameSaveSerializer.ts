import { GameplayEngine } from "../GameplayEngine";
import type { GameSaveData } from "../GameSaveData";
import { SAVE_VERSION } from "../GameSaveData";
import { cloneNpcState, createNpcStateMapFromSave } from "../npcs/NpcState";
import { spawnNpcsInWorld, spawnItemsInWorld } from "../spawner/EntitySpawner";
import type { Stats, Inventory } from "../components";
import type { GameMap } from "../GameMap";

type ZoneResolver = (zoneId: string) => GameMap | undefined;

export function serializeSaveData(engine: GameplayEngine): GameSaveData {
  const pos = engine.getPlayerPosition();
  const stats = engine.getPlayerStats();
  const inventory = engine.getPlayerInventory();

  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    zoneId: engine.map.zoneId,
    tick: engine.tickCounter.tick,
    worldTimeMinutes: engine.worldTimeMinutes,
    playerX: pos.x,
    playerY: pos.y,
    playerFacing: engine.playerFacing,
    stats: {
      type: "Stats",
      energy: stats.energy,
      maxEnergy: stats.maxEnergy,
      currency: stats.currency,
      attributes: { ...stats.attributes },
      academicTitle: stats.academicTitle,
      academicProgress: stats.academicProgress,
    },
    inventory: {
      type: "Inventory",
      items: inventory.items.map((stack) => ({ ...stack })),
    },
    npcStates: Object.values(engine.npcStates).map(cloneNpcState),
    log: engine.log.map((entry) => ({ ...entry })),
    pickedUpItemSpawnKeys: Array.from(engine.pickedUpItemSpawnKeys),
  };
}

export function deserializeSaveData(
  saveData: GameSaveData,
  options: { resolveZone: ZoneResolver },
): GameplayEngine {
  const map = options.resolveZone(saveData.zoneId);

  if (!map) {
    throw new Error(
      `Cannot load save: zone "${saveData.zoneId}" is not available.`,
    );
  }

  const engine = new GameplayEngine(map, options);

  const [playerId] = engine.world.entitiesWith("PlayerControlled");

  const stats = engine.world.getComponent<Stats>(playerId, "Stats")!;
  stats.energy = saveData.stats.energy;
  stats.maxEnergy = saveData.stats.maxEnergy;
  stats.currency = saveData.stats.currency;
  stats.attributes = { ...saveData.stats.attributes };
  stats.academicTitle = saveData.stats.academicTitle;
  stats.academicProgress = saveData.stats.academicProgress;

  const inventory = engine.world.getComponent<Inventory>(
    playerId,
    "Inventory",
  )!;
  inventory.items = saveData.inventory.items.map((stack) => ({ ...stack }));

  engine.tickCounter.restoreTo(saveData.tick);
  engine.worldTimeMinutes = saveData.worldTimeMinutes;
  engine.npcStates = createNpcStateMapFromSave(saveData.npcStates);
  engine.playerFacing = saveData.playerFacing;
  engine.log = saveData.log.map((entry) => ({ ...entry }));
  engine.pickedUpItemSpawnKeys = new Set(saveData.pickedUpItemSpawnKeys);

  const pos = engine.getPlayerPosition();
  pos.x = saveData.playerX;
  pos.y = saveData.playerY;

  engine.spawnNpcs();
  engine.spawnItems();

  return engine;
}
