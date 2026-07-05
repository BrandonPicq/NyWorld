import { useMemo, useState, type ReactNode } from "react";
import type { ContentCatalogSnapshot, ZoneData } from "../../../engine";
import { createZoneEditRenderSnapshot } from "../../../rendering/zoneEditRenderSnapshot";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import { EditorZoneCanvas } from "./EditorZoneCanvas";
import { listEditorZones } from "./zoneEditorModel";

type ZoneViewerPanelProps = {
  snapshot: ContentCatalogSnapshot;
};

/**
 * Read-only "Zones" tab of the content editor.
 *
 * Renders the selected zone through the shared grid renderer and lists its
 * authored placements (NPC spawns with schedules, item stacks, transitions,
 * entry dialogue). No mutation happens here — editing lands in later slices.
 */
export function ZoneViewerPanel({ snapshot }: ZoneViewerPanelProps) {
  const zones = useMemo(() => listEditorZones(snapshot), [snapshot]);
  const [selectedZoneId, setSelectedZoneId] = useState(
    () => zones[0]?.zoneId ?? "",
  );

  const selectedZone: ZoneData | undefined = snapshot.zones[selectedZoneId];
  const renderSnapshot = useMemo(
    () => (selectedZone ? createZoneEditRenderSnapshot(selectedZone) : null),
    [selectedZone],
  );

  return (
    <div className="editor-zone-layout">
      <TerminalPanel className="editor-panel editor-zone-list">
        <h2 className="editor-panel__title">Zones</h2>
        {zones.length === 0 ? (
          <p className="editor-empty">No zones authored.</p>
        ) : (
          <div className="editor-scroll" role="list">
            {zones.map((zone) => (
              <TerminalButton
                className="editor-entry-button editor-zone-entry"
                isSelected={zone.zoneId === selectedZoneId}
                key={zone.zoneId}
                onClick={() => setSelectedZoneId(zone.zoneId)}
              >
                <span className="editor-zone-entry__name">{zone.name}</span>
                <span className="editor-zone-entry__meta">
                  {zone.zoneId} · {zone.npcCount}N {zone.itemCount}I{" "}
                  {zone.transitionCount}T
                </span>
              </TerminalButton>
            ))}
          </div>
        )}
      </TerminalPanel>

      <TerminalPanel className="editor-panel editor-zone-preview">
        <h2 className="editor-panel__title">Preview</h2>
        {selectedZone && renderSnapshot ? (
          <div className="editor-zone-preview__body">
            <div className="editor-zone-canvas-frame">
              <EditorZoneCanvas
                ariaLabel={`Zone ${selectedZone.name} preview`}
                renderSnapshot={renderSnapshot}
              />
            </div>
            <p className="editor-zone-dimensions">
              {selectedZone.width} × {selectedZone.height} tiles · start (
              {selectedZone.playerStart.x}, {selectedZone.playerStart.y})
            </p>
          </div>
        ) : (
          <p className="editor-empty">No zone selected.</p>
        )}
      </TerminalPanel>

      <TerminalPanel className="editor-panel editor-zone-details">
        <h2 className="editor-panel__title">Contents</h2>
        {selectedZone ? (
          <div className="editor-scroll">
            <ZoneDetails zone={selectedZone} />
          </div>
        ) : (
          <p className="editor-empty">No zone selected.</p>
        )}
      </TerminalPanel>
    </div>
  );
}

function ZoneDetails({ zone }: { zone: ZoneData }) {
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
