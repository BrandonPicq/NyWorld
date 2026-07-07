import type {
  ClassDef,
  ContentCatalogSnapshot,
  ContentValidationContext,
} from "../../../engine";
import { cloneClassDef } from "../../../engine";

export interface EditorClassEntry {
  classId: string;
  name: string;
}

export function listClassDefs(classes: readonly ClassDef[]): EditorClassEntry[] {
  return classes
    .map((classDef) => ({
      classId: classDef.classId,
      name: classDef.name,
    }))
    .sort((a, b) => a.classId.localeCompare(b.classId));
}

export function classContentPath(classId: string): string {
  return `src/content/classes/${classId}.json`;
}

export function cloneClassDefs(classes: readonly ClassDef[]): ClassDef[] {
  return classes.map(cloneClassDef);
}

export function createClassDraftState(
  snapshot: ContentCatalogSnapshot,
): ClassDef[] {
  return cloneClassDefs(snapshot.classes);
}

export function createClassDraftSnapshot(
  snapshot: ContentCatalogSnapshot,
  draftClasses: readonly ClassDef[],
): ContentCatalogSnapshot {
  return {
    ...snapshot,
    classes: cloneClassDefs(draftClasses),
  };
}

export function createClassDraftValidationContext(
  context: ContentValidationContext,
  draftClasses: readonly ClassDef[],
): ContentValidationContext {
  return {
    ...context,
    classIds: new Set(draftClasses.map((classDef) => classDef.classId)),
  };
}

export function serializeClassDef(classDef: ClassDef): string {
  return JSON.stringify(classDef, null, 2);
}

export function serializeClassDefsById(
  classes: readonly ClassDef[],
): Map<string, string> {
  return new Map(
    classes.map((classDef) => [classDef.classId, serializeClassDef(classDef)]),
  );
}

export function updateClassDef(
  classes: readonly ClassDef[],
  classId: string,
  updater: (classDef: ClassDef) => ClassDef,
): ClassDef[] {
  return classes.map((classDef) =>
    classDef.classId === classId
      ? cloneClassDef(updater(cloneClassDef(classDef)))
      : cloneClassDef(classDef),
  );
}

export function upsertClassDef(
  classes: readonly ClassDef[],
  classDef: ClassDef,
): ClassDef[] {
  const exists = classes.some((entry) => entry.classId === classDef.classId);
  const next = exists
    ? classes.map((entry) =>
        entry.classId === classDef.classId
          ? cloneClassDef(classDef)
          : cloneClassDef(entry),
      )
    : [...classes, cloneClassDef(classDef)];

  return next.sort((a, b) => a.classId.localeCompare(b.classId));
}
