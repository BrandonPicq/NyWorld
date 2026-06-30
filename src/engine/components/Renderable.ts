import type { Component } from "../ecs/types";

export interface Renderable extends Component {
  readonly type: "Renderable";
  glyph: string;
  color: string;
}
