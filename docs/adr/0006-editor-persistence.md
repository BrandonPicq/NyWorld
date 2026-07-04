# ADR 0006 - Persistance de l'editeur de contenu

## Statut

Acceptee

## Contexte

Le prochain editeur de contenu doit permettre de modifier les fichiers JSON sous
`src/content`, puis de sauvegarder ces changements dans le projet. Le contenu
runtime est actuellement importe par Vite via `import.meta.glob`, et
l'application editeur sera une interface navigateur. Un navigateur seul ne peut
pas ecrire librement dans le workspace sans mecanisme explicite.

L'editeur est d'abord un outil de developpement pour le contenu source-controlle,
pas une fonctionnalite de modding distribuee en production.

Deux options sont etudiees :

- (a) ajouter un plugin Vite de developpement exposant une petite route
  d'ecriture, par exemple `POST /__editor/save` ;
- (b) utiliser la File System Access API depuis le navigateur.

## Decision

Choisir l'option (a) : un middleware Vite actif seulement en developpement.

Regles retenues pour l'implementation future :

- l'endpoint d'ecriture n'existe qu'en mode dev ;
- les chemins autorises sont limites a `src/content/**/*.json` ;
- les chemins recus par l'endpoint sont normalises et rejetes s'ils sortent de
  `src/content` ou contiennent une traversee de repertoire ;
- le contenu sauvegarde reste du JSON normal dans le repository, versionne par
  git ;
- Vite peut recharger le contenu modifie via son comportement de dev server et
  HMR.

La route doit rester petite : recevoir un chemin de contenu autorise et le texte
JSON a ecrire, valider l'autorisation de chemin cote serveur, puis ecrire le
fichier. La validation metier du brouillon reste cote moteur/editeur avec les
validateurs de contenu existants.

## Alternatives

### File System Access API

Avantages :

- peut fonctionner dans un build de production servi localement ;
- evite d'ajouter une route d'ecriture au dev server.

Compromis :

- support principalement Chromium ;
- demande a l'utilisateur de choisir ou rechoisir des fichiers/repertoires ;
- ajoute plus de friction dans un outil qui vise d'abord le workflow de
  developpement du repository ;
- se marie moins naturellement avec `import.meta.glob` et le rechargement Vite
  pendant l'edition.

## Consequences

Avantages :

- l'editeur peut sauvegarder directement les JSON sources du projet ;
- les changements restent visibles dans git, faciles a relire et a committer ;
- la surface d'ecriture est limitee et testable par une fonction pure
  d'autorisation de chemin ;
- le workflow reste proche du developpement Vite actuel.

Compromis et reports explicites :

- l'editeur de contenu reste d'abord un outil dev-only ;
- une build statique de production ne pourra pas sauvegarder sans autre
  mecanisme ;
- une application d'editeur separee, eventuellement dans un autre langage, reste
  une option future a reevaluer si l'editeur devient assez gros pour justifier
  son propre cycle de vie.
