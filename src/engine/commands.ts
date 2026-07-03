import type { Direction } from "./systems";

export type GameCommand =
  | { type: "MoveNorth" }
  | { type: "MoveSouth" }
  | { type: "MoveWest" }
  | { type: "MoveEast" }
  | { type: "Interact"; targetNpcId?: string; targetDirection?: Direction }
  | { type: "Rest" }
  | { type: "Study" }
  | { type: "UseItem"; itemId: string }
  | { type: "CompleteDialogue" }
  | { type: "AcknowledgeZoneEntryDialogue" }
  | { type: "SelectCombatAction"; actionKind: "physical" | "magical" | "flee" }
  | { type: "SubmitCombatQte"; completed: boolean; inputAdvantage: number }
  | { type: "ConcludeCombat" };
