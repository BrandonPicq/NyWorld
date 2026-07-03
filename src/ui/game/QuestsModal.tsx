import React, { useState, useEffect } from "react";
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
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedQuestId !== null) {
        e.preventDefault();
        e.stopPropagation();
        if (audioSettings.soundEnabled) {
          playMenuConfirmSound();
        }
        setSelectedQuestId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [selectedQuestId, audioSettings]);

  if (!isOpen) return null;

  const { activeQuests, completedQuests } = snapshot;

  const handleClose = () => {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
    onClose();
  };

  const handleSelectQuest = (questId: string) => {
    if (audioSettings.soundEnabled) {
      playMenuConfirmSound();
    }
    setSelectedQuestId(questId);
  };

  let detailModal = null;
  if (selectedQuestId) {
    const activeQuest = activeQuests.find((q) => q.questId === selectedQuestId);
    let name = "";
    let description = "";
    let statusLabel = "";
    let statusClass = "";
    let objectives: Array<{ id: string; description: string; currentQuantity: number; requiredQuantity: number }> = [];
    let rewards: { currency?: number; items?: Array<{ itemId: string; quantity: number }> } = {};
    let targetNpcName = "";

    if (activeQuest) {
      name = activeQuest.name;
      description = activeQuest.description;
      const isReady = activeQuest.state === "readyToComplete";
      statusLabel = isReady ? "Ready to Turn In" : "In Progress";
      statusClass = isReady ? "ready" : "ongoing";
      targetNpcName = getNpcDef(activeQuest.targetNpcId)?.name ?? activeQuest.targetNpcId;
      objectives = activeQuest.objectives.map((obj) => ({
        id: obj.id,
        description: obj.description,
        currentQuantity: obj.currentQuantity,
        requiredQuantity: obj.requiredQuantity,
      }));
      if (isReady) {
        objectives.push({
          id: "return_npc",
          description: `Return to ${targetNpcName}`,
          currentQuantity: 0,
          requiredQuantity: 1,
        });
      }
      rewards = activeQuest.rewards;
    } else {
      const questDef = getQuestDef(selectedQuestId);
      if (questDef) {
        name = questDef.name;
        description = questDef.description;
        statusLabel = "Completed";
        statusClass = "completed";
        targetNpcName = getNpcDef(questDef.targetNpcId)?.name ?? questDef.targetNpcId;
        objectives = questDef.objectives.map((obj) => {
          let required = 1;
          if (obj.type === "fetch_item") {
            required = obj.quantity;
          } else if (obj.type === "defeat_npc") {
            required = obj.quantity;
          } else if (obj.type === "stat_threshold") {
            required = obj.threshold;
          }
          return {
            id: obj.id,
            description: obj.description,
            currentQuantity: required,
            requiredQuantity: required,
          };
        });
        rewards = questDef.rewards;
      }
    }

    const closeDetails = () => {
      if (audioSettings.soundEnabled) {
        playMenuConfirmSound();
      }
      setSelectedQuestId(null);
    };

    detailModal = (
      <div
        className="modal-overlay modal-overlay--sub"
        style={{ zIndex: 1010 }}
        onClick={closeDetails}
      >
        <TerminalPanel
          className="stats-modal stats-modal--quest-details"
          onClick={(e) => e.stopPropagation()}
          aria-label="Quest details"
        >
          <p className="terminal-kicker">QUEST DETAILS</p>
          <div className="quests-modal__item-header" style={{ marginBottom: "var(--space-3)" }}>
            <h2 className="terminal-heading-md" style={{ margin: 0 }}>{name}</h2>
            <span className={`quests-modal__quest-status ${statusClass}`}>
              {statusLabel}
            </span>
          </div>

          <div className="stats-modal__content">
            <p className="quests-modal__quest-desc" style={{ fontSize: "0.95rem", marginBottom: "var(--space-4)", color: "var(--color-text-strong)" }}>
              {description}
            </p>

            <div className="quests-modal__objectives" style={{ marginBottom: "var(--space-4)" }}>
              <h3 className="stats-modal__subtitle" style={{ fontSize: "0.9rem", borderBottom: "1px dashed var(--color-border-muted)", paddingBottom: "var(--space-1)", marginBottom: "var(--space-2)" }}>
                Objectives
              </h3>
              <ul className="quests-modal__objective-list">
                {objectives.map((obj) => {
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
              </ul>
            </div>

            <div className="quests-modal__rewards">
              <h3 className="stats-modal__subtitle" style={{ fontSize: "0.9rem", borderBottom: "1px dashed var(--color-border-muted)", paddingBottom: "var(--space-1)", marginBottom: "var(--space-2)" }}>
                Rewards
              </h3>
              {rewards.currency || (rewards.items && rewards.items.length > 0) ? (
                <p className="quests-modal__rewards-text" style={{ fontSize: "0.9rem" }}>
                  {rewards.currency ? `${formatCurrency(rewards.currency)}` : ""}
                  {rewards.items && rewards.items.map((reward) => {
                    return ` + ${reward.quantity}x ${reward.itemId.replace("_", " ")}`;
                  })}
                </p>
              ) : (
                <p className="stats-modal__empty">No rewards for this quest.</p>
              )}
            </div>
          </div>

          <div className="stats-modal__actions" style={{ marginTop: "var(--space-4)" }}>
            <TerminalButton onClick={closeDetails}>
              Back [Esc]
            </TerminalButton>
          </div>
        </TerminalPanel>
      </div>
    );
  }

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
              <div className="quests-modal__list">
                {activeQuests.map((quest) => {
                  const isReady = quest.state === "readyToComplete";
                  return (
                    <button
                      key={quest.questId}
                      className="quests-modal__list-button"
                      onClick={() => handleSelectQuest(quest.questId)}
                    >
                      <span className="quests-modal__quest-name">{quest.name}</span>
                      <span className={`quests-modal__quest-status ${isReady ? "ready" : "ongoing"}`}>
                        {isReady ? "Ready" : "Active"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="stats-modal__section" style={{ marginTop: "var(--space-4)" }}>
            <h3 className="stats-modal__subtitle">Completed Quests</h3>
            {completedQuests.length === 0 ? (
              <p className="stats-modal__empty">No completed quests yet.</p>
            ) : (
              <div className="quests-modal__list">
                {completedQuests.map((questId) => {
                  const questDef = getQuestDef(questId);
                  return (
                    <button
                      key={questId}
                      className="quests-modal__list-button quests-modal__list-button--completed"
                      onClick={() => handleSelectQuest(questId)}
                    >
                      <span className="quests-modal__quest-name">{questDef?.name ?? questId}</span>
                      <span className="quests-modal__quest-status completed">
                        Completed
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="stats-modal__actions">
          <TerminalButton onClick={handleClose}>
            Close [Esc]
          </TerminalButton>
        </div>
      </TerminalPanel>

      {detailModal}
    </div>
  );
}
