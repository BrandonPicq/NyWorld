import { describe, expect, it } from "vitest";
import { readStoredTextSpeed, writeStoredTextSpeed } from "./textSpeed";

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}

describe("textSpeed", () => {
  it("returns normal as the default fallback when no value is stored", () => {
    expect(readStoredTextSpeed(undefined)).toBe("normal");
  });

  it("restores the stored text speed value from storage", () => {
    const storage = createMemoryStorage("slow");
    expect(readStoredTextSpeed(storage)).toBe("slow");

    const storage2 = createMemoryStorage("instant");
    expect(readStoredTextSpeed(storage2)).toBe("instant");
  });

  it("ignores invalid stored text speed values and falls back to normal", () => {
    const storage = createMemoryStorage("super-sonic");
    expect(readStoredTextSpeed(storage)).toBe("normal");
  });

  it("stores the new text speed value to storage", () => {
    const storage = createMemoryStorage();
    writeStoredTextSpeed("fast", storage);
    expect(readStoredTextSpeed(storage)).toBe("fast");
  });
});
