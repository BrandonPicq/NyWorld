import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import type { ContentValidationContext } from "../content/ContentValidationContext";
import { getAllDialogueIds } from "../dialogues/dialogueRegistry";
import { parseScheduleTime } from "../systems/NpcScheduleSystem";
import { getAllNpcDefs } from "./npcRegistry";
import type { NpcPresenceDef, NpcPresenceDefMap } from "./NpcPresenceDef";

const NPC_PRESENCE_CONTENT_TYPE = CONTENT_TYPES.npcPresence;

/**
 * Catalog subset that global presence validation checks references against.
 *
 * Zone existence is deliberately not checked here: the presence registry loads
 * before the zone bundle, so cross-zone checks belong to the whole-bundle
 * content audit that runs with the full context.
 */
export type NpcPresenceValidationContext = Pick<
  ContentValidationContext,
  "npcIds" | "dialogueIds"
>;

const presenceDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/npc-presence/*.json", {
    eager: true,
    import: "default",
  }),
);

const registry = buildRegistry(presenceDefs);

/**
 * Returns true when an NPC has a global presence definition.
 */
export function hasNpcPresenceDef(npcId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, npcId);
}

/**
 * Returns a detached global presence definition for one NPC, if registered.
 */
export function getNpcPresenceDef(npcId: string): NpcPresenceDef | undefined {
  const def = registry[npcId];
  return def ? cloneNpcPresenceDef(def) : undefined;
}

/**
 * Returns detached copies of all global presence definitions.
 */
export function getAllNpcPresenceDefs(): NpcPresenceDef[] {
  return Object.values(registry).map(cloneNpcPresenceDef);
}

/**
 * Validates one global presence definition against an explicit content context.
 */
export function validateNpcPresenceDef(
  value: unknown,
  context: NpcPresenceValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addPresenceError(
      diagnostics,
      undefined,
      "$",
      "NPC presence definition must be an object.",
    );
    return diagnostics;
  }

  const npcId =
    typeof value.npcId === "string" && value.npcId.trim()
      ? value.npcId
      : undefined;

  if (!npcId) {
    addPresenceError(
      diagnostics,
      undefined,
      "npcId",
      "NPC presence definition has invalid or missing npcId.",
    );
  } else if (!context.npcIds.has(npcId)) {
    addPresenceError(
      diagnostics,
      npcId,
      "npcId",
      `NPC presence definition references unknown npcId "${npcId}".`,
    );
  }

  validateSchedule(value.schedule, npcId, context, diagnostics);

  return diagnostics;
}

/**
 * Validates a full presence registry, adding duplicate-id checks on top of
 * per-def validation.
 */
export function validateNpcPresenceRegistry(
  defs: readonly unknown[],
  context: NpcPresenceValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const seenIds = new Set<string>();

  for (const def of defs) {
    diagnostics.push(...validateNpcPresenceDef(def, context));

    if (!isRecord(def) || typeof def.npcId !== "string" || !def.npcId.trim()) {
      continue;
    }

    if (seenIds.has(def.npcId)) {
      addPresenceError(
        diagnostics,
        def.npcId,
        "npcId",
        `Duplicate NPC presence definition "${def.npcId}".`,
      );
    } else {
      seenIds.add(def.npcId);
    }
  }

  return diagnostics;
}

function validateSchedule(
  value: unknown,
  npcId: string | undefined,
  context: NpcPresenceValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  const npcLabel = npcId ?? "unknown";

  if (!Array.isArray(value) || value.length === 0) {
    addPresenceError(
      diagnostics,
      npcId,
      "schedule",
      `NPC presence definition "${npcLabel}" schedule must contain entries.`,
    );
    return;
  }

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    const entryPath = `schedule[${i}]`;

    if (!isRecord(entry)) {
      addPresenceError(
        diagnostics,
        npcId,
        entryPath,
        `NPC presence definition "${npcLabel}" schedule entry ${i} must be an object.`,
      );
      continue;
    }

    if (
      typeof entry.time !== "string" ||
      parseScheduleTime(entry.time) === undefined
    ) {
      addPresenceError(
        diagnostics,
        npcId,
        `${entryPath}.time`,
        `NPC presence definition "${npcLabel}" schedule entry ${i} has invalid time.`,
      );
    }

    if (typeof entry.zoneId !== "string" || !entry.zoneId.trim()) {
      addPresenceError(
        diagnostics,
        npcId,
        `${entryPath}.zoneId`,
        `NPC presence definition "${npcLabel}" schedule entry ${i} has invalid zoneId.`,
      );
    }

    if (
      typeof entry.x !== "number" ||
      !Number.isInteger(entry.x) ||
      entry.x < 0
    ) {
      addPresenceError(
        diagnostics,
        npcId,
        `${entryPath}.x`,
        `NPC presence definition "${npcLabel}" schedule entry ${i} has invalid x.`,
      );
    }

    if (
      typeof entry.y !== "number" ||
      !Number.isInteger(entry.y) ||
      entry.y < 0
    ) {
      addPresenceError(
        diagnostics,
        npcId,
        `${entryPath}.y`,
        `NPC presence definition "${npcLabel}" schedule entry ${i} has invalid y.`,
      );
    }

    if (entry.dialogueId !== undefined) {
      if (
        typeof entry.dialogueId !== "string" ||
        !context.dialogueIds.has(entry.dialogueId)
      ) {
        addPresenceError(
          diagnostics,
          npcId,
          `${entryPath}.dialogueId`,
          `NPC presence definition "${npcLabel}" schedule entry ${i} references unknown dialogueId "${entry.dialogueId}".`,
        );
      }
    }
  }
}

function buildRegistry(defs: readonly unknown[]): NpcPresenceDefMap {
  const diagnostics = validateNpcPresenceRegistry(defs, {
    npcIds: new Set(getAllNpcDefs().map((npc) => npc.npcId)),
    dialogueIds: new Set(getAllDialogueIds()),
  });
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  const nextRegistry: NpcPresenceDefMap = {};
  for (const def of defs) {
    const presenceDef = def as NpcPresenceDef;
    nextRegistry[presenceDef.npcId] = cloneNpcPresenceDef(presenceDef);
  }

  return nextRegistry;
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

/**
 * Copies a presence definition and each schedule entry before returning it.
 *
 * Schedule entries are mutable during validation and future tooling, so registry
 * callers get copies instead of references to imported JSON.
 */
function cloneNpcPresenceDef(def: NpcPresenceDef): NpcPresenceDef {
  return {
    ...def,
    schedule: def.schedule.map((entry) => ({ ...entry })),
  };
}

function addPresenceError(
  diagnostics: ContentDiagnostic[],
  npcId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: NPC_PRESENCE_CONTENT_TYPE,
    contentId: npcId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
