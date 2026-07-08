import type { CombatActionCommand, GameCommand } from "../commands";
import type { Inventory, Npc, Stats } from "../components";
import type { World } from "../ecs/World";
import type { EntityId } from "../ecs/types";
import { getEnemyDef, isCombatEnemy } from "../enemies/enemyRegistry";
import { getItemDef } from "../items/itemRegistry";
import { createNpcStats } from "../stats/npcStats";
import { cloneStats } from "../stats/characterStats";
import { getCombatActionDef } from "./combatActionRegistry";
import type { KnownPatternMap, PatternDef } from "./PatternDef";
import {
  createQteChallenge,
  resolveQteContest,
  type CombatActionKind,
  type QteChallenge,
} from "./qteCombat";
import {
  cloneCombatMinigameSpec,
  computeMashTargetPresses,
  computeMasteryDelta,
  computeTimingWindows,
  modulateMashTarget,
  modulateSequenceLength,
  modulateSequenceTimeLimit,
  modulateTimingSweep,
  resolveWeaponMinigameType,
  DEFAULT_VOLLEY_SIZE,
  TIMING_BASE_SWEEP_MS,
  type CombatMinigameSpec,
} from "./combatMinigame";
import type { EquipmentDef } from "../items/ItemDef";
import { canUseCombatPattern } from "./qtePatternCombat";
import { getQtePatternDef } from "./qtePatternRegistry";

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
  /** Original command ID. */
  actionCommand?: CombatActionCommand;
  /** Learned pattern currently being executed, if the pending QTE came from a pattern. */
  activePatternId?: string;
  /** Damage multiplier from the selected learned pattern. */
  patternDamageMultiplier?: number;
  /** True while Guard reduces the next incoming enemy attack. */
  isGuarding?: boolean;
  /** Focus multiplier applied to the next damaging player action. */
  damageBoostMultiplier?: number;
  /**
   * Active minigame the UI must run for the current turn. The engine owns
   * this spec; React renders it and reports the normalized QTE result.
   */
  minigame?: CombatMinigameSpec;
  /**
   * Backward-compatible mirror of the `sequence` minigame, populated in
   * snapshots only. Undefined for non-sequence minigames.
   */
  qteChallenge?: QteChallenge;
  /** Backward-compatible mirror of the `sequence` minigame's input sequence. */
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
  getCommandMasteryLevel: (commandId: string) => number;
  incrementCommandUsage: (commandId: string) => void;
  getKnownPatterns: () => KnownPatternMap;
  incrementPatternUsage: (patternId: string) => void;
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

    const spec = this.state.minigame;
    const raceChallenge =
      spec && spec.kind !== "timing" ? spec.challenge : undefined;
    return {
      ...this.state,
      opponentStats: cloneStats(this.state.opponentStats),
      minigame: spec ? cloneCombatMinigameSpec(spec) : undefined,
      qteChallenge: raceChallenge ? { ...raceChallenge } : undefined,
      qteSequence: spec?.kind === "sequence" ? [...spec.sequence] : undefined,
    };
  }

  execute(command: GameCommand): CombatExecuteResult {
    if (!this.state) {
      return { success: false };
    }

    if (command.type === "SelectCombatAction") {
      return this.handleSelectCombatAction(command.actionKind);
    }
    if (command.type === "SelectCombatPattern") {
      return this.handleSelectCombatPattern(
        command.actionKind,
        command.patternId,
      );
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
      this.state.activePatternId = undefined;
      this.state.patternDamageMultiplier = undefined;
      this.state.minigame = undefined;
      this.context.addLog(
        `You guard and brace for the next attack${formatSpGain(spGained)}.`,
      );
      this.context.incrementCommandUsage("guard");
      return { success: true };
    }

    if (actionKind === "focus") {
      const spGained = gainSp(playerStats, ACTION_TUNING.focusSpGain);
      const focusMastery = this.context.getCommandMasteryLevel("focus");
      const multiplier = (getCombatActionDef("focus").tuning?.damageBoostMultiplier ?? 1.5) + 0.05 * focusMastery;
      this.state.damageBoostMultiplier = multiplier;
      this.state.phase = "opponent_turn_transition";
      this.state.actionKind = undefined;
      this.state.actionLabel = undefined;
      this.state.activePatternId = undefined;
      this.state.patternDamageMultiplier = undefined;
      this.state.minigame = undefined;
      this.context.addLog(
        `You focus your next attack${formatSpGain(spGained)}.`,
      );
      this.context.incrementCommandUsage("focus");
      return { success: true };
    }

    const castMastery = this.context.getCommandMasteryLevel("cast");
    let currentCastMpCost = getCombatActionDef("cast").tuning?.mpCost ?? 10;
    if (castMastery >= 3) currentCastMpCost -= 1;
    if (castMastery >= 5) currentCastMpCost -= 1;

    if (
      actionKind === "cast" &&
      playerStats.resources.mp < currentCastMpCost
    ) {
      this.context.addLog("Not enough MP to cast.");
      return { success: false };
    }

    if (actionKind === "strike") {
      gainSp(playerStats, ACTION_TUNING.strikeSpGain);
    } else {
      playerStats.resources.mp = Math.max(
        0,
        playerStats.resources.mp - currentCastMpCost,
      );
    }

    const qteActionKind = getQteActionKind(actionKind);
    this.state.actionKind = qteActionKind;
    this.state.actionLabel = getCombatActionLabel(actionKind);
    this.state.actionCommand = actionKind;
    this.state.activePatternId = undefined;
    this.state.patternDamageMultiplier = undefined;
    this.state.phase = "player_qte";

    const challenge = createQteChallenge({
      actor: playerStats,
      opponent: opponentStats,
      kind: qteActionKind,
      isPlayerActor: true,
    });

    this.state.minigame = this.buildPlayerMinigame(
      challenge,
      playerStats,
      opponentStats,
    );

    return { success: true };
  }

  private handleSelectCombatPattern(
    actionKind: "strike" | "cast",
    patternId: string,
  ): CombatExecuteResult {
    if (!this.state || this.state.phase !== "action_selection") {
      return { success: false };
    }

    const pattern = getQtePatternDef(patternId);
    if (!pattern) {
      this.context.addLog("Unknown combat pattern.");
      return { success: false };
    }

    const playerStats = this.context.getPlayerStats();
    const inventory = this.context.getPlayerInventory();
    if (
      !canUseCombatPattern({
        actionKind,
        pattern,
        knownPatterns: this.context.getKnownPatterns(),
        inventory,
        playerStats,
      })
    ) {
      this.context.addLog(`${pattern.name} cannot be used right now.`);
      return { success: false };
    }

    playerStats.resources.mp = Math.max(
      0,
      playerStats.resources.mp - pattern.mpCost,
    );

    const opponentStats = this.state.opponentStats;
    const qteActionKind = pattern.kind;
    this.state.actionKind = qteActionKind;
    this.state.actionLabel = pattern.name;
    this.state.actionCommand = actionKind;
    this.state.activePatternId = pattern.patternId;
    this.state.patternDamageMultiplier = pattern.damageMultiplier;
    this.state.phase = "player_qte";

    this.state.minigame = this.buildPatternMinigame(
      pattern,
      playerStats,
      opponentStats,
    );

    this.context.addLog(
      `You prepare ${pattern.name} and spend ${pattern.mpCost} MP.`,
    );
    return { success: true };
  }

  private buildPatternMinigame(
    pattern: PatternDef,
    playerStats: Stats,
    opponentStats: Stats,
  ): CombatMinigameSpec {
    const challenge = createQteChallenge({
      actor: playerStats,
      opponent: opponentStats,
      kind: pattern.kind,
      isPlayerActor: true,
      baseSequenceLength: pattern.inputs.length,
      baseTimeLimitMs: pattern.timeLimitMs,
    });

    return {
      kind: "sequence",
      challenge: {
        ...challenge,
        sequenceLength: pattern.inputs.length,
        playerSequenceLength: pattern.inputs.length,
        timeLimitMs: pattern.timeLimitMs,
      },
      sequence: [...pattern.inputs],
      hidden: true,
    };
  }

  /**
   * Builds the minigame spec for the player's attack from the equipped weapon:
   * an authored override or the archetype default selects the mechanic, while
   * unarmed attacks fall back to the sequence race.
   */
  private buildPlayerMinigame(
    challenge: QteChallenge,
    playerStats: Stats,
    opponentStats: Stats,
  ): CombatMinigameSpec {
    const weaponEquipment = this.getEquippedWeaponEquipment();
    const mechanic = resolveWeaponMinigameType(weaponEquipment);
    const delta = this.computeWeaponMasteryDelta(weaponEquipment);

    if (mechanic === "mash") {
      const speedAdvantage = challenge.actorSpeed - challenge.opponentSpeed;
      const baseTarget = computeMashTargetPresses(speedAdvantage);
      return {
        kind: "mash",
        challenge,
        arrow: generateQteSequence(1, () => this.random())[0],
        targetPresses: modulateMashTarget(baseTarget, delta),
      };
    }

    if (mechanic === "timing") {
      const agilityGap =
        playerStats.attributes.agility - opponentStats.attributes.agility;
      const { greatWindow, criticalWindow } = computeTimingWindows(agilityGap);
      return {
        kind: "timing",
        volleySize: weaponEquipment?.volleySize ?? DEFAULT_VOLLEY_SIZE,
        sweepMs: modulateTimingSweep(TIMING_BASE_SWEEP_MS, delta),
        greatWindow,
        criticalWindow,
      };
    }

    const sequenceLength = modulateSequenceLength(challenge.sequenceLength, delta);
    const modulatedChallenge: QteChallenge = {
      ...challenge,
      sequenceLength,
      playerSequenceLength: sequenceLength,
      timeLimitMs: modulateSequenceTimeLimit(challenge.timeLimitMs, delta),
    };
    return {
      kind: "sequence",
      challenge: modulatedChallenge,
      sequence: generateQteSequence(sequenceLength, () => this.random()),
    };
  }

  private getEquippedWeaponEquipment(): EquipmentDef | undefined {
    const weaponId = this.context.getPlayerInventory().equipped.weapon;
    if (!weaponId) {
      return undefined;
    }
    return getItemDef(weaponId).equipment;
  }

  /**
   * Mastery delta for the equipped weapon: 0 when unarmed or non-weapon (no
   * modulation), otherwise the wielder's `weapon_<type>` mastery level over the
   * weapon's soft recommended level, clamped to -3..+3.
   */
  private computeWeaponMasteryDelta(
    weaponEquipment: EquipmentDef | undefined,
  ): number {
    const weaponType = weaponEquipment?.weaponType;
    if (!weaponType) {
      return 0;
    }
    const level = this.context.getCommandMasteryLevel(`weapon_${weaponType}`);
    const recommended = weaponEquipment?.recommendedMasteryLevel ?? 0;
    return computeMasteryDelta(level, recommended);
  }

  private handleFleeAttempt(
    playerStats: Stats,
    opponentStats: Stats,
  ): CombatExecuteResult {
    if (!this.state) {
      return { success: false };
    }

    const baseFleeChance = Math.max(
      0.1,
      Math.min(
        0.9,
        0.5 +
          (playerStats.attributes.agility -
            opponentStats.attributes.agility) *
            0.05,
      ),
    );
    const fleeMastery = this.context.getCommandMasteryLevel("flee");
    const fleeChance = baseFleeChance + 0.05 * fleeMastery;
    const success = this.random() < fleeChance;
    if (success) {
      this.context.addLog("You successfully fled from the combat!");
      this.context.incrementCommandUsage("flee");
      this.state = undefined;
      return { success: true };
    }

    this.context.addLog("Flee attempt failed! The enemy attacks!");
    this.state.phase = "opponent_turn_transition";
    this.state.minigame = undefined;
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

    const itemMastery = this.context.getCommandMasteryLevel("use_item");
    const multiplier = 1 + 0.05 * itemMastery;
    const finalHpRestored = Math.floor(hpRestored * multiplier);

    const nextHp = Math.min(
      playerStats.resources.maxHp,
      playerStats.resources.hp + finalHpRestored,
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
    this.state.activePatternId = undefined;
    this.state.patternDamageMultiplier = undefined;
    this.state.minigame = undefined;
    this.context.addLog(`Used ${itemDef.name}. Recovered ${actualHpRestored} HP.`);
    this.context.incrementCommandUsage("use_item");

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
    const activePatternId = this.state.activePatternId;
    const patternDamageMultiplier = this.state.patternDamageMultiplier;
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

      const cmd = this.state.actionCommand;
      if ((cmd === "strike" || cmd === "cast") && !activePatternId) {
        const mastery = this.context.getCommandMasteryLevel(cmd);
        if (mastery > 0) {
          finalDamage = Math.floor(finalDamage * (1 + 0.03 * mastery));
        }
      }
    }

    if (patternDamageMultiplier !== undefined && finalDamage > 0) {
      finalDamage = Math.floor(finalDamage * patternDamageMultiplier);
    }

    if (damageBoostMultiplier !== undefined && finalDamage > 0) {
      finalDamage = Math.floor(finalDamage * damageBoostMultiplier);
    }
    this.state.damageBoostMultiplier = undefined;
    this.state.patternDamageMultiplier = undefined;

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
      this.state.minigame = undefined;
    }

    const finalCmd = this.state.actionCommand;
    if (finalCmd === "strike" || finalCmd === "cast") {
      this.context.incrementCommandUsage(finalCmd);
      if (activePatternId) {
        this.context.incrementPatternUsage(activePatternId);
        this.state.activePatternId = undefined;
      }
      const weaponType = this.getEquippedWeaponEquipment()?.weaponType;
      if (weaponType) {
        this.context.incrementCommandUsage(`weapon_${weaponType}`);
      }
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
      const guardMastery = this.context.getCommandMasteryLevel("guard");
      const multiplier = (getCombatActionDef("guard").tuning?.incomingDamageMultiplier ?? 0.5) - 0.02 * guardMastery;
      finalDamage =
        finalDamage > 0
          ? Math.max(
              1,
              Math.floor(finalDamage * multiplier),
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
      this.state.minigame = undefined;
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
    this.state.minigame = {
      kind: "sequence",
      challenge,
      sequence: generateQteSequence(challenge.sequenceLength, () =>
        this.random(),
      ),
    };

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
