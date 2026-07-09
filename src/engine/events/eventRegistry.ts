import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { defaultContentBundle, resolveAllZonesFromBundle } from "../content/contentBundle";
import { getAllDialogueIds } from "../dialogues/dialogueRegistry";
import { getAllEnemyDefs } from "../enemies/enemyRegistry";
import { getAllItemIds } from "../items/itemRegistry";
import { getAllNpcDefs } from "../npcs/npcRegistry";
import { getAllQuestDefs } from "../quests/questRegistry";
import type { EventDef, EventDefMap } from "./EventDef";
import { buildEventRegistry, cloneEventDef, validateEventDef, validateEventRegistry, type EventValidationContext } from "./eventValidation";

const eventDefs = getSortedContentModules(import.meta.glob<unknown>("../../content/events/*.json", { eager: true, import: "default" }));
const registry = buildRegistry(eventDefs, createEventRuntimeContext());

export function hasEventDef(eventId: string): boolean { return Object.prototype.hasOwnProperty.call(registry, eventId); }
export function getEventDef(eventId: string): EventDef | undefined { const def = getActiveRegistry()[eventId]; return def ? cloneEventDef(def) : undefined; }
export function getAllEventDefs(): EventDef[] { return Object.values(getActiveRegistry()).map(cloneEventDef); }

export function validateEventDefForContext(value: unknown, context: EventValidationContext): ContentDiagnostic[] { return validateEventDef(value, context); }
export { validateEventDef };
export { validateEventRegistry };

function createEventRuntimeContext(): EventValidationContext {
  return {
    itemIds: new Set(getAllItemIds()),
    npcIds: new Set(getAllNpcDefs().map((npc) => npc.npcId)),
    dialogueIds: new Set(getAllDialogueIds()),
    enemyIds: new Set(getAllEnemyDefs().map((enemy) => enemy.npcId)),
    questIds: new Set(getAllQuestDefs().map((quest) => quest.questId)),
    zones: resolveAllZonesFromBundle(defaultContentBundle),
  };
}

function buildRegistry(defs: readonly unknown[], context: EventValidationContext): EventDefMap {
  return buildEventRegistry(defs, context);
}

function getActiveRegistry(): EventDefMap { return registry; }

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules).sort(([a], [b]) => a.localeCompare(b)).map(([, module]) => module);
}
