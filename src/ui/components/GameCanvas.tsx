import { useEffect, useRef } from "react";
import { GridRenderer } from "../../rendering/GridRenderer";

type GameCanvasProps = {
  ariaLabel?: string;
  className?: string;
  tiles: number[][];
  playerX: number;
  playerY: number;
  mapWidth: number;
  mapHeight: number;
};

export function GameCanvas({
  ariaLabel,
  className,
  tiles,
  playerX,
  playerY,
  mapWidth,
  mapHeight,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GridRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new GridRenderer(canvas);
    renderer.setDimensions(mapWidth, mapHeight);
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [mapWidth, mapHeight]);

  useEffect(() => {
    rendererRef.current?.render(tiles, playerX, playerY);
  }, [tiles, playerX, playerY]);

  return (
    <canvas
      aria-label={ariaLabel}
      className={className ?? "game-canvas"}
      ref={canvasRef}
      role={ariaLabel ? "img" : undefined}
    />
  );
}
