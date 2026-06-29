# ADR 0002 - Gameplay engine maison avec ECS simple

## Statut

Acceptee

## Contexte

Le jeu doit pouvoir grandir vers des PNJs avec schedules, relations, deplacements, stats, combat, progression et routines. Une architecture trop orientee objets risque de rendre les interactions entre systemes difficiles a maintenir.

## Decision

Construire un gameplay engine maison base sur un ECS simple :

- entites identifiees par un `EntityId` ;
- composants de donnees ;
- systemes qui transforment l'etat du monde ;
- commandes explicites envoyees par l'UI.

React et Canvas ne contiennent pas les regles du jeu. Ils interagissent avec le moteur via des commandes et des snapshots.

## Consequences

Avantages :

- extensible pour PNJs, horaires, comportements et stats ;
- testable sans interface graphique ;
- separation nette entre simulation et affichage ;
- bon support futur pour outils de debug.

Compromis :

- demande une petite discipline d'architecture des le debut ;
- peut paraitre plus abstrait qu'un prototype en classes directes ;
- l'ECS doit rester simple tant que le jeu est petit.

