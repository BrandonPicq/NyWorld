import type { CombatActionDef } from "../combat/CombatActionDef";
import type { PatternDef } from "../combat/PatternDef";
import type { ClassDef } from "../classes/ClassDef";
import type { DialogueDefMap } from "../dialogues/DialogueDef";
import type { EnemyDef } from "../enemies/EnemyDef";
import type { CommandMasteryDef } from "../mastery/CommandMasteryDef";
import type { NpcDef } from "../npcs/NpcDef";
import type { NpcPresenceDef } from "../npcs/NpcPresenceDef";
import type { QuestDef } from "../quests/QuestDef";
import type { RaceDef } from "../races/RaceDef";
import type { TileDef } from "../TileRegistry";
import type { ItemDef, ItemDefMap } from "../items/ItemDef";
import type { TileId, ZoneData } from "../ZoneTypes";
import type { GameContentConfig } from "./contentBundle";
import type { EventDef } from "../events/EventDef";
import { CONTENT_TYPES, type ContentTypeName } from "./contentTypes";
import type { ContentValidationContext } from "./ContentValidationContext";

/**
 * One addressable piece of content.
 */
export interface ContentRef {
  type: ContentTypeName;
  id: string;
}

/**
 * One directed id link between two pieces of content.
 *
 * The path mirrors validator diagnostic paths so tools can point at the exact
 * field holding the reference.
 */
export interface ContentReference {
  from: ContentRef;
  to: ContentRef;
  path: string;
}

/**
 * Everything a tool needs to judge the impact of renaming a content id.
 */
export interface RenameImpact {
  /** Content references that would break or need rewriting. */
  references: ContentReference[];
  /** True when the id family is persisted inside save files. */
  appearsInSaves: boolean;
}

/**
 * Queryable snapshot of every cross-content id link.
 */
export interface ContentReferenceGraph {
  references: readonly ContentReference[];
  getReferencesTo(ref: ContentRef): ContentReference[];
  getReferencesFrom(ref: ContentRef): ContentReference[];
  getDanglingReferences(
    context: ContentValidationContext,
  ): ContentReference[];
  getRenameImpact(ref: ContentRef): RenameImpact;
}

/**
 * Plain-data view of one full content catalog.
 *
 * The runtime builder lives in runtimeContentCatalog.ts; editor drafts and mod
 * bundles can assemble the same shape from their own files.
 */
export interface ContentCatalogSnapshot {
  game: GameContentConfig;
  zones: Record<string, ZoneData>;
  items: ItemDefMap;
  npcs: NpcDef[];
  npcPresence: NpcPresenceDef[];
  enemies: EnemyDef[];
  quests: QuestDef[];
  combatActions: CombatActionDef[];
  classes: ClassDef[];
  races: RaceDef[];
  commandMasteries?: CommandMasteryDef[];
  qtePatterns?: PatternDef[];
  events?: EventDef[];
  dialogues: DialogueDefMap;
  dialogueFiles: Record<string, DialogueDefMap>;
  tiles: ReadonlyMap<TileId, TileDef>;
}

/** Id families that current save files persist (see GameSaveData). */
const SAVED_CONTENT_TYPES: ReadonlySet<ContentTypeName> = new Set([
  CONTENT_TYPES.item,
  CONTENT_TYPES.npc,
  CONTENT_TYPES.dialogue,
  CONTENT_TYPES.zone,
  CONTENT_TYPES.quest,
  CONTENT_TYPES.qtePattern,
]);

/**
 * Builds the cross-content reference graph for one catalog snapshot.
 */
export function buildContentReferenceGraph(
  snapshot: ContentCatalogSnapshot,
): ContentReferenceGraph {
  const references: ContentReference[] = [
    ...collectGameConfigReferences(snapshot.game),
    ...Object.entries(snapshot.items).flatMap(([itemId, item]) =>
      collectItemReferences(itemId, item),
    ),
    ...Object.values(snapshot.zones).flatMap(collectZoneReferences),
    ...snapshot.npcs.flatMap(collectNpcReferences),
    ...snapshot.npcPresence.flatMap(collectNpcPresenceReferences),
    ...snapshot.enemies.flatMap(collectEnemyReferences),
    ...snapshot.quests.flatMap(collectQuestReferences),
    ...(snapshot.qtePatterns ?? []).flatMap(collectQtePatternReferences),
    ...(snapshot.events ?? []).flatMap(collectEventReferences),
  ];

  return {
    references,
    getReferencesTo(ref) {
      return references.filter(
        (reference) =>
          reference.to.type === ref.type && reference.to.id === ref.id,
      );
    },
    getReferencesFrom(ref) {
      return references.filter(
        (reference) =>
          reference.from.type === ref.type && reference.from.id === ref.id,
      );
    },
    getDanglingReferences(context) {
      return references.filter(
        (reference) => !referenceTargetExists(reference.to, context),
      );
    },
    getRenameImpact(ref) {
      return {
        references: references.filter(
          (reference) =>
            (reference.to.type === ref.type && reference.to.id === ref.id) ||
            (reference.from.type === ref.type && reference.from.id === ref.id),
        ),
        appearsInSaves: SAVED_CONTENT_TYPES.has(ref.type),
      };
    },
  };
}

function referenceTargetExists(
  target: ContentRef,
  context: ContentValidationContext,
): boolean {
  switch (target.type) {
    case CONTENT_TYPES.item:
      return context.itemIds.has(target.id);
    case CONTENT_TYPES.npc:
      return context.npcIds.has(target.id);
    case CONTENT_TYPES.dialogue:
      return context.dialogueIds.has(target.id);
    case CONTENT_TYPES.enemy:
      return context.enemyIds.has(target.id);
    case CONTENT_TYPES.quest:
      return context.questIds.has(target.id);
    case CONTENT_TYPES.combatAction:
      return context.combatActionIds.has(target.id);
    case CONTENT_TYPES.class:
      return context.classIds.has(target.id);
    case CONTENT_TYPES.race:
      return context.raceIds.has(target.id);
    case CONTENT_TYPES.tile:
      return context.tileDefs.has(Number(target.id));
    case CONTENT_TYPES.zone:
      return context.zones.has(target.id);
    case CONTENT_TYPES.qtePattern:
      return context.qtePatternIds?.has(target.id) ?? true;
    default:
      return true;
  }
}

function collectGameConfigReferences(
  game: GameContentConfig,
): ContentReference[] {
  const from: ContentRef = { type: CONTENT_TYPES.game, id: "game" };
  const references: ContentReference[] = [
    reference(from, CONTENT_TYPES.zone, game.defaultZoneId, "defaultZoneId"),
    reference(
      from,
      CONTENT_TYPES.zone,
      game.safeRespawn.zoneId,
      "safeRespawn.zoneId",
    ),
  ];

  game.newGame.startingInventory.forEach((stack, i) => {
    references.push(
      reference(
        from,
        CONTENT_TYPES.item,
        stack.itemId,
        `newGame.startingInventory[${i}].itemId`,
      ),
    );
  });

  return references;
}

function collectItemReferences(
  itemId: string,
  item: ItemDef,
): ContentReference[] {
  const from: ContentRef = { type: CONTENT_TYPES.item, id: itemId };
  const references: ContentReference[] = [];

  if (item.effects?.teachesPatternId) {
    references.push(
      reference(
        from,
        CONTENT_TYPES.qtePattern,
        item.effects.teachesPatternId,
        "effects.teachesPatternId",
      ),
    );
  }

  return references;
}

function collectZoneReferences(zone: ZoneData): ContentReference[] {
  const from: ContentRef = { type: CONTENT_TYPES.zone, id: zone.zoneId };
  const references: ContentReference[] = [];

  const seenTileIds = new Set<TileId>();
  for (const row of zone.tiles) {
    for (const tileId of row) {
      seenTileIds.add(tileId);
    }
  }
  for (const tileId of [...seenTileIds].sort((a, b) => a - b)) {
    references.push(
      reference(from, CONTENT_TYPES.tile, String(tileId), "tiles"),
    );
  }

  zone.transitions?.forEach((transition, i) => {
    references.push(
      reference(
        from,
        CONTENT_TYPES.zone,
        transition.targetZoneId,
        `transitions[${i}].targetZoneId`,
      ),
    );
  });

  zone.npcs?.forEach((npc, i) => {
    references.push(
      reference(from, CONTENT_TYPES.npc, npc.npcId, `npcs[${i}].npcId`),
    );

    if (npc.dialogueId) {
      references.push(
        reference(
          from,
          CONTENT_TYPES.dialogue,
          npc.dialogueId,
          `npcs[${i}].dialogueId`,
        ),
      );
    }

    npc.schedule?.forEach((entry, j) => {
      if (entry.zoneId) {
        references.push(
          reference(
            from,
            CONTENT_TYPES.zone,
            entry.zoneId,
            `npcs[${i}].schedule[${j}].zoneId`,
          ),
        );
      }
      if (entry.dialogueId) {
        references.push(
          reference(
            from,
            CONTENT_TYPES.dialogue,
            entry.dialogueId,
            `npcs[${i}].schedule[${j}].dialogueId`,
          ),
        );
      }
    });
  });

  zone.items?.forEach((item, i) => {
    references.push(
      reference(from, CONTENT_TYPES.item, item.itemId, `items[${i}].itemId`),
    );
  });

  return references;
}

function collectNpcReferences(npc: NpcDef): ContentReference[] {
  const from: ContentRef = { type: CONTENT_TYPES.npc, id: npc.npcId };
  const references: ContentReference[] = [
    reference(
      from,
      CONTENT_TYPES.dialogue,
      npc.defaultDialogueId,
      "defaultDialogueId",
    ),
  ];

  if (npc.classId) {
    references.push(reference(from, CONTENT_TYPES.class, npc.classId, "classId"));
  }
  if (npc.raceId) {
    references.push(reference(from, CONTENT_TYPES.race, npc.raceId, "raceId"));
  }

  return references;
}

function collectNpcPresenceReferences(
  presence: NpcPresenceDef,
): ContentReference[] {
  const from: ContentRef = {
    type: CONTENT_TYPES.npcPresence,
    id: presence.npcId,
  };
  const references: ContentReference[] = [
    reference(from, CONTENT_TYPES.npc, presence.npcId, "npcId"),
  ];

  presence.schedule.forEach((entry, i) => {
    if (entry.zoneId) {
      references.push(
        reference(
          from,
          CONTENT_TYPES.zone,
          entry.zoneId,
          `schedule[${i}].zoneId`,
        ),
      );
    }
    if (entry.dialogueId) {
      references.push(
        reference(
          from,
          CONTENT_TYPES.dialogue,
          entry.dialogueId,
          `schedule[${i}].dialogueId`,
        ),
      );
    }
  });

  return references;
}

function collectEnemyReferences(enemy: EnemyDef): ContentReference[] {
  const from: ContentRef = { type: CONTENT_TYPES.enemy, id: enemy.npcId };
  const references: ContentReference[] = [
    reference(from, CONTENT_TYPES.npc, enemy.npcId, "npcId"),
  ];

  enemy.loot.forEach((entry, i) => {
    references.push(
      reference(from, CONTENT_TYPES.item, entry.itemId, `loot[${i}].itemId`),
    );
  });

  return references;
}

function collectQuestReferences(quest: QuestDef): ContentReference[] {
  const from: ContentRef = { type: CONTENT_TYPES.quest, id: quest.questId };
  const references: ContentReference[] = [];

  if (quest.targetNpcId) {
    references.push(
      reference(from, CONTENT_TYPES.npc, quest.targetNpcId, "targetNpcId"),
    );
  }
  if (quest.triggers.start.dialogueId) {
    references.push(
      reference(
        from,
        CONTENT_TYPES.dialogue,
        quest.triggers.start.dialogueId,
        "triggers.start.dialogueId",
      ),
    );
  }
  if (quest.triggers.complete.dialogueId) {
    references.push(
      reference(
        from,
        CONTENT_TYPES.dialogue,
        quest.triggers.complete.dialogueId,
        "triggers.complete.dialogueId",
      ),
    );
  }

  for (const [npcId, override] of Object.entries(quest.npcOverrides)) {
    references.push(
      reference(from, CONTENT_TYPES.npc, npcId, `npcOverrides.${npcId}`),
    );
    for (const key of ["active", "activeReady", "completed"] as const) {
      const dialogueId = override[key];
      if (dialogueId) {
        references.push(
          reference(
            from,
            CONTENT_TYPES.dialogue,
            dialogueId,
            `npcOverrides.${npcId}.${key}`,
          ),
        );
      }
    }
  }

  quest.objectives.forEach((objective, i) => {
    if (objective.type === "fetch_item") {
      references.push(
        reference(
          from,
          CONTENT_TYPES.item,
          objective.itemId,
          `objectives[${i}].itemId`,
        ),
      );
    } else if (objective.type === "visit_coordinate") {
      references.push(
        reference(
          from,
          CONTENT_TYPES.zone,
          objective.zoneId,
          `objectives[${i}].zoneId`,
        ),
      );
    } else if (objective.type === "defeat_npc") {
      references.push(
        reference(
          from,
          CONTENT_TYPES.npc,
          objective.npcId,
          `objectives[${i}].npcId`,
        ),
      );
    }
  });

  quest.rewards.items?.forEach((item, i) => {
    references.push(
      reference(
        from,
        CONTENT_TYPES.item,
        item.itemId,
        `rewards.items[${i}].itemId`,
      ),
    );
  });

  return references;
}

function collectQtePatternReferences(pattern: PatternDef): ContentReference[] {
  const from: ContentRef = {
    type: CONTENT_TYPES.qtePattern,
    id: pattern.patternId,
  };
  const references: ContentReference[] = [];

  if (pattern.evolvesFrom) {
    references.push(
      reference(
        from,
        CONTENT_TYPES.qtePattern,
        pattern.evolvesFrom.patternId,
        "evolvesFrom.patternId",
      ),
    );
  }

  return references;
}

function collectEventReferences(event: EventDef): ContentReference[] {
  const from: ContentRef = { type: CONTENT_TYPES.event, id: event.eventId };
  const references: ContentReference[] = [];
  const add = (to: ContentTypeName, id: string, path: string) =>
    references.push(reference(from, to, id, path));

  const trigger = event.trigger;
  if ("zoneId" in trigger) add(CONTENT_TYPES.zone, trigger.zoneId, "trigger.zoneId");
  if (trigger.type === "dialogue_end" && trigger.dialogueId) add(CONTENT_TYPES.dialogue, trigger.dialogueId, "trigger.dialogueId");
  if (trigger.type === "quest_state_change") add(CONTENT_TYPES.quest, trigger.questId, "trigger.questId");

  event.conditions.forEach((condition, index) => {
    if (condition.type === "quest_state") add(CONTENT_TYPES.quest, condition.questId, `conditions[${index}].questId`);
    if (condition.type === "has_item") add(CONTENT_TYPES.item, condition.itemId, `conditions[${index}].itemId`);
  });

  event.actions.forEach((action, index) => {
    const path = `actions[${index}]`;
    if (action.type === "dialogue") add(CONTENT_TYPES.dialogue, action.dialogueId, `${path}.dialogueId`);
    if (action.type === "give_item" || action.type === "remove_item") add(CONTENT_TYPES.item, action.itemId, `${path}.itemId`);
    if (action.type === "spawn_enemy" || action.type === "despawn_enemy" || action.type === "start_combat") add(CONTENT_TYPES.enemy, action.enemyId, `${path}.enemyId`);
    if (action.type === "spawn_npc" || action.type === "despawn_npc") add(CONTENT_TYPES.npc, action.npcId, `${path}.npcId`);
    if (action.type === "spawn_npc" && action.dialogueId) add(CONTENT_TYPES.dialogue, action.dialogueId, `${path}.dialogueId`);
    if (action.type === "teleport") add(CONTENT_TYPES.zone, action.zoneId, `${path}.zoneId`);
    if (action.type === "start_quest" || action.type === "advance_quest") add(CONTENT_TYPES.quest, action.questId, `${path}.questId`);
  });

  return references;
}

function reference(
  from: ContentRef,
  toType: ContentTypeName,
  toId: string,
  path: string,
): ContentReference {
  return { from, to: { type: toType, id: toId }, path };
}
