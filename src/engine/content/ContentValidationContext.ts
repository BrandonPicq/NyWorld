import type { GameMap } from "../GameMap";
import type { TileDef } from "../TileRegistry";
import type { TileId } from "../ZoneTypes";

/**
 * Explicit catalogs that content validators check references against.
 *
 * This module is deliberately type-only: validators receive the subset of
 * catalogs they need (usually via Pick), so editor drafts and mod bundles can
 * build their own context from in-memory data instead of runtime registries.
 * The runtime builder lives in runtimeValidationContext.ts, which registries
 * must never import.
 */
export interface ContentValidationContext {
  itemIds: ReadonlySet<string>;
  npcIds: ReadonlySet<string>;
  dialogueIds: ReadonlySet<string>;
  enemyIds: ReadonlySet<string>;
  questIds: ReadonlySet<string>;
  combatActionIds: ReadonlySet<string>;
  classIds: ReadonlySet<string>;
  raceIds: ReadonlySet<string>;
  commandMasteryIds?: ReadonlySet<string>;
  qtePatternIds?: ReadonlySet<string>;
  /** Tile catalog as a map because zone checks need walkability, not just existence. */
  tileDefs: ReadonlyMap<TileId, TileDef>;
  zones: ReadonlyMap<string, GameMap>;
}
