export type InteractionTargetingMode = "nearby" | "facing";

export type GameplaySettings = {
  smartInteract: boolean;
  interactionTargetingMode: InteractionTargetingMode;
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const defaultGameplaySettings: GameplaySettings = {
  smartInteract: false,
  interactionTargetingMode: "nearby",
};
const gameplaySettingsStorageKey = "nywarudo_gameplay_settings";

export function getDefaultGameplaySettings(): GameplaySettings {
  return { ...defaultGameplaySettings };
}

function isInteractionTargetingMode(
  value: unknown,
): value is InteractionTargetingMode {
  return value === "nearby" || value === "facing";
}

export function readStoredGameplaySettings(
  storage: StorageLike | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined,
): GameplaySettings {
  if (!storage) {
    return getDefaultGameplaySettings();
  }

  try {
    const stored = storage.getItem(gameplaySettingsStorageKey);
    if (!stored) {
      return getDefaultGameplaySettings();
    }

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed === "object" && parsed !== null) {
      const maybeSettings = parsed as Partial<GameplaySettings>;

      return {
        smartInteract:
          typeof maybeSettings.smartInteract === "boolean"
            ? maybeSettings.smartInteract
            : defaultGameplaySettings.smartInteract,
        interactionTargetingMode: isInteractionTargetingMode(
          maybeSettings.interactionTargetingMode,
        )
          ? maybeSettings.interactionTargetingMode
          : defaultGameplaySettings.interactionTargetingMode,
      };
    }
  } catch {
    return getDefaultGameplaySettings();
  }

  return getDefaultGameplaySettings();
}

export function writeStoredGameplaySettings(
  settings: GameplaySettings,
  storage: StorageLike | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(gameplaySettingsStorageKey, JSON.stringify(settings));
  } catch {
    // Gameplay persistence is optional; the current in-memory setting still applies.
  }
}
