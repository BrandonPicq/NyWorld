import { useCallback, useEffect, useRef, useState } from "react";
import { createGridRenderSnapshot } from "../../rendering";
import {
  defaultContentBundle,
  getItemDef,
  getNpcDef,
  type ContentBundle,
  type DialogueNode,
  type EngineEffect,
  type EngineNotice,
  type GameCommand,
} from "../../engine";
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
import {
  GameToastStack,
  type GameToastEntry,
  type GameToastTone,
} from "../toast/GameToast";
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
  contentBundle?: ContentBundle;
  initialSaveData?: GameSaveData;
  newGameRaceId?: string;
  isPlaytest?: boolean;
  playtestStart?: {
    zoneId: string;
    x: number;
    y: number;
  };
  onBackToEditor?: () => void;
  onBackToTitle: () => void;
  onLoadError?: (message: string) => void;
  onOpenOptions: () => void;
};

const MAX_RETAINED_GAME_TOASTS = 6;

export function GameScreen({
  audioSettings,
  gameplaySettings,
  keyboardLayout,
  textSpeed,
  contentBundle = defaultContentBundle,
  initialSaveData,
  newGameRaceId,
  isPlaytest = false,
  playtestStart,
  onBackToEditor,
  onBackToTitle,
  onLoadError,
  onOpenOptions,
}: GameScreenProps) {
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false);
  const [isInteractChoiceOpen, setIsInteractChoiceOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isQuestsOpen, setIsQuestsOpen] = useState(false);
  const [gameNotice, setGameNotice] = useState<EngineNotice | null>(null);
  const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false);
  const [isSaveSlotsOpen, setIsSaveSlotsOpen] = useState(false);
  const [gameToasts, setGameToasts] = useState<GameToastEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const nextToastIdRef = useRef(1);

  const pushGameToast = useCallback((toast: Omit<GameToastEntry, "id">) => {
    const nextToast = {
      ...toast,
      id: nextToastIdRef.current,
    };
    nextToastIdRef.current += 1;

    setGameToasts((current) =>
      [nextToast, ...current].slice(0, MAX_RETAINED_GAME_TOASTS),
    );
  }, []);

  const dismissGameToast = useCallback((id: number) => {
    setGameToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const handleEngineEffect = useCallback(
    (effect: EngineEffect) => {
      const toast = getEffectToast(effect);
      if (toast) {
        pushGameToast(toast);
      }
    },
    [pushGameToast],
  );

  const { createSaveData, executeCommand, snapshot } = useGameplayEngine({
    audioSettings,
    contentBundle,
    initialSaveData: isPlaytest ? undefined : initialSaveData,
    newGameRaceId: isPlaytest ? undefined : newGameRaceId,
    newGameStart: isPlaytest ? playtestStart : undefined,
    onDialogue: (nodes, id) => triggerDialogue(nodes, id),
    onEffect: handleEngineEffect,
    onLoadError,
    onNotice: setGameNotice,
  });

  const {
    activeDialogue,
    dialogueIndex,
    isTyping,
    progressDialogue,
    skipDialogueLine,
    triggerDialogue,
    visibleText,
  } = useDialogueSequence({
    audioSettings,
    textSpeed,
    onDialogueComplete: () => {
      executeCommand({ type: "CompleteDialogue" });
    },
  });

  const controlsDisabled =
    activeDialogue !== null ||
    isCharacterSheetOpen ||
    isInteractChoiceOpen ||
    isInventoryOpen ||
    isQuestsOpen ||
    isPauseMenuOpen ||
    isSaveSlotsOpen ||
    snapshot?.combatState !== undefined;

  const interactionTargets = snapshot
    ? getInteractionTargets(snapshot, gameplaySettings)
    : [];

  const handleSaveGame = () => {
    if (isPlaytest) return;
    setIsPauseMenuOpen(false);
    setIsSaveSlotsOpen(true);
  };

  const handleSaveToSlot = (slotIndex: number) => {
    if (isPlaytest) return;
    const saveData = createSaveData();
    if (!saveData) return;

    const didSave = writeSlot(slotIndex, saveData);
    if (!didSave) {
      pushGameToast({
        message: `Could not save to slot ${slotIndex + 1}.`,
        tone: "default",
      });
      return;
    }

    setIsSaveSlotsOpen(false);
    pushGameToast({
      message: `Game saved to slot ${slotIndex + 1}.`,
      tone: "default",
    });
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

  const triggerZoneEntryDialogue = useCallback(
    (nodes: DialogueNode[]) => {
      triggerDialogue(nodes);
      executeCommand({ type: "AcknowledgeZoneEntryDialogue" });
    },
    [executeCommand, triggerDialogue],
  );

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [snapshot?.log]);

  useZoneEntryDialogue(snapshot, triggerZoneEntryDialogue);
  useGameKeyboardControls({
    activeDialogue,
    audioSettings,
    executeCommand: handleExecuteCommand,
    isCharacterSheetOpen,
    isInteractChoiceOpen,
    isNoticeOpen: gameNotice !== null,
    isInventoryOpen,
    isPauseMenuOpen,
    isQuestsOpen,
    isSaveSlotsOpen,
    isCombatActive: snapshot?.combatState !== undefined,
    keyboardLayout,
    onOpenPauseMenu: () => setIsPauseMenuOpen(true),
    progressDialogue,
    skipDialogueLine,
    setIsCharacterSheetOpen,
    setIsNoticeOpen: (open) => {
      const next = typeof open === "function" ? open(gameNotice !== null) : open;
      if (!next) {
        setGameNotice(null);
      }
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
  const handleExit = isPlaytest ? (onBackToEditor ?? onBackToTitle) : onBackToTitle;

  return (
    <main className="app-shell" aria-labelledby="game-heading">
      {isPlaytest ? (
        <div className="game-playtest-banner">
          <div>
            <p className="terminal-kicker">PLAYTEST</p>
            <p>Running from the current editor draft. Saves are disabled.</p>
          </div>
          <TerminalButton
            className="game-playtest-banner__button"
            onClick={handleExit}
          >
            Back to Editor
          </TerminalButton>
        </div>
      ) : null}
      <div className="game-layout">
        <CharacterStatusPanel
          controlsDisabled={controlsDisabled}
          onOpenInventory={() => setIsInventoryOpen(true)}
          onOpenSheet={() => setIsCharacterSheetOpen(true)}
          onOpenJournal={() => setIsQuestsOpen(true)}
          onRest={() => handleExecuteCommand({ type: "Rest" })}
          onStudy={() => handleExecuteCommand({ type: "Study" })}
          isCombatActive={snapshot.combatState !== undefined}
          stats={snapshot.stats}
          worldTime={snapshot.worldTime}
          keyboardLayout={keyboardLayout}
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
          audioSettings={audioSettings}
        >
          {activeDialogue && activeDialogue[dialogueIndex] && (
            <DialogueBox
              isTyping={isTyping}
              node={activeDialogue[dialogueIndex]}
              onProgress={progressDialogue}
              visibleText={visibleText}
            />
          )}

          <GameToastStack
            onDismiss={dismissGameToast}
            toasts={gameToasts}
          />
        </GameCenterPanel>

        <div className={`game-layout__sidebar-right ${snapshot.activeQuests && snapshot.activeQuests.length > 0 ? "game-layout__sidebar-right--with-quests" : ""}`}>
          {snapshot.activeQuests && snapshot.activeQuests.length > 0 && (
            <TerminalPanel className="game-layout__active-quests">
              <p className="terminal-kicker">OBJECTIVES</p>
              <h2 className="terminal-heading-sm" style={{ marginBottom: "var(--space-2)" }}>Active Quests</h2>
              <div className="active-quests-sidebar">
                {snapshot.activeQuests.map((quest) => {
                  const targetNpcName = getNpcDef(quest.targetNpcId)?.name ?? quest.targetNpcId;
                  return (
                    <div key={quest.questId} className="active-quests-sidebar__item">
                      <p className="active-quests-sidebar__quest-name">{quest.name}</p>
                      <ul className="active-quests-sidebar__obj-list">
                        {quest.objectives.map((obj) => {
                          const met = obj.currentQuantity >= obj.requiredQuantity;
                          return (
                            <li key={obj.id} className={met ? "met" : ""}>
                              <span>{met ? "[x]" : "[ ]"}</span>
                              <span>{obj.description} ({obj.currentQuantity}/{obj.requiredQuantity})</span>
                            </li>
                          );
                        })}
                        {quest.state === "readyToComplete" && (
                          <li>
                            <span>[ ]</span>
                            <span>Return to {targetNpcName}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </TerminalPanel>
          )}

          <ActionLogPanel log={snapshot.log} logRef={logRef} className="game-screen__action-log-panel" />
        </div>

        {isCharacterSheetOpen && (
          <CharacterSheetModal
            audioSettings={audioSettings}
            inventory={snapshot.inventory}
            onChooseAttribute={(attribute) =>
              handleExecuteCommand({ type: "ChooseAttribute", attribute })
            }
            onClose={() => setIsCharacterSheetOpen(false)}
            onUnequipSlot={(slot) =>
              handleExecuteCommand({ type: "Unequip", slot })
            }
            statLayers={snapshot.statLayers}
            stats={snapshot.stats}
          />
        )}

        {isInventoryOpen && (
          <InventoryModal
            audioSettings={audioSettings}
            inventory={snapshot.inventory}
            onClose={() => setIsInventoryOpen(false)}
            onEquipItem={(itemId) =>
              handleExecuteCommand({ type: "Equip", itemId })
            }
            onUseItem={(itemId) =>
              handleExecuteCommand({ type: "UseItem", itemId })
            }
          />
        )}

        {isQuestsOpen && (
          <QuestsModal
            audioSettings={audioSettings}
            isOpen={isQuestsOpen}
            snapshot={snapshot}
            onClose={() => setIsQuestsOpen(false)}
          />
        )}

        {gameNotice !== null && (
          <div
            className="modal-overlay"
            onClick={() => setGameNotice(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setGameNotice(null);
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
                {gameNotice.title}
              </h2>
              <p>{gameNotice.message}</p>
              <div
                className="stats-modal__actions"
                style={{ marginTop: "var(--space-4)" }}
              >
                <TerminalButton onClick={() => setGameNotice(null)}>
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
            canSave={!isPlaytest}
            onClose={() => setIsPauseMenuOpen(false)}
            onOpenOptions={onOpenOptions}
            onQuit={handleExit}
            onSave={handleSaveGame}
            quitLabel={isPlaytest ? "Back to Editor" : "Quit to Title"}
          />
        )}

        {!isPlaytest && isSaveSlotsOpen && (
          <SaveSlotsModal
            audioSettings={audioSettings}
            onClose={() => setIsSaveSlotsOpen(false)}
            onSave={handleSaveToSlot}
            slots={readAllSaves()}
          />
        )}
      </div>
    </main>
  );
}

function getEffectToast(
  effect: EngineEffect,
): Omit<GameToastEntry, "id"> | null {
  if (effect.type === "ItemCollected") {
    return {
      message: getCollectedItemToastMessage(effect),
      tone: getItemToastTone(effect.itemId),
    };
  }

  if (effect.type === "ItemLost") {
    return {
      message: getLostItemToastMessage(effect),
      tone: getItemToastTone(effect.itemId),
    };
  }

  if (effect.type === "ItemUsed") {
    return {
      message: getUsedItemToastMessage(effect),
      tone: getItemToastTone(effect.itemId),
    };
  }

  return null;
}

function getCollectedItemToastMessage(
  effect: Extract<EngineEffect, { type: "ItemCollected" }>,
): string {
  const itemDef = getItemDef(effect.itemId);
  const quantitySuffix = effect.quantity > 1 ? ` x${effect.quantity}` : "";
  const verb = effect.source === "reward" ? "Received" : "Picked up";

  return `${verb} ${itemDef.name}${quantitySuffix}.`;
}

function getLostItemToastMessage(
  effect: Extract<EngineEffect, { type: "ItemLost" }>,
): string {
  const itemDef = getItemDef(effect.itemId);
  const quantitySuffix = effect.quantity > 1 ? ` x${effect.quantity}` : "";
  const verb = effect.source === "quest_turn_in" ? "Gave" : "Lost";

  return `${verb} ${itemDef.name}${quantitySuffix}.`;
}

function getUsedItemToastMessage(
  effect: Extract<EngineEffect, { type: "ItemUsed" }>,
): string {
  const itemDef = getItemDef(effect.itemId);

  if (effect.hpRestored !== undefined) {
    return `Used ${itemDef.name}. Recovered ${effect.hpRestored} HP.`;
  }

  if (effect.energyRestored !== undefined) {
    return `Used ${itemDef.name}. Recovered ${effect.energyRestored} energy.`;
  }

  return `Used ${itemDef.name}.`;
}

function getItemToastTone(itemId: string): GameToastTone {
  return isImportantItemCategory(getItemDef(itemId).category)
    ? "important"
    : "default";
}

function isImportantItemCategory(category: string): boolean {
  return category === "quest" || category === "rare";
}
