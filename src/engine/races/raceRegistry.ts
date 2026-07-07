import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import { CORE_ATTRIBUTE_OPTIONS } from "../content/editingMetadata";
import type { RaceDef, RaceDefMap } from "./RaceDef";

const RACE_CONTENT_TYPE = CONTENT_TYPES.race;

const raceDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/races/*.json", {
    eager: true,
    import: "default",
  }),
);

let overlayRegistry: RaceDefMap | null = null;

const registry = buildRegistry(raceDefs);

const fallback: RaceDef = {
  raceId: "unknown_race",
  name: "Unknown Race",
  description: "A race that is not defined yet.",
  growthMultipliers: {},
};

export function hasRaceDef(raceId: string): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), raceId);
}

export function getRaceDef(raceId: string): RaceDef {
  return cloneRaceDef(getActiveRegistry()[raceId] ?? fallback);
}

export function getAllRaceIds(): string[] {
  return Object.keys(getActiveRegistry()).sort((a, b) => a.localeCompare(b));
}

export function getAllRaceDefs(): RaceDef[] {
  return Object.values(getActiveRegistry()).map(cloneRaceDef);
}

export function installRaceContentOverlay(defs: readonly RaceDef[]): void {
  if (!import.meta.env.DEV) return;
  overlayRegistry = buildRegistry(defs);
}

export function clearRaceContentOverlay(): void {
  overlayRegistry = null;
}

function getActiveRegistry(): RaceDefMap {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearRaceContentOverlay);
}

export function validateRaceDef(value: unknown): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addRaceError(
      diagnostics,
      undefined,
      "$",
      "Race definition must be an object.",
    );
    return diagnostics;
  }

  const raceId = getNonEmptyString(value.raceId);
  const raceLabel = raceId ?? "unknown";

  if (!raceId) {
    addRaceError(
      diagnostics,
      undefined,
      "raceId",
      "Race definition has invalid or missing raceId.",
    );
  }

  validateNonEmptyString(value.name, raceId, raceLabel, "name", diagnostics);
  validateNonEmptyString(
    value.description,
    raceId,
    raceLabel,
    "description",
    diagnostics,
  );
  validateGrowthMultipliers(
    value.growthMultipliers,
    raceId,
    raceLabel,
    diagnostics,
  );

  return diagnostics;
}

export function validateRaceRegistry(
  defs: readonly unknown[],
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const seenIds = new Set<string>();

  for (const def of defs) {
    diagnostics.push(...validateRaceDef(def));
    if (!isRecord(def) || typeof def.raceId !== "string" || !def.raceId) {
      continue;
    }
    if (seenIds.has(def.raceId)) {
      addRaceError(
        diagnostics,
        def.raceId,
        "raceId",
        `Duplicate race definition "${def.raceId}".`,
      );
    } else {
      seenIds.add(def.raceId);
    }
  }

  return diagnostics;
}

function validateGrowthMultipliers(
  value: unknown,
  raceId: string | undefined,
  raceLabel: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addRaceError(
      diagnostics,
      raceId,
      "growthMultipliers",
      `Race definition "${raceLabel}" growthMultipliers must be an object.`,
    );
    return;
  }

  for (const [attribute, multiplier] of Object.entries(value)) {
    if (!(CORE_ATTRIBUTE_OPTIONS as readonly string[]).includes(attribute)) {
      addRaceError(
        diagnostics,
        raceId,
        `growthMultipliers.${attribute}`,
        `Race definition "${raceLabel}" has unknown growth attribute "${attribute}".`,
      );
      continue;
    }
    if (
      typeof multiplier !== "number" ||
      !Number.isFinite(multiplier) ||
      multiplier <= 0
    ) {
      addRaceError(
        diagnostics,
        raceId,
        `growthMultipliers.${attribute}`,
        `Race definition "${raceLabel}" has invalid multiplier for "${attribute}".`,
      );
    }
  }
}

function buildRegistry(defs: readonly unknown[]): RaceDefMap {
  const diagnostics = validateRaceRegistry(defs);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  return Object.fromEntries(
    defs.map((def) => {
      const raceDef = def as RaceDef;
      return [raceDef.raceId, cloneRaceDef(raceDef)];
    }),
  );
}

export function cloneRaceDef(def: RaceDef): RaceDef {
  return {
    ...def,
    growthMultipliers: { ...def.growthMultipliers },
  };
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function validateNonEmptyString(
  value: unknown,
  raceId: string | undefined,
  raceLabel: string,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    addRaceError(
      diagnostics,
      raceId,
      path,
      `Race definition "${raceLabel}" has invalid or missing ${path}.`,
    );
  }
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function addRaceError(
  diagnostics: ContentDiagnostic[],
  raceId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: RACE_CONTENT_TYPE,
    contentId: raceId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
