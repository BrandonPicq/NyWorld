import type { Component } from "../ecs/types";

/**
 * Player-facing numeric state used by movement, rest, item use, and UI panels.
 */
export interface Stats extends Component {
  readonly type: "Stats";
  energy: number;
  maxEnergy: number;
  /** Total value stored in bronze coins; UI can format it into larger units. */
  currency: number;
  attributes: Record<string, number>;
  academicTitle: string;
  academicProgress: number;
}
