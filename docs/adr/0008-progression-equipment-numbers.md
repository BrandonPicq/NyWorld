# ADR 0008 - Nombres du modele RPG en couches

## Statut

Proposee le 2026-07-07. En attente d'approbation explicite avant
implementation.

Cette ADR remplace la proposition initiale de slice 34. La version precedente
n'a jamais ete acceptee ; le fichier est conserve pour garder le numero d'ADR.

## Contexte

Le modele du jalon RPG foundations est maintenant tranche : les stats
effectives sont derivees en couches et doivent rester recomputables sans rejouer
l'historique des niveaux.

```text
effective = base de nouvelle partie
          + gains du niveau global
          + gains de la classe active
          avec multiplicateurs raciaux et buffers fractionnaires
          + bonus d'equipement
```

Decisions de modele deja acceptees :

- le niveau global represente l'experience du monde et donne des gains
  generiques permanents ;
- chaque classe possede sa progression `classId -> { level, xp }`, restauree
  quand le joueur revient a cette classe ;
- ce jalon introduit seulement la classe `otherworlder`, pre-academie, faible
  mais generale ;
- les races appliquent de petits multiplicateurs de croissance avec des buffers
  fractionnaires persistants ;
- `CharacterSkills` est gele : les valeurs de depart continuent d'alimenter les
  formules actuelles, mais ce jalon ne les augmente pas ;
- l'usage alimente uniquement la maitrise des commandes, pas les stats ;
- l'equipement a 8 slots et est limite par les permissions de classe ;
- Study est limite aux environnements d'etude, mais la bizarrerie actuelle qui
  ajoute `academicProgressGain` a `skills.scholarship` reste byte-identique.

Cette ADR propose uniquement les nombres de depart.

## Courbes XP dual-track

Chaque gain d'XP alimente par defaut les deux pistes en meme temps :

```text
globalXp += award
activeClass.xp += award
```

Il n'y a pas de ratio de split dans ce jalon. Les deux pistes ont chacune leur
propre niveau et leur propre seuil.

Courbe globale, reprise de la proposition v1 :

```text
globalXpToNext(level) = 100 + (level - 1) * 50 + (level - 1)^2 * 10
```

Courbe de classe proposee, meme forme mais plus rapide pour que la classe
active se sente vivante :

```text
classXpToNext(level) = 80 + (level - 1) * 40 + (level - 1)^2 * 8
```

Table de controle :

| Niveau courant | Global XP suivante | Classe XP suivante |
| --- | ---: | ---: |
| 1 | 100 | 80 |
| 2 | 160 | 128 |
| 3 | 240 | 192 |
| 4 | 340 | 272 |
| 5 | 460 | 368 |
| 6 | 600 | 480 |
| 7 | 760 | 608 |
| 8 | 940 | 752 |
| 9 | 1140 | 912 |
| 10 | 1360 | 1088 |

Intention : `slay_the_slime` + Slime donne le niveau global 2 et le niveau de
classe 2, puis les courbes se separent doucement.

## Gains globaux par niveau

Chaque niveau global atteint donne des gains fixes, generiques, jamais perdus.
Proposition : cycle de 4 niveaux, repete au-dela du niveau 5.

| Niveau global atteint dans le cycle | Gains globaux |
| --- | --- |
| 2, 6, 10, ... | `vitality +1`, `willpower +1` |
| 3, 7, 11, ... | `perception +1`, `charisma +1` |
| 4, 8, 12, ... | `agility +1`, `spirit +1` |
| 5, 9, 13, ... | `strength +1`, `intelligence +1` |

Le choix d'attribut est conserve :

```text
attributeChoiceInterval = 3
attributeChoiceAmount = 1
```

Aux niveaux globaux `3`, `6`, `9`, etc., le joueur gagne un choix persistant
`+1` sur un attribut de base. Ce choix n'est pas multiplie par la race.

## Classe `otherworlder`

`otherworlder` est la classe generique de depart : elle autorise tout, mais
progresse moins fortement qu'une future classe specialisee.

Permissions d'equipement :

```text
allowedWeaponTypes = ["sword", "hammer", "bow", "staff"]
allowedArmorSlots = ["offHand", "head", "body", "hands", "feet", "accessory"]
```

Croissance de classe proposee :

| Niveau de classe atteint dans le cycle | Gains `otherworlder` |
| --- | --- |
| 2, 6, 10, ... | `strength +1` |
| 3, 7, 11, ... | `intelligence +1` |
| 4, 8, 12, ... | `agility +1` |
| 5, 9, 13, ... | `vitality +1`, `spirit +1` |

Intention : la classe donne un peu de tout, sans depasser une future classe
d'academie specialisee.

## Races et buffers fractionnaires

Races initiales et multiplicateurs proposes :

| Race | Multiplicateurs de croissance |
| --- | --- |
| `human` | tous les attributs `1.00` |
| `elf` | `agility 1.15`, `intelligence 1.10`, `spirit 1.10`, `vitality 0.95` |
| `dwarf` | `vitality 1.15`, `willpower 1.10`, `strength 1.10`, `agility 0.95` |
| `orc` | `strength 1.20`, `vitality 1.10`, `spirit 0.95`, `charisma 0.95` |

Les multiplicateurs s'appliquent aux gains de niveau global et de classe, pas a
la base de nouvelle partie, pas au choix d'attribut, et pas a l'equipement.

Mecanique proposee pour chaque gain :

1. Lire le gain entier authorise pour un attribut, par exemple `strength +1`.
2. Calculer `scaled = gain * raceMultiplier`.
3. Ajouter `floor(scaled)` a l'attribut derive.
4. Ajouter `scaled - floor(scaled)` au buffer fractionnaire persistant de cet
   attribut.
5. Tant que le buffer est `>= 1.0`, ajouter `+1` a l'attribut derive et retirer
   `1.0` du buffer.

Les buffers sont persistants par personnage, par stat, et par couche de
progression (`global` ou `classId`). Ainsi, un futur changement de classe pourra
retirer la couche de classe active sans perdre le buffer de cette classe ; la
reconstruction des stats n'a pas besoin de rejouer l'historique complet.

## Maitrise des commandes

La maitrise est separee des stats. Chaque commande a un niveau, un compteur
d'usage, un cap authorise, des effets numeriques par niveau, et un champ reserve
pour des variantes QTE futures.

Effets proposes :

| Commande | Cap | Usage pour +1 | Effet par niveau de maitrise |
| --- | ---: | ---: | --- |
| Strike | 5 | 12 actions resolues | `damageBoost +0.03` |
| Guard | 5 | 10 actions resolues | `incomingDamageMultiplier -0.02` |
| Cast | 5 | 10 actions resolues | `damageBoost +0.03`, `mpCost -1` aux niveaux 3 et 5 |
| Focus | 5 | 10 actions resolues | `nextDamageBoost +0.05` |
| Flee | 3 | 5 fuites reussies | `successChance +0.05` |
| Use Item | 3 | 8 objets utilises en combat | `itemEffectMultiplier +0.05` |
| Study | 5 | 4 Study resolus | `academicProgressGain +1` |
| Rest | 3 | 6 Rest resolus | `energyRestore +2` |

Regles :

- Flee ne compte que les fuites reussies.
- Les effets de maitrise modifient les commandes, pas les attributs ni
  `CharacterSkills`.
- Les formules de combat basees sur `skills.melee`, `skills.guard`,
  `skills.spellcasting`, etc. restent inchangees dans ce jalon.
- Le champ reserve d'un effet de maitrise peut lister de futurs unlocks QTE,
  mais reste vide dans le contenu de depart.

## Study gate

Study n'est plus une action spammable n'importe ou. Elle requiert un
environnement d'etude, propose comme une propriete authorisee de tuile
`studySpot`.

Nombres proposes :

```text
study.energyCost = 10
study.timeCostMinutes = 120
study.academicProgressGain = 15
study.intelligenceGain = 1
study.xp = 10
```

La ligne existante qui ajoute `academicProgressGain` a `skills.scholarship`
reste byte-identique. La limitation par `studySpot` et le cout en temps plus
fort encadrent l'action sans changer cette bizarrerie.

Rest garde un gain XP minuscule :

```text
rest.energyRestore = 15
rest.xp = 2
```

## Ranges d'equipement conserves

Les objets d'equipement etendent `ItemDef` avec `category: "equipment"` et un
bloc `equipment`. Les deux emplacements d'accessoire acceptent les memes objets
de slot `accessory`.

Tiers proposes pour le premier contenu :

| Tier | Role | Bonus d'arme | Bonus armure/off-hand | Bonus accessoire |
| --- | --- | ---: | ---: | ---: |
| 0 | entrainement / depart | +1 a +2 | +1 a +2 | +1 attribut ou +5 ressource max |
| 1 | commun | +3 a +4 | +2 a +3 | +1 a +2 attribut ou +10 ressource max |
| 2 | solide | +5 a +7 | +4 a +5 | +2 a +3 attribut ou +15 ressource max |
| 3 | fin / rare tot | +8 a +10 | +6 a +8 | +3 a +4 attribut ou +20 ressource max |

Details par slot :

- `weapon` : bonus principal sur `combat.attack` ou `combat.magicAttack`,
  selon le type d'arme ; un seul `weaponType` parmi `sword`, `hammer`, `bow`,
  `staff`.
- `offHand` : bouclier ou focus. Bouclier = defense physique ; focus =
  defense magique, magie ou ressources. Le dual-wield n'est pas dans le scope.
- `head`, `body`, `hands`, `feet` : petits bonus de defense, ressources max,
  attributs ou valeurs de maitrise selon l'identite de l'objet.
- `accessory` : bonus flexible, mais plus petit qu'une arme ou une armure de
  meme tier.

Les bonus peuvent toucher `maxHp`, `maxMp`, `maxSp` ou `maxEnergy`, mais jamais
les valeurs courantes `hp`, `mp`, `sp` ou `energy`. Equiper un objet peut donc
augmenter un maximum ; le moteur garde ou clamp la valeur courante.

## XP par source conservee

Ballparks proposes pour le contenu initial :

| Source | XP proposee |
| --- | ---: |
| Slime, ennemi tutoriel | 25 |
| Goblin, menace mineure | 40 |
| Kobold, premiere vraie menace | 80 |
| Ennemi tutoriel generique | 20 a 30 |
| Ennemi mineur | 35 a 50 |
| Premiere vraie menace | 70 a 90 |
| Elite tot / mini-boss | 120 a 160 |
| Petite quete d'exploration | 60 a 90 |
| Quete tutorielle de combat | 70 a 90 |
| Quete multi-etapes | 120 a 180 |
| Quete de chapitre | 250 a 350 |
| Study | 10 |
| Rest | 2 |

Application conseillee aux quetes existantes :

| Quete | XP proposee |
| --- | ---: |
| `lost_notebook` | 75 |
| `slay_the_slime` | 75 |
| `advanced_quest` | 125 |
| `defeat_the_kobold` | 180 |

Avec ces valeurs, `slay_the_slime` + le Slime donne 100 XP, soit le niveau
global 2, et assez pour que la classe active atteigne aussi son niveau 2.

## Consequences

Avantages :

- la progression mondiale, la classe active, la race et l'equipement restent
  lisibles comme des couches separees ;
- changer de classe plus tard peut retirer la couche de classe sans supprimer
  les gains globaux ;
- les races donnent une identite douce sans enfermer le joueur ;
- la maitrise recompense l'usage des commandes sans toucher les anciennes
  formules de `CharacterSkills` ;
- le premier contenu peut utiliser toutes les armes via `otherworlder`, puis
  l'academie pourra restreindre les futures classes.

Risques a surveiller pendant le playtest :

- deux pistes XP en parallele peuvent produire deux level-ups sur un meme
  evenement ; l'UI devra l'expliquer sobrement ;
- les buffers raciaux persistants ajoutent de la complexite de sauvegarde ;
- Study donne toujours beaucoup de `scholarship` via la bizarrerie preservee ;
- les bonus d'arme tier 2+ peuvent raccourcir fortement les combats actuels ;
- les permissions d'equipement doivent afficher clairement pourquoi un objet
  est refuse.
