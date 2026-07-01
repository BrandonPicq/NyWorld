export type TileId = number;

export interface PlayerStart {
  x: number;
  y: number;
}

export type TileGrid = TileId[][];

export interface ZoneTransitionData {
  x: number;
  y: number;
  targetZoneId: string;
  targetX: number;
  targetY: number;
}

export interface DialogueNodeData {
  speaker: string;
  text: string;
  pitch: number;
}

export type NpcRace = "human" | "elf" | "dwarf" | "orc" | "unknown";

export type NpcImportance = "common" | "notable" | "story";

export interface NpcPresentationOverride {
  glyph: string;
  color: string;
}

export interface NpcSpawnData {
  npcId: string;
  name: string;
  race: NpcRace;
  importance?: NpcImportance;
  presentation?: NpcPresentationOverride;
  x: number;
  y: number;
  dialogue: DialogueNodeData[];
}

export interface ItemSpawnData {
  itemId: string;
  x: number;
  y: number;
  quantity: number;
}

export interface ZoneData {
  version: string;
  zoneId: string;
  name: string;
  width: number;
  height: number;
  playerStart: PlayerStart;
  tiles: TileGrid;
  transitions?: ZoneTransitionData[];
  npcs?: NpcSpawnData[];
  items?: ItemSpawnData[];
  entryDialogue?: DialogueNodeData[];
}
