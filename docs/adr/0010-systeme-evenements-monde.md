# ADR 0010 - Systeme d'evenements de monde (scenarisation)

## Statut

Acceptee le 2026-07-09. Les decisions ont ete prises avec l'utilisateur en
session de design (deux vagues de questions, 2026-07-09). Les chiffres et
details d'implementation restants (formats exacts, limites) se decident au
fil des slices d'implementation.

## Contexte

L'editeur sait produire zones, NPCs, dialogues, ennemis, objets et quetes,
mais rien ne permet de scenariser le jeu : faire apparaitre des monstres,
donner des objets/XP/or, faire apparaitre des NPCs, arreter le joueur pour
afficher un dialogue, enchainer ces moments. Les seuls "evenements"
existants sont cables en dur : `entryDialogue` de zone (declencheur entree
de zone + action dialogue) et les `triggers`/`rewards` de quetes. La
production de contenu a besoin d'un systeme generique et authorable.

## Decisions (tranchees avec l'utilisateur)

1. **Nouvelle famille de contenu `events`** suivant la recette etablie
   (JSON -> registry -> validation -> onglet editeur -> playtest depuis le
   brouillon). Un evenement = declencheur + conditions + liste ordonnee
   d'actions + politique de repetition + priorite. Ids stables une fois
   apparus dans une sauvegarde.
2. **Declencheurs v1 (squelette)** : entree de zone, marcher sur une aire
   rectangulaire, interaction (touche E) sur une aire. Fin de dialogue,
   changement d'etat de quete et heure calendrier suivent dans le meme
   chapitre.
3. **Conditions en liste AND** : etat de quete, flag de monde pose/absent,
   objet possede, niveau global minimum, plage horaire. Les **flags de
   monde** deviennent un concept de premiere classe : des booleens nommes,
   poses/retires par les evenements, stockes dans la sauvegarde — le ciment
   qui permet d'enchainer les scenes.
4. **Actions en file sequentielle** : les actions s'executent dans l'ordre ;
   un dialogue bloquant suspend la file et la suite reprend a sa fermeture
   (permet "dialogue -> spawn -> combat" ou "dialogue -> loot -> dialogue").
   Jeu d'actions du chapitre : dialogue bloquant, don/retrait d'objet, gain
   d'XP, gain/retrait d'or, pose/retrait de flag, ligne de notice/log,
   spawn/despawn d'ennemi et de NPC (via `EntitySpawner`), lancement de
   combat, teleportation du joueur (zone + position).
5. **Repetition** : trois politiques — une fois par partie (defaut), une
   fois par visite de zone, repetable avec cooldown en ticks. L'etat
   declenche/cooldown est de l'etat de partie mutable : il vit dans la
   sauvegarde, jamais dans le contenu.
6. **Ordonnancement** : plusieurs evenements eligibles au meme declenchement
   s'executent tous, tries par un champ `priority` explicite expose des la
   v1 dans l'editeur (egalite : ordre stable par id).
7. **Editeur** : onglet Events suivant la recette famille complete
   (liste de fichiers, formulaire declencheur/conditions/actions,
   diagnostics, references entrantes/sortantes) ; placement des aires par le
   `MapCoordinatePicker` existant en rectangles (coin a coin, 1x1 pour une
   case unique) ; en playtest lance depuis l'editeur, un panneau debug liste
   les flags poses et les evenements deja declenches (invisible en partie
   normale).
8. **Migration de l'existant** : `entryDialogue` de zone est re-exprime en
   evenement et retire du schema de zone dans ce chapitre (migration des
   zones existantes et de l'editeur de zones). Les `triggers`/`rewards` de
   quetes restent tels quels ; leur unification sera reevaluee apres
   l'experience de la production de contenu.

## Amendement (2026-07-10) — combats invoques sans presence carte

Demande utilisateur pendant le playtest de scenarisation : `start_combat`
ne doit pas exiger que l'ennemi existe sur la carte. Desormais, si
l'ennemi vise est present dans la zone, le combat classique s'engage
(l'entite est retiree a la victoire) ; sinon le combat demarre quand
meme contre le profil de l'ennemi, sans entite sur la carte (« combat
invoque »). `spawn_enemy` reste utile uniquement quand on veut que le
monstre soit visible/persistant sur la carte avant ou sans combat. Pour
memoire : les entites spawnees par evenement sont transitoires — le
monde est reconstruit depuis les spawns de zone a chaque entree de zone
ou chargement de sauvegarde.

## Consequences

- Nouveau composant runtime (flags de monde, evenements declenches,
  cooldowns) et bump de la forme de sauvegarde.
- L'engine gagne un `EventSystem` evalue sur les commandes de deplacement et
  d'interaction ; les actions reutilisent les chemins existants (inventaire,
  XP, or, spawner, dialogues, combat) sans dupliquer de regles — les
  evenements orchestrent, ils ne recalculent pas.
- Le retrait d'`entryDialogue` touche le schema de zone, `zoneLoader`,
  l'editeur de zones et les zones existantes.
- Les noms de flags de monde font partie du contrat de sauvegarde au meme
  titre que les ids.
