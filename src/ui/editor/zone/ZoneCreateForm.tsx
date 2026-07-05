import { useMemo, useState } from "react";
import { getAllTileDefs } from "../../../engine";
import { TerminalButton } from "../../components/TerminalButton";
import { saveEditorContent } from "../editorSaveClient";
import type { SaveStatus } from "../editorModel";
import {
  createBlankZone,
  serializeZoneData,
  validateNewZone,
  zoneContentPath,
} from "./zoneEditorModel";

/**
 * Creates a blank zone file (floor fill + wall border) through the dev editor
 * endpoint. The dev server's `import.meta.glob` picks the new file up on the
 * reload that follows the write, at which point it appears in the zone list.
 */
export function ZoneCreateForm({
  existingZoneIds,
}: {
  existingZoneIds: string[];
}) {
  const [zoneId, setZoneId] = useState("");
  const [name, setName] = useState("");
  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(8);
  const [status, setStatus] = useState<SaveStatus>({
    state: "idle",
    message: "",
  });

  const fillTiles = useMemo(() => {
    const defs = [...getAllTileDefs().entries()].sort(([a], [b]) => a - b);
    return {
      floor: defs.find(([, def]) => def.walkable)?.[0] ?? 0,
      wall: defs.find(([, def]) => !def.walkable)?.[0] ?? 1,
    };
  }, []);

  const input = { zoneId, name, width, height };
  const errors = validateNewZone(input, existingZoneIds);
  const touched = zoneId.trim() !== "" || name.trim() !== "";
  const isSaving = status.state === "saving";
  const canCreate = errors.length === 0 && !isSaving;

  async function create(): Promise<void> {
    if (!canCreate) {
      return;
    }
    const zone = createBlankZone(input, fillTiles.floor, fillTiles.wall);
    setStatus({ state: "saving", message: "Creating..." });
    const result = await saveEditorContent(
      zoneContentPath(zone.zoneId),
      serializeZoneData(zone),
    );
    if (!result.ok) {
      setStatus({ state: "error", message: result.error });
      return;
    }
    setStatus({ state: "saved", message: `Created ${result.path}. Reloading…` });
  }

  return (
    <section className="editor-zone-create" aria-label="Create zone">
      <div className="editor-family__header">
        <h3>New Zone</h3>
      </div>
      <label className="editor-field">
        <span>Zone ID</span>
        <input
          disabled={isSaving}
          onChange={(event) => setZoneId(event.target.value)}
          type="text"
          value={zoneId}
        />
      </label>
      <label className="editor-field">
        <span>Name</span>
        <input
          disabled={isSaving}
          onChange={(event) => setName(event.target.value)}
          type="text"
          value={name}
        />
      </label>
      <div className="editor-form-row">
        <label className="editor-field">
          <span>Width</span>
          <input
            disabled={isSaving}
            min={3}
            onChange={(event) => setWidth(intOr(event.target.value, width))}
            step={1}
            type="number"
            value={width}
          />
        </label>
        <label className="editor-field">
          <span>Height</span>
          <input
            disabled={isSaving}
            min={3}
            onChange={(event) => setHeight(intOr(event.target.value, height))}
            step={1}
            type="number"
            value={height}
          />
        </label>
      </div>
      {touched && errors.length > 0 && (
        <ul className="editor-inline-diagnostics">
          {errors.map((error, index) => (
            <li
              className="editor-diagnostic editor-diagnostic--error"
              key={index}
            >
              {error}
            </li>
          ))}
        </ul>
      )}
      <TerminalButton
        className="editor-action-button"
        disabled={!canCreate}
        onClick={create}
      >
        Create Zone
      </TerminalButton>
      <p
        aria-live="polite"
        className={`editor-save-status editor-save-status--${status.state}`}
      >
        {status.message}
      </p>
    </section>
  );
}

function intOr(value: string, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}
