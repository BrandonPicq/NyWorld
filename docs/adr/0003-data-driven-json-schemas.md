# ADR 0003 - Donnees JSON validees par schemas

## Statut

Acceptee

## Contexte

Le jeu aura beaucoup de contenu : cartes, lieux, personnages, schedules, stats, evenements, dialogues, metiers et potentiellement regles de combat. Ce contenu doit pouvoir grandir sans etre entierement melange au code moteur.

## Decision

Utiliser des fichiers JSON pour les donnees de contenu, valides par schemas TypeScript.

La V0 commencera avec une carte JSON minimale :

- identifiant de zone ;
- dimensions ;
- position de depart du joueur ;
- tuiles basiques ;
- version de donnees.

## Consequences

Avantages :

- contenu separable du moteur ;
- validation possible au chargement ;
- format portable et facile a generer plus tard ;
- base saine pour un editeur maison futur.

Compromis :

- le JSON est moins confortable a ecrire que du TypeScript ou YAML ;
- les schemas doivent etre maintenus ;
- les migrations de donnees devront etre pensees quand le format evoluera.

