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
- `classId` and `raceId` link RPG progression metadata to class and race
  definitions.

Ids should be stable once they appear in saves. Renaming an id later requires a
save migration or compatibility alias.

## Game Config

`src/content/game.json` owns global authoring choices that should not be
hardcoded in React or the gameplay engine. `defaultZoneId` selects the starting
zone for a new game. `safeRespawn` selects where the player returns after a
combat defeat or similar recovery event.

The safe respawn point must reference an authored zone and a walkable tile.

The `actions` section authors the tuning of out-of-combat player actions:
rest energy restoration and study costs and gains. Study reuses
`academicProgressGain` for both academic progress and the scholarship skill
gain, matching the current gameplay behavior.

The `newGame` section authors the starting state of a fresh playthrough:
starting currency, maximum energy, starting inventory stacks, and the initial
attribute and skill values. Saves store the full mutable player state, so this
section never affects loaded games. Starting inventory ids must exist in the
item catalog.

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
holding the known item, NPC, dialogue, enemy, quest, combat action, tile,
class, race, and zone catalogs. Each validator declares the subset it needs
(for example `ZoneValidationContext` or `QuestValidationContext`), so editor
drafts and mod bundles can build their own context and validate before
becoming active content. The runtime builder
`createRuntimeContentValidationContext` lives in its own top-of-graph module
that registries must never import; registries that need a context at module
load build their own subset from direct imports. Stable content-type names live
in `contentTypes.ts` (see ADR 0005).

## Whole-Bundle Audit And Reference Graph

Every content family now has an editor-facing validator that accumulates
`ContentDiagnostic`s: zones, quests, items, tiles, dialogues, NPCs, global
presence, enemies, combat actions, classes, races, and the game config.

`validateAllContent` (`engine/content/contentAudit.ts`) runs all of them over a
`ContentCatalogSnapshot` plus full-context cross checks that per-registry
validation cannot see, such as presence schedules pointing at unknown zones.
The shipped bundle is kept audit-clean by a permanent test; a future editor
problems panel consumes the same API.

`buildContentReferenceGraph` (`engine/content/ContentReferenceGraph.ts`)
centralizes cross-content id links. It answers where an id is used, which
references dangle against a catalog context, and what a rename would impact,
including whether the id family is persisted in save files.
`createRuntimeContentCatalogSnapshot` builds the snapshot from shipped content;
editor drafts and mod bundles can assemble the same shape themselves.

## Future Editor Work

Editing metadata should be exposed separately from gameplay types. The editor
will need available options for id fields, defaults, UI labels, required field
markers, short descriptions, and eventually field-specific controls without
putting React concerns inside the engine. Stable content-type names already
live in `engine/content/contentTypes.ts` (ADR 0005 records the wider
decisions and deferrals).

The numeric `effects` lines in combat action files are now derived from the
authored `tuning` at build time; `formula` and `details` still restate tuning
numbers by hand and could be derived later too.

## NPCs And Dialogue

NPC definitions are character sheets: name, race, importance, optional map
presentation, default dialogue, and optional RPG metadata (`classId`, `raceId`,
`level`). They do not store location-specific text or mutable progression.

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

## Classes And Races

Class files live under `src/content/classes/*.json`. A class definition owns a
stable `classId`, display text, equipment permissions, and a repeated growth
cycle. Unknown classes resolve to an inert display fallback: no growth and no
equipment permissions.

Race files live under `src/content/races/*.json`. A race definition owns a
stable `raceId`, display text, and attribute growth multipliers. Multipliers
feed layered stat derivation later; they do not change authored base stats.

## Tiles

The tile catalog at `src/content/tiles/tiles.json` maps numeric tile ids to a
name, a walkable flag, and map presentation (glyph and color). Zone grids
reference tiles by these numeric ids. The catalog must define tile id `0`
because unknown tile ids fall back to tile 0 for display code, while zone
validation rejects unknown ids before gameplay.

## Enemies

Enemy files attach a combat profile to an existing NPC: the `npcId` must match
a character definition, which keeps identity, dialogue, and map presence in
the NPC sheet while the enemy file owns combat data. Walking into or
interacting with a `combatable` NPC starts combat instead of dialogue.

An enemy authors its full stat block directly (resources, attributes, combat
values, skills, progression, optional conditions) — unlike the player, no
values are derived. `loot` lists the item stacks granted on defeat and may be
empty. Stat roles and balance target ranges live in `docs/combat-balance.md`.

## Items

The item catalog owns item names, descriptions, categories, and default
quantities. Inventories and ground spawns store only `itemId` and quantity.
Ground item presentation is resolved from item category so maps stay readable.

Consumables declare their use effects in an `effects` block: `energyRestore`
applies when the item is used during exploration, `hpRestore` when it is used
during combat. A consumable without effects is rejected on use with a player
notice.

## Combat Actions

Combat action files own the player-facing texts (name, summary, formula,
effects, details) and a `tuning` block with the gameplay numbers the combat
system reads: SP gains, MP costs, and the Guard/Focus damage multipliers.

The registry derives the numeric effect lines from `tuning` at build time and
prepends them to the authored `effects`: an `spGain` of 5 renders "Gain 5 SP."
and an `mpCost` of 10 renders "Costs 10 MP." Do not author those numeric lines
in `effects` — keep only the qualitative prose there, so a rebalance in `tuning`
updates the help text automatically. Multiplier tuning has no derived line and
stays authored prose. The `formula` and `details` strings still restate tuning
numbers by hand.

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
