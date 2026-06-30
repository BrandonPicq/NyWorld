export type TextSpeed = "slow" | "normal" | "fast" | "instant";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

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
