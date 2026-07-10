export const MIN_MAP_ZOOM = 0.75;
export const MAX_MAP_ZOOM = 2;
export const DEFAULT_MAP_CELL_SIZE = 32;

export type MapCamera = {
  centerX: number;
  centerY: number;
  zoom: number;
};

export type MapCameraViewport = {
  width: number;
  height: number;
  cellSize: number;
};

export type MapCameraCellRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Returns a zoom value inside the supported gameplay camera range. */
export function clampMapZoom(zoom: number): number {
  return Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, zoom));
}

/**
 * Creates the initial camera for a zone. Small maps are fitted when possible;
 * larger maps start at 1x around the player so their cells stay readable.
 */
export function createInitialMapCamera(
  mapWidth: number,
  mapHeight: number,
  playerX: number,
  playerY: number,
  viewport: MapCameraViewport,
): MapCamera {
  const fitZoom = Math.min(
    viewport.width / (mapWidth * viewport.cellSize),
    viewport.height / (mapHeight * viewport.cellSize),
  );
  const zoom = fitZoom >= MIN_MAP_ZOOM ? clampMapZoom(fitZoom) : 1;
  const mapFits = fitZoom >= MIN_MAP_ZOOM;
  return clampMapCamera(
    {
      centerX: mapFits ? mapWidth / 2 : playerX + 0.5,
      centerY: mapFits ? mapHeight / 2 : playerY + 0.5,
      zoom,
    },
    mapWidth,
    mapHeight,
    viewport,
  );
}

/** Keeps the camera center inside the map while accounting for the viewport. */
export function clampMapCamera(
  camera: MapCamera,
  mapWidth: number,
  mapHeight: number,
  viewport: MapCameraViewport,
): MapCamera {
  const zoom = clampMapZoom(camera.zoom);
  const halfWidth = viewport.width / (2 * viewport.cellSize * zoom);
  const halfHeight = viewport.height / (2 * viewport.cellSize * zoom);
  return {
    centerX: clampCenter(camera.centerX, halfWidth, mapWidth),
    centerY: clampCenter(camera.centerY, halfHeight, mapHeight),
    zoom,
  };
}

/** Centers the camera on the player's current cell. */
export function centerMapCameraOnPlayer(
  camera: MapCamera,
  playerX: number,
  playerY: number,
  mapWidth: number,
  mapHeight: number,
  viewport: MapCameraViewport,
): MapCamera {
  return clampMapCamera(
    { ...camera, centerX: playerX + 0.5, centerY: playerY + 0.5 },
    mapWidth,
    mapHeight,
    viewport,
  );
}

/** Pans the camera by screen pixels, clamped to the active map. */
export function panMapCamera(
  camera: MapCamera,
  deltaX: number,
  deltaY: number,
  mapWidth: number,
  mapHeight: number,
  viewport: MapCameraViewport,
): MapCamera {
  const worldPixelsPerCell = viewport.cellSize * camera.zoom;
  return clampMapCamera(
    {
      ...camera,
      centerX: camera.centerX - deltaX / worldPixelsPerCell,
      centerY: camera.centerY - deltaY / worldPixelsPerCell,
    },
    mapWidth,
    mapHeight,
    viewport,
  );
}

/** Adjusts zoom around the current camera center. */
export function zoomMapCamera(
  camera: MapCamera,
  delta: number,
  mapWidth: number,
  mapHeight: number,
  viewport: MapCameraViewport,
): MapCamera {
  return clampMapCamera(
    { ...camera, zoom: camera.zoom + delta },
    mapWidth,
    mapHeight,
    viewport,
  );
}

/** Projects a world cell into viewport pixels for UI overlays. */
export function getMapCameraCellRect(
  camera: MapCamera,
  playerX: number,
  playerY: number,
  viewport: MapCameraViewport,
): MapCameraCellRect {
  const scaledCellSize = viewport.cellSize * camera.zoom;
  const worldLeft = camera.centerX - viewport.width / (2 * scaledCellSize);
  const worldTop = camera.centerY - viewport.height / (2 * scaledCellSize);
  return {
    left: (playerX - worldLeft) * scaledCellSize,
    top: (playerY - worldTop) * scaledCellSize,
    width: scaledCellSize,
    height: scaledCellSize,
  };
}

function clampCenter(center: number, halfViewport: number, mapSize: number): number {
  const min = Math.min(halfViewport, mapSize / 2);
  const max = Math.max(mapSize - halfViewport, mapSize / 2);
  return Math.min(max, Math.max(min, center));
}
