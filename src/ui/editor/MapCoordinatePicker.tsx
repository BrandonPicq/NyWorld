import { useRef, useState } from "react";
import type { ContentCatalogSnapshot } from "../../engine";
import { createZoneEditRenderSnapshot } from "../../rendering/zoneEditRenderSnapshot";
import type { GridCell } from "../../rendering/canvasCellMapping";
import { EditorButton } from "./components/EditorButton";
import { EditorPanel } from "./components/EditorPanel";
import { useFocusTrap } from "../hooks/focusTrap";
import { EditorZoneCanvas } from "./zone/EditorZoneCanvas";
import { describeZoneCell } from "./zone/zoneEditorModel";

type MapCoordinatePickerProps = {
  snapshot: ContentCatalogSnapshot;
  title: string;
  zoneId: string;
  onPick: (cell: GridCell) => void;
  onClose: () => void;
  targets?: readonly { id: string; label: string; zoneId: string }[];
  targetId?: string;
  onTargetChange?: (targetId: string) => void;
};

/**
 * Read-only map modal for selecting an authored coordinate from any editor form.
 *
 * The zone comes from the combined draft snapshot, so unsaved tile and placement
 * edits are visible before content is written to disk.
 */
export function MapCoordinatePicker({
  snapshot,
  title,
  zoneId,
  onPick,
  onClose,
  targets,
  targetId,
  onTargetChange,
}: MapCoordinatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const zone = snapshot.zones[zoneId];
  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);
  const { handleKeyDown } = useFocusTrap({
    containerRef,
    initialFocusRef: cancelButtonRef,
    onEscape: onClose,
  });

  const renderSnapshot = zone ? createZoneEditRenderSnapshot(zone) : null;
  const cellDescription =
    zone && hoveredCell ? describeZoneCell(zone, hoveredCell) : null;

  function handleCell(cell: GridCell, kind: "down" | "move"): void {
    if (kind !== "down") {
      return;
    }
    onPick(cell);
    onClose();
  }

  return (
    <div
      aria-labelledby="map-coordinate-picker-title"
      aria-modal="true"
      className="editor-coordinate-picker"
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="dialog"
      tabIndex={-1}
    >
      <EditorPanel className="editor-panel editor-coordinate-picker__panel">
        <header className="editor-coordinate-picker__header">
          <div>
            <p className="editor-coordinate-picker__eyebrow">MAP COORDINATE</p>
            <h2 className="editor-panel__title" id="map-coordinate-picker-title">
              {title}
            </h2>
          </div>
          <EditorButton
            className="editor-compact-button"
            onClick={onClose}
            ref={cancelButtonRef}
          >
            Cancel
          </EditorButton>
        </header>

        {targets && targetId && onTargetChange ? (
          <div
            aria-label="Set location for"
            className="editor-coordinate-picker__targets"
            role="group"
          >
            <span className="editor-coordinate-picker__target-label">
              Set location for
            </span>
            <div className="editor-coordinate-picker__target-buttons">
              {targets.map((target) => (
                <EditorButton
                  aria-pressed={target.id === targetId}
                  className="editor-coordinate-picker__target-button"
                  isSelected={target.id === targetId}
                  key={target.id}
                  onClick={() => onTargetChange(target.id)}
                >
                  {target.label}
                </EditorButton>
              ))}
            </div>
          </div>
        ) : null}

        {zone && renderSnapshot ? (
          <>
            <div className="editor-coordinate-picker__map">
              <EditorZoneCanvas
                ariaLabel={`Pick a coordinate in ${zone.name}`}
                onCellHover={setHoveredCell}
                onCellPointer={handleCell}
                renderSnapshot={renderSnapshot}
              />
            </div>
            <div className="workbench__statusbar">
              <span className="workbench__statusbar-coords">
                {cellDescription
                  ? `(${cellDescription.x}, ${cellDescription.y})`
                  : "(—, —)"}
              </span>
              <span className="workbench__statusbar-sep">·</span>
              <span className="workbench__statusbar-tile">
                {cellDescription ? (
                  <>
                    Tile:{" "}
                    <span className="workbench__statusbar-glyph">
                      {cellDescription.tileGlyph}
                    </span>{" "}
                    {cellDescription.tileName}
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span className="workbench__statusbar-sep">·</span>
              <span className="workbench__statusbar-walkable">
                {cellDescription ? (
                  <span
                    className={`workbench__statusbar-badge workbench__statusbar-badge--${
                      cellDescription.walkable ? "walkable" : "blocked"
                    }`}
                  >
                    {cellDescription.walkable ? "walkable" : "blocked"}
                  </span>
                ) : (
                  "—"
                )}
              </span>
              {cellDescription?.whatSitsThere ? (
                <>
                  <span className="workbench__statusbar-sep">·</span>
                  <span className="workbench__statusbar-contents">
                    {cellDescription.whatSitsThere}
                  </span>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <p className="editor-empty">Unknown zone: {zoneId || "(none)"}</p>
        )}
      </EditorPanel>
    </div>
  );
}
