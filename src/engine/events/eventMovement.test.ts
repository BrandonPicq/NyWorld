import { describe, expect, it } from "vitest";
import { GameplayEngine } from "../GameplayEngine";
import { loadZone } from "../zoneLoader";

function makeZone(zoneId: string, blocked = false, fogOfWar = false) {
  return loadZone({
    version: "0.1",
    zoneId,
    name: zoneId,
    width: 4,
    height: 4,
    playerStart: { x: 1, y: 1 },
    fogOfWar,
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

  it("starts an event combat even when the enemy has no map entity", () => {
    const engine = new GameplayEngine(makeZone("event_zone"), {
      events: [
        {
          eventId: "summoned_fight",
          trigger,
          conditions: [],
          actions: [{ type: "start_combat", enemyId: "kobold" }],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    const result = engine.execute({ type: "Interact" });

    expect(result.success).toBe(true);
    expect(engine.getSnapshot().combatState?.opponentNpcId).toBe("kobold");
    // The summoned opponent never exists on the map.
    expect(
      engine.getSnapshot().entities.some((entity) => entity.npcId === "kobold"),
    ).toBe(false);
  });

  it("concludes an event-summoned combat victory without a map entity", () => {
    const engine = new GameplayEngine(makeZone("event_zone"), {
      random: () => 0.5,
      events: [
        {
          eventId: "summon_slime",
          trigger,
          conditions: [],
          actions: [{ type: "start_combat", enemyId: "slime" }],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    engine.execute({ type: "Interact" });
    expect(engine.getSnapshot().combatState?.opponentNpcId).toBe("slime");

    // Two critical strikes finish the slime (see combatEngine.test.ts math).
    engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 6, mistakes: 0 });
    engine.execute({ type: "StartOpponentTurn" });
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 5, mistakes: 0 });
    engine.execute({ type: "SelectCombatAction", actionKind: "strike" });
    engine.execute({ type: "SubmitCombatQte", completed: true, inputAdvantage: 6, mistakes: 0 });

    expect(engine.getSnapshot().combatState?.phase).toBe("victory");
    const conclude = engine.execute({ type: "ConcludeCombat" });
    expect(conclude.success).toBe(true);
    expect(engine.getSnapshot().combatState).toBeUndefined();
    expect(
      engine.getSnapshot().inventory.items.some((item) => item.itemId === "slime_remains"),
    ).toBe(true);
  });

  it("reports a start_combat action against an unknown enemy", () => {
    const engine = new GameplayEngine(makeZone("event_zone"), {
      events: [
        {
          eventId: "ghost_fight",
          trigger,
          conditions: [],
          actions: [{ type: "start_combat", enemyId: "ghost" }],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    engine.execute({ type: "Interact" });

    const expectedLine =
      'Event ghost_fight: could not start combat with "ghost" (unknown enemy).';
    expect(engine.consumeNotices()).toEqual([
      { title: "World Event", message: expectedLine },
    ]);
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

  it("persists a valid event-authored safe respawn", () => {
    const engine = new GameplayEngine(makeZone("event_zone"), {
      events: [
        {
          eventId: "set_camp",
          trigger,
          conditions: [],
          actions: [{ type: "set_respawn", zoneId: "event_zone", x: 2, y: 2 }],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    engine.execute({ type: "Interact" });

    expect(engine.createSaveData().currentSafeRespawn).toEqual({
      zoneId: "event_zone",
      x: 2,
      y: 2,
    });
  });

  it("reports an event respawn that is not walkable", () => {
    const engine = new GameplayEngine(makeZone("event_zone"), {
      events: [
        {
          eventId: "bad_camp",
          trigger,
          conditions: [],
          actions: [{ type: "set_respawn", zoneId: "event_zone", x: 0, y: 0 }],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    engine.execute({ type: "Interact" });

    expect(engine.consumeNotices()).toEqual([
      {
        title: "World Event",
        message: 'Event bad_camp: could not set respawn to (0, 0) in "event_zone".',
      },
    ]);
  });

  it("lets events permanently reveal an explored area", () => {
    const engine = new GameplayEngine(makeZone("event_zone", false, true), {
      events: [
        {
          eventId: "reveal_landmark",
          trigger,
          conditions: [],
          actions: [
            { type: "reveal_area", zoneId: "event_zone", x: 3, y: 2, width: 1, height: 1 },
          ],
          repeatPolicy: "once_per_playthrough",
          priority: 1,
        },
      ],
    });

    expect(engine.getSnapshot().mapVisibility?.[2][3]).toBe("hidden");
    engine.execute({ type: "Interact" });

    expect(engine.getSnapshot().mapVisibility?.[2][3]).toBe("explored");
    expect(engine.createSaveData().exploredCellsByZone?.event_zone).toContain("3,2");
  });
});
