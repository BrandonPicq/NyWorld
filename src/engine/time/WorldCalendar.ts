export const WORLD_MONTH_NAMES = [
  "Aubeclat",
  "Briseterre",
  "Florune",
  "Solmire",
  "Hautsoleil",
  "Cendrelune",
  "Virebrume",
  "Oriseve",
  "Grisfeuille",
  "Longombre",
  "Givrenuit",
  "Veilleaube",
] as const;

export type WorldMonthName = (typeof WORLD_MONTH_NAMES)[number];

export interface WorldDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface WorldTimeSnapshot extends WorldDateTime {
  totalMinutes: number;
  monthName: WorldMonthName;
  dateLabel: string;
  timeLabel: string;
}

export const WORLD_CALENDAR = {
  daysPerMonth: 30,
  hoursPerDay: 24,
  minutesPerHour: 60,
  monthsPerYear: WORLD_MONTH_NAMES.length,
  start: {
    year: 425,
    month: 1,
    day: 1,
    hour: 8,
    minute: 0,
  },
} as const;

export const WORLD_TIME_ACTION_COST = {
  dialogue: 10,
  movement: 10,
  rest: 60,
  useItem: 5,
} as const;

const MINUTES_PER_DAY =
  WORLD_CALENDAR.hoursPerDay * WORLD_CALENDAR.minutesPerHour;
const MINUTES_PER_MONTH = WORLD_CALENDAR.daysPerMonth * MINUTES_PER_DAY;
const MINUTES_PER_YEAR = WORLD_CALENDAR.monthsPerYear * MINUTES_PER_MONTH;

export const START_WORLD_TIME_MINUTES = encodeWorldDateTime(
  WORLD_CALENDAR.start,
);

export function getWorldMinuteOfDay(totalMinutes: number): number {
  const clampedMinutes = Math.max(0, Math.floor(totalMinutes));
  return clampedMinutes % MINUTES_PER_DAY;
}

export function encodeWorldDateTime(dateTime: WorldDateTime): number {
  validateWorldDateTime(dateTime);

  return (
    (dateTime.year - 1) * MINUTES_PER_YEAR +
    (dateTime.month - 1) * MINUTES_PER_MONTH +
    (dateTime.day - 1) * MINUTES_PER_DAY +
    dateTime.hour * WORLD_CALENDAR.minutesPerHour +
    dateTime.minute
  );
}

export function createWorldTimeSnapshot(
  totalMinutes: number,
): WorldTimeSnapshot {
  const clampedMinutes = Math.max(0, Math.floor(totalMinutes));
  const yearIndex = Math.floor(clampedMinutes / MINUTES_PER_YEAR);
  let remaining = clampedMinutes % MINUTES_PER_YEAR;

  const monthIndex = Math.floor(remaining / MINUTES_PER_MONTH);
  remaining %= MINUTES_PER_MONTH;

  const dayIndex = Math.floor(remaining / MINUTES_PER_DAY);
  remaining %= MINUTES_PER_DAY;

  const hour = Math.floor(remaining / WORLD_CALENDAR.minutesPerHour);
  const minute = remaining % WORLD_CALENDAR.minutesPerHour;
  const monthName = WORLD_MONTH_NAMES[monthIndex];
  const year = yearIndex + 1;
  const month = monthIndex + 1;
  const day = dayIndex + 1;
  const timeLabel = `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;

  return {
    totalMinutes: clampedMinutes,
    year,
    month,
    monthName,
    day,
    hour,
    minute,
    dateLabel: `${day} ${monthName} ${year}`,
    timeLabel,
  };
}

export function formatWorldDateTime(totalMinutes: number): string {
  const worldTime = createWorldTimeSnapshot(totalMinutes);
  return `${worldTime.dateLabel}, ${worldTime.timeLabel}`;
}

function validateWorldDateTime(dateTime: WorldDateTime): void {
  if (!Number.isInteger(dateTime.year) || dateTime.year < 1) {
    throw new RangeError("World calendar year must be a positive integer.");
  }

  if (
    !Number.isInteger(dateTime.month) ||
    dateTime.month < 1 ||
    dateTime.month > WORLD_CALENDAR.monthsPerYear
  ) {
    throw new RangeError("World calendar month is outside the valid range.");
  }

  if (
    !Number.isInteger(dateTime.day) ||
    dateTime.day < 1 ||
    dateTime.day > WORLD_CALENDAR.daysPerMonth
  ) {
    throw new RangeError("World calendar day is outside the valid range.");
  }

  if (
    !Number.isInteger(dateTime.hour) ||
    dateTime.hour < 0 ||
    dateTime.hour >= WORLD_CALENDAR.hoursPerDay
  ) {
    throw new RangeError("World calendar hour is outside the valid range.");
  }

  if (
    !Number.isInteger(dateTime.minute) ||
    dateTime.minute < 0 ||
    dateTime.minute >= WORLD_CALENDAR.minutesPerHour
  ) {
    throw new RangeError("World calendar minute is outside the valid range.");
  }
}
