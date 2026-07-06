import { TerminalButton } from "../../components/TerminalButton";
import type { ZonePaletteTile } from "./usePlacementSelection";

type ZoneTilePaletteProps = {
  tiles: ZonePaletteTile[];
  activeTileId: number;
  disabled?: boolean;
  onSelect: (id: number) => void;
};

/**
 * Tile picker for the zone painter, sourced from the tile registry.
 *
 * Each swatch shows the tile glyph, id, name, and a walkable/blocked badge so
 * the author knows what painting a cell will do.
 */
export function ZoneTilePalette({
  tiles,
  activeTileId,
  disabled = false,
  onSelect,
}: ZoneTilePaletteProps) {
  return (
    <div className="editor-tile-palette" role="listbox" aria-label="Tile palette">
      {tiles.map(({ id, def }) => (
        <TerminalButton
          aria-label={`Tile ${id} ${def.name}`}
          className="editor-tile-swatch"
          disabled={disabled}
          isSelected={id === activeTileId}
          key={id}
          onClick={() => onSelect(id)}
          role="option"
        >
          <span className="editor-tile-swatch__glyph">{def.glyph}</span>
          <span className="editor-tile-swatch__name">
            {id} · {def.name}
          </span>
          <span
            className={`editor-tile-swatch__badge editor-tile-swatch__badge--${
              def.walkable ? "walkable" : "blocked"
            }`}
          >
            {def.walkable ? "walkable" : "blocked"}
          </span>
        </TerminalButton>
      ))}
    </div>
  );
}
