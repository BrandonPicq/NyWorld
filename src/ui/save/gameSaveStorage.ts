import type { GameSaveData } from "../../engine/GameSaveData";
import { SAVE_VERSION } from "../../engine/GameSaveData";
import { EQUIPPED_SLOT_IDS } from "../../engine/components";

export const SAVE_SLOT_COUNT = 3;

type GameSaveStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type UnknownRecord = Record<string, unknown>;

function slotKey(index: number): string {
  return `nywarudo_save_slot_${index}`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isDirection(value: unknown): boolean {
  return (
    value === "north" ||
    value === "east" ||
    value === "south" ||
    value === "west"
  );
}

function isOptionalNonEmptyString(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "string" && value.trim().length > 0)
  );
}

function isOptionalStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (entry) => typeof entry === "string" && entry.trim().length > 0,
      ))
  );
}

function isSaveStats(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isRecord(value.resources)) return false;
  if (!isRecord(value.attributes)) return false;
  if (!isRecord(value.combat)) return false;
  if (!isRecord(value.skills)) return false;
  if (!isRecord(value.progression)) return false;

  return (
    value.type === "Stats" &&
    isFiniteNumber(value.currency) &&
    isFiniteNumber(value.resources.hp) &&
    isFiniteNumber(value.resources.maxHp) &&
    isFiniteNumber(value.resources.mp) &&
    isFiniteNumber(value.resources.maxMp) &&
    isFiniteNumber(value.resources.sp) &&
    isFiniteNumber(value.resources.maxSp) &&
    isFiniteNumber(value.resources.energy) &&
    isFiniteNumber(value.resources.maxEnergy) &&
    isFiniteNumber(value.attributes.strength) &&
    isFiniteNumber(value.attributes.vitality) &&
    isFiniteNumber(value.attributes.agility) &&
    isFiniteNumber(value.attributes.intelligence) &&
    isFiniteNumber(value.attributes.spirit) &&
    isFiniteNumber(value.attributes.willpower) &&
    isFiniteNumber(value.attributes.perception) &&
    isFiniteNumber(value.attributes.charisma) &&
    isFiniteNumber(value.combat.attack) &&
    isFiniteNumber(value.combat.magicAttack) &&
    isFiniteNumber(value.combat.defense) &&
    isFiniteNumber(value.combat.magicDefense) &&
    isFiniteNumber(value.skills.melee) &&
    isFiniteNumber(value.skills.ranged) &&
    isFiniteNumber(value.skills.guard) &&
    isFiniteNumber(value.skills.evasion) &&
    isFiniteNumber(value.skills.spellcasting) &&
    isFiniteNumber(value.skills.focus) &&
    isFiniteNumber(value.skills.athletics) &&
    isFiniteNumber(value.skills.scholarship) &&
    isFiniteNumber(value.skills.speech) &&
    typeof value.progression.academicTitle === "string" &&
    isFiniteNumber(value.progression.academicProgress) &&
    Array.isArray(value.conditions) &&
    value.conditions.every(
      (condition) =>
        isRecord(condition) &&
        typeof condition.id === "string" &&
        typeof condition.name === "string" &&
        (condition.durationInTicks === undefined ||
          isFiniteNumber(condition.durationInTicks)),
    )
  );
}

function isAttributeBufferMap(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    isFiniteNumber(value.strength) &&
    isFiniteNumber(value.vitality) &&
    isFiniteNumber(value.agility) &&
    isFiniteNumber(value.intelligence) &&
    isFiniteNumber(value.spirit) &&
    isFiniteNumber(value.willpower) &&
    isFiniteNumber(value.perception) &&
    isFiniteNumber(value.charisma)
  );
}

function isProgressionRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isPositiveInteger(value.level) && isNonNegativeInteger(value.xp);
}

function isProgressionRecordMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isProgressionRecord);
}

function isAttributeBufferRecordMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isAttributeBufferMap);
}

function isPlayerProgressionState(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isRecord(value.buffers)) return false;

  return (
    isProgressionRecord(value.global) &&
    isProgressionRecordMap(value.classes) &&
    isAttributeBufferMap(value.buffers.global) &&
    isAttributeBufferRecordMap(value.buffers.classes) &&
    typeof value.classId === "string" &&
    value.classId.trim().length > 0 &&
    typeof value.raceId === "string" &&
    value.raceId.trim().length > 0 &&
    isNonNegativeInteger(value.pendingAttributeChoices)
  );
}

function isKnownPatternState(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isNonNegativeInteger(value.timesUsed);
}

function isKnownPatternMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([patternId, state]) =>
      patternId.trim().length > 0 && isKnownPatternState(state),
  );
}

function isInventoryStack(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    typeof value.itemId === "string" &&
    value.itemId.trim().length > 0 &&
    isPositiveInteger(value.quantity)
  );
}

function isSaveInventory(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    value.type === "Inventory" &&
    Array.isArray(value.items) &&
    value.items.every(isInventoryStack) &&
    isEquippedItems(value.equipped)
  );
}

function isEquippedItems(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const allowedSlots = new Set<string>(EQUIPPED_SLOT_IDS);
  return Object.entries(value).every(
    ([slot, itemId]) =>
      allowedSlots.has(slot) &&
      typeof itemId === "string" &&
      itemId.trim().length > 0,
  );
}

function isSaveLogEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    isNonNegativeInteger(value.tick) &&
    isNonNegativeInteger(value.worldTimeMinutes) &&
    typeof value.message === "string"
  );
}

function isSaveNpcState(value: unknown): boolean {
  if (!isRecord(value)) return false;

  return (
    typeof value.npcId === "string" &&
    value.npcId.trim().length > 0 &&
    isFiniteNumber(value.relationship) &&
    isPositiveInteger(value.progressionLevel) &&
    typeof value.currentRole === "string" &&
    value.currentRole.trim().length > 0 &&
    isOptionalNonEmptyString(value.currentDialogueId) &&
    Array.isArray(value.knownFlags) &&
    value.knownFlags.every((flag) => typeof flag === "string")
  );
}

function isGameSaveData(value: unknown): value is GameSaveData {
  if (!isRecord(value)) return false;
  const obj = value;

  return (
    obj.version === SAVE_VERSION &&
    typeof obj.savedAt === "string" &&
    !Number.isNaN(Date.parse(obj.savedAt)) &&
    typeof obj.zoneId === "string" &&
    obj.zoneId.trim().length > 0 &&
    isNonNegativeInteger(obj.tick) &&
    isNonNegativeInteger(obj.worldTimeMinutes) &&
    Number.isInteger(obj.playerX) &&
    Number.isInteger(obj.playerY) &&
    isDirection(obj.playerFacing) &&
    isSaveStats(obj.stats) &&
    isPlayerProgressionState(obj.playerProgression) &&
    isKnownPatternMap(obj.knownPatterns) &&
    isSaveInventory(obj.inventory) &&
    Array.isArray(obj.npcStates) &&
    obj.npcStates.every(isSaveNpcState) &&
    Array.isArray(obj.log) &&
    obj.log.every(isSaveLogEntry) &&
    Array.isArray(obj.pickedUpItemSpawnKeys) &&
    obj.pickedUpItemSpawnKeys.every((key) => typeof key === "string") &&
    isOptionalStringArray(obj.seenZoneEntryEventIds) &&
    isOptionalStringArray(obj.worldFlags) &&
    isOptionalStringArray(obj.firedEventIds) &&
    isOptionalStringNumberRecord(obj.eventCooldowns) &&
    isOptionalStringArray(obj.zoneVisitEventIds) &&
    Array.isArray(obj.activeQuests) &&
    obj.activeQuests.every((qId) => typeof qId === "string") &&
    Array.isArray(obj.completedQuests) &&
    obj.completedQuests.every((qId) => typeof qId === "string") &&
    Array.isArray(obj.completedObjectives) &&
    obj.completedObjectives.every((objId) => typeof objId === "string")
  );
}

function isOptionalStringNumberRecord(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([key, numberValue]) =>
      key.trim().length > 0 && isNonNegativeInteger(numberValue),
  );
}

function normalizeGameSaveData(value: unknown): GameSaveData | null {
  return isGameSaveData(value) ? value : null;
}

function isValidSlotIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < SAVE_SLOT_COUNT;
}

function getSaveStorage(): GameSaveStorage | undefined {
  if (typeof globalThis.localStorage === "undefined") {
    return undefined;
  }

  return globalThis.localStorage;
}

export function readAllSaves(): (GameSaveData | null)[] {
  const saves: (GameSaveData | null)[] = [];
  for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
    saves.push(readSlot(i));
  }
  return saves;
}

export function readSlot(index: number): GameSaveData | null {
  if (!isValidSlotIndex(index)) return null;

  try {
    const storage = getSaveStorage();
    if (!storage) return null;

    const raw = storage.getItem(slotKey(index));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return normalizeGameSaveData(parsed);
  } catch {
    return null;
  }
}

export function writeSlot(index: number, save: GameSaveData): boolean {
  if (!isValidSlotIndex(index)) return false;

  try {
    const storage = getSaveStorage();
    if (!storage) return false;

    storage.setItem(slotKey(index), JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function deleteSlot(index: number): void {
  if (!isValidSlotIndex(index)) return;

  try {
    getSaveStorage()?.removeItem(slotKey(index));
  } catch {
    // Save deletion is best-effort; invalid storage should not break the UI.
  }
}

export function hasAnySave(): boolean {
  for (let i = 0; i < SAVE_SLOT_COUNT; i++) {
    if (readSlot(i) !== null) return true;
  }
  return false;
}
