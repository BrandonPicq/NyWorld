import type { Component } from "../ecs/types";

export interface Quests extends Component {
  readonly type: "Quests";
  active: string[];
  completed: string[];
}
