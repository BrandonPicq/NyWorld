import type { Direction } from "./systems";
import type { EquippedSlot } from "./components";

/**
 * Combat actions the player can select from the combat menu.
 *
 * These map to the authored combat action content (content/combat-actions),
 * which owns the player-facing texts and tuning values. Item use in combat
 * goes through the regular UseItem command instead.
 */
export type CombatActionCommand =
  | "strike"
  | "cast"
  | "guard"
  | "focus"
  | "flee";

/**
 * Every explicit input the UI can send to the gameplay engine.
 *
 * Commands are the only way React affects the simulation. Each command is
 * validated by the engine, may fail without side effects, and returns an
 * ExecuteResult describing what happened.
 *
 * - Move*: one-tile cardinal step; also updates facing, costs energy and
 *   world time, and can trigger pickups, dialogue collisions, transitions,
 *   or combat.
 * - Interact: contextual action on a nearby NPC. targetNpcId disambiguates
 *   when several targets are adjacent; targetDirection limits the search to
 *   the faced tile when the facing-only gameplay option is active.
 * - Rest / Study: out-of-combat activities tuned by the game config actions
 *   section (energy, intelligence, academic progress, world time).
 * - UseItem: consumes one unit of a consumable stack; outside combat it
 *   restores energy, inside combat it restores HP (item catalog effects).
 * - Equip / Unequip: assigns equipment items to slots and refreshes derived
 *   stats from the equipment layer.
 * - CompleteDialogue: acknowledges the end of the pending NPC dialogue and
 *   fires quest start/complete triggers tied to that dialogue.
 * - AcknowledgeZoneEntryDialogue: marks the pending one-shot zone entry
 *   dialogue as seen so it never replays in this playthrough.
 * - SelectCombatAction / SubmitCombatQte / StartOpponentTurn /
 *   ConcludeCombat: combat-only commands driving the QTE turn loop; they are
 *   rejected outside an active combat.
 */
export type GameCommand =
  | { type: "MoveNorth" }
  | { type: "MoveSouth" }
  | { type: "MoveWest" }
  | { type: "MoveEast" }
  | { type: "Interact"; targetNpcId?: string; targetDirection?: Direction }
  | { type: "Rest" }
  | { type: "Study" }
  | { type: "UseItem"; itemId: string }
  | { type: "Equip"; itemId: string; slot?: EquippedSlot }
  | { type: "Unequip"; slot: EquippedSlot }
  | { type: "CompleteDialogue" }
  | { type: "AcknowledgeZoneEntryDialogue" }
  | { type: "SelectCombatAction"; actionKind: CombatActionCommand }
  | {
      type: "SubmitCombatQte";
      /** True when the full input sequence was entered before the timer ran out. */
      completed: boolean;
      /** Player inputs minus opponent inputs at resolution time; drives crits and dodges. */
      inputAdvantage: number;
      /** Wrong keys pressed; 1 weakens the action, 2 fails it outright. */
      mistakes: number;
    }
  | { type: "StartOpponentTurn" }
  | { type: "ConcludeCombat" };
