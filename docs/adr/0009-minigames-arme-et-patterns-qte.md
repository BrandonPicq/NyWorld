# ADR 0009 - Minigames d'arme et patterns QTE appris

## Statut

Acceptee le 2026-07-08. Les decisions de structure ont ete prises avec
l'utilisateur en session de design (quatre vagues de questions, 2026-07-08)
et les chiffres proposes ont ete approuves tels quels le meme jour ; ils
seront retouches a la passe d'equilibrage (slice 56) sur la base de vrais
playtests.

## Contexte

Le combat actuel n'a qu'une seule mecanique : une course de sequence de
fleches generee par `CombatSystem` quel que soit l'equipement, resolue par
`resolveQteContest` a partir de `{completed, inputAdvantage, mistakes}`.
L'arme equipee ne change rien au ressenti. Le chapitre 8 veut : un minigame
par archetype d'arme, des maitrises d'arme qui modulent ces minigames, et
des patterns QTE appris et memorises (fireball...).

Etat des lieux utile :

- les quatre archetypes (`sword`, `hammer`, `bow`, `staff`) existent deja en
  items tier-0 ;
- le SP s'accumule (Strike/Guard/Focus) mais rien ne le depense ;
- le champ `unlocks` des command-masteries est reserve et jamais consomme ;
- les effets de mastery cote combat n'ont jamais ete exerces au runtime.

## Decisions de structure (tranchees avec l'utilisateur)

1. **Contrat de normalisation** : chaque minigame produit `{completed,
   inputAdvantage, mistakes}` ; `resolveQteContest` reste l'unique autorite
   de degats. Les minigames varient le defi d'input, jamais la formule.
2. **Mapping archetype -> mecanique** : epee = course de sequence
   (l'actuelle) ; marteau = mash d'UNE fleche tiree au sort pour ce coup ;
   arc = volee de tirs a fenetres de timing ; baton = course de sequence
   sur l'ecole magique (son identite vient des patterns). Un champ
   authorable optionnel sur l'arme peut surcharger la mecanique de son
   archetype (un marteau leger peut courir la sequence).
3. **Maitrises d'arme par archetype** : `weapon_sword`, `weapon_hammer`,
   `weapon_bow`, `weapon_staff`, progression a l'usage, logees dans la
   famille command-masteries existante.
4. **Niveau recommande souple** : une arme declare un niveau de maitrise
   recommande ; au-dessus le minigame s'adoucit, en dessous il se durcit,
   jamais de blocage d'equipement. Applique aux QUATRE archetypes des ce
   chapitre.
5. **Ressources** : toutes les techniques, physiques comme magiques,
   coutent du MP. Le SP est RESERVE aux tres gros sorts / attaques ultimes
   (differe). Une refonte Mana/Energie est a prevoir (meme ressource
   conceptuelle) - backlog.
6. **Patterns caches** : la sequence d'un pattern n'est PAS affichee
   pendant l'execution (vraie memorisation) ; elle est consultable dans le
   picker et la fiche. 1 erreur = la progression repart du debut de la
   sequence, le temps continue de courir.
7. **Les patterns s'apprennent** (pas de derivation depuis les masteries) :
   tome a usage unique (gate intelligence + niveau global), evolution par
   usage + niveau (Fireball -> Pyrosphere, les deux coexistent),
   enseignement par NPC DIFFERE au chapitre relations (le modele est pret).
   Le niveau minimum est celui du joueur (niveau GLOBAL), pas de sa classe.
8. **Acces en combat** : un picker s'ouvre sur Strike/Cast quand des
   patterns compatibles sont connus (meme pattern UI que le picker
   d'objets ; la grille de six actions reste stable).
9. **Ennemis inchanges ce chapitre** : la defense reste la course de
   sequence actuelle ; les profils d'attaque ennemis sont differes.

## Proposition - minigame mash (marteau)

- Reutilise la structure de course actuelle : le joueur doit atteindre
  `NB_CIBLE` pressions de LA fleche tiree au sort, l'adversaire progresse
  au rythme derive de sa vitesse (inchange).
- `NB_CIBLE = clamp(12 - trunc(speedAdvantage / 5) * 2, 6, 20)` (base 12,
  meme `speedAdvantage` que `createQteChallenge`).
- Temps limite : formule actuelle inchangee (3000-8000 ms).
- Presser une autre fleche que celle tiree = mistake (regle globale
  inchangee : 1 = -20 % de degats, 2 = echec).
- `inputAdvantage` : meme calcul de course que l'actuel (avance/retard a la
  resolution).

## Proposition - minigame timing (arc)

- Volee de N tirs, `volleySize` authorable par arme (defaut 3).
- Chaque tir : un curseur balaie une jauge en `SWEEP_MS` (base 1200 ms) ;
  presser quand il traverse la fenetre.
- Fenetres derivees de l'ecart d'agilite (attaquant - defenseur) :
  - great : 26 % de la jauge + 2 %/point, clamp 14-40 % ;
  - critical (centree dans great) : 8 % + 1 %/point, clamp 4-16 %.
- Mapping vers le contrat : critical = +2, great = +1, rate = -2 ;
  `inputAdvantage` = somme des tirs ; `completed` = au moins un tir non
  rate ; `mistakes` = 0 (la penalite passe par l'avantage).
- Coherence avec le seuil critique existant (>= 5) : 3 criticals = +6 ->
  outcome critical ; 3 greats = +3 -> hit ; melange avec rates -> guarded/
  evaded via l'avantage negatif.

## Proposition - maitrises d'arme et modulation

- Entrees dans la famille command-masteries : cap 10, `usageRequired` 8,
  `effects` vides (la modulation lit le NIVEAU, pas des champs d'effets),
  `unlocks` vides.
- Chaque attaque avec un type d'arme incremente sa maitrise : Strike avec
  epee -> `weapon_sword` ; Cast avec baton -> `weapon_staff` ; les patterns
  incrementent aussi (voir plus bas).
- Armes : champ authorable `recommendedMasteryLevel` (defaut 0 ; les armes
  tier-0 restent a 0).
- `delta = clamp(niveauMaitrise - recommande, -3, +3)`. Par mecanique :
  - sequence (epee/baton) : temps limite +300 ms par point positif /
    -300 ms par point negatif ; a delta >= +2 la sequence perd 1 input, a
    delta <= -2 elle en gagne 1 ;
  - mash : `NB_CIBLE` -1 par point positif / +1 par point negatif (min 4) ;
  - timing : `SWEEP_MS` +10 % par point positif (curseur ralenti) / -10 %
    par point negatif, clamp +-30 % (l'exemple utilisateur : arc recommande
    5, maitrise 7 -> curseur un peu ralenti).
- Cast a mains nues : aucune modulation (comportement actuel conserve).

## Proposition - patterns : modele de contenu

Nouvelle famille `qte-patterns` (recette complete : registre
`import.meta.glob`, validation, `ContentValidationContext`, graphe de
references, drafts combines, overlay playtest, onglet editeur). PatternDef :

- `patternId`, `name`, `description` ;
- `kind` : `physical | magical` (ecole pour `resolveQteContest`) ;
- `inputs` : sequence FIXE de fleches (4 a 8) ;
- `timeLimitMs` : authorable, serre ;
- `mpCost` ;
- `damageMultiplier` ;
- `requiredPlayerLevel` : niveau GLOBAL pour apprendre ;
- `requiredIntelligence` : intelligence effective pour apprendre ;
- `requiredWeaponTypes?` : optionnel (un combo d'epee exige une epee
  equipee ; les sorts n'exigent rien par defaut) ;
- `evolvesFrom?` : `{ patternId, usageRequired }`.

## Proposition - apprentissage et persistance

- **Tome** : item avec `effects.teachesPatternId` ; usage unique depuis
  l'inventaire, utilisable partout ; verifie `requiredPlayerLevel` +
  `requiredIntelligence` (effective) ; en cas d'echec, refus propre SANS
  consommer le tome.
- **Evolution** : apres chaque usage d'un pattern, tout pattern dont
  `evolvesFrom` pointe vers lui avec `usageRequired` atteint ET
  `requiredPlayerLevel` atteint est appris automatiquement (notice + log,
  comme un mastery-up). Les deux sorts coexistent dans le picker.
- **Persistance** : `knownPatterns : patternId -> { timesUsed }` en save ->
  bump de `SAVE_VERSION`, pas de migration.
- **Canal NPC** : differe ; l'apprentissage passe par un chemin engine
  unique (`learnPattern`) que le futur effet de dialogue reutilisera tel
  quel.

## Proposition - execution en combat

- Picker sur Strike (patterns physiques compatibles avec l'arme equipee)
  et Cast (patterns magiques) : nom, cout MP, multiplicateur, et la
  sequence AFFICHEE (c'est la reference consultable ; l'execution, elle,
  est cachee).
- Pendant l'execution : keycaps masques (progression visible, fleches
  cachees) ; 1 erreur = reset de la progression, le temps et la course
  adverse continuent.
- MP consomme a la selection (comme Cast aujourd'hui) ; rater le QTE ne
  rembourse pas.
- `damageMultiplier` multiplie le resultat, cumulable avec le boost de
  Focus.
- Increments d'usage : le pattern lui-meme (compteur d'evolution), la
  commande de base (`strike`/`cast`), et la maitrise de l'arme equipee.

## Proposition - contenu de depart

- `fireball` : magical, 5 inputs, 3500 ms, mp 14, x1.6, niveau 2, int 12,
  appris par tome place en jeu.
- `pyrosphere` : magical, 7 inputs, 4000 ms, mp 22, x2.2, niveau 5, int 16,
  evolution seulement : `evolvesFrom { fireball, usageRequired 15 }`.
- `crosscut` (lame croisee) : physical, 5 inputs, 3200 ms, mp 8, x1.4,
  niveau 2, int 8, `requiredWeaponTypes [sword]`, appris par tome.
- `docs/combat-balance.md` gagne les profils poor/average/strong par
  mecanique.

## Consequences

- Nouvelles surfaces : un composant UI par mecanique sous
  `src/ui/game/combat/` ; la famille `qte-patterns` + onglet editeur ; les
  entrees `weapon_*` dans command-masteries ; champs items
  (`minigame` override, `recommendedMasteryLevel`, `volleySize`,
  `effects.teachesPatternId`) ; bump `SAVE_VERSION` (knownPatterns).
- Le champ `unlocks` des masteries reste RESERVE et non consomme :
  l'acquisition passe par tomes / evolution / NPC.
- Les slices du chapitre 8 sont retaillees en consequence (voir
  PLAN-OPUS.md section 8) : abstraction, profils d'arme + mash, volee arc,
  maitrises d'arme, famille de contenu, apprentissage, execution en
  combat, passe d'equilibrage.

## Differe

- Enseignement de patterns par NPC (chapitre relations).
- Attaques ultimes au SP (le role du SP est grave ici : tres gros sorts et
  ultimes, rien d'autre ne le depense).
- Refonte Mana/Energie (meme ressource conceptuelle - note utilisateur du
  2026-07-08).
- Profils d'attaque ennemis (minigames de defense varies par ennemi).
- Dual-wield ; bouton "tester un pattern" dans l'editeur.
