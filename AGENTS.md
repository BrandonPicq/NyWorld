# NyWarudo - Instructions for Codex

## Collaboration style

Work as a guided pair programmer. The goal is not to generate large opaque batches of code, but to grow the project step by step with shared understanding.

Before creating or changing an important file, explain:

- the file path;
- the file's role;
- what will be added or changed;
- notable dependencies, risks, or alternatives.

Standard mechanical configuration files may be grouped in one explanation when they belong to the same setup step.

After each small slice, summarize:

- files changed;
- behavior added;
- checks run;
- open questions or remaining risks.

## Product direction

NyWarudo is a mostly textual fantasy life-simulation game with grid-based exploration.

Long-term goals include:

- a player growing into life in a medieval fantasy world;
- academy life and non-combat career paths;
- combat as one possible conflict resolution system, not the whole game;
- living NPCs with schedules, movement, relationships, and initiative;
- detailed stats and history so the player can understand what they have done;
- support for audio, portraits, images, and sprites over time.

The first milestone is intentionally small:

- launch the game;
- display an empty grid-based zone;
- place the player on the grid;
- move the player with keyboard and UI buttons;
- show basic debug information such as position, tick, and active zone.

## Technical direction

Use the current project decisions unless the user explicitly revises them:

- TypeScript + React + Vite for the web app and UI.
- A custom gameplay engine independent from React.
- A custom Canvas 2D renderer for the grid.
- A simple ECS architecture for entities, components, and systems.
- JSON content data validated by TypeScript schemas.
- Discrete time represented by ticks.
- Web-first architecture, with desktop/mobile wrappers considered later.

Keep engine rules out of React components. React should render engine snapshots and send explicit commands to the engine.

Keep rendering logic out of the simulation. Canvas should draw from render-ready state, not decide gameplay behavior.

## Development habits

Prefer small vertical slices over broad unfinished systems.

Default to simple, readable code. Add abstractions only when they protect a real extension point, reduce duplication, or match the architecture already chosen.

Tests should scale with risk:

- pure engine behavior should have unit tests;
- UI behavior should have focused tests when it contains meaningful logic;
- visual behavior can be checked manually at first, then with browser automation when useful.

When a design choice becomes important or hard to reverse, add a short ADR under `docs/adr/`.

## Current documentation

Maintain these project documents once they exist in this repository:

- `docs/project-plan.md` for the current project plan;
- `docs/collaboration-method.md` for how we work together;
- `docs/adr/` for architecture decisions.

Keep documentation practical and short. Update it when it prevents future confusion.

