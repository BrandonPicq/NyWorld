# Plan de projet - Du prototype au produit

## Resume

Le projet est un jeu majoritairement textuel dans un monde fantastique medieval, avec une exploration sur grille XY, une simulation de vie, des PNJs vivants, des statistiques detaillees, et a terme une vie d'academie, des carrieres non combattantes, de l'audio, des portraits et des sprites. Le combat est un moyen de resolution de conflit parmi d'autres, pas le coeur du jeu.

La phase V0 (base jouable minimale) et la phase V1 (exploration + combat simple) sont terminees. Le projet est aujourd'hui un prototype jouable complet. Le jalon en cours est la transition du prototype vers un vrai produit : sortir les donnees encore codees en dur, decouper les gros fichiers centraux, et construire un editeur de contenu.

## Etat actuel : prototype jouable

Le prototype couvre une boucle de jeu complete sur deux zones de test :

- ecran titre, options (themes, vitesse de texte, audio, clavier QWERTY/AZERTY, confort gameplay), menu pause, sauvegardes sur 3 emplacements localStorage avec versionnage et migration ;
- deux zones tutorielles chargees depuis JSON, transitions entre zones, rendu Canvas 2D de la grille, dialogues d'entree de zone joues une seule fois ;
- deplacement clavier et D-pad, commande contextuelle `Interact`, actions `Rest` et `Study` avec cout en energie ;
- calendrier de monde (12 mois de 30 jours) avec horloge, date affichee et journal d'actions en temps de monde ;
- PNJs definis par fiches de personnage, dialogues reutilisables par `dialogueId`, presence globale par emploi du temps journalier, etat mutable persistant par `npcId` ;
- inventaire avec catalogue d'objets, ramassage au sol, consommables utilisables en exploration et en combat, retours visuels par toasts ;
- systeme de quetes : objectifs de collecte, de coordonnees, de seuil de statistique et de victoire en combat, declencheurs et surcharges de dialogue, journal de quetes, recompenses ;
- statistiques structurees (ressources, attributs, valeurs de combat, competences, progression, conditions) avec fiche de personnage detaillee ;
- combat au tour par tour a base de QTE : actions Strike, Cast, Guard, Focus, Use Item et Flee, variance de degats, trois ennemis (Slime, Goblin, Kobold), butin de victoire et retour au point de reapparition sur apres une defaite.

Environ 250 tests unitaires Vitest couvrent le moteur (deplacements, zones, quetes, combat, sauvegardes, schedules, calendrier) et les modules de logique UI (menus, inputs, reglages, stockage des sauvegardes).

## Stack verrouillee

- TypeScript + React + Vite pour l'application web et l'interface.
- Gameplay engine maison, independant de React.
- Renderer Canvas 2D maison pour la grille.
- ECS simple pour representer les entites, composants et systemes.
- JSON + schemas pour les donnees de contenu.
- Temps discret : le moteur garde des ticks techniques et un temps narratif derive pour la date du monde.
- Web-first, avec export desktop/mobile plus tard via wrappers type Tauri ou Capacitor.

## Architecture

Le code applicatif est decoupe par responsabilite :

- `app` : orchestration React de haut niveau et navigation entre ecrans ;
- `ui` : ecrans et composants React, sans regles de gameplay ;
- `engine` : logique pure du jeu, ECS, commandes, snapshots, registres de contenu, sauvegardes ;
- `rendering` : rendu Canvas 2D a partir de snapshots de rendu deja prepares ;
- `content` : donnees JSON (zones, PNJs, dialogues, objets, ennemis, quetes, actions de combat, presence globale, config de jeu) ;
- `styles` : variables de design, styles de base, composants et ecrans.

React ne contient pas les regles du jeu : il affiche des snapshots du moteur et envoie des commandes explicites (`GameCommand`). Le Canvas ne decide pas de l'etat du monde : il dessine un snapshot de rendu.

Le contenu circule JSON -> registre -> moteur. Les registres decouvrent leurs fichiers par `import.meta.glob`, valident les references et exposent des copies detachees. `ContentBundle` centralise les zones et la config globale. Le detail des contrats de contenu vit dans `docs/content-authoring.md`, les cibles d'equilibrage dans `docs/combat-balance.md`, et les decisions structurantes dans `docs/adr/`.

## Dette et limites connues

Le prototype a ete construit en tranches rapides et certaines donnees vivent encore dans le code :

- les effets des consommables sont codes en dur et dupliques dans `GameplayEngine` et `CombatSystem` au lieu de venir du catalogue d'objets ;
- l'inventaire de depart du joueur et les statistiques initiales sont codes en dur dans le moteur ;
- le registre de tuiles (`TileRegistry`) est defini en TypeScript, pas en contenu JSON ;
- la logique est concentree dans quelques gros fichiers : `GameplayEngine.ts` (~1500 lignes), `zoneLoader.ts` (~900), `questRegistry.ts` (~870), `CombatSystem.ts` et `CombatPanel.tsx` (~700 chacun), `GameScreen.tsx` (~500) ;
- la plupart des loaders de contenu s'arretent a la premiere erreur ; seules les zones et les quetes produisent deja des diagnostics multi-erreurs orientes editeur.

## Jalon en cours : contenu data-driven et editeur

Objectif : rendre tout le contenu editable en donnees, puis construire un editeur maison au-dessus.

Etapes prevues, dans un ordre approximatif :

- migrer vers le contenu JSON ce qui est encore code en dur : effets d'objets, inventaire et stats de depart, definitions de tuiles ;
- continuer a decouper `GameplayEngine` en systemes et modules dedies (l'extraction du combat est faite, quetes/inventaire/dialogue restent des candidats) ;
- etendre les diagnostics de contenu (`ContentDiagnostic`) aux dialogues, PNJs, objets, ennemis, actions de combat, presence globale et config de jeu ;
- generaliser le contexte de validation injecte (`ContentValidationContext`) pour que des brouillons d'editeur ou des bundles de mods puissent se valider avant de devenir le contenu actif ;
- construire un `ContentReferenceGraph` pour repondre a "ou cet id est-il utilise" et "que casse un renommage" ;
- exposer des metadonnees d'edition (labels, champs requis, options d'ids) separees des types gameplay ;
- premiere interface d'editeur au-dessus de ces briques.

## Tests et validation

Tests unitaires Vitest existants : moteur (deplacements, collisions, ticks, calendrier, zones, transitions, PNJs, schedules, dialogues, inventaire, quetes, combat QTE, equilibrage, sauvegardes et migrations) et logique UI (menus, themes, vitesse de texte, audio, layouts clavier, reglages gameplay, stockage des sauvegardes).

A completer avec les prochaines tranches :

- tests des futurs validateurs de contenu multi-erreurs au fur et a mesure de leur extension ;
- tests d'integration clavier/UI sur l'ecran de jeu ;
- verification du rendu Canvas par automatisation navigateur quand cela deviendra utile.

Validation manuelle courante : lancer l'app, derouler la boucle complete (nouvelle partie, dialogue, quete, combat, sauvegarde, rechargement) sur les deux zones de test.
