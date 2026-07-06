import type { NpcScheduleEntryData } from "../../engine";
import { TerminalButton } from "../components/TerminalButton";
import { isValidScheduleTime } from "./zone/zoneEditorModel";

type ScheduleEntriesEditorProps = {
  title: string;
  entries: readonly NpcScheduleEntryData[];
  zoneIds: readonly string[];
  dialogueIds: readonly string[];
  addLabel?: string;
  emptyLabel?: string;
  /** Label for the empty zone option: "(this zone)" for spawns, a prompt for presence. */
  zonePlaceholderLabel?: string;
  /** Zone used when an entry omits zoneId, e.g. a zone-local spawn schedule. */
  fallbackZoneId?: string;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<NpcScheduleEntryData>) => void;
  onRemove: (index: number) => void;
  onPickCoordinate?: (index: number, zoneId: string) => void;
};

/**
 * Shared editor for an NPC schedule (`NpcScheduleEntryData[]`).
 *
 * Used by the zone editor's NPC spawns and (later) the global presence tab. The
 * `time` field is flagged live when it breaks the `HH:mm` contract, but actual
 * save gating comes from the content validators, not this component.
 */
export function ScheduleEntriesEditor({
  title,
  entries,
  zoneIds,
  dialogueIds,
  addLabel = "Add schedule entry",
  emptyLabel = "No schedule.",
  zonePlaceholderLabel = "(this zone)",
  fallbackZoneId = "",
  onAdd,
  onUpdate,
  onRemove,
  onPickCoordinate,
}: ScheduleEntriesEditorProps) {
  return (
    <section className="editor-zone-section">
      <div className="editor-family__header">
        <h3>{title}</h3>
        <span>{entries.length}</span>
      </div>

      {entries.length === 0 ? (
        <p className="editor-empty">{emptyLabel}</p>
      ) : (
        <ul className="editor-zone-row-list">
          {entries.map((entry, index) => {
            const resolvedZoneId = entry.zoneId ?? fallbackZoneId;
            const canPickCoordinate =
              !!onPickCoordinate &&
              resolvedZoneId !== "" &&
              zoneIds.includes(resolvedZoneId);

            return (
              <li className="editor-zone-row editor-schedule-entry" key={index}>
                <div className="editor-form-row">
                  <label className="editor-field">
                    <span>Time (HH:mm)</span>
                    <input
                      aria-invalid={!isValidScheduleTime(entry.time)}
                      onChange={(event) =>
                        onUpdate(index, { time: event.target.value })
                      }
                      placeholder="08:00"
                      type="text"
                      value={entry.time}
                    />
                  </label>
                  <label className="editor-field">
                    <span>Zone</span>
                    <select
                      onChange={(event) =>
                        onUpdate(index, {
                          zoneId: event.target.value || undefined,
                        })
                      }
                      value={entry.zoneId ?? ""}
                    >
                      <option value="">{zonePlaceholderLabel}</option>
                      {zoneIds.map((zoneId) => (
                        <option key={zoneId} value={zoneId}>
                          {zoneId}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="editor-form-row">
                  <label className="editor-field">
                    <span>X</span>
                    <input
                      min={0}
                      onChange={(event) =>
                        onUpdate(index, {
                          x: coordinate(event.target.value, entry.x),
                        })
                      }
                      step={1}
                      type="number"
                      value={entry.x}
                    />
                  </label>
                  <label className="editor-field">
                    <span>Y</span>
                    <input
                      min={0}
                      onChange={(event) =>
                        onUpdate(index, {
                          y: coordinate(event.target.value, entry.y),
                        })
                      }
                      step={1}
                      type="number"
                      value={entry.y}
                    />
                  </label>
                  <TerminalButton
                    className="editor-compact-button"
                    disabled={!canPickCoordinate}
                    onClick={() => onPickCoordinate?.(index, resolvedZoneId)}
                  >
                    Pick on Map
                  </TerminalButton>
                  <TerminalButton
                    className="editor-compact-button"
                    onClick={() => onRemove(index)}
                  >
                    Delete
                  </TerminalButton>
                </div>
                <label className="editor-field">
                  <span>Dialogue (optional)</span>
                  <select
                    onChange={(event) =>
                      onUpdate(index, {
                        dialogueId: event.target.value || undefined,
                      })
                    }
                    value={entry.dialogueId ?? ""}
                  >
                    <option value="">(default)</option>
                    {dialogueIds.map((dialogueId) => (
                      <option key={dialogueId} value={dialogueId}>
                        {dialogueId}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <TerminalButton className="editor-action-button" onClick={onAdd}>
        {addLabel}
      </TerminalButton>
    </section>
  );
}

function coordinate(value: string, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
