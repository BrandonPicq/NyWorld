# Plan V0 - Moteur web-first textuel + grille

## Resume

Le projet est un jeu majoritairement textuel dans un monde fantastique medieval, avec une exploration sur grille XY, une simulation de vie, des PNJs vivants, des statistiques detaillees, et plus tard du combat, de l'audio, des portraits et des sprites.

La V0 ne cherche pas encore a construire le jeu complet. Elle doit seulement poser une base saine et jouable :

- lancer l'application ;
- afficher une zone vide ;
- afficher le joueur sur une grille ;
- deplacer le joueur avec le clavier et des boutons UI ;
- afficher les informations minimales de debug : position XY, tick courant, zone active.

## Stack verrouillee

- TypeScript + React + Vite pour l'application web et l'interface.
- Gameplay engine maison, independant de React.
- Renderer Canvas 2D maison pour la grille.
- ECS simple pour representer les entites, composants et systemes.
- JSON + schemas pour les donnees de contenu.
- Temps discret : le monde avance par ticks.
- Web-first, avec export desktop/mobile plus tard via wrappers type Tauri ou Capacitor.

## Architecture V0

Le code sera separe en deux grandes zones :

- `engine` : logique pure du jeu, simulation, ECS, commandes, chargement des donnees.
- `ui` : React, Canvas, controles clavier/boutons, affichage texte et debug.

React ne doit pas contenir les regles du jeu. Il affiche des snapshots du moteur et envoie des commandes comme `MoveNorth`, `MoveSouth`, `MoveWest`, `MoveEast`.

Le Canvas ne decide pas de l'etat du monde. Il recoit seulement les informations necessaires pour dessiner la grille et les entites visibles.

## Systeme minimal

La V0 inclura :

- un identifiant d'entite stable ;
- un composant `Position` ;
- un composant `Renderable` minimal ;
- un composant ou marqueur `PlayerControlled` ;
- un systeme de mouvement cardinal ;
- un compteur de ticks ;
- une carte chargee depuis JSON ;
- un journal textuel minimal des actions.

## Interface V0

L'ecran sera a texte dominant :

- zone principale de narration/log ;
- carte Canvas compacte mais visible ;
- boutons de deplacement ;
- panneau debug/statistiques minimal.

Les sprites, portraits, sons, PNJs, combats, inventaire, sauvegardes et schedules ne sont pas inclus dans la V0, mais l'architecture doit eviter de les bloquer.

## Tests et validation

Tests unitaires a prevoir avec Vitest :

- le joueur se deplace correctement dans les quatre directions ;
- le joueur ne sort pas de la carte ;
- une action valide incremente le tick ;
- une carte JSON valide est acceptee ;
- une carte JSON invalide est refusee.

Validation manuelle :

- lancer l'app ;
- voir la carte vide ;
- deplacer le joueur au clavier ;
- deplacer le joueur avec les boutons UI ;
- verifier que la position XY, le tick et le journal changent correctement.

## Jalon suivant probable

Apres la V0, le jalon naturel sera une V1 orientee exploration + combat simple :

- obstacles ou tuiles non traversables ;
- premieres interactions de zone ;
- premiere rencontre conflictuelle ;
- resolution de combat minimale ;
- journal textuel plus riche.

