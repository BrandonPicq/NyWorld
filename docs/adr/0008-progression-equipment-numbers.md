# ADR 0008 - Nombres de progression et d'equipement

## Statut

Proposee le 2026-07-07. En attente d'approbation explicite avant
implementation.

## Contexte

Le modele RPG du prochain jalon est deja tranche :

- progression hybride : niveau global par XP, plus competences qui montent par
  usage ;
- XP gagnee par combats, quetes, et activites de vie quotidienne ;
- croissance automatique a chaque niveau, avec un choix d'attribut regulier ;
- 8 emplacements d'equipement : arme, main secondaire, tete, corps, mains,
  pieds, accessoire 1, accessoire 2 ;
- 4 archetypes d'arme des maintenant en donnees : `sword`, `hammer`, `bow`,
  `staff` ;
- acquisition par butin ennemi, recompenses de quetes, et objets au sol.

Cette ADR ne rouvre pas ces decisions. Elle propose uniquement les nombres de
depart pour que les slices suivantes aient une cible coherente avec le combat
actuel.

## Proposition de courbe d'XP

Le joueur commence niveau 1 avec 0 XP.

XP requise pour passer du niveau courant au suivant :

```text
xpToNext(level) = 100 + (level - 1) * 50 + (level - 1)^2 * 10
```

Table de controle :

| Niveau courant | XP vers niveau suivant |
| --- | ---: |
| 1 | 100 |
| 2 | 160 |
| 3 | 240 |
| 4 | 340 |
| 5 | 460 |
| 6 | 600 |
| 7 | 760 |
| 8 | 940 |
| 9 | 1140 |
| 10 | 1360 |

Intention : une premiere quete de combat tutoriel peut presque ou exactement
donner le niveau 2, puis les niveaux suivants demandent plusieurs actions de
jeu melangees. La courbe reste lisible et authorable dans `game.json`.

## Croissance automatique par niveau

Chaque passage de niveau applique une ligne authorable de croissance
automatique. Proposition initiale : cycle de 4 niveaux, repete tant qu'aucune
ligne specifique n'est authorisee plus loin.

| Niveau atteint dans le cycle | Croissance automatique |
| --- | --- |
| 2, 6, 10, ... | `strength +1`, `vitality +1`, `willpower +1` |
| 3, 7, 11, ... | `intelligence +1`, `spirit +1`, `perception +1` |
| 4, 8, 12, ... | `agility +1`, `vitality +1`, `charisma +1` |
| 5, 9, 13, ... | `strength +1`, `intelligence +1`, `willpower +1` |

Ces bonus sont des augmentations des attributs de base. Les ressources et stats
de combat derivees continuent d'etre recalculees par le moteur, pas par React
ni par les fichiers de contenu.

## Choix d'attribut

Tous les 3 niveaux atteints (`3`, `6`, `9`, ...), le joueur recoit un choix
persistant :

```text
attributeChoiceInterval = 3
attributeChoiceAmount = 1
```

Le choix ajoute `+1` a un attribut de base au choix du joueur. Les perks restent
hors scope de ce jalon.

## Competences par usage

Chaque competence garde un compteur d'usage. Quand le compteur atteint son
seuil, la competence gagne `+1` et le compteur de cette competence revient a 0.

Seuils proposes :

| Competence | Usage comptabilise | Usages pour +1 |
| --- | --- | ---: |
| `melee` | action Strike resolue | 10 |
| `ranged` | attaque d'arc future resolue | 10 |
| `guard` | action Guard resolue | 8 |
| `evasion` | defense QTE reussie ou tentative Flee resolue | 8 |
| `spellcasting` | action Cast resolue | 8 |
| `focus` | action Focus resolue | 8 |
| `athletics` | deplacements sur la grille | 40 |
| `scholarship` | commande Study resolue | 4 |
| `speech` | interaction sociale/quete significative future | 6 |

Regle explicite : la bizarrerie actuelle de Study reste intacte. La ligne
existante qui ajoute `academicProgressGain` a `skills.scholarship` n'est pas
remplacee par ce compteur ; le compteur d'usage s'ajoute autour de ce
comportement existant.

## Ranges d'equipement

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
  attributs ou competences selon l'identite de l'objet.
- `accessory` : bonus flexible, mais plus petit qu'une arme ou une armure de
  meme tier.

Les bonus peuvent toucher `maxHp`, `maxMp`, `maxSp` ou `maxEnergy`, mais jamais
les valeurs courantes `hp`, `mp`, `sp` ou `energy`. Equiper un objet peut donc
augmenter un maximum ; le moteur garde ou clamp la valeur courante.

## XP par source

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

Avec ces valeurs, `slay_the_slime` + le Slime donne 100 XP, soit le niveau 2.
Le Kobold et sa quete font avancer fortement le joueur, sans rendre chaque
combat ordinaire equivalent a une quete.

## Consequences

Avantages :

- les premieres heures donnent des retours visibles sans noyer le joueur sous
  les niveaux ;
- les quetes restent la source principale d'XP structuree ;
- les combats donnent une progression utile mais pas suffisante seuls ;
- Study et Rest participent a la progression sans remplacer les objectifs ;
- l'equipement de depart peut etre visible sans casser les cibles de combat.

Risques a surveiller pendant le playtest :

- Study donne deja beaucoup de `scholarship` via la bizarrerie preservee ;
- Rest avec XP peut devenir farmable si le cout en temps n'est pas assez
  important ;
- les bonus d'arme tier 2+ peuvent raccourcir fortement les combats actuels ;
- les bonus de ressources max doivent etre affiches clairement pour eviter la
  confusion avec les valeurs courantes.
