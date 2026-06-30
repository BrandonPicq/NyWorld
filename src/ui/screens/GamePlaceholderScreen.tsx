import { TerminalMenu } from "../components/TerminalMenu";
import { TerminalPanel } from "../components/TerminalPanel";

type GamePlaceholderScreenProps = {
  onBackToTitle: () => void;
  onMenuConfirm?: () => void;
  onMenuMove?: () => void;
};

export function GamePlaceholderScreen({
  onBackToTitle,
  onMenuConfirm,
  onMenuMove,
}: GamePlaceholderScreenProps) {
  return (
    <main className="app-shell" aria-labelledby="game-heading">
      <TerminalPanel className="game-placeholder">
        <p className="terminal-kicker">SESSION ACTIVE</p>
        <h1 className="terminal-heading" id="game-heading">
          New Game
        </h1>
        <p className="game-placeholder__copy">
          The gameplay engine will be connected here in the next slice. For
          now, this screen only confirms the flow from the title screen.
        </p>
        <TerminalMenu
          ariaLabel="Game menu"
          items={[{ label: "Back to Title", onSelect: onBackToTitle }]}
          onActivateItem={onMenuConfirm}
          onBack={onBackToTitle}
          onBackAction={onMenuConfirm}
          onMoveSelection={onMenuMove}
        />
      </TerminalPanel>
    </main>
  );
}
