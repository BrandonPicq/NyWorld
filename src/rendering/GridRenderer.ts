import { getTileDef } from "../engine/TileRegistry";

export class GridRenderer {
  private ctx: CanvasRenderingContext2D;
  private cellSize: number;
  private mapWidth = 0;
  private mapHeight = 0;

  constructor(canvas: HTMLCanvasElement, cellSize = 32) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Unable to acquire 2D rendering context");
    }

    this.ctx = ctx;
    this.cellSize = cellSize;
  }

  setDimensions(mapWidth: number, mapHeight: number): void {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    this.ctx.canvas.width = mapWidth * this.cellSize;
    this.ctx.canvas.height = mapHeight * this.cellSize;
  }

  render(tiles: number[][], playerX: number, playerY: number): void {
    const { ctx, cellSize, mapWidth, mapHeight } = this;

    // Fetch theme colors dynamically from the canvas element style
    const style = window.getComputedStyle(ctx.canvas);
    const colorBg = style.getPropertyValue("--color-background").trim() || "#050806";
    const colorBorder = style.getPropertyValue("--color-border-muted").trim() || "#25452d";
    const colorText = style.getPropertyValue("--color-text-soft").trim() || "#b7d8bf";
    const colorAccent = style.getPropertyValue("--color-accent").trim() || "#7cff9b";

    ctx.clearRect(0, 0, mapWidth * cellSize, mapHeight * cellSize);

    const colors = { bg: colorBg, border: colorBorder, text: colorText, accent: colorAccent };

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tileId = tiles[y]?.[x];

        if (tileId == null) {
          continue;
        }

        this.drawTile(x, y, tileId, colors);
      }
    }

    this.drawPlayer(playerX, playerY, colors.accent);
  }

  private drawTile(
    x: number,
    y: number,
    tileId: number,
    colors: { bg: string; border: string; text: string },
  ): void {
    const { ctx, cellSize } = this;
    const def = getTileDef(tileId);
    const px = x * cellSize;
    const py = y * cellSize;

    // Floor (0) uses background, Wall (1) uses border/panel color
    ctx.fillStyle = tileId === 1 ? colors.border : colors.bg;
    ctx.fillRect(px, py, cellSize, cellSize);

    ctx.fillStyle = colors.text;
    ctx.font = `${Math.floor(cellSize * 0.6)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.glyph, px + cellSize / 2, py + cellSize / 2);
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
