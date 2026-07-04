import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDefaultZoneData,
  getSafeRespawn,
  GameplayEngine,
  loadZone,
  resolveZoneFromBundle,
  type ContentBundle,
  type DialogueNode,
  type EngineNotice,
  type EngineEffect,
  type GameCommand,
  type GameSaveData,
  type GameSnapshot,
} from "../../engine";
import type { AudioSettings } from "../audio/audioSettings";
import { playItemCollectSound, playMenuConfirmSound } from "../audio/menuAudio";

type UseGameplayEngineInput = {
  audioSettings: AudioSettings;
  contentBundle: ContentBundle;
  initialSaveData?: GameSaveData;
  onDialogue: (nodes: DialogueNode[], dialogueId?: string) => void;
  onEffect?: (effect: EngineEffect) => void;
  onLoadError?: (message: string) => void;
  onNotice?: (notice: EngineNotice) => void;
};

/**
 * Owns the React bridge to GameplayEngine for a game screen.
 *
 * The hook keeps the engine instance outside React state, publishes snapshots,
 * and turns engine dialogue results, effects, and rejection notices into UI
 * callbacks.
 */
export function useGameplayEngine({
  audioSettings,
  contentBundle,
  initialSaveData,
  onDialogue,
  onEffect,
  onLoadError,
  onNotice,
}: UseGameplayEngineInput) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const engineRef = useRef<GameplayEngine | null>(null);
  const initialSaveDataRef = useRef(initialSaveData);
  const onLoadErrorRef = useRef(onLoadError);
  const onNoticeRef = useRef(onNotice);

  if (initialSaveDataRef.current !== initialSaveData) {
    initialSaveDataRef.current = initialSaveData;
  }
  onLoadErrorRef.current = onLoadError;
  onNoticeRef.current = onNotice;

  useEffect(() => {
    const resolveZone = (zoneId: string) => {
      return resolveZoneFromBundle(contentBundle, zoneId);
    };
    const safeRespawn = getSafeRespawn(contentBundle);

    try {
      const saveData = initialSaveDataRef.current;
      const engine = saveData
        ? GameplayEngine.fromSaveData(saveData, { resolveZone, safeRespawn })
        : new GameplayEngine(loadZone(getDefaultZoneData(contentBundle)), {
            resolveZone,
            safeRespawn,
          });

      engineRef.current = engine;
      setSnapshot(engine.getSnapshot());
      for (const notice of engine.consumeNotices()) {
        onNoticeRef.current?.(notice);
      }
    } catch (error) {
      engineRef.current = null;
      setSnapshot(null);
      const message =
        error instanceof Error ? error.message : "Cannot load saved game.";
      onLoadErrorRef.current?.(message);
    }

    return () => {
      engineRef.current = null;
    };
  }, [contentBundle]);

  const executeCommand = useCallback(
    (command: GameCommand) => {
      const engine = engineRef.current;
      if (!engine) return;

      const result = engine.execute(command);
      setSnapshot(engine.getSnapshot());

      if (result.dialogue) {
        onDialogue(result.dialogue, result.dialogueId);
      }

      for (const effect of result.effects ?? []) {
        if (effect.type === "ItemUseRejected") {
          onNotice?.({ title: "Cannot Use Item", message: effect.message });
        } else {
          playEffect(effect, audioSettings);
        }
        onEffect?.(effect);
      }
    },
    [audioSettings, onDialogue, onEffect, onNotice],
  );

  return {
    createSaveData: () => engineRef.current?.createSaveData(),
    executeCommand,
    snapshot,
  };
}

function playEffect(
  effect: EngineEffect,
  audioSettings: AudioSettings,
): void {
  if (effect.type === "ItemCollected") {
    if (audioSettings.soundEnabled) {
      playItemCollectSound();
    }
  }

  if (effect.type === "ItemLost") {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
  }

  if (effect.type === "ItemUsed") {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
  }
}
