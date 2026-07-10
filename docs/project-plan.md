# Plan de projet - Du prototype au produit

## Resume

Le projet est un jeu majoritairement textuel dans un monde fantastique medieval, avec une exploration sur grille XY, une simulation de vie, des PNJs vivants, des statistiques detaillees, et a terme une vie d'academie, des carrieres non combattantes, de l'audio, des portraits et des sprites. Le combat est un moyen de resolution de conflit parmi d'autres, pas le coeur du jeu.

La phase V0 (base jouable minimale) et la phase V1 (exploration + combat simple) sont terminees. Le projet est aujourd'hui un prototype jouable complet. Le jalon en cours est la transition du prototype vers un vrai produit : sortir les donnees encore codees en dur, decouper les gros fichiers centraux, et construire un editeur de contenu.

## Etat actuel : prototype jouable

Le prototype couvre une boucle de jeu complete sur deux zones de test :

- ecran titre, options (themes, vitesse de texte, audio, clavier QWERTY/AZERTY, confort gameplay), menu pause, sauvegardes sur 3 emplacements localStorage avec versionnage et migration ;
- navigation clavier des principaux menus de jeu : inventaire par categories, fiche personnage, grille d'equipement, journal de quetes, toasts et sous-menus de combat/pause/sauvegarde ;
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
- `content` : donnees JSON (zones, PNJs, dialogues, objets, ennemis, quetes, actions de combat, patterns QTE, presence globale, config de jeu) ;
- `styles` : variables de design, styles de base, composants et ecrans.

React ne contient pas les regles du jeu : il affiche des snapshots du moteur et envoie des commandes explicites (`GameCommand`). Le Canvas ne decide pas de l'etat du monde : il dessine un snapshot de rendu.

Le contenu circule JSON -> registre -> moteur. Les registres decouvrent leurs fichiers par `import.meta.glob`, valident les references et exposent des copies detachees. `ContentBundle` centralise les zones et la config globale. Le detail des contrats de contenu vit dans `docs/content-authoring.md`, les cibles d'equilibrage dans `docs/combat-balance.md`, et les decisions structurantes dans `docs/adr/`.

## Dette et limites connues

- la logique reste concentree dans quelques gros fichiers : `GameplayEngine.ts` (~1500 lignes), `zoneLoader.ts` (~950), `questRegistry.ts` (~870), `CombatSystem.ts` et `CombatPanel.tsx` (~700 chacun), `GameScreen.tsx` (~500) ; l'extraction du combat est faite, quetes/inventaire/dialogue restent des candidats ;
- les textes descriptifs des actions de combat (`effects`) dupliquent les valeurs de tuning ; l'editeur devra generer cette prose depuis les donnees ;
- les sauvegardes de prototype sont jetables : les changements de format bumpent `SAVE_VERSION` sans migration tant qu'aucune vraie partie n'existe.

## Jalon en cours : contenu data-driven et editeur

Objectif : rendre tout le contenu editable en donnees, puis construire un editeur maison au-dessus.

Fondations posees (juillet 2026) :

- contenu migre en JSON : effets de consommables, tuiles, inventaire/stats/monnaie de depart, tuning repos/etude, tuning des actions de combat, patterns QTE ;
- chaque famille de contenu a un validateur a diagnostics multi-erreurs (`ContentDiagnostic`) : zones, quetes, objets, tuiles, dialogues, PNJs, presence globale, ennemis, actions de combat, patterns QTE, config de jeu ;
- la validation des references passe par un contexte injecte (`ContentValidationContext` et sous-ensembles `Pick`), voir ADR 0005 ;
- `ContentReferenceGraph` repond a "ou cet id est-il utilise" et "que casse un renommage" (avec indicateur de persistance en sauvegarde) ;
- `validateAllContent` audite un bundle complet ; un test permanent garde le contenu livre sans erreur.
- premier ecran d'editeur dev-only en lecture seule : navigateur de contenu, panneau de problemes, navigation par references et impact de renommage.
- persistance editeur dev-only acceptee par ADR 0006 et branchee au dev server Vite avec allowlist `src/content/**/*.json`.
- premiere boucle d'edition dev-only pour le catalogue d'objets : brouillon en memoire, validation live, controles de references et sauvegarde JSON.
- onglet zones dev-only en lecture seule : rendu Canvas de la zone selectionnee (via `createZoneEditRenderSnapshot`) et inspection des placements PNJ/objets, transitions et dialogue d'entree.
- edition dev-only des tuiles d'une zone : palette de tuiles, peinture au clic et au glisser sur le canvas, validation live (mur sous le depart, un PNJ, un objet ou une transition) et sauvegarde JSON via l'endpoint editeur.
- edition dev-only des placements d'une zone : selecteur de mode (depart joueur, PNJ, objet, transition, gomme), pose au clic, validation live sur l'ensemble du contenu et sauvegarde JSON ; les schedules restent en lecture seule.
- creation de zone, edition du dialogue d'entree, et onglet Game (defaultZoneId / safeRespawn de game.json) depuis l'editeur, avec validation live et diffs JSON minimaux.
- edition dev-only des fichiers de dialogues reutilisables : creation de fichiers, ajout de sequences, edition des lignes speaker/text/pitch, suppression bloquee par les references entrantes, validation live du bundle.
- edition dev-only des fiches PNJ : creation de fichiers PNJ, champs race/importance/presentation/dialogue par defaut, validation live du bundle, et raccourci de creation du dialogue par defaut.
- edition dev-only des profils ennemis rattaches aux PNJ : toggle combatable, stat block complet, loot, validation live du bundle, sauvegarde et suppression des fichiers de profil.
- edition dev-only des patterns QTE appris : creation de fichiers, sequence d'inputs, kind physique/magique, cout MP, multiplicateur, prerequis, restrictions d'arme, evolution, validation live, references entrantes et sauvegarde JSON.
- apprentissage des patterns QTE par tomes consommables (`effects.teachesPatternId`) et par evolution d'usage/niveau global : verification des prerequis, refus sans consommation, notices/logs, coexistence source/evolution, persistance `knownPatterns` en sauvegarde version 0.11, et tomes de depart rattaches aux recompenses de quetes.
- execution des patterns QTE appris en combat : selection depuis Strike/Cast, verification arme/MP, QTE a sequence cachee, multiplicateur de degats, depense de MP et increment `timesUsed`.
- fiche personnage : l'onglet Mastery affiche les techniques connues, leurs sequences completes, leurs compteurs d'usage et leur progression d'evolution.
- navigation clavier de l'editeur : onglets de section en roving tabindex, choix des panneaux par fleches avant d'entrer dans leurs controles, listes de contenu/diagnostics/references avec Up/Down + Enter, Escape hierarchique, et modal de selection de coordonnees avec focus initial, Tab piege, Escape et retour de focus.
- passe d'equilibrage chapitre 8 : profils poor/average/strong partages pour sequence, mash, timing et patterns caches, bandes de variance de degats testees, et timings des patterns de depart adoucis apres integration.
- jalon Fondations RPG terminé (juillet 2026) : double progression de niveau (global et classe), dérivation de statistiques par couches (layered stats), slots d'équipement et restrictions de classe, maîtrise des commandes (command mastery) avec caps/utilisations/effets, action d'étude restreinte aux zones dédiées (study spot gating), et mise à jour complète du contenu de départ (Tier 0 equipment, quêtes, XP).

Etapes restantes :

- continuer a decouper `GameplayEngine` en systemes et modules dedies ;
- etendre les boucles d'edition aux autres familles de contenu, en gardant les metadonnees d'edition separees des types gameplay ;
- reevaluer a terme la separation de l'editeur dans une application dediee si sa surface depasse le simple outil dev integre.

## PLAN-OPUS §12 - Refonte de l'editeur

Objectif : faire de l'editeur un outil compact a theme sombre neutre, independant de l'identite terminal du jeu, sans modifier les ecrans de jeu.

- Slice 72 - `[FIX]: Per-file save gating with a visible reason` : `[STATUS: complete]`.
- Slice 73 - `[ADD]: Editor design tokens and primitives` : `[STATUS: complete]`.
- Slice 74 - `[UPDATE]: Sidebar navigation shell` : `[STATUS: pending]`.
- Slice 75 - `[UPDATE]: Workbench and form density pass` : `[STATUS: pending]`.
- Slice 76 - `[UPDATE]: Picker, zone tools, and final sweep` : `[STATUS: pending]`.

Le lancement du Playtest conserve sa validation globale ; les commandes Save se calent sur la validation du fichier qu'elles ecrivent.

## Tests et validation

Tests unitaires Vitest existants : moteur (deplacements, collisions, ticks, calendrier, zones, transitions, PNJs, schedules, dialogues, inventaire, quetes, combat QTE, equilibrage, sauvegardes et migrations) et logique UI (menus, themes, vitesse de texte, audio, layouts clavier, reglages gameplay, stockage des sauvegardes).

A completer avec les prochaines tranches :

- tests des futurs validateurs de contenu multi-erreurs au fur et a mesure de leur extension ;
- tests d'integration clavier/UI sur l'ecran de jeu ;
- verification du rendu Canvas par automatisation navigateur quand cela deviendra utile.

Validation manuelle courante : lancer l'app, derouler la boucle complete (nouvelle partie, dialogue, quete, combat, sauvegarde, rechargement) sur les deux zones de test.
