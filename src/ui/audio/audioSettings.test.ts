import { describe, expect, it } from "vitest";
import {
  getDefaultAudioSettings,
  isAudioSettings,
  readStoredAudioSettings,
  writeStoredAudioSettings,
} from "./audioSettings";

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}

describe("audio settings", () => {
  it("defaults menu sound to enabled", () => {
    expect(getDefaultAudioSettings()).toEqual({ soundEnabled: true });
  });

  it("recognizes valid audio settings", () => {
    expect(isAudioSettings({ soundEnabled: true })).toBe(true);
    expect(isAudioSettings({ soundEnabled: false })).toBe(true);
  });

  it("rejects invalid audio settings", () => {
    expect(isAudioSettings({ soundEnabled: "true" })).toBe(false);
    expect(isAudioSettings(null)).toBe(false);
  });

  it("falls back to defaults when storage is empty or invalid", () => {
    expect(readStoredAudioSettings(createMemoryStorage())).toEqual(
      getDefaultAudioSettings(),
    );
    expect(readStoredAudioSettings(createMemoryStorage("{bad json"))).toEqual(
      getDefaultAudioSettings(),
    );
    expect(
      readStoredAudioSettings(createMemoryStorage('{"soundEnabled":"yes"}')),
    ).toEqual(getDefaultAudioSettings());
  });

  it("writes and reads persisted audio settings", () => {
    const storage = createMemoryStorage();

    writeStoredAudioSettings({ soundEnabled: false }, storage);

    expect(readStoredAudioSettings(storage)).toEqual({ soundEnabled: false });
  });
});
