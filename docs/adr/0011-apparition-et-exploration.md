# ADR 0011 - Apparition et exploration de zone

## Statut

Acceptee le 2026-07-10 pendant le premier passage de production de contenu
from scratch.

## Contexte

L'editeur permettait de choisir une zone de depart et un respawn de securite,
mais rendait le point de depart peu visible: il etait implicitement le
`playerStart` de la zone. Les evenements ne pouvaient pas non plus faire
evoluer le point de respawn d'une partie deja commencée.

Les grandes zones font egalement apparaitre un besoin d'exploration progressive:
un auteur doit pouvoir activer un brouillard par zone et reveler une partie de
la carte par un evenement.

## Decisions

1. `game.json` peut porter `newGame.startPosition` (`x`, `y`) pour la
   `defaultZone`. Absent, il conserve le repli compatible vers le
   `playerStart` de cette zone.
2. L'onglet Game utilise un seul picker de carte. Dans sa modale, l'auteur
   choisit la cible `Game start` ou `Safe respawn`; la cible determine la zone
   affichee et le champ modifie. Les deux valeurs restent distinctes.
3. `set_respawn` est une action d'evenement. Elle change uniquement le respawn
   runtime de la partie courante, le valide contre la zone chargee, et est
   persiste dans la sauvegarde. Elle ne reecrit jamais le contenu auteur.
4. Le brouillard sera une regle de zone, avec une vision locale 3x3 et des
   cellules explorees persistantes par zone. Le moteur possede l'etat de
   decouverte; le rendu ne fait que projeter son resultat. Une action
   `reveal_area` revele durablement un rectangle auteur.
5. Les cellules explorees montrent le terrain attenue mais pas les entites
   dynamiques. Les cellules actuellement visibles montrent terrain et entites;
   les cellules inconnues ne revelent rien.

## Consequences

- Les sauvegardes ajoutent des donnees runtime pour le respawn et
  l'exploration. Les sauvegardes de prototype restent jetables lors d'un bump
  de version.
- `GameplayEngine` reste un orchestrateur: l'etat de respawn et la decouverte
  appartiennent a des modules dedies et sont injectes dans les resultats de
  rendu.
- Une passe de documentation des API publiques et des parcours de jeu est
  obligatoire apres chaque cycle de playtests, plutot que de documenter a
  l'aveugle des outils non eprouves.
