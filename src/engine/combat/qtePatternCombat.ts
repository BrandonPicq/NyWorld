import type { CombatActionCommand } from "../commands";
import type { Inventory, Stats } from "../components";
import type { EquipmentWeaponType } from "../classes/ClassDef";
import { getItemDef } from "../items/itemRegistry";
import type { KnownPatternMap, PatternDef } from "./PatternDef";
import { getAllQtePatternDefs } from "./qtePatternRegistry";

export interface CombatPatternOption {
  pattern: PatternDef;
  disabled: boolean;
  availabilityNote?: string;
}

export function getCombatPatternOptions(input: {
  actionKind: Extract<CombatActionCommand, "strike" | "cast">;
  knownPatterns: KnownPatternMap;
  inventory: Inventory;
  playerStats: Stats;
}): CombatPatternOption[] {
  const requiredKind = input.actionKind === "cast" ? "magical" : "physical";
  const equippedWeaponType = getEquippedWeaponType(input.inventory);

  return getAllQtePatternDefs()
    .filter((pattern) => input.knownPatterns[pattern.patternId])
    .filter((pattern) => pattern.kind === requiredKind)
    .filter((pattern) =>
      isPatternWeaponCompatible(pattern, equippedWeaponType),
    )
    .map((pattern) => {
      const disabled = input.playerStats.resources.mp < pattern.mpCost;
      return {
        pattern,
        disabled,
        availabilityNote: disabled ? "Not enough MP." : undefined,
      };
    })
    .sort((a, b) => a.pattern.patternId.localeCompare(b.pattern.patternId));
}

export function canUseCombatPattern(input: {
  actionKind: Extract<CombatActionCommand, "strike" | "cast">;
  pattern: PatternDef;
  knownPatterns: KnownPatternMap;
  inventory: Inventory;
  playerStats: Stats;
}): boolean {
  return getCombatPatternOptions(input).some(
    (option) =>
      option.pattern.patternId === input.pattern.patternId && !option.disabled,
  );
}

function getEquippedWeaponType(
  inventory: Inventory,
): EquipmentWeaponType | undefined {
  const weaponId = inventory.equipped.weapon;
  if (!weaponId) return undefined;
  return getItemDef(weaponId).equipment?.weaponType;
}

function isPatternWeaponCompatible(
  pattern: PatternDef,
  weaponType: EquipmentWeaponType | undefined,
): boolean {
  if (!pattern.requiredWeaponTypes || pattern.requiredWeaponTypes.length === 0) {
    return true;
  }
  return weaponType ? pattern.requiredWeaponTypes.includes(weaponType) : false;
}
