import {
  cloneQtePatternDef,
  type ContentCatalogSnapshot,
  type ContentValidationContext,
  type PatternDef,
} from "../../../engine";

export function clonePatternDefs(
  patterns: readonly PatternDef[],
): PatternDef[] {
  return patterns.map(cloneQtePatternDef);
}

export function createPatternDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftPatterns: readonly PatternDef[],
): ContentCatalogSnapshot {
  return {
    ...snapshot,
    qtePatterns: clonePatternDefs(draftPatterns),
  };
}

export function createPatternDraftValidationContext(
  context: ContentValidationContext,
  draftPatterns: readonly PatternDef[],
): ContentValidationContext {
  return {
    ...context,
    qtePatternIds: new Set(draftPatterns.map((pattern) => pattern.patternId)),
  };
}

export function patternContentPath(patternId: string): string {
  return `src/content/qte-patterns/${patternId}.json`;
}

export function serializePatternDef(pattern: PatternDef): string {
  return JSON.stringify(pattern, null, 2);
}

export function serializePatternDefsById(
  patterns: readonly PatternDef[],
): Map<string, string> {
  return new Map(
    patterns.map((pattern) => [pattern.patternId, serializePatternDef(pattern)]),
  );
}

export interface EditorPatternEntry {
  id: string;
  name: string;
}

export function listPatternEntries(
  patterns: readonly PatternDef[],
): EditorPatternEntry[] {
  return patterns
    .map((pattern) => ({ id: pattern.patternId, name: pattern.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function createDefaultPatternDef(patternId: string): PatternDef {
  return {
    patternId,
    name: patternId,
    description: "A newly authored pattern.",
    kind: "magical",
    inputs: ["up", "down", "left", "right"],
    timeLimitMs: 3500,
    mpCost: 10,
    damageMultiplier: 1.5,
    requiredPlayerLevel: 1,
    requiredIntelligence: 8,
  };
}

export function upsertPatternDef(
  patterns: readonly PatternDef[],
  pattern: PatternDef,
): PatternDef[] {
  const exists = patterns.some(
    (entry) => entry.patternId === pattern.patternId,
  );
  const next = exists
    ? patterns.map((entry) =>
        entry.patternId === pattern.patternId
          ? cloneQtePatternDef(pattern)
          : cloneQtePatternDef(entry),
      )
    : [...patterns, cloneQtePatternDef(pattern)];

  return next.sort((a, b) => a.patternId.localeCompare(b.patternId));
}

export function updatePatternDef(
  patterns: readonly PatternDef[],
  patternId: string,
  updater: (pattern: PatternDef) => PatternDef,
): PatternDef[] {
  return patterns.map((pattern) =>
    pattern.patternId === patternId
      ? cloneQtePatternDef(updater(cloneQtePatternDef(pattern)))
      : cloneQtePatternDef(pattern),
  );
}

export function removePatternDef(
  patterns: readonly PatternDef[],
  patternId: string,
): PatternDef[] {
  return patterns
    .filter((pattern) => pattern.patternId !== patternId)
    .map((pattern) => cloneQtePatternDef(pattern));
}

/** Validates a would-be new pattern id: lowercase slug, unique. */
export function isValidNewPatternId(
  patternId: string,
  existing: readonly PatternDef[],
): boolean {
  if (!/^[a-z0-9_]+$/.test(patternId)) {
    return false;
  }
  return !existing.some((pattern) => pattern.patternId === patternId);
}
