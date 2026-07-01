import type { GridRenderSnapshot, GridRenderTile } from "./renderSnapshot";

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
    this.canvasWidth = mapWidth * this.cellSize;
    this.canvasHeight = mapHeight * this.cellSize;

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

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = snapshot.tiles[y]?.[x];

        if (!tile) {
          continue;
        }

        const hasPlayer = snapshot.player.x === x && snapshot.player.y === y;
        const hasEntity = snapshot.entities.some((e) => e.x === x && e.y === y);
        const isOccupied = hasPlayer || hasEntity;

        this.drawTile(x, y, tile, colors, isOccupied);
      }
    }

    this.drawPlayer(snapshot.player.x, snapshot.player.y, colors.accent);

    for (const entity of snapshot.entities) {
      this.drawEntity(entity.x, entity.y, entity.glyph, entity.color);
    }
  }

  private drawEntity(
    x: number,
    y: number,
    glyph: string,
    color: string,
  ): void {
    const { ctx, cellSize } = this;
    const px = x * cellSize;
    const py = y * cellSize;

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
  ): void {
    const { ctx, cellSize } = this;
    const px = x * cellSize;
    const py = y * cellSize;

    ctx.fillStyle = tile.role === "blocked" ? colors.border : colors.bg;
    ctx.fillRect(px, py, cellSize, cellSize);

    if (!isOccupied) {
      ctx.fillStyle = colors.text;
      ctx.font = `${Math.floor(cellSize * 0.6)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tile.glyph, px + cellSize / 2, py + cellSize / 2);
    }
  }

  private drawPlayer(x: number, y: number, colorAccent: string): void {
    const { ctx, cellSize } = this;
    const px = x * cellSize;
    const py = y * cellSize;
    const radius = cellSize * 0.35;

    ctx.fillStyle = colorAccent;
    ctx.beginPath();
    ctx.arc(px + cellSize / 2, py + cellSize / 2, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function getCanvasPixelRatio(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  return window.devicePixelRatio || 1;
}
