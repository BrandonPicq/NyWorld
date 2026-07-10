import type { DialogueNodeData } from "../../engine";
import { EditorButton } from "./components/EditorButton";

type DialogueNodesEditorProps = {
  title: string;
  nodes: readonly DialogueNodeData[];
  addLabel?: string;
  emptyLabel?: string;
  onAddNode: () => void;
  onRemoveNode: (index: number) => void;
  onUpdateNode: (index: number, patch: Partial<DialogueNodeData>) => void;
};

/**
 * Shared speaker/text/pitch editor for reusable dialogues and zone entry text.
 */
export function DialogueNodesEditor({
  title,
  nodes,
  addLabel = "Add line",
  emptyLabel = "No lines yet.",
  onAddNode,
  onRemoveNode,
  onUpdateNode,
}: DialogueNodesEditorProps) {
  return (
    <section className="editor-zone-section">
      <div className="editor-family__header">
        <h3>{title}</h3>
        <span>{nodes.length}</span>
      </div>

      {nodes.length === 0 ? (
        <p className="editor-empty">{emptyLabel}</p>
      ) : (
        <ul className="editor-zone-row-list">
          {nodes.map((node, index) => (
            <li className="editor-zone-row editor-dialogue-node" key={index}>
              <label className="editor-field">
                <span>Speaker</span>
                <input
                  onChange={(event) =>
                    onUpdateNode(index, { speaker: event.target.value })
                  }
                  type="text"
                  value={node.speaker}
                />
              </label>
              <label className="editor-field">
                <span>Text</span>
                <textarea
                  onChange={(event) =>
                    onUpdateNode(index, { text: event.target.value })
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
                      onUpdateNode(index, {
                        pitch: floatOr(event.target.value, node.pitch),
                      })
                    }
                    step={0.1}
                    type="number"
                    value={node.pitch}
                  />
                </label>
                <EditorButton
                  className="editor-compact-button"
                  onClick={() => onRemoveNode(index)}
                >
                  Delete
                </EditorButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EditorButton className="editor-action-button" onClick={onAddNode}>
        {addLabel}
      </EditorButton>
    </section>
  );
}

function floatOr(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
