import type { SafeRespawnPoint } from "../content/contentBundle";

/**
 * Mutable recovery destination for one playthrough.
 *
 * Authored content supplies the initial value; events can replace it without
 * ever mutating content files. Validation of a requested destination stays in
 * the engine, where the currently resolvable maps are available.
 */
export class RespawnState {
  private point: SafeRespawnPoint;

  constructor(initialPoint: SafeRespawnPoint) {
    this.point = cloneRespawnPoint(initialPoint);
  }

  get(): SafeRespawnPoint {
    return cloneRespawnPoint(this.point);
  }

  set(point: SafeRespawnPoint): void {
    this.point = cloneRespawnPoint(point);
  }
}

export function cloneRespawnPoint(point: SafeRespawnPoint): SafeRespawnPoint {
  return { zoneId: point.zoneId, x: point.x, y: point.y };
}
