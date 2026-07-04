import { getAllDialogueIds } from "../dialogues/dialogueRegistry";
import type { GameMap } from "../GameMap";
import { getAllItemIds } from "../items/itemRegistry";
import { getAllNpcDefs } from "../npcs/npcRegistry";
import type { ContentBundle } from "./contentBundle";
import { resolveZoneFromBundle } from "./contentBundle";

export interface ContentValidationContext {
  itemIds: ReadonlySet<string>;
  npcIds: ReadonlySet<string>;
  dialogueIds: ReadonlySet<string>;
  zones: ReadonlyMap<string, GameMap>;
}

/**
 * Builds the validation context used by the shipped runtime content.
 *
 * Editor drafts and mod bundles should eventually build the same shape from
 * their own in-memory catalogs instead of reading runtime registries directly.
 */
export function createRuntimeContentValidationContext(
  bundle: ContentBundle,
): ContentValidationContext {
  return {
    itemIds: new Set(getAllItemIds()),
    npcIds: new Set(getAllNpcDefs().map((npc) => npc.npcId)),
    dialogueIds: new Set(getAllDialogueIds()),
    zones: buildZoneMap(bundle),
  };
}

function buildZoneMap(bundle: ContentBundle): ReadonlyMap<string, GameMap> {
  const zones = new Map<string, GameMap>();

  for (const zoneId of Object.keys(bundle.zones)) {
    const zone = resolveZoneFromBundle(bundle, zoneId);
    if (!zone) {
      throw new Error(`Zone definition "${zoneId}" is not available.`);
    }
    zones.set(zone.zoneId, zone);
  }

  return zones;
}
