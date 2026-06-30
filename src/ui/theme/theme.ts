export type ThemeId = "green" | "amber" | "blue";

type ThemePreset = {
  id: ThemeId;
  label: string;
};

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export const themePresets: ThemePreset[] = [
  { id: "green", label: "Green" },
  { id: "amber", label: "Amber" },
  { id: "blue", label: "Blue" },
];

const defaultThemeId: ThemeId = "green";
const themeStorageKey = "nywarudo.theme";

export function getDefaultThemeId() {
  return defaultThemeId;
}

export function isThemeId(value: string | null): value is ThemeId {
  return themePresets.some((theme) => theme.id === value);
}

export function readStoredThemeId(storage = getBrowserThemeStorage()) {
  if (!storage) {
    return defaultThemeId;
  }

  try {
    const storedThemeId = storage.getItem(themeStorageKey);
    return isThemeId(storedThemeId) ? storedThemeId : defaultThemeId;
  } catch {
    return defaultThemeId;
  }
}

export function writeStoredThemeId(
  themeId: ThemeId,
  storage = getBrowserThemeStorage(),
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(themeStorageKey, themeId);
  } catch {
    // Theme persistence is a convenience; the current in-memory theme still applies.
  }
}

function getBrowserThemeStorage(): ThemeStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
