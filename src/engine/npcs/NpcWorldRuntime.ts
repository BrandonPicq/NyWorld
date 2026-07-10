import type { DialogueNode, Npc, Position, Quests } from "../components";
import { World } from "../ecs/World";
import { GameMap } from "../GameMap";
import { getDialogue } from "../dialogues/dialogueRegistry";
import { getAllNpcPresenceDefs } from "./npcPresenceRegistry";
import { getAllQuestDefs } from "../quests/questRegistry";
import {
  cloneNpcState,
  createInitialNpcStateMap,
  createNpcStateMapFromSave,
  type NpcState,
  type NpcStateMap,
} from "./NpcState";
import { NpcScheduleSystem } from "../systems/NpcScheduleSystem";
import type { NpcScheduleEntryData, NpcSpawnData } from "../ZoneTypes";
import {
  despawnNpcInWorld,
  spawnNpcInWorld,
  spawnNpcsInWorld,
} from "../spawner/EntitySpawner";

type NpcWorldRuntimeOptions = {
  world: World;
  getPlayerPosition: () => Position;
  getPlayerQuests: () => Quests;
  isQuestReadyToComplete: (questId: string) => boolean;
};

/**
 * Owns map-facing NPC state: spawning, schedules, interactions, and dialogue
 * resolution. Static NPC and presence definitions remain in content registries.
 */
export class NpcWorldRuntime {
  private states: NpcStateMap = createInitialNpcStateMap();

  constructor(private readonly options: NpcWorldRuntimeOptions) {}

  spawnForMap(map: GameMap, worldTimeMinutes: number): void {
    spawnNpcsInWorld(
      this.options.world,
      this.getCurrentZoneSpawns(map, worldTimeMinutes),
      this.states,
    );
    NpcScheduleSystem.apply(
      this.options.world,
      map,
      this.getScheduledSpawns(map, worldTimeMinutes),
      worldTimeMinutes,
    );
  }

  getNpcAt(x: number, y: number): Npc | undefined {
    for (const entityId of this.options.world.entitiesWith("Position", "Npc")) {
      const position = this.options.world.getComponent<Position>(entityId, "Position");
      if (position?.x === x && position.y === y) {
        return this.options.world.getComponent<Npc>(entityId, "Npc");
      }
    }
    return undefined;
  }

  getNpcById(npcId: string): Npc | undefined {
    for (const entityId of this.options.world.entitiesWith("Npc")) {
      const npc = this.options.world.getComponent<Npc>(entityId, "Npc");
      if (npc?.npcId === npcId) return npc;
    }
    return undefined;
  }

  resolveDialogue(
    npcId: string,
    baseDialogueId: string,
  ): { dialogueId: string; nodes: DialogueNode[] } {
    const quests = this.options.getPlayerQuests();
    const overrides: Array<{ questId: string; priority: number; dialogueId: string }> = [];

    for (const questDef of getAllQuestDefs()) {
      const override = questDef.npcOverrides[npcId];
      if (!override) continue;
      if (quests.active.includes(questDef.questId)) {
        if (this.options.isQuestReadyToComplete(questDef.questId) && override.activeReady) {
          overrides.push({ questId: questDef.questId, priority: 3, dialogueId: override.activeReady });
        } else if (!this.options.isQuestReadyToComplete(questDef.questId) && override.active) {
          overrides.push({ questId: questDef.questId, priority: 2, dialogueId: override.active });
        }
      } else if (quests.completed.includes(questDef.questId) && override.completed) {
        overrides.push({ questId: questDef.questId, priority: 1, dialogueId: override.completed });
      }
    }

    if (overrides.length > 0) {
      overrides.sort((first, second) =>
        second.priority === first.priority
          ? first.questId.localeCompare(second.questId)
          : second.priority - first.priority,
      );
      const dialogueId = overrides[0].dialogueId;
      return { dialogueId, nodes: getDialogue(dialogueId) };
    }
    return { dialogueId: baseDialogueId, nodes: getDialogue(baseDialogueId) };
  }

  getScheduledSpawns(map: GameMap, worldTimeMinutes: number): NpcSpawnData[] {
    const spawns = map.npcs.map(cloneNpcSpawnData);
    const presenceDefs = getAllNpcPresenceDefs();
    this.attachGlobalPresenceSchedules(spawns, presenceDefs, map.zoneId, worldTimeMinutes);

    const existingNpcIds = new Set(spawns.map((spawn) => spawn.npcId));
    for (const presenceDef of presenceDefs) {
      if (existingNpcIds.has(presenceDef.npcId)) continue;
      const firstEntry = presenceDef.schedule[0];
      spawns.push({
        npcId: presenceDef.npcId,
        dialogueId: firstEntry.dialogueId,
        x: firstEntry.x,
        y: firstEntry.y,
        schedule: presenceDef.schedule.map(cloneNpcScheduleEntry),
      });
      existingNpcIds.add(presenceDef.npcId);
    }
    return spawns;
  }

  spawnNpc(npcId: string, x: number, y: number, dialogueId?: string): boolean {
    if (this.getNpcAt(x, y)) return false;
    const player = this.options.getPlayerPosition();
    if (player.x === x && player.y === y) return false;
    spawnNpcInWorld(this.options.world, { npcId, x, y, dialogueId }, this.states);
    return true;
  }

  despawnNpc(npcId: string): boolean {
    return despawnNpcInWorld(this.options.world, npcId);
  }

  getState(npcId: string): NpcState | undefined {
    const state = this.states[npcId];
    return state ? cloneNpcState(state) : undefined;
  }

  getStates(): NpcState[] {
    return Object.values(this.states).map(cloneNpcState);
  }

  restoreStates(states: readonly NpcState[]): void {
    this.states = createNpcStateMapFromSave(states.map((state) => ({ ...state })));
  }

  private getCurrentZoneSpawns(map: GameMap, worldTimeMinutes: number): NpcSpawnData[] {
    const spawns = map.npcs.map(cloneNpcSpawnData);
    const presenceDefs = getAllNpcPresenceDefs();
    this.attachGlobalPresenceSchedules(spawns, presenceDefs, map.zoneId, worldTimeMinutes);

    const existingNpcIds = new Set(spawns.map((spawn) => spawn.npcId));
    for (const presenceDef of presenceDefs) {
      if (existingNpcIds.has(presenceDef.npcId)) continue;
      const activePosition = NpcScheduleSystem.getActivePosition(
        presenceDef.schedule,
        worldTimeMinutes,
      );
      if (
        !activePosition ||
        activePosition.zoneId !== map.zoneId ||
        !map.isWalkable(activePosition.x, activePosition.y) ||
        !this.isSpawnPositionAvailable(spawns, activePosition.x, activePosition.y)
      ) {
        continue;
      }
      spawns.push({
        npcId: presenceDef.npcId,
        dialogueId: activePosition.dialogueId,
        x: activePosition.x,
        y: activePosition.y,
        schedule: presenceDef.schedule.map(cloneNpcScheduleEntry),
      });
      existingNpcIds.add(presenceDef.npcId);
    }
    return spawns;
  }

  private isSpawnPositionAvailable(
    spawns: readonly NpcSpawnData[],
    x: number,
    y: number,
  ): boolean {
    const player = this.options.getPlayerPosition();
    if (player.x === x && player.y === y) return false;
    return !spawns.some((spawn) => spawn.x === x && spawn.y === y);
  }

  private attachGlobalPresenceSchedules(
    spawns: NpcSpawnData[],
    presenceDefs: ReturnType<typeof getAllNpcPresenceDefs>,
    zoneId: string,
    worldTimeMinutes: number,
  ): void {
    const presenceByNpcId = new Map(
      presenceDefs.map((presenceDef) => [presenceDef.npcId, presenceDef]),
    );
    for (const spawn of spawns) {
      const presenceDef = presenceByNpcId.get(spawn.npcId);
      if (!presenceDef || !presenceDef.schedule.some((entry) => entry.zoneId === zoneId)) {
        continue;
      }
      spawn.schedule = presenceDef.schedule.map(cloneNpcScheduleEntry);
      const activePosition = NpcScheduleSystem.getActivePosition(spawn.schedule, worldTimeMinutes);
      if (activePosition?.dialogueId) spawn.dialogueId = activePosition.dialogueId;
    }
  }
}

function cloneNpcSpawnData(npcData: NpcSpawnData): NpcSpawnData {
  return {
    ...npcData,
    schedule: npcData.schedule?.map(cloneNpcScheduleEntry),
  };
}

function cloneNpcScheduleEntry(entry: NpcScheduleEntryData): NpcScheduleEntryData {
  return { ...entry };
}
