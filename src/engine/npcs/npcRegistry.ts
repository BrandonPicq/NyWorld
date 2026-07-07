import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import type { ContentValidationContext } from "../content/ContentValidationContext";
import {
  NPC_IMPORTANCE_OPTIONS,
  NPC_RACE_OPTIONS,
} from "../content/editingMetadata";
import { getAllDialogueIds } from "../dialogues/dialogueRegistry";
import type { NpcDef, NpcDefMap, NpcImportance, NpcRace } from "./NpcDef";

const NPC_CONTENT_TYPE = CONTENT_TYPES.npc;

/**
 * Catalog subset that NPC definition validation checks references against.
 */
export type NpcValidationContext = Pick<
  ContentValidationContext,
  "dialogueIds"
>;

const npcDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/npcs/*.json", {
    eager: true,
    import: "default",
  }),
);

const fallback: NpcDef = {
  npcId: "unknown_npc",
  name: "Unknown NPC",
  race: "unknown",
  defaultDialogueId: "unknown_npc.default",
};

let overlayRegistry: NpcDefMap | null = null;

const registry = buildRegistry(npcDefs);

/**
 * Returns true when an NPC id has a registered character definition.
 */
export function hasNpcDef(npcId: string): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), npcId);
}

/**
 * Returns a detached character definition for an NPC id.
 *
 * Unknown ids resolve to a fallback so display code can stay resilient. Content
 * loaders should still reject unknown ids with hasNpcDef.
 */
export function getNpcDef(npcId: string): NpcDef {
  return cloneNpcDef(getActiveRegistry()[npcId] ?? fallback);
}

/**
 * Returns detached copies of every registered NPC definition.
 */
export function getAllNpcDefs(): NpcDef[] {
  return Object.values(getActiveRegistry()).map(cloneNpcDef);
}

export function installNpcContentOverlay(defs: readonly NpcDef[]): void {
  if (!import.meta.env.DEV) return;
  overlayRegistry = buildRegistry(defs);
}

export function clearNpcContentOverlay(): void {
  overlayRegistry = null;
}

function getActiveRegistry(): NpcDefMap {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearNpcContentOverlay);
}

/**
 * Validates one NPC character definition against an explicit content context.
 */
export function validateNpcDef(
  value: unknown,
  context: NpcValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addNpcError(diagnostics, undefined, "$", "NPC definition must be an object.");
    return diagnostics;
  }

  const npcId =
    typeof value.npcId === "string" && value.npcId.trim()
      ? value.npcId
      : undefined;

  if (!npcId) {
    addNpcError(
      diagnostics,
      undefined,
      "npcId",
      "NPC definition has invalid or missing npcId.",
    );
  }

  const npcLabel = npcId ?? "unknown";

  if (typeof value.name !== "string" || !value.name.trim()) {
    addNpcError(
      diagnostics,
      npcId,
      "name",
      `NPC definition "${npcLabel}" has invalid or missing name.`,
    );
  }

  if (!isNpcRace(value.race)) {
    addNpcError(
      diagnostics,
      npcId,
      "race",
      `NPC definition "${npcLabel}" has invalid or missing race.`,
    );
  }

  if (value.importance !== undefined && !isNpcImportance(value.importance)) {
    addNpcError(
      diagnostics,
      npcId,
      "importance",
      `NPC definition "${npcLabel}" has invalid importance.`,
    );
  }

  if (value.presentation !== undefined) {
    validateNpcPresentation(value.presentation, npcId, npcLabel, diagnostics);
  }

  if (
    typeof value.defaultDialogueId !== "string" ||
    !value.defaultDialogueId.trim()
  ) {
    addNpcError(
      diagnostics,
      npcId,
      "defaultDialogueId",
      `NPC definition "${npcLabel}" has invalid or missing defaultDialogueId.`,
    );
  } else if (!context.dialogueIds.has(value.defaultDialogueId)) {
    addNpcError(
      diagnostics,
      npcId,
      "defaultDialogueId",
      `NPC definition "${npcLabel}" references unknown defaultDialogueId "${value.defaultDialogueId}".`,
    );
  }

  return diagnostics;
}

/**
 * Validates a full NPC registry, adding duplicate-id checks on top of per-def
 * validation.
 */
export function validateNpcRegistry(
  defs: readonly unknown[],
  context: NpcValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const seenIds = new Set<string>();

  for (const def of defs) {
    diagnostics.push(...validateNpcDef(def, context));

    if (!isRecord(def) || typeof def.npcId !== "string" || !def.npcId.trim()) {
      continue;
    }

    if (seenIds.has(def.npcId)) {
      addNpcError(
        diagnostics,
        def.npcId,
        "npcId",
        `Duplicate NPC definition "${def.npcId}".`,
      );
    } else {
      seenIds.add(def.npcId);
    }
  }

  return diagnostics;
}

function validateNpcPresentation(
  value: unknown,
  npcId: string | undefined,
  npcLabel: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addNpcError(
      diagnostics,
      npcId,
      "presentation",
      `NPC definition "${npcLabel}" presentation must be an object.`,
    );
    return;
  }

  if (typeof value.glyph !== "string" || value.glyph.length !== 1) {
    addNpcError(
      diagnostics,
      npcId,
      "presentation.glyph",
      `NPC definition "${npcLabel}" presentation has invalid glyph.`,
    );
  }

  if (typeof value.color !== "string" || !value.color.trim()) {
    addNpcError(
      diagnostics,
      npcId,
      "presentation.color",
      `NPC definition "${npcLabel}" presentation has invalid color.`,
    );
  }
}

function buildRegistry(defs: readonly unknown[]): NpcDefMap {
  const diagnostics = validateNpcRegistry(defs, {
    dialogueIds: new Set(getAllDialogueIds()),
  });
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  const nextRegistry: NpcDefMap = {};
  for (const def of defs) {
    const npcDef = def as NpcDef;
    nextRegistry[npcDef.npcId] = cloneNpcDef(npcDef);
  }

  return nextRegistry;
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

/**
 * Copies a registry definition before returning it to callers.
 *
 * Registries own content data; callers should never mutate imported JSON by
 * editing a returned object.
 */
function cloneNpcDef(def: NpcDef): NpcDef {
  return {
    ...def,
    presentation: def.presentation ? { ...def.presentation } : undefined,
  };
}

function addNpcError(
  diagnostics: ContentDiagnostic[],
  npcId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: NPC_CONTENT_TYPE,
    contentId: npcId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNpcRace(value: unknown): value is NpcRace {
  return (
    typeof value === "string" &&
    (NPC_RACE_OPTIONS as readonly string[]).includes(value)
  );
}

function isNpcImportance(value: unknown): value is NpcImportance {
  return (
    typeof value === "string" &&
    (NPC_IMPORTANCE_OPTIONS as readonly string[]).includes(value)
  );
}
