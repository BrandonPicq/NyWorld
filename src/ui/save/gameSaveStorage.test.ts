import { describe, expect, it, beforeEach } from "vitest";
import { SAVE_VERSION } from "../../engine/GameSaveData";
import type { GameSaveData } from "../../engine/GameSaveData";
import { START_WORLD_TIME_MINUTES } from "../../engine";
import {
  deleteSlot,
  hasAnySave,
  readAllSaves,
  readSlot,
  writeSlot,
} from "./gameSaveStorage";

function stubSave(overrides: Partial<GameSaveData> = {}): GameSaveData {
  return {
    version: SAVE_VERSION,
    savedAt: "2026-07-01T12:00:00.000Z",
    zoneId: "test_zone",
    tick: 42,
    worldTimeMinutes: START_WORLD_TIME_MINUTES,
    playerX: 5,
    playerY: 4,
    playerFacing: "south",
    stats: {
      type: "Stats",
      energy: 100,
      maxEnergy: 100,
      currency: 1550,
      attributes: { strength: 10, intelligence: 10, charisma: 10 },
      academicTitle: "Novice Scribe",
      academicProgress: 0,
    },
    inventory: {
      type: "Inventory",
      items: [{ itemId: "travel_ration", quantity: 3 }],
    },
    log: [
      {
        tick: 0,
        worldTimeMinutes: START_WORLD_TIME_MINUTES,
        message: "Entered Test Zone.",
      },
    ],
    pickedUpItemSpawnKeys: [],
    ...overrides,
  };
}

let store: Record<string, string>;

beforeEach(() => {
  store = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (_index: number) => null,
  };
});

describe("gameSaveStorage", () => {
  it("returns null for an empty slot", () => {
    expect(readSlot(0)).toBeNull();
  });

  it("writes and reads a save round-trip", () => {
    const save = stubSave();
    expect(writeSlot(0, save)).toBe(true);
    const restored = readSlot(0);

    expect(restored).not.toBeNull();
    expect(restored!.zoneId).toBe("test_zone");
    expect(restored!.tick).toBe(42);
    expect(restored!.worldTimeMinutes).toBe(START_WORLD_TIME_MINUTES);
    expect(restored!.playerX).toBe(5);
    expect(restored!.playerY).toBe(4);
    expect(restored!.playerFacing).toBe("south");
    expect(restored!.stats.energy).toBe(100);
    expect(restored!.inventory.items).toHaveLength(1);
    expect(restored!.pickedUpItemSpawnKeys).toEqual([]);
  });

  it("uses independent storage per slot", () => {
    expect(writeSlot(0, stubSave({ zoneId: "slot_0" }))).toBe(true);
    expect(writeSlot(1, stubSave({ zoneId: "slot_1" }))).toBe(true);

    expect(readSlot(0)?.zoneId).toBe("slot_0");
    expect(readSlot(1)?.zoneId).toBe("slot_1");
    expect(readSlot(2)).toBeNull();
  });

  it("returns false instead of throwing when storage write fails", () => {
    globalThis.localStorage = {
      ...globalThis.localStorage,
      setItem: () => {
        throw new Error("storage quota exceeded");
      },
    };

    expect(() => writeSlot(0, stubSave())).not.toThrow();
    expect(writeSlot(0, stubSave())).toBe(false);
  });

  it("returns false for invalid slot indexes", () => {
    expect(writeSlot(-1, stubSave())).toBe(false);
    expect(writeSlot(3, stubSave())).toBe(false);
  });

  it("returns null for invalid JSON", () => {
    localStorage.setItem("nywarudo_save_slot_0", "not-json");
    expect(readSlot(0)).toBeNull();
  });

  it("returns null for a save with a wrong version", () => {
    const save = stubSave();
    writeSlot(0, save);

    const raw = JSON.parse(localStorage.getItem("nywarudo_save_slot_0")!);
    raw.version = "0.99";
    localStorage.setItem("nywarudo_save_slot_0", JSON.stringify(raw));

    expect(readSlot(0)).toBeNull();
  });

  it("returns null for a save with missing fields", () => {
    writeSlot(0, stubSave());

    const raw = JSON.parse(localStorage.getItem("nywarudo_save_slot_0")!);
    delete (raw as Record<string, unknown>).zoneId;
    localStorage.setItem("nywarudo_save_slot_0", JSON.stringify(raw));

    expect(readSlot(0)).toBeNull();
  });

  it("returns null for a save with invalid world time", () => {
    writeSlot(0, stubSave());

    const raw = JSON.parse(localStorage.getItem("nywarudo_save_slot_0")!);
    raw.worldTimeMinutes = -1;
    localStorage.setItem("nywarudo_save_slot_0", JSON.stringify(raw));

    expect(readSlot(0)).toBeNull();
  });

  it("returns null for a save with invalid nested stats", () => {
    writeSlot(0, stubSave());

    const raw = JSON.parse(localStorage.getItem("nywarudo_save_slot_0")!);
    raw.stats = {};
    localStorage.setItem("nywarudo_save_slot_0", JSON.stringify(raw));

    expect(readSlot(0)).toBeNull();
  });

  it("returns null for a save with invalid log world time", () => {
    writeSlot(0, stubSave());

    const raw = JSON.parse(localStorage.getItem("nywarudo_save_slot_0")!);
    raw.log[0].worldTimeMinutes = "08:00";
    localStorage.setItem("nywarudo_save_slot_0", JSON.stringify(raw));

    expect(readSlot(0)).toBeNull();
  });

  it("returns null for a save with invalid inventory data", () => {
    writeSlot(0, stubSave());

    const raw = JSON.parse(localStorage.getItem("nywarudo_save_slot_0")!);
    raw.inventory = { type: "Inventory" };
    localStorage.setItem("nywarudo_save_slot_0", JSON.stringify(raw));

    expect(readSlot(0)).toBeNull();
  });

  it("returns null for a save with invalid inventory stack quantity", () => {
    writeSlot(0, stubSave());

    const raw = JSON.parse(localStorage.getItem("nywarudo_save_slot_0")!);
    raw.inventory.items[0].quantity = 0;
    localStorage.setItem("nywarudo_save_slot_0", JSON.stringify(raw));

    expect(readSlot(0)).toBeNull();
  });

  it("returns null for a save with an invalid player facing", () => {
    writeSlot(0, stubSave());

    const raw = JSON.parse(localStorage.getItem("nywarudo_save_slot_0")!);
    raw.playerFacing = "up";
    localStorage.setItem("nywarudo_save_slot_0", JSON.stringify(raw));

    expect(readSlot(0)).toBeNull();
  });

  it("returns null for a non-object value", () => {
    localStorage.setItem("nywarudo_save_slot_0", "42");
    expect(readSlot(0)).toBeNull();
  });

  it("deletes a slot", () => {
    writeSlot(0, stubSave());
    expect(readSlot(0)).not.toBeNull();

    deleteSlot(0);
    expect(readSlot(0)).toBeNull();
  });

  it("readAllSaves returns nulls for empty slots", () => {
    const saves = readAllSaves();
    expect(saves).toEqual([null, null, null]);
  });

  it("readAllSaves returns saves in order", () => {
    writeSlot(1, stubSave({ zoneId: "middle" }));
    const saves = readAllSaves();
    expect(saves[0]).toBeNull();
    expect(saves[1]?.zoneId).toBe("middle");
    expect(saves[2]).toBeNull();
  });

  it("hasAnySave returns false when all slots are empty", () => {
    expect(hasAnySave()).toBe(false);
  });

  it("hasAnySave returns true when at least one slot is occupied", () => {
    writeSlot(0, stubSave());
    expect(hasAnySave()).toBe(true);
  });

  it("deleteSlot is a no-op on empty slots", () => {
    expect(() => deleteSlot(0)).not.toThrow();
    expect(readSlot(0)).toBeNull();
  });
});
