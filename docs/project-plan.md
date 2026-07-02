# Plan V0 - Moteur web-first textuel + grille

## Resume

Le projet est un jeu majoritairement textuel dans un monde fantastique medieval, avec une exploration sur grille XY, une simulation de vie, des PNJs vivants, des statistiques detaillees, et plus tard du combat, de l'audio, des portraits et des sprites.

La V0 ne cherche pas encore a construire le jeu complet. Elle doit seulement poser une base saine et jouable :

- lancer l'application ;
- afficher une zone vide ;
- afficher le joueur sur une grille ;
- deplacer le joueur avec le clavier et des boutons UI ;
- afficher les informations minimales : position XY, date de monde, zone active.

## Stack verrouillee

- TypeScript + React + Vite pour l'application web et l'interface.
- Gameplay engine maison, independant de React.
- Renderer Canvas 2D maison pour la grille.
- ECS simple pour representer les entites, composants et systemes.
- JSON + schemas pour les donnees de contenu.
- Temps discret : le moteur garde des ticks techniques et un temps narratif derive pour la date du monde.
- Web-first, avec export desktop/mobile plus tard via wrappers type Tauri ou Capacitor.

## Architecture V0

Le code sera separe en deux grandes zones :

- `engine` : logique pure du jeu, simulation, ECS, commandes, chargement des donnees.
- `ui` : React, Canvas, controles clavier/boutons, affichage texte et debug.

React ne doit pas contenir les regles du jeu. Il affiche des snapshots du moteur et envoie des commandes comme `MoveNorth`, `MoveSouth`, `MoveWest`, `MoveEast`.

Le Canvas ne decide pas de l'etat du monde. Il recoit seulement un snapshot de rendu prepare a partir du snapshot moteur, avec les informations necessaires pour dessiner la grille et les entites visibles.

## Structure projet V0

Le code applicatif est decoupe par responsabilite :

- `app` : orchestration React de haut niveau, navigation entre ecrans et initialisation future de partie ;
- `ui` : ecrans et composants React, sans regles de gameplay ;
- `engine` : logique pure du jeu, ECS, commandes et snapshots, a ajouter dans une tranche dediee ;
- `rendering` : rendu Canvas 2D a partir d'etats deja prepares, a ajouter quand la grille sera branchee ;
- `content` : donnees JSON et schemas de validation, a ajouter avec la premiere carte ;
- `styles` : variables de design, styles de base, composants reutilisables et styles propres aux ecrans.

La logique reutilisable de navigation de menu vit sous `ui/menu`. Les composants visuels comme `TerminalMenu` ne doivent porter que l'adaptation React et le rendu terminal.

La logique reutilisable d'input joueur vit sous `ui/controls`. Les ecrans React ecoutent les evenements et deleguent le mapping clavier vers les commandes moteur a ces modules.

## Systeme minimal

La V0 inclura :

- un identifiant d'entite stable ;
- un composant `Position` ;
- un composant `Renderable` minimal ;
- un composant ou marqueur `PlayerControlled` ;
- un systeme de mouvement cardinal ;
- un compteur de ticks ;
- un calendrier de monde (12 mois de 30 jours) expose dans les snapshots ;
- une carte chargee depuis JSON ;
- une transition simple entre zones de test ;
- un journal textuel minimal des actions ;
- une commande d'interaction contextuelle pour parler aux PNJs proches, avec ciblage autour du joueur ou seulement dans la direction regardee ;
- des dialogues d'entree de zone configures dans les donnees JSON ;
- des personnages non-joueurs (PNJs) configurés dans des fiches de personnage réutilisables, puis placés par `npcId` dans les zones ou par un registre global de presence ;
- un état mutable sauvegardable par PNJ (`npcId`) pour préparer relations, progression et rôles évolutifs ;
- des emplois du temps journaliers simples pour déplacer les PNJs selon l'heure du calendrier et les faire apparaitre dans une autre zone ;
- des dialogues de PNJ stockes dans un registre reutilisable, relies aux fiches par `defaultDialogueId` et aux apparitions de zone par `dialogueId` ;
- un défilement de dialogue progressif ("typewriter") couplé à des signaux Web Audio ("bleeps") dont le pitch varie selon la voix du PNJ ;
- un inventaire consultable en lecture seule, avec catégories, descriptions et état vide, accessible par bouton et raccourci clavier.

## Interface V0

L'ecran sera a texte dominant :

- textes visibles du jeu en anglais ;
- menus navigables au clavier : fleches haut/bas pour choisir, entree pour confirmer, echap pour revenir quand l'ecran le permet, tabulation neutralisee dans les menus ; deplacement en jeu avec les fleches directionnelles et WASD ou ZQSD (selon la configuration clavier QWERTY/AZERTY active) ;
- options V0 organisees en categories : `Graphics & Text` (avec selection de theme et vitesse de texte Slow/Normal/Fast/Instant en ligne), `Audio` (avec activation du son en ligne), configuration clavier `Controls` en ligne et réglages `Gameplay` (avec assistant d'interaction intelligent et ciblage Around/Facing) ;
- zone principale de narration/log ;
- carte Canvas compacte mais visible affichant le joueur et les PNJs (glyph commun pour les PNJs ordinaires, couleur par race) ;
- boutons de deplacement en forme de croix directionnelle (D-pad) avec le bouton d'interaction contextuel `Interact [E]` au centre ;
- informations de debug : zone active, position et direction regardee ;
- tableau de bord lateral (gauche) affichant les ressources vitales : jauge d'energie (decroissance par pas), monnaie decomposee (Platinum, Gold, Silver, Bronze), titre academique, avec boutons de repos et fiche de personnage ;
- horloge et date de monde affichees dans le tableau de bord lateral ;
- fiche de personnage detaillee (modal overlay) accessible avec la touche `C` ou clic, affichant la liste modulaire des attributs (Strength, Intelligence, Charisma) et le detail de la progression academique ;
- boîte de dialogue superposée (bas de carte) bloquant temporairement les inputs de déplacement lors d'un échange avec un PNJ.

Les sprites, portraits, sons de fond, combats, equipement et schedules complexes ne sont pas inclus dans la V0, mais l'architecture doit eviter de les bloquer.

Les themes visuels sont pilotes par des variables CSS. Pour ajouter un theme, etendre la liste des presets cote UI et ajouter les overrides de tokens correspondants dans les styles.

Les sons de menu V0 sont generes par une petite couche Web Audio cote UI. Cette couche sert uniquement au feedback des menus et reste separee du futur systeme audio du jeu.

## Tests et validation

Tests unitaires V0 avec Vitest :

- menus, themes, vitesse de défilement, réglages de confort gameplay et reglages audio ;
- mapping d'input jeu : fleches, QWERTY, AZERTY, exclusivite des layouts et labels ;
- moteur gameplay : deplacements cardinaux, interaction, blocage par la carte, ticks, date de monde, journal, collisions de dialogues avec les PNJs, resolution de dialogues contextualises et deplacements de PNJs par schedule ;
- chargement de zone : donnees valides, tile ids inconnus, depart invalide, depart bloque, dialogues d'entree, validation des PNJs, validation des `dialogueId` et des schedules.

Tests a completer avec les prochaines tranches :

- rendu Canvas lisible et correctement cadre ;
- snapshots de rendu entre moteur et Canvas ;
- integration clavier/UI sur l'ecran de jeu ;
- validation plus complete des futurs schemas de contenu.

Validation manuelle :

- lancer l'app ;
- voir la carte vide ;
- deplacer le joueur au clavier ;
- deplacer le joueur avec les boutons UI ;
- verifier une transition entre deux zones de test ;
- verifier que la position XY, le tick et le journal changent correctement.

## Jalon suivant probable

Apres la V0, le jalon naturel sera une V1 orientee exploration + combat simple :

- obstacles ou tuiles non traversables ;
- premieres interactions de zone ;
- premiere rencontre conflictuelle ;
- resolution de combat minimale ;
- journal textuel plus riche.
