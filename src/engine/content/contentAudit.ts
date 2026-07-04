import { validateCombatActionRegistry } from "../combat/combatActionRegistry";
import { validateDialogueRegistry } from "../dialogues/dialogueRegistry";
import { validateEnemyRegistry } from "../enemies/enemyRegistry";
import { validateItemCatalog } from "../items/itemRegistry";
import { validateNpcRegistry } from "../npcs/npcRegistry";
import { validateNpcPresenceRegistry } from "../npcs/npcPresenceRegistry";
import { validateQuestRegistry } from "../quests/questRegistry";
import { validateTileCatalog } from "../TileRegistry";
import { validateZoneData } from "../zoneLoader";
import { validateGameConfig } from "./contentBundle";
import type { ContentDiagnostic } from "./ContentDiagnostic";
import {
  buildContentReferenceGraph,
  type ContentCatalogSnapshot,
} from "./ContentReferenceGraph";
import type { ContentValidationContext } from "./ContentValidationContext";

/**
 * Runs every content validator plus full-context-only cross checks over one
 * catalog snapshot.
 *
 * This is the whole-bundle audit a future editor problems panel sits on: it
 * accumulates diagnostics for every content family and reports dangling id
 * references that per-registry validation cannot see (such as presence
 * schedules pointing at unknown zones).
 */
export function validateAllContent(
  snapshot: ContentCatalogSnapshot,
  context: ContentValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [
    ...validateGameConfig(snapshot.game, context),
    ...Object.values(snapshot.zones).flatMap((zone) =>
      validateZoneData(zone, context),
    ),
    ...validateItemCatalog(snapshot.items),
    ...validateTileCatalog(
      Object.fromEntries(
        [...snapshot.tiles].map(([tileId, def]) => [String(tileId), def]),
      ),
    ),
    ...validateDialogueRegistry([snapshot.dialogues]),
    ...validateNpcRegistry(snapshot.npcs, context),
    ...validateNpcPresenceRegistry(snapshot.npcPresence, context),
    ...validateEnemyRegistry(snapshot.enemies, context),
    ...validateQuestRegistry(snapshot.quests, context),
    ...validateCombatActionRegistry(snapshot.combatActions),
  ];

  const graph = buildContentReferenceGraph(snapshot);
  for (const dangling of graph.getDanglingReferences(context)) {
    diagnostics.push({
      severity: "error",
      contentType: dangling.from.type,
      contentId: dangling.from.id,
      path: dangling.path,
      message: `${dangling.from.type} "${dangling.from.id}" references unknown ${dangling.to.type} "${dangling.to.id}".`,
    });
  }

  return diagnostics;
}

/**
 * Convenience filter for tools that only need blocking problems.
 */
export function getContentAuditErrors(
  diagnostics: readonly ContentDiagnostic[],
): ContentDiagnostic[] {
  return diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
}
