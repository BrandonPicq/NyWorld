import type {
  CombatActionCategory,
  CombatActionDef,
  CombatActionDefMap,
  CombatActionId,
} from "./CombatActionDef";

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

function buildRegistry(defs: unknown[]): CombatActionDefMap {
  const nextRegistry = {} as CombatActionDefMap;

  for (const def of defs) {
    assertCombatActionDef(def);

    if (nextRegistry[def.actionId]) {
      throw new Error(`Duplicate combat action definition "${def.actionId}".`);
    }

    nextRegistry[def.actionId] = cloneCombatActionDef(def);
  }

  return nextRegistry;
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
  };
}

function assertCombatActionDef(value: unknown): asserts value is CombatActionDef {
  if (!isRecord(value)) {
    throw new Error("Combat action definition must be an object.");
  }

  if (!isCombatActionId(value.actionId)) {
    throw new Error("Combat action definition has invalid or missing actionId.");
  }

  assertNonEmptyString(value.name, value.actionId, "name");
  assertCombatActionCategory(value.category, value.actionId);

  if (
    typeof value.order !== "number" ||
    !Number.isInteger(value.order) ||
    value.order < 0
  ) {
    throw new Error(
      `Combat action definition "${value.actionId}" has invalid order.`,
    );
  }

  assertNonEmptyString(value.summary, value.actionId, "summary");
  assertNonEmptyString(value.formula, value.actionId, "formula");
  assertNonEmptyStringArray(value.effects, value.actionId, "effects");
  assertNonEmptyStringArray(value.details, value.actionId, "details");
}

function assertCombatActionCategory(
  value: unknown,
  actionId: CombatActionId,
): asserts value is CombatActionCategory {
  if (value !== "offense" && value !== "defense" && value !== "utility") {
    throw new Error(
      `Combat action definition "${actionId}" has invalid category.`,
    );
  }
}

function assertNonEmptyString(
  value: unknown,
  actionId: CombatActionId,
  key: string,
): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `Combat action definition "${actionId}" has invalid ${key}.`,
    );
  }
}

function assertNonEmptyStringArray(
  value: unknown,
  actionId: CombatActionId,
  key: string,
): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `Combat action definition "${actionId}" has invalid ${key}.`,
    );
  }

  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new Error(
        `Combat action definition "${actionId}" has invalid ${key} entry.`,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
