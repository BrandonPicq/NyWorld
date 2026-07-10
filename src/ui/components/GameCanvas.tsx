import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { GridRenderer } from "../../rendering/GridRenderer";
import { pointerToCell, type GridCell } from "../../rendering/canvasCellMapping";
import type { MapCamera } from "../../rendering/mapCamera";
import type { GridRenderSnapshot } from "../../rendering/renderSnapshot";

type GameCanvasProps = {
  ariaLabel?: string;
  cellSize?: number;
  className?: string;
  renderSnapshot: GridRenderSnapshot;
  /** Optional gameplay camera; omitted by the editor for the full-map view. */
  camera?: MapCamera | null;
  /** CSS viewport dimensions used when a gameplay camera is active. */
  viewportSize?: { width: number; height: number };
  /**
   * When provided, the canvas becomes interactive: it maps pointer positions to
   * grid cells (accounting for CSS scaling) and reports press and drag. The
   * game screen omits it and is unaffected.
   */
  onCellPointer?: (cell: GridCell, kind: "down" | "move") => void;
  /**
   * When provided, fires when the pointer moves over grid cells without being pressed,
   * reporting the active grid cell or null if outside.
   */
  onCellHover?: (cell: GridCell | null) => void;
};

export function GameCanvas({
  ariaLabel,
  cellSize = 32,
  className,
  renderSnapshot,
  camera = null,
  viewportSize,
  onCellPointer,
  onCellHover,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GridRenderer | null>(null);
  const pressedRef = useRef(false);
  const snapshotRef = useRef(renderSnapshot);
  const cameraRef = useRef<MapCamera | null>(camera);
  snapshotRef.current = renderSnapshot;
  cameraRef.current = camera;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new GridRenderer(canvas, cellSize);
    if (viewportSize) {
      renderer.setViewportDimensions(
        renderSnapshot.width,
        renderSnapshot.height,
        viewportSize.width,
        viewportSize.height,
      );
    } else {
      renderer.setDimensions(renderSnapshot.width, renderSnapshot.height);
    }
    renderer.setCamera(cameraRef.current);
    rendererRef.current = renderer;
    // Resizing the canvas wipes it; repaint immediately so a cellSize-only
    // change (editor auto-fit) does not leave the map black until the next
    // snapshot arrives. The ref keeps the snapshot out of the deps: widening
    // them would recreate the renderer on every game tick.
    renderer.render(snapshotRef.current);

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [
    cellSize,
    renderSnapshot.height,
    renderSnapshot.width,
    viewportSize?.height,
    viewportSize?.width,
  ]);

  useEffect(() => {
    rendererRef.current?.render(renderSnapshot);
  }, [renderSnapshot]);

  useEffect(() => {
    rendererRef.current?.setCamera(camera);
    rendererRef.current?.render(snapshotRef.current);
  }, [camera]);

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

  const pointerHandlers = onCellPointer || onCellHover
    ? {
        onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => {
          if (!onCellPointer) return;
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
          if (pressedRef.current) {
            if (!onCellPointer) return;
            const cell = cellFromEvent(event);
            if (cell) onCellPointer(cell, "move");
          } else {
            if (!onCellHover) return;
            const cell = cellFromEvent(event);
            onCellHover(cell);
          }
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
        onPointerLeave: () => {
          if (onCellHover) {
            onCellHover(null);
          }
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
