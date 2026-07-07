import type {
  ContentCatalogSnapshot,
  ContentValidationContext,
  RaceDef,
} from "../../../engine";
import { cloneRaceDef } from "../../../engine";

export interface EditorRaceEntry {
  raceId: string;
  name: string;
}

export function listRaceDefs(races: readonly RaceDef[]): EditorRaceEntry[] {
  return races
    .map((race) => ({
      raceId: race.raceId,
      name: race.name,
    }))
    .sort((a, b) => a.raceId.localeCompare(b.raceId));
}

export function raceContentPath(raceId: string): string {
  return `src/content/races/${raceId}.json`;
}

export function cloneRaceDefs(races: readonly RaceDef[]): RaceDef[] {
  return races.map(cloneRaceDef);
}

export function createRaceDraftState(snapshot: ContentCatalogSnapshot): RaceDef[] {
  return cloneRaceDefs(snapshot.races);
}

export function createRaceDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftRaces: readonly RaceDef[],
): ContentCatalogSnapshot {
  return {
    ...snapshot,
    races: cloneRaceDefs(draftRaces),
  };
}

export function createRaceDraftValidationContext(
  context: ContentValidationContext,
  draftRaces: readonly RaceDef[],
): ContentValidationContext {
  return {
    ...context,
    raceIds: new Set(draftRaces.map((race) => race.raceId)),
  };
}

export function serializeRaceDef(race: RaceDef): string {
  return JSON.stringify(race, null, 2);
}

export function serializeRaceDefsById(races: readonly RaceDef[]): Map<string, string> {
  return new Map(races.map((race) => [race.raceId, serializeRaceDef(race)]));
}

export function updateRaceDef(
  races: readonly RaceDef[],
  raceId: string,
  updater: (race: RaceDef) => RaceDef,
): RaceDef[] {
  return races.map((race) =>
    race.raceId === raceId
      ? cloneRaceDef(updater(cloneRaceDef(race)))
      : cloneRaceDef(race),
  );
}

export function upsertRaceDef(
  races: readonly RaceDef[],
  race: RaceDef,
): RaceDef[] {
  const exists = races.some((entry) => entry.raceId === race.raceId);
  const next = exists
    ? races.map((entry) =>
        entry.raceId === race.raceId ? cloneRaceDef(race) : cloneRaceDef(entry),
      )
    : [...races, cloneRaceDef(race)];

  return next.sort((a, b) => a.raceId.localeCompare(b.raceId));
}
