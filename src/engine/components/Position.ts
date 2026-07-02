import type { Component } from "../ecs/types";

/**
 * Grid coordinate for an entity in the active map.
 *
 * Coordinates use (0, 0) at the top-left corner and integer tile positions.
 */
export interface Position extends Component {
  readonly type: "Position";
  x: number;
  y: number;
}
