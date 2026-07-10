import type {
  DialogueNode,
  Inventory,
  Npc,
  Position,
  Renderable,
  Stats,
  Quests,
} from "../components";
import type { World } from "../ecs/World";
import type { CellVisibility } from "../exploration/ExplorationState";
import type { GameMap } from "../GameMap";
import type { LogEntry } from "../LogEntry";
import { cloneNpcState, type NpcState } from "../npcs/NpcState";
import { getQuestDef } from "../quests/questRegistry";
import { hasCompletedQuestObjective } from "../quests/QuestProgressionSystem";
import type { Direction } from "../systems/MovementSystem";
import { cloneStats, getStatValue } from "../stats/characterStats";
import {
  cloneLayeredStatBreakdown,
  type LayeredStatBreakdown,
} from "../stats/layeredStats";
import { createWorldTimeSnapshot } from "../time/WorldCalendar";
import type { CombatState } from "../combat/CombatSystem";
import type { KnownPatternMap } from "../combat/PatternDef";
import { cloneKnownPatterns } from "../combat/QtePatternLearningSystem";
import type { GameSnapshot, RenderEntity } from "./GameplayTypes";

type BuildGameSnapshotInput = {
  world: World;
  map: GameMap;
  tick: number;
  worldTimeMinutes: number;
  playerPosition: Position;
  playerFacing: Direction;
  mapVisibility: CellVisibility[][];
  log: LogEntry[];
  stats: Stats;
  statLayers: LayeredStatBreakdown;
  knownPatterns: KnownPatternMap;
  inventory: Inventory;
  npcStates: NpcState[];
  quests: Quests;
  entryDialogue: DialogueNode[];
  eventDialogue: DialogueNode[];
  eventDialogueId?: string;
  worldFlags?: string[];
  firedEventIds?: string[];
  combatState?: CombatState;
  isQuestReadyToComplete: (questId: string) => boolean;
};

/** Builds a detached UI projection without letting rendering inspect ECS state. */
export function buildGameSnapshot(input: BuildGameSnapshotInput): GameSnapshot {
  const tiles = buildTileSnapshot(input.map);
  const entities = buildEntitySnapshot(input.world);
  const activeQuests = buildActiveQuestSnapshot(
    input.quests,
    input.inventory,
    input.stats,
    input.map.zoneId,
    input.playerPosition,
    input.isQuestReadyToComplete,
  );

  return {
    tick: input.tick,
    worldTime: createWorldTimeSnapshot(input.worldTimeMinutes),
    zoneId: input.map.zoneId,
    zoneName: input.map.name,
    mapWidth: input.map.width,
    mapHeight: input.map.height,
    playerX: input.playerPosition.x,
    playerY: input.playerPosition.y,
    playerFacing: input.playerFacing,
    tiles,
    mapVisibility: input.mapVisibility.map((row) => [...row]),
    log: input.log.map((entry) => ({ ...entry })),
    stats: cloneStats(input.stats),
    statLayers: cloneLayeredStatBreakdown(input.statLayers),
    knownPatterns: cloneKnownPatterns(input.knownPatterns),
    inventory: {
      ...input.inventory,
      items: input.inventory.items.map((stack) => ({ ...stack })),
      equipped: { ...input.inventory.equipped },
    },
    npcStates: input.npcStates.map(cloneNpcState),
    entities,
    entryDialogue: input.entryDialogue.map((dialogue) => ({ ...dialogue })),
    eventDialogue: input.eventDialogue.map((dialogue) => ({ ...dialogue })),
    eventDialogueId: input.eventDialogueId,
    worldFlags: input.worldFlags ? [...input.worldFlags] : undefined,
    firedEventIds: input.firedEventIds ? [...input.firedEventIds] : undefined,
    activeQuests,
    completedQuests: [...input.quests.completed],
    combatState: input.combatState,
  };
}

function buildTileSnapshot(map: GameMap): number[][] {
  const tiles: number[][] = [];
  for (let y = 0; y < map.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < map.width; x += 1) row.push(map.getTileId(x, y));
    tiles.push(row);
  }
  return tiles;
}

function buildEntitySnapshot(world: World): RenderEntity[] {
  const entities: RenderEntity[] = [];
  for (const entityId of world.entitiesWith("Position", "Renderable")) {
    if (world.hasComponent(entityId, "PlayerControlled")) continue;
    const position = world.getComponent<Position>(entityId, "Position")!;
    const renderable = world.getComponent<Renderable>(entityId, "Renderable")!;
    const npc = world.getComponent<Npc>(entityId, "Npc");
    entities.push({
      x: position.x,
      y: position.y,
      glyph: renderable.glyph,
      color: renderable.color,
      npcId: npc?.npcId,
      name: npc?.name,
    });
  }
  return entities;
}

function buildActiveQuestSnapshot(
  quests: Quests,
  inventory: Inventory,
  stats: Stats,
  zoneId: string,
  playerPosition: Position,
  isQuestReadyToComplete: (questId: string) => boolean,
): GameSnapshot["activeQuests"] {
  return quests.active.flatMap((questId) => {
    const questDef = getQuestDef(questId);
    if (!questDef) return [];

    const objectives = questDef.objectives.map((objective) => {
      let currentQuantity = 0;
      let requiredQuantity = 1;
      if (objective.type === "fetch_item") {
        currentQuantity = inventory.items
          .filter((item) => item.itemId === objective.itemId)
          .reduce((sum, item) => sum + item.quantity, 0);
        requiredQuantity = objective.quantity;
      } else if (objective.type === "visit_coordinate") {
        const visited = hasCompletedQuestObjective(quests, questId, objective.id) ||
          (objective.zoneId === zoneId &&
            objective.x === playerPosition.x &&
            objective.y === playerPosition.y);
        currentQuantity = visited ? 1 : 0;
      } else if (objective.type === "stat_threshold") {
        currentQuantity = getStatValue(stats, objective.statName) ?? 0;
        requiredQuantity = objective.threshold;
      } else if (objective.type === "defeat_npc") {
        currentQuantity = hasCompletedQuestObjective(quests, questId, objective.id)
          ? objective.quantity
          : 0;
        requiredQuantity = objective.quantity;
      }
      return {
        id: objective.id,
        description: objective.description,
        type: objective.type,
        npcId: objective.type === "defeat_npc" ? objective.npcId : undefined,
        requiredQuantity,
        currentQuantity,
      };
    });

    return [{
      questId: questDef.questId,
      name: questDef.name,
      description: questDef.description,
      state: isQuestReadyToComplete(questId) ? "readyToComplete" as const : "active" as const,
      objectives,
      targetNpcId: questDef.targetNpcId,
      rewards: questDef.rewards,
    }];
  });
}
