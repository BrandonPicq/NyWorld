import type { GameCommand } from "../commands";
import type { Inventory, Npc, Stats } from "../components";
import type { World } from "../ecs/World";
import type { EntityId } from "../ecs/types";
import { getEnemyDef, isCombatEnemy } from "../enemies/enemyRegistry";
import { getItemDef } from "../items/itemRegistry";
import { createNpcStats } from "../stats/npcStats";
import { cloneStats } from "../stats/characterStats";
import {
  createQteChallenge,
  resolveQteContest,
  type CombatActionKind,
  type QteChallenge,
} from "./qteCombat";

export type CombatPhase =
  | "action_selection"
  | "player_qte"
  | "opponent_turn_transition"
  | "enemy_qte"
  | "victory"
  | "defeat";

export interface CombatState {
  opponentId: EntityId;
  opponentNpcId: string;
  opponentName: string;
  opponentStats: Stats;
  phase: CombatPhase;
  actionKind?: CombatActionKind;
  qteChallenge?: QteChallenge;
  qteSequence?: string[];
}

export type CombatEffect = {
  type: "ItemCollected";
  itemId: string;
  quantity: number;
  source?: "reward";
};

export interface CombatExecuteResult {
  success: boolean;
  effects?: CombatEffect[];
}

export interface CombatSystemContext {
  world: World;
  getPlayerStats: () => Stats;
  getPlayerInventory: () => Inventory;
  addLog: (message: string) => void;
  recordNpcDefeat: (npcId: string) => void;
  recoverPlayerFromDefeat: () => void;
}

/**
 * Owns the current combat encounter state and resolves combat-only commands.
 *
 * The broader GameplayEngine still owns map transitions, save data, and other
 * world systems; this class keeps the QTE turn flow and combat rewards in one
 * focused place.
 */
export class CombatSystem {
  private state?: CombatState;

  constructor(private readonly context: CombatSystemContext) {}

  hasActiveCombat(): boolean {
    return this.state !== undefined;
  }

  getSnapshot(): CombatState | undefined {
    if (!this.state) {
      return undefined;
    }

    return {
      ...this.state,
      opponentStats: cloneStats(this.state.opponentStats),
      qteSequence: this.state.qteSequence
        ? [...this.state.qteSequence]
        : undefined,
      qteChallenge: this.state.qteChallenge
        ? { ...this.state.qteChallenge }
        : undefined,
    };
  }

  execute(command: GameCommand): CombatExecuteResult {
    if (!this.state) {
      return { success: false };
    }

    if (command.type === "SelectCombatAction") {
      return this.handleSelectCombatAction(command.actionKind);
    }
    if (command.type === "SubmitCombatQte") {
      return this.handleSubmitCombatQte(
        command.completed,
        command.inputAdvantage,
        command.mistakes,
      );
    }
    if (command.type === "StartOpponentTurn") {
      return this.handleStartOpponentTurn();
    }
    if (command.type === "ConcludeCombat") {
      return this.handleConcludeCombat();
    }

    return { success: false };
  }

  startCombat(npc: Npc): CombatExecuteResult {
    const opponentEntityId = this.findNpcEntity(npc.npcId);
    if (!opponentEntityId) {
      return { success: false };
    }

    this.state = {
      opponentId: opponentEntityId,
      opponentNpcId: npc.npcId,
      opponentName: npc.name,
      opponentStats: createNpcStats(npc.npcId),
      phase: "action_selection",
    };

    this.context.addLog(`Combat started with ${npc.name}!`);

    return { success: true };
  }

  private handleSelectCombatAction(
    actionKind: "physical" | "magical" | "flee",
  ): CombatExecuteResult {
    if (!this.state || this.state.phase !== "action_selection") {
      return { success: false };
    }

    const playerStats = this.context.getPlayerStats();
    const opponentStats = this.state.opponentStats;

    if (actionKind === "flee") {
      return this.handleFleeAttempt(playerStats, opponentStats);
    }

    this.state.actionKind = actionKind;
    this.state.phase = "player_qte";

    const challenge = createQteChallenge({
      actor: playerStats,
      opponent: opponentStats,
      kind: actionKind,
      isPlayerActor: true,
    });

    this.state.qteChallenge = challenge;
    this.state.qteSequence = generateQteSequence(challenge.sequenceLength);

    return { success: true };
  }

  private handleFleeAttempt(
    playerStats: Stats,
    opponentStats: Stats,
  ): CombatExecuteResult {
    if (!this.state) {
      return { success: false };
    }

    const fleeChance = Math.max(
      0.1,
      Math.min(
        0.9,
        0.5 +
          (playerStats.attributes.agility -
            opponentStats.attributes.agility) *
            0.05,
      ),
    );
    const success = Math.random() < fleeChance;
    if (success) {
      this.context.addLog("You successfully fled from the combat!");
      this.state = undefined;
      return { success: true };
    }

    this.context.addLog("Flee attempt failed! The enemy attacks!");
    this.state.phase = "opponent_turn_transition";
    this.state.qteChallenge = undefined;
    this.state.qteSequence = undefined;
    return { success: true };
  }

  private handleSubmitCombatQte(
    completed: boolean,
    inputAdvantage: number,
    mistakes: number,
  ): CombatExecuteResult {
    if (!this.state) {
      return { success: false };
    }

    if (this.state.phase === "player_qte") {
      return this.resolvePlayerAttack(completed, inputAdvantage, mistakes);
    }

    if (this.state.phase === "enemy_qte") {
      return this.resolveEnemyAttack(completed, inputAdvantage, mistakes);
    }

    return { success: false };
  }

  private resolvePlayerAttack(
    completed: boolean,
    inputAdvantage: number,
    mistakes: number,
  ): CombatExecuteResult {
    if (!this.state) {
      return { success: false };
    }

    const playerStats = this.context.getPlayerStats();
    const opponentStats = this.state.opponentStats;
    const actionKind = this.state.actionKind ?? "physical";
    let finalDamage = 0;
    let outcomeLabel = "";

    if (mistakes >= 2) {
      outcomeLabel = "MISS (input failure)";
      this.context.addLog(
        `You used ${actionKind} attack! Outcome: ${outcomeLabel} (0 damage to ${this.state.opponentName}).`,
      );
    } else {
      const result = resolveQteContest({
        attacker: playerStats,
        defender: opponentStats,
        kind: actionKind,
        attackerCompleted: completed,
        inputAdvantage,
      });

      finalDamage = result.damage;
      outcomeLabel = result.outcome.toUpperCase();

      if (mistakes === 1) {
        finalDamage = Math.floor(finalDamage * 0.8);
        this.context.addLog(
          `You used ${actionKind} attack (1 mistake)! Outcome: ${outcomeLabel} (${finalDamage} damage to ${this.state.opponentName}).`,
        );
      } else {
        this.context.addLog(
          `You used ${actionKind} attack! Outcome: ${outcomeLabel} (${finalDamage} damage to ${this.state.opponentName}).`,
        );
      }
    }

    opponentStats.resources.hp = Math.max(
      0,
      opponentStats.resources.hp - finalDamage,
    );

    if (opponentStats.resources.hp <= 0) {
      this.state.phase = "victory";
      this.context.addLog(`You defeated the ${this.state.opponentName}!`);
      this.context.recordNpcDefeat(this.state.opponentNpcId);
    } else {
      this.state.phase = "opponent_turn_transition";
      this.state.qteChallenge = undefined;
      this.state.qteSequence = undefined;
    }

    return { success: true };
  }

  private resolveEnemyAttack(
    completed: boolean,
    inputAdvantage: number,
    mistakes: number,
  ): CombatExecuteResult {
    if (!this.state) {
      return { success: false };
    }

    const playerStats = this.context.getPlayerStats();
    const opponentStats = this.state.opponentStats;
    let finalDamage = 0;
    let outcomeLabel = "";

    if (mistakes >= 2) {
      const result = resolveQteContest({
        attacker: opponentStats,
        defender: playerStats,
        kind: "physical",
        attackerCompleted: true,
        inputAdvantage: 5,
      });
      finalDamage = Math.floor(result.damage * 1.2);
      outcomeLabel = "CRITICAL (input failure)";
      this.context.addLog(
        `${this.state.opponentName} landed a crushing blow due to your input failure! Outcome: ${outcomeLabel} (${finalDamage} damage to you).`,
      );
    } else {
      const result = resolveQteContest({
        attacker: opponentStats,
        defender: playerStats,
        kind: "physical",
        attackerCompleted: !completed,
        inputAdvantage: -inputAdvantage,
      });

      finalDamage = result.damage;
      outcomeLabel = result.outcome.toUpperCase();

      if (mistakes === 1) {
        finalDamage = Math.floor(finalDamage * 1.2);
        this.context.addLog(
          `${this.state.opponentName} attacks (1 mistake)! Outcome: ${outcomeLabel} (${finalDamage} damage to you).`,
        );
      } else {
        this.context.addLog(
          `${this.state.opponentName} attacks! Outcome: ${outcomeLabel} (${finalDamage} damage to you).`,
        );
      }
    }

    playerStats.resources.hp = Math.max(
      0,
      playerStats.resources.hp - finalDamage,
    );

    if (playerStats.resources.hp <= 0) {
      this.state.phase = "defeat";
      this.context.addLog(`You were defeated by the ${this.state.opponentName}!`);
    } else {
      this.state.phase = "action_selection";
      this.state.actionKind = undefined;
      this.state.qteChallenge = undefined;
      this.state.qteSequence = undefined;
    }

    return { success: true };
  }

  private handleStartOpponentTurn(): CombatExecuteResult {
    if (!this.state || this.state.phase !== "opponent_turn_transition") {
      return { success: false };
    }

    const playerStats = this.context.getPlayerStats();
    const opponentStats = this.state.opponentStats;

    this.state.phase = "enemy_qte";
    const challenge = createQteChallenge({
      actor: opponentStats,
      opponent: playerStats,
      kind: "physical",
      isPlayerActor: false,
    });
    this.state.qteChallenge = challenge;
    this.state.qteSequence = generateQteSequence(challenge.sequenceLength);

    return { success: true };
  }

  private handleConcludeCombat(): CombatExecuteResult {
    if (!this.state) {
      return { success: false };
    }

    if (this.state.phase === "victory") {
      const effects: CombatEffect[] = [];
      this.context.world.destroyEntity(this.state.opponentId);

      const enemyDef = getEnemyDef(this.state.opponentNpcId);
      for (const lootEntry of enemyDef?.loot ?? []) {
        effects.push(
          this.collectCombatLoot(lootEntry.itemId, lootEntry.quantity),
        );
      }

      this.state = undefined;
      return { success: true, effects };
    }

    if (this.state.phase === "defeat") {
      this.context.recoverPlayerFromDefeat();
      this.state = undefined;
      return { success: true };
    }

    return { success: false };
  }

  private collectCombatLoot(itemId: string, quantity: number): CombatEffect {
    const inventory = this.context.getPlayerInventory();
    const existing = inventory.items.find((item) => item.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      inventory.items.push({ itemId, quantity });
    }

    const itemDef = getItemDef(itemId);
    this.context.addLog(
      `Collected ${itemDef.name}${quantity > 1 ? ` x${quantity}` : ""}.`,
    );

    return {
      type: "ItemCollected",
      itemId,
      quantity,
      source: "reward",
    };
  }

  private findNpcEntity(npcId: string): EntityId | undefined {
    for (const entityId of this.context.world.entitiesWith("Npc")) {
      const npc = this.context.world.getComponent<Npc>(entityId, "Npc")!;
      if (npc.npcId === npcId) {
        return entityId;
      }
    }

    return undefined;
  }
}

export function isCombatNpc(npcId: string): boolean {
  return isCombatEnemy(npcId);
}

function generateQteSequence(length: number): string[] {
  const directions = ["up", "down", "left", "right"];
  const sequence: string[] = [];
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * directions.length);
    sequence.push(directions[index]);
  }
  return sequence;
}
