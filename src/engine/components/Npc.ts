import type { Component } from "../ecs/types";
import type { NpcImportance, NpcRace } from "../npcs/NpcDef";

/**
 * Runtime dialogue node consumed by the dialogue UI.
 */
export interface DialogueNode {
  speaker: string;
  text: string;
  pitch: number;
}

/**
 * Runtime NPC component attached to an entity currently present in the world.
 *
 * Static identity comes from NpcDef. The active dialogue may be resolved from a
 * zone appearance, saved NPC state, schedule entry, or the character default.
 */
export interface Npc extends Component {
  readonly type: "Npc";
  readonly npcId: string;
  readonly name: string;
  readonly race: NpcRace;
  readonly importance: NpcImportance;
  readonly baseDialogueId: string;
  dialogueId: string;
  dialogue: DialogueNode[];
}
