# ADR 0007 - Source de contenu pour le playtest editeur

## Statut

Proposee, en attente d'approbation utilisateur avant implementation.

## Contexte

L'editeur sait maintenant modifier tous les types de contenu dans un brouillon
combine. Le prochain besoin est de lancer une session de jeu depuis ce brouillon
courant, sans sauvegarder les fichiers JSON et sans attendre un rechargement
Vite. Le playtest doit donc lire le contenu draft en memoire.

L'etat reel de l'architecture est asymetrique :

- les zones et `game.json` passent deja par un `ContentBundle` injectable :
  `useGameplayEngine` recoit un bundle, puis `GameplayEngine` resolve les zones,
  le respawn sur et la configuration de nouvelle partie depuis ce bundle ;
- les autres familles de contenu restent exposees par des registres singletons
  construits eagerly par `import.meta.glob` : items, dialogues, NPCs, presence,
  ennemis, quetes, actions de combat et tuiles ;
- plusieurs fichiers moteur importent directement ces getters singletons
  (`GameplayEngine`, `zoneLoader`, `CombatSystem`, `QuestProgressionSystem`,
  `InventorySystem`, `EntitySpawner`, `NpcScheduleSystem`, `npcStats`, etc.).

Le playtest est une fonctionnalite dev-only de l'editeur. Il doit accelerer le
workflow d'authoring, pas definir tout de suite une architecture de modding
publique.

## Options etudiees

### (a) Inversion complete de propriete des registres

Les registres deviennent des instances possedees par une source de contenu, elle
meme passee au moteur. C'est l'option la plus propre a long terme : chaque
session pourrait posseder son graphe de contenu, les tests pourraient construire
des sources isolees, et les singletons runtime disparaitraient.

Compromis :

- touche les consommateurs directs des getters dans une quinzaine de fichiers ;
- impose de revoir beaucoup de tests qui supposent les registres singletons ;
- augmente fortement le risque de regression pour une fonctionnalite d'abord
  dev-only ;
- duplique une partie du travail deja fait par les validateurs purs de l'ADR
  0005, sans benefice immediat pour l'editeur.

### (b) Overlay de contenu dev-only

Chaque registre garde son singleton runtime, mais expose en developpement une
petite API `installContentOverlay(...)` / `clearContentOverlay()`. Les getters
consultent l'overlay avant le registre source-controlle. Les zones et `game.json`
continuent d'utiliser le `ContentBundle` injectable : le playtest construit un
bundle depuis le snapshot combine avec `createContentBundle`.

Cette option est recommandee.

Regles obligatoires :

- l'overlay est actif seulement en dev et seulement pendant une session de
  playtest ;
- les etats d'overlay au niveau module doivent etre declares au-dessus de la
  construction eager du registre, pour eviter le piege TDZ ;
- l'installation d'un overlay ne change jamais le comportement des fallbacks
  inconnus : un id absent de l'overlay et du registre retourne le meme fallback
  inerte qu'aujourd'hui, sans effets ni tuning ajoutes ;
- les getters retournent toujours des copies detachees, comme les registres
  actuels ;
- l'overlay est nettoye a la sortie du playtest et aussi via un handler HMR
  (`import.meta.hot.dispose`) pour eviter qu'un rechargement dev conserve une
  source globale stale ;
- l'ordre de lancement est : validation synchrone fraiche, installation des
  overlays, construction du `ContentBundle` draft depuis `game.json` et les
  zones du snapshot combine, puis demarrage du jeu ; si la construction echoue,
  les overlays sont nettoyes avant de revenir a l'editeur ;
- aucun registre ne doit importer `runtimeValidationContext`,
  `runtimeContentCatalog` ou `contentAudit`, conformement a l'ADR 0005.

Compromis :

- introduit un etat global mutable, mais limite au dev et a une seule session
  interactive d'editeur ;
- ne resout pas l'inversion de propriete long terme ;
- demande des tests de chaque famille de registre pour verifier install,
  lecture overlay, clear et fallback inconnu.

Cette option touche peu de consommateurs moteur : ils continuent d'appeler les
getters existants, qui deviennent draft-aware seulement pendant le playtest.

### (c) Injection d'un fournisseur au niveau moteur

`GameplayEngine` recoitrait un fournisseur de contenu, avec une implementation
par defaut deleguant aux singletons. C'est un milieu entre (a) et (b) : la
surface de boot du moteur devient plus explicite, sans transformer tous les
registres en instances.

Compromis :

- il faut encore faire circuler le fournisseur vers les sous-systemes deja
  extraits (`CombatSystem`, `QuestProgressionSystem`, `InventorySystem`,
  `EntitySpawner`, `NpcScheduleSystem`) ;
- plusieurs helpers hors engine instance, comme `npcStats` ou les presentations
  de carte, restent a raccorder ou continuent de lire les singletons ;
- le resultat est moins global qu'une inversion complete, mais plus invasif que
  l'overlay pour le besoin present.

## Decision proposee

Choisir l'option (b), overlay de contenu dev-only, pour le premier playtest
editeur.

Raisons :

- le besoin est immediatement editeur/dev-only ;
- le chemin zones + config globale est deja injectable par `ContentBundle` ;
- les consommateurs moteur existants restent stables ;
- les validateurs purs et le snapshot combine fournissent deja la source draft
  a installer ;
- les risques specifiques de l'overlay sont encadrables par des tests simples
  et par un cycle de vie court.

L'inversion complete reste une option future si le projet ajoute du modding,
des sessions concurrentes, ou une architecture ou plusieurs mondes doivent vivre
en meme temps.

## Isolation des sauvegardes

Une session de playtest ne doit ni lire ni ecrire les vrais slots de sauvegarde.
Le lancement part d'une nouvelle partie construite depuis le brouillon courant,
pas depuis `readSlot` ou `readAllSaves`.

La premiere implementation doit masquer ou desactiver les chemins de sauvegarde
et chargement pendant le playtest :

- pas de chargement de slot au demarrage du playtest ;
- pas d'appel a `writeSlot` depuis le menu pause ;
- retour explicite a l'editeur au lieu de "Quit to Title" pour cette session ;
- aucun fichier de contenu n'est ecrit par le playtest.

Cette isolation garde les vrais saves lies au contenu source-controlle, tandis
que le playtest reste un essai jetable du brouillon.

## Gating du playtest

Le bouton Playtest est bloque tant que le brouillon combine contient des erreurs
de validation. La regle est la meme que pour les sauvegardes editeur : ne pas
lancer une session runtime depuis un bundle invalide.

Comme les diagnostics affiches peuvent etre deferres pour garder la saisie
fluide, l'action de lancement doit refaire une validation synchrone fraiche avec
le snapshot combine et le contexte combine courants avant d'installer l'overlay
ou de construire le bundle. Si cette validation trouve une erreur, le playtest
ne demarre pas et l'editeur reste intact.

## Consequences

Avantages :

- playtest rapide depuis le brouillon courant, sans ecriture disque ;
- faible surface de changement dans le moteur ;
- preserve les regles de l'ADR 0005 et les fallbacks inertes ;
- donne un point de dogfooding concret avant de produire plus de contenu.

Compromis et reports explicites :

- un etat global dev-only est accepte pour cette fonctionnalite ;
- les registres singletons restent la realite runtime hors playtest ;
- la vraie inversion de propriete des registres est reportee a un besoin plus
  large que le playtest editeur.
