import { useMemo, useState } from "react";
import type { ContentCatalogSnapshot, ZoneData } from "../../../engine";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import { ZoneDraftEditor } from "./ZoneDraftEditor";
import { listEditorZones } from "./zoneEditorModel";

type ZoneEditorPanelProps = {
  snapshot: ContentCatalogSnapshot;
};

/**
 * "Zones" tab of the content editor: pick a zone, paint its tiles.
 *
 * This panel orchestrates zone selection; the per-zone tile-painting draft lives
 * in ZoneDraftEditor, remounted per zone so switching zones starts fresh.
 */
export function ZoneEditorPanel({ snapshot }: ZoneEditorPanelProps) {
  const zones = useMemo(() => listEditorZones(snapshot), [snapshot]);
  const [selectedZoneId, setSelectedZoneId] = useState(
    () => zones[0]?.zoneId ?? "",
  );

  const selectedZone: ZoneData | undefined = snapshot.zones[selectedZoneId];

  return (
    <div className="editor-zone-layout">
      <TerminalPanel className="editor-panel editor-zone-list">
        <h2 className="editor-panel__title">Zones</h2>
        {zones.length === 0 ? (
          <p className="editor-empty">No zones authored.</p>
        ) : (
          <ScrollRegion className="editor-scroll" role="list">
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
          </ScrollRegion>
        )}
      </TerminalPanel>

      {selectedZone ? (
        <ZoneDraftEditor key={selectedZone.zoneId} zone={selectedZone} />
      ) : (
        <>
          <TerminalPanel className="editor-panel editor-zone-preview">
            <h2 className="editor-panel__title">Paint</h2>
            <p className="editor-empty">No zone selected.</p>
          </TerminalPanel>
          <TerminalPanel className="editor-panel editor-zone-details">
            <h2 className="editor-panel__title">Contents</h2>
            <p className="editor-empty">No zone selected.</p>
          </TerminalPanel>
        </>
      )}
    </div>
  );
}
