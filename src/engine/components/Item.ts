import type { Component } from "../ecs/types";

/**
 * Component for a collectible item stack placed in the world.
 *
 * spawnKey uniquely identifies this zone placement so saves can remember that
 * it was already collected without removing the item from content data.
 */
export interface Item extends Component {
  readonly type: "Item";
  itemId: string;
  quantity: number;
  spawnKey: string;
}
