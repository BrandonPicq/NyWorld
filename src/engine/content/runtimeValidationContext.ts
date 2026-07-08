import { getAllCombatActionDefs } from "../combat/combatActionRegistry";
import { getAllQtePatternIds } from "../combat/qtePatternRegistry";
import { getAllClassIds } from "../classes/classRegistry";
import { getAllDialogueIds } from "../dialogues/dialogueRegistry";
import { getAllEnemyDefs } from "../enemies/enemyRegistry";
import { getAllItemIds } from "../items/itemRegistry";
import { getAllNpcDefs } from "../npcs/npcRegistry";
import { getAllQuestDefs } from "../quests/questRegistry";
import { getAllRaceIds } from "../races/raceRegistry";
import { getAllTileDefs } from "../TileRegistry";
import { getAllCommandMasteryDefs } from "../mastery/commandMasteryRegistry";
import type { ContentBundle } from "./contentBundle";
import {
  defaultContentBundle,
  resolveAllZonesFromBundle,
} from "./contentBundle";
import type { ContentValidationContext } from "./ContentValidationContext";

/**
 * Builds the full validation context from the shipped runtime content.
 *
 * This module sits at the top of the content dependency graph: it imports
 * every registry, so no registry (or loader used by one) may import it back.
 * Registries that need a context at module load build their own subset from
 * their direct upstream imports instead.
 *
 * Editor drafts and mod bundles should build the same ContentValidationContext
 * shape from their own catalogs rather than calling this function.
 */
export function createRuntimeContentValidationContext(
  bundle: ContentBundle = defaultContentBundle,
): ContentValidationContext {
  return {
    itemIds: new Set(getAllItemIds()),
    npcIds: new Set(getAllNpcDefs().map((npc) => npc.npcId)),
    dialogueIds: new Set(getAllDialogueIds()),
    enemyIds: new Set(getAllEnemyDefs().map((enemy) => enemy.npcId)),
    questIds: new Set(getAllQuestDefs().map((quest) => quest.questId)),
    combatActionIds: new Set(
      getAllCombatActionDefs().map((action) => action.actionId),
    ),
    classIds: new Set(getAllClassIds()),
    raceIds: new Set(getAllRaceIds()),
    commandMasteryIds: new Set(
      getAllCommandMasteryDefs().map((cmd) => cmd.commandId),
    ),
    qtePatternIds: new Set(getAllQtePatternIds()),
    tileDefs: getAllTileDefs(),
    zones: resolveAllZonesFromBundle(bundle),
  };
}
