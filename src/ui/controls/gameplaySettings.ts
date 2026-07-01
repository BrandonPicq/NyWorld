export type GameplaySettings = {
  smartInteract: boolean;
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readStoredGameplaySettings(
  storage: StorageLike | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined,
): GameplaySettings {
  if (!storage) {
    return { smartInteract: false };
  }

  const stored = storage.getItem("nywarudo_gameplay_settings");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof parsed.smartInteract === "boolean"
      ) {
        return parsed as GameplaySettings;
      }
    } catch {
      // ignore parsing errors and fall back to default
    }
  }

  return { smartInteract: false };
}

export function writeStoredGameplaySettings(
  settings: GameplaySettings,
  storage: StorageLike | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined,
): void {
  if (storage) {
    storage.setItem("nywarudo_gameplay_settings", JSON.stringify(settings));
  }
}
