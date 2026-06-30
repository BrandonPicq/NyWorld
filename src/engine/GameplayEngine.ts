import type { GameCommand } from "./commands";
import type { Position, Stats } from "./components";
import { World } from "./ecs/World";
import { GameMap } from "./GameMap";
import { DIRECTION_DELTA, MovementSystem } from "./systems/MovementSystem";
import type { Direction } from "./systems/MovementSystem";
import { TickCounter } from "./tick";
import type { ZoneTransitionData } from "./ZoneTypes";

export interface LogEntry {
  tick: number;
  message: string;
}

export interface GameSnapshot {
  tick: number;
  zoneId: string;
  zoneName: string;
  mapWidth: number;
  mapHeight: number;
  playerX: number;
  playerY: number;
  tiles: number[][];
  log: LogEntry[];
  stats: Stats;
}

const COMMAND_DIRECTION: Record<string, Direction> = {
  MoveNorth: "north",
  MoveSouth: "south",
  MoveWest: "west",
  MoveEast: "east",
};

type ZoneResolver = (zoneId: string) => GameMap | undefined;

type GameplayEngineOptions = {
  resolveZone?: ZoneResolver;
};

export class GameplayEngine {
  readonly world = new World();
  readonly tickCounter = new TickCounter();
  map: GameMap;

  private log: LogEntry[] = [];
  private resolveZone?: ZoneResolver;

  constructor(map: GameMap, options: GameplayEngineOptions = {}) {
    this.map = map;
    this.resolveZone = options.resolveZone;

    const playerId = this.world.createEntity();

    const position = {
      type: "Position" as const,
      x: map.playerStart.x,
      y: map.playerStart.y,
    };
    this.world.addComponent(playerId, position);

    const playerControlled = { type: "PlayerControlled" as const };
    this.world.addComponent(playerId, playerControlled);

    const renderable = {
      type: "Renderable" as const,
      glyph: "@",
      color: "#ffcc00",
    };
    this.world.addComponent(playerId, renderable);

    const stats = {
      type: "Stats" as const,
      energy: 100,
      maxEnergy: 100,
      currency: 1550,
      attributes: {
        strength: 10,
        intelligence: 10,
        charisma: 10,
      },
      academicTitle: "Novice Scribe",
      academicProgress: 0,
    };
    this.world.addComponent(playerId, stats);

    this.log.push({
      tick: this.tickCounter.tick,
      message: `Entered ${map.name}.`,
    });
  }

  execute(command: GameCommand): boolean {
    if (command.type === "Rest") {
      this.restPlayer();
      return true;
    }

    const direction = COMMAND_DIRECTION[command.type];

    if (!direction) {
      return false;
    }

    const stats = this.getPlayerStats();
    if (stats.energy <= 0) {
      this.log.push({
        tick: this.tickCounter.tick,
        message: "You are too exhausted to move! Rest [R] to recover energy.",
      });
      return false;
    }

    const positionBefore = this.getPlayerPosition();
    const moved = MovementSystem.move(this.world, direction, this.map);

    if (moved) {
      this.tickCounter.advance();
      stats.energy = Math.max(0, stats.energy - 1);
      const pos = this.getPlayerPosition();
      this.log.push({
        tick: this.tickCounter.tick,
        message: `Moved ${direction} to (${pos.x}, ${pos.y}).`,
      });
      this.resolvePendingTransition();
    } else {
      const pos = positionBefore;
      const target = this.getTargetPosition(pos, direction);
      this.log.push({
        tick: this.tickCounter.tick,
        message: `Cannot move ${direction} — blocked at (${target.x}, ${target.y}).`,
      });
    }

    return moved;
  }

  getPendingTransition(): ZoneTransitionData | undefined {
    const pos = this.getPlayerPosition();
    return this.map.getTransitionAt(pos.x, pos.y);
  }

  enterZone(map: GameMap, entryX: number, entryY: number): void {
    this.map = map;

    const pos = this.getPlayerPosition();
    pos.x = entryX;
    pos.y = entryY;

    this.log.push({
      tick: this.tickCounter.tick,
      message: `Entered ${map.name}.`,
    });
  }

  private resolvePendingTransition(): void {
    const transition = this.getPendingTransition();

    if (!transition || !this.resolveZone) {
      return;
    }

    const nextMap = this.resolveZone(transition.targetZoneId);

    if (!nextMap) {
      this.log.push({
        tick: this.tickCounter.tick,
        message: `Cannot enter missing zone ${transition.targetZoneId}.`,
      });
      return;
    }

    this.enterZone(nextMap, transition.targetX, transition.targetY);
  }

  private restPlayer(): void {
    const stats = this.getPlayerStats();
    stats.energy = Math.min(stats.maxEnergy, stats.energy + 15);
    this.tickCounter.advance();
    this.log.push({
      tick: this.tickCounter.tick,
      message: "Rested and recovered 15 energy.",
    });
  }

  getSnapshot(): GameSnapshot {
    const pos = this.getPlayerPosition();
    const stats = this.getPlayerStats();
    const tiles: number[][] = [];

    for (let y = 0; y < this.map.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.map.width; x++) {
        row.push(this.map.getTileId(x, y));
      }
      tiles.push(row);
    }

    return {
      tick: this.tickCounter.tick,
      zoneId: this.map.zoneId,
      zoneName: this.map.name,
      mapWidth: this.map.width,
      mapHeight: this.map.height,
      playerX: pos.x,
      playerY: pos.y,
      tiles,
      log: [...this.log],
      stats: {
        ...stats,
        attributes: { ...stats.attributes },
      },
    };
  }

  private getPlayerStats(): Stats {
    const [playerId] = this.world.entitiesWith("Stats", "PlayerControlled");
    return this.world.getComponent<Stats>(playerId, "Stats")!;
  }

  private getPlayerPosition(): Position {
    const [playerId] = this.world.entitiesWith("Position", "PlayerControlled");
    return (
      this.world.getComponent<Position>(playerId, "Position") ??
      ({ type: "Position", x: 0, y: 0 } as Position)
    );
  }

  private getTargetPosition(
    pos: Position,
    direction: Direction,
  ): { x: number; y: number } {
    const { dx, dy } = DIRECTION_DELTA[direction];

    return { x: pos.x + dx, y: pos.y + dy };
  }
}
