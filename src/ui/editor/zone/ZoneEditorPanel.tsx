import { useState } from "react";
import type { ContentCatalogSnapshot } from "../../../engine";
import { IdentifierLabel } from "../../components/IdentifierLabel";
import { ScrollRegion } from "../../components/ScrollRegion";
import { EditorPanel } from "../components/EditorPanel";
import type { EditorContentNavigationTarget } from "../DiagnosticList";
import {
  EditorGroupedList,
  type EditorGroupedListGroup,
} from "../EditorGroupedList";
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
  const zoneGroups: EditorGroupedListGroup[] = [
    {
      key: "zones",
      label: "Zones",
      entries: zones.map((zone) => ({
        key: zone.zoneId,
        id: zone.zoneId,
        name: zone.name,
        label: zone.name,
        meta: (
          <>
            <IdentifierLabel value={zone.zoneId} /> · {zone.npcCount}N {" "}
            {zone.itemCount}I {zone.transitionCount}T
          </>
        ),
      })),
    },
  ];

  return (
    <div className="workbench">
      <ScrollRegion className="workbench__rail">
          <EditorPanel className="editor-panel editor-zone-list">
            <h2 className="editor-panel__title">Zones</h2>
            {zones.length === 0 ? (
              <p className="editor-empty">No zones authored.</p>
            ) : (
              <EditorGroupedList
                emptyLabel="No matching zones."
                filter={listFilter}
                groups={zoneGroups}
                onFilterChange={setListFilter}
                onSelect={(entry) => selectZone(entry.id)}
                selectedEntryKey={selectedZoneId}
              />
            )}
            <ZoneCreateForm existingZoneIds={zones.map((zone) => zone.zoneId)} />
        </EditorPanel>
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
            <EditorPanel className="editor-panel">
              <h2 className="editor-panel__title">Paint</h2>
              <p className="editor-empty">No zone selected.</p>
            </EditorPanel>
          </ScrollRegion>
          <ScrollRegion className="workbench__inspector">
            <EditorPanel className="editor-panel">
              <h2 className="editor-panel__title">Contents</h2>
              <p className="editor-empty">No zone selected.</p>
            </EditorPanel>
          </ScrollRegion>
        </>
      )}
    </div>
  );
}
