import type { ReactNode } from "react";
import type { ZoneData } from "../../../engine";
import { ScheduleEntriesEditor } from "../ScheduleEntriesEditor";
import {
  addNpcScheduleEntry,
  removeNpcScheduleEntry,
  updateNpcScheduleEntry,
} from "./zoneEditorModel";

type ZoneContentsProps = {
  zone: ZoneData;
  zoneIds: readonly string[];
  dialogueIds: readonly string[];
  onUpdate: (updater: (zone: ZoneData) => ZoneData) => void;
};

/**
 * Listing of a zone's spatial placements.
 *
 * NPC spawns, item stacks, and transitions are placed on the canvas, so their
 * positions stay read-only here. Per-spawn schedules are editable; entry
 * dialogue is edited in EntryDialogueEditor.
 */
export function ZoneContents({
  zone,
  zoneIds,
  dialogueIds,
  onUpdate,
}: ZoneContentsProps) {
  const npcs = zone.npcs ?? [];
  const items = zone.items ?? [];
  const transitions = zone.transitions ?? [];

  return (
    <>
      <ZoneSection count={npcs.length} title="NPC Spawns">
        <ul className="editor-zone-row-list">
          {npcs.map((npc, index) => (
            <li className="editor-zone-row" key={`${npc.npcId}-${index}`}>
              <div className="editor-zone-row__head">
                <strong>{npc.npcId}</strong>
                <span>
                  ({npc.x}, {npc.y})
                </span>
              </div>
              {npc.dialogueId && (
                <p className="editor-zone-row__meta">
                  dialogue: {npc.dialogueId}
                </p>
              )}
              <ScheduleEntriesEditor
                dialogueIds={dialogueIds}
                entries={npc.schedule ?? []}
                onAdd={() =>
                  onUpdate((current) =>
                    addNpcScheduleEntry(current, npc.x, npc.y),
                  )
                }
                onRemove={(entryIndex) =>
                  onUpdate((current) =>
                    removeNpcScheduleEntry(current, npc.x, npc.y, entryIndex),
                  )
                }
                onUpdate={(entryIndex, patch) =>
                  onUpdate((current) =>
                    updateNpcScheduleEntry(
                      current,
                      npc.x,
                      npc.y,
                      entryIndex,
                      patch,
                    ),
                  )
                }
                title="Schedule"
                zoneIds={zoneIds}
              />
            </li>
          ))}
        </ul>
      </ZoneSection>

      <ZoneSection count={items.length} title="Item Stacks">
        <ul className="editor-zone-row-list">
          {items.map((item, index) => (
            <li className="editor-zone-row" key={`${item.itemId}-${index}`}>
              <div className="editor-zone-row__head">
                <strong>{item.itemId}</strong>
                <span>
                  ×{item.quantity} · ({item.x}, {item.y})
                </span>
              </div>
            </li>
          ))}
        </ul>
      </ZoneSection>

      <ZoneSection count={transitions.length} title="Transitions">
        <ul className="editor-zone-row-list">
          {transitions.map((transition, index) => (
            <li className="editor-zone-row" key={index}>
              <div className="editor-zone-row__head">
                <span>
                  ({transition.x}, {transition.y})
                </span>
                <span>
                  → {transition.targetZoneId} ({transition.targetX},{" "}
                  {transition.targetY})
                </span>
              </div>
            </li>
          ))}
        </ul>
      </ZoneSection>
    </>
  );
}

function ZoneSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="editor-zone-section">
      <div className="editor-family__header">
        <h3>{title}</h3>
        <span>{count}</span>
      </div>
      {count === 0 ? <p className="editor-empty">None.</p> : children}
    </section>
  );
}
