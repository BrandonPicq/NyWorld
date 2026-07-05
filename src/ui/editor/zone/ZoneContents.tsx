import type { ReactNode } from "react";
import type { ZoneData } from "../../../engine";

/**
 * Read-only listing of a zone's authored placements.
 *
 * Tile painting (slice 8) edits the grid; NPC spawns, item stacks, transitions,
 * and entry dialogue stay read-only here until placement editing lands.
 */
export function ZoneContents({ zone }: { zone: ZoneData }) {
  const npcs = zone.npcs ?? [];
  const items = zone.items ?? [];
  const transitions = zone.transitions ?? [];
  const entryDialogue = zone.entryDialogue ?? [];

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
              {npc.schedule && npc.schedule.length > 0 && (
                <ul className="editor-zone-schedule">
                  {npc.schedule.map((entry, scheduleIndex) => (
                    <li key={scheduleIndex}>
                      {entry.time} →{" "}
                      {entry.zoneId ? `${entry.zoneId} ` : ""}({entry.x},{" "}
                      {entry.y})
                      {entry.dialogueId ? ` · ${entry.dialogueId}` : ""}
                    </li>
                  ))}
                </ul>
              )}
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

      <ZoneSection count={entryDialogue.length} title="Entry Dialogue">
        <ul className="editor-zone-row-list">
          {entryDialogue.map((node, index) => (
            <li className="editor-zone-row" key={index}>
              <div className="editor-zone-row__head">
                <strong>{node.speaker}</strong>
              </div>
              <p className="editor-zone-row__meta">{node.text}</p>
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
