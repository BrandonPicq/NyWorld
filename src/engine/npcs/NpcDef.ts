import type { DialogueNodeData } from "../ZoneTypes";

export type NpcRace = "human" | "elf" | "dwarf" | "orc" | "unknown";

export type NpcImportance = "common" | "notable" | "story";

export interface NpcPresentationOverride {
  glyph: string;
  color: string;
}

export interface NpcDef {
  npcId: string;
  name: string;
  race: NpcRace;
  importance?: NpcImportance;
  presentation?: NpcPresentationOverride;
  dialogue: DialogueNodeData[];
}

export type NpcDefMap = Record<string, NpcDef>;
