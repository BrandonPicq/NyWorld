/**
 * Numeric id used inside a zone tile grid.
 *
 * The id must exist in the tile registry before the zone can be loaded.
 */
export type TileId = number;

/**
 * Initial player coordinate for a zone.
 *
 * Coordinates use grid space with (0, 0) at the top-left corner.
 */
export interface PlayerStart {
  x: number;
  y: number;
}

/**
 * Rectangular tile matrix indexed as tiles[y][x].
 */
export type TileGrid = TileId[][];

/**
 * A doorway-like link from one tile to a target zone coordinate.
 *
 * The source coordinate belongs to the current zone. The target coordinate is
 * resolved after the destination zone has been loaded.
 */
export interface ZoneTransitionData {
  x: number;
  y: number;
  targetZoneId: string;
  targetX: number;
  targetY: number;
}

/**
 * One line of dialogue content.
 *
 * The pitch controls the UI voice bleep for this line and can be adjusted per
 * node for emphasis, shouting, whispers, or unusual voices.
 */
export interface DialogueNodeData {
  /** Display name of the character speaking the line. */
  speaker: string;
  /** Line text, revealed with the typewriter effect. */
  text: string;
  /** Voice bleep pitch multiplier; 1 is neutral, minimum accepted is 0.1. */
  pitch: number;
}

/**
 * Places a known NPC definition in a zone.
 *
 * dialogueId optionally overrides the character's current/default dialogue for
 * this appearance. schedule optionally moves this appearance as world time
 * advances.
 */
export interface NpcSpawnData {
  npcId: string;
  dialogueId?: string;
  x: number;
  y: number;
  schedule?: NpcScheduleEntryData[];
}

/**
 * Time-based position override for an NPC.
 *
 * time is parsed as HH:mm in the world day. zoneId can move a globally present
 * NPC to another zone; when omitted, the entry targets the current zone.
 */
export interface NpcScheduleEntryData {
  time: string;
  zoneId?: string;
  x: number;
  y: number;
  dialogueId?: string;
}

/**
 * Places a collectible item stack in a zone.
 *
 * itemId must reference the item catalog. quantity is the amount added to the
 * player's inventory when the stack is collected.
 */
export interface ItemSpawnData {
  itemId: string;
  x: number;
  y: number;
  quantity: number;
}

/**
 * Raw author-facing data for a zone JSON file.
 *
 * loadZone validates this shape and turns it into a GameMap before gameplay
 * systems can use it; validateZoneData reports all authoring problems at once
 * for editor workflows.
 */
export interface ZoneData {
  /** Free-form data format marker for future migrations, e.g. "0.1". */
  version: string;
  /** Stable id referenced by transitions, schedules, quests, and saves. */
  zoneId: string;
  /** Display name shown when entering the zone. */
  name: string;
  /** Grid width in tiles; every tiles row must have exactly this length. */
  width: number;
  /** Grid height in tiles; tiles must have exactly this many rows. */
  height: number;
  /** Where the player appears on a fresh game; must be a walkable tile. */
  playerStart: PlayerStart;
  /** Enables persistent 3x3 local visibility for this zone. */
  fogOfWar?: boolean;
  /** Tile grid indexed as tiles[y][x]; ids must exist in the tile catalog. */
  tiles: TileGrid;
  /** Doorways to other zones; each must sit on a walkable tile. */
  transitions?: ZoneTransitionData[];
  /** NPC appearances; spawn tiles must be walkable. */
  npcs?: NpcSpawnData[];
  /** Ground item stacks; must not overlap the player start or an NPC spawn. */
  items?: ItemSpawnData[];
  /** @deprecated Shipped content uses the events family; retained for old saves and test fixtures. */
  entryDialogue?: DialogueNodeData[];
}
