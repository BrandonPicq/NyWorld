import type { GridRenderSnapshot, GridRenderTile } from "./renderSnapshot";
import type { MapCamera } from "./mapCamera";

type RenderColors = {
  accent: string;
  bg: string;
  border: string;
  text: string;
};

export class GridRenderer {
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private mapWidth = 0;
  private mapHeight = 0;
  private colors: RenderColors | null = null;
  private lastSnapshot: GridRenderSnapshot | null = null;
  private camera: MapCamera | null = null;
  private observer: MutationObserver | null = null;

  constructor(canvas: HTMLCanvasElement, cellSize = 32) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Unable to acquire 2D rendering context");
    }

    this.ctx = ctx;
    this.cellSize = cellSize;

    if (typeof window !== "undefined" && typeof MutationObserver !== "undefined") {
      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === "data-theme") {
            this.updateColors();
            this.renderLastSnapshot();
          }
        }
      });
      this.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    }
  }

  destroy(): void {
    this.observer?.disconnect();
  }

  setDimensions(mapWidth: number, mapHeight: number): void {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.camera = null;
    this.canvasWidth = mapWidth * this.cellSize;
    this.canvasHeight = mapHeight * this.cellSize;
    this.resizeCanvas();
  }

  /** Configures a fixed-size viewport used by the gameplay map camera. */
  setViewportDimensions(
    mapWidth: number,
    mapHeight: number,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.canvasWidth = Math.max(1, viewportWidth);
    this.canvasHeight = Math.max(1, viewportHeight);
    this.resizeCanvas();
  }

  /** Updates the camera without recreating the renderer or canvas. */
  setCamera(camera: MapCamera | null): void {
    this.camera = camera;
  }

  private resizeCanvas(): void {
    const pixelRatio = getCanvasPixelRatio();

    this.ctx.canvas.width = Math.floor(this.canvasWidth * pixelRatio);
    this.ctx.canvas.height = Math.floor(this.canvasHeight * pixelRatio);
    this.ctx.canvas.style.width = `${this.canvasWidth}px`;
    this.ctx.canvas.style.height = `${this.canvasHeight}px`;
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  private updateColors(): void {
    const style = window.getComputedStyle(this.ctx.canvas);
    this.colors = {
      bg: style.getPropertyValue("--color-background").trim() || "#050806",
      border: style.getPropertyValue("--color-border-muted").trim() || "#25452d",
      text: style.getPropertyValue("--color-text-soft").trim() || "#b7d8bf",
      accent: style.getPropertyValue("--color-accent").trim() || "#7cff9b",
    };
  }

  render(snapshot: GridRenderSnapshot): void {
    this.lastSnapshot = snapshot;

    const { ctx, canvasWidth, canvasHeight, mapWidth, mapHeight } = this;

    if (!this.colors) {
      this.updateColors();
    }

    const colors = this.colors!;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const view = this.getViewTransform();
    const startX = Math.max(0, Math.floor(view.worldLeft) - 1);
    const startY = Math.max(0, Math.floor(view.worldTop) - 1);
    const endX = Math.min(mapWidth, Math.ceil(view.worldRight) + 1);
    const endY = Math.min(mapHeight, Math.ceil(view.worldBottom) + 1);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = snapshot.tiles[y]?.[x];

        if (!tile) {
          continue;
        }

        const hasPlayer = snapshot.player.x === x && snapshot.player.y === y;
        const hasEntity = snapshot.entities.some((e) => e.x === x && e.y === y);
        const isOccupied = hasPlayer || hasEntity;

        this.drawTile(
          x,
          y,
          tile,
          colors,
          isOccupied,
          view.screenX(x),
          view.screenY(y),
          view.cellSize,
        );
      }
    }

    this.drawPlayer(
      snapshot.player.x,
      snapshot.player.y,
      colors.accent,
      view.screenX(snapshot.player.x),
      view.screenY(snapshot.player.y),
      view.cellSize,
    );

    for (const entity of snapshot.entities) {
      this.drawEntity(
        entity.x,
        entity.y,
        entity.glyph,
        entity.color,
        view.screenX(entity.x),
        view.screenY(entity.y),
        view.cellSize,
      );
    }
  }

  private getViewTransform(): ViewTransform {
    if (!this.camera) {
      return {
        cellSize: this.cellSize,
        worldLeft: 0,
        worldTop: 0,
        worldRight: this.mapWidth,
        worldBottom: this.mapHeight,
        screenX: (x) => x * this.cellSize,
        screenY: (y) => y * this.cellSize,
      };
    }

    const cellSize = this.cellSize * this.camera.zoom;
    const worldLeft = this.camera.centerX - this.canvasWidth / (2 * cellSize);
    const worldTop = this.camera.centerY - this.canvasHeight / (2 * cellSize);
    return {
      cellSize,
      worldLeft,
      worldTop,
      worldRight: this.camera.centerX + this.canvasWidth / (2 * cellSize),
      worldBottom: this.camera.centerY + this.canvasHeight / (2 * cellSize),
      screenX: (x) => (x - worldLeft) * cellSize,
      screenY: (y) => (y - worldTop) * cellSize,
    };
  }

  private drawEntity(
    x: number,
    y: number,
    glyph: string,
    color: string,
    px: number,
    py: number,
    cellSize: number,
  ): void {
    const { ctx } = this;

    ctx.fillStyle = color;
    ctx.font = `bold ${Math.floor(cellSize * 0.7)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(glyph, px + cellSize / 2, py + cellSize / 2);
  }

  private renderLastSnapshot(): void {
    if (this.lastSnapshot) {
      this.render(this.lastSnapshot);
    }
  }

  private drawTile(
    x: number,
    y: number,
    tile: GridRenderTile,
    colors: Pick<RenderColors, "bg" | "border" | "text">,
    isOccupied = false,
    px = x * this.cellSize,
    py = y * this.cellSize,
    cellSize = this.cellSize,
  ): void {
    const { ctx } = this;

    if (tile.visibility === "hidden") {
      ctx.fillStyle = "#030303";
      ctx.fillRect(px, py, cellSize, cellSize);
      return;
    }

    const alpha = tile.visibility === "explored" ? 0.32 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = tile.role === "blocked" ? colors.border : colors.bg;
    ctx.fillRect(px, py, cellSize, cellSize);

    if (!isOccupied) {
      ctx.fillStyle = colors.text;
      ctx.font = `${Math.floor(cellSize * 0.6)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tile.glyph, px + cellSize / 2, py + cellSize / 2);
    }
    ctx.restore();
  }

  private drawPlayer(
    x: number,
    y: number,
    colorAccent: string,
    px = x * this.cellSize,
    py = y * this.cellSize,
    cellSize = this.cellSize,
  ): void {
    const { ctx } = this;
    const radius = cellSize * 0.35;

    ctx.fillStyle = colorAccent;
    ctx.beginPath();
    ctx.arc(px + cellSize / 2, py + cellSize / 2, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

type ViewTransform = {
  cellSize: number;
  worldLeft: number;
  worldTop: number;
  worldRight: number;
  worldBottom: number;
  screenX: (x: number) => number;
  screenY: (y: number) => number;
};

function getCanvasPixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  return window.devicePixelRatio || 1;
}
