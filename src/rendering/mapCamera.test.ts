import { describe, expect, it } from "vitest";
import {
  centerMapCameraOnPlayer,
  clampMapCamera,
  createInitialMapCamera,
  getMapCameraCellRect,
  panMapCamera,
  zoomMapCamera,
  type MapCameraViewport,
} from "./mapCamera";

const viewport: MapCameraViewport = { width: 320, height: 240, cellSize: 32 };

describe("mapCamera", () => {
  it("fits a small map when it can and centers it", () => {
    expect(createInitialMapCamera(5, 4, 1, 1, viewport)).toEqual({
      centerX: 2.5,
      centerY: 2,
      zoom: 1.875,
    });
  });

  it("starts a large map around the player at readable zoom", () => {
    expect(createInitialMapCamera(40, 30, 20, 15, viewport)).toEqual({
      centerX: 20.5,
      centerY: 15.5,
      zoom: 1,
    });
  });

  it("clamps zoom and centers maps smaller than the viewport", () => {
    expect(
      clampMapCamera(
        { centerX: 0, centerY: 99, zoom: 10 },
        4,
        3,
        viewport,
      ),
    ).toEqual({ centerX: 2, centerY: 1.5, zoom: 2 });
  });

  it("clamps panning to the map edges", () => {
    const camera = { centerX: 5, centerY: 5, zoom: 1 };
    expect(panMapCamera(camera, 1000, 1000, 20, 20, viewport)).toEqual({
      centerX: 5,
      centerY: 3.75,
      zoom: 1,
    });
    expect(panMapCamera(camera, -1000, -1000, 20, 20, viewport)).toEqual({
      centerX: 15,
      centerY: 16.25,
      zoom: 1,
    });
  });

  it("recenters after movement and zooms inside bounds", () => {
    const camera = centerMapCameraOnPlayer(
      { centerX: 2, centerY: 2, zoom: 1 },
      18,
      12,
      20,
      20,
      viewport,
    );
    expect(camera.centerX).toBe(15);
    expect(camera.centerY).toBe(12.5);
    expect(zoomMapCamera(camera, -10, 20, 20, viewport).zoom).toBe(0.75);
  });

  it("reclamps the center when the viewport is resized", () => {
    expect(
      clampMapCamera(
        { centerX: 2, centerY: 2, zoom: 1 },
        40,
        30,
        { width: 640, height: 480, cellSize: 32 },
      ),
    ).toEqual({ centerX: 10, centerY: 7.5, zoom: 1 });
  });

  it("projects a world cell into viewport coordinates", () => {
    expect(
      getMapCameraCellRect(
        { centerX: 5, centerY: 4, zoom: 1.5 },
        5,
        4,
        viewport,
      ),
    ).toEqual({ left: 160, top: 120, width: 48, height: 48 });
  });
});
