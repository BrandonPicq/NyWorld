import type { Component } from "../ecs/types";

export interface Item extends Component {
  readonly type: "Item";
  itemId: string;
  quantity: number;
  spawnKey: string;
}
