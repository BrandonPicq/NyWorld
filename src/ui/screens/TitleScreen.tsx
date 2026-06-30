import { TerminalMenu } from "../components/TerminalMenu";
import { TerminalPanel } from "../components/TerminalPanel";

type TitleScreenProps = {
  onMenuConfirm?: () => void;
  onMenuMove?: () => void;
  onOpenOptions: () => void;
  onStartNewGame: () => void;
};

export function TitleScreen({
  onMenuConfirm,
  onMenuMove,
  onOpenOptions,
  onStartNewGame,
}: TitleScreenProps) {
  return (
    <main className="app-shell title-screen" aria-labelledby="title-heading">
      <TerminalPanel className="title-panel">
        <p className="terminal-kicker">NYWARUDO OS // V0 BOOT</p>
        <h1 className="terminal-heading" id="title-heading">
          NyWarudo
        </h1>
        <p className="title-subtitle">
          Fantasy life simulation - terminal prototype
        </p>

        <TerminalMenu
          ariaLabel="Main menu"
          className="title-actions"
          items={[
            { label: "New Game", onSelect: onStartNewGame },
            { label: "Load Game", disabled: true },
            { label: "Options", onSelect: onOpenOptions },
          ]}
          onActivateItem={onMenuConfirm}
          onMoveSelection={onMenuMove}
        />

        <p className="terminal-status">
          &gt; System ready. Save module is not installed yet.
        </p>
      </TerminalPanel>
    </main>
  );
}
