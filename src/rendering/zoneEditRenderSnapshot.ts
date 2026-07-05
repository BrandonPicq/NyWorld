import type { RenderEntity } from "../engine/GameplayEngine";
import { getItemMapPresentation } from "../engine/items/itemMapPresentation";
import { getNpcMapPresentation } from "../engine/npcs/npcMapPresentation";
import { getNpcDef } from "../engine/npcs/npcRegistry";
import { getTileDef } from "../engine/TileRegistry";
import type { ZoneData } from "../engine/ZoneTypes";
import type { GridRenderSnapshot } from "./renderSnapshot";

/**
 * Builds a render-ready snapshot from authored zone data for the editor.
 *
 * Unlike createGridRenderSnapshot, which projects live engine state, this reads
 * a static ZoneData file so the editor can preview a zone without instantiating
 * the simulation. Tiles are resolved through the tile registry, the player
 * marker doubles as the authored start position, and NPC/item spawns are
 * projected with the same glyph/color helpers the runtime spawner uses.
 */
export function createZoneEditRenderSnapshot(
  zone: ZoneData,
): GridRenderSnapshot {
  const npcEntities: RenderEntity[] = (zone.npcs ?? []).map((npc) => {
    const npcDef = getNpcDef(npc.npcId);
    const presentation = getNpcMapPresentation(npcDef);
    return {
      x: npc.x,
      y: npc.y,
      glyph: presentation.glyph,
      color: presentation.color,
      npcId: npc.npcId,
      name: npcDef.name,
    };
  });

  const itemEntities: RenderEntity[] = (zone.items ?? []).map((item) => {
    const presentation = getItemMapPresentation(item.itemId);
    return {
      x: item.x,
      y: item.y,
      glyph: presentation.glyph,
      color: presentation.color,
    };
  });

  return {
    width: zone.width,
    height: zone.height,
    player: {
      x: zone.playerStart.x,
      y: zone.playerStart.y,
    },
    tiles: zone.tiles.map((row) =>
      row.map((tileId) => {
        const tileDef = getTileDef(tileId);
        return {
          glyph: tileDef.glyph,
          role: tileDef.walkable ? "open" : "blocked",
        };
      }),
    ),
    entities: [...npcEntities, ...itemEntities],
  };
}
