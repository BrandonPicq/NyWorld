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
import { CONTENT_TYPES } from "../../engine";

/** Save lifecycle state shared between the editor screen and its panels. */
export type SaveStatus =
  | { state: "idle"; message: string }
  | { state: "saving"; message: string }
  | { state: "saved"; message: string }
  | { state: "error"; message: string };

export interface ContentBrowserEntry {
  ref: ContentRef;
  label: string;
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
  return [
    {
      type: CONTENT_TYPES.game,
      label: "Game Config",
      entries: [entry(CONTENT_TYPES.game, "game")],
    },
    {
      type: CONTENT_TYPES.zone,
      label: "Zones",
      entries: sortedKeys(snapshot.zones).map((id) =>
        entry(CONTENT_TYPES.zone, id),
      ),
    },
    {
      type: CONTENT_TYPES.item,
      label: "Items",
      entries: sortedKeys(snapshot.items).map((id) =>
        entry(CONTENT_TYPES.item, id),
      ),
    },
    {
      type: CONTENT_TYPES.tile,
      label: "Tiles",
      entries: [...snapshot.tiles.keys()]
        .sort((a, b) => a - b)
        .map((id) => entry(CONTENT_TYPES.tile, String(id))),
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
        .map((npc) => npc.npcId)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => entry(CONTENT_TYPES.npc, id)),
    },
    {
      type: CONTENT_TYPES.npcPresence,
      label: "NPC Presence",
      entries: snapshot.npcPresence
        .map((presence) => presence.npcId)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => entry(CONTENT_TYPES.npcPresence, id)),
    },
    {
      type: CONTENT_TYPES.enemy,
      label: "Enemies",
      entries: snapshot.enemies
        .map((enemy) => enemy.npcId)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => entry(CONTENT_TYPES.enemy, id)),
    },
    {
      type: CONTENT_TYPES.quest,
      label: "Quests",
      entries: snapshot.quests
        .map((quest) => quest.questId)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => entry(CONTENT_TYPES.quest, id)),
    },
    {
      type: CONTENT_TYPES.combatAction,
      label: "Combat Actions",
      entries: snapshot.combatActions
        .map((action) => action.actionId)
        .sort((a, b) => a.localeCompare(b))
        .map((id) => entry(CONTENT_TYPES.combatAction, id)),
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

function entry(type: ContentTypeName, id: string): ContentBrowserEntry {
  return {
    ref: { type, id },
    label: id,
  };
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
  };
}
