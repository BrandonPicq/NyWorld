import { describe, expect, it } from "vitest";
import { GameplayEngine } from "../GameplayEngine";
import { loadZone } from "../zoneLoader";

function makeZone(zoneId: string, blocked = false) {
  return loadZone({
    version: "0.1",
    zoneId,
    name: zoneId,
    width: 4,
    height: 4,
    playerStart: { x: 1, y: 1 },
    tiles: [
      [1, 1, 1, 1],
      [1, 0, blocked ? 1 : 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
  });
}

const trigger = {
  type: "interact_on_area" as const,
  zoneId: "event_zone",
  area: { x: 1, y: 1, width: 1, height: 1 },
};

describe("Event spawn, combat, and movement actions", () => {
  it("keeps a combat opponent alive when a later action tries to despawn it", () => {
    const engine = new GameplayEngine(makeZone("event_zone"), {
      events: [
        {
          eventId: "spawn_and_fight",
          trigger,
          conditions: [],
          actions: [
            { type: "spawn_enemy", enemyId: "slime", x: 2, y: 2 },
            { type: "start_combat", enemyId: "slime" },
            { type: "despawn_enemy", enemyId: "slime" },
          ],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    const result = engine.execute({ type: "Interact" });
    expect(result.success).toBe(true);
    expect(engine.getSnapshot().combatState?.opponentNpcId).toBe("slime");
    expect(engine.getSnapshot().entities.some((entity) => entity.npcId === "slime")).toBe(true);
  });

  it("resumes spawn and combat actions after a blocking event dialogue", () => {
    const engine = new GameplayEngine(makeZone("event_zone"), {
      events: [
        {
          eventId: "ambush",
          trigger,
          conditions: [],
          actions: [
            { type: "dialogue", dialogueId: "goblin.default" },
            { type: "spawn_enemy", enemyId: "slime", x: 2, y: 2 },
            { type: "start_combat", enemyId: "slime" },
          ],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    engine.execute({ type: "Interact" });
    expect(engine.getSnapshot().combatState?.opponentNpcId).toBeUndefined();

    engine.execute({ type: "CompleteDialogue" });
    expect(engine.getSnapshot().combatState?.opponentNpcId).toBe("slime");
  });

  it("reports a start_combat action whose enemy is absent from the zone", () => {
    const engine = new GameplayEngine(makeZone("event_zone"), {
      events: [
        {
          eventId: "ghost_fight",
          trigger,
          conditions: [],
          actions: [{ type: "start_combat", enemyId: "kobold" }],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    engine.execute({ type: "Interact" });

    const expectedLine =
      'Event ghost_fight: could not start combat with "kobold" (not present in this zone — spawn it first).';
    expect(engine.consumeNotices()).toEqual([
      { title: "World Event", message: expectedLine },
    ]);
    const messages = engine.getSnapshot().log.map((entry) => entry.message);
    expect(messages).toContain(expectedLine);
    expect(engine.getSnapshot().combatState?.opponentNpcId).toBeUndefined();
  });

  it("rejects event teleports to blocked tiles without moving the player", () => {
    const source = makeZone("event_zone");
    const blockedTarget = makeZone("blocked_zone", true);
    const engine = new GameplayEngine(source, {
      resolveZone: (zoneId) => (zoneId === "blocked_zone" ? blockedTarget : undefined),
      events: [
        {
          eventId: "bad_teleport",
          trigger,
          conditions: [],
          actions: [{ type: "teleport", zoneId: "blocked_zone", x: 2, y: 1 }],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    engine.execute({ type: "Interact" });
    expect(engine.getSnapshot()).toMatchObject({ zoneId: "event_zone", playerX: 1, playerY: 1 });
    expect(engine.consumeNotices()).toEqual([
      { title: "Teleport Rejected", message: "That destination is not walkable." },
    ]);
  });
});
