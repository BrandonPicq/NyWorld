import type { RenderEntity } from "../engine/GameplayEngine";
import { getScheduledNpcPositionAt } from "../engine/systems/NpcScheduleSystem";
import { getItemMapPresentation } from "../engine/items/itemMapPresentation";
import { getNpcMapPresentation } from "../engine/npcs/npcMapPresentation";
import { getNpcDef } from "../engine/npcs/npcRegistry";
import { getTileDef } from "../engine/TileRegistry";
import type { NpcPresenceDef } from "../engine/npcs/NpcPresenceDef";
import type { ZoneData } from "../engine/ZoneTypes";
import type { GridRenderSnapshot } from "./renderSnapshot";

export interface ZoneEditPreviewOptions {
  minutesOfDay: number;
  presence: readonly NpcPresenceDef[];
}

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
  preview?: ZoneEditPreviewOptions,
): GridRenderSnapshot {
  const npcEntities = preview
    ? createScheduledNpcEntities(zone, preview)
    : (zone.npcs ?? []).map((npc) => createNpcEntity(npc.npcId, npc.x, npc.y));

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

function createScheduledNpcEntities(
  zone: ZoneData,
  preview: ZoneEditPreviewOptions,
): RenderEntity[] {
  const localEntities = (zone.npcs ?? []).flatMap((npc) => {
    const scheduledPosition = getScheduledNpcPositionAt(
      npc.schedule,
      preview.minutesOfDay,
    );

    if (
      scheduledPosition?.zoneId !== undefined &&
      scheduledPosition.zoneId !== zone.zoneId
    ) {
      return [];
    }

    return [
      createNpcEntity(
        npc.npcId,
        scheduledPosition?.x ?? npc.x,
        scheduledPosition?.y ?? npc.y,
      ),
    ];
  });
  const localNpcIds = new Set((zone.npcs ?? []).map((npc) => npc.npcId));
  const presenceEntities = preview.presence.flatMap((presence) => {
    if (localNpcIds.has(presence.npcId)) {
      return [];
    }

    const scheduledPosition = getScheduledNpcPositionAt(
      presence.schedule,
      preview.minutesOfDay,
    );
    if (!scheduledPosition || scheduledPosition.zoneId !== zone.zoneId) {
      return [];
    }

    return [
      createNpcEntity(
        presence.npcId,
        scheduledPosition.x,
        scheduledPosition.y,
      ),
    ];
  });

  return [...localEntities, ...presenceEntities];
}

function createNpcEntity(npcId: string, x: number, y: number): RenderEntity {
  const npcDef = getNpcDef(npcId);
  const presentation = getNpcMapPresentation(npcDef);
  return {
    x,
    y,
    glyph: presentation.glyph,
    color: presentation.color,
    npcId,
    name: npcDef.name,
  };
}
