# Content Authoring Notes

This document explains how authored content moves from JSON files into the
gameplay engine. It is intentionally general so it stays useful when test
content is replaced by larger worlds or mods.

## Content Flow

Content starts as JSON under `src/content`. Registries discover those files,
validate references where they can, and expose detached copies to the engine.
Zone files are validated by `loadZone`, then converted into `GameMap` instances.
Gameplay systems work from `GameMap`, registries, and save state rather than
editing imported JSON directly.

The important rule is ownership:

- content files define stable data such as zones, items, NPC identities, dialogue
  sequences, and daily presence;
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

## Zones

Zone JSON describes the map rectangle, tile grid, player start, optional
transitions, optional entry dialogue, NPC appearances, and ground item stacks.
`loadZone` rejects invalid tile ids, blocked spawn positions, unknown content
references, malformed dialogue, and invalid schedules before a `GameMap` reaches
gameplay code.

Zone coordinates use integer grid space with `(0, 0)` at the top-left corner.

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
