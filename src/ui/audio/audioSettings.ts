export type AudioSettings = {
  soundEnabled: boolean;
};

type AudioSettingsStorage = Pick<Storage, "getItem" | "setItem">;

const defaultAudioSettings: AudioSettings = {
  soundEnabled: true,
};
const audioSettingsStorageKey = "nywarudo.audio";

export function getDefaultAudioSettings(): AudioSettings {
  return { ...defaultAudioSettings };
}

export function isAudioSettings(value: unknown): value is AudioSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    "soundEnabled" in value &&
    typeof value.soundEnabled === "boolean"
  );
}

export function readStoredAudioSettings(
  storage = getBrowserAudioSettingsStorage(),
): AudioSettings {
  if (!storage) {
    return getDefaultAudioSettings();
  }

  try {
    const storedValue = storage.getItem(audioSettingsStorageKey);

    if (!storedValue) {
      return getDefaultAudioSettings();
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    return isAudioSettings(parsedValue)
      ? parsedValue
      : getDefaultAudioSettings();
  } catch {
    return getDefaultAudioSettings();
  }
}

export function writeStoredAudioSettings(
  audioSettings: AudioSettings,
  storage = getBrowserAudioSettingsStorage(),
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(audioSettingsStorageKey, JSON.stringify(audioSettings));
  } catch {
    // Audio persistence is optional; the current in-memory setting still applies.
  }
}

function getBrowserAudioSettingsStorage(): AudioSettingsStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
