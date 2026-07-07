import type { CoreAttributes } from "../components/Stats";

export type RaceGrowthMultipliers = Partial<Record<keyof CoreAttributes, number>>;

export interface RaceDef {
  raceId: string;
  name: string;
  description: string;
  growthMultipliers: RaceGrowthMultipliers;
}

export type RaceDefMap = Record<string, RaceDef>;
