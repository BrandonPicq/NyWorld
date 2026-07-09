import { getTileDef } from "./TileRegistry";
import type {
  PlayerStart,
  TileId,
  ZoneData,
  ZoneTransitionData,
  NpcSpawnData,
  ItemSpawnData,
  DialogueNodeData,
} from "./ZoneTypes";

/**
 * Runtime representation of validated zone content.
 *
 * The constructor copies mutable arrays so gameplay code cannot accidentally
 * mutate imported JSON data.
 */
export class GameMap {
  readonly zoneId: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly playerStart: PlayerStart;
  readonly npcs: NpcSpawnData[];
  readonly items: ItemSpawnData[];
  /** @deprecated Compatibility projection for pre-event zone data. */
  readonly entryDialogue: DialogueNodeData[];

  private tiles: TileId[][];
  private transitions: Map<string, ZoneTransitionData>;

  constructor(data: ZoneData) {
    this.zoneId = data.zoneId;
    this.name = data.name;
    this.width = data.width;
    this.height = data.height;
    this.playerStart = { ...data.playerStart };
    this.tiles = data.tiles.map((row) => [...row]);
    this.transitions = new Map();
    this.npcs = data.npcs
      ? data.npcs.map((npc) => ({
          ...npc,
          schedule: npc.schedule
            ? npc.schedule.map((entry) => ({ ...entry }))
            : undefined,
        }))
      : [];
    this.items = data.items
      ? data.items.map((item) => ({ ...item }))
      : [];
    this.entryDialogue = data.entryDialogue
      ? data.entryDialogue.map((dialogue) => ({ ...dialogue }))
      : [];

    for (const transition of data.transitions ?? []) {
      this.transitions.set(`${transition.x},${transition.y}`, transition);
    }
  }

  /**
   * Returns whether a grid coordinate is inside this map's rectangle.
   */
  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Returns whether a coordinate can be occupied by moving entities.
   */
  isWalkable(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) {
      return false;
    }
    return getTileDef(this.tiles[y][x]).walkable;
  }

  /**
   * Returns the tile id at a valid coordinate.
   *
   * Callers are expected to validate bounds before using arbitrary coordinates.
   */
  getTileId(x: number, y: number): TileId {
    return this.tiles[y][x];
  }

  /**
   * Returns the zone transition bound to a coordinate, if any.
   */
  getTransitionAt(x: number, y: number): ZoneTransitionData | undefined {
    return this.transitions.get(`${x},${y}`);
  }
}
