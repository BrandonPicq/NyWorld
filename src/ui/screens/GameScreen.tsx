import { useEffect, useRef, useState } from "react";
import { createGridRenderSnapshot } from "../../rendering";
import testZoneData from "../../content/zones/test_zone.json";
import testZone2Data from "../../content/zones/test_zone_2.json";
import type { ZoneData } from "../../engine/ZoneTypes";
import type { GameCommand } from "../../engine";
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
import { InteractionChoiceModal } from "../game/InteractionChoiceModal";
import { InventoryModal } from "../game/InventoryModal";
import {
  createInteractionCommand,
  getInteractionTargets,
} from "../game/interactionTargets";

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
  const [isInteractChoiceOpen, setIsInteractChoiceOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
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
  const controlsDisabled =
    activeDialogue !== null ||
    isCharacterSheetOpen ||
    isInteractChoiceOpen ||
    isInventoryOpen;
  const { executeCommand, snapshot } = useGameplayEngine({
    audioSettings,
    initialZoneData: zoneRegistry.test_zone,
    onDialogue: triggerDialogue,
    zoneRegistry,
  });

  const interactionTargets = snapshot
    ? getInteractionTargets(snapshot, gameplaySettings)
    : [];

  const handleExecuteCommand = (command: GameCommand) => {
    if (
      command.type === "Interact" &&
      !command.targetNpcId &&
      !command.targetDirection
    ) {
      if (interactionTargets.length > 1) {
        setIsInteractChoiceOpen(true);
        return;
      }

      if (interactionTargets.length === 1) {
        executeCommand(createInteractionCommand(interactionTargets[0]));
        return;
      }

      const fallbackCommand: GameCommand =
        gameplaySettings.interactionTargetingMode === "facing" && snapshot
          ? { type: "Interact", targetDirection: snapshot.playerFacing }
          : { type: "Interact" };
      executeCommand(fallbackCommand);
      return;
    }

    executeCommand(command);
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [snapshot?.log]);

  useZoneEntryDialogue(snapshot, triggerDialogue);
  useGameKeyboardControls({
    activeDialogue,
    audioSettings,
    closeDialogue,
    executeCommand: handleExecuteCommand,
    isCharacterSheetOpen,
    isInteractChoiceOpen,
    isInventoryOpen,
    keyboardLayout,
    onBackToTitle,
    progressDialogue,
    setIsCharacterSheetOpen,
    setIsInventoryOpen,
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
          onOpenInventory={() => setIsInventoryOpen(true)}
          onOpenSheet={() => setIsCharacterSheetOpen(true)}
          onRest={() => handleExecuteCommand({ type: "Rest" })}
          stats={snapshot.stats}
        />

        <GameCenterPanel
          controlsDisabled={controlsDisabled}
          isInteractDisabled={
            gameplaySettings.smartInteract && interactionTargets.length === 0
          }
          keyboardLayout={keyboardLayout}
          onExecuteCommand={handleExecuteCommand}
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
            audioSettings={audioSettings}
            onClose={() => setIsCharacterSheetOpen(false)}
            stats={snapshot.stats}
          />
        )}

        {isInventoryOpen && (
          <InventoryModal
            audioSettings={audioSettings}
            inventory={snapshot.inventory}
            onClose={() => setIsInventoryOpen(false)}
          />
        )}

        {isInteractChoiceOpen && (
          <InteractionChoiceModal
            audioSettings={audioSettings}
            choices={interactionTargets}
            onSelect={(choiceId) => {
              const target = interactionTargets.find(
                (interactionTarget) => interactionTarget.id === choiceId,
              );

              if (target) {
                handleExecuteCommand(createInteractionCommand(target));
              }

              setIsInteractChoiceOpen(false);
            }}
            onClose={() => setIsInteractChoiceOpen(false)}
          />
        )}
      </div>
    </main>
  );
}
