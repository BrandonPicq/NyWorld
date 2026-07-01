import { describe, expect, it } from "vitest";
import {
  readStoredGameplaySettings,
  writeStoredGameplaySettings,
} from "./gameplaySettings";

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}

describe("gameplaySettings", () => {
  it("returns default settings when nothing is stored", () => {
    expect(readStoredGameplaySettings(undefined)).toEqual({
      smartInteract: false,
    });
  });

  it("loads stored gameplay settings", () => {
    const storage = createMemoryStorage(
      JSON.stringify({ smartInteract: true }),
    );
    expect(readStoredGameplaySettings(storage)).toEqual({
      smartInteract: true,
    });
  });

  it("falls back on invalid JSON content", () => {
    const storage = createMemoryStorage("{invalid json}");
    expect(readStoredGameplaySettings(storage)).toEqual({
      smartInteract: false,
    });
  });

  it("persists gameplay settings", () => {
    const storage = createMemoryStorage();
    writeStoredGameplaySettings({ smartInteract: true }, storage);
    expect(readStoredGameplaySettings(storage)).toEqual({
      smartInteract: true,
    });
  });
});
