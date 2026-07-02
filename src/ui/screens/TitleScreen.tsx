import { TerminalMenu } from "../components/TerminalMenu";
import { TerminalPanel } from "../components/TerminalPanel";
import { formatWorldDateTime } from "../../engine";
import type { GameSaveData } from "../../engine/GameSaveData";
import { SAVE_SLOT_COUNT } from "../save/gameSaveStorage";

type TitleScreenProps = {
  onMenuConfirm?: () => void;
  onMenuMove?: () => void;
  onOpenOptions: () => void;
  onStartNewGame: () => void;
  onLoadSlot?: (slotIndex: number) => void;
  notice?: string | null;
  saves: (GameSaveData | null)[];
};

export function TitleScreen({
  onMenuConfirm,
  onMenuMove,
  onOpenOptions,
  onStartNewGame,
  onLoadSlot,
  notice,
  saves,
}: TitleScreenProps) {
  const hasAnySave = saves.some((s) => s !== null);

  const menuItems = [
    { label: "New Game", onSelect: onStartNewGame },
    ...(hasAnySave
      ? Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => {
          const save = saves[i];
          if (!save || !onLoadSlot) {
            return { label: `Continue — Slot ${i + 1} — Empty`, disabled: true };
          }
          return {
            label: `Continue — ${save.zoneId} — ${formatWorldDateTime(
              save.worldTimeMinutes,
            )}`,
            onSelect: () => onLoadSlot(i),
          };
        })
      : [{ label: "Continue — No saved games", disabled: true }]),
    { label: "Options", onSelect: onOpenOptions },
  ];

  return (
    <main className="app-shell title-screen" aria-labelledby="title-heading">
      <TerminalPanel className="title-panel">
        <p className="terminal-kicker">NYWARUDO // V0.0.1</p>
        <h1 className="terminal-heading" id="title-heading">
          NyWarudo
        </h1>
        <p className="title-subtitle">
          Fantasy life simulation - terminal prototype
        </p>

        <TerminalMenu
          ariaLabel="Main menu"
          className="title-actions"
          items={menuItems}
          onActivateItem={onMenuConfirm}
          onMoveSelection={onMenuMove}
        />

        {notice && (
          <p className="terminal-status">
            &gt; {notice}
          </p>
        )}

        <p className="terminal-status">
          &gt; System ready. Save module v1 active.
        </p>
      </TerminalPanel>
    </main>
  );
}
