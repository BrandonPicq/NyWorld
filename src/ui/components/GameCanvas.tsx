import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { GridRenderer } from "../../rendering/GridRenderer";
import { pointerToCell, type GridCell } from "../../rendering/canvasCellMapping";
import type { GridRenderSnapshot } from "../../rendering/renderSnapshot";

type GameCanvasProps = {
  ariaLabel?: string;
  cellSize?: number;
  className?: string;
  renderSnapshot: GridRenderSnapshot;
  /**
   * When provided, the canvas becomes interactive: it maps pointer positions to
   * grid cells (accounting for CSS scaling) and reports press and drag. The
   * game screen omits it and is unaffected.
   */
  onCellPointer?: (cell: GridCell, kind: "down" | "move") => void;
};

export function GameCanvas({
  ariaLabel,
  cellSize = 32,
  className,
  renderSnapshot,
  onCellPointer,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GridRenderer | null>(null);
  const pressedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new GridRenderer(canvas, cellSize);
    renderer.setDimensions(renderSnapshot.width, renderSnapshot.height);
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [cellSize, renderSnapshot.height, renderSnapshot.width]);

  useEffect(() => {
    rendererRef.current?.render(renderSnapshot);
  }, [renderSnapshot]);

  function cellFromEvent(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): GridCell | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return pointerToCell(
      canvas.getBoundingClientRect(),
      renderSnapshot.width,
      renderSnapshot.height,
      event.clientX,
      event.clientY,
    );
  }

  const pointerHandlers = onCellPointer
    ? {
        onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => {
          const cell = cellFromEvent(event);
          if (!cell) return;
          pressedRef.current = true;
          // Pointer capture keeps a drag painting even if it briefly leaves the
          // canvas; it can throw InvalidStateError, which must not abort paint.
          try {
            canvasRef.current?.setPointerCapture(event.pointerId);
          } catch {
            /* ignore capture failures */
          }
          onCellPointer(cell, "down");
        },
        onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => {
          if (!pressedRef.current) return;
          const cell = cellFromEvent(event);
          if (cell) onCellPointer(cell, "move");
        },
        onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => {
          if (!pressedRef.current) return;
          pressedRef.current = false;
          if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
            canvasRef.current.releasePointerCapture(event.pointerId);
          }
        },
        onPointerCancel: () => {
          pressedRef.current = false;
        },
      }
    : undefined;

  return (
    <canvas
      aria-label={ariaLabel}
      className={className ?? "game-canvas"}
      ref={canvasRef}
      role={ariaLabel ? "img" : undefined}
      {...pointerHandlers}
    />
  );
}
