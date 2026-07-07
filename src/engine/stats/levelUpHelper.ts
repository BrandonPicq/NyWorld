import type { RaceDef } from "../races/RaceDef";
import type { ClassDef } from "../classes/ClassDef";
import {
  deriveGrowthLayer,
  GLOBAL_GROWTH_CYCLE,
  getGlobalXpToNext,
  getClassXpToNext,
  createAttributeValues,
} from "./layeredStats";

const ATTRIBUTES_ORDER = [
  "strength",
  "vitality",
  "agility",
  "intelligence",
  "spirit",
  "willpower",
  "perception",
  "charisma",
] as const;

export function getGlobalLevelUpMessage(level: number, raceDef: RaceDef): string {
  const prev = deriveGrowthLayer({
    level: level - 1,
    cycle: GLOBAL_GROWTH_CYCLE,
    raceDef,
  });
  const curr = deriveGrowthLayer({
    level,
    cycle: GLOBAL_GROWTH_CYCLE,
    raceDef,
  });

  const gains: string[] = [];
  for (const attr of ATTRIBUTES_ORDER) {
    const diff = curr.attributes[attr] - prev.attributes[attr];
    if (diff > 0) {
      gains.push(`+${diff} ${attr}`);
    }
  }

  const gainsStr = gains.length > 0 ? ` (${gains.join(", ")})` : "";
  const nextXp = getGlobalXpToNext(level);

  return `Global level ${level}!${gainsStr} — next at ${nextXp} XP`;
}

export function getClassLevelUpMessage(
  level: number,
  classDef: ClassDef,
  raceDef: RaceDef
): string {
  const cycle = classDef.growthCycle.map((entry) =>
    createAttributeValues(entry.attributes)
  );
  const prev = deriveGrowthLayer({
    level: level - 1,
    cycle,
    raceDef,
  });
  const curr = deriveGrowthLayer({
    level,
    cycle,
    raceDef,
  });

  const gains: string[] = [];
  for (const attr of ATTRIBUTES_ORDER) {
    const diff = curr.attributes[attr] - prev.attributes[attr];
    if (diff > 0) {
      gains.push(`+${diff} ${attr}`);
    }
  }

  const gainsStr = gains.length > 0 ? ` (${gains.join(", ")})` : "";
  const nextXp = getClassXpToNext(level);

  return `${classDef.name} reached level ${level}!${gainsStr} — next at ${nextXp} XP`;
}
