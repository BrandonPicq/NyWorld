import type { ReactNode } from "react";
import type { GameCommand, GameSnapshot } from "../../engine";
import { getNpcDef } from "../../engine";
import type { GridRenderSnapshot } from "../../rendering";
import { GameCanvas } from "../components/GameCanvas";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { getInteractKeyLabel, getMovementKeyLabel } from "../controls/gameInput";
import type { KeyboardLayout } from "../controls/keyboardLayout";

type GameCenterPanelProps = {
  children?: ReactNode;
  controlsDisabled?: boolean;
  isInteractDisabled?: boolean;
  keyboardLayout: KeyboardLayout;
  onExecuteCommand: (command: GameCommand) => void;
  renderSnapshot: GridRenderSnapshot;
  snapshot: GameSnapshot;
};

export function GameCenterPanel({
  children,
  controlsDisabled = false,
  isInteractDisabled = false,
  keyboardLayout,
  onExecuteCommand,
  renderSnapshot,
  snapshot,
}: GameCenterPanelProps) {
  return (
    <TerminalPanel className="game-layout__center game-layout__center--overlay">
      <p className="terminal-kicker">SESSION ACTIVE</p>
      <h1 className="terminal-heading-md" id="game-heading">
        {snapshot.zoneName}
      </h1>

      <GameCanvas
        ariaLabel="Zone grid"
        className="game-screen__canvas"
        renderSnapshot={renderSnapshot}
      />

      <div className="game-screen__debug">
        <p>
          Position: ({snapshot.playerX}, {snapshot.playerY})
        </p>
        <p>Zone: {snapshot.zoneId}</p>
        <p>Facing: {snapshot.playerFacing}</p>
      </div>

      {snapshot.activeQuests && snapshot.activeQuests.length > 0 && (
        <div className="game-screen__quests-hud">
          <p className="quests-hud__title">Active Objectives</p>
          {snapshot.activeQuests.map((quest) => {
            const targetNpcName = getNpcDef(quest.targetNpcId)?.name ?? quest.targetNpcId;
            return (
              <div key={quest.questId} className="quests-hud__item">
                <span className="quests-hud__quest-name">{quest.name}</span>
                <ul className="quests-hud__objective-list">
                  {quest.objectives.map((obj) => {
                    const met = obj.currentQuantity >= obj.requiredQuantity;
                    return (
                      <li key={obj.id} className={met ? "met" : ""}>
                        <span>{met ? "[x]" : "[ ]"}</span>
                        <span>
                          {obj.description} ({obj.currentQuantity}/{obj.requiredQuantity})
                        </span>
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
      )}

      <div
        className="game-screen__controls"
        role="group"
        aria-label="Game controls"
      >
        <div />
        <TerminalButton
          disabled={controlsDisabled}
          onClick={() => onExecuteCommand({ type: "MoveNorth" })}
        >
          &uarr; North [{getMovementKeyLabel("MoveNorth", keyboardLayout)}]
        </TerminalButton>
        <div />
        <TerminalButton
          disabled={controlsDisabled}
          onClick={() => onExecuteCommand({ type: "MoveWest" })}
        >
          &larr; West [{getMovementKeyLabel("MoveWest", keyboardLayout)}]
        </TerminalButton>
        <TerminalButton
          disabled={controlsDisabled || isInteractDisabled}
          onClick={() => onExecuteCommand({ type: "Interact" })}
        >
          Interact [{getInteractKeyLabel()}]
        </TerminalButton>
        <TerminalButton
          disabled={controlsDisabled}
          onClick={() => onExecuteCommand({ type: "MoveEast" })}
        >
          &rarr; East [{getMovementKeyLabel("MoveEast", keyboardLayout)}]
        </TerminalButton>
        <div />
        <TerminalButton
          disabled={controlsDisabled}
          onClick={() => onExecuteCommand({ type: "MoveSouth" })}
        >
          &darr; South [{getMovementKeyLabel("MoveSouth", keyboardLayout)}]
        </TerminalButton>
        <div />
      </div>

      {children}
    </TerminalPanel>
  );
}
