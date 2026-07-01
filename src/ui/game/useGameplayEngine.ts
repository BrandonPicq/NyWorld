import { useCallback, useEffect, useRef, useState } from "react";
import {
  GameplayEngine,
  loadZone,
  type DialogueNode,
  type EngineEffect,
  type GameCommand,
  type GameSnapshot,
  type ZoneData,
} from "../../engine";
import type { AudioSettings } from "../audio/audioSettings";
import { playItemCollectSound } from "../audio/menuAudio";

type UseGameplayEngineInput = {
  audioSettings: AudioSettings;
  initialZoneData: ZoneData;
  onDialogue: (nodes: DialogueNode[]) => void;
  zoneRegistry: Record<string, ZoneData>;
};

/**
 * Owns the React bridge to GameplayEngine for a game screen.
 *
 * The hook keeps the engine instance outside React state, publishes snapshots,
 * and turns engine dialogue results and effects into UI callbacks.
 */
export function useGameplayEngine({
  audioSettings,
  initialZoneData,
  onDialogue,
  zoneRegistry,
}: UseGameplayEngineInput) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const engineRef = useRef<GameplayEngine | null>(null);

  useEffect(() => {
    const map = loadZone(initialZoneData);
    const engine = new GameplayEngine(map, {
      resolveZone: (zoneId) => {
        const zoneData = zoneRegistry[zoneId];
        return zoneData ? loadZone(zoneData) : undefined;
      },
    });

    engineRef.current = engine;
    setSnapshot(engine.getSnapshot());

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
        playEffect(effect, audioSettings);
      }
    },
    [audioSettings, onDialogue],
  );

  return {
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
}
