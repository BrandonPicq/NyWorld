import type { GridRenderSnapshot } from "../../../rendering/renderSnapshot";
import { GameCanvas } from "../../components/GameCanvas";

type EditorZoneCanvasProps = {
  ariaLabel: string;
  renderSnapshot: GridRenderSnapshot;
};

/**
 * Editor adapter around the shared Canvas 2D grid renderer.
 *
 * It reuses GameCanvas (and therefore GridRenderer) so the editor preview stays
 * pixel-identical to in-game rendering, tagging the canvas with an editor class
 * for layout. Interaction (click-to-cell painting) is added in a later slice.
 */
export function EditorZoneCanvas({
  ariaLabel,
  renderSnapshot,
}: EditorZoneCanvasProps) {
  return (
    <GameCanvas
      ariaLabel={ariaLabel}
      className="editor-zone-canvas"
      renderSnapshot={renderSnapshot}
    />
  );
}
