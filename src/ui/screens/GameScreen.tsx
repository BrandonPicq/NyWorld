import { useEffect, useRef, useState } from "react";
import { createGridRenderSnapshot } from "../../rendering";
import testZoneData from "../../content/zones/test_zone.json";
import testZone2Data from "../../content/zones/test_zone_2.json";
import type { ZoneData } from "../../engine/ZoneTypes";
import type { GameCommand } from "../../engine";
import type { GameSaveData } from "../../engine/GameSaveData";
import { TerminalPanel } from "../components/TerminalPanel";
import { TerminalButton } from "../components/TerminalButton";
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
import { QuestsModal } from "../game/QuestsModal";
import { PauseModal } from "../game/PauseModal";
import { SaveSlotsModal } from "../save/SaveSlotsModal";
import { GameToast } from "../toast/GameToast";
import { readAllSaves, writeSlot } from "../save/gameSaveStorage";
import {
  createInteractionCommand,
  getInteractionTargets,
} from "../game/interactionTargets";

type GameScreenProps = {
  audioSettings: AudioSettings;
  gameplaySettings: GameplaySettings;
  keyboardLayout: KeyboardLayout;
  textSpeed: TextSpeed;
  initialSaveData?: GameSaveData;
  onBackToTitle: () => void;
  onLoadError?: (message: string) => void;
  onOpenOptions: () => void;
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
  initialSaveData,
  onBackToTitle,
  onLoadError,
  onOpenOptions,
}: GameScreenProps) {
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false);
  const [isInteractChoiceOpen, setIsInteractChoiceOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isQuestsOpen, setIsQuestsOpen] = useState(false);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);
  const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false);
  const [isSaveSlotsOpen, setIsSaveSlotsOpen] = useState(false);
  const [gameToast, setGameToast] = useState<string | null>(null);
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
    isInventoryOpen ||
    isQuestsOpen ||
    isPauseMenuOpen ||
    isSaveSlotsOpen;
  const { createSaveData, executeCommand, snapshot } = useGameplayEngine({
    audioSettings,
    initialSaveData,
    initialZoneData: zoneRegistry.test_zone,
    onDialogue: triggerDialogue,
    onLoadError,
    onNotice: setInventoryNotice,
    zoneRegistry,
  });

  const interactionTargets = snapshot
    ? getInteractionTargets(snapshot, gameplaySettings)
    : [];

  const handleSaveGame = () => {
    setIsPauseMenuOpen(false);
    setIsSaveSlotsOpen(true);
  };

  const handleSaveToSlot = (slotIndex: number) => {
    const saveData = createSaveData();
    if (!saveData) return;

    const didSave = writeSlot(slotIndex, saveData);
    if (!didSave) {
      setGameToast(`Could not save to slot ${slotIndex + 1}.`);
      return;
    }

    setIsSaveSlotsOpen(false);
    setGameToast(`Game saved to slot ${slotIndex + 1}.`);
  };

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
    isInventoryNoticeOpen: inventoryNotice !== null,
    isInventoryOpen,
    isPauseMenuOpen,
    isQuestsOpen,
    isSaveSlotsOpen,
    keyboardLayout,
    onOpenPauseMenu: () => setIsPauseMenuOpen(true),
    progressDialogue,
    setIsCharacterSheetOpen,
    setIsInventoryNoticeOpen: (open) => {
      const next = typeof open === "function" ? open(inventoryNotice !== null) : open;
      setInventoryNotice(next ? "" : null);
    },
    setIsInventoryOpen,
    setIsQuestsOpen,
    setIsSaveSlotsOpen,
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
          onOpenJournal={() => setIsQuestsOpen(true)}
          onRest={() => handleExecuteCommand({ type: "Rest" })}
          stats={snapshot.stats}
          worldTime={snapshot.worldTime}
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
            onUseItem={(itemId) =>
              handleExecuteCommand({ type: "UseItem", itemId })
            }
          />
        )}

        {isQuestsOpen && (
          <QuestsModal
            isOpen={isQuestsOpen}
            snapshot={snapshot}
            onClose={() => setIsQuestsOpen(false)}
          />
        )}

        {inventoryNotice !== null && (
          <div
            className="modal-overlay"
            onClick={() => setInventoryNotice(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setInventoryNotice(null);
              }
              e.stopPropagation();
            }}
          >
            <TerminalPanel
              className="stats-modal"
              style={{ maxWidth: "360px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="terminal-kicker">NOTICE</p>
              <h2 className="terminal-heading-md" style={{ marginBottom: "var(--space-4)" }}>
                Cannot Use Item
              </h2>
              <p>{inventoryNotice}</p>
              <div
                className="stats-modal__actions"
                style={{ marginTop: "var(--space-4)" }}
              >
                <TerminalButton onClick={() => setInventoryNotice(null)}>
                  [OK]
                </TerminalButton>
              </div>
            </TerminalPanel>
          </div>
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

        {isPauseMenuOpen && (
          <PauseModal
            audioSettings={audioSettings}
            onClose={() => setIsPauseMenuOpen(false)}
            onOpenOptions={onOpenOptions}
            onQuit={onBackToTitle}
            onSave={handleSaveGame}
          />
        )}

        {isSaveSlotsOpen && (
          <SaveSlotsModal
            onClose={() => setIsSaveSlotsOpen(false)}
            onSave={handleSaveToSlot}
            slots={readAllSaves()}
          />
        )}

        {gameToast !== null && (
          <GameToast
            message={gameToast}
            onDismiss={() => setGameToast(null)}
          />
        )}
      </div>
    </main>
  );
}
