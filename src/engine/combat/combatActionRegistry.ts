import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import { COMBAT_ACTION_CATEGORY_OPTIONS } from "../content/editingMetadata";
import type {
  CombatActionDef,
  CombatActionDefMap,
  CombatActionId,
  CombatActionTuning,
} from "./CombatActionDef";

const COMBAT_ACTION_CONTENT_TYPE = CONTENT_TYPES.combatAction;

/**
 * Derives the numeric effect lines a combat action's tuning implies.
 *
 * The registry prepends these to the authored (qualitative) effects at build
 * time, so the SP/MP numbers live only in `tuning` while the rendered help text
 * stays byte-identical to the previously hand-authored strings. Multiplier
 * tuning (Guard/Focus) has no numeric effect line — those stay authored prose.
 */
export function deriveCombatActionEffects(
  tuning: CombatActionTuning,
): string[] {
  const lines: string[] = [];
  if (tuning.spGain !== undefined) {
    lines.push(`Gain ${tuning.spGain} SP.`);
  }
  if (tuning.mpCost !== undefined) {
    lines.push(`Costs ${tuning.mpCost} MP.`);
  }
  return lines;
}

const TUNING_INTEGER_FIELDS = ["spGain", "mpCost"] as const;
const TUNING_MULTIPLIER_FIELDS = [
  "damageBoostMultiplier",
  "incomingDamageMultiplier",
] as const;

const combatActionDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/combat-actions/*.json", {
    eager: true,
    import: "default",
  }),
);

const registry = buildRegistry(combatActionDefs);

const fallback: CombatActionDef = {
  actionId: "strike",
  name: "Unknown Action",
  category: "utility",
  order: 999,
  summary: "This combat action is not defined yet.",
  formula: "No formula is available.",
  effects: ["No effects are available."],
  details: ["No detailed description is available for this action."],
};

export function hasCombatActionDef(actionId: string): actionId is CombatActionId {
  return Object.prototype.hasOwnProperty.call(registry, actionId);
}

export function getCombatActionDef(actionId: string): CombatActionDef {
  const def = registry[actionId as CombatActionId];
  return def ? cloneCombatActionDef(def) : cloneCombatActionDef(fallback);
}

export function getAllCombatActionDefs(): CombatActionDef[] {
  return Object.values(registry)
    .sort((a, b) => a.order - b.order)
    .map(cloneCombatActionDef);
}

/**
 * Validates one combat action definition without throwing.
 *
 * Combat actions are self-contained, so no content context is needed.
 */
export function validateCombatActionDef(value: unknown): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addActionError(
      diagnostics,
      undefined,
      "$",
      "Combat action definition must be an object.",
    );
    return diagnostics;
  }

  const actionId = isCombatActionId(value.actionId)
    ? value.actionId
    : undefined;

  if (!actionId) {
    addActionError(
      diagnostics,
      undefined,
      "actionId",
      "Combat action definition has invalid or missing actionId.",
    );
  }

  const actionLabel = actionId ?? "unknown";

  validateNonEmptyString(value.name, actionId, actionLabel, "name", diagnostics);

  if (
    typeof value.category !== "string" ||
    !(COMBAT_ACTION_CATEGORY_OPTIONS as readonly string[]).includes(
      value.category,
    )
  ) {
    addActionError(
      diagnostics,
      actionId,
      "category",
      `Combat action definition "${actionLabel}" has invalid category.`,
    );
  }

  if (
    typeof value.order !== "number" ||
    !Number.isInteger(value.order) ||
    value.order < 0
  ) {
    addActionError(
      diagnostics,
      actionId,
      "order",
      `Combat action definition "${actionLabel}" has invalid order.`,
    );
  }

  validateNonEmptyString(
    value.summary,
    actionId,
    actionLabel,
    "summary",
    diagnostics,
  );
  validateNonEmptyString(
    value.formula,
    actionId,
    actionLabel,
    "formula",
    diagnostics,
  );
  validateNonEmptyStringArray(
    value.effects,
    actionId,
    actionLabel,
    "effects",
    diagnostics,
  );
  validateNonEmptyStringArray(
    value.details,
    actionId,
    actionLabel,
    "details",
    diagnostics,
  );

  if (value.tuning !== undefined) {
    validateActionTuning(value.tuning, actionId, actionLabel, diagnostics);
  }

  return diagnostics;
}

function validateActionTuning(
  value: unknown,
  actionId: CombatActionId | undefined,
  actionLabel: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addActionError(
      diagnostics,
      actionId,
      "tuning",
      `Combat action definition "${actionLabel}" tuning must be an object.`,
    );
    return;
  }

  for (const field of TUNING_INTEGER_FIELDS) {
    const fieldValue = value[field];
    if (fieldValue === undefined) {
      continue;
    }
    if (
      typeof fieldValue !== "number" ||
      !Number.isInteger(fieldValue) ||
      fieldValue <= 0
    ) {
      addActionError(
        diagnostics,
        actionId,
        `tuning.${field}`,
        `Combat action definition "${actionLabel}" has invalid tuning.${field}. Expected a positive integer.`,
      );
    }
  }

  for (const field of TUNING_MULTIPLIER_FIELDS) {
    const fieldValue = value[field];
    if (fieldValue === undefined) {
      continue;
    }
    if (
      typeof fieldValue !== "number" ||
      !Number.isFinite(fieldValue) ||
      fieldValue <= 0
    ) {
      addActionError(
        diagnostics,
        actionId,
        `tuning.${field}`,
        `Combat action definition "${actionLabel}" has invalid tuning.${field}. Expected a positive number.`,
      );
    }
  }
}

/**
 * Validates a full combat action registry, adding duplicate checks on top of
 * per-def validation. Duplicate menu orders are reported as warnings because
 * they confuse authors without breaking gameplay.
 */
export function validateCombatActionRegistry(
  defs: readonly unknown[],
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const seenIds = new Set<string>();
  const seenOrders = new Map<number, string>();

  for (const def of defs) {
    diagnostics.push(...validateCombatActionDef(def));

    if (!isRecord(def) || !isCombatActionId(def.actionId)) {
      continue;
    }

    if (seenIds.has(def.actionId)) {
      addActionError(
        diagnostics,
        def.actionId,
        "actionId",
        `Duplicate combat action definition "${def.actionId}".`,
      );
    } else {
      seenIds.add(def.actionId);
    }

    if (
      typeof def.order === "number" &&
      Number.isInteger(def.order) &&
      def.order >= 0
    ) {
      const existing = seenOrders.get(def.order);
      if (existing !== undefined) {
        diagnostics.push({
          severity: "warning",
          contentType: COMBAT_ACTION_CONTENT_TYPE,
          contentId: def.actionId,
          path: "order",
          message: `Combat action "${def.actionId}" shares menu order ${def.order} with "${existing}".`,
        });
      } else {
        seenOrders.set(def.order, def.actionId);
      }
    }
  }

  return diagnostics;
}

function buildRegistry(defs: readonly unknown[]): CombatActionDefMap {
  const diagnostics = validateCombatActionRegistry(defs);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  const nextRegistry = {} as CombatActionDefMap;
  for (const def of defs) {
    const actionDef = def as CombatActionDef;
    nextRegistry[actionDef.actionId] = composeCombatActionDef(actionDef);
  }

  return nextRegistry;
}

/**
 * Clones an authored action and prepends its tuning-derived effect lines.
 *
 * Actions without tuning (including the fallback) gain no derived lines, so the
 * fallback stays inert.
 */
function composeCombatActionDef(def: CombatActionDef): CombatActionDef {
  const cloned = cloneCombatActionDef(def);
  const derived = cloned.tuning ? deriveCombatActionEffects(cloned.tuning) : [];
  cloned.effects = [...derived, ...cloned.effects];
  return cloned;
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function cloneCombatActionDef(def: CombatActionDef): CombatActionDef {
  return {
    ...def,
    effects: [...def.effects],
    details: [...def.details],
    tuning: def.tuning ? { ...def.tuning } : undefined,
  };
}

function validateNonEmptyString(
  value: unknown,
  actionId: CombatActionId | undefined,
  actionLabel: string,
  key: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    addActionError(
      diagnostics,
      actionId,
      key,
      `Combat action definition "${actionLabel}" has invalid ${key}.`,
    );
  }
}

function validateNonEmptyStringArray(
  value: unknown,
  actionId: CombatActionId | undefined,
  actionLabel: string,
  key: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    addActionError(
      diagnostics,
      actionId,
      key,
      `Combat action definition "${actionLabel}" has invalid ${key}.`,
    );
    return;
  }

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    if (typeof entry !== "string" || !entry.trim()) {
      addActionError(
        diagnostics,
        actionId,
        `${key}[${i}]`,
        `Combat action definition "${actionLabel}" has invalid ${key} entry.`,
      );
    }
  }
}

function isCombatActionId(value: unknown): value is CombatActionId {
  return (
    value === "strike" ||
    value === "cast" ||
    value === "guard" ||
    value === "focus" ||
    value === "flee" ||
    value === "use_item"
  );
}

function addActionError(
  diagnostics: ContentDiagnostic[],
  actionId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: COMBAT_ACTION_CONTENT_TYPE,
    contentId: actionId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
