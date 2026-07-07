import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import type {
  CommandMasteryDef,
  CommandMasteryDefMap,
} from "./CommandMasteryDef";

const COMMAND_MASTERY_CONTENT_TYPE = "command-mastery";

const VALID_COMMAND_IDS = [
  "strike",
  "guard",
  "cast",
  "focus",
  "flee",
  "use_item",
  "study",
  "rest",
];

const commandMasteryDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/command-masteries/*.json", {
    eager: true,
    import: "default",
  }),
);

let overlayRegistry: CommandMasteryDefMap | null = null;

const registry = buildRegistry(commandMasteryDefs);

const fallback: CommandMasteryDef = {
  commandId: "unknown",
  name: "Unknown Command",
  cap: 1,
  usageRequired: 999,
  effects: {},
  unlocks: [],
};

export function hasCommandMasteryDef(commandId: string): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), commandId);
}

export function getCommandMasteryDef(commandId: string): CommandMasteryDef {
  return cloneCommandMasteryDef(getActiveRegistry()[commandId] ?? fallback);
}

export function getAllCommandMasteryDefs(): CommandMasteryDef[] {
  return Object.values(getActiveRegistry()).map(cloneCommandMasteryDef);
}

export function installCommandMasteryContentOverlay(
  defs: readonly CommandMasteryDef[],
): void {
  if (!import.meta.env.DEV) return;
  overlayRegistry = buildRegistry(defs);
}

export function clearCommandMasteryContentOverlay(): void {
  overlayRegistry = null;
}

function getActiveRegistry(): CommandMasteryDefMap {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearCommandMasteryContentOverlay);
}

export function validateCommandMasteryDef(value: unknown): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addMasteryError(
      diagnostics,
      undefined,
      "$",
      "Command mastery definition must be an object.",
    );
    return diagnostics;
  }

  const commandId = getNonEmptyString(value.commandId);
  const masteryLabel = commandId ?? "unknown";

  if (!commandId) {
    addMasteryError(
      diagnostics,
      undefined,
      "commandId",
      "Command mastery definition has invalid or missing commandId.",
    );
  } else if (!VALID_COMMAND_IDS.includes(commandId)) {
    addMasteryError(
      diagnostics,
      commandId,
      "commandId",
      `Command mastery definition "${commandId}" has unknown commandId. Expected one of: ${VALID_COMMAND_IDS.join(", ")}.`,
    );
  }

  validateNonEmptyString(value.name, commandId, masteryLabel, "name", diagnostics);

  if (
    typeof value.cap !== "number" ||
    !Number.isInteger(value.cap) ||
    value.cap <= 0
  ) {
    addMasteryError(
      diagnostics,
      commandId,
      "cap",
      `Command mastery definition "${masteryLabel}" has invalid cap. Expected a positive integer.`,
    );
  }

  if (
    typeof value.usageRequired !== "number" ||
    !Number.isInteger(value.usageRequired) ||
    value.usageRequired <= 0
  ) {
    addMasteryError(
      diagnostics,
      commandId,
      "usageRequired",
      `Command mastery definition "${masteryLabel}" has invalid usageRequired. Expected a positive integer.`,
    );
  }

  if (!isRecord(value.effects)) {
    addMasteryError(
      diagnostics,
      commandId,
      "effects",
      `Command mastery definition "${masteryLabel}" effects must be an object.`,
    );
  } else {
    validateEffects(value.effects, commandId, masteryLabel, diagnostics);
  }

  if (value.unlocks !== undefined && !Array.isArray(value.unlocks)) {
    addMasteryError(
      diagnostics,
      commandId,
      "unlocks",
      `Command mastery definition "${masteryLabel}" unlocks must be an array.`,
    );
  }

  return diagnostics;
}

function validateEffects(
  value: Record<string, unknown>,
  commandId: string | undefined,
  masteryLabel: string,
  diagnostics: ContentDiagnostic[],
): void {
  const numberFields = [
    "damageBoost",
    "incomingDamageMultiplier",
    "nextDamageBoost",
    "successChance",
    "itemEffectMultiplier",
    "xp",
    "energyRestore",
  ];

  for (const field of numberFields) {
    const val = value[field];
    if (val !== undefined && (typeof val !== "number" || !Number.isFinite(val))) {
      addMasteryError(
        diagnostics,
        commandId,
        `effects.${field}`,
        `Command mastery definition "${masteryLabel}" effects.${field} must be a number.`,
      );
    }
  }

  const mpCostReductionLevels = value.mpCostReductionLevels;
  if (mpCostReductionLevels !== undefined) {
    if (!Array.isArray(mpCostReductionLevels)) {
      addMasteryError(
        diagnostics,
        commandId,
        "effects.mpCostReductionLevels",
        `Command mastery definition "${masteryLabel}" effects.mpCostReductionLevels must be an array.`,
      );
    } else {
      for (let i = 0; i < mpCostReductionLevels.length; i++) {
        const val = mpCostReductionLevels[i];
        if (typeof val !== "number" || !Number.isInteger(val) || val <= 0) {
          addMasteryError(
            diagnostics,
            commandId,
            `effects.mpCostReductionLevels[${i}]`,
            `Command mastery definition "${masteryLabel}" effects.mpCostReductionLevels[${i}] must be a positive integer.`,
          );
        }
      }
    }
  }
}

export function validateCommandMasteryRegistry(
  defs: readonly unknown[],
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const seenIds = new Set<string>();

  for (const def of defs) {
    diagnostics.push(...validateCommandMasteryDef(def));
    if (!isRecord(def) || typeof def.commandId !== "string" || !def.commandId) {
      continue;
    }
    if (seenIds.has(def.commandId)) {
      addMasteryError(
        diagnostics,
        def.commandId,
        "commandId",
        `Duplicate command mastery definition "${def.commandId}".`,
      );
    } else {
      seenIds.add(def.commandId);
    }
  }

  return diagnostics;
}

function buildRegistry(defs: readonly unknown[]): CommandMasteryDefMap {
  const diagnostics = validateCommandMasteryRegistry(defs);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  return Object.fromEntries(
    defs.map((def) => {
      const masteryDef = def as CommandMasteryDef;
      return [masteryDef.commandId, cloneCommandMasteryDef(masteryDef)];
    }),
  );
}

export function cloneCommandMasteryDef(def: CommandMasteryDef): CommandMasteryDef {
  return {
    ...def,
    effects: {
      ...def.effects,
      mpCostReductionLevels: def.effects.mpCostReductionLevels
        ? [...def.effects.mpCostReductionLevels]
        : undefined,
    },
    unlocks: [...def.unlocks],
  };
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function validateNonEmptyString(
  value: unknown,
  commandId: string | undefined,
  masteryLabel: string,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    addMasteryError(
      diagnostics,
      commandId,
      path,
      `Command mastery definition "${masteryLabel}" has invalid or missing ${path}.`,
    );
  }
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function addMasteryError(
  diagnostics: ContentDiagnostic[],
  commandId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: COMMAND_MASTERY_CONTENT_TYPE,
    contentId: commandId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
