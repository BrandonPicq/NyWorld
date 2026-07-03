import type { Stats } from "../components";
import { getEnemyDef } from "../enemies/enemyRegistry";

export function createNpcStats(npcId: string): Stats {
  const enemyDef = getEnemyDef(npcId);
  if (!enemyDef) {
    throw new Error(`Cannot create combat stats for unknown enemy "${npcId}".`);
  }

  return {
    type: "Stats",
    currency: 0,
    resources: { ...enemyDef.stats.resources },
    attributes: { ...enemyDef.stats.attributes },
    combat: { ...enemyDef.stats.combat },
    skills: { ...enemyDef.stats.skills },
    progression: { ...enemyDef.stats.progression },
    conditions: enemyDef.stats.conditions
      ? enemyDef.stats.conditions.map((condition) => ({ ...condition }))
      : [],
  };
}
