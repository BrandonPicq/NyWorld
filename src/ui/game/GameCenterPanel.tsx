import type { ReactNode } from "react";
import type { GameCommand, GameSnapshot } from "../../engine";
import { getNpcDef } from "../../engine";
import type { GridRenderSnapshot } from "../../rendering";
import { GameCanvas } from "../components/GameCanvas";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { getInteractKeyLabel, getMovementKeyLabel } from "../controls/gameInput";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import { CombatPanel } from "./CombatPanel";
import type { AudioSettings } from "../audio/audioSettings";

type GameCenterPanelProps = {
  children?: ReactNode;
  controlsDisabled?: boolean;
  isInteractDisabled?: boolean;
  keyboardLayout: KeyboardLayout;
  onExecuteCommand: (command: GameCommand) => void;
  renderSnapshot: GridRenderSnapshot;
  snapshot: GameSnapshot;
  audioSettings: AudioSettings;
};

export function GameCenterPanel({
  children,
  controlsDisabled = false,
  isInteractDisabled = false,
  keyboardLayout,
  onExecuteCommand,
  renderSnapshot,
  snapshot,
  audioSettings,
}: GameCenterPanelProps) {
  return (
    <TerminalPanel className="game-layout__center game-layout__center--overlay">
      {snapshot.combatState ? (
        <CombatPanel
          combatState={snapshot.combatState}
          playerStats={snapshot.stats}
          inventory={snapshot.inventory}
          executeCommand={onExecuteCommand}
          keyboardLayout={keyboardLayout}
          audioSettings={audioSettings}
        />
      ) : (
        <>
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
        </>
      )}

      {children}
    </TerminalPanel>
  );
}
