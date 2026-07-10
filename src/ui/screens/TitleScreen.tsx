import { TerminalMenu } from "../components/TerminalMenu";
import { TerminalPanel } from "../components/TerminalPanel";
import { formatWorldDateTime, type RaceDef } from "../../engine";
import type { GameSaveData } from "../../engine/GameSaveData";
import { SAVE_SLOT_COUNT } from "../save/gameSaveStorage";

type TitleScreenProps = {
  onMenuConfirm?: () => void;
  onMenuMove?: () => void;
  onOpenOptions: () => void;
  onOpenEditor?: () => void;
  onChangeNewGameRace: (raceId: string) => void;
  onStartNewGame: () => void;
  onLoadSlot?: (slotIndex: number) => void;
  newGameRaceId: string;
  notice?: string | null;
  raceOptions: RaceDef[];
  saves: (GameSaveData | null)[];
};

export function TitleScreen({
  onMenuConfirm,
  onMenuMove,
  onOpenOptions,
  onOpenEditor,
  onChangeNewGameRace,
  onStartNewGame,
  onLoadSlot,
  newGameRaceId,
  notice,
  raceOptions,
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
    ...(onOpenEditor
      ? [{ label: "Content Editor", onSelect: onOpenEditor }]
      : []),
  ];

  return (
    <main className="app-shell title-screen" aria-labelledby="title-heading">
      <TerminalPanel className="title-panel">
        <p className="terminal-kicker">NYWARUDO // V0.0.2</p>
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

        <label className="title-race-picker">
          <span>Starting Race</span>
          <select
            onChange={(event) => onChangeNewGameRace(event.target.value)}
            value={newGameRaceId}
          >
            {raceOptions.map((race) => (
              <option key={race.raceId} value={race.raceId}>
                {race.name}
              </option>
            ))}
          </select>
        </label>

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
