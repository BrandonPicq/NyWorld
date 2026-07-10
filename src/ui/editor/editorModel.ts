import type {
  ContentCatalogSnapshot,
  ContentDiagnostic,
  ContentRef,
  ContentTypeName,
  ContentValidationContext,
  GameContentConfig,
  ItemDef,
  ItemDefMap,
  NewGameStartingStack,
} from "../../engine";
import { CONTENT_TYPES, validateAllContent } from "../../engine";

/** Save lifecycle state shared between the editor screen and its panels. */
export type SaveStatus =
  | { state: "idle"; message: string }
  | { state: "saving"; message: string }
  | { state: "saved"; message: string }
  | { state: "error"; message: string };

export interface FileSaveGate {
  errorCount: number;
  canSave: boolean;
}

/**
 * Computes save eligibility for the one content file behind a Save button.
 *
 * Whole-bundle diagnostics are deliberately not involved here: unrelated
 * drafts must not make a valid file impossible to save. Playtest validation
 * remains responsible for the full-bundle gate.
 */
export function getFileSaveGate(
  diagnostics: readonly ContentDiagnostic[],
  options: { hasUnsavedChanges: boolean; isSaving: boolean },
): FileSaveGate {
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;

  return {
    errorCount,
    canSave: options.hasUnsavedChanges && errorCount === 0 && !options.isSaving,
  };
}

export function formatFileSaveBlocker(errorCount: number): string {
  return errorCount === 1
    ? "1 error in this file blocks saving."
    : `${errorCount} errors in this file block saving.`;
}

export function getFileSaveStatus(
  status: SaveStatus,
  options: { hasUnsavedChanges: boolean; errorCount: number },
): SaveStatus {
  if (status.state !== "idle") {
    return status;
  }
  if (!options.hasUnsavedChanges) {
    return { state: "idle", message: "No changes." };
  }
  if (options.errorCount > 0) {
    return {
      state: "error",
      message: formatFileSaveBlocker(options.errorCount),
    };
  }
  return { state: "idle", message: "Unsaved changes." };
}

export interface ContentBrowserEntry {
  ref: ContentRef;
  label: string;
  searchName?: string;
}

export interface ContentBrowserGroup {
  type: ContentTypeName;
  label: string;
  entries: ContentBrowserEntry[];
}

export interface DiagnosticGroup {
  contentType: string;
  diagnostics: ContentDiagnostic[];
  errorCount: number;
  warningCount: number;
}

export function buildContentBrowserGroups(
  snapshot: ContentCatalogSnapshot,
): ContentBrowserGroup[] {
  const npcNamesById = new Map(
    snapshot.npcs.map((npc) => [npc.npcId, npc.name]),
  );

  return [
    {
      type: CONTENT_TYPES.game,
      label: "Game Config",
      entries: [entry(CONTENT_TYPES.game, "game")],
    },
    {
      type: CONTENT_TYPES.zone,
      label: "Zones",
      entries: sortedKeys(snapshot.zones).map((id) => {
        const zone = snapshot.zones[id];
        return entry(CONTENT_TYPES.zone, id, zone?.name);
      }),
    },
    {
      type: CONTENT_TYPES.item,
      label: "Items",
      entries: sortedKeys(snapshot.items).map((id) => {
        const item = snapshot.items[id];
        return entry(CONTENT_TYPES.item, id, item?.name);
      }),
    },
    {
      type: CONTENT_TYPES.class,
      label: "Classes",
      entries: snapshot.classes
        .map((classDef) => ({ id: classDef.classId, name: classDef.name }))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((classDef) => entry(CONTENT_TYPES.class, classDef.id, classDef.name)),
    },
    {
      type: CONTENT_TYPES.race,
      label: "Races",
      entries: snapshot.races
        .map((race) => ({ id: race.raceId, name: race.name }))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((race) => entry(CONTENT_TYPES.race, race.id, race.name)),
    },
    {
      type: CONTENT_TYPES.tile,
      label: "Tiles",
      entries: [...snapshot.tiles.keys()]
        .sort((a, b) => a - b)
        .map((id) =>
          entry(CONTENT_TYPES.tile, String(id), snapshot.tiles.get(id)?.name),
        ),
    },
    {
      type: CONTENT_TYPES.dialogue,
      label: "Dialogues",
      entries: sortedKeys(snapshot.dialogues).map((id) =>
        entry(CONTENT_TYPES.dialogue, id),
      ),
    },
    {
      type: CONTENT_TYPES.npc,
      label: "NPCs",
      entries: snapshot.npcs
        .map((npc) => ({ id: npc.npcId, name: npc.name }))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((npc) => entry(CONTENT_TYPES.npc, npc.id, npc.name)),
    },
    {
      type: CONTENT_TYPES.npcPresence,
      label: "NPC Presence",
      entries: snapshot.npcPresence
        .map((presence) => presence.npcId)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => entry(CONTENT_TYPES.npcPresence, id, npcNamesById.get(id))),
    },
    {
      type: CONTENT_TYPES.enemy,
      label: "Enemies",
      entries: snapshot.enemies
        .map((enemy) => enemy.npcId)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => entry(CONTENT_TYPES.enemy, id, npcNamesById.get(id))),
    },
    {
      type: CONTENT_TYPES.quest,
      label: "Quests",
      entries: snapshot.quests
        .map((quest) => ({ id: quest.questId, name: quest.name }))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((quest) => entry(CONTENT_TYPES.quest, quest.id, quest.name)),
    },
    {
      type: CONTENT_TYPES.combatAction,
      label: "Combat Actions",
      entries: snapshot.combatActions
        .map((action) => ({ id: action.actionId, name: action.name }))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((action) =>
          entry(CONTENT_TYPES.combatAction, action.id, action.name),
        ),
    },
  ];
}

export function groupDiagnosticsByContentType(
  diagnostics: readonly ContentDiagnostic[],
): DiagnosticGroup[] {
  const groups = new Map<string, ContentDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    const group = groups.get(diagnostic.contentType) ?? [];
    group.push(diagnostic);
    groups.set(diagnostic.contentType, group);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([contentType, groupDiagnostics]) => ({
      contentType,
      diagnostics: [...groupDiagnostics].sort(compareDiagnostics),
      errorCount: groupDiagnostics.filter(
        (diagnostic) => diagnostic.severity === "error",
      ).length,
      warningCount: groupDiagnostics.filter(
        (diagnostic) => diagnostic.severity === "warning",
      ).length,
    }));
}

/**
 * Re-runs the whole-bundle audit synchronously and reports whether it blocks a
 * save.
 *
 * Draft hooks defer whole-bundle validation off the typing path with
 * `useDeferredValue`, so a memoized `errorCount` can lag one render behind the
 * live draft. Every save calls this on the LIVE draft snapshot and context
 * before writing, closing that staleness window without trusting the deferred
 * count.
 */
export function draftHasBlockingErrors(
  snapshot: ContentCatalogSnapshot,
  context: ContentValidationContext,
): boolean {
  return validateAllContent(snapshot, context).some(
    (diagnostic) => diagnostic.severity === "error",
  );
}

/** True when at least one editor content family has unsaved draft changes. */
export function hasAnyUnsavedEditorChanges(
  changes: object,
): boolean {
  return Object.values(changes).some((value) => value === true);
}

export function refsEqual(a: ContentRef, b: ContentRef): boolean {
  return a.type === b.type && a.id === b.id;
}

export function formatContentRef(ref: ContentRef): string {
  return `${ref.type}:${ref.id}`;
}

export function cloneItemCatalog(items: ItemDefMap): ItemDefMap {
  return Object.fromEntries(
    Object.entries(items).map(([itemId, item]) => [itemId, cloneItem(item)]),
  );
}

export function createItemDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftItems: ItemDefMap,
): ContentCatalogSnapshot {
  return {
    ...snapshot,
    items: cloneItemCatalog(draftItems),
  };
}

export function createItemDraftValidationContext(
  context: ContentValidationContext,
  draftItems: ItemDefMap,
): ContentValidationContext {
  return {
    ...context,
    itemIds: new Set(Object.keys(draftItems)),
  };
}

export function serializeItemCatalog(items: ItemDefMap): string {
  return JSON.stringify(items, null, 2);
}

const STARTING_INVENTORY_PLACEHOLDER = "__NYWARUDO_STARTING_INVENTORY__";

/**
 * Serializes game config as 2-space JSON, keeping each `startingInventory`
 * stack on one line.
 *
 * Mirrors the zone serializer: everything is standard 2-space JSON except the
 * inline inventory stacks, so a defaultZoneId/safeRespawn edit produces a
 * minimal, reviewable diff instead of reformatting the whole file.
 */
export function serializeGameConfig(config: GameContentConfig): string {
  const newGame: Record<string, unknown> = {
    ...config.newGame,
    startingInventory: STARTING_INVENTORY_PLACEHOLDER,
  };
  const withPlaceholder: Record<string, unknown> = { ...config, newGame };
  const json = JSON.stringify(withPlaceholder, null, 2);
  return json.replace(
    `"${STARTING_INVENTORY_PLACEHOLDER}"`,
    formatStartingInventory(config.newGame.startingInventory),
  );
}

function formatStartingInventory(
  stacks: readonly NewGameStartingStack[],
): string {
  if (stacks.length === 0) {
    return "[]";
  }
  const rows = stacks
    .map(
      (stack) =>
        `      { "itemId": ${JSON.stringify(stack.itemId)}, "quantity": ${JSON.stringify(stack.quantity)} }`,
    )
    .join(",\n");
  return `[\n${rows}\n    ]`;
}

function entry(
  type: ContentTypeName,
  id: string,
  searchName?: string,
): ContentBrowserEntry {
  const browserEntry: ContentBrowserEntry = {
    ref: { type, id },
    label: id,
  };
  if (searchName) {
    browserEntry.searchName = searchName;
  }

  return browserEntry;
}

function sortedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort((a, b) => a.localeCompare(b));
}

function compareDiagnostics(
  a: ContentDiagnostic,
  b: ContentDiagnostic,
): number {
  if (a.severity !== b.severity) {
    return a.severity === "error" ? -1 : 1;
  }

  return `${a.contentId ?? ""}.${a.path}.${a.message}`.localeCompare(
    `${b.contentId ?? ""}.${b.path}.${b.message}`,
  );
}

function cloneItem(item: ItemDef): ItemDef {
  return {
    ...item,
    effects: item.effects ? { ...item.effects } : undefined,
    equipment: item.equipment
      ? {
          ...item.equipment,
          bonuses: { ...item.equipment.bonuses },
        }
      : undefined,
  };
}
