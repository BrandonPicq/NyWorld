import type { CombatActionCommand, GameCommand } from "../commands";
import type { Inventory, Npc, Stats } from "../components";
import type { World } from "../ecs/World";
import type { EntityId } from "../ecs/types";
import { getEnemyDef, isCombatEnemy } from "../enemies/enemyRegistry";
import { getItemDef } from "../items/itemRegistry";
import { createNpcStats } from "../stats/npcStats";
import { cloneStats } from "../stats/characterStats";
import { getCombatActionDef } from "./combatActionRegistry";
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

/**
 * UI-facing state of the active combat encounter.
 *
 * Exposed through GameSnapshot.combatState while a fight is running; the
 * combat panel renders phases, meters, and the QTE race from this shape.
 */
export interface CombatState {
  opponentId: EntityId;
  opponentNpcId: string;
  opponentName: string;
  /** Detached copy of the opponent's live stats. */
  opponentStats: Stats;
  phase: CombatPhase;
  /** Damage school of the pending action while a QTE is running. */
  actionKind?: CombatActionKind;
  /** Menu label of the pending action, for the combat log and panel. */
  actionLabel?: string;
  /** True while Guard reduces the next incoming enemy attack. */
  isGuarding?: boolean;
  /** Focus multiplier applied to the next damaging player action. */
  damageBoostMultiplier?: number;
  qteChallenge?: QteChallenge;
  /** Ordered arrow-key sequence the player must type for the active QTE. */
  qteSequence?: string[];
}

export type CombatEffect =
  | {
      type: "ItemCollected";
      itemId: string;
      quantity: number;
      source?: "reward";
    }
  | {
      type: "ItemUsed";
      itemId: string;
      hpRestored?: number;
      energyRestored?: number;
    }
  | {
      type: "ItemUseRejected";
      itemId: string;
      reason: "energy_full" | "no_effect";
      message: string;
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
  awardXp: (amount: number, source: string) => void;
  recoverPlayerFromDefeat: () => void;
  random?: () => number;
}

/**
 * Combat tuning resolved from authored combat action content, with code
 * defaults preserving the original balance when a tuning field is omitted.
 */
function resolveActionTuning() {
  return {
    strikeSpGain: getCombatActionDef("strike").tuning?.spGain ?? 5,
    guardSpGain: getCombatActionDef("guard").tuning?.spGain ?? 10,
    focusSpGain: getCombatActionDef("focus").tuning?.spGain ?? 5,
    castMpCost: getCombatActionDef("cast").tuning?.mpCost ?? 10,
    focusDamageMultiplier:
      getCombatActionDef("focus").tuning?.damageBoostMultiplier ?? 1.5,
    guardDamageMultiplier:
      getCombatActionDef("guard").tuning?.incomingDamageMultiplier ?? 0.5,
  };
}

const ACTION_TUNING = resolveActionTuning();

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
    if (command.type === "UseItem") {
      return this.handleUseItem(command.itemId);
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
    actionKind: CombatActionCommand,
  ): CombatExecuteResult {
    if (!this.state || this.state.phase !== "action_selection") {
      return { success: false };
    }

    if (!isCombatActionCommand(actionKind)) {
      this.context.addLog("Unknown combat action.");
      return { success: false };
    }

    const playerStats = this.context.getPlayerStats();
    const opponentStats = this.state.opponentStats;

    if (actionKind === "flee") {
      return this.handleFleeAttempt(playerStats, opponentStats);
    }

    if (actionKind === "guard") {
      const spGained = gainSp(playerStats, ACTION_TUNING.guardSpGain);
      this.state.isGuarding = true;
      this.state.phase = "opponent_turn_transition";
      this.state.actionKind = undefined;
      this.state.actionLabel = undefined;
      this.state.qteChallenge = undefined;
      this.state.qteSequence = undefined;
      this.context.addLog(
        `You guard and brace for the next attack${formatSpGain(spGained)}.`,
      );
      return { success: true };
    }

    if (actionKind === "focus") {
      const spGained = gainSp(playerStats, ACTION_TUNING.focusSpGain);
      this.state.damageBoostMultiplier = ACTION_TUNING.focusDamageMultiplier;
      this.state.phase = "opponent_turn_transition";
      this.state.actionKind = undefined;
      this.state.actionLabel = undefined;
      this.state.qteChallenge = undefined;
      this.state.qteSequence = undefined;
      this.context.addLog(
        `You focus your next attack${formatSpGain(spGained)}.`,
      );
      return { success: true };
    }

    if (
      actionKind === "cast" &&
      playerStats.resources.mp < ACTION_TUNING.castMpCost
    ) {
      this.context.addLog("Not enough MP to cast.");
      return { success: false };
    }

    if (actionKind === "strike") {
      gainSp(playerStats, ACTION_TUNING.strikeSpGain);
    } else {
      playerStats.resources.mp = Math.max(
        0,
        playerStats.resources.mp - ACTION_TUNING.castMpCost,
      );
    }

    const qteActionKind = getQteActionKind(actionKind);
    this.state.actionKind = qteActionKind;
    this.state.actionLabel = getCombatActionLabel(actionKind);
    this.state.phase = "player_qte";

    const challenge = createQteChallenge({
      actor: playerStats,
      opponent: opponentStats,
      kind: qteActionKind,
      isPlayerActor: true,
    });

    this.state.qteChallenge = challenge;
    this.state.qteSequence = generateQteSequence(
      challenge.sequenceLength,
      () => this.random(),
    );

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
    const success = this.random() < fleeChance;
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

  private handleUseItem(itemId: string): CombatExecuteResult {
    if (!this.state || this.state.phase !== "action_selection") {
      return { success: false };
    }

    const inventory = this.context.getPlayerInventory();
    const stackIndex = inventory.items.findIndex(
      (stack) => stack.itemId === itemId,
    );
    if (stackIndex === -1) {
      this.context.addLog("You don't have that item.");
      return { success: false };
    }

    const itemDef = getItemDef(itemId);
    if (itemDef.category !== "consumable") {
      this.context.addLog(`${itemDef.name} cannot be used in combat.`);
      return { success: false };
    }

    const hpRestored = itemDef.effects?.hpRestore;
    if (hpRestored === undefined) {
      const message = `${itemDef.name} has no combat effect yet.`;
      this.context.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "no_effect", message },
        ],
      };
    }

    const playerStats = this.context.getPlayerStats();
    if (playerStats.resources.hp >= playerStats.resources.maxHp) {
      const message = `${itemDef.name} would have no effect right now.`;
      this.context.addLog(message);
      return {
        success: false,
        effects: [
          { type: "ItemUseRejected", itemId, reason: "no_effect", message },
        ],
      };
    }

    const nextHp = Math.min(
      playerStats.resources.maxHp,
      playerStats.resources.hp + hpRestored,
    );
    const actualHpRestored = nextHp - playerStats.resources.hp;
    playerStats.resources.hp = nextHp;

    const stack = inventory.items[stackIndex];
    stack.quantity -= 1;
    if (stack.quantity <= 0) {
      inventory.items.splice(stackIndex, 1);
    }

    this.state.phase = "opponent_turn_transition";
    this.state.actionKind = undefined;
    this.state.actionLabel = undefined;
    this.state.qteChallenge = undefined;
    this.state.qteSequence = undefined;
    this.context.addLog(`Used ${itemDef.name}. Recovered ${actualHpRestored} HP.`);

    return {
      success: true,
      effects: [{ type: "ItemUsed", itemId, hpRestored: actualHpRestored }],
    };
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
    const actionLabel = this.state.actionLabel ?? getCombatActionLabel(actionKind);
    const damageBoostMultiplier = this.state.damageBoostMultiplier;
    let finalDamage = 0;
    let outcomeLabel = "";
    const mistakeLabel = mistakes === 1 ? " (1 mistake)" : "";

    if (mistakes >= 2) {
      outcomeLabel = "MISS (input failure)";
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
      }
    }

    if (damageBoostMultiplier !== undefined && finalDamage > 0) {
      finalDamage = Math.floor(finalDamage * damageBoostMultiplier);
    }
    this.state.damageBoostMultiplier = undefined;

    finalDamage = applyDamageVariance(finalDamage, () => this.random());
    this.context.addLog(
      `You used ${actionLabel}${mistakeLabel}! Outcome: ${outcomeLabel} (${finalDamage} damage to ${this.state.opponentName}).`,
    );

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
    const wasGuarding = this.state.isGuarding;
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
      }
    }

    finalDamage = applyDamageVariance(finalDamage, () => this.random());
    if (wasGuarding) {
      finalDamage =
        finalDamage > 0
          ? Math.max(
              1,
              Math.floor(finalDamage * ACTION_TUNING.guardDamageMultiplier),
            )
          : 0;
      this.state.isGuarding = false;
    }
    const guardLabel = wasGuarding ? " (guarded)" : "";

    if (mistakes >= 2) {
      this.context.addLog(
        `${this.state.opponentName} landed a crushing blow due to your input failure! Outcome: ${outcomeLabel} (${finalDamage} damage to you${guardLabel}).`,
      );
    } else {
      const mistakeLabel = mistakes === 1 ? " (1 mistake)" : "";
      this.context.addLog(
        `${this.state.opponentName} attacks${mistakeLabel}! Outcome: ${outcomeLabel} (${finalDamage} damage to you${guardLabel}).`,
      );
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
      this.state.actionLabel = undefined;
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
    this.state.qteSequence = generateQteSequence(
      challenge.sequenceLength,
      () => this.random(),
    );

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
      if (enemyDef?.xpReward) {
        this.context.awardXp(
          enemyDef.xpReward,
          `defeating ${this.state.opponentName}`,
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

  private random(): number {
    return this.context.random?.() ?? Math.random();
  }
}

export function isCombatNpc(npcId: string): boolean {
  return isCombatEnemy(npcId);
}

function generateQteSequence(
  length: number,
  random: () => number = Math.random,
): string[] {
  const directions = ["up", "down", "left", "right"];
  const sequence: string[] = [];
  for (let i = 0; i < length; i++) {
    const index = Math.floor(clampRandomRoll(random()) * directions.length);
    sequence.push(directions[index]);
  }
  return sequence;
}

function applyDamageVariance(damage: number, random: () => number): number {
  if (damage <= 0) {
    return 0;
  }

  const minimumDamage = Math.max(1, Math.ceil(damage * 0.75));
  const maximumDamage = Math.max(minimumDamage, Math.floor(damage * 1.25));
  const span = maximumDamage - minimumDamage + 1;

  return minimumDamage + Math.floor(clampRandomRoll(random()) * span);
}

function clampRandomRoll(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.999999999, Math.max(0, value));
}

function isCombatActionCommand(value: string): value is CombatActionCommand {
  return (
    value === "strike" ||
    value === "cast" ||
    value === "guard" ||
    value === "focus" ||
    value === "flee"
  );
}

function getQteActionKind(actionKind: CombatActionCommand): CombatActionKind {
  return actionKind === "cast" ? "magical" : "physical";
}

function getCombatActionLabel(
  actionKind: CombatActionCommand | CombatActionKind,
): string {
  if (actionKind !== "physical" && actionKind !== "magical") {
    return getCombatActionDef(actionKind).name;
  }

  switch (actionKind) {
    case "magical":
      return "magical attack";
    case "physical":
    default:
      return "physical attack";
  }
}

function gainSp(stats: Stats, amount: number): number {
  const previousSp = stats.resources.sp;
  stats.resources.sp = Math.min(
    stats.resources.maxSp,
    stats.resources.sp + amount,
  );
  return stats.resources.sp - previousSp;
}

function formatSpGain(amount: number): string {
  return amount > 0 ? ` and gain ${amount} SP` : "";
}
