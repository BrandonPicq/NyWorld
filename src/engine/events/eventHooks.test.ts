import { describe, expect, it } from "vitest";
import { GameplayEngine } from "../GameplayEngine";
import { loadZone } from "../zoneLoader";
import type { EventDef } from "./EventDef";

function makeNpcZoneData() {
  return {
    version: "0.1",
    zoneId: "hook_zone",
    name: "Hook Zone",
    width: 4,
    height: 3,
    playerStart: { x: 1, y: 1 },
    tiles: [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
    npcs: [{ npcId: "old_scholar", x: 2, y: 1, dialogueId: "old_scholar.default" }],
  };
}

function noticeEvent(event: Pick<EventDef, "eventId" | "trigger">): EventDef {
  return {
    ...event,
    conditions: [],
    actions: [{ type: "notice", message: "Hook fired." }],
    repeatPolicy: "once_per_playthrough" as const,
    priority: 1,
  };
}

describe("event dialogue, quest, and time hooks", () => {
  it("fires a dialogue-end event after an NPC dialogue closes", () => {
    const engine = new GameplayEngine(loadZone(makeNpcZoneData()), {
      events: [noticeEvent({ eventId: "dialogue_hook", trigger: { type: "dialogue_end", dialogueId: "old_scholar.default" } })],
    });

    engine.execute({ type: "Interact" });
    engine.execute({ type: "CompleteDialogue" });
    expect(engine.consumeNotices()).toEqual([{ title: "World Event", message: "Hook fired." }]);
  });

  it("fires a quest-state event after a dialogue starts a quest", () => {
    const zone = loadZone({
      ...makeNpcZoneData(),
      npcs: [{ npcId: "old_scholar", x: 2, y: 1, dialogueId: "old_scholar.quest_start" }],
    });
    const engine = new GameplayEngine(zone, {
      events: [noticeEvent({ eventId: "quest_hook", trigger: { type: "quest_state_change", questId: "lost_notebook", state: "active" } })],
    });

    engine.execute({ type: "Interact" });
    engine.execute({ type: "CompleteDialogue" });
    expect(engine.getSnapshot().activeQuests[0]?.questId).toBe("lost_notebook");
    expect(engine.consumeNotices()).toEqual([{ title: "World Event", message: "Hook fired." }]);
  });

  it("fires a calendar event when an existing action crosses its time", () => {
    const engine = new GameplayEngine(loadZone(makeNpcZoneData()), {
      events: [noticeEvent({ eventId: "time_hook", trigger: { type: "calendar_time", minutes: 8 * 60 + 10 } })],
    });

    engine.execute({ type: "Interact" });
    expect(engine.getSnapshot().worldTime.timeLabel).toBe("08:10");
    expect(engine.consumeNotices()).toEqual([{ title: "World Event", message: "Hook fired." }]);
  });
});
