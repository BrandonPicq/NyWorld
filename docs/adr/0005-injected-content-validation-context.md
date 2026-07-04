# ADR 0005 - Contexte de validation de contenu injecte et diagnostics par type

## Statut

Acceptee

## Contexte

Le prochain jalon est un editeur de contenu. L'editeur doit pouvoir valider des brouillons de contenu (ou des bundles de mods) avant qu'ils deviennent le contenu actif. Or les registres validaient leurs references croisees en s'important directement les uns les autres (`npcRegistry` appelait `hasDialogue`, `zoneLoader` appelait `hasNpcDef`, etc.), et `questRegistry` construisait le contexte de validation complet au chargement du module, ce qui rendait l'ordre d'initialisation fragile et empechait de valider autre chose que le contenu runtime.

Deux options ont ete etudiees :

- (a) garder des registres singletons construits eagerly, et transformer chaque validateur en fonction pure `validateX(defs, context)` recevant explicitement les catalogues a verifier ;
- (b) inverser la propriete : faire posseder tous les registres par `ContentBundle`, construit en ordre de dependances avec un contexte partage.

## Decision

Choisir l'option (a). L'editeur a besoin de validateurs purs acceptant des catalogues arbitraires, pas d'une inversion de propriete runtime. L'option (b) aurait impose de faire circuler une instance de bundle dans une douzaine de fichiers consommateurs sans gain editeur immediat.

Regles retenues :

- `ContentValidationContext` est un module **type-only** : il n'importe aucun registre. Il expose l'interface complete (`itemIds`, `npcIds`, `dialogueIds`, `enemyIds`, `questIds`, `combatActionIds`, `tileDefs`, `zones`). Les tuiles sont une map de definitions car la validation de zone a besoin de la marchabilite, pas seulement de l'existence.
- Chaque validateur declare le sous-ensemble dont il a besoin via `Pick<ContentValidationContext, ...>` (ex. `ZoneValidationContext`, `QuestValidationContext`). Un contexte editeur complet satisfait structurellement tous les sous-ensembles.
- Le constructeur du contexte runtime complet vit dans `runtimeValidationContext.ts`, module au sommet du graphe de dependances : **aucun registre ne doit l'importer**.
- Un registre qui a besoin d'un contexte au chargement du module construit son propre sous-ensemble a partir de ses imports directs (cas de `questRegistry`).
- Les noms de types de contenu stables vivent dans `contentTypes.ts` et sont partages par les diagnostics et le futur graphe de references.
- Les chemins stricts (`buildRegistry`, `loadZone`) reutilisent les validateurs a diagnostics et lancent une erreur sur le premier diagnostic bloquant.

## Consequences

Avantages :

- les validateurs sont purs et testables avec des catalogues arbitraires ;
- les brouillons d'editeur et les bundles de mods pourront se valider avant activation ;
- l'ordre d'initialisation des modules est moins fragile qu'avant ;
- le chemin vers l'option (b) reste ouvert : le bundle pourrait appeler les memes validateurs en ordre de dependances.

Compromis et reports explicites :

- les registres restent des singletons eagerly construits ; l'inversion de propriete (option b) est reportee ;
- les metadonnees d'edition (labels, champs requis, options d'ids) sont reportees jusqu'a ce que l'editeur existe ; seules les constantes de types de contenu sont livrees ;
- les getters resilients (`getItemDef`, `getNpcDef`, `getDialogue`, `getCombatActionDef`) gardent leurs fallbacks d'affichage, qui ne doivent jamais recevoir de champs d'effets ou de tuning.
