# Changelog

This file tracks meaningful project changes by commit-oriented slices.

Keep entries short and practical. When a slice is committed, its changelog section should stay aligned with the commit title so the project history remains easy to read after restores or bisects.

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
