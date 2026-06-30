import { useEffect, useRef } from "react";
import { GridRenderer } from "../../rendering/GridRenderer";
import type { GridRenderSnapshot } from "../../rendering/renderSnapshot";

type GameCanvasProps = {
  ariaLabel?: string;
  className?: string;
  renderSnapshot: GridRenderSnapshot;
};

export function GameCanvas({
  ariaLabel,
  className,
  renderSnapshot,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GridRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new GridRenderer(canvas);
    renderer.setDimensions(renderSnapshot.width, renderSnapshot.height);
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [renderSnapshot.height, renderSnapshot.width]);

  useEffect(() => {
    rendererRef.current?.render(renderSnapshot);
  }, [renderSnapshot]);

  return (
    <canvas
      aria-label={ariaLabel}
      className={className ?? "game-canvas"}
      ref={canvasRef}
      role={ariaLabel ? "img" : undefined}
    />
  );
}
