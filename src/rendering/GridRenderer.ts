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

    ctx.clearRect(0, 0, mapWidth * cellSize, mapHeight * cellSize);

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tileId = tiles[y]?.[x];

        if (tileId == null) {
          continue;
        }

        this.drawTile(x, y, tileId);
      }
    }

    this.drawPlayer(playerX, playerY);
  }

  private drawTile(x: number, y: number, tileId: number): void {
    const { ctx, cellSize } = this;
    const def = getTileDef(tileId);
    const px = x * cellSize;
    const py = y * cellSize;

    ctx.fillStyle = def.color;
    ctx.fillRect(px, py, cellSize, cellSize);

    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.floor(cellSize * 0.6)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.glyph, px + cellSize / 2, py + cellSize / 2);
  }

  private drawPlayer(x: number, y: number): void {
    const { ctx, cellSize } = this;
    const px = x * cellSize;
    const py = y * cellSize;
    const radius = cellSize * 0.35;

    ctx.fillStyle = "#ffcc00";
    ctx.beginPath();
    ctx.arc(px + cellSize / 2, py + cellSize / 2, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
