import type { GameSaveData } from "../../engine/GameSaveData";
import { SAVE_VERSION } from "../../engine/GameSaveData";

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

function isSaveStats(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isRecord(value.attributes)) return false;

  return (
    value.type === "Stats" &&
    isFiniteNumber(value.energy) &&
    isFiniteNumber(value.maxEnergy) &&
    isFiniteNumber(value.currency) &&
    isFiniteNumber(value.attributes.strength) &&
    isFiniteNumber(value.attributes.intelligence) &&
    isFiniteNumber(value.attributes.charisma) &&
    typeof value.academicTitle === "string" &&
    isFiniteNumber(value.academicProgress)
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
    value.items.every(isInventoryStack)
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
    isSaveInventory(obj.inventory) &&
    Array.isArray(obj.npcStates) &&
    obj.npcStates.every(isSaveNpcState) &&
    Array.isArray(obj.log) &&
    obj.log.every(isSaveLogEntry) &&
    Array.isArray(obj.pickedUpItemSpawnKeys) &&
    obj.pickedUpItemSpawnKeys.every((key) => typeof key === "string")
  );
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
    if (!isGameSaveData(parsed)) return null;

    return parsed;
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
