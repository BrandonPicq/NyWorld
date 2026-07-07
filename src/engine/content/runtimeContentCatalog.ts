import { getAllCombatActionDefs } from "../combat/combatActionRegistry";
import { getAllClassDefs } from "../classes/classRegistry";
import {
  getAllDialogueIds,
  getDialogue,
  getDialogueFiles,
} from "../dialogues/dialogueRegistry";
import { getAllEnemyDefs } from "../enemies/enemyRegistry";
import { getAllItemIds, getItemDef } from "../items/itemRegistry";
import { getAllNpcDefs } from "../npcs/npcRegistry";
import { getAllNpcPresenceDefs } from "../npcs/npcPresenceRegistry";
import { getAllQuestDefs } from "../quests/questRegistry";
import { getAllRaceDefs } from "../races/raceRegistry";
import { getAllTileDefs } from "../TileRegistry";
import type { ContentBundle } from "./contentBundle";
import {
  defaultContentBundle,
  getGameConfig,
  getZoneData,
} from "./contentBundle";
import type { ContentCatalogSnapshot } from "./ContentReferenceGraph";

/**
 * Builds a plain-data catalog snapshot from the shipped runtime content.
 *
 * Like runtimeValidationContext.ts, this module sits at the top of the content
 * dependency graph: no registry may import it. Editor drafts and mod bundles
 * should assemble their own ContentCatalogSnapshot instead.
 */
export function createRuntimeContentCatalogSnapshot(
  bundle: ContentBundle = defaultContentBundle,
): ContentCatalogSnapshot {
  return {
    game: getGameConfig(bundle),
    zones: Object.fromEntries(
      Object.keys(bundle.zones).map((zoneId) => [
        zoneId,
        getZoneData(bundle, zoneId)!,
      ]),
    ),
    items: Object.fromEntries(
      getAllItemIds().map((itemId) => [itemId, getItemDef(itemId)]),
    ),
    npcs: getAllNpcDefs(),
    npcPresence: getAllNpcPresenceDefs(),
    enemies: getAllEnemyDefs(),
    quests: getAllQuestDefs(),
    combatActions: getAllCombatActionDefs(),
    classes: getAllClassDefs(),
    races: getAllRaceDefs(),
    dialogues: Object.fromEntries(
      getAllDialogueIds().map((dialogueId) => [
        dialogueId,
        getDialogue(dialogueId),
      ]),
    ),
    dialogueFiles: getDialogueFiles(),
    tiles: getAllTileDefs(),
  };
}
