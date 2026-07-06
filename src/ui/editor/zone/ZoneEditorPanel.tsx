import { useState } from "react";
import type { ContentCatalogSnapshot } from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { TerminalButton } from "../../components/TerminalButton";
import { TerminalPanel } from "../../components/TerminalPanel";
import type { EditorContentNavigationTarget } from "../DiagnosticList";
import { ListFilterField } from "../ListFilterField";
import { filterByIdOrName } from "../listFilter";
import { ZoneCreateForm } from "./ZoneCreateForm";
import { ZoneDraftEditor } from "./ZoneDraftEditor";
import type { ZoneDraftController } from "./useZoneDraft";

type ZoneEditorPanelProps = {
  draft: ZoneDraftController;
  onNavigate: (target: EditorContentNavigationTarget) => void;
  snapshot: ContentCatalogSnapshot;
};

/**
 * "Zones" tab of the content editor: pick a zone, paint its tiles.
 *
 * Zone selection and the per-zone undo history live in the shared editor draft
 * owner (keyed by zone id), so unsaved edits and validation are visible across
 * tabs; this panel only orchestrates the list and the paint surface.
 */
export function ZoneEditorPanel({
  draft,
  onNavigate,
  snapshot,
}: ZoneEditorPanelProps) {
  const [listFilter, setListFilter] = useState("");
  const { zones, selectedZoneId, selectZone } = draft;
  const filteredZones = filterByIdOrName(
    zones.map((zone) => ({ ...zone, id: zone.zoneId, name: zone.name })),
    listFilter,
  );

  return (
    <div className="workbench">
      <ScrollRegion className="workbench__rail">
        <TerminalPanel className="editor-panel editor-zone-list">
          <h2 className="editor-panel__title">Zones</h2>
          <ListFilterField
            label="Filter"
            onChange={setListFilter}
            value={listFilter}
          />
          {zones.length === 0 ? (
            <p className="editor-empty">No zones authored.</p>
          ) : filteredZones.length === 0 ? (
            <p className="editor-empty">No matching zones.</p>
          ) : (
            <div className="editor-entry-list" role="list">
              {filteredZones.map((zone) => (
                <TerminalButton
                  className="editor-entry-button editor-zone-entry"
                  isSelected={zone.zoneId === selectedZoneId}
                  key={zone.zoneId}
                  onClick={() => selectZone(zone.zoneId)}
                >
                  <span className="editor-zone-entry__name">{zone.name}</span>
                  <span className="editor-zone-entry__meta">
                    <IdentifierLabel value={zone.zoneId} /> · {zone.npcCount}N{" "}
                    {zone.itemCount}I {zone.transitionCount}T
                  </span>
                </TerminalButton>
              ))}
            </div>
          )}
          <ZoneCreateForm existingZoneIds={zones.map((zone) => zone.zoneId)} />
        </TerminalPanel>
      </ScrollRegion>

      {draft.draft && draft.renderSnapshot ? (
        <ZoneDraftEditor
          controller={draft}
          onNavigate={onNavigate}
          snapshot={snapshot}
        />
      ) : (
        <>
          <ScrollRegion className="workbench__main">
            <TerminalPanel className="editor-panel">
              <h2 className="editor-panel__title">Paint</h2>
              <p className="editor-empty">No zone selected.</p>
            </TerminalPanel>
          </ScrollRegion>
          <ScrollRegion className="workbench__inspector">
            <TerminalPanel className="editor-panel">
              <h2 className="editor-panel__title">Contents</h2>
              <p className="editor-empty">No zone selected.</p>
            </TerminalPanel>
          </ScrollRegion>
        </>
      )}
    </div>
  );
}
