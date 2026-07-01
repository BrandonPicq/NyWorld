import { useEffect, useRef, useState } from "react";
import { createGridRenderSnapshot } from "../../rendering";
import testZoneData from "../../content/zones/test_zone.json";
import testZone2Data from "../../content/zones/test_zone_2.json";
import type { ZoneData } from "../../engine/ZoneTypes";
import { TerminalPanel } from "../components/TerminalPanel";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import type { AudioSettings } from "../audio/audioSettings";
import type { TextSpeed } from "../controls/textSpeed";
import type { GameplaySettings } from "../controls/gameplaySettings";
import { ActionLogPanel } from "../game/ActionLogPanel";
import { CharacterSheetModal } from "../game/CharacterSheetModal";
import { CharacterStatusPanel } from "../game/CharacterStatusPanel";
import { DialogueBox } from "../game/DialogueBox";
import { GameCenterPanel } from "../game/GameCenterPanel";
import { useDialogueSequence } from "../game/useDialogueSequence";
import { useGameKeyboardControls } from "../game/useGameKeyboardControls";
import { useGameplayEngine } from "../game/useGameplayEngine";
import { useZoneEntryDialogue } from "../game/useZoneEntryDialogue";

type GameScreenProps = {
  audioSettings: AudioSettings;
  gameplaySettings: GameplaySettings;
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
  gameplaySettings,
  keyboardLayout,
  textSpeed,
  onBackToTitle,
}: GameScreenProps) {
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
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
  const { executeCommand, snapshot } = useGameplayEngine({
    controlsDisabled,
    initialZoneData: zoneRegistry.test_zone,
    onDialogue: triggerDialogue,
    zoneRegistry,
  });

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [snapshot?.log]);

  useZoneEntryDialogue(snapshot, triggerDialogue);
  useGameKeyboardControls({
    activeDialogue,
    closeDialogue,
    executeCommand,
    isCharacterSheetOpen,
    keyboardLayout,
    onBackToTitle,
    progressDialogue,
    setIsCharacterSheetOpen,
  });

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
          gameplaySettings={gameplaySettings}
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
