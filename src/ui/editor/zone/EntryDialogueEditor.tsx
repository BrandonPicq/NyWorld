import { TerminalButton } from "../../components/TerminalButton";
import type { ZoneData } from "../../../engine";
import {
  addEntryDialogueNode,
  removeEntryDialogueNode,
  updateEntryDialogueNode,
} from "./zoneEditorModel";

type EntryDialogueEditorProps = {
  zone: ZoneData;
  onUpdate: (updater: (zone: ZoneData) => ZoneData) => void;
};

/**
 * Editable list of a zone's entry-dialogue lines (speaker / text / pitch).
 *
 * Blank speaker or text surface live validation errors from the zone validator,
 * so a half-authored line blocks saving until it is filled in.
 */
export function EntryDialogueEditor({
  zone,
  onUpdate,
}: EntryDialogueEditorProps) {
  const nodes = zone.entryDialogue ?? [];

  return (
    <section className="editor-zone-section">
      <div className="editor-family__header">
        <h3>Entry Dialogue</h3>
        <span>{nodes.length}</span>
      </div>

      <ul className="editor-zone-row-list">
        {nodes.map((node, index) => (
          <li className="editor-zone-row editor-dialogue-node" key={index}>
            <label className="editor-field">
              <span>Speaker</span>
              <input
                onChange={(event) =>
                  onUpdate((current) =>
                    updateEntryDialogueNode(current, index, {
                      speaker: event.target.value,
                    }),
                  )
                }
                type="text"
                value={node.speaker}
              />
            </label>
            <label className="editor-field">
              <span>Text</span>
              <textarea
                onChange={(event) =>
                  onUpdate((current) =>
                    updateEntryDialogueNode(current, index, {
                      text: event.target.value,
                    }),
                  )
                }
                rows={2}
                value={node.text}
              />
            </label>
            <div className="editor-form-row">
              <label className="editor-field">
                <span>Pitch</span>
                <input
                  min={0.1}
                  onChange={(event) =>
                    onUpdate((current) =>
                      updateEntryDialogueNode(current, index, {
                        pitch: floatOr(event.target.value, node.pitch),
                      }),
                    )
                  }
                  step={0.1}
                  type="number"
                  value={node.pitch}
                />
              </label>
              <TerminalButton
                className="editor-compact-button"
                onClick={() =>
                  onUpdate((current) => removeEntryDialogueNode(current, index))
                }
              >
                Delete
              </TerminalButton>
            </div>
          </li>
        ))}
      </ul>

      <TerminalButton
        className="editor-action-button"
        onClick={() => onUpdate(addEntryDialogueNode)}
      >
        Add line
      </TerminalButton>
    </section>
  );
}

function floatOr(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
