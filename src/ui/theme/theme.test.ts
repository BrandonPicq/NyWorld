import { describe, expect, it } from "vitest";
import {
  getDefaultThemeId,
  isThemeId,
  readStoredThemeId,
  writeStoredThemeId,
} from "./theme";

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}

describe("theme settings", () => {
  it("recognizes supported theme ids", () => {
    expect(isThemeId("green")).toBe(true);
    expect(isThemeId("amber")).toBe(true);
    expect(isThemeId("blue")).toBe(true);
  });

  it("rejects unknown theme ids", () => {
    expect(isThemeId("violet")).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });

  it("falls back to the default theme when storage is empty", () => {
    expect(readStoredThemeId(createMemoryStorage())).toBe(getDefaultThemeId());
  });

  it("falls back to the default theme for invalid stored values", () => {
    expect(readStoredThemeId(createMemoryStorage("violet"))).toBe(
      getDefaultThemeId(),
    );
  });

  it("writes supported theme ids to storage", () => {
    const storage = createMemoryStorage();

    writeStoredThemeId("amber", storage);

    expect(readStoredThemeId(storage)).toBe("amber");
  });
});
