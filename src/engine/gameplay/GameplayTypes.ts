import type { CombatState } from "../combat/CombatSystem";
import type { DialogueNode, Inventory, Stats } from "../components";
import type { CellVisibility } from "../exploration/ExplorationState";
import type { LogEntry } from "../LogEntry";
import type { KnownPatternMap } from "../combat/PatternDef";
import type { Direction } from "../systems/MovementSystem";
import type { LayeredStatBreakdown } from "../stats/layeredStats";
import type { WorldTimeSnapshot } from "../time/WorldCalendar";

export type EngineEffect =
  | {
      type: "ItemCollected";
      itemId: string;
      quantity: number;
      source?: "ground" | "reward" | "event";
    }
  | {
      type: "ItemLost";
      itemId: string;
      quantity: number;
      source?: "quest_turn_in" | "event";
    }
  | {
      type: "ItemUsed";
      itemId: string;
      energyRestored?: number;
      hpRestored?: number;
    }
  | {
      type: "ItemUseRejected";
      itemId: string;
      reason:
        | "energy_full"
        | "no_effect"
        | "already_known"
        | "missing_pattern"
        | "requirements_not_met";
      message: string;
    }
  | {
      type: "PatternLearned";
      itemId: string;
      patternId: string;
    };

export interface EngineNotice {
  title: string;
  message: string;
}

/** Result of applying one explicit player command to the simulation. */
export interface ExecuteResult {
  success: boolean;
  dialogue?: DialogueNode[];
  dialogueId?: string;
  effects?: EngineEffect[];
}

/** Render-ready entity projection exposed through a game snapshot. */
export interface RenderEntity {
  x: number;
  y: number;
  glyph: string;
  color: string;
  npcId?: string;
  name?: string;
}

/** Immutable UI-facing view of the current game state. */
export interface GameSnapshot {
  tick: number;
  worldTime: WorldTimeSnapshot;
  zoneId: string;
  zoneName: string;
  mapWidth: number;
  mapHeight: number;
  playerX: number;
  playerY: number;
  playerFacing: Direction;
  tiles: number[][];
  mapVisibility?: CellVisibility[][];
  log: LogEntry[];
  stats: Stats;
  statLayers: LayeredStatBreakdown;
  knownPatterns: KnownPatternMap;
  inventory: Inventory;
  npcStates: Array<{
    npcId: string;
    relationship: number;
    progressionLevel: number;
    currentRole: string;
    currentDialogueId?: string;
    knownFlags: string[];
  }>;
  entities: RenderEntity[];
  entryDialogue: DialogueNode[];
  eventDialogue?: DialogueNode[];
  eventDialogueId?: string;
  worldFlags?: string[];
  firedEventIds?: string[];
  activeQuests: Array<{
    questId: string;
    name: string;
    description: string;
    state: "active" | "readyToComplete";
    objectives: Array<{
      id: string;
      description: string;
      type: string;
      itemId?: string;
      npcId?: string;
      requiredQuantity: number;
      currentQuantity: number;
    }>;
    targetNpcId?: string;
    rewards: { currency?: number; xp?: number; items?: Array<{ itemId: string; quantity: number }> };
  }>;
  completedQuests: string[];
  combatState?: CombatState;
}
