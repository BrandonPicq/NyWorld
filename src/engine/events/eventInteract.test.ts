import { describe, expect, it } from "vitest";
import { GameplayEngine } from "../GameplayEngine";
import { loadZone } from "../zoneLoader";
import type { EventDef } from "./EventDef";

function makeEmptyZoneData() {
  return {
    version: "0.1",
    zoneId: "interact_zone",
    name: "Interact Zone",
    width: 4,
    height: 3,
    playerStart: { x: 1, y: 1 },
    tiles: [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
  };
}

function interactEvent(): EventDef {
  return {
    eventId: "interact_hook",
    trigger: {
      type: "interact_on_area",
      zoneId: "interact_zone",
      area: { x: 1, y: 1, width: 1, height: 1 },
    },
    conditions: [],
    actions: [{ type: "notice", message: "Interact fired." }],
    repeatPolicy: "once_per_playthrough",
    priority: 1,
  };
}

describe("interact events without an NPC nearby", () => {
  it("skips the nothing-to-interact fallback when an event fires", () => {
    const engine = new GameplayEngine(loadZone(makeEmptyZoneData()), {
      events: [interactEvent()],
    });

    const result = engine.execute({ type: "Interact" });

    expect(result.success).toBe(true);
    expect(engine.consumeNotices()).toEqual([
      { title: "World Event", message: "Interact fired." },
    ]);
    const messages = engine.getSnapshot().log.map((entry) => entry.message);
    expect(messages.some((m) => m.includes("nothing to interact"))).toBe(false);
  });

  it("keeps the fallback when no event is eligible", () => {
    const engine = new GameplayEngine(loadZone(makeEmptyZoneData()), {
      events: [],
    });

    const result = engine.execute({ type: "Interact" });

    expect(result.success).toBe(false);
    const messages = engine.getSnapshot().log.map((entry) => entry.message);
    expect(messages.some((m) => m.includes("nothing to interact"))).toBe(true);
  });

  it("restores the fallback once the event is spent", () => {
    const engine = new GameplayEngine(loadZone(makeEmptyZoneData()), {
      events: [interactEvent()],
    });

    engine.execute({ type: "Interact" });
    const second = engine.execute({ type: "Interact" });

    expect(second.success).toBe(false);
    const messages = engine.getSnapshot().log.map((entry) => entry.message);
    expect(messages.some((m) => m.includes("nothing to interact"))).toBe(true);
  });
});
