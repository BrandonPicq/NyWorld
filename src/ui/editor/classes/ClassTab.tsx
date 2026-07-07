import { useState } from "react";
import {
  CORE_ATTRIBUTE_OPTIONS,
  EQUIPMENT_ARMOR_SLOT_OPTIONS,
  EQUIPMENT_WEAPON_TYPE_OPTIONS,
  formatContentDiagnostic,
  type ClassDef,
  type EquipmentArmorSlot,
  type EquipmentWeaponType,
} from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import type { EditorContentNavigationTarget } from "../DiagnosticList";
import { ListFilterField } from "../ListFilterField";
import { filterByIdOrName } from "../listFilter";
import { ReferenceList } from "../ReferenceList";
import type { ClassDraftController } from "./useClassDraft";

type ClassTabProps = {
  draft: ClassDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
};

export function ClassTab({ draft, onNavigate }: ClassTabProps) {
  const [listFilter, setListFilter] = useState("");
  const filteredClasses = filterByIdOrName(
    draft.classes.map((classDef) => ({
      ...classDef,
      id: classDef.classId,
      name: classDef.name,
    })),
    listFilter,
  );

  return (
    <>
      <section className="editor-summary" aria-label="Class summary">
        <span>{draft.classes.length} classes</span>
        <span>{draft.errorCount} errors</span>
        <span>{draft.warningCount} warnings</span>
        <span>{draft.hasUnsavedChanges ? "unsaved" : "saved"}</span>
      </section>

      <div className="workbench">
        <ScrollRegion className="workbench__rail">
          <TerminalPanel className="editor-panel">
            <h2 className="editor-panel__title">Classes</h2>
            <ListFilterField
              label="Filter"
              onChange={setListFilter}
              value={listFilter}
            />
            <div className="editor-entry-list">
              {filteredClasses.length === 0 ? (
                <p className="editor-empty">No matching classes.</p>
              ) : null}
              {filteredClasses.map((classDef) => (
                <TerminalButton
                  className="editor-entry-button"
                  isSelected={classDef.classId === draft.selectedClassId}
                  key={classDef.classId}
                  onClick={() => draft.selectClass(classDef.classId)}
                >
                  <span className="editor-zone-entry">
                    <span className="editor-zone-entry__name">
                      <IdentifierLabel value={classDef.classId} />
                      {classDef.hasUnsavedChanges ? " *" : ""}
                    </span>
                    <span className="editor-zone-entry__meta">
                      {classDef.name}
                    </span>
                  </span>
                </TerminalButton>
              ))}
            </div>
          </TerminalPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__main">
          <TerminalPanel className="editor-panel">
            <h2 className="editor-panel__title">Class Sheet</h2>
            {draft.selectedClass ? (
              <ClassSheetForm classDef={draft.selectedClass} draft={draft} />
            ) : (
              <p className="editor-empty">No class selected.</p>
            )}
          </TerminalPanel>
        </ScrollRegion>

        <ScrollRegion className="workbench__inspector">
          <TerminalPanel className="editor-panel">
            <h2 className="editor-panel__title">Problems</h2>
            {draft.selectedClassDiagnostics.length === 0 ? (
              <p className="editor-empty">No problems.</p>
            ) : (
              <ul className="editor-diagnostic-list">
                {draft.selectedClassDiagnostics.map((diagnostic, index) => (
                  <li
                    className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                    key={`${diagnostic.contentId ?? "class"}-${diagnostic.path}-${index}`}
                  >
                    {formatContentDiagnostic(diagnostic)}
                  </li>
                ))}
              </ul>
            )}

            <ReferenceList
              emptyLabel="No incoming references."
              onNavigate={onNavigate}
              references={draft.selectedClassReferences}
              title="Incoming References"
              useTarget={false}
            />
          </TerminalPanel>
        </ScrollRegion>
      </div>
    </>
  );
}

function ClassSheetForm({
  classDef,
  draft,
}: {
  classDef: ClassDef;
  draft: ClassDraftController;
}) {
  return (
    <section className="editor-item-form" aria-label="Class sheet editor">
      <div className="editor-family__header">
        <h3>{classDef.name || classDef.classId}</h3>
        <span>{draft.selectedClassHasUnsavedChanges ? "dirty" : "clean"}</span>
      </div>

      <label className="editor-field">
        <span>Class Id</span>
        <input disabled readOnly type="text" value={classDef.classId} />
      </label>

      <label className="editor-field">
        <span>Name</span>
        <input
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedClass((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          type="text"
          value={classDef.name}
        />
      </label>

      <label className="editor-field">
        <span>Description</span>
        <textarea
          disabled={draft.isSaving}
          onChange={(event) =>
            draft.updateSelectedClass((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          rows={4}
          value={classDef.description}
        />
      </label>

      <section className="editor-zone-section">
        <h3>Equipment Permissions</h3>
        <fieldset className="editor-checkbox-grid">
          <legend>Weapon Types</legend>
          {EQUIPMENT_WEAPON_TYPE_OPTIONS.map((weaponType) => (
            <label className="editor-checkbox-field" key={weaponType}>
              <input
                checked={classDef.equipmentPermissions.allowedWeaponTypes.includes(
                  weaponType,
                )}
                disabled={draft.isSaving}
                onChange={(event) =>
                  draft.updateSelectedClass((current) => ({
                    ...current,
                    equipmentPermissions: {
                      ...current.equipmentPermissions,
                      allowedWeaponTypes: toggleString(
                        current.equipmentPermissions.allowedWeaponTypes,
                        weaponType,
                        event.target.checked,
                      ) as EquipmentWeaponType[],
                    },
                  }))
                }
                type="checkbox"
              />
              <span>{weaponType}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="editor-checkbox-grid">
          <legend>Armor Slots</legend>
          {EQUIPMENT_ARMOR_SLOT_OPTIONS.map((slot) => (
            <label className="editor-checkbox-field" key={slot}>
              <input
                checked={classDef.equipmentPermissions.allowedArmorSlots.includes(
                  slot,
                )}
                disabled={draft.isSaving}
                onChange={(event) =>
                  draft.updateSelectedClass((current) => ({
                    ...current,
                    equipmentPermissions: {
                      ...current.equipmentPermissions,
                      allowedArmorSlots: toggleString(
                        current.equipmentPermissions.allowedArmorSlots,
                        slot,
                        event.target.checked,
                      ) as EquipmentArmorSlot[],
                    },
                  }))
                }
                type="checkbox"
              />
              <span>{slot}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="editor-zone-section">
        <h3>Growth Cycle</h3>
        {classDef.growthCycle.map((entry, index) => (
          <div className="editor-nested-card" key={`${entry.level}-${index}`}>
            <div className="editor-form-row">
              <label className="editor-field">
                <span>Level</span>
                <input
                  disabled={draft.isSaving}
                  min={2}
                  onChange={(event) =>
                    draft.updateSelectedClass((current) => ({
                      ...current,
                      growthCycle: current.growthCycle.map((growth, i) =>
                        i === index
                          ? { ...growth, level: Number(event.target.value) }
                          : growth,
                      ),
                    }))
                  }
                  type="number"
                  value={entry.level}
                />
              </label>
              <TerminalButton
                className="editor-action-button"
                disabled={draft.isSaving}
                onClick={() =>
                  draft.updateSelectedClass((current) => ({
                    ...current,
                    growthCycle: current.growthCycle.filter(
                      (_, i) => i !== index,
                    ),
                  }))
                }
              >
                Remove
              </TerminalButton>
            </div>
            <div className="editor-stat-grid">
              {CORE_ATTRIBUTE_OPTIONS.map((attribute) => (
                <label className="editor-field" key={attribute}>
                  <span>{attribute}</span>
                  <input
                    disabled={draft.isSaving}
                    min={0}
                    onChange={(event) =>
                      draft.updateSelectedClass((current) => ({
                        ...current,
                        growthCycle: current.growthCycle.map((growth, i) =>
                          i === index
                            ? {
                                ...growth,
                                attributes: setGrowthAmount(
                                  growth.attributes,
                                  attribute,
                                  Number(event.target.value),
                                ),
                              }
                            : growth,
                        ),
                      }))
                    }
                    type="number"
                    value={entry.attributes[attribute] ?? 0}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <TerminalButton
          className="editor-action-button"
          disabled={draft.isSaving}
          onClick={() =>
            draft.updateSelectedClass((current) => ({
              ...current,
              growthCycle: [
                ...current.growthCycle,
                { level: nextGrowthLevel(current), attributes: { strength: 1 } },
              ],
            }))
          }
        >
          Add Growth Entry
        </TerminalButton>
      </section>

      <div className="editor-actions">
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.canSaveSelectedClass}
          onClick={draft.saveSelectedClass}
        >
          Save Class
        </TerminalButton>
        <TerminalButton
          className="editor-action-button"
          disabled={!draft.selectedClassHasUnsavedChanges || draft.isSaving}
          onClick={draft.resetSelectedClass}
        >
          Reset
        </TerminalButton>
      </div>

      <p
        aria-live="polite"
        className={`editor-save-status editor-save-status--${draft.saveStatus.state}`}
      >
        {draft.saveStatus.message}
      </p>
    </section>
  );
}

function toggleString<T extends string>(
  values: readonly T[],
  value: T,
  checked: boolean,
): T[] {
  if (checked) {
    return values.includes(value) ? [...values] : [...values, value];
  }
  return values.filter((entry) => entry !== value);
}

function setGrowthAmount(
  attributes: ClassDef["growthCycle"][number]["attributes"],
  attribute: keyof ClassDef["growthCycle"][number]["attributes"],
  amount: number,
): ClassDef["growthCycle"][number]["attributes"] {
  const next = { ...attributes };
  if (!Number.isFinite(amount) || amount <= 0) {
    delete next[attribute];
  } else {
    next[attribute] = amount;
  }
  return next;
}

function nextGrowthLevel(classDef: ClassDef): number {
  return Math.max(1, ...classDef.growthCycle.map((entry) => entry.level)) + 1;
}
