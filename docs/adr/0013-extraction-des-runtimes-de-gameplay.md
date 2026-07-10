# ADR 0013 - Extraction des runtimes de gameplay

## Statut

Accepte - juillet 2026

## Contexte

`GameplayEngine` etait devenu le point de stockage de plusieurs domaines
independants: journal persistant, dialogues transitoires, presence des PNJ,
progression/equipement du personnage, et projection de snapshot. Cette
concentration rendait les changements de gameplay plus fragiles et rendait les
tests de responsabilites simples inutilement indirects.

## Decision

- `GameplayEngine` reste la facade publique: il recoit les commandes, garde
  l'ECS, ordonne les systemes et expose les sauvegardes/snapshots.
- Chaque domaine avec etat et regles propres vit dans son module:
  `GameLog`, `DialogueRuntime`, `NpcWorldRuntime`,
  `PlayerCharacterRuntime` et `GameSnapshotBuilder`.
- Les runtimes recoivent des dependances explicites (horloge, ECS, callbacks
  de log/notice, position du joueur) plutot que d'importer `GameplayEngine`.
- Les types UI stables sont places dans `gameplay/GameplayTypes`, puis
  reexportes par la facade existante pour ne pas casser les consommateurs.

## Consequences

- Les nouveaux domaines doivent etre extraits des qu'ils possedent leur propre
  etat, cycle de vie ou regles testables.
- Le moteur principal peut encore coordonner plusieurs runtimes, mais ne doit
  pas reconstituer leurs details internes.
- Les tests de bout en bout de `GameplayEngine` protegent les interactions;
  chaque runtime ajoute ensuite ses tests cibles selon son risque.

## Alternatives ecartees

- Conserver un seul fichier avec des regions: rejete, car cela ne protege ni
  les frontieres de dependances ni la testabilite.
- Deplacer les regles dans les composants React: rejete, car le moteur doit
  rester utilisable par les sauvegardes, le playtest et de futurs clients.
