import { describe, expect, it } from "vitest";
import {
  getDefaultGameplaySettings,
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
    expect(readStoredGameplaySettings(undefined)).toEqual(
      getDefaultGameplaySettings(),
    );
  });

  it("loads stored gameplay settings", () => {
    const storage = createMemoryStorage(
      JSON.stringify({
        smartInteract: true,
        interactionTargetingMode: "facing",
      }),
    );
    expect(readStoredGameplaySettings(storage)).toEqual({
      smartInteract: true,
      interactionTargetingMode: "facing",
    });
  });

  it("loads older stored gameplay settings with new defaults", () => {
    const storage = createMemoryStorage(
      JSON.stringify({ smartInteract: true }),
    );
    expect(readStoredGameplaySettings(storage)).toEqual({
      smartInteract: true,
      interactionTargetingMode: "nearby",
    });
  });

  it("falls back on invalid JSON content", () => {
    const storage = createMemoryStorage("{invalid json}");
    expect(readStoredGameplaySettings(storage)).toEqual(
      getDefaultGameplaySettings(),
    );
  });

  it("falls back when storage read fails", () => {
    expect(
      readStoredGameplaySettings({
        getItem: () => {
          throw new Error("blocked storage");
        },
        setItem: () => {},
      }),
    ).toEqual(getDefaultGameplaySettings());
  });

  it("persists gameplay settings", () => {
    const storage = createMemoryStorage();
    writeStoredGameplaySettings(
      { smartInteract: true, interactionTargetingMode: "facing" },
      storage,
    );
    expect(readStoredGameplaySettings(storage)).toEqual({
      smartInteract: true,
      interactionTargetingMode: "facing",
    });
  });

  it("ignores storage write failures", () => {
    expect(() =>
      writeStoredGameplaySettings(
        { smartInteract: true, interactionTargetingMode: "facing" },
        {
          getItem: () => null,
          setItem: () => {
            throw new Error("blocked storage");
          },
        },
      ),
    ).not.toThrow();
  });
});
