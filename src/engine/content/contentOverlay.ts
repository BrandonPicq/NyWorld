import {
  clearCombatActionContentOverlay,
  installCombatActionContentOverlay,
} from "../combat/combatActionRegistry";
import {
  clearClassContentOverlay,
  installClassContentOverlay,
} from "../classes/classRegistry";
import {
  clearDialogueContentOverlay,
  installDialogueContentOverlay,
} from "../dialogues/dialogueRegistry";
import {
  clearEnemyContentOverlay,
  installEnemyContentOverlay,
} from "../enemies/enemyRegistry";
import {
  clearItemContentOverlay,
  installItemContentOverlay,
} from "../items/itemRegistry";
import {
  clearNpcContentOverlay,
  installNpcContentOverlay,
} from "../npcs/npcRegistry";
import {
  clearNpcPresenceContentOverlay,
  installNpcPresenceContentOverlay,
} from "../npcs/npcPresenceRegistry";
import {
  clearQuestContentOverlay,
  installQuestContentOverlay,
} from "../quests/questRegistry";
import {
  clearRaceContentOverlay,
  installRaceContentOverlay,
} from "../races/raceRegistry";
import {
  clearCommandMasteryContentOverlay,
  installCommandMasteryContentOverlay,
} from "../mastery/commandMasteryRegistry";
import {
  clearTileContentOverlay,
  installTileContentOverlay,
} from "../TileRegistry";
import type { ContentCatalogSnapshot } from "./ContentReferenceGraph";
import type { ContentValidationContext } from "./ContentValidationContext";

/**
 * Installs a temporary dev-only content overlay from an editor draft snapshot.
 *
 * Runtime consumers keep using the existing singleton-backed getters; while an
 * overlay is installed, those getters resolve against this draft catalog first.
 */
export function installContentOverlay(
  snapshot: ContentCatalogSnapshot,
  context: ContentValidationContext,
): void {
  if (!import.meta.env.DEV) return;

  clearContentOverlay();

  try {
    installTileContentOverlay(snapshot.tiles);
    installItemContentOverlay(snapshot.items);
    installDialogueContentOverlay(snapshot.dialogueFiles);
    installNpcContentOverlay(snapshot.npcs);
    installNpcPresenceContentOverlay(snapshot.npcPresence);
    installEnemyContentOverlay(snapshot.enemies);
    installCombatActionContentOverlay(snapshot.combatActions);
    installClassContentOverlay(snapshot.classes);
    installRaceContentOverlay(snapshot.races);
    installCommandMasteryContentOverlay(snapshot.commandMasteries ?? []);
    installQuestContentOverlay(snapshot.quests, context);
  } catch (error) {
    clearContentOverlay();
    throw error;
  }
}

export function clearContentOverlay(): void {
  clearQuestContentOverlay();
  clearCommandMasteryContentOverlay();
  clearRaceContentOverlay();
  clearClassContentOverlay();
  clearCombatActionContentOverlay();
  clearEnemyContentOverlay();
  clearNpcPresenceContentOverlay();
  clearNpcContentOverlay();
  clearDialogueContentOverlay();
  clearItemContentOverlay();
  clearTileContentOverlay();
}

if (import.meta.hot) {
  import.meta.hot.dispose(clearContentOverlay);
}
