import type { ContentDiagnostic } from "../content/ContentDiagnostic";
import { formatContentDiagnostic } from "../content/ContentDiagnostic";
import { CONTENT_TYPES } from "../content/contentTypes";
import {
  CORE_ATTRIBUTE_OPTIONS,
  EQUIPMENT_ARMOR_SLOT_OPTIONS,
  EQUIPMENT_WEAPON_TYPE_OPTIONS,
} from "../content/editingMetadata";
import type {
  AttributeGrowth,
  ClassDef,
  ClassDefMap,
  ClassEquipmentPermissions,
} from "./ClassDef";

const CLASS_CONTENT_TYPE = CONTENT_TYPES.class;

const classDefs = getSortedContentModules(
  import.meta.glob<unknown>("../../content/classes/*.json", {
    eager: true,
    import: "default",
  }),
);

let overlayRegistry: ClassDefMap | null = null;

const registry = buildRegistry(classDefs);

const fallback: ClassDef = {
  classId: "unknown_class",
  name: "Unknown Class",
  description: "A class that is not defined yet.",
  equipmentPermissions: {
    allowedWeaponTypes: [],
    allowedArmorSlots: [],
  },
  growthCycle: [],
};

export function hasClassDef(classId: string): boolean {
  return Object.prototype.hasOwnProperty.call(getActiveRegistry(), classId);
}

export function getClassDef(classId: string): ClassDef {
  return cloneClassDef(getActiveRegistry()[classId] ?? fallback);
}

export function getAllClassIds(): string[] {
  return Object.keys(getActiveRegistry()).sort((a, b) => a.localeCompare(b));
}

export function getAllClassDefs(): ClassDef[] {
  return Object.values(getActiveRegistry()).map(cloneClassDef);
}

export function installClassContentOverlay(defs: readonly ClassDef[]): void {
  if (!import.meta.env.DEV) return;
  overlayRegistry = buildRegistry(defs);
}

export function clearClassContentOverlay(): void {
  overlayRegistry = null;
}

function getActiveRegistry(): ClassDefMap {
  return overlayRegistry ?? registry;
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearClassContentOverlay);
}

export function validateClassDef(value: unknown): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];

  if (!isRecord(value)) {
    addClassError(
      diagnostics,
      undefined,
      "$",
      "Class definition must be an object.",
    );
    return diagnostics;
  }

  const classId = getNonEmptyString(value.classId);
  const classLabel = classId ?? "unknown";

  if (!classId) {
    addClassError(
      diagnostics,
      undefined,
      "classId",
      "Class definition has invalid or missing classId.",
    );
  }

  validateNonEmptyString(value.name, classId, classLabel, "name", diagnostics);
  validateNonEmptyString(
    value.description,
    classId,
    classLabel,
    "description",
    diagnostics,
  );
  validateEquipmentPermissions(
    value.equipmentPermissions,
    classId,
    classLabel,
    diagnostics,
  );
  validateGrowthCycle(value.growthCycle, classId, classLabel, diagnostics);

  return diagnostics;
}

export function validateClassRegistry(
  defs: readonly unknown[],
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  const seenIds = new Set<string>();

  for (const def of defs) {
    diagnostics.push(...validateClassDef(def));
    if (!isRecord(def) || typeof def.classId !== "string" || !def.classId) {
      continue;
    }
    if (seenIds.has(def.classId)) {
      addClassError(
        diagnostics,
        def.classId,
        "classId",
        `Duplicate class definition "${def.classId}".`,
      );
    } else {
      seenIds.add(def.classId);
    }
  }

  return diagnostics;
}

function validateEquipmentPermissions(
  value: unknown,
  classId: string | undefined,
  classLabel: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addClassError(
      diagnostics,
      classId,
      "equipmentPermissions",
      `Class definition "${classLabel}" equipmentPermissions must be an object.`,
    );
    return;
  }

  validateStringOptionArray(
    value.allowedWeaponTypes,
    EQUIPMENT_WEAPON_TYPE_OPTIONS,
    classId,
    `Class definition "${classLabel}"`,
    "equipmentPermissions.allowedWeaponTypes",
    diagnostics,
  );
  validateStringOptionArray(
    value.allowedArmorSlots,
    EQUIPMENT_ARMOR_SLOT_OPTIONS,
    classId,
    `Class definition "${classLabel}"`,
    "equipmentPermissions.allowedArmorSlots",
    diagnostics,
  );
}

function validateGrowthCycle(
  value: unknown,
  classId: string | undefined,
  classLabel: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    addClassError(
      diagnostics,
      classId,
      "growthCycle",
      `Class definition "${classLabel}" growthCycle must be an array.`,
    );
    return;
  }

  const seenLevels = new Set<number>();
  value.forEach((entry, index) => {
    const path = `growthCycle[${index}]`;
    if (!isRecord(entry)) {
      addClassError(
        diagnostics,
        classId,
        path,
        `Class definition "${classLabel}" growth entry must be an object.`,
      );
      return;
    }

    if (
      typeof entry.level !== "number" ||
      !Number.isInteger(entry.level) ||
      entry.level < 2
    ) {
      addClassError(
        diagnostics,
        classId,
        `${path}.level`,
        `Class definition "${classLabel}" has invalid growth level.`,
      );
    } else if (seenLevels.has(entry.level)) {
      addClassError(
        diagnostics,
        classId,
        `${path}.level`,
        `Class definition "${classLabel}" repeats growth level ${entry.level}.`,
      );
    } else {
      seenLevels.add(entry.level);
    }

    validateAttributeGrowth(
      entry.attributes,
      classId,
      classLabel,
      `${path}.attributes`,
      diagnostics,
    );
  });
}

function validateAttributeGrowth(
  value: unknown,
  classId: string | undefined,
  classLabel: string,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!isRecord(value)) {
    addClassError(
      diagnostics,
      classId,
      path,
      `Class definition "${classLabel}" growth attributes must be an object.`,
    );
    return;
  }

  if (Object.keys(value).length === 0) {
    addClassError(
      diagnostics,
      classId,
      path,
      `Class definition "${classLabel}" growth attributes cannot be empty.`,
    );
  }

  for (const [attribute, amount] of Object.entries(value)) {
    if (!(CORE_ATTRIBUTE_OPTIONS as readonly string[]).includes(attribute)) {
      addClassError(
        diagnostics,
        classId,
        `${path}.${attribute}`,
        `Class definition "${classLabel}" has unknown growth attribute "${attribute}".`,
      );
      continue;
    }
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      addClassError(
        diagnostics,
        classId,
        `${path}.${attribute}`,
        `Class definition "${classLabel}" has invalid growth amount for "${attribute}".`,
      );
    }
  }
}

function validateStringOptionArray(
  value: unknown,
  options: readonly string[],
  classId: string | undefined,
  label: string,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (!Array.isArray(value)) {
    addClassError(
      diagnostics,
      classId,
      path,
      `${label} ${path} must be an array.`,
    );
    return;
  }

  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || !options.includes(entry)) {
      addClassError(
        diagnostics,
        classId,
        `${path}[${index}]`,
        `${label} has invalid ${path} entry "${String(entry)}".`,
      );
      return;
    }
    if (seen.has(entry)) {
      addClassError(
        diagnostics,
        classId,
        `${path}[${index}]`,
        `${label} repeats ${path} entry "${entry}".`,
      );
    } else {
      seen.add(entry);
    }
  });
}

function buildRegistry(defs: readonly unknown[]): ClassDefMap {
  const diagnostics = validateClassRegistry(defs);
  const firstError = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  );

  if (firstError) {
    throw new Error(formatContentDiagnostic(firstError));
  }

  return Object.fromEntries(
    defs.map((def) => {
      const classDef = def as ClassDef;
      return [classDef.classId, cloneClassDef(classDef)];
    }),
  );
}

export function cloneClassDef(def: ClassDef): ClassDef {
  return {
    ...def,
    equipmentPermissions: cloneEquipmentPermissions(def.equipmentPermissions),
    growthCycle: def.growthCycle.map((entry) => ({
      level: entry.level,
      attributes: { ...entry.attributes },
    })),
  };
}

function cloneEquipmentPermissions(
  permissions: ClassEquipmentPermissions,
): ClassEquipmentPermissions {
  return {
    allowedWeaponTypes: [...permissions.allowedWeaponTypes],
    allowedArmorSlots: [...permissions.allowedArmorSlots],
  };
}

function getSortedContentModules(modules: Record<string, unknown>): unknown[] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, module]) => module);
}

function validateNonEmptyString(
  value: unknown,
  classId: string | undefined,
  classLabel: string,
  path: string,
  diagnostics: ContentDiagnostic[],
): void {
  if (typeof value !== "string" || !value.trim()) {
    addClassError(
      diagnostics,
      classId,
      path,
      `Class definition "${classLabel}" has invalid or missing ${path}.`,
    );
  }
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function addClassError(
  diagnostics: ContentDiagnostic[],
  classId: string | undefined,
  path: string,
  message: string,
): void {
  diagnostics.push({
    severity: "error",
    contentType: CLASS_CONTENT_TYPE,
    contentId: classId,
    path,
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
