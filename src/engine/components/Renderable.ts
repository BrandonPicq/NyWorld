import type { Component } from "../ecs/types";

/**
 * Minimal map presentation for an entity.
 *
 * Rendering code consumes this as a glyph/color pair and does not decide
 * gameplay behavior from it.
 */
export interface Renderable extends Component {
  readonly type: "Renderable";
  glyph: string;
  color: string;
}
