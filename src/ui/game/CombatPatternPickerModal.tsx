import { useEffect, useRef } from "react";
import type { CombatActionCommand, CombatPatternOption } from "../../engine";
import { getCombatActionDef } from "../../engine";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuMoveSound } from "../audio/menuAudio";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import { useMenuKeyboard } from "../hooks/useMenuKeyboard";

type CombatPatternPickerModalProps = {
  actionKind: Extract<CombatActionCommand, "strike" | "cast">;
  audioSettings: AudioSettings;
  basicDisabled: boolean;
  basicAvailabilityNote?: string;
  patterns: CombatPatternOption[];
  onClose: () => void;
  onSelectBasic: () => void;
  onSelectPattern: (patternId: string) => void;
};

export function CombatPatternPickerModal({
  actionKind,
  audioSettings,
  basicDisabled,
  basicAvailabilityNote,
  patterns,
  onClose,
  onSelectBasic,
  onSelectPattern,
}: CombatPatternPickerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rows = [
    {
      kind: "basic" as const,
      id: actionKind,
      disabled: basicDisabled,
      availabilityNote: basicAvailabilityNote,
    },
    ...patterns.map((option) => ({
      kind: "pattern" as const,
      id: option.pattern.patternId,
      option,
      disabled: option.disabled,
      availabilityNote: option.availabilityNote,
    })),
  ];

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleUseSelected = (index: number) => {
    const row = rows[index];
    if (!row || row.disabled) return;
    if (row.kind === "basic") {
      onSelectBasic();
      return;
    }
    onSelectPattern(row.option.pattern.patternId);
  };

  const { selectedIndex, setSelectedIndex, handleKeyDown } = useMenuKeyboard({
    itemCount: rows.length,
    audioSettings,
    enableDirectionalLetterKeys: false,
    onConfirm: handleUseSelected,
    onCancel: onClose,
  });

  const basicDef = getCombatActionDef(actionKind);

  return (
    <div
      aria-label="Combat pattern selection"
      aria-modal="true"
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={(event) => {
        event.stopPropagation();
        handleKeyDown(event);
      }}
      ref={containerRef}
      role="dialog"
      tabIndex={-1}
      style={{ outline: "none" }}
    >
      <TerminalPanel
        className="stats-modal stats-modal--combat-items"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="terminal-kicker">COMBAT PATTERN</p>
        <h2 className="terminal-heading-md">
          {actionKind === "cast" ? "Cast" : "Strike"} Pattern
        </h2>

        <div className="combat-item-modal__content">
          {rows.map((row, index) => {
            const isSelected = index === selectedIndex;
            const name =
              row.kind === "basic" ? basicDef.name : row.option.pattern.name;
            const description =
              row.kind === "basic"
                ? basicDef.summary
                : `${row.option.pattern.description} MP ${row.option.pattern.mpCost}, x${row.option.pattern.damageMultiplier}`;

            return (
              <button
                className={`combat-item-modal__row ${
                  isSelected ? "combat-item-modal__row--selected" : ""
                }`}
                disabled={row.disabled}
                key={`${row.kind}:${row.id}`}
                onClick={() => handleUseSelected(index)}
                onMouseEnter={() => {
                  if (index !== selectedIndex) {
                    setSelectedIndex(index);
                    if (audioSettings.soundEnabled) {
                      playMenuMoveSound();
                    }
                  }
                }}
                type="button"
              >
                <span className="combat-item-modal__main">
                  <span className="combat-item-modal__name">
                    {isSelected ? "> " : ""}
                    {name}
                  </span>
                  <span className="combat-item-modal__description">
                    {description}
                  </span>
                  {row.availabilityNote ? (
                    <span className="combat-action-tooltip__warning">
                      {row.availabilityNote}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={onClose}>Close [Esc]</TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
