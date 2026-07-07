# Combat Balance V1

This document defines early combat balance guardrails for authoring enemies and
checking QTE combat changes. These are design targets, not final formulas.

## Goals

- Keep tutorial fights short enough to teach combat without exhausting the
  player.
- Make early threats dangerous through QTE pressure and damage spikes, not
  through long low-damage exchanges.
- Let excellent QTE execution matter even against stronger defenses.
- Keep defense useful without turning equal-stat fights into repeated 1 damage
  hits.

## Stat Roles

- HP mostly controls fight length.
- ATK and MAG ATK control how threatening an actor is when a hit lands.
- DEF and MAG DEF reduce damage and reward defensive builds, but should not
  become a hard wall at equal stats.
- Agility controls physical QTE pressure.
- Spirit controls magical QTE pressure.
- Skills and equipment should feed derived combat values instead of making
  content files or React components calculate combat math directly.

## QTE Profiles

- Poor performance means the attacker fails the sequence or falls behind.
- Average performance means the attacker completes the sequence with a small
  lead of about 1 to 2 inputs.
- Strong performance means the attacker completes the sequence with a lead of
  about 5 inputs and earns a critical result.

## Early Enemy Targets

- Tutorial enemy: usually 2 to 4 successful player attacks.
- First real threat: usually 4 to 7 strong player attacks.
- Later dangerous enemy: usually 6 to 10 strong player attacks unless the fight
  has a special mechanic.

For current content, Slime is the tutorial enemy, Goblin is the intermediate
step, and Kobold is the first real threat. The Goblin should last longer than
the Slime without becoming a duel, while the Kobold is a fast physical duelist:
lower HP and defense than a defender, but enough attack and Agility to punish
weak defense QTEs.

Real combat applies a final damage variance after QTE and mistake modifiers.
Rolled damage should stay between 75% and 125% of the calculated damage, rounded
to a valid integer damage value.

## Combat Actions

- Strike is the basic physical action and grants 5 SP when selected.
- Cast is the basic magical action and costs 10 MP before the QTE starts.
- Guard consumes the player action, grants 10 SP, and reduces the next enemy
  attack.
- Focus consumes the player action, grants 5 SP, and boosts the next damaging
  player action by 1.5x.
- Combat item use consumes the player action when the item has an effect.
- Flee remains an agility-based escape attempt.

## Authoring Notes

- Avoid combining high HP and high DEF on early enemies.
- Prefer one clear strength per enemy archetype, such as fragile fast, slow
  solid, glass cannon, or defender.
- If a fight feels long, lower HP before lowering DEF. If it feels impossible
  after good QTE performance, lower DEF or speed pressure.
- If an enemy is meant to be scary, raise attack or QTE pressure before adding
  more HP.

## Progression and Equipment Draft Targets

The first RPG-foundation pass should keep early combat balanced around the
current QTE ladder while making level, skill, and equipment growth visible.

- XP to the next level should start at 100 XP for level 1 and grow with
  `100 + (level - 1) * 50 + (level - 1)^2 * 10`.
- Slime + its tutorial quest should total about 100 XP, enough to reach level 2.
- Early enemy XP targets: Slime 25, Goblin 40, Kobold 80.
- Early quest XP targets: small exploration or tutorial quests 60 to 90 XP,
  multi-step quests 120 to 180 XP, chapter-scale quests 250 to 350 XP.
- Study should grant about 10 XP and Rest about 2 XP; Rest XP is intentionally
  tiny so resting does not replace goals.
- Automatic level growth should add about 3 base attribute points per level,
  distributed across different attributes rather than stacked into one combat
  stat.
- Attribute-choice milestones should happen every 3 levels and grant +1 to one
  chosen base attribute.
- Skill-by-use thresholds should stay in the 8 to 10 use range for combat
  skills, 40 movement steps for Athletics, 4 Study actions for Scholarship, and
  6 significant social interactions for Speech.
- Equipment bonuses are flat effective-stat bonuses. Early starter equipment
  should stay in tier 0 ranges: weapons +1 to +2, armor or off-hand +1 to +2,
  accessories +1 attribute or +5 max resource.
- Tier 1 equipment should usually stay at weapons +3 to +4, armor/off-hand +2
  to +3, and accessories +1 to +2 attributes or +10 max resource.
- Equipment may raise max HP, MP, SP, or Energy, but should not directly grant
  current HP, MP, SP, or Energy.
