import React from "react";
import type { GameSnapshot } from "../../engine";
import { formatCurrency } from "../controls/statsFormatter";
import { getNpcDef, getQuestDef } from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { TerminalPanel } from "../components/TerminalPanel";
import type { AudioSettings } from "../audio/audioSettings";
import { playMenuConfirmSound } from "../audio/menuAudio";

type QuestsModalProps = {
  audioSettings: AudioSettings;
  isOpen: boolean;
  snapshot: GameSnapshot;
  onClose: () => void;
};

export function QuestsModal({ audioSettings, isOpen, snapshot, onClose }: QuestsModalProps) {
  if (!isOpen) return null;

  const { activeQuests, completedQuests } = snapshot;

  const handleClose = () => {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <TerminalPanel
        className="stats-modal stats-modal--quests"
        onClick={(e) => e.stopPropagation()}
        aria-label="Quest log journal"
      >
        <p className="terminal-kicker">ADVENTURE RECORD</p>
        <h2 className="terminal-heading-md">Journal of Adventures</h2>

        <div className="stats-modal__content stats-modal__content--quests">
          <div className="stats-modal__section">
            <h3 className="stats-modal__subtitle">Active Quests</h3>
            {activeQuests.length === 0 ? (
              <p className="stats-modal__empty">No active quests in your journal.</p>
            ) : (
              activeQuests.map((quest) => {
                const targetNpcName = getNpcDef(quest.targetNpcId)?.name ?? quest.targetNpcId;
                const isReady = quest.state === "readyToComplete";

                return (
                  <div key={quest.questId} className="quests-modal__item">
                    <div className="quests-modal__item-header">
                      <span className="quests-modal__quest-name">{quest.name}</span>
                      <span className={`quests-modal__quest-status ${isReady ? "ready" : "ongoing"}`}>
                        {isReady ? "Ready to Turn In" : "In Progress"}
                      </span>
                    </div>
                    <p className="quests-modal__quest-desc">{quest.description}</p>
                    
                    <div className="quests-modal__objectives">
                      <h4 className="stats-modal__subtitle" style={{ fontSize: "0.85rem", marginTop: "var(--space-2)", borderBottom: "none" }}>
                        Objectives:
                      </h4>
                      <ul className="quests-modal__objective-list">
                        {quest.objectives.map((obj) => {
                          const met = obj.currentQuantity >= obj.requiredQuantity;
                          return (
                            <li key={obj.id} className={met ? "objective--completed" : "objective--ongoing"}>
                              <span className="objective__checkbox">{met ? "[x]" : "[ ]"}</span>{" "}
                              <span className="objective__desc">
                                {obj.description} ({obj.currentQuantity}/{obj.requiredQuantity})
                              </span>
                            </li>
                          );
                        })}
                        {isReady && (
                          <li className="objective--ongoing">
                            <span className="objective__checkbox">[ ]</span>{" "}
                            <span className="objective__desc">Return to {targetNpcName}</span>
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="quests-modal__rewards">
                      <h4 className="stats-modal__subtitle" style={{ fontSize: "0.85rem", marginTop: "var(--space-2)", borderBottom: "none" }}>
                        Rewards:
                      </h4>
                      <p className="quests-modal__rewards-text">
                        {quest.rewards.currency ? `${formatCurrency(quest.rewards.currency)}` : ""}
                        {quest.rewards.items && quest.rewards.items.map((reward) => {
                          return ` + ${reward.quantity}x ${reward.itemId.replace("_", " ")}`;
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="stats-modal__section" style={{ marginTop: "var(--space-4)" }}>
            <h3 className="stats-modal__subtitle">Completed Quests</h3>
            {completedQuests.length === 0 ? (
              <p className="stats-modal__empty">No completed quests yet.</p>
            ) : (
              <ul className="quests-modal__completed-list" style={{ listStyle: "none", padding: 0 }}>
                {completedQuests.map((questId) => {
                  const questDef = getQuestDef(questId);
                  return (
                    <li key={questId} className="quests-modal__completed-item" style={{ display: "flex", gap: "var(--space-2)" }}>
                      <span className="objective__checkbox">[x]</span>{" "}
                      <span className="quests-modal__completed-name">{questDef?.name ?? questId}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={handleClose}>
            Close [Esc]
          </TerminalButton>
        </div>
      </TerminalPanel>
    </div>
  );
}
