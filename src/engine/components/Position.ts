import type { Component } from "../ecs/types";

export interface Position extends Component {
  readonly type: "Position";
  x: number;
  y: number;
}
