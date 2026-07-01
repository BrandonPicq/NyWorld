import type { Component } from "../ecs/types";

export interface DialogueNode {
  speaker: string;
  text: string;
  pitch: number;
}

export interface Npc extends Component {
  readonly type: "Npc";
  readonly npcId: string;
  readonly name: string;
  readonly dialogue: DialogueNode[];
}
