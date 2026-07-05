import type { GridCell } from "../../../rendering/canvasCellMapping";
import type { GridRenderSnapshot } from "../../../rendering/renderSnapshot";
import { GameCanvas } from "../../components/GameCanvas";

type EditorZoneCanvasProps = {
  ariaLabel: string;
  renderSnapshot: GridRenderSnapshot;
  onCellPointer?: (cell: GridCell, kind: "down" | "move") => void;
};

/**
 * Editor adapter around the shared Canvas 2D grid renderer.
 *
 * It reuses GameCanvas (and therefore GridRenderer) so the editor preview stays
 * pixel-identical to in-game rendering, tagging the canvas with an editor class
 * for layout. Passing onCellPointer turns the preview into a paint surface.
 */
export function EditorZoneCanvas({
  ariaLabel,
  renderSnapshot,
  onCellPointer,
}: EditorZoneCanvasProps) {
  return (
    <GameCanvas
      ariaLabel={ariaLabel}
      className="editor-zone-canvas"
      renderSnapshot={renderSnapshot}
      onCellPointer={onCellPointer}
    />
  );
}
