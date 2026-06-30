import { describe, expect, it } from "vitest";
import {
  getDefaultKeyboardLayout,
  readStoredKeyboardLayout,
  writeStoredKeyboardLayout,
} from "./keyboardLayout";

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}

describe("keyboard layout settings", () => {
  it("defaults to qwerty", () => {
    expect(getDefaultKeyboardLayout()).toBe("qwerty");
  });

  it("reads stored layout", () => {
    const storage = createMemoryStorage("azerty");
    expect(readStoredKeyboardLayout(storage)).toBe("azerty");
  });

  it("falls back to default for invalid layouts", () => {
    const storage = createMemoryStorage("dvorak");
    expect(readStoredKeyboardLayout(storage)).toBe("qwerty");
  });

  it("writes persisted layouts", () => {
    const storage = createMemoryStorage();
    writeStoredKeyboardLayout("azerty", storage);
    expect(readStoredKeyboardLayout(storage)).toBe("azerty");
  });
});
