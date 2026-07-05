import type { ZoneData } from "../../../engine";
import { DialogueNodesEditor } from "../DialogueNodesEditor";
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
    <DialogueNodesEditor
      emptyLabel="No entry dialogue."
      nodes={nodes}
      onAddNode={() => onUpdate(addEntryDialogueNode)}
      onRemoveNode={(index) =>
        onUpdate((current) => removeEntryDialogueNode(current, index))
      }
      onUpdateNode={(index, patch) =>
        onUpdate((current) => updateEntryDialogueNode(current, index, patch))
      }
      title="Entry Dialogue"
    />
  );
}
