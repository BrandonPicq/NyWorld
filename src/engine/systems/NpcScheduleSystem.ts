import type { Npc, Position } from "../components";
import type { EntityId } from "../ecs/types";
import type { World } from "../ecs/World";
import type { GameMap } from "../GameMap";
import type { NpcScheduleEntryData, NpcSpawnData } from "../ZoneTypes";
import { getWorldMinuteOfDay } from "../time/WorldCalendar";
import { getDialogue } from "../dialogues/dialogueRegistry";

export interface ScheduledNpcPosition {
  zoneId?: string;
  x: number;
  y: number;
  dialogueId?: string;
}

export class NpcScheduleSystem {
  static apply(
    world: World,
    map: GameMap,
    npcSpawns: NpcSpawnData[],
    totalWorldMinutes: number,
  ): void {
    const scheduledNpcIds = new Set(
      npcSpawns
        .filter((npcData) => npcData.schedule && npcData.schedule.length > 0)
        .map((npcData) => npcData.npcId),
    );

    if (scheduledNpcIds.size === 0) {
      return;
    }

    const occupied = new Set<string>();
    const playerPosition = getPlayerPosition(world);
    if (playerPosition) {
      occupied.add(getPositionKey(playerPosition.x, playerPosition.y));
    }

    const npcEntitiesById = getNpcEntitiesById(world);
    for (const [npcId, entityId] of npcEntitiesById) {
      if (scheduledNpcIds.has(npcId)) {
        continue;
      }

      const position = world.getComponent<Position>(entityId, "Position")!;
      occupied.add(getPositionKey(position.x, position.y));
    }

    for (const npcData of npcSpawns) {
      const entityId = npcEntitiesById.get(npcData.npcId);
      if (entityId === undefined) {
        continue;
      }

      const position = world.getComponent<Position>(entityId, "Position")!;
      const npc = world.getComponent<Npc>(entityId, "Npc")!;
      const scheduledPosition = NpcScheduleSystem.getActivePosition(
        npcData.schedule,
        totalWorldMinutes,
      );

      const targetDialogueId = scheduledPosition?.dialogueId ?? npc.baseDialogueId;
      npc.dialogue = getDialogue(targetDialogueId);

      if (!scheduledPosition) {
        occupied.add(getPositionKey(position.x, position.y));
        continue;
      }

      if (
        scheduledPosition.zoneId !== undefined &&
        scheduledPosition.zoneId !== map.zoneId
      ) {
        world.destroyEntity(entityId);
        continue;
      }

      const targetKey = getPositionKey(
        scheduledPosition.x,
        scheduledPosition.y,
      );

      if (occupied.has(targetKey)) {
        occupied.add(getPositionKey(position.x, position.y));
        continue;
      }

      position.x = scheduledPosition.x;
      position.y = scheduledPosition.y;
      occupied.add(targetKey);
    }
  }

  /**
   * Returns the latest schedule position reached during the current day.
   *
   * When no entry has been reached yet, the NPC keeps its map spawn position.
   * This keeps schedules incremental: content can add an 18:00 destination
   * without also declaring every earlier location.
   */
  static getActivePosition(
    schedule: NpcScheduleEntryData[] | undefined,
    totalWorldMinutes: number,
  ): ScheduledNpcPosition | undefined {
    if (!schedule || schedule.length === 0) {
      return undefined;
    }

    const minuteOfDay = getWorldMinuteOfDay(totalWorldMinutes);
    let activeEntry: NpcScheduleEntryData | undefined;

    for (const entry of schedule) {
      const entryMinute = parseScheduleTime(entry.time);
      if (entryMinute !== undefined && entryMinute <= minuteOfDay) {
        activeEntry = entry;
      }
    }

    return activeEntry
      ? {
          zoneId: activeEntry.zoneId,
          x: activeEntry.x,
          y: activeEntry.y,
          dialogueId: activeEntry.dialogueId,
        }
      : undefined;
  }
}

export function parseScheduleTime(time: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    return undefined;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return undefined;
  }

  return hour * 60 + minute;
}

function getPlayerPosition(world: World): Position | undefined {
  const [playerId] = world.entitiesWith("Position", "PlayerControlled");
  if (playerId === undefined) {
    return undefined;
  }

  return world.getComponent<Position>(playerId, "Position");
}

function getNpcEntitiesById(world: World): Map<string, EntityId> {
  const npcEntities = new Map<string, EntityId>();

  for (const entityId of world.entitiesWith("Npc")) {
    const npc = world.getComponent<Npc>(entityId, "Npc")!;
    npcEntities.set(npc.npcId, entityId);
  }

  return npcEntities;
}

function getPositionKey(x: number, y: number): string {
  return `${x},${y}`;
}
