import { useCallback, useEffect, useRef, useState } from "react";
import {
  GameplayEngine,
  loadZone,
  type DialogueNode,
  type EngineEffect,
  type GameCommand,
  type GameSaveData,
  type GameSnapshot,
  type ZoneData,
} from "../../engine";
import type { AudioSettings } from "../audio/audioSettings";
import { playItemCollectSound, playMenuConfirmSound } from "../audio/menuAudio";

type UseGameplayEngineInput = {
  audioSettings: AudioSettings;
  initialZoneData: ZoneData;
  initialSaveData?: GameSaveData;
  onDialogue: (nodes: DialogueNode[]) => void;
  onLoadError?: (message: string) => void;
  onNotice?: (message: string) => void;
  zoneRegistry: Record<string, ZoneData>;
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
  initialZoneData,
  initialSaveData,
  onDialogue,
  onLoadError,
  onNotice,
  zoneRegistry,
}: UseGameplayEngineInput) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const engineRef = useRef<GameplayEngine | null>(null);
  const initialSaveDataRef = useRef(initialSaveData);
  const onLoadErrorRef = useRef(onLoadError);

  if (initialSaveDataRef.current !== initialSaveData) {
    initialSaveDataRef.current = initialSaveData;
  }
  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    const resolveZone = (zoneId: string) => {
      const zoneData = zoneRegistry[zoneId];
      return zoneData ? loadZone(zoneData) : undefined;
    };

    try {
      const saveData = initialSaveDataRef.current;
      const engine = saveData
        ? GameplayEngine.fromSaveData(saveData, { resolveZone })
        : new GameplayEngine(loadZone(initialZoneData), { resolveZone });

      engineRef.current = engine;
      setSnapshot(engine.getSnapshot());
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
  }, [initialZoneData, zoneRegistry]);

  const executeCommand = useCallback(
    (command: GameCommand) => {
      const engine = engineRef.current;
      if (!engine) return;

      const result = engine.execute(command);
      setSnapshot(engine.getSnapshot());

      if (result.dialogue) {
        onDialogue(result.dialogue);
      }

      for (const effect of result.effects ?? []) {
        if (effect.type === "ItemUseRejected") {
          onNotice?.(effect.message);
        } else {
          playEffect(effect, audioSettings);
        }
      }
    },
    [audioSettings, onDialogue, onNotice],
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

  if (effect.type === "ItemUsed") {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
  }
}
