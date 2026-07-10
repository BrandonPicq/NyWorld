import { describe, expect, it } from "vitest";
import { loadZone } from "../zoneLoader";
import { ExplorationState } from "./ExplorationState";

function createMap(fogOfWar = true) {
  return loadZone({
    version: "0.1",
    zoneId: "misty_fields",
    name: "Misty Fields",
    width: 5,
    height: 5,
    playerStart: { x: 2, y: 2 },
    fogOfWar,
    tiles: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0)),
  });
}

describe("ExplorationState", () => {
  it("discovers a 3x3 local area and keeps it explored after moving away", () => {
    const map = createMap();
    const exploration = new ExplorationState();

    exploration.discoverAround(map, { x: 2, y: 2 });
    expect(exploration.getVisibility(map, { x: 0, y: 0 })[2][2]).toBe("explored");
    expect(exploration.getVisibility(map, { x: 0, y: 0 })[0][4]).toBe("hidden");
    expect(exploration.getVisibility(map, { x: 2, y: 2 })[1][1]).toBe("visible");
  });

  it("reveals authored rectangles and round-trips them through save state", () => {
    const map = createMap();
    const exploration = new ExplorationState();

    expect(exploration.revealArea(map, 3, 0, 2, 2)).toBe(true);
    const restored = new ExplorationState(exploration.getState());

    expect(restored.getVisibility(map, { x: 0, y: 4 })[0][3]).toBe("explored");
    expect(restored.revealArea(map, 4, 4, 2, 1)).toBe(false);
  });

  it("leaves zones without fog fully visible", () => {
    const map = createMap(false);
    const visibility = new ExplorationState().getVisibility(map, { x: 2, y: 2 });

    expect(visibility.flat()).toEqual(Array(25).fill("visible"));
  });
});
