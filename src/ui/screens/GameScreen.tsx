import { useCallback, useEffect, useRef, useState } from "react";
import type { GameCommand } from "../../engine/commands";
import { GameplayEngine } from "../../engine/GameplayEngine";
import { loadZone } from "../../engine/zoneLoader";
import type { GameSnapshot } from "../../engine/GameplayEngine";
import { createGridRenderSnapshot } from "../../rendering";
import testZoneData from "../../content/zones/test_zone.json";
import testZone2Data from "../../content/zones/test_zone_2.json";
import type { ZoneData } from "../../engine/ZoneTypes";
import { TerminalPanel } from "../components/TerminalPanel";
import { getGameCommandForKey } from "../controls/gameInput";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import type { AudioSettings } from "../audio/audioSettings";
import type { TextSpeed } from "../controls/textSpeed";
import { ActionLogPanel } from "../game/ActionLogPanel";
import { CharacterSheetModal } from "../game/CharacterSheetModal";
import { CharacterStatusPanel } from "../game/CharacterStatusPanel";
import { DialogueBox } from "../game/DialogueBox";
import { GameCenterPanel } from "../game/GameCenterPanel";
import { useDialogueSequence } from "../game/useDialogueSequence";

type GameScreenProps = {
  audioSettings: AudioSettings;
  keyboardLayout: KeyboardLayout;
  textSpeed: TextSpeed;
  onBackToTitle: () => void;
};

const zoneRegistry: Record<string, ZoneData> = {
  test_zone: testZoneData as ZoneData,
  test_zone_2: testZone2Data as ZoneData,
};

export function GameScreen({
  audioSettings,
  keyboardLayout,
  textSpeed,
  onBackToTitle,
}: GameScreenProps) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false);
  const engineRef = useRef<GameplayEngine | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const prevZoneIdRef = useRef<string | null>(null);
  const {
    activeDialogue,
    closeDialogue,
    dialogueIndex,
    isTyping,
    progressDialogue,
    triggerDialogue,
    visibleText,
  } = useDialogueSequence({ audioSettings, textSpeed });
  const controlsDisabled = activeDialogue !== null || isCharacterSheetOpen;

  useEffect(() => {
    const map = loadZone(testZoneData);
    const engine = new GameplayEngine(map, {
      resolveZone: (zoneId) => {
        const zoneData = zoneRegistry[zoneId];
        return zoneData ? loadZone(zoneData) : undefined;
      },
    });
    engineRef.current = engine;
    setSnapshot(engine.getSnapshot());
  }, []);

  const executeCommand = useCallback((command: GameCommand) => {
    const engine = engineRef.current;
    if (!engine || controlsDisabled) return;

    const result = engine.execute(command);
    setSnapshot(engine.getSnapshot());

    if (result.dialogue) {
      triggerDialogue(result.dialogue);
    }
  }, [controlsDisabled, triggerDialogue]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [snapshot?.log]);

  // Trigger dialogue when entering zones
  useEffect(() => {
    if (!snapshot) return;

    if (prevZoneIdRef.current === null) {
      prevZoneIdRef.current = snapshot.zoneId;
      triggerDialogue([
        {
          speaker: "Narrator",
          text: "Welcome to the test fields of NyWarudo.",
          pitch: 1.0,
        },
        {
          speaker: "Old Sage",
          text: "Watch your steps, traveler. Each movement consumes your vital Energy.",
          pitch: 0.7,
        },
      ]);
      return;
    }

    if (prevZoneIdRef.current !== snapshot.zoneId) {
      prevZoneIdRef.current = snapshot.zoneId;
      if (snapshot.zoneId === "test_zone_2") {
        triggerDialogue([
          {
            speaker: "Narrator",
            text: "The air here grows heavy and cold.",
            pitch: 0.9,
          },
          {
            speaker: "Mysterious Voice",
            text: "Who dares trespass in the Eastern Ruins?",
            pitch: 1.4,
          },
        ]);
      } else if (snapshot.zoneId === "test_zone") {
        triggerDialogue([
          {
            speaker: "Narrator",
            text: "You returned to the relative safety of the starting fields.",
            pitch: 1.0,
          },
        ]);
      }
    }
  }, [snapshot?.zoneId, triggerDialogue]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const keyLower = event.key.toLowerCase();

      // Block all control commands if a dialogue is active
      if (activeDialogue) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          progressDialogue();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeDialogue();
        }
        return;
      }

      if (keyLower === "c") {
        event.preventDefault();
        setIsCharacterSheetOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (isCharacterSheetOpen) {
          setIsCharacterSheetOpen(false);
        } else {
          onBackToTitle();
        }
        return;
      }

      if (isCharacterSheetOpen) {
        return; // Ignore moves and rests while character sheet is open
      }

      if (keyLower === "r") {
        event.preventDefault();
        executeCommand({ type: "Rest" });
        return;
      }

      const commandType = getGameCommandForKey(event.key, keyboardLayout);

      if (commandType) {
        event.preventDefault();
        executeCommand({ type: commandType });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    executeCommand,
    onBackToTitle,
    keyboardLayout,
    isCharacterSheetOpen,
    activeDialogue,
    closeDialogue,
    progressDialogue,
  ]);

  if (!snapshot) {
    return (
      <main className="app-shell">
        <TerminalPanel>
          <p>Loading...</p>
        </TerminalPanel>
      </main>
    );
  }

  const gridRenderSnapshot = createGridRenderSnapshot(snapshot);

  return (
    <main className="app-shell" aria-labelledby="game-heading">
      <div className="game-layout">
        <CharacterStatusPanel
          controlsDisabled={controlsDisabled}
          onOpenSheet={() => setIsCharacterSheetOpen(true)}
          onRest={() => executeCommand({ type: "Rest" })}
          stats={snapshot.stats}
        />

        <GameCenterPanel
          controlsDisabled={controlsDisabled}
          keyboardLayout={keyboardLayout}
          onExecuteCommand={executeCommand}
          renderSnapshot={gridRenderSnapshot}
          snapshot={snapshot}
        >
          {activeDialogue && activeDialogue[dialogueIndex] && (
            <DialogueBox
              isTyping={isTyping}
              node={activeDialogue[dialogueIndex]}
              onProgress={progressDialogue}
              visibleText={visibleText}
            />
          )}
        </GameCenterPanel>

        <ActionLogPanel log={snapshot.log} logRef={logRef} />

        {isCharacterSheetOpen && (
          <CharacterSheetModal
            onClose={() => setIsCharacterSheetOpen(false)}
            stats={snapshot.stats}
          />
        )}
      </div>
    </main>
  );
}
