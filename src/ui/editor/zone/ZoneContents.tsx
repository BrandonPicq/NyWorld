import { useEffect, useRef, type ReactNode } from "react";
import type { ZoneData } from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import { EditorButton } from "../components/EditorButton";
import { ScheduleEntriesEditor } from "../ScheduleEntriesEditor";
import {
  addNpcScheduleEntry,
  removeItemAt,
  removeNpcAt,
  removeNpcScheduleEntry,
  removeTransitionAt,
  updateNpcScheduleEntry,
  type PlacementSelection,
} from "./zoneEditorModel";

type ZoneContentsProps = {
  zone: ZoneData;
  zoneIds: readonly string[];
  dialogueIds: readonly string[];
  onUpdate: (updater: (zone: ZoneData) => ZoneData) => void;
  selectedPlacement?: PlacementSelection | null;
  onPickScheduleCoordinate?: (request: {
    title: string;
    zoneId: string;
    onPick: (cell: GridCell) => void;
  }) => void;
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
  selectedPlacement,
  onPickScheduleCoordinate,
}: ZoneContentsProps) {
  const npcs = zone.npcs ?? [];
  const items = zone.items ?? [];
  const transitions = zone.transitions ?? [];

  // One ref follows whichever row is selected so it can be scrolled into view.
  const selectedRowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedPlacement]);

  function isSelected(kind: PlacementSelection["kind"], index: number): boolean {
    return (
      selectedPlacement?.kind === kind && selectedPlacement.index === index
    );
  }

  return (
    <>
      {selectedPlacement?.kind === "player" && (
        <p className="editor-zone-row__meta" data-testid="player-start-selected">
          Player start selected — not deletable.
        </p>
      )}

      <ZoneSection count={npcs.length} title="NPC Spawns">
        <ul className="editor-zone-row-list">
          {npcs.map((npc, index) => (
            <li
              className={rowClass(isSelected("npc", index))}
              key={`${npc.npcId}-${index}`}
              ref={isSelected("npc", index) ? selectedRowRef : undefined}
            >
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
              {isSelected("npc", index) && (
                <EditorButton
                  className="editor-compact-button"
                  onClick={() =>
                    onUpdate((current) => removeNpcAt(current, npc.x, npc.y))
                  }
                >
                  Delete Spawn
                </EditorButton>
              )}
              <ScheduleEntriesEditor
                dialogueIds={dialogueIds}
                entries={npc.schedule ?? []}
                fallbackZoneId={zone.zoneId}
                onAdd={() =>
                  onUpdate((current) =>
                    addNpcScheduleEntry(current, npc.x, npc.y),
                  )
                }
                onPickCoordinate={(entryIndex, zoneId) =>
                  onPickScheduleCoordinate?.({
                    title: `Pick schedule coordinate for ${npc.npcId}`,
                    zoneId,
                    onPick: (cell) =>
                      onUpdate((current) =>
                        updateNpcScheduleEntry(
                          current,
                          npc.x,
                          npc.y,
                          entryIndex,
                          { x: cell.x, y: cell.y },
                        ),
                      ),
                  })
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
            <li
              className={rowClass(isSelected("item", index))}
              key={`${item.itemId}-${index}`}
              ref={isSelected("item", index) ? selectedRowRef : undefined}
            >
              <div className="editor-zone-row__head">
                <strong>{item.itemId}</strong>
                <span>
                  ×{item.quantity} · ({item.x}, {item.y})
                </span>
              </div>
              {isSelected("item", index) && (
                <EditorButton
                  className="editor-compact-button"
                  onClick={() =>
                    onUpdate((current) => removeItemAt(current, item.x, item.y))
                  }
                >
                  Delete Stack
                </EditorButton>
              )}
            </li>
          ))}
        </ul>
      </ZoneSection>

      <ZoneSection count={transitions.length} title="Transitions">
        <ul className="editor-zone-row-list">
          {transitions.map((transition, index) => (
            <li
              className={rowClass(isSelected("transition", index))}
              key={index}
              ref={isSelected("transition", index) ? selectedRowRef : undefined}
            >
              <div className="editor-zone-row__head">
                <span>
                  ({transition.x}, {transition.y})
                </span>
                <span>
                  → {transition.targetZoneId} ({transition.targetX},{" "}
                  {transition.targetY})
                </span>
              </div>
              {isSelected("transition", index) && (
                <EditorButton
                  className="editor-compact-button"
                  onClick={() =>
                    onUpdate((current) =>
                      removeTransitionAt(current, transition.x, transition.y),
                    )
                  }
                >
                  Delete Transition
                </EditorButton>
              )}
            </li>
          ))}
        </ul>
      </ZoneSection>
    </>
  );
}

function rowClass(selected: boolean): string {
  return selected
    ? "editor-zone-row editor-zone-row--selected"
    : "editor-zone-row";
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
