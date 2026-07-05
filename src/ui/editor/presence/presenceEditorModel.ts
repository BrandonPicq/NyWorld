import type {
  ContentCatalogSnapshot,
  NpcDef,
  NpcPresenceDef,
  NpcScheduleEntryData,
} from "../../../engine";

/** A default zone-anchored position for a new presence or schedule entry. */
export interface PresencePosition {
  zoneId: string;
  x: number;
  y: number;
}

/** Row for the presence NPC list: every NPC, flagged with whether it has one. */
export interface EditorPresenceNpcEntry {
  npcId: string;
  name: string;
  hasPresence: boolean;
  entryCount: number;
}

export function listPresenceNpcEntries(
  npcs: readonly NpcDef[],
  presence: readonly NpcPresenceDef[],
): EditorPresenceNpcEntry[] {
  const presenceByNpcId = new Map(
    presence.map((def) => [def.npcId, def]),
  );

  return npcs
    .map((npc) => {
      const def = presenceByNpcId.get(npc.npcId);
      return {
        npcId: npc.npcId,
        name: npc.name,
        hasPresence: def !== undefined,
        entryCount: def?.schedule.length ?? 0,
      };
    })
    .sort((a, b) => a.npcId.localeCompare(b.npcId));
}

/** Content path a presence draft saves to; one file per NPC. */
export function presenceContentPath(npcId: string): string {
  return `src/content/npc-presence/${npcId}.json`;
}

export function clonePresenceDef(def: NpcPresenceDef): NpcPresenceDef {
  return {
    ...def,
    schedule: def.schedule.map((entry) => ({ ...entry })),
  };
}

export function clonePresenceDefs(
  defs: readonly NpcPresenceDef[],
): NpcPresenceDef[] {
  return defs.map(clonePresenceDef);
}

/**
 * Swaps the draft presence list into a catalog snapshot so a whole-bundle audit
 * sees the edit. The validation context needs no substitution — presence
 * contributes no ids to `ContentValidationContext`.
 */
export function createPresenceDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftPresence: readonly NpcPresenceDef[],
): ContentCatalogSnapshot {
  return {
    ...snapshot,
    npcPresence: clonePresenceDefs(draftPresence),
  };
}

export function serializePresenceDef(def: NpcPresenceDef): string {
  return JSON.stringify(def, null, 2);
}

export function serializePresenceDefsById(
  defs: readonly NpcPresenceDef[],
): Map<string, string> {
  return new Map(defs.map((def) => [def.npcId, serializePresenceDef(def)]));
}

/**
 * A zone-anchored default position for new presence entries.
 *
 * Uses the first zone's player start so a fresh entry lands on a walkable tile
 * more often than not; the author can still move it.
 */
export function defaultPresencePosition(
  snapshot: ContentCatalogSnapshot,
): PresencePosition {
  const zoneId = Object.keys(snapshot.zones)
    .sort((a, b) => a.localeCompare(b))[0] ?? "";
  const zone = zoneId ? snapshot.zones[zoneId] : undefined;
  return {
    zoneId,
    x: zone?.playerStart.x ?? 1,
    y: zone?.playerStart.y ?? 1,
  };
}

function scheduleEntry(position: PresencePosition): NpcScheduleEntryData {
  return { time: "08:00", zoneId: position.zoneId, x: position.x, y: position.y };
}

/** Builds a presence with a single starter schedule entry (required to be non-empty). */
export function createPresenceDefForNpc(
  npcId: string,
  position: PresencePosition,
): NpcPresenceDef {
  return { npcId, schedule: [scheduleEntry(position)] };
}

export function upsertPresenceDef(
  defs: readonly NpcPresenceDef[],
  def: NpcPresenceDef,
): NpcPresenceDef[] {
  const exists = defs.some((entry) => entry.npcId === def.npcId);
  const next = exists
    ? defs.map((entry) =>
        entry.npcId === def.npcId
          ? clonePresenceDef(def)
          : clonePresenceDef(entry),
      )
    : [...defs, clonePresenceDef(def)];

  return next.sort((a, b) => a.npcId.localeCompare(b.npcId));
}

export function updatePresenceDef(
  defs: readonly NpcPresenceDef[],
  npcId: string,
  updater: (def: NpcPresenceDef) => NpcPresenceDef,
): NpcPresenceDef[] {
  return defs.map((def) =>
    def.npcId === npcId
      ? clonePresenceDef(updater(clonePresenceDef(def)))
      : clonePresenceDef(def),
  );
}

export function removePresenceDef(
  defs: readonly NpcPresenceDef[],
  npcId: string,
): NpcPresenceDef[] {
  return defs
    .filter((def) => def.npcId !== npcId)
    .map(clonePresenceDef);
}

/** Appends a schedule entry to a presence, defaulting to `position`. */
export function addPresenceScheduleEntry(
  def: NpcPresenceDef,
  position: PresencePosition,
): NpcPresenceDef {
  const next = clonePresenceDef(def);
  next.schedule.push(scheduleEntry(position));
  return next;
}

/** Patches one field of schedule entry `index` on a presence. */
export function updatePresenceScheduleEntry(
  def: NpcPresenceDef,
  index: number,
  patch: Partial<NpcScheduleEntryData>,
): NpcPresenceDef {
  const next = clonePresenceDef(def);
  if (index < 0 || index >= next.schedule.length) {
    return next;
  }
  next.schedule[index] = { ...next.schedule[index], ...patch };
  return next;
}

/** Removes schedule entry `index` from a presence. */
export function removePresenceScheduleEntry(
  def: NpcPresenceDef,
  index: number,
): NpcPresenceDef {
  const next = clonePresenceDef(def);
  next.schedule = next.schedule.filter((_, entryIndex) => entryIndex !== index);
  return next;
}
