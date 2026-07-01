# ADR 0004 - Resolution des dialogues de PNJ

## Statut

Acceptee

## Contexte

Les PNJs vont pouvoir apparaitre dans plusieurs zones et evoluer avec le monde. Garder tous leurs dialogues directement dans leur fiche de personnage dupliquerait les textes et rendrait difficile le choix d'un dialogue different selon le lieu, la progression ou le role courant.

## Decision

Separer les fiches de personnages et les dialogues :

- les fiches PNJ declarent l'identite stable du personnage et un `defaultDialogueId` ;
- les fichiers de dialogues declarent des sequences reutilisables par id ;
- les registres PNJ et dialogues chargent automatiquement les fichiers JSON de leurs dossiers de contenu ;
- un spawn de zone peut fournir un `dialogueId` pour choisir un dialogue contextuel ;
- l'etat persistant du PNJ peut fournir un `currentDialogueId` quand son evolution doit remplacer le dialogue par defaut ;
- le moteur resout le dialogue dans cet ordre : spawn de zone, etat persistant, fiche PNJ.

## Consequences

Avantages :

- une fiche de personnage reste courte et reutilisable ;
- une zone peut adapter le dialogue d'un personnage sans dupliquer sa fiche ;
- la progression future des PNJs peut changer leur dialogue via l'etat sauvegarde ;
- les references cassees sont detectees au chargement de contenu.

Compromis :

- les auteurs de contenu doivent gerer des ids de dialogue explicites ;
- une future couche d'outillage sera utile pour explorer les liens entre PNJs, zones et dialogues.
