import type { WorldTimeSnapshot } from "../../engine";

type WorldClockProps = {
  worldTime: WorldTimeSnapshot;
};

export function WorldClock({ worldTime }: WorldClockProps) {
  const hourDegrees =
    ((worldTime.hour % 12) + worldTime.minute / 60) * 30;
  const minuteDegrees = worldTime.minute * 6;

  return (
    <div
      className="world-clock"
      aria-label={`${worldTime.dateLabel} ${worldTime.timeLabel}`}
    >
      <div className="world-clock__face" aria-hidden="true">
        <span className="world-clock__mark world-clock__mark--12" />
        <span className="world-clock__mark world-clock__mark--3" />
        <span className="world-clock__mark world-clock__mark--6" />
        <span className="world-clock__mark world-clock__mark--9" />
        <span
          className="world-clock__hand world-clock__hand--hour"
          style={{ transform: `translateX(-50%) rotate(${hourDegrees}deg)` }}
        />
        <span
          className="world-clock__hand world-clock__hand--minute"
          style={{ transform: `translateX(-50%) rotate(${minuteDegrees}deg)` }}
        />
        <span className="world-clock__pin" />
      </div>
      <div className="world-clock__readout">
        <p className="world-clock__time">{worldTime.timeLabel}</p>
        <p className="world-clock__date">{worldTime.dateLabel}</p>
      </div>
    </div>
  );
}
