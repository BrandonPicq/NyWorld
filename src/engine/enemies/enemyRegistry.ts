import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import type { ContentValidationContext } from "../content/ContentValidationContext";
import { getAllItemIds } from "../items/itemRegistry";
import { getAllNpcDefs } from "../npcs/npcRegistry";
import type {
  EnemyDef,
  EnemyDefMap,
  EnemyStatsData,
} from "./EnemyDef";

const ENEMY_CONTENT_TYPE = CONTENT_TYPES.enemy;

/**
 * Catalog subset that enemy definition validation checks references against.
 */
export type EnemyValidationContext = Pick<
  ContentValidationContext,
  "npcIds" | "itemIds"
>;

const RESOURCE_KEYS = [
  "hp",
  "maxHp",
  "mp",
  "maxMp",
  "sp",
  "maxSp",
  "energy",
  "maxEnergy",
];
const ATTRIBUTE_KEYS = [
  "strength",
  "vitality",
  "agility",
  "intelligence",
  "spirit",
  "willpower",
  "perception",
  "charisma",
];
const COMBAT_KEYS = ["attack", "magicAttack", "defense", "magicDefense"];
const SKILL_KEYS = [
  "melee",
  "ranged",
  "guard",
  "evasion",
  "spellcasting",
  "focus",
  "athletics",
  "scholarship",
  "speech",
];

const enemyDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/enemies/*.json", {
    eager: true,
    import: "default",
  }),
);

let overlayRegistry: EnemyDefMap | null = null;

const registry = buildRegistry(enemyDefs);

export function hasEnemyDef(npcId: string): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), npcId);
}

export function isCombatEnemy(npcId: string): boolean {
  return getActiveRegistry()[npcId]?.combatable === true;
}

export function getEnemyDef(npcId: string): EnemyDef | undefined {
  const def = getActiveRegistry()[npcId];
  return def ? cloneEnemyDef(def) : undefined;
}

export function getAllEnemyDefs(): EnemyDef[] {
  return Object.values(getActiveRegistry()).map(cloneEnemyDef);
}

export function installEnemyContentOverlay(defs: readonly EnemyDef[]): void {
  if (!import.meta.env.DEV) return;
  overlayRegistry = buildRegistry(defs);
}

export function clearEnemyContentOverlay(): void {
  overlayRegistry = null;
}

function getActiveRegistry(): EnemyDefMap {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearEnemyContentOverlay);
}

/**
 * Validates one enemy definition against an explicit content context.
 */
export function validateEnemyDef(
  value: unknown,
  context: EnemyValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addEnemyError(
      diagnostics,
      undefined,
      "$",
      "Enemy definition must be an object.",
    );
    return diagnostics;
  }

  const npcId =
    typeof value.npcId === "string" && value.npcId.trim()
      ? value.npcId
      : undefined;

  if (!npcId) {
    addEnemyError(
      diagnostics,
      undefined,
      "npcId",
      "Enemy definition has invalid or missing npcId.",
    );
  } else if (!context.npcIds.has(npcId)) {
    addEnemyError(
      diagnostics,
      npcId,
      "npcId",
      `Enemy definition references unknown npcId "${npcId}".`,
    );
  }

  const npcLabel = npcId ?? "unknown";

  if (typeof value.combatable !== "boolean") {
    addEnemyError(
      diagnostics,
      npcId,
      "combatable",
      `Enemy definition "${npcLabel}" has invalid combatable flag.`,
    );
  }

  if (
    value.xpReward !== undefined &&
    (typeof value.xpReward !== "number" ||
      !Number.isInteger(value.xpReward) ||
      value.xpReward < 0)
  ) {
    addEnemyError(
      diagnostics,
      npcId,
      "xpReward",
      `Enemy definition "${npcLabel}" has invalid xpReward. Expected a non-negative integer.`,
    );
  }

  validateEnemyStats(value.stats, npcId, npcLabel, diagnostics);
  validateLoot(value.loot, npcId, npcLabel, context, diagnostics);

  return diagnostics;
}

/**
 * Validates a full enemy registry, adding duplicate-id checks on top of
 * per-def validation.
 */
export function validateEnemyRegistry(
  defs: readonly unknown[],
  context: EnemyValidationContext,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const seenIds = new Set<string>();

  for (const def of defs) {
    diagnostics.push(...validateEnemyDef(def, context));

    if (!isRecord(def) || typeof def.npcId !== "string" || !def.npcId.trim()) {
      continue;
    }

    if (seenIds.has(def.npcId)) {
      addEnemyError(
        diagnostics,
        def.npcId,
        "npcId",
        `Duplicate enemy definition "${def.npcId}".`,
      );
    } else {
      seenIds.add(def.npcId);
    }
  }

  return diagnostics;
}

function validateEnemyStats(
  value: unknown,
  npcId: string | undefined,
  npcLabel: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addEnemyError(
      diagnostics,
      npcId,
      "stats",
      `Enemy definition "${npcLabel}" has invalid stats.`,
    );
    return;
  }

  validateNumberSection(
    value.resources,
    npcId,
    npcLabel,
    "resources",
    RESOURCE_KEYS,
    diagnostics,
  );
  validateNumberSection(
    value.attributes,
    npcId,
    npcLabel,
    "attributes",
    ATTRIBUTE_KEYS,
    diagnostics,
  );
  validateNumberSection(
    value.combat,
    npcId,
    npcLabel,
    "combat",
    COMBAT_KEYS,
    diagnostics,
  );
  validateNumberSection(
    value.skills,
    npcId,
    npcLabel,
    "skills",
    SKILL_KEYS,
    diagnostics,
  );

  if (!isRecord(value.progression)) {
    addEnemyError(
      diagnostics,
      npcId,
      "stats.progression",
      `Enemy definition "${npcLabel}" has invalid progression stats.`,
    );
  } else {
    if (
      typeof value.progression.academicTitle !== "string" ||
      !value.progression.academicTitle.trim()
    ) {
      addEnemyError(
        diagnostics,
        npcId,
        "stats.progression.academicTitle",
        `Enemy definition "${npcLabel}" has invalid progression.academicTitle.`,
      );
    }
    if (
      typeof value.progression.academicProgress !== "number" ||
      !Number.isFinite(value.progression.academicProgress)
    ) {
      addEnemyError(
        diagnostics,
        npcId,
        "stats.progression.academicProgress",
        `Enemy definition "${npcLabel}" has invalid progression.academicProgress.`,
      );
    }
  }

  if (value.conditions !== undefined) {
    validateConditions(value.conditions, npcId, npcLabel, diagnostics);
  }
}

function validateConditions(
  value: unknown,
  npcId: string | undefined,
  npcLabel: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    addEnemyError(
      diagnostics,
      npcId,
      "stats.conditions",
      `Enemy definition "${npcLabel}" has invalid conditions.`,
    );
    return;
  }

  for (let i = 0; i < value.length; i++) {
    const condition = value[i];
    const path = `stats.conditions[${i}]`;

    if (!isRecord(condition)) {
      addEnemyError(
        diagnostics,
        npcId,
        path,
        `Enemy definition "${npcLabel}" condition ${i} must be an object.`,
      );
      continue;
    }

    if (typeof condition.id !== "string" || !condition.id.trim()) {
      addEnemyError(
        diagnostics,
        npcId,
        `${path}.id`,
        `Enemy definition "${npcLabel}" has a condition with invalid id.`,
      );
    }
    if (typeof condition.name !== "string" || !condition.name.trim()) {
      addEnemyError(
        diagnostics,
        npcId,
        `${path}.name`,
        `Enemy definition "${npcLabel}" has a condition with invalid name.`,
      );
    }
    if (
      condition.durationInTicks !== undefined &&
      (typeof condition.durationInTicks !== "number" ||
        !Number.isInteger(condition.durationInTicks) ||
        condition.durationInTicks < 0)
    ) {
      addEnemyError(
        diagnostics,
        npcId,
        `${path}.durationInTicks`,
        `Enemy definition "${npcLabel}" has invalid condition durationInTicks.`,
      );
    }
  }
}

function validateNumberSection(
  value: unknown,
  npcId: string | undefined,
  npcLabel: string,
  sectionName: string,
  requiredKeys: string[],
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addEnemyError(
      diagnostics,
      npcId,
      `stats.${sectionName}`,
      `Enemy definition "${npcLabel}" has invalid ${sectionName} stats.`,
    );
    return;
  }

  for (const key of requiredKeys) {
    const statValue = value[key];
    if (typeof statValue !== "number" || !Number.isFinite(statValue)) {
      addEnemyError(
        diagnostics,
        npcId,
        `stats.${sectionName}.${key}`,
        `Enemy definition "${npcLabel}" has invalid ${sectionName}.${key}.`,
      );
    }
  }
}

function validateLoot(
  value: unknown,
  npcId: string | undefined,
  npcLabel: string,
  context: EnemyValidationContext,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    addEnemyError(
      diagnostics,
      npcId,
      "loot",
      `Enemy definition "${npcLabel}" has invalid loot.`,
    );
    return;
  }

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    const path = `loot[${i}]`;

    if (!isRecord(entry)) {
      addEnemyError(
        diagnostics,
        npcId,
        path,
        `Enemy definition "${npcLabel}" loot entry ${i} must be an object.`,
      );
      continue;
    }

    if (
      typeof entry.itemId !== "string" ||
      !context.itemIds.has(entry.itemId)
    ) {
      addEnemyError(
        diagnostics,
        npcId,
        `${path}.itemId`,
        `Enemy definition "${npcLabel}" loot entry ${i} references unknown itemId "${entry.itemId}".`,
      );
    }
    if (
      typeof entry.quantity !== "number" ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity <= 0
    ) {
      addEnemyError(
        diagnostics,
        npcId,
        `${path}.quantity`,
        `Enemy definition "${npcLabel}" loot entry ${i} has invalid quantity.`,
      );
    }
  }
}

function buildRegistry(defs: readonly unknown[]): EnemyDefMap {
  const diagnostics = validateEnemyRegistry(defs, {
    npcIds: new Set(getAllNpcDefs().map((npc) => npc.npcId)),
    itemIds: new Set(getAllItemIds()),
  });
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  const nextRegistry: EnemyDefMap = {};
  for (const def of defs) {
    const enemyDef = def as EnemyDef;
    nextRegistry[enemyDef.npcId] = cloneEnemyDef(enemyDef);
  }

  return nextRegistry;
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function cloneEnemyDef(def: EnemyDef): EnemyDef {
  return {
    ...def,
    stats: cloneEnemyStats(def.stats),
    loot: def.loot.map((entry) => ({ ...entry })),
  };
}

export function cloneEnemyStats(stats: EnemyStatsData): EnemyStatsData {
  return {
    resources: { ...stats.resources },
    attributes: { ...stats.attributes },
    combat: { ...stats.combat },
    skills: { ...stats.skills },
    progression: { ...stats.progression },
    conditions: stats.conditions?.map((condition) => ({ ...condition })),
  };
}

function addEnemyError(
  diagnostics: ContentDiagnostic[],
  npcId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: ENEMY_CONTENT_TYPE,
    contentId: npcId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
