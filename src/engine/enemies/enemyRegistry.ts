import { hasItemDef } from "../items/itemRegistry";
import { hasNpcDef } from "../npcs/npcRegistry";
import type {
  EnemyDef,
  EnemyDefMap,
  EnemyLootEntry,
  EnemyStatsData,
} from "./EnemyDef";

const enemyDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/enemies/*.json", {
    eager: true,
    import: "default",
  }),
);

const registry = buildRegistry(enemyDefs);

export function hasEnemyDef(npcId: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, npcId);
}

export function isCombatEnemy(npcId: string): boolean {
  return registry[npcId]?.combatable === true;
}

export function getEnemyDef(npcId: string): EnemyDef | undefined {
  const def = registry[npcId];
  return def ? cloneEnemyDef(def) : undefined;
}

export function getAllEnemyDefs(): EnemyDef[] {
  return Object.values(registry).map(cloneEnemyDef);
}

function buildRegistry(defs: unknown[]): EnemyDefMap {
  const nextRegistry: EnemyDefMap = {};

  for (const def of defs) {
    assertEnemyDef(def);

    if (nextRegistry[def.npcId]) {
      throw new Error(`Duplicate enemy definition "${def.npcId}".`);
    }

    nextRegistry[def.npcId] = cloneEnemyDef(def);
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

function assertEnemyDef(value: unknown): asserts value is EnemyDef {
  if (!isRecord(value)) {
    throw new Error("Enemy definition must be an object.");
  }

  if (typeof value.npcId !== "string" || !value.npcId.trim()) {
    throw new Error("Enemy definition has invalid or missing npcId.");
  }

  if (!hasNpcDef(value.npcId)) {
    throw new Error(
      `Enemy definition references unknown npcId "${value.npcId}".`,
    );
  }

  if (typeof value.combatable !== "boolean") {
    throw new Error(
      `Enemy definition "${value.npcId}" has invalid combatable flag.`,
    );
  }

  assertEnemyStats(value.stats, value.npcId);
  assertLoot(value.loot, value.npcId);
}

function assertEnemyStats(
  value: unknown,
  npcId: string,
): asserts value is EnemyStatsData {
  if (!isRecord(value)) {
    throw new Error(`Enemy definition "${npcId}" has invalid stats.`);
  }

  assertNumberSection(value.resources, npcId, "resources", [
    "hp",
    "maxHp",
    "mp",
    "maxMp",
    "sp",
    "maxSp",
    "energy",
    "maxEnergy",
  ]);
  assertNumberSection(value.attributes, npcId, "attributes", [
    "strength",
    "vitality",
    "agility",
    "intelligence",
    "spirit",
    "willpower",
    "perception",
    "charisma",
  ]);
  assertNumberSection(value.combat, npcId, "combat", [
    "attack",
    "magicAttack",
    "defense",
    "magicDefense",
  ]);
  assertNumberSection(value.skills, npcId, "skills", [
    "melee",
    "ranged",
    "guard",
    "evasion",
    "spellcasting",
    "focus",
    "athletics",
    "scholarship",
    "speech",
  ]);

  if (!isRecord(value.progression)) {
    throw new Error(
      `Enemy definition "${npcId}" has invalid progression stats.`,
    );
  }
  if (
    typeof value.progression.academicTitle !== "string" ||
    !value.progression.academicTitle.trim()
  ) {
    throw new Error(
      `Enemy definition "${npcId}" has invalid progression.academicTitle.`,
    );
  }
  if (
    typeof value.progression.academicProgress !== "number" ||
    !Number.isFinite(value.progression.academicProgress)
  ) {
    throw new Error(
      `Enemy definition "${npcId}" has invalid progression.academicProgress.`,
    );
  }

  if (value.conditions !== undefined) {
    if (!Array.isArray(value.conditions)) {
      throw new Error(`Enemy definition "${npcId}" has invalid conditions.`);
    }

    for (const condition of value.conditions) {
      if (!isRecord(condition)) {
        throw new Error(`Enemy definition "${npcId}" has invalid condition.`);
      }
      if (typeof condition.id !== "string" || !condition.id.trim()) {
        throw new Error(
          `Enemy definition "${npcId}" has a condition with invalid id.`,
        );
      }
      if (typeof condition.name !== "string" || !condition.name.trim()) {
        throw new Error(
          `Enemy definition "${npcId}" has a condition with invalid name.`,
        );
      }
      if (
        condition.durationInTicks !== undefined &&
        (typeof condition.durationInTicks !== "number" ||
          !Number.isInteger(condition.durationInTicks) ||
          condition.durationInTicks < 0)
      ) {
        throw new Error(
          `Enemy definition "${npcId}" has invalid condition durationInTicks.`,
        );
      }
    }
  }
}

function assertNumberSection(
  value: unknown,
  npcId: string,
  sectionName: string,
  requiredKeys: string[],
): void {
  if (!isRecord(value)) {
    throw new Error(
      `Enemy definition "${npcId}" has invalid ${sectionName} stats.`,
    );
  }

  for (const key of requiredKeys) {
    const statValue = value[key];
    if (typeof statValue !== "number" || !Number.isFinite(statValue)) {
      throw new Error(
        `Enemy definition "${npcId}" has invalid ${sectionName}.${key}.`,
      );
    }
  }
}

function assertLoot(
  value: unknown,
  npcId: string,
): asserts value is EnemyLootEntry[] {
  if (!Array.isArray(value)) {
    throw new Error(`Enemy definition "${npcId}" has invalid loot.`);
  }

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    if (!isRecord(entry)) {
      throw new Error(
        `Enemy definition "${npcId}" loot entry ${i} must be an object.`,
      );
    }
    if (typeof entry.itemId !== "string" || !hasItemDef(entry.itemId)) {
      throw new Error(
        `Enemy definition "${npcId}" loot entry ${i} references unknown itemId "${entry.itemId}".`,
      );
    }
    if (
      typeof entry.quantity !== "number" ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity <= 0
    ) {
      throw new Error(
        `Enemy definition "${npcId}" loot entry ${i} has invalid quantity.`,
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
