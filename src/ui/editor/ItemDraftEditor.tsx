import {
  CONTENT_TYPES,
  EQUIPMENT_BONUS_OPTIONS,
  EQUIPMENT_MINIGAME_OPTIONS,
  EQUIPMENT_SLOT_OPTIONS,
  EQUIPMENT_WEAPON_TYPE_OPTIONS,
  formatContentDiagnostic,
  ITEM_CATEGORY_OPTIONS,
  validateItemCatalog,
  type EquipmentBonusKey,
  type EquipmentMinigameType,
  type EquipmentSlot,
  type EquipmentWeaponType,
  type ContentRef,
  type ItemDef,
} from "../../engine";
import { EditorButton } from "./components/EditorButton";
import type { SaveStatus } from "./editorModel";

export function ItemDraftEditor({
  canSave,
  hasUnsavedChanges,
  isSaving,
  item,
  itemDiagnostics,
  itemIdDraft,
  onApplyItemId,
  onCategoryChange,
  onDefaultQuantityChange,
  onDescriptionChange,
  onEffectChange,
  onItemIdDraftChange,
  onNameChange,
  onUpdateItem,
  onReset,
  onSave,
  saveStatus,
  selectedRef,
}: {
  canSave: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  item: ItemDef | null;
  itemDiagnostics: ReturnType<typeof validateItemCatalog>;
  itemIdDraft: string;
  onApplyItemId: () => void;
  onCategoryChange: (category: ItemDef["category"]) => void;
  onDefaultQuantityChange: (value: string) => void;
  onDescriptionChange: (description: string) => void;
  onEffectChange: (
    field: keyof NonNullable<ItemDef["effects"]>,
    value: string,
  ) => void;
  onItemIdDraftChange: (itemId: string) => void;
  onNameChange: (name: string) => void;
  onUpdateItem: (updater: (item: ItemDef) => ItemDef) => void;
  onReset: () => void;
  onSave: () => void;
  saveStatus: SaveStatus;
  selectedRef: ContentRef;
}) {
  if (selectedRef.type !== CONTENT_TYPES.item) {
    return (
      <section className="editor-item-editor">
        <div className="editor-family__header">
          <h3>Item Draft</h3>
          <span>inactive</span>
        </div>
        <p className="editor-empty">Select an item.</p>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="editor-item-editor">
        <div className="editor-family__header">
          <h3>Item Draft</h3>
          <span>missing</span>
        </div>
        <p className="editor-empty">Item not found.</p>
      </section>
    );
  }

  return (
    <section className="editor-item-editor" aria-label="Item draft editor">
      <div className="editor-family__header">
        <h3>Item Draft</h3>
        <span>{hasUnsavedChanges ? "dirty" : "clean"}</span>
      </div>

      <div className="editor-item-form">
        <label className="editor-field">
          <span>Item ID</span>
          <div className="editor-inline-control">
            <input
              disabled={isSaving}
              onChange={(event) => onItemIdDraftChange(event.target.value)}
              type="text"
              value={itemIdDraft}
            />
            <EditorButton
              className="editor-compact-button"
              disabled={isSaving}
              onClick={onApplyItemId}
            >
              Apply
            </EditorButton>
          </div>
        </label>

        <label className="editor-field">
          <span>Name</span>
          <input
            disabled={isSaving}
            onChange={(event) => onNameChange(event.target.value)}
            type="text"
            value={item.name}
          />
        </label>

        <label className="editor-field">
          <span>Description</span>
          <textarea
            disabled={isSaving}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={4}
            value={item.description}
          />
        </label>

        <div className="editor-form-row">
          <label className="editor-field">
            <span>Category</span>
            <select
              disabled={isSaving}
              onChange={(event) =>
                onCategoryChange(event.target.value as ItemDef["category"])
              }
              value={item.category}
            >
              {ITEM_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="editor-field">
            <span>Default Qty</span>
            <input
              disabled={isSaving}
              min={0}
              onChange={(event) =>
                onDefaultQuantityChange(event.target.value)
              }
              step={1}
              type="number"
              value={item.defaultQuantity}
            />
          </label>
        </div>

        <div className="editor-form-row">
          <label className="editor-field">
            <span>Energy</span>
            <input
              disabled={isSaving}
              min={0}
              onChange={(event) =>
                onEffectChange("energyRestore", event.target.value)
              }
              step={1}
              type="number"
              value={item.effects?.energyRestore ?? ""}
            />
          </label>

          <label className="editor-field">
            <span>HP</span>
            <input
              disabled={isSaving}
              min={0}
              onChange={(event) =>
                onEffectChange("hpRestore", event.target.value)
              }
              step={1}
              type="number"
              value={item.effects?.hpRestore ?? ""}
            />
          </label>
        </div>

        <label className="editor-field">
          <span>Teaches Pattern</span>
          <input
            disabled={isSaving}
            onChange={(event) =>
              onEffectChange("teachesPatternId", event.target.value)
            }
            placeholder="pattern_id"
            type="text"
            value={item.effects?.teachesPatternId ?? ""}
          />
        </label>

        {item.category === "equipment" ? (
          <EquipmentEditor
            isSaving={isSaving}
            item={item}
            onUpdateItem={onUpdateItem}
          />
        ) : null}

        {itemDiagnostics.length > 0 && (
          <ul className="editor-inline-diagnostics">
            {itemDiagnostics.map((diagnostic, index) => (
              <li
                className={`editor-diagnostic editor-diagnostic--${diagnostic.severity}`}
                key={`${diagnostic.path}-${index}`}
              >
                {formatContentDiagnostic(diagnostic)}
              </li>
            ))}
          </ul>
        )}

        <div className="editor-actions">
          <EditorButton
            className="editor-action-button"
            disabled={!canSave}
            onClick={onSave}
          >
            Save Items
          </EditorButton>
          <EditorButton
            className="editor-action-button"
            disabled={!hasUnsavedChanges || isSaving}
            onClick={onReset}
          >
            Reset
          </EditorButton>
        </div>

        <p
          aria-live="polite"
          className={`editor-save-status editor-save-status--${saveStatus.state}`}
        >
          {saveStatus.message}
        </p>
      </div>
    </section>
  );
}

function EquipmentEditor({
  isSaving,
  item,
  onUpdateItem,
}: {
  isSaving: boolean;
  item: ItemDef;
  onUpdateItem: (updater: (item: ItemDef) => ItemDef) => void;
}) {
  const equipment = item.equipment ?? {
    slot: "weapon" as const,
    weaponType: "sword" as const,
    bonuses: { "combat.attack": 1 },
  };

  return (
    <section className="editor-zone-section">
      <h3>Equipment</h3>
      <div className="editor-form-row">
        <label className="editor-field">
          <span>Slot</span>
          <select
            disabled={isSaving}
            onChange={(event) => {
              const slot = event.target.value as EquipmentSlot;
              onUpdateItem((current) => ({
                ...current,
                equipment: {
                  ...(current.equipment ?? equipment),
                  slot,
                  weaponType:
                    slot === "weapon"
                      ? current.equipment?.weaponType ?? "sword"
                      : undefined,
                },
              }));
            }}
            value={equipment.slot}
          >
            {EQUIPMENT_SLOT_OPTIONS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>

        <label className="editor-field">
          <span>Weapon Type</span>
          <select
            disabled={isSaving || equipment.slot !== "weapon"}
            onChange={(event) =>
              onUpdateItem((current) => ({
                ...current,
                equipment: {
                  ...(current.equipment ?? equipment),
                  slot: "weapon",
                  weaponType: event.target.value as EquipmentWeaponType,
                },
              }))
            }
            value={equipment.weaponType ?? ""}
          >
            <option value="">none</option>
            {EQUIPMENT_WEAPON_TYPE_OPTIONS.map((weaponType) => (
              <option key={weaponType} value={weaponType}>
                {weaponType}
              </option>
            ))}
          </select>
        </label>

        <label className="editor-field">
          <span>Minigame</span>
          <select
            disabled={isSaving || equipment.slot !== "weapon"}
            onChange={(event) => {
              const value = event.target.value;
              onUpdateItem((current) => ({
                ...current,
                equipment: {
                  ...(current.equipment ?? equipment),
                  slot: "weapon",
                  minigame: value
                    ? (value as EquipmentMinigameType)
                    : undefined,
                },
              }));
            }}
            value={equipment.minigame ?? ""}
          >
            <option value="">archetype default</option>
            {EQUIPMENT_MINIGAME_OPTIONS.map((minigame) => (
              <option key={minigame} value={minigame}>
                {minigame}
              </option>
            ))}
          </select>
        </label>

        <label className="editor-field">
          <span>Volley Size</span>
          <input
            disabled={isSaving || equipment.slot !== "weapon"}
            min={1}
            onChange={(event) => {
              const raw = event.target.value.trim();
              const parsed = Number(raw);
              onUpdateItem((current) => ({
                ...current,
                equipment: {
                  ...(current.equipment ?? equipment),
                  slot: "weapon",
                  volleySize:
                    raw && Number.isFinite(parsed) ? parsed : undefined,
                },
              }));
            }}
            step={1}
            type="number"
            value={equipment.volleySize ?? ""}
          />
        </label>

        <label className="editor-field">
          <span>Recommended Mastery</span>
          <input
            disabled={isSaving || equipment.slot !== "weapon"}
            min={0}
            onChange={(event) => {
              const raw = event.target.value.trim();
              const parsed = Number(raw);
              onUpdateItem((current) => ({
                ...current,
                equipment: {
                  ...(current.equipment ?? equipment),
                  slot: "weapon",
                  recommendedMasteryLevel:
                    raw && Number.isFinite(parsed) ? parsed : undefined,
                },
              }));
            }}
            step={1}
            type="number"
            value={equipment.recommendedMasteryLevel ?? ""}
          />
        </label>
      </div>

      <div className="editor-stat-grid">
        {EQUIPMENT_BONUS_OPTIONS.map((bonusKey) => (
          <label className="editor-field" key={bonusKey}>
            <span>{bonusKey}</span>
            <input
              disabled={isSaving}
              onChange={(event) =>
                onUpdateItem((current) =>
                  updateEquipmentBonus(current, bonusKey, event.target.value),
                )
              }
              step={1}
              type="number"
              value={equipment.bonuses[bonusKey] ?? ""}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function updateEquipmentBonus(
  item: ItemDef,
  bonusKey: EquipmentBonusKey,
  value: string,
): ItemDef {
  const equipment = item.equipment ?? {
    slot: "weapon" as const,
    weaponType: "sword" as const,
    bonuses: {},
  };
  const bonuses = { ...equipment.bonuses };
  if (!value.trim()) {
    delete bonuses[bonusKey];
  } else {
    bonuses[bonusKey] = Number(value);
  }

  return {
    ...item,
    equipment: {
      ...equipment,
      bonuses,
    },
  };
}
