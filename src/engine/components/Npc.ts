import type { Component } from "../ecs/types";
import type { NpcImportance, NpcRace } from "../npcs/NpcDef";

export interface DialogueNode {
  speaker: string;
  text: string;
  pitch: number;
}

export interface Npc extends Component {
  readonly type: "Npc";
  readonly npcId: string;
  readonly name: string;
  readonly race: NpcRace;
  readonly importance: NpcImportance;
  readonly dialogue: DialogueNode[];
}
