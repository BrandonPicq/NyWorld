import { TerminalButton } from "../../components/TerminalButton";
import { ZoneTilePalette } from "./ZoneTilePalette";
import type { ZonePlacement, ZonePlacementMode } from "./usePlacementSelection";

const MODES: { mode: ZonePlacementMode; label: string }[] = [
  { mode: "inspect", label: "Inspect" },
  { mode: "tiles", label: "Tiles" },
  { mode: "player", label: "Player" },
  { mode: "npc", label: "NPC" },
  { mode: "item", label: "Item" },
  { mode: "transition", label: "Transition" },
  { mode: "erase", label: "Erase" },
];

/**
 * Mode selector plus the picker for the active placement mode.
 *
 * The parent wires the canvas to `placement.buildEdit`; this component only owns
 * presentation of the mode buttons and their inputs.
 */
export function ZonePlacementControls({
  placement,
}: {
  placement: ZonePlacement;
}) {
  return (
    <div className="editor-placement">
      <div
        aria-label="Placement mode"
        className="editor-mode-selector"
        role="group"
      >
        {MODES.map(({ mode, label }) => (
          <TerminalButton
            className="editor-mode-button"
            isSelected={placement.mode === mode}
            key={mode}
            onClick={() => placement.setMode(mode)}
          >
            {label}
          </TerminalButton>
        ))}
      </div>
      <ModeControls placement={placement} />
    </div>
  );
}

function ModeControls({ placement }: { placement: ZonePlacement }) {
  switch (placement.mode) {
    case "tiles":
      return (
        <ZoneTilePalette
          activeTileId={placement.activeTileId}
          onSelect={placement.setActiveTileId}
          tiles={placement.tiles}
        />
      );
    case "player":
      return (
        <p className="editor-placement-hint">
          Click a walkable tile to move the player start.
        </p>
      );
    case "npc":
      return (
        <div className="editor-placement-form">
          <label className="editor-field">
            <span>NPC</span>
            <select
              onChange={(event) => placement.setNpcId(event.target.value)}
              value={placement.npcId}
            >
              {placement.npcs.map((npc) => (
                <option key={npc.npcId} value={npc.npcId}>
                  {npc.npcId} — {npc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="editor-field">
            <span>Dialogue (optional)</span>
            <select
              onChange={(event) => placement.setDialogueId(event.target.value)}
              value={placement.dialogueId}
            >
              <option value="">(default)</option>
              {placement.dialogueIds.map((dialogueId) => (
                <option key={dialogueId} value={dialogueId}>
                  {dialogueId}
                </option>
              ))}
            </select>
          </label>
          <p className="editor-placement-hint">
            Click a walkable tile to place the NPC.
          </p>
        </div>
      );
    case "item":
      return (
        <div className="editor-placement-form">
          <label className="editor-field">
            <span>Item</span>
            <select
              onChange={(event) => placement.setItemId(event.target.value)}
              value={placement.itemId}
            >
              {placement.itemIds.map((itemId) => (
                <option key={itemId} value={itemId}>
                  {itemId}
                </option>
              ))}
            </select>
          </label>
          <label className="editor-field">
            <span>Quantity</span>
            <input
              min={1}
              onChange={(event) =>
                placement.setQuantity(clampInt(event.target.value, 1))
              }
              step={1}
              type="number"
              value={placement.quantity}
            />
          </label>
          <p className="editor-placement-hint">
            Click a walkable tile to place the item stack.
          </p>
        </div>
      );
    case "transition":
      return (
        <div className="editor-placement-form">
          <label className="editor-field">
            <span>Target zone</span>
            <select
              onChange={(event) => placement.setTargetZoneId(event.target.value)}
              value={placement.targetZoneId}
            >
              {placement.zoneIds.map((zoneId) => (
                <option key={zoneId} value={zoneId}>
                  {zoneId}
                </option>
              ))}
            </select>
          </label>
          <div className="editor-form-row">
            <label className="editor-field">
              <span>Target X</span>
              <input
                min={0}
                onChange={(event) =>
                  placement.setTargetX(clampInt(event.target.value, 0))
                }
                step={1}
                type="number"
                value={placement.targetX}
              />
            </label>
            <label className="editor-field">
              <span>Target Y</span>
              <input
                min={0}
                onChange={(event) =>
                  placement.setTargetY(clampInt(event.target.value, 0))
                }
                step={1}
                type="number"
                value={placement.targetY}
              />
            </label>
          </div>
          <p className="editor-placement-hint">
            Click a walkable tile to place the transition source.
          </p>
        </div>
      );
    case "erase":
      return (
        <p className="editor-placement-hint">
          Click or drag over a cell to remove its NPC, item, or transition.
        </p>
      );
    case "inspect":
    default:
      return (
        <p className="editor-placement-hint">
          Pick a mode, then click the map to edit.
        </p>
      );
  }
}

function clampInt(value: string, min: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > min ? parsed : min;
}
