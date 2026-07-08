# Changelog

This file tracks meaningful project changes by commit-oriented slices.

Keep entries short and practical. When a slice is committed, its changelog section should stay aligned with the commit title so the project history remains easy to read after restores or bisects.

## 2026-07-08 - [ADD]: Keyboard navigation for the editor

- Add roving-tabindex keyboard navigation to the editor tab bar, including arrow keys and numeric tab shortcuts.
- Add Up/Down + Enter navigation for the content browser, diagnostics, and reference lists.
- Add a reusable focus-trap hook and apply it to the map coordinate picker with initial focus, Tab containment, Escape close, and focus return.
- Unit-test the focus-trap index helper.

## 2026-07-08 - [ADD]: Keyboard navigation for game menus

- Add horizontal keyboard navigation for inventory category tabs while preserving vertical item selection and item actions.
- Add keyboard tab switching and local Escape handling to the character sheet, plus arrow-key navigation across the equipment body slots.
- Add keyboard selection for the quest journal lists and Enter/Escape dismissal for focused gameplay toasts.
- Unit-test the shared tab-navigation helper and the equipment slot movement map.

## 2026-07-08 - [ADD]: Pattern evolution and sheet techniques

- Auto-learn eligible QTE pattern evolutions after pattern usage through the shared learning path, with Fireball evolving into Pyrosphere while both techniques remain known.
- Show known techniques on the character sheet Mastery tab with full input sequences, usage counters, and evolution progress.
- Add a shipped `hunter_bow` with `recommendedMasteryLevel: 2` so below-recommendation mastery modulation exists in authored content.
- Unit-test evolution gating, coexistence, no double-learn behavior, and save round-trip persistence for an evolved pattern.

## 2026-07-08 - [FIX]: Stop Escape in menus from opening the pause menu

- Consume handled keys (`preventDefault` + `stopPropagation`) in `useMenuKeyboard` so a menu-closing keydown no longer bubbles to the global window listener; Escape in the inventory closed it AND opened the pause menu, and Escape in the equip picker also closed the whole character sheet.
- Extract the key-to-action decision as the pure `resolveMenuKeyAction` (unhandled keys keep bubbling so global shortcuts like `i`/`c` still work) and unit-test it.

## 2026-07-08 - [UPDATE]: Tune combat minigame balance targets

- Add a pure combat balance model for shared poor/average/strong QTE profiles and damage variance bands.
- Document weapon minigame and learned-pattern balance targets for sequence, mash, timing, and hidden pattern execution.
- Slightly ease the hidden timing windows for starter QTE patterns while keeping their MP costs and damage multipliers stable.
- Unit-test the balance model against tutorial enemies and learned-pattern damage estimates.

## 2026-07-08 - [ADD]: Execute learned QTE patterns

- Add combat selection for learned QTE patterns from Strike and Cast, with weapon compatibility and MP availability checks.
- Execute selected patterns as hidden fixed-sequence QTEs, spending MP on selection and applying the authored damage multiplier.
- Increment learned pattern usage after pattern attacks resolve, preparing the save state for later evolution rules.
- Add a combat pattern picker UI and tests for pattern availability, combat execution, rejection cases, and hidden sequence behavior.

## 2026-07-08 - [ADD]: Learn QTE patterns from tomes

- Add `effects.teachesPatternId` for consumable tome items, validate pattern references, expose the field in the item editor, and track tome-to-pattern references in the content graph.
- Add `QtePatternLearningSystem` to learn patterns outside `GameplayEngine`, with requirement checks for global level and effective intelligence, clean rejection without consuming the tome, notices, logs, and UI toasts.
- Persist learned patterns as `knownPatterns: patternId -> { timesUsed }`, bump saves to version `0.11`, and validate the new save state in storage.
- Add `crosscut_tome` and `fireball_tome` to starter content as quest rewards while leaving `pyrosphere` evolution-only.
- Unit-test the learning system, item validation, reference graph, save storage, engine integration, and full shipped content.

## 2026-07-08 - [ADD]: QTE pattern content family

- Add JSON-authored QTE patterns with registry loading, multi-error validation, detached reads, and dev overlay support.
- Add starter `fireball`, `pyrosphere`, and `crosscut` pattern definitions, including evolution and weapon-type requirements.
- Wire QTE patterns into content audits, runtime catalog snapshots, validation contexts, and the reference graph.
- Add a dev editor Patterns tab for creating, editing, saving, deleting, validating, and navigating references for pattern files.
- Unit-test the registry, shipped content, editor model, draft integration, audits, overlays, and reference handling.

## 2026-07-08 - [ADD]: Weapon masteries and minigame modulation

- Add per-archetype command masteries (`weapon_sword` / `weapon_hammer` / `weapon_bow` / `weapon_staff`, cap 10, usageRequired 8, empty effects/unlocks) to the command-mastery family and the persisted mastery set; a Strike or Cast with a weapon equipped now increments that weapon type's mastery.
- Add the soft `EquipmentDef.recommendedMasteryLevel` (default 0, weapon-only, validated) and an editor field for it; tier-0 weapons stay at 0.
- Modulate the minigame by `delta = clamp(masteryLevel − recommended, −3, +3)`: sequence time ±300 ms/point and ±1 input at |delta| ≥ 2, mash target −1/point (min 4), timing sweep ±10 %/point (clamp ±30 %). Bare-hand attacks are unmodulated.
- Unit-test the delta clamp and every per-mechanic modulation, plus the new weapon mastery definitions.

## 2026-07-08 - [ADD]: Timing volley minigame for bows

- Map the bow archetype to a new `timing` minigame: a volley of `volleySize` shots (authored per bow, default 3), each timed against a cursor sweeping the gauge in a base 1200 ms, with great/critical windows sized by the agility gap and centered on the gauge.
- Normalize the volley to the QTE contest: critical +2 / great +1 / miss −2 summed into `inputAdvantage`, `completed` when at least one shot lands, no mistakes (`computeTimingWindows`, `classifyTimingPress`, `mapTimingVolley` in `engine/combat/combatMinigame.ts`).
- Add the `TimingMinigame` UI component (sweeping cursor, great/critical zones, per-shot pips) and route it from `CombatPanel`; timing carries no opponent race, so the snapshot's `qteChallenge` mirror is derived only for the race-based mechanics.
- Add and validate the weapon-only `EquipmentDef.volleySize`, and expose it in the editor item form.
- Unit-test the window sizing, press classification, volley mapping, and the bow → timing resolution (incl. the shipped `training_bow`).

## 2026-07-08 - [ADD]: Weapon minigame profiles and the mash minigame

- Resolve the player's combat minigame from the equipped weapon: an authored `EquipmentDef.minigame` override wins, else the archetype default (`hammer` → mash, the rest → sequence), else the sequence race for unarmed/non-weapon (`resolveWeaponMinigameType` in `engine/combat/combatMinigame.ts`).
- Add the `mash` minigame spec: one randomly-drawn arrow hammered to a speed-derived target `clamp(12 - trunc(speedAdvantage/5)*2, 6, 20)` under the existing time budget, wrong arrow counts as a mistake (global 1/-20 %, 2/fail), with the same race-based `inputAdvantage` mapping and opponent progress as the sequence.
- Add the `MashMinigame` UI component (drawn arrow, press bar, opponent race, countdown) and route it from `CombatPanel`; share the arrow/WASD/ZQSD key mapping between minigames via `qteInput.mapKeyToDirection`.
- Validate the weapon-only `minigame` override in the item catalog and expose it in the editor item form.
- Unit-test the mechanic resolution (incl. shipped tier-0 weapons), the mash target derivation, the key mapping, and the override validation.

## 2026-07-08 - [REFACTOR]: Extract a combat minigame abstraction

- Introduce `CombatMinigameSpec` in `engine/combat/combatMinigame.ts` with its single `sequence` variant wrapping the QTE challenge and arrow sequence; `CombatState` now carries the engine-owned `minigame` spec, keeping `qteChallenge`/`qteSequence` as backward-compatible snapshot mirrors.
- Extract the QTE real-time loop, key matching, race bars, and countdown out of `CombatPanel.tsx` into a spec-driven `SequenceMinigame` component under `src/ui/game/combat/`; the panel now routes on the spec discriminator and no longer owns QTE state.
- Zero behavior change: existing tests pass unmodified and a playtest fight resolves identically (strike criticals, enemy defense, victory).

## 2026-07-08 - [DOCS]: Add the combat minigame and QTE pattern ADR

- Add ADR 0009 (`docs/adr/0009-minigames-arme-et-patterns-qte.md`), designed with the user and accepted 2026-07-08: per-weapon-archetype minigames (sword/staff sequence, hammer single-arrow mash, bow timing volley) all normalizing to the existing QTE contest resolution.
- Settle weapon masteries per archetype with a soft recommended level modulating each minigame, MP as the cost of all techniques (SP reserved for future ultimates), and learned QTE patterns: hidden execution with reset-on-mistake, acquired through single-use tomes and usage+level evolution, persisted in saves.
- Defer NPC pattern teaching to the relations chapter, SP ultimates, the Mana/Energy merge, and per-enemy attack profiles.

## 2026-07-08 - [REFACTOR]: Share the engine equippability predicate

- Add `canEquipInSlot` in `engine/items/equipmentRules.ts`: one pure predicate combining slot match (with the accessory1/accessory2 → accessory aliasing) and class equipment permissions, exported from the engine barrel.
- Consume it from both `GameplayEngine.equipItem` and the sheet's `getEquippableItemsForSlot`, removing the duplicated permission logic so the equip command and the equip picker can no longer drift.
- Unit-test the predicate across weapon-type gating, slot mismatch, accessory slots, and the no-weapon-type edge case.

## 2026-07-07 - [FIX]: Remove duplicated attribute summary

- Replace the top attribute summary with the detailed attribute layer table.
- Keep growth layer progression and pending attribute choice actions in their own section.

## 2026-07-08 - [FIX]: Lay modal tabs in a row and cap modal height

- Render the character sheet and inventory tabs as a compact horizontal row instead of a full-width vertical stack (override the shared button width in `.stats-modal__tabs`).
- Give the sheet tab content vertical spacing between its stacked sections so Resources no longer runs into Combat.
- Cap the inventory modal height with an internal scroll so it can no longer overflow the viewport and hide the Close button.

## 2026-07-07 - [UPDATE]: Rework the status panel and level-up feedback

- Replace the "Standing" line in CharacterStatusPanel.tsx with Global level and Class level tracks, displaying numeric progress and colored XP progress bars.
- Export deriveGrowthLayer and GLOBAL_GROWTH_CYCLE helpers from layeredStats.ts.
- Enrich level-up logs and toast notifications in GameplayEngine.ts with exact attribute improvements and the next XP threshold.
- Keep notice message construction logic in a pure, unit-tested levelUpHelper.ts.

## 2026-07-07 - [ADD]: Body-layout equipment tab

- Rebuild the equipment slot list in the character sheet into a visual body-shaped grid layout.
- Rework slot item representation to display item names and checkboxes.
- Allow checking an equipped slot to open the inventory modal with the selected item focused.
- Clicking a slot zone displays a keyboard-navigable equipment picker overlay.
- Filter candidate pickers using the slot match and the engine's active class equipment permissions.
- Add unit tests verifying the equippable gear filtering logic.

## 2026-07-07 - [REFACTOR]: Split the character sheet into tabs

- Refactor CharacterSheetModal.tsx to serve as a tabbed navigation panel.
- Split character sheet sections into five distinct React components under src/ui/game/sheet/: OverviewTab, AttributesTab, EquipmentTab, MasteryTab, and AcademyTab.
- Keep Esc and C closing/opening shortcut handlers functioning identically.

## 2026-07-07 - [UPDATE]: Split the inventory into category tabs

- Add horizontal category tabs (All, Quest, Consumable, Material, Equipment, Misc) to the inventory modal.
- Only render category tabs that have items present in the player's inventory, hiding empty ones.
- Restrict keyboard selection and navigation to run within the active category tab list.
- Support pre-selecting an item when mounting the inventory modal.
- Widen the inventory modal to 800px to accommodate tabs and fit equipment descriptions.
- Add pure unit-tested category extraction helper.

## 2026-07-07 - [UPDATE]: Starter world content pass

- Paint studySpot tiles in the scholar's area in test_zone.json.
- Author Tier 0 equipment items for all 8 slots and all 4 weapon types in items.json.
- Place equipment items in starter zones via ground pickups and quest rewards.
- Set XP rewards for lost_notebook (75 XP), advanced_quest (125 XP), and defeat_the_kobold (180 XP).
- Add sample classId, raceId, and level values to old_scholar, yuria, and goblin NPC definitions.
- Update quests.test.ts to expect quest rewards including the new equipment item and XP.
- Update project-plan.md and content-authoring.md documentation.

## 2026-07-07 - [ADD]: Gate Study to study environments

- Add studySpot property to TileDef and validate in validateTileDef.
- Define study desk tile (ID 2) with studySpot property in tiles.json.
- Allow optional rest.xp, study.timeCostMinutes, and study.xp fields in ActionTuningConfig and game.json.
- Gate Study action to tiles with studySpot = true in GameplayEngine.ts.
- Award configured XP and consume timeCostMinutes for Study in GameplayEngine.ts.
- Add unit and integration tests for Study gating, XP, and time cost.

## 2026-07-07 - [ADD]: Command mastery

- Add command mastery definition JSON content, registries, whole-bundle content audit, and validation context.
- Persist command mastery levels and usages in save slots, and bump save version to 0.10.
- Wire Rest command mastery bonuses to the gameplay engine.
- Wire Strike, Guard, Cast, Focus, Flee, and Use Item command mastery bonuses to the combat engine.
- Display command masteries and usage progress on the character sheet sheet.
- Add unit and gameplay tests for command mastery.

## 2026-07-07 - [UPDATE]: Set tutorial XP awards to the ADR 0008 values

- Give the slime, goblin, and kobold their approved xpReward values (25 / 40 / 80).
- Reward slay_the_slime with 75 XP so the tutorial combat quest plus the slime reach level 2 exactly.

## 2026-07-07 - [ADD]: XP and dual-track levels

- Add global and active-class XP curves, dual-track level-ups, and pending global attribute choices.
- Wire optional enemy and quest XP rewards through the gameplay engine with level-up notices and layered stat recalculation.
- Add XP fields to enemy and quest editors, expose XP progress and attribute-choice buttons on the character sheet, and bump saves to version 0.9.

## 2026-07-07 - [ADD]: Equip and unequip from the inventory

- Persist equipped item slots in saves and bump the save version for the new inventory shape.
- Add equip and unequip commands with class permission checks and equipment bonuses applied through the layered stat model.
- Show equipment slots on the character sheet and add an inventory Equip action for equipment items.

## 2026-07-07 - [ADD]: Equipment item content model

- Extend item content with equipment category data: slots, weapon types, and flat bonuses for attributes, combat stats, and max resources.
- Validate equipment blocks in the item registry while keeping unknown item fallbacks inert.
- Add equipment fields to the item editor and inventory/map presentation support for the equipment category.

## 2026-07-07 - [ADD]: Layered stat derivation

- Add pure layered stat derivation for base attributes, global growth, active class growth, race fractional buffers, and a future equipment layer.
- Persist player global/class progression, fractional buffers, active class id, and race id in the save shape with a save-version bump.
- Add a starting-race picker and show class/race levels plus base/global/class/equipment attribute layers on the character sheet.

## 2026-07-07 - [ADD]: Class and race content families

- Accept ADR 0008 with the approved Study mastery adjustment to use a skills-neutral XP bonus.
- Add class and race JSON content, registries, validation, runtime snapshots, validation context ids, reference graph links, and playtest overlays.
- Add editor tabs for class and race definitions, and expose optional RPG class/race/level fields on NPC sheets for future layered derivation.

## 2026-07-07 - [DOCS]: Revise the progression ADR to the layered model

- Replace the unaccepted progression ADR proposal with the settled layered model.
- Propose numeric defaults for global and class XP curves, race multipliers, fractional buffers, command mastery, gated Study, equipment permissions, equipment tiers, and XP awards.
- Align combat-balance notes with frozen CharacterSkills, command mastery, dual-track XP, race multipliers, and class-gated equipment.

## 2026-07-07 - [DOCS]: Propose the progression and equipment numbers

- Record the settled RPG foundations model in ADR 0008 without reopening the design decisions.
- Propose initial XP curve, level growth, attribute-choice cadence, skill-use thresholds, equipment bonus ranges, and XP award targets.
- Extend combat-balance notes with progression and equipment draft targets for the next implementation slices.

## 2026-07-07 - [ADD]: Start the playtest where the author is looking

- Resolve editor playtests to the selected zone instead of always using the configured new-game zone.
- Start at the pinned inspect cell when it is walkable, otherwise falling back to that zone's player start.
- Carry the resolved start into fresh playtest sessions without changing normal new-game or save loading behavior.

## 2026-07-07 - [ADD]: Launch a playtest session from the editor

- Add dev-only content overlays for registry-backed content so playtest sessions can read the current editor draft without writing content files.
- Add a Playtest action that freshly validates the combined draft, installs overlays, builds a draft content bundle, and starts a new isolated game session.
- Keep the editor mounted while playtesting so unsaved drafts survive the round-trip, and disable real save-slot access in playtest mode.

## 2026-07-07 - [DOCS]: Propose playtest content source architecture

- Compare full registry ownership inversion, a dev-only content overlay, and engine-level provider injection for editor playtesting.
- Recommend a dev-only content overlay while keeping zones and game config on the injectable content bundle.
- Define playtest save isolation and validation gating before implementation.

## 2026-07-07 - [UPDATE]: Default the zone editor to inspect mode

- Start zone editing in inspect mode so the first map click selects and reads placements instead of painting tiles.

## 2026-07-07 - [UPDATE]: Trim the Test Zone entry dialogue

- Drop the second entry-dialogue line (Old Sage energy tip) from test_zone, keeping the single welcome line.

## 2026-07-07 - [ADD]: Inspect and delete map placements from inspect mode

- Add findPlacementAt plus removeNpcAt/removeItemAt/removeTransitionAt pure helpers to the zone editor model, with describeZoneCell reusing findPlacementAt so the readout and selection cannot diverge.
- Clicking a placement in inspect mode now selects and highlights its inspector row and offers an inline delete that flows through the undoable draft.
- Deleting an NPC spawn drops its schedule with it; the player start is flagged as not deletable.

## 2026-07-07 - [UPDATE]: Close combined-draft cloning and graph deferral debts

- Deep-clone the game config into the combined draft snapshot so mutating a snapshot can no longer corrupt the live draft.
- Move the shared content reference graph onto the deferred value path so typing no longer rebuilds it every keystroke.
- Re-check references against a fresh graph synchronously in the dialogue, enemy, presence, and quest delete flows so a just-added reference still blocks the delete.

## 2026-07-06 - [ADD]: Filter editor lists by id and name

- Add a shared editor list filter field and id/name filtering helper.
- Filter content, zone, dialogue, NPC, presence, enemy, and quest lists locally without changing selection or drafts.
- Make the content browser searchable by display names for named content entries.

## 2026-07-06 - [FIX]: Match editor range slider colors to the theme

- Style editor range inputs with the active theme accent color instead of the browser default blue.
- Keep disabled range inputs visually muted with the editor text-muted color.

## 2026-07-06 - [ADD]: Preview scheduled NPC positions by time of day

- Export a pure NPC schedule-position helper for editor previews.
- Add scheduled zone render previews that move zone NPCs, hide NPCs scheduled into another zone, and show global presence entering the edited zone.
- Add a zone editor schedule-preview toggle and time slider, disabling placement edits while preview mode is active.

## 2026-07-06 - [ADD]: Navigate to content from diagnostics

- Add shared clickable diagnostic rendering for the content, zones, game config, and quest problem panels.
- Add a central editor navigation dispatcher that maps content references to the right editor tab and selected entry.
- Route editor reference lists through the same dispatcher, including incoming-reference panels across content-family tabs.

## 2026-07-06 - [ADD]: Mark unsaved tabs and guard editor exit

- Add unsaved indicators to editor tab buttons for each content family.
- Track aggregate unsaved state across all editor drafts, including zone drafts kept open across zone switches.
- Register a browser exit guard and confirm the Back action while any editor draft has unsaved changes.

## 2026-07-06 - [ADD]: Pick coordinates on the map from editor forms

- Add a shared map coordinate picker modal that renders zones from the combined draft snapshot, so unsaved zone edits are visible while choosing coordinates.
- Add "Pick on Map" controls for schedule entries, transition targets, quest visit-coordinate objectives, and the game safe respawn point.
- Reuse the zone hover readout inside the picker and keep existing validators responsible for accepting or rejecting picked cells.

## 2026-07-06 - [FIX]: Stop the zone map shaking on resize

- Bound the zone edit panel to the workbench column with a grid so the map row no longer sizes itself to the canvas it is measuring, breaking the auto-fit feedback loop.
- Move the map scroll onto the canvas container and drop the inner scroll region, removing the scroll-indicator gap that toggled during resize and shook the map.
- Center the canvas with `margin: auto` so it stays reachable when the grid overflows below the minimum cell size.

## 2026-07-06 - [FIX]: Repaint the zone map after auto-fit resizes

- Repaint the canvas with the current snapshot whenever the grid renderer is recreated, so a cell-size-only change no longer leaves the map black.
- Zone switches in the editor triggered the auto-fit to resize the canvas (which wipes it) without a matching redraw; the game screen path is unaffected.

## 2026-07-06 - [FIX]: Wrap editor tab panels to prevent grid overlapping

- Introduce `.editor-tab-content` flex wrapper container to properly group tab headers, summaries, and workbenches inside the main content row of the editor shell grid.
- Prevent grid row overflow by changing `.workbench` height from `100%` to flex-grow (`flex: 1`) so it fills the remaining tab viewport space dynamically.
- Constrain the `.scroll-region-frame` height inside `.workbench` to `100%` and `min-height: 0` to prevent inner column elements from overflowing the grid columns layout.
- Prevent `.editor-panel` from flex-shrinking below its content height by default (`flex-shrink: 0`) to ensure the panels expand to wrap all input fields and render their borders/backgrounds correctly inside flex scroll containers.
- Set the `editor-browser` flex-grow value to `2` inside `ContentTab.tsx` so the Content panel is twice as tall as the Problems panel.
- Introduce `.workbench--content-layout` and `.workbench--game-layout` modifier classes in `editor.css` to handle 2-column configurations.
- Configure Content tab with `.workbench--content-layout` (`minmax(20rem, 24rem) minmax(0, 1fr)`) to keep the left list narrow and make the right editor details panel large.
- Configure Game tab with `.workbench--game-layout` (`minmax(0, 1fr) minmax(18rem, 22rem)`) to keep the left config panel large and the right diagnostics list narrow.
- Remove empty rail placeholder components from `ContentTab.tsx` and `GameConfigPanel.tsx` to let these custom layouts take full advantage of the screen.

## 2026-07-06 - [REFACTOR]: Move the remaining tabs onto the workbench shell

- Migrate dialogues, NPCs, presence, enemies, and quests tabs onto the `.workbench` primitives, placing entity selections in the rail column, forms in the main column, and diagnostics/references in the inspector column.
- Migrate actions tab to the new layout placing the fixed 5-item action list in the rail.
- Migrate content and game config tabs onto the new layout using main and inspector columns, leaving the rail column empty to maintain grid symmetry.
- Remove obsolete tab layout classes (`.editor-dialogue-layout`, `.editor-npc-layout`, `.editor-enemy-layout`, `.editor-game-layout`, and `.editor-grid`) from the CSS stylesheet.
- Keep the selection list button styles uniform and prevent label text truncation using the 22b block format.

## 2026-07-06 - [UPDATE]: Auto-fit the zone map to the available space

- Add a pure unit-tested `computeFitCellSize(containerWidth, containerHeight, gridWidth, gridHeight, options)` helper to calculate fitting cell size within `[20, 64]` pixel bounds.
- Integrate `ResizeObserver` and debounce/throttle logic with `requestAnimationFrame` inside `EditorZoneCanvas` to measure container dimensions and scale the canvas dynamically.
- Remove obsolete `min-height` constraint from `.editor-zone-canvas-frame` in the CSS sheet, letting the grid row size the frame.

## 2026-07-06 - [REFACTOR]: Give the editor a stable workbench layout

- Restructure the content editor shell into a full-viewport CSS grid with fixed header, tab bar, and flex-filling content row.
- Drop width constraints (88rem/122rem caps) to utilize full screen area with side padding on all workbench views.
- Add `.workbench` layout primitives (rail, main content, inspector) with independent ScrollRegions, preventing overall page scrolling.
- Migrate the Zones tab to the new layout: zone list in the rail; canvas map in the main section; painter tools, diagnostics, and placements in the inspector.
- Relocate the hovered/pinned cell readout to a fixed-height status bar at the bottom of the map section, resolving layout reflows on hover.
- Add structured placeholders `(—, —) · — · —` to the status bar when inactive to preserve vertical layout height.
- Update `.editor-entry-button` style to prevent entry label clipping on overflow.

## 2026-07-06 - [ADD]: Show hovered cell info in the zone editor

- Add an optional `onCellHover` prop to `GameCanvas` and forward it in `EditorZoneCanvas` to support hover coordinates reporting without mouse button clicks.
- Add `hoveredCell` and `pinnedCell` states to `ZoneDraftEditor` to track the currently hovered or pinned grid coordinates.
- Implement click-to-pin behavior on the map canvas when the editor is in "inspect" mode, letting the pin survive pointer leave events.
- Implement a pure, unit-tested `describeZoneCell(zone, cell)` helper in `zoneEditorModel.ts` to derive the cell readout details including coordinates, tile name, tile glyph, walkable badge, and placements (player start, NPC id, item stack, transition target).
- Render the compact cell info readout block in the zone editor toolbox under placement controls.

## 2026-07-06 - [ADD]: Edit quest objectives in the editor

- Make quest objectives editable: add, remove, reorder, and switch between the four types (fetch_item, visit_coordinate, stat_threshold, defeat_npc) with per-type sub-forms and editable objective ids.
- Add `QUEST_STAT_NAME_OPTIONS` to the editing metadata as the single source of truth for stat paths, consumed by both the objective stat picker and `isStatPath` runtime validation.
- Add objective model helpers (create/add/update/type-switch/remove/reorder) with tests; rely on the existing validator for duplicate ids and coordinate bounds/walkability.

## 2026-07-06 - [ADD]: Create and edit quest sheets in the editor

- Add a Quests editor tab: create a quest (slug id + name), edit its name, description, target NPC, start/complete dialogue triggers, NPC dialogue overrides, and rewards (currency + item list); objectives stay read-only.
- Route quest drafts through the shared combined snapshot so quest validation and its pickers see unsaved items, NPCs, dialogues, and zones from other tabs.
- Surface that quest ids are persisted in saves and cannot be renamed; block deletion while a quest is referenced and warn that deleting orphans save-state entries.
- Extend the combined draft model with quests and add quest model helpers with tests.

## 2026-07-06 - [REFACTOR]: Share editor draft state across tabs

- Lift every editor family's draft and saved state into one `useEditorDrafts` owner that derives a single combined snapshot, validation context, deferred diagnostics, and reference graph shared by all tabs.
- Route each tab's diagnostics, reference graph, and save/delete gating through the combined view, so unsaved edits in one tab (e.g. a new dialogue) are visible to another tab's validation.
- Share one dialogue-files draft between the Dialogues and NPCs tabs, so a newly created default dialogue is immediately visible in both.
- Move zone selection and per-zone undo history into the owner keyed by zone id; unsaved zone edits now persist across zone and tab switches instead of being discarded.
- Add `createCombinedDraftSnapshot`/`createCombinedDraftValidationContext` (chaining the existing per-family composers) with tests; no per-family model tests change.

## 2026-07-06 - [ADD]: Edit combat action tuning in the editor

- Add an Actions editor tab for the fixed combat actions (no creation or deletion): edit name, category, order, summary, formula, tuning numbers, and the authored effect/detail lines.
- Show a live preview of the tuning-derived effect lines via `deriveCombatActionEffects`, and strip that derived prefix before editing so a save never rewrites the derived lines back into the file.
- Save one combat-action JSON per action, gated on `validateCombatActionDef` plus the whole-bundle audit, with a byte-stable round-trip test over the shipped files.
- Share the combat-action category options with runtime validation through `COMBAT_ACTION_CATEGORY_OPTIONS`.

## 2026-07-06 - [UPDATE]: Drop derived numeric lines from combat action content

- Remove the hand-authored "Gain N SP." / "Costs N MP." effect lines from the strike, cast, guard, and focus combat-action JSONs now that the registry derives them from `tuning`.
- Add a byte-identity test asserting the composed effect lists still match the original help text.
- Document that numeric combat-action effect lines are derived from tuning and must not be authored in `effects`.

## 2026-07-06 - [UPDATE]: Derive combat-action effect lines from tuning

- Add a pure `deriveCombatActionEffects(tuning)` that emits the exact SP/MP effect lines the combat-action JSONs used to hand-author, with unit tests.
- Compose derived numeric lines ahead of the authored qualitative effects when the combat-action registry builds, keeping multiplier tuning as authored prose and leaving the tuning-less fallback inert.
- Export the derivation for reuse (an editor tuning preview consumes it next).

## 2026-07-06 - [UPDATE]: Defer whole-bundle draft validation off the typing path

- Feed whole-bundle `validateAllContent` through `useDeferredValue` in every editor draft hook (items, zones, dialogues, NPCs, presence, enemies) and the game config panel, so typing and painting no longer re-audit the bundle synchronously per keystroke.
- Keep each reference graph, content browser, and render snapshot on the live draft so selection and painting stay responsive.
- Add a shared `draftHasBlockingErrors` helper and re-run the whole-bundle audit synchronously inside every save before writing, so a save never trusts a possibly-stale deferred error count.

## 2026-07-06 - [ADD]: Edit global NPC presence in the editor

- Add a Presence tab listing every NPC with its presence status, creating a presence for one that lacks it, editing its schedule with the shared `ScheduleEntriesEditor`, and deleting a presence file through the dev-only editor endpoint.
- Validate presence drafts against the whole content bundle by substituting the draft presence list into the catalog snapshot; the validation context needs no substitution.
- Add pure presence model helpers (list/create/upsert/update/remove, schedule entry edits, draft snapshot, default position), with tests.
- Give `ScheduleEntriesEditor` a configurable empty-zone label so presence prompts for a required zone.

## 2026-07-06 - [ADD]: Edit NPC schedules in the zone editor

- Add a shared `ScheduleEntriesEditor` for editing an NPC schedule (time, zone, coordinates, optional dialogue), flagging a malformed `HH:mm` time inline.
- Make the Zones tab NPC spawn panel add, edit, and remove schedule entries per spawn, driven through the existing undo/redo history and whole-bundle live validation.
- Add pure `addNpcScheduleEntry`/`updateNpcScheduleEntry`/`removeNpcScheduleEntry` helpers keyed by spawn cell, plus an `isValidScheduleTime` helper, with tests.

## 2026-07-06 - [ADD]: Create and edit enemy profiles in the editor

- Add an Enemies editor tab for attaching combat profiles to existing NPCs, editing raw stat sections, toggling combatability, and managing loot.
- Validate enemy drafts against the whole content bundle with draft enemy ids substituted into the validation context.
- Save enemy profiles as one JSON file per NPC and delete obsolete profile files through the dev-only editor endpoint.
- Surface compact combat-balance targets beside enemy stat editing.

## 2026-07-05 - [TEST]: Make content catalog tests tolerate growth

- Derive expected authored zones, enemies, NPC states, and zone serializer coverage from runtime content instead of fixed id lists.
- Replace tutorial-specific registry, dialogue, presence, item, runtime context, and content audit expectations with authored-content fixtures.
- Keep core tutorial checks for baseline enemies, actions, tiles, and gameplay fixtures without blocking additional authored content.
- Make game config serializer and bundle tests follow the authored data instead of specific starter item ids.

## 2026-07-05 - [ADD]: Add Yuria NPC

- Add Yuria as a story NPC with custom map presentation.
- Add Yuria's default dialogue sequence.
- Place Yuria in Test Zone 3.
- Track Yuria in the persistent NPC state regression expectation.

## 2026-07-05 - [ADD]: Create and edit NPC sheets in the editor

- Add an NPCs editor tab with sheet fields for name, race, importance, optional map presentation, and default dialogue.
- Validate NPC drafts against the whole content bundle with draft NPC ids and generated dialogue ids substituted into the context.
- Save one NPC JSON file at a time, with a creation shortcut that writes a default dialogue file before saving the new NPC.
- Share NPC race and importance options between editor controls and runtime validation.

## 2026-07-05 - [UPDATE]: Make the zone editor map-first

- Widen the Zones tab shell and rebalance its rails around a dominant map workbench.
- Move placement controls, draft actions, and save status into a compact toolbox beside the map.
- Render the zone editor canvas with a larger authoring cell size while leaving the game canvas default unchanged.

## 2026-07-05 - [UPDATE]: Wrap editor identifier labels at separators

- Add a reusable identifier label helper that inserts safe wrap points after `_`, `.`, `-`, and `:` separators.
- Use it on editor id buttons so long content ids wrap between meaningful segments instead of inside words.
- Keep the fallback behavior scoped to technical id labels, leaving ordinary button text unchanged.

## 2026-07-05 - [UPDATE]: Add breathing room to scroll indicators

- Reserve a small end padding in scroll regions only when the custom scroll indicator is visible.
- Move the indicator slightly inward so it no longer hugs panel borders or content cards.

## 2026-07-05 - [UPDATE]: Use subtle custom scroll indicators

- Hide native scrollbars on shared scroll regions while preserving normal wheel, touchpad, keyboard, and pointer scrolling.
- Add a thin custom scroll indicator that appears only when a region has overflow.
- Reuse the shared `ScrollRegion` path so editor panels inherit the same quieter scroll treatment.

## 2026-07-05 - [ADD]: Edit and create dialogues in the editor

- Track editable dialogue files separately from the flattened runtime dialogue registry, excluding the synthetic fallback from file saves.
- Add a Dialogues tab for creating dialogue files, adding dialogue ids, editing speaker/text/pitch nodes, and saving the owning JSON file.
- Block dialogue deletion while incoming content references still exist, with references listed beside the selected dialogue.
- Validate dialogue drafts against the whole content bundle with draft dialogue ids substituted into the validation context.
- Share the dialogue-node editor between reusable dialogues and zone entry dialogue.

## 2026-07-05 - [ADD]: Undo and redo for zone edits

- Back the zone draft with a past/present/future history stack; add Undo and Redo controls.
- Make Reset undoable (it pushes the current draft onto the history) so a reset never loses work.
- No-op edits do not create history entries, so a drag that stays in one cell adds a single undo step.

## 2026-07-05 - [ADD]: Pick the default zone and safe respawn in the editor

- Add a "Game" tab that edits game.json's `defaultZoneId` and `safeRespawn` (zone + coordinates), with live whole-bundle validation and save gating.
- Add `serializeGameConfig`, keeping each `startingInventory` stack on one line so a config edit produces a minimal diff; round-trip tested against the shipped game.json.
- Preserve the rest of game.json (actions, newGame) untouched on save.

## 2026-07-05 - [TEST]: Track test_zone_3 in zone discovery

- Update the zone-discovery test to expect the authored `test_zone_3`, restoring a green suite.

## 2026-07-05 - [ADD]: Edit zone entry dialogue in the editor

- Make a zone's entry-dialogue lines editable (speaker / text / pitch) on the same draft, with add and delete.
- Drive edits through the existing live validation so a blank speaker or text blocks saving until filled.
- Add `addEntryDialogueNode`/`updateEntryDialogueNode`/`removeEntryDialogueNode` helpers with tests; move the read-only dialogue list out of ZoneContents.

## 2026-07-05 - [ADD]: Create new zones from the editor

- Add a "New Zone" form to the Zones tab (zoneId, name, width, height) with live validation: a fresh slug id and a grid of at least 3x3.
- Generate a floor-filled grid with a wall border and a walkable player start via `createBlankZone`, saved through the dev editor endpoint.
- The dev server's `import.meta.glob` picks the new file up on reload; add `createBlankZone`/`validateNewZone` tests.

## 2026-07-05 - [ADD]: Edit zone placements in the editor

- Add a placement mode selector (inspect / tiles / player / NPC / item / transition / erase); a canvas click applies the active mode at that cell.
- Place the player start, NPC spawns (npcId + optional dialogueId), item stacks (itemId + quantity), and transitions (target zone + coordinates); erase removes any placement on a cell.
- Add pure, tested draft helpers (`setPlayerStart`/`placeNpcAt`/`placeItemAt`/`placeTransitionAt`/`erasePlacementsAt`) driven through the existing whole-bundle live validation and save gating.
- Split placement UI into `usePlacementSelection` and `ZonePlacementControls`; NPC schedules stay read-only.

## 2026-07-05 - [UPDATE]: Adjust the Test Zone 2 layout

- Add interior wall pillars to the Test Zone 2 grid (throwaway test content); the schedule targets stay walkable.

## 2026-07-05 - [FIX]: Validate zone tile edits against the whole content bundle

- Validate a zone paint draft with `validateAllContent` (draft zone swapped into both the snapshot and the validation context) instead of only the zone's own data.
- Surface and block saves on cross-content breakage a paint can cause — e.g. walling a tile a global NPC's schedule walks onto.
- Add `createZoneDraftSnapshot`/`createZoneDraftValidationContext` plus a test that painting over young_page's schedule target is flagged.

## 2026-07-05 - [FIX]: Keep zone tile rows compact when the editor saves

- Serialize zone drafts as standard 2-space JSON but keep each `tiles` row on a single line, so a save no longer explodes the grid into ~100 lines.
- Canonicalize the shipped zone files to that format so editor saves diff cleanly (tile content unchanged).
- Add a byte-stable round-trip test over the shipped zones; item catalog saves keep plain stringify.

## 2026-07-05 - [ADD]: Tile painting in the zone editor

- Make the Zones tab paint tiles: a tile palette plus click and click-drag painting on the zone canvas.
- Add a pure `pointerToCell` helper mapping pointer positions to grid cells via the canvas CSS box (devicePixelRatio-safe), wired through an optional `GameCanvas` `onCellPointer`.
- Keep a deep-cloned zone draft, re-run `validateZoneData` live, and surface walkability errors (wall under the player start, an NPC, an item, or a transition) in a problems panel.
- Save the draft to `src/content/zones/<zoneId>.json` through the dev editor endpoint, blocked while the draft has error diagnostics.
- Split the zones UI into `ZoneEditorPanel`, `ZoneDraftEditor`, `ZoneTilePalette`, and `ZoneContents`; switching zones starts a fresh draft (unsaved tile edits are discarded — follow-up, and no undo stack yet).

## 2026-07-05 - [REFACTOR]: Split the content editor screen into panels

- Extract `ContentTab`, `ItemDraftEditor`, and `ReferenceList` into their own files under `src/ui/editor/`.
- Lift the content/item draft state into a `useItemDraft` hook so unsaved edits still survive tab switches.
- Shrink `ContentEditorScreen` to snapshot creation plus tab orchestration (742 to 62 lines).
- No behavior change; the editor model tests pass unchanged.

## 2026-07-05 - [ADD]: Independent panel scrolling in the editor

- Add reusable layout primitives: `app-shell--bounded` pins a screen to the viewport and a `ScrollRegion` block owns its own scrollbar.
- Bound both editor tabs to the viewport so the header and tabs stay fixed while each panel scrolls on its own instead of scrolling the whole page.
- Scroll a large zone preview inside its frame rather than stretching the layout.
- Fall back to natural single-column page scrolling below 1100px.

## 2026-07-05 - [ADD]: Read-only zone viewer in the editor

- Add a Zones tab to the dev content editor for previewing authored zones.
- Add `createZoneEditRenderSnapshot` to project authored zone data into the shared grid render contract.
- Render the selected zone through the existing `GridRenderer` via an `EditorZoneCanvas` adapter.
- List the selected zone's NPC spawns (with schedules), item stacks, transitions, and entry dialogue read-only.

## 2026-07-04 - [FIX]: Require trusted request headers for editor saves

- Require a custom editor header on the save endpoint so cross-origin pages trigger an unapproved CORS preflight.
- Reject save requests whose Origin header does not match the dev server host.
- Reject opaque or malformed request origins.
- Record the request trust rules in the editor persistence ADR.
- Add header validation tests for same-origin, originless, cross-origin, and malformed cases.

## 2026-07-04 - [ADD]: Editable item catalog in the editor

- Add an editable item draft panel to the dev content editor.
- Validate item drafts live and refresh cross-content reference checks from the draft ids.
- Save the item catalog through the dev-only editor persistence endpoint.
- Share item category options between runtime validation and the editor UI.

## 2026-07-04 - [ADD]: Add dev editor content persistence

- Accept the editor persistence ADR around a dev-only Vite save endpoint.
- Add a Vite middleware for saving JSON content editor drafts.
- Restrict editor writes to project-relative `src/content/**/*.json` paths.
- Add path allowlist regression tests for traversal, absolute paths, and non-JSON files.

## 2026-07-04 - [ADD]: Read-only content editor screen

- Add a dev-only content editor screen reachable from the title menu.
- List runtime content families and ids from the catalog snapshot.
- Show whole-bundle content diagnostics grouped by content type.
- Explore incoming and outgoing references plus rename impact for selected content ids.

## 2026-07-04 - [DOCS]: Propose editor persistence architecture

- Propose a dev-only Vite middleware for saving editor JSON changes.
- Compare the Vite middleware approach with the File System Access API.
- Document the path allowlist, traversal rejection, and git-tracked JSON constraints.

## 2026-07-04 - [REFACTOR]: Extract inventory and item use out of GameplayEngine

- Move ground item pickup and exploration item use into a dedicated inventory system.
- Keep GameplayEngine delegating pickup checks and UseItem commands through the new system.
- Preserve item collection, item use, rejection effects, logs, and time costs.

## 2026-07-04 - [REFACTOR]: Extract quest progression out of GameplayEngine

- Move quest lifecycle, objective progression, and quest save-id restoration into a dedicated quest system.
- Keep GameplayEngine delegating quest start, completion, coordinate checks, and combat victory tracking.
- Preserve quest rewards, item turn-ins, completion logs, and active quest snapshots.

## 2026-07-04 - [SETUP]: Add continuous integration workflow

- Add a GitHub Actions workflow for pushes and pull requests.
- Install dependencies with npm ci on Node 22.
- Run the test suite and production build in CI.

## 2026-07-04 - [FIX]: Close content validation gaps found in review

- Check known-zone NPC schedule targets for bounds and walkability in the whole-bundle audit.
- Return detached game config data from runtime catalog snapshots.
- Require tile id 0 so the unknown-tile fallback contract is always valid.
- Document the tile 0 fallback requirement in the content authoring notes.

## 2026-07-04 - [DOCS]: Document content contracts and engine API for modding

- Document enemy definitions: NPC linkage, combatable flag, authored stat block, and loot.
- Document stat sections and their combat roles on the shared character stats types.
- Document every game command and the combat QTE payload semantics.
- Document zone data field constraints, one-shot entry dialogue, and dialogue pitch bounds.
- Document combat action fields, QTE challenge and contest types, and the combat UI state.
- Add enemies and consumable effects sections to the content authoring notes.

## 2026-07-04 - [DOCS]: Keep additional local workspace notes untracked

- Ignore an additional local planning note that should not enter the repository.

## 2026-07-04 - [ADD]: Content reference graph and whole-bundle audit

- Add a content reference graph answering where an id is used and what a rename impacts.
- Flag id families persisted in save files in rename impact reports.
- Build plain-data catalog snapshots from shipped content for graph and audit consumers.
- Add a whole-bundle audit running every content validator plus dangling-reference checks.
- Keep the shipped bundle audit-clean with a permanent regression test.
- Update the project plan and content authoring notes for the completed editor foundations.

## 2026-07-04 - [ADD]: Move combat action tuning into content

- Author SP gains, MP costs, and Guard/Focus multipliers in the combat action files.
- Validate tuning fields as positive integers or positive multipliers.
- Resolve combat tuning from content with code defaults preserving current balance.
- Keep the unknown-action fallback free of tuning values.
- Note that prose effect strings duplicate tuning numbers until an editor generates them.

## 2026-07-04 - [ADD]: Author rest and study tuning in game config

- Author rest energy restoration and study costs and gains in game config.
- Validate action tuning values as positive integers with content diagnostics.
- Drive rest and study behavior from injected tuning with code defaults for isolated engines.
- Keep study reusing the academic progress gain for the scholarship skill, matching existing behavior.

## 2026-07-04 - [ADD]: Author new-game inventory and stats in game config

- Author starting currency, max energy, inventory, attributes, and skills in game config.
- Validate the global game config with accumulating diagnostics and an injected context.
- Check starting inventory ids against the item catalog and respawn walkability against zone maps.
- Create fresh-game state from the injected config while keeping code defaults for isolated engines.
- Leave save restoration untouched since saves store the full player state.

## 2026-07-04 - [REFACTOR]: Add enemy and combat action content diagnostics

- Validate enemy definitions with accumulating diagnostics across stats, conditions, and loot.
- Check enemy NPC and loot item references against an injected catalog subset.
- Validate combat action definitions with accumulating diagnostics.
- Report duplicate combat action ids as errors and shared menu orders as warnings.
- Add multi-error and injected-context tests for both registries.

## 2026-07-04 - [REFACTOR]: Add dialogue, NPC, and presence content diagnostics

- Validate dialogue files with accumulating diagnostics and cross-file duplicate checks.
- Validate NPC definitions against an injected dialogue catalog subset.
- Validate global presence definitions against injected NPC and dialogue catalogs.
- Keep strict registry builds throwing on the first blocking diagnostic.
- Leave presence zone-existence checks to the future whole-bundle content audit.
- Add multi-error and injected-context tests for the three registries.

## 2026-07-04 - [REFACTOR]: Inject the content validation context everywhere

- Expand the content validation context with enemy, quest, combat action, and tile catalogs.
- Make the context module type-only and move the runtime builder to a top-of-graph module.
- Validate zone references against an injected context subset instead of runtime registries.
- Build the quest registry startup context from direct imports instead of the full runtime context.
- Share stable content-type names between diagnostics and future content tooling.
- Add ADR 0005 for the injected validation context decision and its deferrals.

## 2026-07-04 - [ADD]: Move tile definitions into JSON content

- Author floor and wall tiles in a JSON tile catalog instead of engine code.
- Validate the tile catalog with accumulating content diagnostics.
- Expose the full tile definition map for validation contexts.
- Keep tile lookup signatures and the floor fallback unchanged.
- Document the tile catalog in the content authoring notes.

## 2026-07-04 - [ADD]: Move consumable item effects into the item catalog

- Author energy and HP restoration values in the item catalog effects block.
- Read exploration item use from authored energy effects instead of a hardcoded map.
- Read combat item use from authored HP effects instead of a duplicated hardcoded map.
- Validate effect fields as positive integers and warn when a non-consumable declares effects.
- Keep the unknown-item fallback free of effects so unknown ids stay unusable.

## 2026-07-04 - [REFACTOR]: Validate the item catalog with content diagnostics

- Validate the raw item catalog with accumulating content diagnostics instead of an unchecked cast.
- Check item ids, names, descriptions, categories, and default quantities.
- Keep the strict runtime registry throwing on the first blocking diagnostic.
- Return detached item definitions from the registry getter.
- Add item catalog validation tests and registry behavior tests.

## 2026-07-04 - [DOCS]: Refresh project plan around the finished prototype

- Rewrite the project plan from the V0 milestone framing to the current playable prototype state.
- List the shipped systems: zones, NPCs, schedules, dialogues, quests, inventory, stats, QTE combat, saves.
- Document known debt: hardcoded item effects, starting inventory, tile registry, and oversized central files.
- Define the current milestone: data-driven content migration and content editor foundations.
- Align the product direction milestone notes with the current scope.

## 2026-07-04 - [REFACTOR]: Remove unused engine helpers

- Remove the unused NPC state map clone helper superseded by per-state cloning.
- Remove the unused stat section type from character stats.
- Drop both from the engine barrel exports.

## 2026-07-04 - [REFACTOR]: Add quest diagnostics validation context

- Add an explicit content validation context for item, NPC, dialogue, and zone references.
- Expose registered item and dialogue ids for editor-facing validation.
- Validate quest definitions and quest registry collisions through content diagnostics.
- Keep the runtime quest registry strict while enabling multi-error editor checks.
- Document quest diagnostics and injected validation context for future content tooling.

## 2026-07-04 - [REFACTOR]: Split zone validation from runtime map creation

- Add reusable content diagnostics for editor-facing validation.
- Expose zone validation without constructing runtime maps.
- Keep `loadZone` as the strict runtime API that throws on invalid content.
- Add explicit conversion from validated zone data to `GameMap`.
- Document the validation/conversion boundary for future content tooling.
- Document the remaining editor-readiness work around injected validation context, references, and editing metadata.

## 2026-07-04 - [REFACTOR]: Introduce a central content bundle

- Add global game content config for the default zone and safe respawn point.
- Add a ContentBundle layer that discovers authored zones and resolves runtime maps.
- Replace hardcoded UI zone imports with the central content bundle.
- Use configured safe respawn data for combat defeat recovery.
- Reuse the central zone bundle when validating quest coordinate objectives.

## 2026-07-03 - [ADD]: Expand combat action choices

- Replace raw physical and magical choices with Strike, Cast, Guard, Focus, Use Item, and Flee actions.
- Add MP cost for casting, SP gains for core actions, guard mitigation, and focus damage boost.
- Allow consumable items to heal HP during combat and consume the player turn.
- Move combat item selection into a dedicated popup opened from the Use Item action.
- Control combat menus with arrow-key selection while keeping arrows reserved for active QTE prompts.
- Load combat action help from one JSON definition per action.
- Show concise combat action tooltips and an I-key details popup for the selected action.
- Add engine tests for combat costs, modifiers, item use, and invalid actions.

## 2026-07-03 - [UPDATE]: Add combat damage variance

- Apply final combat damage variance between 75% and 125% after QTE and mistake modifiers.
- Add deterministic combat tests for low and high damage rolls.
- Add explicit Goblin enemy registry and balance guardrail coverage.
- Update combat balance notes for the Slime, Goblin, and Kobold ladder.

## 2026-07-03 - [ADD]: Create Goblin monster between Slime and Kobold on test zone 2

- Define Goblin NPC with orange "g" glyph and a threatening dialogue line.
- Add Goblin enemy definition with combat stats between Slime and Kobold (HP 27, ATK 7, DEF 4).
- Grant goblin_ear as quest loot on defeat.
- Spawn Goblin at (8, 3) in Test Zone 2, between the Slime and Kobold columns.
- Update enemy registry and gameplay engine test snapshots for the new content.

## 2026-07-03 - [UPDATE]: Show player combat stats in battle UI

- Replace unavailable sidebar commands with player MP, SP, and combat stats during combat.
- Show player ATK, DEF, AGI, and SPI beside the opponent combat summary.
- Keep combat resources visible without duplicating MP and SP in the center combat panel.

## 2026-07-03 - [UPDATE]: Rename smallest currency unit to copper

- Rename the smallest currency denomination to Copper in UI formatting and content text.
- Update currency display from `b` to `c`.
- Keep stored currency values unchanged as the same smallest-unit integer.

## 2026-07-03 - [UPDATE]: Balance early combat targets and guardrails

- Add first combat balance notes for stat roles, QTE profiles, and early enemy targets.
- Rebalance Kobold as a faster, more offensive early duelist instead of a player-stat mirror.
- Add deterministic fight length guardrail tests for Slime and Kobold.
- Check that a Kobold critical hit threatens but does not defeat a fresh player.

## 2026-07-03 - [REFACTOR]: Extract combat systems and data-drive enemy quests

- Move active combat state and combat command handling out of GameplayEngine.
- Keep GameplayEngine responsible for world recovery when combat defeat changes zones.
- Add enemy content files and registry validation for combat stats and loot.
- Resolve combat eligibility, NPC combat stats, and victory loot from enemy content.
- Add a defeat_npc quest objective type and mark it from combat victories.
- Update Slime and Kobold quests to require defeating targets instead of collecting remains.
- Keep monster remains as regular combat loot rather than quest-proof requirements.
- Add registry and quest tests for enemy loading, cloning, loot, and defeat objectives.

## 2026-07-03 - [FIX]: Repair kobold quest start and equal-stat combat damage

- Apply global NPC presence schedules to matching zone-local NPC spawns.
- Ensure the Old Wizard can offer the Kobold quest through his scheduled dialogue.
- Replace subtraction-only combat mitigation with a smoother defense curve.
- Reduce Kobold HP to 40 so the first monster duel resolves faster.
- Centralize combat NPC and victory loot lookups.
- Add regression tests for equal-stat damage and scheduled quest dialogue.

## 2026-07-03 - [ADD]: Create Kobold monster, quest line, and loot mechanics

- Define Kobold NPC data matching initial player attributes and stats.
- Spawn Kobold at (8, 2) in Test Zone 2.
- Implement "Defeat the Kobold" quest given by the Old Wizard in Test Zone.
- Create old_wizard scheduled presence at (7, 6) in Test Zone to trigger quest start dialogue.
- Schedule Old Wizard's presence to start from 00:00 so he is present all day.
- Enable combat initiation for the Kobold NPC.
- Add kobold_remains item definition and grant it as loot upon Kobold defeat.
- Update CombatPanel and GameplayEngine to manage Kobold remains collection.
- Add unit test validating defeat_the_kobold quest loading.

## 2026-07-03 - [UPDATE]: Balance QTE difficulty constraints and adjust minimum key delay

- Increase default QTE base time limit to 5 seconds.
- Broaden QTE sequence length limits to clamp between 3 and 10 inputs.
- Reduce slime agility from 8 to 4, decreasing its QTE speed.
- Adjust opponent simulated keypress delay formula to base 1000ms and multiplier 40ms, raising minimum delay to 400ms.
- Calculate QTE sequence length and time limit relative to the player's speed advantage in both attack and defense.
- Decouple player sequence length from opponent sequence length, giving slower defenders a longer sequence requirement in the real-time race.

## 2026-07-03 - [UPDATE]: Display enemy Spirit and implement stats-based fleeing

- Render opponent's Spirit (SPI) in the CombatPanel stats details block.
- Adjust flee success chance to scale with player vs opponent Agility, clamped between 10% and 90%.

## 2026-07-03 - [UPDATE]: Refine QTE combat with sound, mistakes, and turn delay

- Integrate Web Audio synthesizers for QTE key directional sounds and error buzz feedback.
- Add mistake scaling logic: 1 mistake gives a 20% penalty; 2 mistakes trigger an immediate QTE fail.
- Implement an automatic 1.5-second transitional pause between player attacks and opponent responses.
- Update GameplayEngine, commands, snapshots, and CombatPanel to propagate mistake counts.
- Add unit tests for mistake damage modifiers, instant failures, and transitional phases.

## 2026-07-03 - [ADD]: Implement turn-based QTE combat system

- Define enemy base statistics and createNpcStats builder.
- Add SelectCombatAction, SubmitCombatQte, and ConcludeCombat commands.
- Implement real-time typing QTE contest racing loop inside React.
- Create CombatPanel UI dashboard with HP/MP/SP meters, keycap indicator, and speed race tracks.
- Intercept grid movement and keyboard controls when combat is active.
- Add unit tests verifying QTE damage calculations, loot acquisition, and defeat teleportation.

## 2026-07-03 - [UPDATE]: Improve conditions structure and critical hit scaling

- Define CharacterCondition type with id, name, and optional durationInTicks.
- Update save validator, deep clone function, and UI to support structured condition objects.
- Refactor critical hit damage formula to deal bonus damage scaled to attacker's power.

## 2026-07-03 - [UPDATE]: Add structured character stats and QTE combat helpers

- Replace flat character stats with resources, attributes, combat values, skills, progression, and conditions.
- Add derived stat helpers for HP, MP, SP, combat values, and stat path lookups.
- Add QTE combat helpers for speed-based challenge difficulty and attacker/defender contest results.
- Update study, quests, saves, snapshots, and character UI to use the structured stats model.
- Widen the character sheet into a responsive multi-column layout for the expanded stats.
- Bump save data to version 0.6 and reject older local test saves.
- Add engine tests for structured stats, deep snapshot cloning, save restore, and QTE outcomes.

## 2026-07-03 - [FIX]: Center toast stack relative to center panel

- Move game toast stack component inside the center panel.
- Position toast stack absolutely relative to the center panel instead of fixed to the viewport.

## 2026-07-03 - [FIX]: Center toast message text

- Center item feedback toast labels inside their terminal frame.

## 2026-07-03 - [UPDATE]: Stack item feedback toasts

- Show toast feedback when items are used or handed in for quest completion.
- Keep item reward and pickup feedback in the same toast flow.
- Allow several recent toasts to remain visible in a scrollable stack.
- Pause toast dismissal while the player is hovering or focusing the toast stack.
- Add quest completion tests for item loss and reward item effects.

## 2026-07-03 - [ADD]: Add a first study activity

- Add a Study command that spends energy and advances world time.
- Increase intelligence and academic progress from studying.
- Expose Study through the left sidebar and the T keyboard shortcut.
- Split sidebar controls into Menus and Actions with compact keycap buttons.
- Reject studying when the player lacks enough energy.
- Add engine tests covering study progress and exhaustion.

## 2026-07-03 - [FIX]: Prevent bracket wrapping for quest objectives checkboxes

- Apply white-space nowrap and flex-shrink rules to prevent quest checkbox brackets from line-splitting on narrow screens.

## 2026-07-03 - [UPDATE]: Redesign Quest Journal with list buttons and details popup

- Display active and completed quests as a list of interactive buttons in the journal.
- Implement an overlay pop-up for showing detailed quest description, objectives, and rewards.
- Close the details view independently of the main journal using the Escape key.
- Style quest list items with interactive hover and focus outline cues in dark-neon theme.

## 2026-07-02 - [FIX]: Harden quest objective persistence and save migration

- Migrate 0.4 save data to the current save shape when reading save slots.
- Qualify sticky completed objective records by quest id to avoid cross-quest collisions.
- Preserve unambiguous legacy objective progress during save restoration.
- Validate coordinate quest objectives against existing walkable zone tiles.
- Point the advanced quest coordinate objective at authored zone content.
- Add regression tests for save migration and objective progress persistence.

## 2026-07-02 - [ADD]: Support coordinate and stat threshold quest objectives

- Define VisitCoordinateObjective and StatThresholdObjective schemas.
- Upgrade local storage save game standard to V0.5 to persist completedObjectives list.
- Track coordinate target arrivals on movements as sticky objectives.
- Track attribute and stats thresholds dynamically in real-time.
- Parse and strictly validate coordinates and stat limits in quest definitions.
- Project dynamic progress and completion flags to UI snapshots.
- Add advanced unit tests verifying dynamic status, sticky movement checks, and registry loaders.

## 2026-07-02 - [UPDATE]: Show item pickup toast feedback

- Surface collected item effects from the React gameplay bridge.
- Show a toast naming the item and quantity picked up from the ground.
- Keep save toasts on the default terminal accent tone.
- Add an important red toast tone for quest items and future rare pickups.

## 2026-07-02 - [FIX]: Make zone entry dialogues one-shot events

- Track zone entry dialogue events as seen playthrough state in GameplayEngine.
- Expose only pending zone entry dialogue through game snapshots.
- Add an explicit command for acknowledging consumed zone entry dialogue.
- Persist seen zone entry event ids while keeping older 0.4 saves loadable.
- Prevent save restoration from replaying the current zone's entry dialogue.
- Add engine and storage tests for one-shot entry dialogue behavior.

## 2026-07-02 - [FIX]: Align pointer and keyboard menu controls

- Mark terminal buttons as keyboard-blocking while hovered to avoid mixed pointer and keyboard commands.
- Ignore menu navigation and activation keys while the pointer rests on a menu entry.
- Stop handled menu key events from bubbling into modal overlays.
- Rebuild the save-slot modal with the shared terminal menu component.
- Add directional-key navigation, Escape back handling, and menu sounds to save-slot and overwrite choices.

## 2026-07-02 - [FIX]: Harden quest dialogue completion and save restore

- Make Escape during dialogue reveal the current line instead of closing the dialogue.
- Trigger quest start and completion only from an engine-tracked pending NPC dialogue.
- Remove dialogueId from the public CompleteDialogue command payload.
- Add an explicit quest-start dialogue for the first notebook quest.
- Log currency and item rewards when a quest is completed.
- Filter unavailable saved quest ids during load and show a cancellation notice.
- Keep snapshots resilient when saved quest ids no longer exist in content.
- Add engine tests for guarded dialogue completion and unavailable quest restore.

## 2026-07-02 - [ADD]: Implement V1 Quest System with Registry, Journal, and Overrides

- Declare quests in static JSON content files under content/quests.
- Build quest registry loaded at startup with strict validations (trigger uniqueness, item/dialogue consistency).
- Create player ECS component Quests to track active and completed quests.
- Resolve dialogue overrides in real-time based on quest progress (readyToComplete > active > completed).
- Apply triggers (starting, completing quests) at dialogue completion via CompleteDialogue engine command.
- Derive item objective progress dynamically from player inventory to prevent desynchronization.
- Add Quests Journal modal styled in premium TerminalPanel theme, toggled using layout-aware keys (Q in QWERTY, A in AZERTY).
- Render active objectives stacked neatly in the right sidebar above the chronicle Action Log.
- Implement save/load serialization for quest progress under version 0.4.
- Add unit tests verifying registry validation, quest triggers, item consumption, rewards, and save/load cycles.

## 2026-07-02 - [REFACTOR]: Decouple saves and document content contracts

- Move the shared log entry type out of GameplayEngine.
- Make save serialization consume explicit engine state instead of the engine instance.
- Keep save restoration inside GameplayEngine through a private restore helper.
- Re-private mutable engine state, spawn helpers, and player component lookup helpers.
- Remove unused GameplayEngine imports and dead item spawn key helper.
- Add content authoring notes for future data and mod support.
- Document zone, item, NPC, dialogue, presence, save, and runtime component contracts.
- Clarify registry fallback behavior and defensive cloning of content data.
- Document world calendar, NPC schedule, and entity spawning helpers.

## 2026-07-02 - [UPDATE]: Move NPC schedules into global presence data

- Add a global NPC presence registry with auto-discovered JSON content.
- Move the Young Page schedule out of zone files and into npc-presence content.
- Spawn globally scheduled NPCs in the active zone based on world time.
- Hide scheduled NPCs from the current map when their active schedule points to another zone.
- Let scheduled positions override the active NPC dialogue for contextual conversations.
- Add registry, loader, schedule-system, and gameplay tests for global NPC presence.

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
- Add currency conversion formatting to partition total copper coins into Platinum (p), Gold (g), Silver (s), and Copper (c) divisions.
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
