# ADR 0001 - Stack web-first TypeScript, React et Canvas 2D

## Statut

Acceptee

## Contexte

Le jeu sera majoritairement textuel, avec beaucoup de statistiques, de panneaux d'information, de logs, de choix et de systemes de simulation. Il doit aussi supporter une exploration sur grille XY, puis plus tard des sprites, portraits et sons.

Le projet vise une portabilite large : web d'abord, puis desktop et mobile via wrappers si necessaire.

## Decision

Utiliser :

- TypeScript comme langage principal ;
- React pour l'interface ;
- Vite comme outil de developpement/build ;
- Canvas 2D maison pour le rendu de la grille ;
- wrappers desktop/mobile plus tard, par exemple Tauri ou Capacitor.

## Consequences

Avantages :

- iteration rapide dans le navigateur ;
- excellente base pour une UI dense et textuelle ;
- typage fort pour stabiliser les systemes ;
- distribution web simple pour les prototypes ;
- chemin raisonnable vers desktop/mobile.

Compromis :

- le web impose des limites audio, stockage et performance a garder en tete ;
- le renderer Canvas maison devra etre entretenu ;
- le packaging mobile natif n'est pas inclus dans la V0.

