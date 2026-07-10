import { getClassDef } from "../classes/classRegistry";
import { EQUIPPED_SLOT_IDS, type EquippedSlot, type Inventory, type Stats } from "../components";
import type { NewGameConfig } from "../content/contentBundle";
import { canEquipInSlot } from "../items/equipmentRules";
import type { EquipmentBonusMap } from "../items/ItemDef";
import { getItemDef } from "../items/itemRegistry";
import {
  getCommandMasteryDef,
  hasCommandMasteryDef,
} from "../mastery/commandMasteryRegistry";
import { getRaceDef } from "../races/raceRegistry";
import {
  cloneStats,
  createInitialStats,
} from "./characterStats";
import {
  getClassLevelUpMessage,
  getGlobalLevelUpMessage,
} from "./levelUpHelper";
import {
  applyLayeredStats,
  applyXpAwardToProgression,
  cloneLayeredStatBreakdown,
  clonePlayerProgressionState,
  createInitialPlayerProgression,
  deriveLayeredStats,
  ensureCommandMasteries,
  normalizeProgressionBuffers,
  subtractAttributeValues,
  type CoreAttributeKey,
  type LayeredStatBreakdown,
  type PlayerProgressionState,
  type XpAwardResult,
} from "./layeredStats";

export type CharacterCommandResult = { success: boolean };

type CharacterNotice = {
  title: string;
  message: string;
};

type PlayerCharacterRuntimeOptions = {
  newGame?: NewGameConfig;
  raceId?: string;
  addLog: (message: string) => void;
  addNotice: (notice: CharacterNotice) => void;
};

/**
 * Owns mutable player progression, equipment, and layered-stat recalculation.
 *
 * ECS components remain the live combat and inventory values. This runtime
 * owns the authored base values and long-lived progression state used to
 * derive those components.
 */
export class PlayerCharacterRuntime {
  private baseStats: Stats;
  private progression: PlayerProgressionState;
  private statLayers: LayeredStatBreakdown;

  constructor(private readonly options: PlayerCharacterRuntimeOptions) {
    this.baseStats = createInitialStats(options.newGame);
    this.progression = createInitialPlayerProgression({ raceId: options.raceId });
    this.statLayers = this.rebuildStatLayers(this.baseStats);
  }

  initialize(stats: Stats, inventory: Inventory): void {
    this.applyTo(stats, inventory);
  }

  /** Creates a detached base-stat component for the player ECS entity. */
  createPlayerStats(): Stats {
    return cloneStats(this.baseStats);
  }

  /** Restores mutable character state while preserving the base-stat model. */
  restore(
    savedStats: Stats,
    savedProgression: PlayerProgressionState,
    stats: Stats,
    inventory: Inventory,
  ): void {
    this.progression = clonePlayerProgressionState(savedProgression);
    this.baseStats = cloneStats(savedStats);

    const savedBreakdown = this.rebuildStatLayers(this.baseStats, inventory);
    this.baseStats.attributes = subtractAttributeValues(
      savedStats.attributes,
      savedBreakdown.globalAttributes,
      savedBreakdown.classAttributes,
      savedBreakdown.equipmentAttributes,
    );
    this.baseStats.resources.maxEnergy = Math.max(
      0,
      savedStats.resources.maxEnergy - savedBreakdown.equipmentResources.maxEnergy,
    );

    stats.resources = { ...savedStats.resources };
    stats.currency = savedStats.currency;
    stats.attributes = { ...this.baseStats.attributes };
    stats.combat = { ...savedStats.combat };
    stats.skills = { ...savedStats.skills };
    stats.progression = { ...savedStats.progression };
    stats.conditions = savedStats.conditions.map((condition) => ({ ...condition }));
    this.baseStats.skills = { ...stats.skills };
    this.baseStats.progression = { ...stats.progression };
    this.baseStats.conditions = stats.conditions.map((condition) => ({ ...condition }));
    this.applyTo(stats, inventory);
  }

  getProgression(): PlayerProgressionState {
    return clonePlayerProgressionState(this.progression);
  }

  getStatLayers(): LayeredStatBreakdown {
    return cloneLayeredStatBreakdown(this.statLayers);
  }

  getGlobalLevel(): number {
    return this.progression.global.level;
  }

  getCommandMasteryLevel(commandId: string): number {
    return this.progression.masteries?.[commandId]?.level ?? 0;
  }

  equip(
    itemId: string,
    requestedSlot: EquippedSlot | undefined,
    stats: Stats,
    inventory: Inventory,
  ): CharacterCommandResult {
    const stack = inventory.items.find((item) => item.itemId === itemId);
    if (!stack) {
      return this.rejectEquip("You don't have that item.");
    }

    const itemDef = getItemDef(itemId);
    const equipment = itemDef.equipment;
    if (itemDef.category !== "equipment" || !equipment) {
      return this.rejectEquip(`${itemDef.name} cannot be equipped.`);
    }

    const targetSlot = this.resolveEquippedSlot(equipment.slot, requestedSlot, inventory);
    if (!targetSlot) {
      return this.rejectEquip(`${itemDef.name} cannot be assigned to that slot.`);
    }

    const classDef = getClassDef(this.progression.classId);
    if (!canEquipInSlot(equipment, targetSlot, classDef.equipmentPermissions)) {
      return this.rejectEquip(`${classDef.name} cannot equip ${itemDef.name}.`);
    }

    if (this.countEquippedCopies(inventory, itemId, targetSlot) >= stack.quantity) {
      return this.rejectEquip(`No unequipped copies of ${itemDef.name} remain.`);
    }

    inventory.equipped[targetSlot] = itemId;
    this.applyTo(stats, inventory);
    this.options.addLog(`Equipped ${itemDef.name}.`);
    return { success: true };
  }

  unequip(slot: EquippedSlot, stats: Stats, inventory: Inventory): CharacterCommandResult {
    const itemId = inventory.equipped[slot];
    if (!itemId) {
      this.options.addLog("Nothing is equipped there.");
      return { success: false };
    }

    delete inventory.equipped[slot];
    this.applyTo(stats, inventory);
    this.options.addLog(`Unequipped ${getItemDef(itemId).name}.`);
    return { success: true };
  }

  chooseAttribute(
    attribute: CoreAttributeKey,
    stats: Stats,
    inventory: Inventory,
  ): CharacterCommandResult {
    if (!(attribute in this.baseStats.attributes)) return { success: false };

    if (this.progression.pendingAttributeChoices <= 0) {
      const message = "No attribute choices are available.";
      this.options.addLog(message);
      this.options.addNotice({ title: "No Attribute Choice", message });
      return { success: false };
    }

    this.progression.pendingAttributeChoices -= 1;
    this.baseStats.attributes[attribute] += 1;
    this.applyTo(stats, inventory);
    this.options.addLog(`${formatAttributeName(attribute)} +1.`);
    return { success: true };
  }

  awardXp(amount: number, source: string, stats: Stats, inventory: Inventory): XpAwardResult {
    const { progression, result } = applyXpAwardToProgression(this.progression, amount);
    this.progression = progression;
    if (result.amount <= 0) return result;

    this.options.addLog(`Gained ${result.amount} XP from ${source}.`);
    this.applyTo(stats, inventory);

    const raceDef = getRaceDef(this.progression.raceId);
    const classDef = getClassDef(this.progression.classId);
    for (const level of result.globalLevelsGained) {
      const message = getGlobalLevelUpMessage(level, raceDef);
      this.options.addLog(message);
      this.options.addNotice({ title: "Global Level Up", message });
    }
    for (const levelUp of result.classLevelsGained) {
      const message = getClassLevelUpMessage(levelUp.level, classDef, raceDef);
      this.options.addLog(message);
      this.options.addNotice({ title: "Class Level Up", message });
    }
    if (result.attributeChoicesGained > 0) {
      const message = result.attributeChoicesGained === 1
        ? "Choose +1 base attribute from the character sheet."
        : `Choose ${result.attributeChoicesGained} base attributes from the character sheet.`;
      this.options.addNotice({ title: "Attribute Choice Available", message });
    }
    return result;
  }

  incrementCommandUsage(commandId: string, inventory: Inventory): void {
    this.progression.masteries = ensureCommandMasteries(this.progression.masteries);
    const state = this.progression.masteries[commandId];
    if (!state || !hasCommandMasteryDef(commandId)) return;

    const def = getCommandMasteryDef(commandId);
    if (state.level >= def.cap) return;

    state.usage += 1;
    if (state.usage >= def.usageRequired) {
      state.usage = 0;
      state.level += 1;
      const message = `Your mastery of ${def.name} has increased to level ${state.level}!`;
      this.options.addLog(message);
      this.options.addNotice({ title: "Command Mastery Up", message });
    }

    this.statLayers = this.rebuildStatLayers(this.baseStats, inventory);
  }

  increaseBaseAttribute(attribute: CoreAttributeKey, amount: number): void {
    this.baseStats.attributes[attribute] += amount;
  }

  applyTo(stats: Stats, inventory?: Inventory): void {
    this.statLayers = this.rebuildStatLayers(this.baseStats, inventory);
    applyLayeredStats(stats, this.statLayers);
    this.progression = normalizeProgressionBuffers(this.progression, this.statLayers);
  }

  private rejectEquip(message: string): CharacterCommandResult {
    this.options.addLog(message);
    this.options.addNotice({ title: "Cannot Equip", message });
    return { success: false };
  }

  private rebuildStatLayers(baseStats: Stats, inventory?: Inventory): LayeredStatBreakdown {
    return deriveLayeredStats({
      baseStats,
      progression: this.progression,
      classDef: getClassDef(this.progression.classId),
      raceDef: getRaceDef(this.progression.raceId),
      equipmentBonuses: inventory ? this.getEquippedEquipmentBonuses(inventory) : {},
    });
  }

  private getEquippedEquipmentBonuses(inventory: Inventory): EquipmentBonusMap {
    const totals: EquipmentBonusMap = {};
    for (const slot of EQUIPPED_SLOT_IDS) {
      const itemId = inventory.equipped[slot];
      if (!itemId) continue;
      const equipment = getItemDef(itemId).equipment;
      if (!equipment) continue;
      for (const [key, value] of Object.entries(equipment.bonuses)) {
        totals[key as keyof EquipmentBonusMap] =
          (totals[key as keyof EquipmentBonusMap] ?? 0) + (value ?? 0);
      }
    }
    return totals;
  }

  private resolveEquippedSlot(
    equipmentSlot: string,
    requestedSlot: EquippedSlot | undefined,
    inventory: Inventory,
  ): EquippedSlot | undefined {
    if (equipmentSlot === "accessory") {
      if (requestedSlot === "accessory1" || requestedSlot === "accessory2") {
        return requestedSlot;
      }
      if (requestedSlot) return undefined;
      return inventory.equipped.accessory1 ? "accessory2" : "accessory1";
    }

    if (requestedSlot && requestedSlot !== equipmentSlot) return undefined;
    return EQUIPPED_SLOT_IDS.includes(equipmentSlot as EquippedSlot)
      ? (equipmentSlot as EquippedSlot)
      : undefined;
  }

  private countEquippedCopies(
    inventory: Inventory,
    itemId: string,
    exceptSlot?: EquippedSlot,
  ): number {
    return EQUIPPED_SLOT_IDS.reduce((count, slot) => {
      if (slot === exceptSlot) return count;
      return inventory.equipped[slot] === itemId ? count + 1 : count;
    }, 0);
  }
}

function formatAttributeName(attribute: string): string {
  return attribute
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase());
}
