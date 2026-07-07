import { describe, expect, it } from "vitest";

import { getAllCombatActionDefs } from "../combat/combatActionRegistry";
import { getAllClassIds } from "../classes/classRegistry";
import { getAllDialogueIds } from "../dialogues/dialogueRegistry";
import { getAllEnemyDefs } from "../enemies/enemyRegistry";
import { getAllItemIds } from "../items/itemRegistry";
import { getAllNpcDefs } from "../npcs/npcRegistry";
import { getAllQuestDefs } from "../quests/questRegistry";
import { getAllRaceIds } from "../races/raceRegistry";
import { getAllTileDefs } from "../TileRegistry";
import { defaultContentBundle } from "./contentBundle";
import { createRuntimeContentValidationContext } from "./runtimeValidationContext";

describe("createRuntimeContentValidationContext", () => {
  it("collects every shipped content id family", () => {
    const context = createRuntimeContentValidationContext();

    expect([...context.itemIds].sort()).toEqual(getAllItemIds().sort());
    expect([...context.npcIds].sort()).toEqual(
      getAllNpcDefs()
        .map((npc) => npc.npcId)
        .sort(),
    );
    expect([...context.dialogueIds].sort()).toEqual(getAllDialogueIds().sort());
    expect([...context.enemyIds].sort()).toEqual(
      getAllEnemyDefs()
        .map((enemy) => enemy.npcId)
        .sort(),
    );
    expect([...context.questIds].sort()).toEqual(
      getAllQuestDefs()
        .map((quest) => quest.questId)
        .sort(),
    );
    expect([...context.combatActionIds].sort()).toEqual(
      getAllCombatActionDefs()
        .map((action) => action.actionId)
        .sort(),
    );
    expect([...context.classIds].sort()).toEqual(getAllClassIds().sort());
    expect([...context.raceIds].sort()).toEqual(getAllRaceIds().sort());
    expect([...context.tileDefs.keys()].sort((a, b) => a - b)).toEqual(
      [...getAllTileDefs().keys()].sort((a, b) => a - b),
    );
    expect([...context.zones.keys()].sort()).toEqual(
      Object.keys(defaultContentBundle.zones).sort(),
    );
  });

  it("resolves zones into walkability-aware maps", () => {
    const context = createRuntimeContentValidationContext();
    const zone = context.zones.values().next().value;

    expect(zone).toBeDefined();
    expect(typeof zone!.isWalkable).toBe("function");
  });
});
