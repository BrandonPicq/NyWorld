# Changelog

This file tracks meaningful project changes by commit-oriented slices.

Keep entries short and practical. When a slice is committed, its changelog section should stay aligned with the commit title so the project history remains easy to read after restores or bisects.

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
