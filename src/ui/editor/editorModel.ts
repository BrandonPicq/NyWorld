import type {
  ContentCatalogSnapshot,
  ContentDiagnostic,
  ContentRef,
  ContentTypeName,
} from "../../engine";
import { CONTENT_TYPES } from "../../engine";

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
