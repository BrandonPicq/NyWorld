import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import type { DialogueNodeData } from "../ZoneTypes";
import type { DialogueDefMap } from "./DialogueDef";

const DIALOGUE_CONTENT_TYPE = CONTENT_TYPES.dialogue;

const fallback: DialogueNodeData[] = [
  {
    speaker: "Narrator",
    text: "There is nothing to say yet.",
    pitch: 1,
  },
];

let overlayRegistry: DialogueDefMap | null = null;
let overlayFiles: Record<string, DialogueDefMap> | null = null;

const dialogueFiles = getSortedContentModules(
  import.meta.glob<unknown>("../../content/dialogues/*.json", {
    eager: true,
    import: "default",
  }),
);

const dialogueMaps = [
  { "unknown_npc.default": fallback },
  ...dialogueFiles.map((file) => file.dialogues),
];

const registry = buildRegistry(dialogueMaps);

/**
 * Returns true when a dialogue id is available in the dialogue registry.
 */
export function hasDialogue(dialogueId: string): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), dialogueId);
}

/**
 * Returns every registered dialogue id in deterministic order.
 */
export function getAllDialogueIds(): string[] {
  return Object.keys(getActiveRegistry()).sort();
}

/**
 * Returns the editable dialogue files keyed by file stem.
 *
 * The synthetic runtime fallback is intentionally excluded: it is available to
 * `getDialogue()` for resilience, but it is not owned by a JSON content file.
 */
export function getDialogueFiles(): Record<string, DialogueDefMap> {
  if (overlayFiles) {
    return cloneDialogueFiles(overlayFiles);
  }

  return Object.fromEntries(
    dialogueFiles.map((file) => [
      file.stem,
      cloneDialogueMap(file.dialogues as DialogueDefMap),
    ]),
  );
}

/**
 * Returns a detached dialogue sequence for an id.
 *
 * Unknown ids resolve to a fallback line for runtime resilience. Content
 * validation should still reject unknown dialogue ids.
 */
export function getDialogue(dialogueId: string): DialogueNodeData[] {
  const dialogue = getActiveRegistry()[dialogueId] ?? fallback;
  return dialogue.map((node) => ({ ...node }));
}

export function installDialogueContentOverlay(
  files: Record<string, DialogueDefMap>,
): void {
  if (!import.meta.env.DEV) return;
  const clonedFiles = cloneDialogueFiles(files);
  overlayRegistry = buildRegistry([
    { "unknown_npc.default": fallback },
    ...Object.values(clonedFiles),
  ]);
  overlayFiles = clonedFiles;
}

export function clearDialogueContentOverlay(): void {
  overlayRegistry = null;
  overlayFiles = null;
}

function getActiveRegistry(): DialogueDefMap {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearDialogueContentOverlay);
}

/**
 * Validates one dialogue file (a map of dialogue ids to node arrays) without
 * throwing. Dialogues are a leaf content type, so no context is needed.
 */
export function validateDialogueFile(value: unknown): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addDialogueError(
      diagnostics,
      undefined,
      "$",
      "Dialogue file must be an object map of dialogue sequences.",
    );
    return diagnostics;
  }

  for (const [dialogueId, nodes] of Object.entries(value)) {
    if (!dialogueId.trim()) {
      addDialogueError(
        diagnostics,
        undefined,
        "$",
        "Dialogue file contains an empty dialogue id.",
      );
      continue;
    }

    validateDialogueNodes(dialogueId, nodes, diagnostics);
  }

  return diagnostics;
}

/**
 * Validates a full set of dialogue files, adding duplicate-id checks across
 * files on top of per-file validation.
 */
export function validateDialogueRegistry(
  files: readonly unknown[],
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const seenIds = new Set<string>();

  for (const file of files) {
    diagnostics.push(...validateDialogueFile(file));

    if (!isRecord(file)) {
      continue;
    }

    for (const dialogueId of Object.keys(file)) {
      if (!dialogueId.trim()) {
        continue;
      }

      if (seenIds.has(dialogueId)) {
        addDialogueError(
          diagnostics,
          dialogueId,
          "$",
          `Duplicate dialogue definition "${dialogueId}".`,
        );
      } else {
        seenIds.add(dialogueId);
      }
    }
  }

  return diagnostics;
}

function validateDialogueNodes(
  dialogueId: string,
  value: unknown,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    addDialogueError(
      diagnostics,
      dialogueId,
      "$",
      `Dialogue "${dialogueId}" must contain nodes.`,
    );
    return;
  }

  for (let i = 0; i < value.length; i++) {
    const node = value[i];

    if (!isRecord(node)) {
      addDialogueError(
        diagnostics,
        dialogueId,
        `[${i}]`,
        `Dialogue "${dialogueId}" node ${i} must be an object.`,
      );
      continue;
    }

    if (typeof node.speaker !== "string" || !node.speaker.trim()) {
      addDialogueError(
        diagnostics,
        dialogueId,
        `[${i}].speaker`,
        `Dialogue "${dialogueId}" node ${i} has invalid speaker.`,
      );
    }

    if (typeof node.text !== "string" || !node.text.trim()) {
      addDialogueError(
        diagnostics,
        dialogueId,
        `[${i}].text`,
        `Dialogue "${dialogueId}" node ${i} has invalid text.`,
      );
    }

    if (
      typeof node.pitch !== "number" ||
      !Number.isFinite(node.pitch) ||
      node.pitch < 0.1
    ) {
      addDialogueError(
        diagnostics,
        dialogueId,
        `[${i}].pitch`,
        `Dialogue "${dialogueId}" node ${i} has invalid pitch.`,
      );
    }
  }
}

function buildRegistry(files: readonly unknown[]): DialogueDefMap {
  const diagnostics = validateDialogueRegistry(files);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  const nextRegistry: DialogueDefMap = {};
  for (const file of files) {
    const dialogueMap = file as Record<string, DialogueNodeData[]>;
    for (const [dialogueId, nodes] of Object.entries(dialogueMap)) {
      nextRegistry[dialogueId] = nodes.map((node) => ({ ...node }));
    }
  }

  return nextRegistry;
}

function getSortedContentModules(
  modules: Record<string, unknown>,
): { stem: string; dialogues: unknown }[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, module]) => ({
      stem: getFileStem(path),
      dialogues: module,
    }));
}

function getFileStem(path: string): string {
  return path.split("/").pop()?.replace(/\.json$/, "") ?? path;
}

function cloneDialogueMap(dialogues: DialogueDefMap): DialogueDefMap {
  return Object.fromEntries(
    Object.entries(dialogues).map(([dialogueId, nodes]) => [
      dialogueId,
      nodes.map((node) => ({ ...node })),
    ]),
  );
}

function cloneDialogueFiles(
  files: Record<string, DialogueDefMap>,
): Record<string, DialogueDefMap> {
  return Object.fromEntries(
    Object.entries(files).map(([stem, dialogues]) => [
      stem,
      cloneDialogueMap(dialogues),
    ]),
  );
}

function addDialogueError(
  diagnostics: ContentDiagnostic[],
  dialogueId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: DIALOGUE_CONTENT_TYPE,
    contentId: dialogueId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
