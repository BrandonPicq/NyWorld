export type TextSpeed = "slow" | "normal" | "fast" | "instant";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Reads the typewriter text speed, defaulting to normal for unknown values.
 */
export function readStoredTextSpeed(
  storage: StorageLike | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined,
): TextSpeed {
  if (!storage) {
    return "normal";
  }

  const stored = storage.getItem("nywarudo_text_speed");
  if (
    stored === "slow" ||
    stored === "normal" ||
    stored === "fast" ||
    stored === "instant"
  ) {
    return stored;
  }

  return "normal";
}

/**
 * Persists the typewriter text speed when storage is available.
 */
export function writeStoredTextSpeed(
  speed: TextSpeed,
  storage: StorageLike | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined,
): void {
  if (storage) {
    storage.setItem("nywarudo_text_speed", speed);
  }
}
