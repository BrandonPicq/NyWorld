import type { ReactNode } from "react";
import type { GameCommand, GameSnapshot } from "../../engine";
import type { GridRenderSnapshot } from "../../rendering";
import { GameCanvas } from "../components/GameCanvas";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { getInteractKeyLabel, getMovementKeyLabel } from "../controls/gameInput";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import type { GameplaySettings } from "../controls/gameplaySettings";

type GameCenterPanelProps = {
  children?: ReactNode;
  controlsDisabled?: boolean;
  gameplaySettings: GameplaySettings;
  keyboardLayout: KeyboardLayout;
  onExecuteCommand: (command: GameCommand) => void;
  renderSnapshot: GridRenderSnapshot;
  snapshot: GameSnapshot;
};

export function GameCenterPanel({
  children,
  controlsDisabled = false,
  gameplaySettings,
  keyboardLayout,
  onExecuteCommand,
  renderSnapshot,
  snapshot,
}: GameCenterPanelProps) {
  const isInteractDisabled = (() => {
    if (!gameplaySettings.smartInteract) {
      return false;
    }
    const { playerX, playerY } = snapshot;
    return !renderSnapshot.entities.some((entity) => {
      const dx = Math.abs(entity.x - playerX);
      const dy = Math.abs(entity.y - playerY);
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    });
  })();

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
        <p>Tick: {snapshot.tick}</p>
        <p>Zone: {snapshot.zoneId}</p>
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

      {children}
    </TerminalPanel>
  );
}
