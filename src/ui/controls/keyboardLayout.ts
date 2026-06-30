export type KeyboardLayout = "qwerty" | "azerty";

const keyboardLayoutStorageKey = "nywarudo.keyboardLayout";
const defaultLayout: KeyboardLayout = "qwerty";

type StorageMock = Pick<Storage, "getItem" | "setItem">;

export function getDefaultKeyboardLayout(): KeyboardLayout {
  return defaultLayout;
}

export function readStoredKeyboardLayout(storage = getBrowserStorage()): KeyboardLayout {
  if (!storage) {
    return defaultLayout;
  }

  try {
    const stored = storage.getItem(keyboardLayoutStorageKey);
    return stored === "azerty" ? "azerty" : defaultLayout;
  } catch {
    return defaultLayout;
  }
}

export function writeStoredKeyboardLayout(
  layout: KeyboardLayout,
  storage = getBrowserStorage(),
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(keyboardLayoutStorageKey, layout);
  } catch {
    // Persistence is a convenience; the active in-memory state still applies.
  }
}

function getBrowserStorage(): StorageMock | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
