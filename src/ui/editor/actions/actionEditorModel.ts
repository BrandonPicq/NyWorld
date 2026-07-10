import {
  COMBAT_ACTION_CATEGORY_OPTIONS,
  deriveCombatActionEffects,
  type CombatActionDef,
  type CombatActionCategory,
  type CombatActionTuning,
  type ContentCatalogSnapshot,
} from "../../../engine";

export function groupActionsByCategory<T extends {
  actionId: string;
  category: CombatActionCategory;
  order: number;
}>(actions: readonly T[]): { category: CombatActionCategory; actions: T[] }[] {
  return COMBAT_ACTION_CATEGORY_OPTIONS.map((category) => ({
    category,
    actions: actions
      .filter((action) => action.category === category)
      .sort((a, b) => a.order - b.order || a.actionId.localeCompare(b.actionId)),
  })).filter((group) => group.actions.length > 0);
}

/** Numeric tuning fields exposed in the editor, with label and kind. */
export interface ActionTuningFieldConfig {
  field: keyof CombatActionTuning;
  label: string;
  kind: "integer" | "multiplier";
}

export const ACTION_TUNING_FIELDS: readonly ActionTuningFieldConfig[] = [
  { field: "spGain", label: "SP Gain", kind: "integer" },
  { field: "mpCost", label: "MP Cost", kind: "integer" },
  {
    field: "damageBoostMultiplier",
    label: "Damage Boost ×",
    kind: "multiplier",
  },
  {
    field: "incomingDamageMultiplier",
    label: "Incoming Damage ×",
    kind: "multiplier",
  },
];

/** Editable string-list fields on a combat action. */
export type ActionLineField = "effects" | "details";

/** Content path a combat action draft saves to; the file name is the actionId. */
export function actionContentPath(actionId: string): string {
  return `src/content/combat-actions/${actionId}.json`;
}

export function cloneCombatActionDef(def: CombatActionDef): CombatActionDef {
  return {
    ...def,
    effects: [...def.effects],
    details: [...def.details],
    tuning: def.tuning ? { ...def.tuning } : undefined,
  };
}

/**
 * Strips the tuning-derived numeric lines the registry prepends, leaving the
 * authored (qualitative) effects the JSON file actually stores.
 *
 * `getAllCombatActionDefs` returns composed effects (derived + authored); the
 * editor edits and saves only the authored prose, so it must drop the derived
 * prefix first or a save would rewrite the derived lines back into the file.
 */
export function toAuthoredCombatActionDef(
  def: CombatActionDef,
): CombatActionDef {
  const derivedCount = def.tuning
    ? deriveCombatActionEffects(def.tuning).length
    : 0;
  return {
    ...cloneCombatActionDef(def),
    effects: def.effects.slice(derivedCount),
  };
}

/** Authored (stripped) combat action defs from the catalog, in display order. */
export function listAuthoredCombatActionDefs(
  snapshot: ContentCatalogSnapshot,
): CombatActionDef[] {
  return snapshot.combatActions
    .map(toAuthoredCombatActionDef)
    .sort((a, b) => a.order - b.order);
}

export function cloneCombatActionDefs(
  actions: readonly CombatActionDef[],
): CombatActionDef[] {
  return actions.map(cloneCombatActionDef);
}

/**
 * Swaps the authored draft actions into a catalog snapshot for the whole-bundle
 * audit. Combat actions contribute no ids and reference nothing, so the
 * validation context needs no substitution.
 */
export function createActionDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftActions: readonly CombatActionDef[],
): ContentCatalogSnapshot {
  return {
    ...snapshot,
    combatActions: cloneCombatActionDefs(draftActions),
  };
}

export function serializeCombatActionDef(def: CombatActionDef): string {
  return JSON.stringify(def, null, 2);
}

export function serializeActionsById(
  actions: readonly CombatActionDef[],
): Map<string, string> {
  return new Map(
    actions.map((action) => [action.actionId, serializeCombatActionDef(action)]),
  );
}

export function updateActionDef(
  actions: readonly CombatActionDef[],
  actionId: string,
  updater: (action: CombatActionDef) => CombatActionDef,
): CombatActionDef[] {
  return actions.map((action) =>
    action.actionId === actionId
      ? cloneCombatActionDef(updater(cloneCombatActionDef(action)))
      : cloneCombatActionDef(action),
  );
}

/** Sets or clears one numeric tuning field, dropping `tuning` when it empties. */
export function setActionTuning(
  action: CombatActionDef,
  field: keyof CombatActionTuning,
  value: number | undefined,
): CombatActionDef {
  const next = cloneCombatActionDef(action);
  const tuning: CombatActionTuning = { ...(next.tuning ?? {}) };
  if (value === undefined) {
    delete tuning[field];
  } else {
    tuning[field] = value;
  }
  next.tuning = Object.keys(tuning).length > 0 ? tuning : undefined;
  return next;
}

export function addActionLine(
  action: CombatActionDef,
  field: ActionLineField,
): CombatActionDef {
  const next = cloneCombatActionDef(action);
  next[field] = [...next[field], ""];
  return next;
}

export function updateActionLine(
  action: CombatActionDef,
  field: ActionLineField,
  index: number,
  value: string,
): CombatActionDef {
  const next = cloneCombatActionDef(action);
  if (index < 0 || index >= next[field].length) {
    return next;
  }
  next[field] = next[field].map((line, lineIndex) =>
    lineIndex === index ? value : line,
  );
  return next;
}

export function removeActionLine(
  action: CombatActionDef,
  field: ActionLineField,
  index: number,
): CombatActionDef {
  const next = cloneCombatActionDef(action);
  next[field] = next[field].filter((_, lineIndex) => lineIndex !== index);
  return next;
}

/** The tuning-derived preview lines for an action's current tuning. */
export function actionDerivedEffects(action: CombatActionDef): string[] {
  return action.tuning ? deriveCombatActionEffects(action.tuning) : [];
}
