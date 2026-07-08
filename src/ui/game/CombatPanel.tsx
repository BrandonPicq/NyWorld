import { useCallback, useEffect, useMemo, useState } from "react";
import type { Inventory, Stats } from "../../engine/components";
import type { CombatState } from "../../engine/GameplayEngine";
import type {
  CombatActionCommand,
  CombatActionDef,
  CombatActionId,
  GameCommand,
  KnownPatternMap,
} from "../../engine";
import {
  getAllCombatActionDefs,
  getCombatPatternOptions,
  getItemDef,
} from "../../engine";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import type { AudioSettings } from "../audio/audioSettings";
import {
  playMenuConfirmSound,
  playMenuMoveSound,
} from "../audio/menuAudio";
import { TerminalPanel } from "../components/TerminalPanel";
import { TerminalButton } from "../components/TerminalButton";
import { CombatActionDetailsModal } from "./CombatActionDetailsModal";
import { CombatItemPickerModal } from "./CombatItemPickerModal";
import { CombatPatternPickerModal } from "./CombatPatternPickerModal";
import { SequenceMinigame } from "./combat/SequenceMinigame";
import { MashMinigame } from "./combat/MashMinigame";
import { TimingMinigame } from "./combat/TimingMinigame";

type CombatMenuAction = {
  id: CombatActionId;
  def: CombatActionDef;
  commandKind?: CombatActionCommand;
  disabled: boolean;
  availabilityNote?: string;
};

type CombatPanelProps = {
  combatState: CombatState;
  playerStats: Stats;
  knownPatterns: KnownPatternMap;
  inventory: Inventory;
  executeCommand: (command: GameCommand) => void;
  keyboardLayout: KeyboardLayout;
  audioSettings: AudioSettings;
};

const COMBAT_ACTION_COLUMNS = 3;

export function CombatPanel({
  combatState,
  playerStats,
  knownPatterns,
  inventory,
  executeCommand,
  keyboardLayout,
  audioSettings,
}: CombatPanelProps) {
  const { phase, opponentName, opponentStats, minigame } = combatState;
  const combatActionDefs = useMemo(() => getAllCombatActionDefs(), []);
  const combatItems = useMemo(
    () =>
      inventory.items.filter(
        (stack) => getItemDef(stack.itemId).category === "consumable",
      ),
    [inventory.items],
  );

  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [patternPickerAction, setPatternPickerAction] = useState<
    "strike" | "cast" | null
  >(null);
  const [isActionDetailsOpen, setIsActionDetailsOpen] = useState(false);
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);

  const patternOptions = useMemo(
    () => ({
      strike: getCombatPatternOptions({
        actionKind: "strike",
        knownPatterns,
        inventory,
        playerStats,
      }),
      cast: getCombatPatternOptions({
        actionKind: "cast",
        knownPatterns,
        inventory,
        playerStats,
      }),
    }),
    [inventory, knownPatterns, playerStats],
  );
  const combatActions = useMemo<CombatMenuAction[]>(
    () =>
      combatActionDefs.map((def) => {
        if (def.actionId === "use_item") {
          return {
            id: def.actionId,
            def,
            disabled: combatItems.length === 0,
            availabilityNote:
              combatItems.length === 0 ? "No usable combat item." : undefined,
          };
        }

        const actionPatternOptions =
          def.actionId === "strike" || def.actionId === "cast"
            ? patternOptions[def.actionId]
            : [];
        const hasEnabledPattern = actionPatternOptions.some(
          (option) => !option.disabled,
        );
        const isBasicCastUnavailable =
          def.actionId === "cast" && playerStats.resources.mp < 10;
        const isDisabled = isBasicCastUnavailable && !hasEnabledPattern;

        return {
          id: def.actionId,
          def,
          commandKind: def.actionId,
          disabled: isDisabled,
          availabilityNote:
            isBasicCastUnavailable && !hasEnabledPattern
              ? "Not enough MP."
              : undefined,
        };
      }),
    [
      combatActionDefs,
      combatItems.length,
      patternOptions,
      playerStats.resources.mp,
    ],
  );
  const selectedAction = combatActions[selectedActionIndex];

  // Close the action modals when leaving the selection phase.
  useEffect(() => {
    if (phase !== "action_selection") {
      setIsItemPickerOpen(false);
      setPatternPickerAction(null);
      setIsActionDetailsOpen(false);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "action_selection") return;
    const selectedAction = combatActions[selectedActionIndex];
    if (!selectedAction || selectedAction.disabled) {
      setSelectedActionIndex(findFirstEnabledActionIndex(combatActions));
    }
  }, [
    combatActions,
    combatItems.length,
    phase,
    playerStats.resources.mp,
    selectedActionIndex,
  ]);

  const moveCombatActionSelection = useCallback((step: number) => {
    setSelectedActionIndex((currentIndex) => {
      const nextIndex = findNextEnabledActionIndex(
        combatActions,
        currentIndex,
        step,
      );

      if (nextIndex !== currentIndex && audioSettings.soundEnabled) {
        playMenuMoveSound();
      }

      return nextIndex;
    });
  }, [audioSettings.soundEnabled, combatActions]);

  const activateCombatAction = useCallback((action: CombatMenuAction) => {
    if (action.disabled) return;

    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }

    if (action.id === "use_item") {
      setIsItemPickerOpen(true);
      return;
    }

    if (
      (action.id === "strike" || action.id === "cast") &&
      patternOptions[action.id].length > 0
    ) {
      setPatternPickerAction(action.id);
      return;
    }

    if (action.commandKind) {
      executeCommand({
        type: "SelectCombatAction",
        actionKind: action.commandKind,
      });
    }
  }, [audioSettings.soundEnabled, executeCommand]);

  const openSelectedActionDetails = useCallback(() => {
    if (!selectedAction) return;

    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
    setIsActionDetailsOpen(true);
  }, [audioSettings.soundEnabled, selectedAction]);

  // Action selection menu controls
  useEffect(() => {
    if (
      phase !== "action_selection" ||
      isItemPickerOpen ||
      patternPickerAction ||
      isActionDetailsOpen
    ) {
      return;
    }

    function handleSelectionKeys(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveCombatActionSelection(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        moveCombatActionSelection(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveCombatActionSelection(-COMBAT_ACTION_COLUMNS);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveCombatActionSelection(COMBAT_ACTION_COLUMNS);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selectedAction = combatActions[selectedActionIndex];
        if (selectedAction) {
          activateCombatAction(selectedAction);
        }
      } else if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        openSelectedActionDetails();
      }
    }

    window.addEventListener("keydown", handleSelectionKeys);
    return () => window.removeEventListener("keydown", handleSelectionKeys);
  }, [
    combatActions,
    isActionDetailsOpen,
    isItemPickerOpen,
    patternPickerAction,
    moveCombatActionSelection,
    openSelectedActionDetails,
    phase,
    selectedActionIndex,
    activateCombatAction,
  ]);

  // Victory / Defeat space/enter keys to conclude
  useEffect(() => {
    if (phase !== "victory" && phase !== "defeat") return;

    function handleConcludeKeys(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        executeCommand({ type: "ConcludeCombat" });
      }
    }

    window.addEventListener("keydown", handleConcludeKeys);
    return () => window.removeEventListener("keydown", handleConcludeKeys);
  }, [phase, executeCommand]);

  // Opponent turn transitional pause
  useEffect(() => {
    if (phase !== "opponent_turn_transition") return;

    const timer = setTimeout(() => {
      executeCommand({ type: "StartOpponentTurn" });
    }, 1500);

    return () => clearTimeout(timer);
  }, [phase, executeCommand]);

  return (
    <TerminalPanel className="combat-panel">
      <div className="combat-layout">
        {/* Header */}
        <div className="combat-header">
          <span className="terminal-kicker">COMBAT ENCOUNTER</span>
          <h2 className="terminal-heading-md">VERSUS {opponentName.toUpperCase()}</h2>
        </div>

        {/* Combat Statuses */}
        <div className="combat-stats-row">
          {/* Player stats */}
          <div className="combat-stats-box combat-stats-box--player">
            <h3 className="combat-stats-title">You</h3>
            <div className="combat-bar-row">
              <span>HP</span>
              <div className="combat-bar-container">
                <div
                  className="combat-bar-fill combat-bar-fill--hp"
                  style={{ width: `${(playerStats.resources.hp / playerStats.resources.maxHp) * 100}%` }}
                />
                <span className="combat-bar-text">
                  {playerStats.resources.hp} / {playerStats.resources.maxHp}
                </span>
              </div>
            </div>
            <div className="combat-stats-details">
              <span>ATK: {playerStats.combat.attack}</span>
              <span>DEF: {playerStats.combat.defense}</span>
              <span>AGI: {playerStats.attributes.agility}</span>
              <span>SPI: {playerStats.attributes.spirit}</span>
            </div>
          </div>

          {/* Opponent stats */}
          <div className="combat-stats-box combat-stats-box--opponent">
            <h3 className="combat-stats-title">{opponentName}</h3>
            <div className="combat-bar-row">
              <span>HP</span>
              <div className="combat-bar-container">
                <div
                  className="combat-bar-fill combat-bar-fill--opponent-hp"
                  style={{ width: `${(opponentStats.resources.hp / opponentStats.resources.maxHp) * 100}%` }}
                />
                <span className="combat-bar-text">
                  {opponentStats.resources.hp} / {opponentStats.resources.maxHp}
                </span>
              </div>
            </div>
            <div className="combat-stats-details">
              <span>ATK: {opponentStats.combat.attack}</span>
              <span>DEF: {opponentStats.combat.defense}</span>
              <span>AGI: {opponentStats.attributes.agility}</span>
              <span>SPI: {opponentStats.attributes.spirit}</span>
            </div>
          </div>
        </div>

        {/* Phase Main Rendering Area */}
        <div className="combat-phase-area">
          {phase === "action_selection" && (
            <div className="combat-actions-menu">
              <p className="combat-phase-instruction">Choose your combat action:</p>
              <div className="combat-actions-buttons">
                {combatActions.map((action, index) => (
                  <TerminalButton
                    aria-label={`${action.def.name}. ${action.def.summary} Press I for details.`}
                    className="combat-action-button"
                    disabled={action.disabled}
                    isSelected={index === selectedActionIndex}
                    key={action.id}
                    onClick={() => activateCombatAction(action)}
                    onMouseEnter={() => {
                      if (!action.disabled) {
                        setSelectedActionIndex(index);
                      }
                    }}
                  >
                    <span className="combat-action-button__label">
                      {action.def.name}
                    </span>
                    <span className="combat-action-tooltip" role="tooltip">
                      <span className="combat-action-tooltip__summary">
                        {action.def.summary}
                      </span>
                      <span className="combat-action-tooltip__line">
                        <strong>Formula:</strong> {action.def.formula}
                      </span>
                      <span className="combat-action-tooltip__line">
                        <strong>Effects:</strong>{" "}
                        {formatConciseEffects(action.def.effects)}
                      </span>
                      {action.availabilityNote && (
                        <span className="combat-action-tooltip__warning">
                          {action.availabilityNote}
                        </span>
                      )}
                      <span className="combat-action-tooltip__hint">
                        Press I for details
                      </span>
                    </span>
                  </TerminalButton>
                ))}
              </div>
            </div>
          )}

          {(phase === "player_qte" || phase === "enemy_qte") &&
            minigame?.kind === "sequence" && (
              <SequenceMinigame
                audioSettings={audioSettings}
                executeCommand={executeCommand}
                keyboardLayout={keyboardLayout}
                phase={phase}
                spec={minigame}
              />
            )}

          {(phase === "player_qte" || phase === "enemy_qte") &&
            minigame?.kind === "mash" && (
              <MashMinigame
                audioSettings={audioSettings}
                executeCommand={executeCommand}
                keyboardLayout={keyboardLayout}
                phase={phase}
                spec={minigame}
              />
            )}

          {(phase === "player_qte" || phase === "enemy_qte") &&
            minigame?.kind === "timing" && (
              <TimingMinigame
                audioSettings={audioSettings}
                executeCommand={executeCommand}
                keyboardLayout={keyboardLayout}
                phase={phase}
                spec={minigame}
              />
            )}

          {phase === "opponent_turn_transition" && (
            <div className="combat-result-menu">
              <h3 className="combat-result-title" style={{ color: "var(--color-text-soft)" }}>PREPARING</h3>
              <p className="combat-result-text">The {opponentName} is preparing to attack...</p>
              <p className="combat-loot-text">Get ready to defend!</p>
            </div>
          )}

          {phase === "victory" && (
            <div className="combat-result-menu">
              <h3 className="combat-result-title combat-result-title--victory">VICTORY</h3>
              <p className="combat-result-text">You successfully defeated the {opponentName}!</p>
              {opponentName.toLowerCase() === "slime" && (
                <p className="combat-loot-text">Loot found: 1x [Slime Remains]</p>
              )}
              {opponentName.toLowerCase() === "kobold" && (
                <p className="combat-loot-text">Loot found: 1x [Kobold Remains]</p>
              )}
              <div className="combat-result-actions">
                <TerminalButton onClick={() => executeCommand({ type: "ConcludeCombat" })}>
                  Conclude Combat [Space]
                </TerminalButton>
              </div>
            </div>
          )}

          {phase === "defeat" && (
            <div className="combat-result-menu">
              <h3 className="combat-result-title combat-result-title--defeat">DEFEAT</h3>
              <p className="combat-result-text">You were knocked unconscious by the {opponentName}...</p>
              <p className="combat-loot-text">Teleporting back to safety with partial recovery.</p>
              <div className="combat-result-actions">
                <TerminalButton onClick={() => executeCommand({ type: "ConcludeCombat" })}>
                  Conclude Combat [Space]
                </TerminalButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {isItemPickerOpen && (
        <CombatItemPickerModal
          audioSettings={audioSettings}
          items={combatItems}
          onClose={() => setIsItemPickerOpen(false)}
          onUseItem={(itemId) => {
            setIsItemPickerOpen(false);
            executeCommand({ type: "UseItem", itemId });
          }}
        />
      )}

      {patternPickerAction && (
        <CombatPatternPickerModal
          actionKind={patternPickerAction}
          audioSettings={audioSettings}
          basicAvailabilityNote={
            patternPickerAction === "cast" && playerStats.resources.mp < 10
              ? "Not enough MP."
              : undefined
          }
          basicDisabled={
            patternPickerAction === "cast" && playerStats.resources.mp < 10
          }
          onClose={() => setPatternPickerAction(null)}
          onSelectBasic={() => {
            executeCommand({
              type: "SelectCombatAction",
              actionKind: patternPickerAction,
            });
            setPatternPickerAction(null);
          }}
          onSelectPattern={(patternId) => {
            executeCommand({
              type: "SelectCombatPattern",
              actionKind: patternPickerAction,
              patternId,
            });
            setPatternPickerAction(null);
          }}
          patterns={patternOptions[patternPickerAction]}
        />
      )}

      {isActionDetailsOpen && selectedAction && (
        <CombatActionDetailsModal
          action={selectedAction.def}
          audioSettings={audioSettings}
          onClose={() => setIsActionDetailsOpen(false)}
        />
      )}
    </TerminalPanel>
  );
}

function formatConciseEffects(effects: string[]): string {
  return effects.slice(0, 2).join(" ");
}

function findFirstEnabledActionIndex(actions: CombatMenuAction[]): number {
  const index = actions.findIndex((action) => !action.disabled);
  return index >= 0 ? index : 0;
}

function findNextEnabledActionIndex(
  actions: CombatMenuAction[],
  currentIndex: number,
  step: number,
): number {
  let nextIndex = currentIndex + step;

  while (nextIndex >= 0 && nextIndex < actions.length) {
    if (!actions[nextIndex].disabled) {
      return nextIndex;
    }
    nextIndex += step;
  }

  return currentIndex;
}
