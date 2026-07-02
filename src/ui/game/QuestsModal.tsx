import React from "react";
import type { GameSnapshot } from "../../engine";
import { formatCurrency } from "../controls/statsFormatter";
import { getNpcDef, getQuestDef } from "../../engine";

type QuestsModalProps = {
  isOpen: boolean;
  snapshot: GameSnapshot;
  onClose: () => void;
};

export function QuestsModal({ isOpen, snapshot, onClose }: QuestsModalProps) {
  if (!isOpen) return null;

  const { activeQuests, completedQuests } = snapshot;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container quests-modal"
        onClick={(e) => e.stopPropagation()}
        aria-label="Quest log journal"
      >
        <div className="modal-header">
          <h2>Journal of Adventures</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            [x]
          </button>
        </div>

        <div className="modal-body quests-modal__body">
          <div className="quests-modal__section">
            <h3>Active Quests</h3>
            {activeQuests.length === 0 ? (
              <p className="quests-modal__empty">No active quests in your journal.</p>
            ) : (
              activeQuests.map((quest) => {
                const targetNpcName = getNpcDef(quest.targetNpcId)?.name ?? quest.targetNpcId;
                const isReady = quest.state === "readyToComplete";

                return (
                  <div key={quest.questId} className="quests-modal__item active-quest">
                    <div className="quests-modal__item-header">
                      <span className="quests-modal__quest-name">{quest.name}</span>
                      <span className={`quests-modal__quest-status ${isReady ? "ready" : "ongoing"}`}>
                        {isReady ? "Ready to Complete" : "In Progress"}
                      </span>
                    </div>
                    <p className="quests-modal__quest-desc">{quest.description}</p>
                    
                    <div className="quests-modal__objectives">
                      <h4>Objectives:</h4>
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
                      <h4>Rewards:</h4>
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

          <div className="quests-modal__section">
            <h3>Completed Quests</h3>
            {completedQuests.length === 0 ? (
              <p className="quests-modal__empty">No completed quests yet.</p>
            ) : (
              <ul className="quests-modal__completed-list">
                {completedQuests.map((questId) => {
                  const questDef = getQuestDef(questId);
                  return (
                    <li key={questId} className="quests-modal__completed-item">
                      <span className="objective__checkbox">[x]</span>{" "}
                      <span className="quests-modal__completed-name">{questDef?.name ?? questId}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="terminal-btn" onClick={onClose}>
            Close [Esc]
          </button>
        </div>
      </div>
    </div>
  );
}
