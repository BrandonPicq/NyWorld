import type {
  ContentCatalogSnapshot,
  ContentValidationContext,
  DialogueDefMap,
  DialogueNodeData,
  NpcDef,
} from "../../../engine";
import {
  cloneDialogueFiles,
  createDialogueDraftSnapshot,
  createDialogueDraftValidationContext,
  flattenDialogueFiles,
  serializeDialogueFile,
} from "../dialogues/dialogueEditorModel";

const NPC_ID_PATTERN = /^[a-z0-9_]+$/;

export interface EditorNpcEntry {
  npcId: string;
  name: string;
}

export function listNpcDefs(npcs: readonly NpcDef[]): EditorNpcEntry[] {
  return npcs
    .map((npc) => ({ npcId: npc.npcId, name: npc.name }))
    .sort((a, b) => a.npcId.localeCompare(b.npcId));
}

export function npcContentPath(npcId: string): string {
  return `src/content/npcs/${npcId}.json`;
}

export function dialogueContentPathForNpc(npcId: string): string {
  return `src/content/dialogues/${npcId}.json`;
}

export function cloneNpcDefs(npcs: readonly NpcDef[]): NpcDef[] {
  return npcs.map(cloneNpcDef);
}

export function createNpcDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftNpcs: readonly NpcDef[],
  draftDialogueFiles: Record<string, DialogueDefMap> = snapshot.dialogueFiles,
): ContentCatalogSnapshot {
  return {
    ...createDialogueDraftSnapshot(snapshot, draftDialogueFiles),
    npcs: cloneNpcDefs(draftNpcs),
  };
}

export function createNpcDraftValidationContext(
  context: ContentValidationContext,
  snapshot: ContentCatalogSnapshot,
  draftNpcs: readonly NpcDef[],
  draftDialogueFiles: Record<string, DialogueDefMap> = snapshot.dialogueFiles,
): ContentValidationContext {
  return {
    ...createDialogueDraftValidationContext(
      context,
      snapshot,
      draftDialogueFiles,
    ),
    npcIds: new Set(draftNpcs.map((npc) => npc.npcId)),
  };
}

export function serializeNpcDef(npc: NpcDef): string {
  return JSON.stringify(npc, null, 2);
}

export function serializeNpcDefsById(
  npcs: readonly NpcDef[],
): Map<string, string> {
  return new Map(npcs.map((npc) => [npc.npcId, serializeNpcDef(npc)]));
}

export function validateNewNpcId(
  npcIdDraft: string,
  npcs: readonly NpcDef[],
): string[] {
  const errors: string[] = [];
  const npcId = npcIdDraft.trim();

  if (!npcId) {
    errors.push("NPC id is required.");
  } else if (!NPC_ID_PATTERN.test(npcId)) {
    errors.push("NPC id must be lowercase letters, digits, or underscores.");
  } else if (npcs.some((npc) => npc.npcId === npcId)) {
    errors.push(`NPC "${npcId}" already exists.`);
  }

  return errors;
}

export function validateNewNpcName(nameDraft: string): string[] {
  return nameDraft.trim() ? [] : ["NPC name is required."];
}

export function createNpcDef(input: {
  npcId: string;
  name: string;
  defaultDialogueId: string;
}): NpcDef {
  return {
    npcId: input.npcId.trim(),
    name: input.name.trim(),
    race: "human",
    importance: "common",
    defaultDialogueId: input.defaultDialogueId.trim(),
  };
}

export function upsertNpcDef(
  npcs: readonly NpcDef[],
  npc: NpcDef,
): NpcDef[] {
  const exists = npcs.some((entry) => entry.npcId === npc.npcId);
  const next = exists
    ? npcs.map((entry) =>
        entry.npcId === npc.npcId ? cloneNpcDef(npc) : cloneNpcDef(entry),
      )
    : [...npcs, cloneNpcDef(npc)];

  return next.sort((a, b) => a.npcId.localeCompare(b.npcId));
}

export function updateNpcDef(
  npcs: readonly NpcDef[],
  npcId: string,
  updater: (npc: NpcDef) => NpcDef,
): NpcDef[] {
  return npcs.map((npc) =>
    npc.npcId === npcId
      ? cloneNpcDef(updater(cloneNpcDef(npc)))
      : cloneNpcDef(npc),
  );
}

export function removeNpcDef(
  npcs: readonly NpcDef[],
  npcId: string,
): NpcDef[] {
  return npcs
    .filter((npc) => npc.npcId !== npcId)
    .map((npc) => cloneNpcDef(npc));
}

export function createDefaultDialogueId(npcId: string): string {
  return `${npcId.trim()}.default`;
}

export function addDefaultDialogueForNpc(
  files: Record<string, DialogueDefMap>,
  npc: NpcDef,
): Record<string, DialogueDefMap> {
  const dialogueId = createDefaultDialogueId(npc.npcId);
  if (flattenDialogueFiles(files)[dialogueId]) {
    return cloneDialogueFiles(files);
  }

  const nextFiles = cloneDialogueFiles(files);
  nextFiles[npc.npcId] = {
    ...(nextFiles[npc.npcId] ?? {}),
    [dialogueId]: createDefaultDialogueNodes(npc),
  };
  return nextFiles;
}

export function hasDialogueId(
  snapshot: ContentCatalogSnapshot,
  files: Record<string, DialogueDefMap>,
  dialogueId: string,
): boolean {
  return Boolean(
    createDialogueDraftSnapshot(snapshot, files).dialogues[dialogueId],
  );
}

export function serializeDefaultDialogueFileForNpc(
  files: Record<string, DialogueDefMap>,
  npcId: string,
): string {
  return serializeDialogueFile(files[npcId] ?? {});
}

function createDefaultDialogueNodes(npc: NpcDef): DialogueNodeData[] {
  return [
    {
      speaker: npc.name.trim() || npc.npcId,
      text: "Hello.",
      pitch: 1,
    },
  ];
}

function cloneNpcDef(npc: NpcDef): NpcDef {
  return {
    ...npc,
    presentation: npc.presentation ? { ...npc.presentation } : undefined,
  };
}
