import {
  DIRECTION_DELTA,
  type Direction,
  type GameCommand,
  type GameSnapshot,
} from "../../engine";
import type { GameplaySettings } from "../controls/gameplaySettings";

const interactionDirectionOrder: Direction[] = ["north", "east", "south", "west"];

export type InteractionTarget = {
  id: string;
  kind: "npc";
  label: string;
  npcId: string;
  direction: Direction;
  x: number;
  y: number;
};

/**
 * Builds player-facing interaction choices from the engine snapshot.
 *
 * The result is ordered by cardinal direction so the UI choice list and engine
 * fallback behavior stay aligned until richer interaction types are added.
 */
export function getInteractionTargets(
  snapshot: GameSnapshot,
  gameplaySettings: GameplaySettings,
): InteractionTarget[] {
  const directions =
    gameplaySettings.interactionTargetingMode === "facing"
      ? [snapshot.playerFacing]
      : interactionDirectionOrder;
  const targets: InteractionTarget[] = [];

  for (const direction of directions) {
    const { dx, dy } = DIRECTION_DELTA[direction];
    const targetX = snapshot.playerX + dx;
    const targetY = snapshot.playerY + dy;

    for (const entity of snapshot.entities) {
      if (!entity.npcId || entity.x !== targetX || entity.y !== targetY) {
        continue;
      }

      targets.push({
        direction,
        id: `npc:${entity.npcId}`,
        kind: "npc",
        label: `Talk to ${entity.name ?? "NPC"}`,
        npcId: entity.npcId,
        x: entity.x,
        y: entity.y,
      });
    }
  }

  return targets;
}

/**
 * Converts a chosen interaction target into the explicit engine command.
 */
export function createInteractionCommand(
  target: InteractionTarget,
): GameCommand {
  return {
    type: "Interact",
    targetDirection: target.direction,
    targetNpcId: target.npcId,
  };
}
