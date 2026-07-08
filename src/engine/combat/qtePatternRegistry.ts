import { EQUIPMENT_WEAPON_TYPE_OPTIONS } from "../content/editingMetadata";
import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import type { ContentValidationContext } from "../content/ContentValidationContext";
import type { PatternDef, PatternDefMap } from "./PatternDef";

const QTE_PATTERN_CONTENT_TYPE = CONTENT_TYPES.qtePattern;

const VALID_PATTERN_KINDS = ["physical", "magical"];
const VALID_PATTERN_INPUTS = ["up", "down", "left", "right"];
const MIN_PATTERN_INPUTS = 4;
const MAX_PATTERN_INPUTS = 8;

/**
 * Catalog subset that pattern validation checks references against: only other
 * pattern ids, for the `evolvesFrom` link.
 */
export type QtePatternValidationContext = Pick<
  ContentValidationContext,
  "qtePatternIds"
>;

const qtePatternDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/qte-patterns/*.json", {
    eager: true,
    import: "default",
  }),
);

let overlayRegistry: PatternDefMap | null = null;

const registry = buildRegistry(qtePatternDefs);

export function hasQtePatternDef(patternId: string): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), patternId);
}

/**
 * Returns a detached pattern def, or undefined for unknown ids.
 *
 * There is deliberately no fallback def: an unknown pattern resolves to
 * undefined so it can never be learned, taught, or evolved (ADR 0009 inertness).
 */
export function getQtePatternDef(patternId: string): PatternDef | undefined {
  const def = getActiveRegistry()[patternId];
  return def ? cloneQtePatternDef(def) : undefined;
}

export function getAllQtePatternDefs(): PatternDef[] {
  return Object.values(getActiveRegistry()).map(cloneQtePatternDef);
}

export function getAllQtePatternIds(): string[] {
  return Object.keys(getActiveRegistry()).sort();
}

export function installQtePatternContentOverlay(
  defs: readonly PatternDef[],
): void {
  if (!import.meta.env.DEV) return;
  overlayRegistry = buildRegistry(defs);
}

export function clearQtePatternContentOverlay(): void {
  overlayRegistry = null;
}

function getActiveRegistry(): PatternDefMap {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearQtePatternContentOverlay);
}

/**
 * Validates one pattern definition against an explicit content context.
 */
export function validateQtePatternDef(
  value: unknown,
  context: QtePatternValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addPatternError(
      diagnostics,
      undefined,
      "$",
      "Pattern definition must be an object.",
    );
    return diagnostics;
  }

  const patternId =
    typeof value.patternId === "string" && value.patternId.trim()
      ? value.patternId
      : undefined;
  const label = patternId ?? "unknown";

  if (!patternId) {
    addPatternError(
      diagnostics,
      undefined,
      "patternId",
      "Pattern definition has invalid or missing patternId.",
    );
  }

  validateNonEmptyString(value.name, patternId, label, "name", diagnostics);
  validateNonEmptyString(
    value.description,
    patternId,
    label,
    "description",
    diagnostics,
  );

  if (
    typeof value.kind !== "string" ||
    !VALID_PATTERN_KINDS.includes(value.kind)
  ) {
    addPatternError(
      diagnostics,
      patternId,
      "kind",
      `Pattern "${label}" has invalid kind. Expected one of: ${VALID_PATTERN_KINDS.join(", ")}.`,
    );
  }

  validateInputs(value.inputs, patternId, label, diagnostics);

  validatePositiveNumber(value.timeLimitMs, patternId, label, "timeLimitMs", diagnostics);
  validateNonNegativeInteger(value.mpCost, patternId, label, "mpCost", diagnostics);
  validatePositiveNumber(
    value.damageMultiplier,
    patternId,
    label,
    "damageMultiplier",
    diagnostics,
  );
  validatePositiveInteger(
    value.requiredPlayerLevel,
    patternId,
    label,
    "requiredPlayerLevel",
    diagnostics,
  );
  validateNonNegativeInteger(
    value.requiredIntelligence,
    patternId,
    label,
    "requiredIntelligence",
    diagnostics,
  );

  if (value.requiredWeaponTypes !== undefined) {
    validateWeaponTypes(value.requiredWeaponTypes, patternId, label, diagnostics);
  }

  if (value.evolvesFrom !== undefined) {
    validateEvolvesFrom(value.evolvesFrom, patternId, label, context, diagnostics);
  }

  return diagnostics;
}

/**
 * Validates a full pattern registry, adding duplicate-id checks on top of
 * per-def validation.
 */
export function validateQtePatternRegistry(
  defs: readonly unknown[],
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const seenIds = new Set<string>();
  const context: QtePatternValidationContext = {
    qtePatternIds: collectPatternIds(defs),
  };

  for (const def of defs) {
    diagnostics.push(...validateQtePatternDef(def, context));

    if (
      !isRecord(def) ||
      typeof def.patternId !== "string" ||
      !def.patternId.trim()
    ) {
      continue;
    }

    if (seenIds.has(def.patternId)) {
      addPatternError(
        diagnostics,
        def.patternId,
        "patternId",
        `Duplicate pattern definition "${def.patternId}".`,
      );
    } else {
      seenIds.add(def.patternId);
    }
  }

  return diagnostics;
}

function validateInputs(
  value: unknown,
  patternId: string | undefined,
  label: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    addPatternError(
      diagnostics,
      patternId,
      "inputs",
      `Pattern "${label}" inputs must be an array.`,
    );
    return;
  }

  if (value.length < MIN_PATTERN_INPUTS || value.length > MAX_PATTERN_INPUTS) {
    addPatternError(
      diagnostics,
      patternId,
      "inputs",
      `Pattern "${label}" must have between ${MIN_PATTERN_INPUTS} and ${MAX_PATTERN_INPUTS} inputs.`,
    );
  }

  value.forEach((input, i) => {
    if (typeof input !== "string" || !VALID_PATTERN_INPUTS.includes(input)) {
      addPatternError(
        diagnostics,
        patternId,
        `inputs[${i}]`,
        `Pattern "${label}" input ${i} must be one of: ${VALID_PATTERN_INPUTS.join(", ")}.`,
      );
    }
  });
}

function validateWeaponTypes(
  value: unknown,
  patternId: string | undefined,
  label: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    addPatternError(
      diagnostics,
      patternId,
      "requiredWeaponTypes",
      `Pattern "${label}" requiredWeaponTypes must be an array.`,
    );
    return;
  }

  value.forEach((weaponType, i) => {
    if (
      typeof weaponType !== "string" ||
      !(EQUIPMENT_WEAPON_TYPE_OPTIONS as readonly string[]).includes(weaponType)
    ) {
      addPatternError(
        diagnostics,
        patternId,
        `requiredWeaponTypes[${i}]`,
        `Pattern "${label}" requiredWeaponTypes[${i}] must be one of: ${EQUIPMENT_WEAPON_TYPE_OPTIONS.join(", ")}.`,
      );
    }
  });
}

function validateEvolvesFrom(
  value: unknown,
  patternId: string | undefined,
  label: string,
  context: QtePatternValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addPatternError(
      diagnostics,
      patternId,
      "evolvesFrom",
      `Pattern "${label}" evolvesFrom must be an object.`,
    );
    return;
  }

  if (typeof value.patternId !== "string" || !value.patternId.trim()) {
    addPatternError(
      diagnostics,
      patternId,
      "evolvesFrom.patternId",
      `Pattern "${label}" evolvesFrom.patternId is invalid.`,
    );
  } else if (
    context.qtePatternIds &&
    !context.qtePatternIds.has(value.patternId)
  ) {
    addPatternError(
      diagnostics,
      patternId,
      "evolvesFrom.patternId",
      `Pattern "${label}" evolvesFrom references unknown pattern "${value.patternId}".`,
    );
  } else if (value.patternId === patternId) {
    addPatternError(
      diagnostics,
      patternId,
      "evolvesFrom.patternId",
      `Pattern "${label}" cannot evolve from itself.`,
    );
  }

  validatePositiveInteger(
    value.usageRequired,
    patternId,
    label,
    "evolvesFrom.usageRequired",
    diagnostics,
  );
}

function buildRegistry(defs: readonly unknown[]): PatternDefMap {
  const diagnostics = validateQtePatternRegistry(defs);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  const nextRegistry: PatternDefMap = {};
  for (const def of defs) {
    const patternDef = def as PatternDef;
    nextRegistry[patternDef.patternId] = cloneQtePatternDef(patternDef);
  }

  return nextRegistry;
}

function collectPatternIds(defs: readonly unknown[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const def of defs) {
    if (isRecord(def) && typeof def.patternId === "string" && def.patternId.trim()) {
      ids.add(def.patternId);
    }
  }
  return ids;
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

export function cloneQtePatternDef(def: PatternDef): PatternDef {
  return {
    ...def,
    inputs: [...def.inputs],
    requiredWeaponTypes: def.requiredWeaponTypes
      ? [...def.requiredWeaponTypes]
      : undefined,
    evolvesFrom: def.evolvesFrom ? { ...def.evolvesFrom } : undefined,
  };
}

function validateNonEmptyString(
  value: unknown,
  patternId: string | undefined,
  label: string,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    addPatternError(
      diagnostics,
      patternId,
      path,
      `Pattern "${label}" has invalid or missing ${path}.`,
    );
  }
}

function validatePositiveNumber(
  value: unknown,
  patternId: string | undefined,
  label: string,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    addPatternError(
      diagnostics,
      patternId,
      path,
      `Pattern "${label}" has invalid ${path}. Expected a positive number.`,
    );
  }
}

function validatePositiveInteger(
  value: unknown,
  patternId: string | undefined,
  label: string,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    addPatternError(
      diagnostics,
      patternId,
      path,
      `Pattern "${label}" has invalid ${path}. Expected a positive integer.`,
    );
  }
}

function validateNonNegativeInteger(
  value: unknown,
  patternId: string | undefined,
  label: string,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    addPatternError(
      diagnostics,
      patternId,
      path,
      `Pattern "${label}" has invalid ${path}. Expected a non-negative integer.`,
    );
  }
}

function addPatternError(
  diagnostics: ContentDiagnostic[],
  patternId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: QTE_PATTERN_CONTENT_TYPE,
    contentId: patternId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
