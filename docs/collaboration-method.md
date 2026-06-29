# Methode de collaboration

## Intention

Nous travaillons comme deux developpeurs sur la meme machine. L'objectif n'est pas que Codex code tout en bloc, mais que le projet avance petit a petit, avec une comprehension partagee des fichiers et des decisions.

A la fin d'une session, le developpeur humain doit comprendre ce qui a ete ajoute, pourquoi, et ou reprendre plus tard.

## Mode de travail

- Avancer par petites tranches comprehensibles.
- Expliquer les choix structurants avant de les appliquer.
- Creer ou modifier peu de fichiers a la fois.
- Garder les fichiers lisibles, testables et faciles a revisiter.
- Documenter les decisions importantes dans des ADR courtes.
- Preferer un projet un peu plus lent mais mieux compris a une generation massive difficile a relire.

## Avant les changements

Avant de creer ou modifier un fichier important, Codex annonce :

- le chemin du fichier ;
- son role ;
- ce qui va y etre mis ;
- les dependances ou impacts notables.

Les fichiers de configuration standard peuvent etre groupes dans une meme annonce quand ils sont mecaniques, par exemple `package.json`, `tsconfig.json` et `vite.config.ts`.

## Pendant les changements

Codex garde les changements petits et coherents :

- une fondation a la fois ;
- un systeme a la fois ;
- une interface publique claire entre moteur et UI ;
- des tests quand le comportement devient non trivial.

Le developpeur humain peut a tout moment demander a ecrire lui-meme une partie du code. Codex passe alors en role de reviewer, architecte ou copilote.

## Apres les changements

Apres chaque tranche, Codex resume :

- les fichiers touches ;
- le comportement obtenu ;
- les tests ou verifications effectues ;
- les questions ouvertes ou risques restants.

Si une direction devient mauvaise, on revient aux documents de plan et ADR pour comprendre le choix initial, puis on corrige proprement.

