import type { Component } from "../ecs/types";

export interface PlayerControlled extends Component {
  readonly type: "PlayerControlled";
}
