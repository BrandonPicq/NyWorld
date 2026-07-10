import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { GridRenderSnapshot } from "../../rendering";
import {
  centerMapCameraOnPlayer,
  clampMapCamera,
  createInitialMapCamera,
  DEFAULT_MAP_CELL_SIZE,
  getMapCameraCellRect,
  panMapCamera,
  zoomMapCamera,
  type MapCamera,
  type MapCameraCellRect,
} from "../../rendering/mapCamera";
import { GameCanvas } from "../components/GameCanvas";
import { TerminalButton } from "../components/TerminalButton";

type GameMapViewportProps = {
  ariaLabel: string;
  mapOverlay?: (playerRect: MapCameraCellRect | undefined) => ReactNode;
  renderSnapshot: GridRenderSnapshot;
  zoneId: string;
};

type ViewportSize = { width: number; height: number };

/**
 * Gameplay-only camera adapter around the shared Canvas renderer.
 *
 * Camera state is UI state: movement still comes exclusively from game
 * commands, while pan and zoom only change which part of the render snapshot
 * is projected into the viewport.
 */
export function GameMapViewport({
  ariaLabel,
  mapOverlay,
  renderSnapshot,
  zoneId,
}: GameMapViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const mapKey = `${zoneId}:${renderSnapshot.width}:${renderSnapshot.height}`;
  const mapKeyRef = useRef<string | null>(null);
  const [viewport, setViewport] = useState<ViewportSize | null>(null);
  const [camera, setCamera] = useState<MapCamera | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame: number | null = null;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setViewport({
          width: Math.max(1, entry.contentRect.width),
          height: Math.max(1, entry.contentRect.height),
        });
      });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!viewport) return;
    const cameraViewport = {
      ...viewport,
      cellSize: DEFAULT_MAP_CELL_SIZE,
    };
    setCamera((current) => {
      if (!current || mapKeyRef.current !== mapKey) {
        mapKeyRef.current = mapKey;
        return createInitialMapCamera(
          renderSnapshot.width,
          renderSnapshot.height,
          renderSnapshot.player.x,
          renderSnapshot.player.y,
          cameraViewport,
        );
      }
      return clampMapCamera(
        current,
        renderSnapshot.width,
        renderSnapshot.height,
        cameraViewport,
      );
    });
  }, [mapKey, renderSnapshot.height, renderSnapshot.width, viewport]);

  useEffect(() => {
    if (!camera || !viewport) return;
    const cameraViewport = {
      ...viewport,
      cellSize: DEFAULT_MAP_CELL_SIZE,
    };
    setCamera((current) =>
      current
        ? centerMapCameraOnPlayer(
            current,
            renderSnapshot.player.x,
            renderSnapshot.player.y,
            renderSnapshot.width,
            renderSnapshot.height,
            cameraViewport,
          )
        : current,
    );
  }, [renderSnapshot.player.x, renderSnapshot.player.y]);

  useEffect(() => {
    const surface = containerRef.current?.querySelector<HTMLDivElement>(
      ".game-map-viewport__surface",
    );
    if (!surface) return;

    // Keep wheel gestures inside the map even when the page itself is taller
    // than the viewport. The native non-passive listener is intentional: it
    // prevents browser scroll chaining before React's delegated listeners run.
    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!viewport) return;
      const cameraViewport = {
        ...viewport,
        cellSize: DEFAULT_MAP_CELL_SIZE,
      };
      updateCamera((current) =>
        zoomMapCamera(
          current,
          event.deltaY < 0 ? 0.1 : -0.1,
          renderSnapshot.width,
          renderSnapshot.height,
          cameraViewport,
        ),
      );
    };

    surface.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => surface.removeEventListener("wheel", handleNativeWheel);
  }, [
    renderSnapshot.height,
    renderSnapshot.width,
    viewport,
  ]);

  function updateCamera(updater: (current: MapCamera) => MapCamera): void {
    setCamera((current) => (current ? updater(current) : current));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !viewport) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    const cameraViewport = {
      ...viewport,
      cellSize: DEFAULT_MAP_CELL_SIZE,
    };
    updateCamera((current) =>
      panMapCamera(
        current,
        deltaX,
        deltaY,
        renderSnapshot.width,
        renderSnapshot.height,
        cameraViewport,
      ),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function centerOnPlayer(): void {
    if (!viewport) return;
    const cameraViewport = {
      ...viewport,
      cellSize: DEFAULT_MAP_CELL_SIZE,
    };
    updateCamera((current) =>
      centerMapCameraOnPlayer(
        current,
        renderSnapshot.player.x,
        renderSnapshot.player.y,
        renderSnapshot.width,
        renderSnapshot.height,
        cameraViewport,
      ),
    );
  }

  function adjustZoom(delta: number): void {
    if (!viewport) return;
    const cameraViewport = {
      ...viewport,
      cellSize: DEFAULT_MAP_CELL_SIZE,
    };
    updateCamera((current) =>
      zoomMapCamera(
        current,
        delta,
        renderSnapshot.width,
        renderSnapshot.height,
        cameraViewport,
      ),
    );
  }

  const playerRect = camera && viewport
    ? getMapCameraCellRect(
        camera,
        renderSnapshot.player.x,
        renderSnapshot.player.y,
        { ...viewport, cellSize: DEFAULT_MAP_CELL_SIZE },
      )
    : undefined;

  return (
    <div className="game-map-viewport" ref={containerRef}>
      <div
        aria-label="Map camera"
        className="game-map-viewport__surface"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="application"
      >
        {viewport && camera ? (
          <GameCanvas
            ariaLabel={ariaLabel}
            camera={camera}
            className="game-screen__canvas"
            renderSnapshot={renderSnapshot}
            viewportSize={viewport}
          />
        ) : null}
        <div
          aria-label="Map camera controls"
          className="game-map-viewport__toolbar"
          onPointerDown={(event) => event.stopPropagation()}
          role="toolbar"
        >
          <TerminalButton
            aria-label="Zoom out"
            className="game-map-viewport__tool"
            onClick={() => adjustZoom(-0.1)}
            title="Zoom out"
          >
            −
          </TerminalButton>
          <TerminalButton
            aria-label="Center map on player"
            className="game-map-viewport__tool"
            onClick={centerOnPlayer}
            title="Center map on player"
          >
            ⌖
          </TerminalButton>
          <TerminalButton
            aria-label="Zoom in"
            className="game-map-viewport__tool"
            onClick={() => adjustZoom(0.1)}
            title="Zoom in"
          >
            +
          </TerminalButton>
        </div>
      </div>
      {mapOverlay?.(playerRect)}
    </div>
  );
}
