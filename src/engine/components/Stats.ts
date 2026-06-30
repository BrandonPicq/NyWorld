export interface Stats {
  type: "Stats";
  energy: number;
  maxEnergy: number;
  currency: number; // Total value in Bronze coins
  attributes: Record<string, number>;
  academicTitle: string;
  academicProgress: number;
}
