import { GameMap } from "../GameMap";

export type CellVisibility = "hidden" | "explored" | "visible";

export interface ExplorationRuntimeState {
  exploredCellsByZone: Record<string, string[]>;
}

type GridPosition = { x: number; y: number };

/**
 * Persistent map knowledge for one playthrough.
 *
 * The state knows which cells have been discovered; it derives a visibility
 * projection for the active map but never renders. A one-tile Chebyshev radius
 * gives the requested 3x3 local view without adding line-of-sight rules yet.
 */
export class ExplorationState {
  private readonly exploredByZone = new Map<string, Set<string>>();

  constructor(saved?: Partial<ExplorationRuntimeState>) {
    this.restore(saved);
  }

  discoverAround(map: GameMap, position: GridPosition): void {
    if (!map.fogOfWar) return;
    const explored = this.getZoneCells(map.zoneId);
    for (let y = position.y - 1; y <= position.y + 1; y += 1) {
      for (let x = position.x - 1; x <= position.x + 1; x += 1) {
        if (map.isInBounds(x, y)) explored.add(cellKey(x, y));
      }
    }
  }

  revealArea(map: GameMap, x: number, y: number, width: number, height: number): boolean {
    if (
      !Number.isInteger(x) || !Number.isInteger(y) ||
      !Number.isInteger(width) || !Number.isInteger(height) ||
      width <= 0 || height <= 0 ||
      !map.isInBounds(x, y) || !map.isInBounds(x + width - 1, y + height - 1)
    ) {
      return false;
    }
    const explored = this.getZoneCells(map.zoneId);
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        explored.add(cellKey(column, row));
      }
    }
    return true;
  }

  getVisibility(map: GameMap, position: GridPosition): CellVisibility[][] {
    if (!map.fogOfWar) {
      return Array.from({ length: map.height }, () =>
        Array.from({ length: map.width }, () => "visible" as const),
      );
    }
    const explored = this.getZoneCells(map.zoneId);
    return Array.from({ length: map.height }, (_, y) =>
      Array.from({ length: map.width }, (_, x) => {
        if (Math.abs(position.x - x) <= 1 && Math.abs(position.y - y) <= 1) {
          return "visible";
        }
        return explored.has(cellKey(x, y)) ? "explored" : "hidden";
      }),
    );
  }

  getState(): ExplorationRuntimeState {
    return {
      exploredCellsByZone: Object.fromEntries(
        [...this.exploredByZone.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([zoneId, cells]) => [zoneId, [...cells].sort()]),
      ),
    };
  }

  restore(saved?: Partial<ExplorationRuntimeState>): void {
    this.exploredByZone.clear();
    for (const [zoneId, cells] of Object.entries(saved?.exploredCellsByZone ?? {})) {
      this.exploredByZone.set(zoneId, new Set(cells));
    }
  }

  private getZoneCells(zoneId: string): Set<string> {
    let cells = this.exploredByZone.get(zoneId);
    if (!cells) {
      cells = new Set<string>();
      this.exploredByZone.set(zoneId, cells);
    }
    return cells;
  }
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
