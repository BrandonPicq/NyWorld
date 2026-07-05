import { describe, expect, it } from "vitest";
import {
  buildContentReferenceGraph,
  type ContentCatalogSnapshot,
  type ContentValidationContext,
  type EnemyDef,
  type GameMap,
  type NpcDef,
} from "../../../engine";
import {
  addEnemyLootEntry,
  createEnemyDefForNpc,
  createEnemyDraftSnapshot,
  createEnemyDraftValidationContext,
  enemyContentPath,
  listEnemyNpcEntries,
  removeEnemyDef,
  removeEnemyLootEntry,
  serializeEnemyDef,
  serializeEnemyDefsById,
  updateEnemyDef,
  updateEnemyLootEntry,
  updateEnemyProgression,
  updateEnemyStatValue,
  upsertEnemyDef,
} from "./enemyEditorModel";

function createNpcs(): NpcDef[] {
  return [
    {
      npcId: "npc_a",
      name: "NPC A",
      race: "human",
      defaultDialogueId: "npc_a.default",
    },
    {
      npcId: "npc_b",
      name: "NPC B",
      race: "elf",
      defaultDialogueId: "npc_b.default",
    },
  ];
}

function createEnemies(): EnemyDef[] {
  return [
    {
      npcId: "npc_a",
      combatable: true,
      stats: createEnemyDefForNpc(createNpcs()[0]).stats,
      loot: [{ itemId: "item_a", quantity: 1 }],
    },
  ];
}

function createSnapshot(): ContentCatalogSnapshot {
  return {
    game: {
      defaultZoneId: "zone",
      safeRespawn: { zoneId: "zone", x: 1, y: 1 },
      actions: {
        rest: { energyRestore: 15 },
        study: { energyCost: 10, academicProgressGain: 15, intelligenceGain: 1 },
      },
      newGame: {
        startingCurrency: 0,
        maxEnergy: 100,
        startingInventory: [],
        attributes: {
          strength: 1,
          vitality: 1,
          agility: 1,
          intelligence: 1,
          spirit: 1,
          willpower: 1,
          perception: 1,
          charisma: 1,
        },
        skills: {
          melee: 0,
          ranged: 0,
          guard: 0,
          evasion: 0,
          spellcasting: 0,
          focus: 0,
          athletics: 0,
          scholarship: 0,
          speech: 0,
        },
      },
    },
    zones: {},
    items: {},
    npcs: createNpcs(),
    npcPresence: [],
    enemies: createEnemies(),
    quests: [],
    combatActions: [],
    dialogues: {},
    dialogueFiles: {},
    tiles: new Map(),
  };
}

function createValidationContext(): ContentValidationContext {
  return {
    itemIds: new Set(["item_a"]),
    npcIds: new Set(["npc_a", "npc_b"]),
    dialogueIds: new Set(),
    enemyIds: new Set(["npc_a"]),
    questIds: new Set(),
    combatActionIds: new Set(),
    tileDefs: new Map(),
    zones: new Map([["zone", {} as GameMap]]),
  };
}

describe("enemy editor helpers", () => {
  it("lists NPCs with enemy profile status and content paths", () => {
    expect(listEnemyNpcEntries(createNpcs(), createEnemies())).toEqual([
      {
        npcId: "npc_a",
        name: "NPC A",
        hasProfile: true,
        combatable: true,
      },
      {
        npcId: "npc_b",
        name: "NPC B",
        hasProfile: false,
        combatable: false,
      },
    ]);
    expect(enemyContentPath("npc_a")).toBe("src/content/enemies/npc_a.json");
  });

  it("creates, updates, removes, and serializes enemy definitions", () => {
    const newEnemy = createEnemyDefForNpc(createNpcs()[1]);
    const inserted = upsertEnemyDef(createEnemies(), newEnemy);
    const updated = updateEnemyDef(inserted, "npc_b", (enemy) =>
      updateEnemyProgression(
        updateEnemyStatValue(enemy, "combat", "attack", 9),
        { academicTitle: "Arena Rival" },
      ),
    );
    const removed = removeEnemyDef(updated, "npc_a");

    expect(removed.map((enemy) => enemy.npcId)).toEqual(["npc_b"]);
    expect(removed[0].stats.combat.attack).toBe(9);
    expect(removed[0].stats.progression.academicTitle).toBe("Arena Rival");
    expect(serializeEnemyDef(removed[0])).toContain('"npcId": "npc_b"');
    expect(serializeEnemyDefsById(removed).get("npc_b")).toContain(
      '"combatable": true',
    );
  });

  it("updates loot entries without mutating the source enemy", () => {
    const enemy = createEnemies()[0];
    const withLoot = addEnemyLootEntry(enemy, "item_a");
    const updated = updateEnemyLootEntry(withLoot, 1, { quantity: 3 });
    const removed = removeEnemyLootEntry(updated, 0);

    expect(enemy.loot).toEqual([{ itemId: "item_a", quantity: 1 }]);
    expect(removed.loot).toEqual([{ itemId: "item_a", quantity: 3 }]);
  });

  it("substitutes draft enemy ids for reference checks", () => {
    const snapshot = createSnapshot();
    const newEnemy = createEnemyDefForNpc(snapshot.npcs[1]);
    const draftEnemies = upsertEnemyDef(snapshot.enemies, newEnemy);
    const draftSnapshot = createEnemyDraftSnapshot(snapshot, draftEnemies);
    const draftContext = createEnemyDraftValidationContext(
      createValidationContext(),
      draftEnemies,
    );

    const danglingReferences =
      buildContentReferenceGraph(draftSnapshot).getDanglingReferences(
        draftContext,
      );

    expect(draftContext.enemyIds.has("npc_b")).toBe(true);
    expect(draftSnapshot.enemies.map((enemy) => enemy.npcId)).toEqual([
      "npc_a",
      "npc_b",
    ]);
    expect(danglingReferences).not.toContainEqual(
      expect.objectContaining({
        from: { type: "enemy", id: "npc_b" },
      }),
    );
  });
});
