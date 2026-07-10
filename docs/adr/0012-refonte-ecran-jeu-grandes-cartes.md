# ADR 0012 - Refonte de l'ecran de jeu pour les grandes cartes

## Statut

Accepte - juillet 2026

## Contexte

Le dashboard de jeu affichait le journal dans une colonne permanente. Cette
composition consommait une largeur fixe et devenait difficile a utiliser avec
des cartes plus grandes. Les objectifs et le debug de playtest renforcaient la
densite autour de la carte.

## Decision

- L'ecran de jeu utilise deux colonnes: statut/actions a gauche et carte dans
  un viewport flexible a droite.
- La camera de carte est un modele pur du module `rendering`. Elle est
  uniquement pilotée par l'UI (suivi du joueur, pan, zoom, recentrage) et ne
  produit aucune commande gameplay.
- `GridRenderer` accepte un viewport et une camera pour ne dessiner que la
  portion visible. Le chemin sans camera reste celui de l'editeur.
- `snapshot.log` reste l'unique source de verite. Le journal complet est
  presente en lecture seule dans `GameLogModal`; `CompactLogOverlay` ne garde
  qu'un etat d'affichage temporaire des trois dernieres entrees.
- Le journal fantome reste ancre en bas a droite du viewport. Quand sa zone
  par defaut recouvre la cellule du joueur avec une marge de securite, il se
  releve temporairement; ce calcul reste local au rendu et revient a sa
  position initiale des que la voie est libre.
- Les objectifs actifs et le debug d'evenements sont des bandeaux superposes,
  et le journal fantome est masque pendant un dialogue bloquant.

## Consequences

- Les grandes cartes n'imposent plus une colonne de journal ni une largeur
  minimale fixe aux controles de deplacement.
- Le raccourci `L` ouvre une surface de consultation et `Escape` la ferme sans
  affecter le moteur ni la sauvegarde.
- Les tests de camera et de journal peuvent rester purs et ne necessitent pas
  React. Les tests navigateur verifient les interactions de viewport et les
  contraintes responsive.

## Alternatives ecartees

- Ajouter un second historique dans `GameplayEngine`: rejete, car cela
  dupliquerait `snapshot.log` et compliquerait la persistance.
- Conserver une colonne droite repliable: rejete, car elle reserve encore de
  l'espace sur les grands ecrans et ne resout pas la carte etroite.
