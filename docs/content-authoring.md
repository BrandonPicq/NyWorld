# Content Authoring Notes

This document explains how authored content moves from JSON files into the
gameplay engine. It is intentionally general so it stays useful when test
content is replaced by larger worlds or mods.

## Content Flow

Content starts as JSON under `src/content`. The central game config in
`src/content/game.json` declares the default zone and safe respawn point.
Registries discover content files, validate references where they can, and
expose detached copies to the engine. `ContentBundle` discovers zone files,
validates the global references, and resolves zones into `GameMap` instances.
Gameplay systems work from `GameMap`, registries, and save state rather than
editing imported JSON directly.

The important rule is ownership:

- content files define stable data such as zones, items, NPC identities, dialogue
  sequences, and daily presence;
- game config defines world-level entry points such as the default zone and safe
  respawn;
- the engine owns mutable runtime state such as position, inventory, logs, world
  time, collected item placements, and NPC progression;
- save data stores only mutable playthrough state and reloads static content
  from registries.

## Stable Ids

Most content links are id based:

- `zoneId` links transitions and scheduled NPC presence to zones;
- `itemId` links inventory stacks and ground spawns to the item catalog;
- `npcId` links zone appearances, global presence, and save state to a character
  definition;
- `dialogueId` links NPC defaults, zone appearances, schedules, and saved NPC
  state to reusable dialogue sequences.

Ids should be stable once they appear in saves. Renaming an id later requires a
save migration or compatibility alias.

## Game Config

`src/content/game.json` owns global authoring choices that should not be
hardcoded in React or the gameplay engine. `defaultZoneId` selects the starting
zone for a new game. `safeRespawn` selects where the player returns after a
combat defeat or similar recovery event.

The safe respawn point must reference an authored zone and a walkable tile.

## Zones

Zone JSON describes the map rectangle, tile grid, player start, optional
transitions, optional entry dialogue, NPC appearances, and ground item stacks.
`ContentBundle` discovers authored zones, while `loadZone` rejects invalid tile
ids, blocked spawn positions, unknown content references, malformed dialogue,
and invalid schedules before a `GameMap` reaches gameplay code.

Zone coordinates use integer grid space with `(0, 0)` at the top-left corner.

## Validation And Runtime Conversion

Content validation is split from runtime conversion. `validateZoneData` and
`validateQuestDef` accept unknown JSON-like input and return content diagnostics
with a severity, content type, optional content id, path, and message. This is
the editor-facing path: tools can show several authoring mistakes at once
without constructing runtime objects.

`loadZone` remains the strict runtime path. It validates the raw data, throws a
`ZoneLoadError` on the first blocking diagnostic, and only then creates a
`GameMap`. `createGameMapFromZoneData` is the low-level conversion helper for
data that has already crossed validation.

Reference validation goes through an explicit `ContentValidationContext`
holding the known item, NPC, dialogue, enemy, quest, combat action, tile, and
zone catalogs. Each validator declares the subset it needs (for example
`ZoneValidationContext` or `QuestValidationContext`), so editor drafts and mod
bundles can build their own context and validate before becoming active
content. The runtime builder `createRuntimeContentValidationContext` lives in
its own top-of-graph module that registries must never import; registries that
need a context at module load build their own subset from direct imports.
Stable content-type names live in `contentTypes.ts` (see ADR 0005).

## Future Editor Work

The first validation split covers zones and quests. Future content tooling
should move the remaining first-error loaders toward `ContentDiagnostic` so
dialogues, NPCs, items, enemies, combat actions, NPC presence, and global config
can report several precise issues at once.

Reference validation should also move behind an explicit content context instead
of reading runtime registries directly. Validators should receive the item,
NPC, dialogue, zone, quest, and enemy catalogs they are checking against, which
will let editor drafts and mod bundles validate themselves before becoming the
active runtime bundle.

A `ContentReferenceGraph` should centralize cross-content links. That graph
should answer questions such as where an id is used, what breaks if an id is
renamed, and which content files depend on a dialogue, item, NPC, zone, quest,
or enemy definition.

Editing metadata should be exposed separately from gameplay types. The editor
will need available options for id fields, defaults, UI labels, required field
markers, short descriptions, and eventually field-specific controls without
putting React concerns inside the engine.

## NPCs And Dialogue

NPC definitions are character sheets: name, race, importance, optional map
presentation, and default dialogue. They do not store location-specific text or
mutable progression.

Dialogue files contain reusable sequences keyed by `dialogueId`. A character can
use different dialogue depending on the active zone appearance, schedule entry,
or saved NPC state. The engine resolves dialogue in this order:

1. zone appearance or active schedule override;
2. saved NPC state override;
3. character default dialogue.

## Global Presence

Global presence files describe where a character should be during the day.
Unlike a zone-local spawn, global presence can move the same `npcId` between
zones. The schedule system resolves the latest reached entry for the current
world day and applies that position to the active map when relevant.

## Tiles

The tile catalog at `src/content/tiles/tiles.json` maps numeric tile ids to a
name, a walkable flag, and map presentation (glyph and color). Zone grids
reference tiles by these numeric ids. Unknown tile ids fall back to the floor
tile for display code, but zone validation rejects them before gameplay.

## Items

The item catalog owns item names, descriptions, categories, and default
quantities. Inventories and ground spawns store only `itemId` and quantity.
Ground item presentation is resolved from item category so maps stay readable.

## Quests

Quest files define stable quest ids, objective lists, dialogue triggers, NPC
dialogue overrides, and rewards. Objective ids only need to be unique inside
their quest; runtime progress qualifies them with the quest id before saving.

Coordinate objectives must point to an authored zone and a walkable tile. This
keeps quests from becoming impossible because of a typo or blocked map square.
Stat threshold objectives are evaluated dynamically from the current player
state, while item fetch objectives are derived from inventory stacks.

## Saves

Saves serialize the current mutable state: active zone, player position, facing,
stats, inventory, log, world time, NPC state, and collected ground item spawn
keys. Static content is not copied into the save. Loading a save rebuilds the
world from current content plus saved mutable state.
