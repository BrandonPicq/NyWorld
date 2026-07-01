import type { Position } from "../components/Position";
import type { GameMap } from "../GameMap";
import type { World } from "../ecs/World";

export type Direction = "north" | "south" | "west" | "east";

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
  east: { dx: 1, dy: 0 },
};

export class MovementSystem {
  /**
   * Moves the first player-controlled positioned entity one cardinal step.
   *
   * Returns false when there is no player entity or the target map tile is not
   * walkable. Time, energy, logs, and interactions are handled by GameplayEngine.
   */
  static move(world: World, direction: Direction, map?: GameMap): boolean {
    const playerIds = world.entitiesWith("Position", "PlayerControlled");

    if (playerIds.length === 0) {
      return false;
    }

    const position = world.getComponent<Position>(playerIds[0], "Position");
    if (!position) {
      return false;
    }

    const { dx, dy } = DIRECTION_DELTA[direction];
    const nextX = position.x + dx;
    const nextY = position.y + dy;

    if (map && !map.isWalkable(nextX, nextY)) {
      return false;
    }

    position.x = nextX;
    position.y = nextY;

    return true;
  }
}
