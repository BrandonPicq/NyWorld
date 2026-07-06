import { useEffect, useRef, useState } from "react";
import { computeFitCellSize, type GridCell } from "../../../rendering/canvasCellMapping";
import type { GridRenderSnapshot } from "../../../rendering/renderSnapshot";
import { GameCanvas } from "../../components/GameCanvas";

type EditorZoneCanvasProps = {
  ariaLabel: string;
  cellSize?: number;
  renderSnapshot: GridRenderSnapshot;
  onCellPointer?: (cell: GridCell, kind: "down" | "move") => void;
  onCellHover?: (cell: GridCell | null) => void;
};

/**
 * Editor adapter around the shared Canvas 2D grid renderer.
 *
 * It reuses GameCanvas (and therefore GridRenderer) so the editor preview stays
 * pixel-identical to in-game rendering, tagging the canvas with an editor class
 * for layout. It measures its container to compute a cell size that fits the grid
 * to the viewport.
 */
export function EditorZoneCanvas({
  ariaLabel,
  cellSize: defaultCellSize = 48,
  renderSnapshot,
  onCellPointer,
  onCellHover,
}: EditorZoneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(defaultCellSize);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const { width, height } = entry.contentRect;
        const fitSize = computeFitCellSize(
          width,
          height,
          renderSnapshot.width,
          renderSnapshot.height,
          { min: 20, max: 64 }
        );
        setCellSize(fitSize);
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [renderSnapshot.width, renderSnapshot.height]);

  return (
    <div
      ref={containerRef}
      className="editor-zone-canvas-container"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <GameCanvas
        ariaLabel={ariaLabel}
        cellSize={cellSize}
        className="editor-zone-canvas"
        renderSnapshot={renderSnapshot}
        onCellPointer={onCellPointer}
        onCellHover={onCellHover}
      />
    </div>
  );
}
