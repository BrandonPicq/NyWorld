import { validateCombatActionRegistry } from "../combat/combatActionRegistry";
import { validateClassRegistry } from "../classes/classRegistry";
import { validateDialogueRegistry } from "../dialogues/dialogueRegistry";
import { validateEnemyRegistry } from "../enemies/enemyRegistry";
import { validateItemCatalog } from "../items/itemRegistry";
import { validateNpcRegistry } from "../npcs/npcRegistry";
import { validateNpcPresenceRegistry } from "../npcs/npcPresenceRegistry";
import { validateQuestRegistry } from "../quests/questRegistry";
import { validateRaceRegistry } from "../races/raceRegistry";
import { validateTileCatalog } from "../TileRegistry";
import { validateCommandMasteryRegistry } from "../mastery/commandMasteryRegistry";
import type { NpcScheduleEntryData, ZoneData } from "../ZoneTypes";
import { validateZoneData } from "../zoneLoader";
import { validateGameConfig } from "./contentBundle";
import type { ContentDiagnostic } from "./ContentDiagnostic";
import {
  buildContentReferenceGraph,
  type ContentCatalogSnapshot,
} from "./ContentReferenceGraph";
import type { ContentValidationContext } from "./ContentValidationContext";
import { CONTENT_TYPES, type ContentTypeName } from "./contentTypes";

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
    ...validateDialogueRegistry(Object.values(snapshot.dialogueFiles)),
    ...validateNpcRegistry(snapshot.npcs, context),
    ...validateNpcPresenceRegistry(snapshot.npcPresence, context),
    ...validateEnemyRegistry(snapshot.enemies, context),
    ...validateQuestRegistry(snapshot.quests, context),
    ...validateCombatActionRegistry(snapshot.combatActions),
    ...validateClassRegistry(snapshot.classes),
    ...validateRaceRegistry(snapshot.races),
    ...validateCommandMasteryRegistry(snapshot.commandMasteries ?? []),
    ...validateKnownScheduleTargetPositions(snapshot, context),
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

function validateKnownScheduleTargetPositions(
  snapshot: ContentCatalogSnapshot,
  context: ContentValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  for (const presence of snapshot.npcPresence) {
    presence.schedule.forEach((entry, entryIndex) => {
      validateScheduleTargetPosition({
        diagnostics,
        context,
        entry,
        path: `schedule[${entryIndex}]`,
        contentType: CONTENT_TYPES.npcPresence,
        contentId: presence.npcId,
      });
    });
  }

  for (const zone of Object.values(snapshot.zones)) {
    zone.npcs?.forEach((npc, npcIndex) => {
      npc.schedule?.forEach((entry, entryIndex) => {
        if (entry.zoneId === undefined || entry.zoneId === zone.zoneId) {
          return;
        }

        validateScheduleTargetPosition({
          diagnostics,
          context,
          entry,
          path: `npcs[${npcIndex}].schedule[${entryIndex}]`,
          contentType: CONTENT_TYPES.zone,
          contentId: zone.zoneId,
        });
      });
    });
  }

  return diagnostics;
}

function validateScheduleTargetPosition(input: {
  diagnostics: ContentDiagnostic[];
  context: ContentValidationContext;
  entry: NpcScheduleEntryData;
  path: string;
  contentType: ContentTypeName;
  contentId: string;
}): void {
  const { diagnostics, context, entry, path, contentType, contentId } = input;

  if (typeof entry.zoneId !== "string" || !entry.zoneId.trim()) {
    return;
  }

  const targetZone = context.zones.get(entry.zoneId);
  if (!targetZone || !hasIntegerCoordinates(entry)) {
    return;
  }

  if (!targetZone.isInBounds(entry.x, entry.y)) {
    addScheduleTargetError(
      diagnostics,
      contentType,
      contentId,
      path,
      `Schedule entry targets zone "${targetZone.zoneId}" outside its bounds.`,
    );
    return;
  }

  if (!targetZone.isWalkable(entry.x, entry.y)) {
    addScheduleTargetError(
      diagnostics,
      contentType,
      contentId,
      path,
      `Schedule entry targets a non-walkable tile in zone "${targetZone.zoneId}".`,
    );
  }
}

function hasIntegerCoordinates(
  entry: NpcScheduleEntryData,
): entry is NpcScheduleEntryData & Pick<ZoneData["playerStart"], "x" | "y"> {
  return (
    typeof entry.x === "number" &&
    Number.isInteger(entry.x) &&
    typeof entry.y === "number" &&
    Number.isInteger(entry.y)
  );
}

function addScheduleTargetError(
  diagnostics: ContentDiagnostic[],
  contentType: ContentTypeName,
  contentId: string,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType,
    contentId,
    path,
    message,
  });
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
