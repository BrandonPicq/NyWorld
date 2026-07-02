# Changelog

This file tracks meaningful project changes by commit-oriented slices.

Keep entries short and practical. When a slice is committed, its changelog section should stay aligned with the commit title so the project history remains easy to read after restores or bisects.

## 2026-07-02 - [UPDATE]: Move scheduled NPCs across zones

- Allow NPC schedule entries to target a zoneId as well as coordinates.
- Hide scheduled NPCs from the current map when their active schedule points to another zone.
- Let scheduled positions override the active NPC dialogue for contextual conversations.
- Move the Young Page between the test zones in the evening schedule.
- Add loader, schedule-system, and gameplay tests for cross-zone presence and schedule dialogue.

## 2026-07-01 - [ADD]: Move NPCs with simple daily schedules

- Add optional NPC schedule entries to zone content.
- Validate scheduled NPC times and target coordinates during zone loading.
- Add a small NPC schedule system resolving active positions from world time.
- Apply schedules when NPCs spawn, time advances, zones load, and saves restore.
- Move the Young Page to an evening location in the test zone.
- Add tests for schedule parsing, validation, movement, interaction, and save restore behavior.

## 2026-07-01 - [ADD]: Resolve NPC dialogue through dialogue ids

- Move NPC dialogue content into dedicated dialogue JSON files.
- Auto-discover NPC and dialogue JSON files from their content directories.
- Replace inline NPC definition dialogue with defaultDialogueId references.
- Allow zone NPC spawns to override dialogue with a contextual dialogueId.
- Resolve NPC dialogue from zone override, saved NPC state, or character default.
- Add optional currentDialogueId to persistent NPC state for future progression.
- Validate dialogue references in NPC definitions, zone loading, and save data.
- Add registry, loader, engine, and save-storage tests for contextual dialogue.

## 2026-07-01 - [ADD]: Add persistent NPC state foundation

- Add NpcState for mutable per-character progress keyed by npcId.
- Initialize NPC state for every known NPC definition.
- Expose NPC state through GameplayEngine snapshots and getNpcState.
- Persist and restore NPC state through save data.
- Bump save data version for the new required NPC state payload.
- Add engine and save-storage tests for NPC state persistence and validation.

## 2026-07-01 - [UPDATE]: Move NPC definitions into character files

- Add per-NPC character JSON files under content/npcs.
- Add NpcDef types and an NPC registry with known-definition lookup.
- Simplify zone NPC spawns to npcId and coordinates only.
- Resolve NPC names, dialogue, race, importance, and map presentation from the registry during spawning.
- Validate zone NPC spawns against known npcIds.
- Add registry, loader, and engine tests for NPC definition resolution.

## 2026-07-01 - [UPDATE]: Simplify NPC map presentation

- Add NPC race, importance, and optional presentation override fields to zone data.
- Render common NPCs with a shared glyph and a race-based color.
- Allow notable and story NPCs to use explicit glyph/color overrides.
- Move NPC map presentation into a central engine helper.
- Update test zone NPC data to reduce visual glyph noise.
- Add loader, presentation, and engine tests for NPC map rendering rules.

## 2026-07-01 - [ADD]: Add world calendar and clock display

- Add a 12-month, 30-day world calendar starting in year 425.
- Track narrative world time separately from technical ticks in GameplayEngine snapshots.
- Advance world time through movement, rest, item use, and dialogue actions.
- Display an analog clock and world date in the character status sidebar.
- Show action log entries with world time instead of technical ticks.
- Remove the technical tick from the central debug strip.
- Persist world time in save data and show world dates in save slot summaries.
- Add calendar, engine, and save validation tests for world time behavior.

## 2026-07-01 - [ADD]: Implement basic game save and load with 3 slots

- Add GameSaveData versioned interface and SAVE_VERSION constant.
- Add TickCounter.restoreTo to support save restoration.
- Add GameplayEngine.createSaveData serializing zone, tick, position, facing, stats, inventory, log, and collected item keys.
- Add static GameplayEngine.fromSaveData restoring engine state from a save and respawning only uncollected items.
- Add multi-slot localStorage persistence layer (3 slots) with deep version validation and safe read/write/delete functions.
- Add Save Slots modal for choosing a save slot from the pause menu.
- Add GameToast component with slide-in animation for save confirmation.
- Add Save Game entry to the pause menu.
- Add Continue entries on the title screen for each occupied save slot.
- Wire useGameplayEngine to accept initialSaveData for restoring from a save.
- Wire App.tsx to orchestrate New Game, Continue, and Back to Title flows.
- Recover from unavailable saved zones by returning to the title screen with a notice.
- Ask for confirmation before overwriting an occupied save slot.
- Add engine tests for createSaveData serialization and fromSaveData roundtrip and item respawn prevention.
- Add storage tests for read/write roundtrip, write failures, invalid JSON, wrong version, missing fields, and invalid nested data.

## 2026-07-01 - [ADD]: Allow opening game options from the pause menu

- Add an Options entry to the pause menu.
- Keep the active game mounted while browsing options from a paused game.
- Return from options back to the paused game when options were opened from gameplay.
- Keep title-screen options returning to the title screen.

## 2026-07-01 - [ADD]: Use consumable items for energy restoration

- Add a UseItem command accepting an itemId and rejecting non-consumables or missing inventory entries.
- Map consumable item ids to energy restore values (travel_ration: 10, healing_herb: 20).
- Restore only missing energy, report the actual recovered amount, and consume one stack item only when the use succeeds.
- Reject usage at max energy or without a configured effect, keeping quantity and tick unchanged.
- Return ItemUsed and ItemUseRejected effects so the UI can play feedback or show a notice independently.
- Wire the inventory modal to display a Use button only on consumable stacks.
- Display an inventory notice popup for rejected uses, closable by click, Escape, or [OK].
- Update keyboard controls so Escape closes the notice before the inventory.
- Add tests covering energy restoration, actual capped recovery, stack changes, rejection cases, and effect emission.

## 2026-07-01 - [UPDATE]: Improve ground item readability and pickup feedback

- Drop per-item glyph and color from the item catalog and resolve map presentation centrally from the item category.
- Expose getItemMapPresentation(itemId) returning a shared glyph and a per-category color, with a misc fallback for unknown items.
- Switch spawnItems to use the shared map presentation instead of per-item fields.
- Extend GameplayEngine.execute to return an effects array, with pickupItem emitting an ItemCollected effect.
- Keep the engine free of audio dependencies by routing effects through the React bridge.
- Add playItemCollectSound with a short ascending two-tone Web Audio cue, gated by audio settings.
- Update the inventory modal to keep working without per-item display fields.
- Add tests for the shared glyph, category colors, and the new ItemCollected effect.

## 2026-07-01 - [ADD]: Pick up ground items and grow the item catalog

- Add an Item ECS component (itemId, quantity) for ground entities.
- Add an external item catalog at content/items/items.json with five items including starter definitions.
- Add an ItemRegistry that exposes getItemDef and hasItemDef, mirroring the TileRegistry pattern.
- Normalize InventoryStack to { itemId, quantity }, resolving name, description, and category from the registry at render time.
- Allow zones to declare an items[] spawn list validated by the zone loader (walkable tile, valid itemId, positive integer quantity).
- Auto-pick up ground items on collision, merging quantities into existing stacks when present.
- Respawn uncollected zone items on zone entry alongside NPCs.
- Keep picked-up zone item spawns collected for the current engine session.
- Update the inventory modal to read display data from the item registry.
- Add tests for pickup, stack merging, and item validation.

## 2026-07-01 - [ADD]: Add read-only player inventory

- Add an Inventory ECS component with InventoryStack items (itemId, name, description, category, quantity).
- Define item categories as quest, consumable, material, and misc.
- Provide three starter items (Academy Notebook, Travel Ration, Chalk Piece) on the player entity.
- Expose inventory in the game snapshot with a deep copy so UI cannot mutate engine state.
- Add an InventoryModal with item name, quantity, category label, and description.
- Add an [I] Inventory button to the left sidebar alongside Sheet and Rest.
- Add I key handling in useGameKeyboardControls to toggle the inventory modal.
- Disable game controls while the inventory modal is open.
- Update project plan documentation.

## 2026-07-01 - [REFACTOR]: Align Stats component contract

- Make the `Stats` component extend the shared ECS component contract.

## 2026-07-01 - [UPDATE]: Add interaction targeting gameplay option

- Track the player's facing direction in gameplay snapshots.
- Add an interaction scope option for around-player or facing-only targets.
- Extract reusable UI interaction target selection helpers.
- Generalize the interaction choice modal for future non-NPC choices.
- Harden gameplay settings persistence and targeted interaction fallback behavior.

## 2026-07-01 - [ADD]: Add contextual interact command

- Add an `Interact` command for contextual game actions.
- Let Interact talk to adjacent NPCs without moving the player.
- Map the `E` key and add an Interact button to the game controls.
- Add tests for interaction input mapping and engine interaction behavior.
- Update the V0 plan with contextual interaction support.

## 2026-07-01 - [REFACTOR]: Extract game screen hooks and document public APIs

- Move game engine snapshot orchestration into a reusable hook.
- Move game-screen keyboard shortcuts into a dedicated hook.
- Move zone entry dialogue triggering into a dedicated hook.
- Add concise API documentation to gameplay, rendering, input, and settings helpers.

## 2026-07-01 - [UPDATE]: Move zone entry dialogue into content data

- Add `entryDialogue` zone content for test zones.
- Validate zone entry dialogue nodes during zone loading.
- Expose current zone entry dialogue through gameplay snapshots.
- Trigger zone entry dialogue from snapshot data instead of hardcoded UI text.
- Add tests for entry dialogue validation and snapshot exposure.

## 2026-07-01 - [FIX]: Harden dialogue interaction blocking and NPC validation

- Disable game command controls while dialogue or character sheet overlays are active.
- Reject NPC content with empty dialogue arrays before creating a zone map.
- Add zone loader tests for valid NPC data, empty NPC dialogue, and blocked NPC spawns.

## 2026-07-01 - [FIX]: Resolve TypeScript excess property checking on inline object literals

- Explicitly type NPC spawn component literals when adding them to the ECS world.

## 2026-07-01 - [UPDATE]: Log NPC interaction details to game log

- Add a game log entry when player movement collides with an NPC.
- Verify NPC interaction log entries in engine unit tests.

## 2026-07-01 - [UPDATE]: Center D-pad layout and add Gameplay option screen

- Reorganize direction keys in UI to place `Interact` dead-center and `South` at bottom-center.
- Introduce `Gameplay` configurations section in system settings.
- Implement `Smart Interact` togglable helper to disable the UI button when no NPC is adjacent.
- Add local storage persistence for gameplay option choices.
- Add unit tests for settings fallback loading and saving.

## 2026-07-01 - [ADD]: Introduce interactive NPCs and collision dialogue

- Define `Npc` component and register it in engine barrel exports.
- Spawn map-defined NPCs inside ECS during initialization and zone entry.
- Implement collision detection when player moves onto an NPC coordinate to block move and return NPC dialogue sequence.
- Expose secondary entities in `GameSnapshot` and render them as colored bold text glyphs on the canvas.
- Wire movement results in UI to trigger dialogue sequences when walking into NPCs.
- Populate starting zone with an "Old Scholar" NPC at (3, 3) with custom dialogue and gravelly voice bleep.
- Add unit tests for NPC validation, parsing, spawning, and dialogue collisions.

## 2026-06-30 - [REFACTOR]: Split game screen components

- Extract game screen panels, dialogue box, and character sheet into dedicated UI files.
- Move dialogue typewriter state, progression, and text bleep playback into a dedicated hook.
- Keep GameScreen focused on orchestration, input, and engine snapshot wiring.
- Restrict movement input typing so Rest stays outside movement key mappings.

## 2026-06-30 - [ADD]: Add test zone transitions

- Add transition data between the two test zones.
- Validate transition entries during zone loading.
- Let GameplayEngine resolve zone transitions after successful movement.
- Fix the second test zone start position so the zone can load.
- Add tests for transition loading, detection, zone entry, and current test content.

## 2026-06-30 - [UPDATE]: Improve canvas render boundaries

- Add render-ready grid snapshots between engine data and Canvas drawing.
- Remove the GridRenderer dependency on tile gameplay definitions.
- Scale canvas backing pixels with devicePixelRatio for sharper rendering.
- Add tests for grid render snapshot conversion.

## 2026-06-30 - [REFACTOR]: Extract game input mapping

- Move game keyboard mapping out of GameScreen into a reusable controls module.
- Add tests for QWERTY, AZERTY, arrow keys, letter casing, and movement labels.
- Keep GameScreen focused on listening for input and dispatching engine commands.

## 2026-06-30 - [ADD]: Render game grid with canvas

- Add a Canvas 2D grid renderer for zone tiles and the player marker.
- Add a GameCanvas React adapter around the renderer.
- Replace the text grid on the game screen with the canvas renderer.
- Add canvas-specific game screen styles.

## 2026-06-30 - [TEST]: Harden zone loading and engine movement

- Add GameplayEngine tests for cardinal movement, blocked movement, ticks, and logs.
- Add zone loader tests for valid data, unknown tile ids, invalid starts, and blocked starts.
- Reject unknown tile ids during zone loading.
- Reject non-integer player starts and starts on blocked tiles.

## 2026-06-30 - [ADD]: Build gameplay engine and connect to UI

- Add ECS core (World, EntityId, Component) for entity and component management.
- Add Position, PlayerControlled, and Renderable components.
- Add MovementSystem with cardinal movement bounded by map walkability.
- Add TileRegistry, GameMap, ZoneTypes, and zoneLoader for JSON zone data.
- Add TickCounter for discrete time tracking.
- Add GameplayEngine orchestrating World, TickCounter, GameMap, commands, and snapshots.
- Add test_zone.json content data (10x8 walled zone).
- Connect GameScreen to GameplayEngine with keyboard arrow keys and UI movement buttons.
- Display text-based grid, debug panel (position, tick, zone), and action log.
- Update styles and barrel exports for the new engine and game screen.

## 2026-06-30 - [ADD]: Add player stats dashboard and detailed character sheet modal

- Introduce a modular ECS Stats component supporting energy, currency, attributes, and academic rank.
- Implement energy decay (1 energy per valid movement step) and Rest command (recovers 15 energy, costs 1 tick).
- Add currency conversion formatting to partition total bronze coins into Platinum (p), Gold (g), Silver (s), and Bronze (b) divisions.
- Restructure the Game Screen layout on wide screens to display three columns: stats panel (left), map grid (center), and actions log (right).
- Add detailed Character Sheet overlay (toggled with `C` or Esc) displaying attributes dynamically.

## 2026-06-30 - [UPDATE]: Optimize canvas theme rendering performance

- Cache theme-related CSS variable values in GridRenderer to remove style calculation from the hot render loop.
- Watch for HTML data-theme attribute modifications using a MutationObserver to update colors.
- Clean up and disconnect MutationObserver on canvas unmount.

## 2026-06-30 - [UPDATE]: Add keyboard layout toggle (QWERTY / AZERTY)

- Add a QWERTY / AZERTY layout configuration setting under Options.
- Persist keyboard layout configuration in localStorage.
- Enforce layout exclusivity for inputs (WASD when QWERTY is selected, ZQSD when AZERTY is selected).
- Update GameScreen control button labels to adapt dynamically to the active layout.
- Update project plan documentation.

## 2026-06-30 - [UPDATE]: Polish game screen layout, canvas colors, and controls

- Restructure game movement controls in a uniform CSS Grid (D-pad layout with identical button sizes).
- Add support for WASD and ZQSD keyboard layouts for directional movement.
- Retrieve active theme colors dynamically in GridRenderer to style tiles and player marker.
- Fix missing/invalid CSS design variables in game screen layout stylesheet.
- Add automatic scroll-to-bottom for the action log container.
- Update project plan documentation.

## 2026-06-30 - [UPDATE]: Convert audio sound settings to inline toggle

- Replace the separate Sound: On/Off options with a single inline toggle.
- Wire selection and horizontal key inputs to toggle the sound state.
- Update project plan documentation.

## 2026-06-30 - [UPDATE]: Convert theme selection to inline cycling

- Replace the dedicated options-themes screen with inline cycling in the Graphics menu.
- Extend MenuItem type with optional onLeft and onRight callbacks.
- Handle ArrowLeft and ArrowRight keys in TerminalMenu to trigger inline cycling.
- Update OptionsScreen to render inline cycle controls and handle input.
- Remove old theme selection route and callbacks from App.tsx.
- Update project plan documentation to align with the new structure.

## 2026-06-30 - [DOCS]: Add project changelog discipline

- Add a project changelog organized by commit-oriented slices.
- Backfill the changelog with the existing project history.
- Document local changelog maintenance rules.
- Keep local workspace guidance untracked.

## 2026-06-30 - [ADD]: Build initial UI foundation

- Add the Vite, React, and TypeScript app foundation.
- Add the terminal-style title screen and temporary game placeholder screen.
- Add nested Options screens for Graphics, Themes, and Audio.
- Add keyboard menu navigation with Enter, Escape, and Tab handling.
- Add theme presets, audio settings, persistence, and menu beep feedback.
- Add modular CSS tokens, terminal components, and screen styles.
- Add unit tests for menu navigation, themes, and audio settings.
- Update the project plan with the V0 UI structure and options flow.

## 2026-06-30 - [DOCS]: Keep local workspace notes untracked

- Ignore local collaboration notes that should not enter the repository.

## 2026-06-30 - [SETUP]: Decisions for the architecture baseline

- Add the initial V0 project plan.
- Add architecture decisions for the web-first stack, gameplay engine, and data format.
- Add local project guidance for development habits and Git history.
