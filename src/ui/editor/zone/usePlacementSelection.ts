import { useMemo, useState } from "react";
import {
  getAllDialogueIds,
  getAllItemIds,
  getAllNpcDefs,
  getAllTileDefs,
  type ContentCatalogSnapshot,
  type TileDef,
  type ZoneData,
} from "../../../engine";
import type { GridCell } from "../../../rendering/canvasCellMapping";
import {
  erasePlacementsAt,
  placeItemAt,
  placeNpcAt,
  placeTransitionAt,
  setPlayerStart,
  setTileAt,
} from "./zoneEditorModel";

export type ZonePlacementMode =
  | "inspect"
  | "tiles"
  | "player"
  | "npc"
  | "item"
  | "transition"
  | "erase";

export interface ZonePaletteTile {
  id: number;
  def: TileDef;
}

export interface ZoneNpcOption {
  npcId: string;
  name: string;
}

/**
 * Which edit a canvas click performs, plus the picker state behind each mode.
 *
 * `buildEdit` returns a pure draft updater (or null for inspect), so the actual
 * mutation stays in the tested zoneEditorModel helpers.
 */
export interface ZonePlacement {
  mode: ZonePlacementMode;
  setMode: (mode: ZonePlacementMode) => void;

  tiles: ZonePaletteTile[];
  activeTileId: number;
  setActiveTileId: (id: number) => void;

  npcs: ZoneNpcOption[];
  npcId: string;
  setNpcId: (id: string) => void;
  dialogueIds: string[];
  dialogueId: string;
  setDialogueId: (id: string) => void;

  itemIds: string[];
  itemId: string;
  setItemId: (id: string) => void;
  quantity: number;
  setQuantity: (quantity: number) => void;

  zoneIds: string[];
  targetZoneId: string;
  setTargetZoneId: (id: string) => void;
  targetX: number;
  setTargetX: (x: number) => void;
  targetY: number;
  setTargetY: (y: number) => void;

  /** Whether a drag (pointer move while pressed) keeps applying this mode. */
  paintsOnDrag: boolean;
  /** The draft updater for the active mode at a cell, or null for inspect. */
  buildEdit: (cell: GridCell) => ((zone: ZoneData) => ZoneData) | null;
}

export function usePlacementSelection(
  snapshot: ContentCatalogSnapshot,
): ZonePlacement {
  const tiles = useMemo<ZonePaletteTile[]>(
    () =>
      [...getAllTileDefs().entries()]
        .sort(([a], [b]) => a - b)
        .map(([id, def]) => ({ id, def })),
    [],
  );
  const npcs = useMemo<ZoneNpcOption[]>(
    () =>
      getAllNpcDefs()
        .map((npc) => ({ npcId: npc.npcId, name: npc.name }))
        .sort((a, b) => a.npcId.localeCompare(b.npcId)),
    [],
  );
  const dialogueIds = useMemo(
    () => [...getAllDialogueIds()].sort((a, b) => a.localeCompare(b)),
    [],
  );
  const itemIds = useMemo(
    () => [...getAllItemIds()].sort((a, b) => a.localeCompare(b)),
    [],
  );
  const zoneIds = useMemo(
    () => Object.keys(snapshot.zones).sort((a, b) => a.localeCompare(b)),
    [snapshot],
  );

  const [mode, setMode] = useState<ZonePlacementMode>("tiles");
  const [activeTileId, setActiveTileId] = useState(() => tiles[0]?.id ?? 0);
  const [npcId, setNpcId] = useState(() => npcs[0]?.npcId ?? "");
  const [dialogueId, setDialogueId] = useState("");
  const [itemId, setItemId] = useState(() => itemIds[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [targetZoneId, setTargetZoneId] = useState(() => zoneIds[0] ?? "");
  const [targetX, setTargetX] = useState(0);
  const [targetY, setTargetY] = useState(0);

  const paintsOnDrag = mode === "tiles" || mode === "erase";

  function buildEdit(cell: GridCell): ((zone: ZoneData) => ZoneData) | null {
    switch (mode) {
      case "tiles":
        return (zone) => setTileAt(zone, cell.x, cell.y, activeTileId);
      case "player":
        return (zone) => setPlayerStart(zone, cell.x, cell.y);
      case "npc":
        return npcId
          ? (zone) =>
              placeNpcAt(zone, cell.x, cell.y, npcId, dialogueId || undefined)
          : null;
      case "item":
        return itemId
          ? (zone) => placeItemAt(zone, cell.x, cell.y, itemId, quantity)
          : null;
      case "transition":
        return targetZoneId
          ? (zone) =>
              placeTransitionAt(
                zone,
                cell.x,
                cell.y,
                targetZoneId,
                targetX,
                targetY,
              )
          : null;
      case "erase":
        return (zone) => erasePlacementsAt(zone, cell.x, cell.y);
      case "inspect":
      default:
        return null;
    }
  }

  return {
    mode,
    setMode,
    tiles,
    activeTileId,
    setActiveTileId,
    npcs,
    npcId,
    setNpcId,
    dialogueIds,
    dialogueId,
    setDialogueId,
    itemIds,
    itemId,
    setItemId,
    quantity,
    setQuantity,
    zoneIds,
    targetZoneId,
    setTargetZoneId,
    targetX,
    setTargetX,
    targetY,
    setTargetY,
    paintsOnDrag,
    buildEdit,
  };
}
