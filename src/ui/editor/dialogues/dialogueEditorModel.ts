import type {
  ContentCatalogSnapshot,
  ContentValidationContext,
  DialogueDefMap,
  DialogueNodeData,
} from "../../../engine";

const DIALOGUE_FILE_STEM_PATTERN = /^[a-z0-9_]+$/;
const DIALOGUE_ID_PATTERN = /^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/;

export interface EditorDialogueFileEntry {
  stem: string;
  dialogueCount: number;
}

export function listDialogueFiles(
  files: Record<string, DialogueDefMap>,
): EditorDialogueFileEntry[] {
  return Object.entries(files)
    .map(([stem, dialogues]) => ({
      stem,
      dialogueCount: Object.keys(dialogues).length,
    }))
    .sort((a, b) => a.stem.localeCompare(b.stem));
}

export function dialogueContentPath(stem: string): string {
  return `src/content/dialogues/${stem}.json`;
}

export function cloneDialogueFiles(
  files: Record<string, DialogueDefMap>,
): Record<string, DialogueDefMap> {
  return Object.fromEntries(
    Object.entries(files).map(([stem, dialogues]) => [
      stem,
      cloneDialogueMap(dialogues),
    ]),
  );
}

export function flattenDialogueFiles(
  files: Record<string, DialogueDefMap>,
): DialogueDefMap {
  const flattened: DialogueDefMap = {};
  for (const stem of Object.keys(files).sort((a, b) => a.localeCompare(b))) {
    for (const [dialogueId, nodes] of Object.entries(files[stem])) {
      flattened[dialogueId] = cloneDialogueNodes(nodes);
    }
  }
  return flattened;
}

export function createDialogueDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftFiles: Record<string, DialogueDefMap>,
): ContentCatalogSnapshot {
  return {
    ...snapshot,
    dialogues: {
      ...getNonEditableDialogueMap(snapshot),
      ...flattenDialogueFiles(draftFiles),
    },
    dialogueFiles: cloneDialogueFiles(draftFiles),
  };
}

export function createDialogueDraftValidationContext(
  context: ContentValidationContext,
  snapshot: ContentCatalogSnapshot,
  draftFiles: Record<string, DialogueDefMap>,
): ContentValidationContext {
  return {
    ...context,
    dialogueIds: new Set([
      ...Object.keys(getNonEditableDialogueMap(snapshot)),
      ...Object.keys(flattenDialogueFiles(draftFiles)),
    ]),
  };
}

export function serializeDialogueFile(file: DialogueDefMap): string {
  return JSON.stringify(file, null, 2);
}

export function validateNewDialogueFileStem(
  stemDraft: string,
  files: Record<string, DialogueDefMap>,
): string[] {
  const errors: string[] = [];
  const stem = stemDraft.trim();

  if (!stem) {
    errors.push("File stem is required.");
  } else if (!DIALOGUE_FILE_STEM_PATTERN.test(stem)) {
    errors.push(
      "File stem must be lowercase letters, digits, or underscores.",
    );
  } else if (files[stem]) {
    errors.push(`Dialogue file "${stem}" already exists.`);
  }

  return errors;
}

export function validateNewDialogueId(
  dialogueIdDraft: string,
  files: Record<string, DialogueDefMap>,
): string[] {
  const errors: string[] = [];
  const dialogueId = dialogueIdDraft.trim();

  if (!dialogueId) {
    errors.push("Dialogue id is required.");
  } else if (!DIALOGUE_ID_PATTERN.test(dialogueId)) {
    errors.push(
      "Dialogue id must use lowercase letters, digits, underscores, and dot-separated segments.",
    );
  } else if (flattenDialogueFiles(files)[dialogueId]) {
    errors.push(`Dialogue "${dialogueId}" already exists.`);
  }

  return errors;
}

export function addDialogueFile(
  files: Record<string, DialogueDefMap>,
  stemDraft: string,
): Record<string, DialogueDefMap> {
  const stem = stemDraft.trim();
  if (validateNewDialogueFileStem(stem, files).length > 0) {
    return files;
  }
  return { ...files, [stem]: {} };
}

export function addDialogueToFile(
  files: Record<string, DialogueDefMap>,
  stem: string,
  dialogueIdDraft: string,
): Record<string, DialogueDefMap> {
  const dialogueId = dialogueIdDraft.trim();
  const file = files[stem];
  if (!file || validateNewDialogueId(dialogueId, files).length > 0) {
    return files;
  }

  return {
    ...files,
    [stem]: {
      ...file,
      [dialogueId]: createBlankDialogueNodes(),
    },
  };
}

export function removeDialogueFromFile(
  files: Record<string, DialogueDefMap>,
  stem: string,
  dialogueId: string,
): Record<string, DialogueDefMap> {
  const file = files[stem];
  if (!file || !file[dialogueId]) {
    return files;
  }

  const { [dialogueId]: _removed, ...remaining } = file;
  return { ...files, [stem]: remaining };
}

export function replaceDialogueNodes(
  files: Record<string, DialogueDefMap>,
  stem: string,
  dialogueId: string,
  nodes: DialogueNodeData[],
): Record<string, DialogueDefMap> {
  const file = files[stem];
  if (!file || !file[dialogueId]) {
    return files;
  }

  return {
    ...files,
    [stem]: {
      ...file,
      [dialogueId]: cloneDialogueNodes(nodes),
    },
  };
}

export function addDialogueNode(
  nodes: readonly DialogueNodeData[],
): DialogueNodeData[] {
  return [...nodes, { speaker: "", text: "", pitch: 1 }];
}

export function updateDialogueNode(
  nodes: readonly DialogueNodeData[],
  index: number,
  patch: Partial<DialogueNodeData>,
): DialogueNodeData[] {
  if (index < 0 || index >= nodes.length) {
    return [...nodes];
  }
  return nodes.map((node, nodeIndex) =>
    nodeIndex === index ? { ...node, ...patch } : { ...node },
  );
}

export function removeDialogueNode(
  nodes: readonly DialogueNodeData[],
  index: number,
): DialogueNodeData[] {
  if (index < 0 || index >= nodes.length) {
    return [...nodes];
  }
  return nodes
    .filter((_, nodeIndex) => nodeIndex !== index)
    .map((node) => ({ ...node }));
}

export function suggestDialogueId(fileStem: string, key = "default"): string {
  return `${fileStem}.${key}`;
}

function createBlankDialogueNodes(): DialogueNodeData[] {
  return [{ speaker: "", text: "", pitch: 1 }];
}

function getNonEditableDialogueMap(
  snapshot: ContentCatalogSnapshot,
): DialogueDefMap {
  const editableIds = new Set(
    Object.keys(flattenDialogueFiles(snapshot.dialogueFiles)),
  );
  return Object.fromEntries(
    Object.entries(snapshot.dialogues)
      .filter(([dialogueId]) => !editableIds.has(dialogueId))
      .map(([dialogueId, nodes]) => [dialogueId, cloneDialogueNodes(nodes)]),
  );
}

function cloneDialogueMap(dialogues: DialogueDefMap): DialogueDefMap {
  return Object.fromEntries(
    Object.entries(dialogues).map(([dialogueId, nodes]) => [
      dialogueId,
      cloneDialogueNodes(nodes),
    ]),
  );
}

function cloneDialogueNodes(
  nodes: readonly DialogueNodeData[],
): DialogueNodeData[] {
  return nodes.map((node) => ({ ...node }));
}
