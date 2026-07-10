import type { GameSnapshot } from "../../engine";

type ActiveObjectivesOverlayProps = {
  activeQuests: GameSnapshot["activeQuests"];
};

type EventDebugOverlayProps = {
  firedEventIds: GameSnapshot["firedEventIds"];
  worldFlags: GameSnapshot["worldFlags"];
};

/** Keeps active quest progress visible without consuming a permanent sidebar. */
export function ActiveObjectivesOverlay({
  activeQuests,
}: ActiveObjectivesOverlayProps) {
  if (activeQuests.length === 0) return null;

  return (
    <section
      aria-label="Active objectives"
      className="game-overlay-band game-objectives-overlay"
    >
      <p className="terminal-kicker">OBJECTIVES</p>
      <div className="game-objectives-overlay__list">
        {activeQuests.map((quest) => {
          const completed = quest.objectives.filter(
            (objective) => objective.currentQuantity >= objective.requiredQuantity,
          ).length;

          return (
            <div className="game-objectives-overlay__quest" key={quest.questId}>
              <span className="game-objectives-overlay__name">{quest.name}</span>
              <span className="game-objectives-overlay__progress">
                {completed}/{quest.objectives.length}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Exposes playtest-only world state while keeping the game viewport primary. */
export function EventDebugOverlay({
  firedEventIds,
  worldFlags,
}: EventDebugOverlayProps) {
  return (
    <section
      aria-label="Event debug"
      className="game-overlay-band game-event-debug-overlay"
    >
      <p className="terminal-kicker">EVENT DEBUG</p>
      <p>Flags: {worldFlags?.join(", ") || "none"}</p>
      <p>Fired: {firedEventIds?.join(", ") || "none"}</p>
    </section>
  );
}
