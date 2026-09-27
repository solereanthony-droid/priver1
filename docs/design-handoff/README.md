# Handoff : Chiffrage BTP 974 (application mobile)

## Vue d'ensemble
Application mobile de chiffrage pour artisans du BTP à La Réunion (974). L'artisan crée un devis (saisie manuelle, catalogue ou IA en langage naturel / dictée vocale), contrôle sa marge, envoie le devis, le transforme en facture, suit l'envoi des factures vers une plateforme de facturation électronique agréée, gère son planning, ses projets, ses plans (schéma unifilaire électrique conforme NF C 15-100) et les informations légales de son entreprise.

Langue de l'interface : français. Monnaie : euro. TVA DOM : 8,5 % et 2,1 % (ou franchise en base, art. 293 B du CGI).

## À propos des fichiers
Les fichiers de ce dossier sont des **références de design créées en HTML** : un prototype qui montre l'apparence et le comportement attendus, pas du code de production à copier. La tâche est de **recréer ce design dans l'environnement cible** (React Native, Flutter, SwiftUI, PWA React…) avec ses propres patterns. Si aucun environnement n'existe, recommandation : **React Native (Expo) + TypeScript**, stockage local (SQLite/MMKV) puis synchronisation serveur.

Le prototype tient dans un seul fichier : `Chiffrage BTP 974 Mobile.dc.html`. Toute la logique métier est dans la classe `Component` (balise `<script data-dc-script>` en fin de fichier). Le gabarit (markup) est entre `<x-dc>` et `</x-dc>`, en styles inline. Les `{{ … }}` sont des trous de gabarit alimentés par `renderVals()`.

Pour l'ouvrir : servir le dossier en HTTP local (`npx serve .`). Il dépend de `support.js` (moteur du prototype, non fourni ici) et de la feuille `ds/styles.css`. Sans eux, lire le code source directement : il reste la référence.

## Fidélité
**Haute fidélité.** Couleurs, typographie, rayons, espacements, textes et interactions sont définitifs. Recréer fidèlement. Les données (clients, prix, catalogue, historique CA) sont des **données de démo** à remplacer par de vraies sources.

## Cadre
- Maquette téléphone 390 × 844 px (iPhone 14), mise à l'échelle pour tenir dans la fenêtre.
- Barre de navigation basse, 5 onglets : Accueil, Nouveau devis, Documents, Catalogue, Réglages (pastille terracotta si une info entreprise manque).
- Écran scrollable unique (`scrollRef`), retour en haut à chaque changement d'onglet. Bouton retour (cercle 44 px, chevron gauche) en haut à gauche des écrans secondaires.
- Toast bas d'écran (`flash(msg)`) pour chaque action confirmée.
- Feuilles modales (« bottom sheets ») : fond `neutral-900` à 45 %, panneau `--color-bg`, coins haut 36 px, poignée 44 × 5 px, animation `btpUp` .32 s `cubic-bezier(.2,.8,.2,1)`. Fermeture en touchant le fond, la croix ou Échap.
- Cibles tactiles ≥ 44 px partout.

## Écrans
Les noms entre crochets sont les `data-screen-label` du prototype.

### [01 Accueil]
- Salutation, sélecteur de métier (pastille sauge → feuille « Réglages métier »).
- Bouton principal « Nouveau devis ».
- **Facturation électronique** : tableau lisible des dernières factures créées dans l'app, avec leur statut d'envoi vers la plateforme (Émise → Transmise → Acceptée → Encaissée) et l'état de connexion à la plateforme nommée (prop `paName`, défaut « FactuPro 974 ») : Connectée (point sauge) / Synchronisation… / Déconnectée (point terracotta), bouton Synchroniser/Reconnecter. Chaque facture s'ouvre (feuille « Facture ») et se modifie.
- Carte CA → écran Facturation (graphes). Carte marge → écran Marge.
- Accès rapides aux outils (Planning, Projets, Plans, Mon comptable…).

### [02 Nouveau devis] et [02b Récap devis]
- Client, adresse du chantier.
- **IA** : champ texte + bouton micro (dictée, Web Speech API `fr-FR`) + exemples par métier + historique des 8 dernières demandes. Appel LLM (voir « IA » plus bas) qui renvoie des lignes du catalogue + heures de main d'œuvre.
- Lignes : matériel (catalogue), main d'œuvre, déplacement. Quantité − / +, suppression. Bouton discret pour masquer les prix unitaires (`puHidden`) sur le devis client. Pas de suffixe « u » pour l'unité « pièce » (`U(u)` renvoie vide).
- **Conformité** : bloc des normes du métier (tableau `DTU`) avec contrôles `metierRules(key, lines)` : ✓ / ! / i, bouton « + Ajouter » par article manquant et « Tout ajouter ».
- **Récapitulatif** : marge brute matériel (hors main d'œuvre), sous-total, remise %, TVA 8,5 / 2,1, total TTC (ou HT si micro).
- **Acompte** : réglette 0 – 50 % par pas de 5, boutons − / +, valeur à droite (« Aucun » en terracotta à 0). Présente dans « Conditions » et dans le Récapitulatif (même état). À 0 % : bandeau « Sans acompte, ce devis sera marqué « provisoire » : ce n'est pas un document définitif. » et étiquette PROVISOIRE sur l'aperçu.
- Actions : Aperçu client [Aperçu devis], Envoyer, Transformer en facture (acompte déduit), Dupliquer / nouvelle version (`-V2`).

### [03 Documents]
Onglets Devis / Factures / Plans. Liste avec statut coloré (table `TONE`), tap = ouvrir/modifier, changement de statut, retrait de l'historique.

### [05 Facturation]
Graphes de CA. Période sélectionnable en haut (3 / 6 / 12 mois, ou mois précis) qui pilote tous les graphes et chiffres de l'écran. Tap sur une carte → courbe d'évolution détaillée.

### [06 Marge]
Détail du calcul de marge par devis. Jauge du taux de marge matériel en % (le coefficient se déduit : `coef = 1 / (1 − marge)`, défaut 1,35). Seuil d'alerte réglable (défaut 15 %, − / +). Tarif horaire de main d'œuvre réglable (défaut selon le métier). Sous le seuil : couleurs terracotta ; au-dessus : sauge.

### [07 Outil]
Outils : **Planning** (calendrier mensuel dynamique, jours avec événements marqués, ajout d'un RDV avec heure + type Chantier / Visite / Fournisseur, grille 3 colonnes), **Prise de RDV vocale par IA** (texte ou dictée → brouillon de RDV à valider), commandes fournisseurs, relances de devis, **Mon comptable** (voir Réglages).

### [09 Fiche projet]
Fiche d'un chantier (étapes cochables `projSteps`, devis et factures liés, avancement).

### [10 Plan]
Plans liés à un devis et à une facture (pastilles horizontales scrollables).
- **Schéma unifilaire** généré depuis le devis (`planFromLines`) ou édité à la main. Dessin en SVG (viewBox 340 × hauteur calculée au contenu) par `planDiagram(p, sel, mode, errs)` :
  - disjoncteur de branchement 500 mA, parafoudre type 2 en option ;
  - une rangée par interrupteur différentiel (ID1, ID2… calibre, 30 mA, type AC/A/F) ;
  - par circuit : repère Q (numérotation continue), disjoncteur, **symbole normalisé** (point lumineux, prise 2P+T, plaque, lave-linge, borne VE, circuit spécialisé ; dérivé du libellé par `circNature`), quantité « ×n », calibre, désignation en vertical + section.
  - circuit sélectionné : bande `accent-200` ; circuit en défaut : disjoncteur terracotta + pastille « ! ».
  - modes : « Noms sur le schéma » / « Repères + tableau ».
- Légende des symboles utilisés. Tableau de repérage (Rep., Désignation + ID, Prot., Section), cliquable.
- **Fiche du circuit sélectionné** sous le schéma : titre, calibre / section / ID / points, défauts avec correction, calibres 10/16/20/32 A, − / + points, changement d'ID, ‹ › précédent/suivant.
- **Points à vérifier** (`planIssues`) : chaque défaut a une correction en un geste (« Passer en 16 A », « Diviser le circuit », « Ajouter ID2 type A », « Passer sur ID2 »…) et « Voir » ; « Tout corriger » applique les corrections en séquence.
- Liste des circuits (nom éditable, calibres, − / + points, ID, suppression), liste des différentiels (type AC → A → F, nombre de circuits, suppression), « + Circuit », « + Différentiel ».
- Bouton « ? » (cercle 20 px, trait 1,5 px) → feuille [Règles NF C 15-100] : état de chaque règle sur ce schéma (✓ sauge / ! terracotta / i neutre).
- « Plan et devis » : comparaison matériel plan ↔ devis, « Mettre à jour le devis », « Régénérer le schéma ».
- Import d'un plan image/PDF. Export SVG, partage.

### [04 Catalogue]
Recherche, filtres par famille, catalogue par métier (`CAT_RAW` : désignation, réf., famille, fournisseur, prix d'achat HT, unité). Prix de vente = achat × coefficient.

### [08 Réglages]
Sections : Entreprise (raison sociale, **forme juridique** en menu déroulant avec fiche informative par forme : `FORMES`, SIRET, RCS/RM, TVA intracom., **assurance décennale** et RC Pro, médiateur de la consommation…), Devis (acompte par défaut 0 – 50 %, appliqué aux nouveaux devis), Tarifs et marge, Conditions de vente, Facture électronique (plateforme, calendrier 2026-2027), Mon comptable.
- Chaque champ a un « ? » collé à droite du libellé (petit, discret) → feuille [Aide saisie] qui explique où trouver l'information (`FIELD_HELP`).
- **Mon comptable** (facultatif) : cabinet, nom, e-mail, téléphone, fréquence, note ; menu déroulant « À faire relire » (5 points cochables, pastilles de progression) ; e-mail préparé avec **aperçu modifiable** [Aperçu e-mail comptable] avant envoi (ouvre la messagerie via `mailto:`).
- [Réglages métier] : choix du métier (Électricien, Plombier, Maçon, Peintre, Menuisier, Carreleur, Couvreur, Multi-services) et régime TVA.

## Règles métier à reproduire exactement
- **Totaux** (`totals()`) : montants arrondis au centime (`r2`). Remise appliquée au sous-total. TVA calculée par taux sur la base remisée. Micro-entreprise : TVA 0, mention art. 293 B. Acompte = TTC × taux ; solde = TTC − acompte. Marge = vente matériel remisée − achat.
- **Statuts** : devis `Brouillon, Envoyé, Accepté, Facturé` ; factures `Émise, Transmise, Acceptée, Encaissée`.
- **Numérotation** : `DEV-<année>-NNN`, `FAC-<année>-NNN` (3 chiffres minimum, `docNo()`), versions `-V2`.
- **NF C 15-100** (`planIssues`) : ≥ 2 ID 30 mA ; ≤ 8 circuits par ID ; type A (ou F) pour plaque, lave-linge, borne VE ; plaque 32 A / 6 mm² ; prises cuisine 20 A / 2,5 mm², ≤ 6 socles ; prises 16 A ≤ 8 socles, 20 A ≤ 12 socles, 16 A minimum et 20 A maximum ; éclairage ≤ 8 points, 10 ou 16 A ; ≥ 2 circuits d'éclairage ; sections `{10:1,5 ; 16:1,5 ; 20:2,5 ; 32:6}` mm² ; réserve 20 % dans le tableau.
- **Autres métiers** : voir `DTU` et `metierRules()` (groupe de sécurité, mitigeur thermostatique, chaînages zone sismique 2, sous-couche, colle C2 + SPEC, tôle ≥ 0,75 mm S320GD, fenêtres 1 200 Pa…). Ces règles sont un résumé : à faire valider par un professionnel.

## IA
Prototype : `window.claude.complete` (modèle `claude-sonnet-4-5`). En production : **appel serveur** (ne jamais exposer la clé API dans l'app).
- Devis : prompt système dans `runAI()`. Réponse JSON strict `{"lignes":[{"designation","quantite"}],"mo_heures"}` limitée aux désignations du catalogue, puis rapprochement flou (`norm`) avec le catalogue. Si l'IA est indisponible : repli local `genLines()` par mots-clés.
- RDV vocal : `rdvAI()` → brouillon (date, heure, type, client, lieu) ; repli `rdvFallback()` par expressions régulières (demain, jeudi, 14 h…).

## État
Clés persistées en local (`Component.KEEP`, clé `btp974-mobile-v1`) : `lines, client, chantier, acompte, remiseTxt, docs, devisSeq, facSeq, metier, regime, events, co, tauxMO, targetM, seuil, puHidden, ordered, relances, acompteDef, formeInfo, planMode, plans, compta, aiHistory, lcShow, payTerm, clientType, retenue, reserve, projSteps, editNo, versionOf, baseCount, sun, paAgo`.
États d'interface non persistés : `tab`, feuilles ouvertes (`recapOpen`, `metierOpen`, `help`, `mailDraft`, `rulesOpen`, `previewOpen`, `cptOpen`), `planId`, `planSel`, `toast`.
Identifiants : compteur `UID` recalé au chargement sur le maximum des id de lignes et de circuits enregistrés (évite les collisions).

En production, modèle de données suggéré : `Entreprise`, `Client`, `Devis` (+ `LigneDevis`), `Facture`, `Plan` (`diffs[]`, `circuits[]`), `Evenement`, `Projet`, `ArticleCatalogue`, `Comptable`.

## Interactions et animations
- Pression : `transform: scale(0.97)` (0.92 pour les petits ronds), transition .12 s.
- Entrée d'écran : `btpIn` .28 s (fondu + 8 px). Désactivées si `prefers-reduced-motion`.
- Focus clavier : contour 2 px `--color-accent`, décalage 2 px.
- Listes horizontales de pastilles : défilement au doigt et glisser à la souris.

## Tokens de design (système Organic)
Couleurs :
- Fond `--color-bg` #f5ead8, surface `--color-surface` #ebddc5, texte #201e1d, séparateur texte à 16 %.
- Accent terracotta #c67139 — rampe 100 #fff2eb, 200 #ffe1d0, 300 #ffc6a5, 400 #f6a06b, 500 #d67f48, 600 #b2622d, 700 #8c491a, 800 #643312, 900 #402310.
- Accent 2 sauge #7a8a5e — rampe 100 #f0fae1, 200 #e1eecc, 300 #ccdbb2, 400 #aebf92, 500 #8fa073, 600 #728157, 700 #56633f, 800 #3d472b, 900 #272e1b.
- Neutres : 100 #f9f4ed, 200 #eee7db, 300 #dcd3c4, 400 #c0b6a5, 500 #a19786, 600 #82796a, 700 #645c50, 800 #474238, 900 #2e2b25.
- Usage : texte sur fonds teintés en 700 – 900 ; texte courant en accent → `accent-700` minimum (contraste).

Typographie : titres **Caprasimo** 400 (écran 32 px / 1.05, section 20 – 24 px, −0,015 em) ; corps **Figtree** (15 px / 1.55 ; libellés 13 – 14 px 600 – 700 ; boutons 14 – 16 px 700).

Espacements : 4,4 / 8,8 / 13,2 / 17,6 / 26,4 / 35,2 px. Marges d'écran 20 px, écart entre blocs 18 – 20 px.

Rayons : 8 / 16 / 28 px ; cartes 20 – 28 px ; boutons et champs en pilule (999 px) ; feuilles 36 px.

Ombres : sm `0 1px 2px` neutre-900 14 % ; md `0 3px 10px` 16 % ; lg `0 12px 32px` 22 %.

Icônes : Lucide, trait 2,75.

## Fichiers
- `Chiffrage BTP 974 Mobile.dc.html` : prototype complet (gabarit + logique).
- `ds/styles.css` : jetons et composants du système Organic (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`…).

## Avant la mise en production
- Vérifier chaque règle normative avec les textes officiels (AFNOR, CSTB) et un professionnel ; le prototype affiche déjà que le schéma est indicatif et doit être validé (Consuel).
- Brancher une vraie plateforme agréée (PA) pour la facture électronique (réforme 2026-2027) : l'état de connexion et les statuts sont simulés.
- Remplacer les données de démo (catalogue, prix, clients, historique de CA).
- Mentions légales des devis et factures à faire relire (comptable ou juriste).

## Mise à jour v2 (suite au retour de développement)
- **Numérotation** : `docNo(préfixe, n)` → `DEV-<année>-NNN` / `FAC-<année>-NNN`. Les listes doivent accepter 4 chiffres (`DEV-2027-1024`) : ne pas tronquer, laisser le numéro passer à la ligne si besoin.
- **Haut de l'Accueil** : marge haute `max(20px, safe-area-inset-top + 12px)`.
- **Graisses** : plus de 900 ; 800 au maximum (compteurs, badges, « VE »).
- **Import de plans** : formats PNG, JPEG, WebP, GIF, PDF, 3 Mo max. Texte sous le bouton : « PNG, JPEG, WebP ou PDF · 3 Mo maximum ». Refus : toast « Format accepté : image PNG, JPEG, WebP ou PDF ».
- **Hors ligne** (`navigator.onLine`, état `offline`) :
  - pastille collante en haut de l'écran : fond neutral-900, point accent-400, « Hors ligne · tes données restent sur le téléphone » ;
  - bouton IA désactivé, libellé « IA indisponible hors ligne » ;
  - Facturation électronique : statut « Hors ligne », sous-titre « envoi à la reconnexion », point neutral-600, bouton désactivé « Synchronisation hors ligne impossible ».
- **Erreurs IA** : encart dans la carte IA (pas de toast), fond accent-200, texte accent-900 :
  - pas de réseau : « Pas de connexion : ajoute les lignes depuis le catalogue. »
  - 429 : « Trop de demandes d'un coup. Réessaie dans une minute. »
  - 400 : « Décris le chantier en une ou deux phrases. »
  - 502 / autre : « L'IA est indisponible pour l'instant. Ajoute les lignes depuis le catalogue. »
- **Compteur de caractères** du champ IA : « n / 600 » sous le champ à droite, 12 px 600, neutral-700, accent-800 au-delà de 540 ; `maxLength=600`.
- **Installer l'app** : ligne dans Réglages → Affichage et données. Sous-titre « Accès direct depuis l'écran d'accueil, même hors ligne » / « Installée sur l'écran d'accueil ». Bouton « Installer » (utilise `beforeinstallprompt` ; sinon toast avec la marche à suivre iOS ou Android).
- **Mise à jour disponible** : utiliser le toast existant, texte « Nouvelle version disponible — Recharger ».
- **Aucune ressource externe** : `_ds_bundle.js` retiré (aucun composant ne l'utilisait). Le prompt IA reste dans le prototype comme référence ; la version serveur (`server/prompts.mjs`) fait foi.
- **Règles de calcul** : inchangées dans cette version (`totals()`).

## Mise à jour v3 (réponses aux questions ouvertes)
### Mode sombre
- Réglages → Affichage et données → **Thème** : Clair / Sombre / Auto (suit `prefers-color-scheme`). Persisté (`themePref`).
- Implémentation : attribut `data-theme="dark"` sur le conteneur de l'app, qui redéfinit les jetons. Les rampes sont **inversées** (100 ↔ 900, 200 ↔ 800, 300 ↔ 700, 400 ↔ 600) pour que les couples « fond teinté clair + texte foncé » restent lisibles.
- Valeurs sombres : bg #1d1b18, surface #2a2621, texte #f3ebdd, séparateur texte à 16 %.
  - Neutres 100→900 : #35312a #474238 #645c50 #82796a #a19786 #c0b6a5 #dcd3c4 #eee7db #f9f4ed.
  - Accent 100→900 : #402310 #643312 #8c491a #b2622d #d67f48 #f6a06b #ffc6a5 #ffe1d0 #fff2eb.
  - Sauge 100→900 : #272e1b #3d472b #56633f #728157 #8fa073 #aebf92 #ccdbb2 #e1eecc #f0fae1.
  - Ombres noires 40 / 45 / 55 %. Texte du bouton primaire : #1d1b18.
- « Mode plein soleil » reste disponible dans les deux thèmes.

### Ordinateur et tablette
- Réglages → **Mise en page** : Auto (≥ 900 px de large) / Téléphone / Ordinateur. Persisté (`layout`).
- Disposition large :
  - plein écran, sans cadre ni barre d'état ;
  - **menu latéral gauche** de 248 px (fond neutral-100, bordure droite), avec le titre « Chiffrage BTP 974 » en Caprasimo 22 px, puis les 5 entrées en ligne (icône + libellé 15 px 700, pilule active) ;
  - contenu centré dans une colonne de **760 px maximum** ;
  - feuilles modales centrées, 560 px maximum.
- Tablette en portrait (< 900 px) : disposition téléphone en plein écran.

### Confirmation du devis sans acompte
- « Envoyer au client » avec un acompte à 0 % ouvre la feuille « Envoyer un devis provisoire ? » avec le texte « <n°> n'a pas d'acompte. Il partira avec la mention « Document provisoire, non définitif ». ».
- Trois actions :
  - « Ajouter un acompte de <défaut> % » (primaire) : applique l'acompte par défaut et ferme la feuille ;
  - « Envoyer quand même » (secondaire) ;
  - « Annuler ».

### Compte et connexion
- Nouvelle section **Compte**, en tête des Réglages (premier onglet).
- **Déconnecté** : texte d'explication, champ e-mail, bouton « Recevoir un code de connexion ». Écran suivant : « Code envoyé à … », champ code à 6 chiffres (`one-time-code`), boutons « Se connecter » et « Changer d'adresse ». Mention « Sans compte, tout reste enregistré sur cet appareil. »
- **Erreurs** (encart accent-200) :
  - « Indique une adresse e-mail valide. »
  - « Le code fait 6 chiffres. »
  - « Pas de connexion : réessaie une fois en ligne. »
- **Connecté** :
  - pastille aux initiales (sauge), e-mail ;
  - état de synchronisation : « Synchronisé à l'instant », « il y a n min », ou « Hors ligne · synchronisation à la reconnexion » en accent-800 ;
  - liste des appareils connectés ;
  - boutons « Synchroniser » et « Se déconnecter » (les données restent sur l'appareil).
- Côté serveur : connexion sans mot de passe (lien ou code à usage unique par e-mail), puis synchronisation des clés persistées (`Component.KEEP`). La synchronisation est **simulée** dans le prototype.

## Mise à jour v4 : export PDF des plans
- Bouton primaire « Exporter en PDF » sous le schéma unifilaire, et « Exporter en PDF avec cartouche » sous un plan image importé. Un plan PDF importé est retéléchargé tel quel.
- Le document A4 portrait (marges 12 mm) contient :
  - un cartouche : entreprise (nom, adresse, SIRET, qualification, contact) et plan (nom, type, client, chantier, devis, facture, date, indice A) ;
  - le schéma ;
  - la légende des symboles utilisés ;
  - le tableau de repérage (Rep., Désignation, Différentiel, Prot., Section, Points) ;
  - la liste des interrupteurs différentiels ;
  - les contrôles NF C 15-100 ;
  - un pied de page avec la mention « document indicatif, à valider (Consuel) ».
- Le SVG est généré **depuis les données** (`planSvg(p)`, couleurs d'impression fixes) et non copié depuis l'écran : il reste juste en mode sombre. L'export SVG utilise la même fonction.
- Prototype : impression via un iframe caché et `window.print()` (l'utilisateur choisit « Enregistrer en PDF »). En production : générer le PDF côté client (pdf-lib, jsPDF + svg2pdf) ou côté serveur, et proposer le partage natif du fichier.

## Mise à jour v5 : réponse au retour de développement
Déjà intégré au prototype (à reprendre tel quel) :
- **Plein écran** : haut de l'Accueil à `max(20px, safe-area-inset-top + 12px)`.
- **Hors ligne** : pastille sombre « Hors ligne » en haut, collante. Bouton IA désactivé (« IA indisponible hors ligne »). Facturation électronique en état « Hors ligne · envoi à la reconnexion », bouton Synchroniser désactivé. Compte : « Hors ligne · synchronisation à la reconnexion ».
- **Erreurs IA** : encart dans la carte IA (pas de toast), messages par code : `offline`, `429`, `400`, et par défaut 502. Compteur « n / 600 » sous le champ, en terracotta foncé au-delà de 540.
- **Import de plans** : « PNG, JPEG, WebP ou PDF · 3 Mo maximum » sous le bouton Importer.
- **Numéros à 4 chiffres** : numéros en police à chasse fixe, les lignes se coupent par ellipse sur le nom du client, jamais sur le numéro.
- **Installation** : Réglages → Affichage → « Installer l'app » (utilise `beforeinstallprompt`).
- **Devis sans acompte** : feuille de confirmation avant l'envoi : « Envoyer en provisoire » / « Ajouter un acompte de N % » / Annuler.
- **Compte et synchronisation**, **mode sombre**, **mise en page tablette/ordinateur** : présents (Réglages).

Nouveau dans cette version :
- **Mise à jour disponible** : pilule en bas d'écran « Nouvelle version disponible », avec les boutons « Plus tard » et « Recharger ». Côté app : émettre `window.dispatchEvent(new Event('btp:update-ready'))` quand le service worker a une version en attente, et exposer `window.__btpApplyUpdate()` (skipWaiting + reload). Sans cette fonction, le prototype recharge la page.
- Numéro du devis en cours : l'année n'est plus écrite en dur (`LIVE_NO`).
- **Graisses 800** : conservées pour les pastilles de compteur, les repères Q/ID et les badges (35 occurrences, aucune en 900). Elles restent lisibles en petite taille ; ne pas les alourdir davantage.

Reste à fournir côté design : l'**icône définitive** 512 × 512 + maskable (fichier image à produire par un graphiste ; je ne génère pas d'image).

## Mise à jour v6 : partage du plan en PDF (WhatsApp, e-mail…)
- Bouton « Partager en PDF » (écran Plan) → `sharePlanPdf(p)`. Pendant la préparation : « Préparation… », bouton désactivé.
- `planPdfBlob(p)` produit un **vrai fichier PDF** A4 sans bibliothèque : chaque page est dessinée sur un canvas 1240 × 1754 (150 dpi) puis intégrée en JPEG dans un PDF 1.4 minimal. Le schéma est dessiné depuis les données de `planDiagram` (lignes, cadres, symboles en Path2D, textes), pas depuis une capture.
- Contenu : cartouche, schéma, tableau de repérage (suite en page 2 si besoin, en-tête répété), contrôles NF C 15-100, pied de page avec numéro de page.
- Plan importé en PDF : le fichier d'origine est partagé tel quel. Image importée : elle est placée sous le cartouche.
- Partage : `navigator.share({ files: [pdf] })` (menu natif iOS/Android : WhatsApp, Mail, Drive…). Sans prise en charge (ordinateur) : le PDF est téléchargé et une feuille « PDF téléchargé » propose d'ouvrir WhatsApp (`wa.me/?text=`) ou un e-mail, pour y joindre le fichier.
- En production : garder cette logique, ou utiliser pdf-lib pour un PDF vectoriel (texte sélectionnable).

### Règle de mise en page PDF : aucun texte ni tableau coupé entre deux pages
- Chaque bloc (schéma, tableau de repérage, contrôles NF C 15-100) est mesuré avant d'être dessiné. S'il ne tient pas dans la place restante, il passe **en entier** sur la page suivante.
- Exception : un tableau plus haut qu'une page pleine se coupe **entre deux lignes**, jamais au milieu d'une ligne. La suite reprend avec le titre « (suite) » et l'en-tête de colonnes.
- Les textes longs passent à la ligne (plus d'ellipse) et un paragraphe n'est jamais coupé.
- Version imprimée (HTML) : `break-inside: avoid` sur les tableaux et les sections, `break-after: avoid` sur les titres, `orphans/widows: 3`.

## Mise à jour v7 : enrichissement de l'écran Plan (source : guide « Schéma électrique du logement », ManoMano, 2026)
- **Calibre des ID, règle de l'aval** (`idNeed`) : In ≥ Σ calibres chauffage + chauffe-eau + recharge VE + ½ × Σ autres circuits. Valeurs normalisées 25 / 40 / 63 A (`idStd`). Un ID à 63 A est considéré justifié par la règle de l'amont (contrats jusqu'à 12 kVA). Nouvelle alerte « IDn : X A, il faut au moins Y A », avec la correction « Passer en 40/63 A ».
- **Nouvelles natures de circuit** (`circNature`) : chauffe-eau (20 A), chauffage (20 A par 4 500 W), VMC (2 A), volets roulants (16 A). Chacune a une alerte et sa correction. Calibre 2 A ajouté (section 1,5 mm²).
- **Carte « Équipement minimum par pièce »** (repliable, `p.rooms`) : séjour en m², chambres, salles de bain, autres pièces de plus de 4 m², avec − / +. Minimums :
  - séjour : 1 prise par 4 m², 5 minimum ; 7 au-delà de 28 m² ;
  - chambre : 3 prises ; cuisine : 6 prises ; autre pièce : 1 prise ;
  - 1 point de centre par pièce + 1 point extérieur ; 2 prises RJ45.
  La carte compare ces minimums au schéma (socles, points lumineux, au moins 3 circuits 20 A de gros électroménager) avec ✓ / !.
- **Feuille des règles** : ajout de « Circuits spécialisés », « Contenu du schéma » (type et calibre de la protection, nombre et section des fils, usage, pièce) et « Liaison disjoncteur de branchement » (10 mm² jusqu'à 45 A, 16 mm² à 60 A, 25 mm² à 90 A ; conditions du parafoudre).
- **PDF et impression** : la colonne « Section » devient « Fils », au format 3G1,5 mm² (nombre de conducteurs et section, exigé sur le schéma).
- Le guide cite l'amendement 5 (2016). L'app garde la série 2024 comme référence : les règles reprises sont identiques dans les deux versions.

## Mise à jour v8 : plan d'implantation électrique
Dans l'écran Plan, onglets « Schéma unifilaire » et « Implantation ». Données : `p.impl = { rooms[], items[{ id, s, x, y, cid, tx }], bg, wires }`, repère 600 × 420.
- **Fond** : pièces générées depuis « Équipement minimum par pièce » (`imRooms` : séjour, cuisine et entrée en haut ; chambres, salles de bain et autres pièces en bas), ou photo/scan importé (PNG, JPEG, WebP, 3 Mo maximum, affiché à 55 %).
- **Symboles** (`IM_SYM`, style NF C 15-100 / NF EN 60617 simplifié) : point de centre, applique, interrupteur simple, va-et-vient, poussoir, prise 16 A + terre, prise 32 A, RJ45, circuit spécialisé (carré + abréviation LL, LV, CE, CH, VR, VE…), VMC, tableau.
- **Lien avec le schéma** : chaque symbole appartient à un circuit Q (une couleur par circuit, `IM_COL`). La liste des circuits affiche « placés / prévus » (points lumineux ou socles du schéma ; interrupteurs non comptés).
- **Outils** : Placer (toucher le plan), Déplacer (glisser, pointer capture ; `touch-action: none` seulement dans ce mode), Effacer. Bouton « Liaisons » : tracé du tableau vers chaque symbole du circuit, par plus proche voisin.
- **« Placer automatiquement depuis le schéma »** : la pièce est déduite du nom du circuit (séjour, chambre, cuisine, bain…). Les points lumineux sont posés en grille au centre de la pièce, les prises le long des murs, un interrupteur près de l'entrée de la pièce. Les symboles ne se chevauchent pas (`free`).
- **PDF** : une page « Plan d'implantation » entière (bloc insécable), avec la légende des symboles et la liste des circuits en couleur.

### v8.1 : tableau et agencement des pièces
- Outil **Tableau** : toucher le plan pour poser le tableau (item `s: 'tab'`). Les liaisons partent de sa position. Il se déplace aussi avec « Déplacer ».
- Outil **Pièces** : glisser une pièce pour la déplacer, glisser la poignée orange (coin bas droit) pour la redimensionner. Aimantation à 10 unités (20 cm, échelle indicative 50 unités = 1 m), taille minimale 40. La pièce choisie est surlignée ; panneau avec le nom (modifiable), les dimensions en mètres, « Supprimer » et « + Ajouter une pièce ». Avec un fond importé, les pièces ne sont visibles que dans ce mode.

### v8.2 : améliorations de l'implantation
- **Annuler** (flèche retour) : historique des 30 dernières actions par plan (`_imHist`), enregistré au début de chaque geste et avant chaque bouton (placement auto, effacer, pièces auto, ajout ou suppression de pièce).
- **Zoom ×2 / Vue entière** : le SVG passe à 200 % de largeur dans un cadre défilant (hauteur maximale 420 px). Les coordonnées restent justes.
- **Barre de progression** : « n / N points du schéma placés », sauge quand tout est placé.
- **Fiche du symbole touché** : changer de symbole (parmi ceux du circuit), réaffecter à un autre circuit (menu déroulant), supprimer. Cadre accent 2 px.

### v8.3 : assistant « Plan du logement »
Bouton primaire « Générer le plan du logement » (Implantation) → feuille en 3 questions :
1. **Surface habitable** (20 – 250 m², pas de 5).
2. **Pièces** : chambres (0 – 6), salles de bain / d'eau (1 – 4), bureau (0 – 2).
3. **Caractéristiques** (Oui / Non) : cuisine ouverte, WC séparé, cellier, garage accolé, terrasse.

L'aperçu liste les pièces et leurs surfaces (`wizRooms` : répartition par ratios, arrondie à 0,5 m²). Le plan est calculé par `wizLayout` :
- maison rectangulaire de proportion 1,6 ;
- une bande « jour » (entrée, séjour, cuisine) et une bande « nuit » (chambres, salles de bain, bureau) ;
- les pièces de moins de 7,5 m² sont empilées dans une même colonne ;
- le garage est accolé à droite, la terrasse en pointillés devant le séjour ;
- l'échelle `impl.k` (unités par mètre) sert aux cotes de l'outil « Pièces ».

La génération met aussi à jour « Équipement minimum par pièce » (séjour en m², chambres, salles de bain, autres pièces). « Générer et placer les symboles » enchaîne le placement automatique ; « Générer les pièces seules » ne place rien. Les libellés des pièces sont sur deux lignes (nom, puis m²) et s'abrègent dans les petites pièces (`fitLab`).

### v8.4 : implantation conforme aux minimums NF C 15-100 par pièce
`autoPlace` (bouton « Placer selon la norme NF C 15-100 ») remplace tous les symboles, pièce par pièce. Le type de pièce est déduit de son nom.

| Pièce | Éclairage | Prises 16 A | Autres |
| --- | --- | --- | --- |
| Séjour | 1 point de centre + interrupteur | 1 par 4 m², 5 minimum ; 7 au-delà de 28 m² | 2 RJ45 |
| Cuisine (ou partie cuisine du séjour ouvert) | 1 point de centre | 6 sur le circuit cuisine 20 A, dont 4 au-dessus du plan de travail | plaque 32 A, lave-vaisselle 20 A, four 20 A |
| Chambre | 1 point de centre + interrupteur | 3 | 1 RJ45 |
| Salle de bain | 1 point + interrupteur | 1 (hors volumes) | lave-linge s'il n'y a ni cellier ni garage |
| WC | 1 point + interrupteur | — | — |
| Entrée | 1 point + interrupteur, 1 applique extérieure | 1 si > 4 m² | tableau |
| Autres pièces > 4 m² (bureau, cellier, garage) | 1 point + interrupteur | 1 | lave-linge dans le cellier ou le garage |
| Terrasse | 1 applique extérieure | — | — |

Alignement du schéma unifilaire :
- chaque symbole est rattaché au circuit de même nature dont le nom correspond à la pièce, sinon au moins chargé ;
- limites respectées : 8 points par circuit d'éclairage, 8 socles en 16 A, 12 en 20 A, 6 sur le circuit cuisine ;
- quand un circuit est plein, un nouveau circuit est créé (par exemple « Prises chambres »), sur un ID type A pour la plaque et le lave-linge, et un nouvel ID est ajouté au-delà de 8 circuits ;
- les points des circuits d'éclairage et de prises sont ensuite mis à jour d'après les symboles posés. Le placement et le schéma concordent (« Tous les points du schéma sont placés »).

Les RJ45 ne sont rattachés à aucun circuit (réseau de communication) et s'affichent en neutre.

## Mise à jour v9 : créer un projet
- Outil « Projets en cours » : bouton primaire « + Nouveau projet » sous la liste, qui ouvre la feuille [Nouveau projet] :
  - **Client** : nom (obligatoire), téléphone ;
  - **Chantier** : adresse, type de travaux, dates de début et de fin prévue (`<input type="date">`), note d'accès ;
  - **Étapes du chantier** : liste pré-remplie selon le métier (`STEPS` dans `npVals`), étapes supprimables, ajout libre ;
  - **Options** (cochées par défaut) : « Créer le devis » (nouveau devis au nom du client, adresse en chantier) ; « Créer le plan électrique » (électricien uniquement, schéma unifilaire vide lié au devis, avec son implantation) ; « Ajouter au planning » (début de chantier à 7 h 30).
- Validation : message « Indique au moins le nom du client. » si le nom est vide.
- À la création, la fiche projet s'ouvre : mêmes fonctions que les projets existants (étapes cochables, avancement, devis, factures et plans liés, planning, appel, itinéraire).
- Stockage : `userProj` (persisté), fusionné avec les projets de démo via `projOf(id)` et `allProj()`. Il est aussi utilisé par la prise de RDV vocale (clients connus). Dans la liste, les nouveaux projets sont en tête, avec la pastille « nouveau », puis leur pourcentage d'avancement.

## Mise à jour v10 : créer une commande de matériel
- Outil « Matériel à commander » : bouton primaire « + Nouvelle commande ». L'ancien bouton « Marquer tout commandé » devient secondaire (discret, `tool.cta2`).
- Feuille [Nouvelle commande] (`ncVals`) :
  1. **Devis lié** : pastilles « Sans devis (stock) » et chaque devis qui contient du matériel. Le devis en cours est choisi à l'ouverture. Ses lignes matériel sont importées cochées, sauf celles déjà commandées.
  2. **Catalogue** : recherche (2 caractères minimum) dans le catalogue du métier, 6 résultats. « + » ajoute l'article, ou augmente sa quantité s'il est déjà dans la liste.
  3. **Articles** : case à cocher, étiquette Devis / Catalogue, fournisseur, référence, prix d'achat HT, quantité − / +.
  - Récapitulatif : nombre d'articles, nombre de fournisseurs, total HT, sous-total par fournisseur.
- « Créer la commande » crée **une commande par fournisseur** (`CMD-<année>-NNN`, persistées dans `orders` et `cmdSeq`) et marque les lignes du devis comme commandées.
- Dans la liste, les commandes apparaissent en tête avec leur statut : À envoyer (terracotta), Commandée, Reçue (sauge). Au premier toucher, l'app ouvre un e-mail au fournisseur (objet et liste des articles avec leurs références) et passe la commande en « Commandée ». Le toucher suivant la passe en « Reçue ».

### v10.1 : fiche commande
- Toucher une commande de la liste (ou la créer) ouvre la feuille [Commande] (`odVals`) : numéro, fournisseur, date, devis lié ; statut en 3 segments (À envoyer / Commandée / Reçue) ; lignes (quantité, désignation, référence, prix) ; total estimé HT.
- Actions :
  - « Envoyer par e-mail » (lien `mailto:` ouvert via un lien `target=_blank`, pour ne pas quitter l'app) ;
  - « WhatsApp » (`wa.me/?text=`) ;
  - « Partager / copier » (`navigator.share`, sinon presse-papiers).
  Tout envoi passe la commande de « À envoyer » à « Commandée ». « Supprimer la commande » demande une confirmation.
- L'ouverture de « Nouvelle commande » est pré-remplie directement avec les lignes du devis en cours.

## Mise à jour v11 : comparer les prix d'achat (Catalogue)
- Sous chaque article : pastille « n prix · dès X € ». Elle est terracotta si un fournisseur est moins cher que l'actuel, sauge si l'article est déjà au meilleur prix.
- Feuille [Comparer les prix] : une carte par fournisseur (nom, délai, prix d'achat HT, écart en € et en % par rapport au meilleur prix, barre de comparaison, prix de vente). Boutons « Choisir » / « Actuel ».
- « Choisir » enregistre le fournisseur préféré (`catPref[ref] = { fourn, achat }`, persisté). Le catalogue et les lignes du devis en cours ayant cette référence sont mis à jour : fournisseur, achat, et PU = achat × coefficient.
- Si l'article est dans le devis en cours, un encart indique l'économie possible (quantité × écart).
- **Données de démo** : `offersOf(c)` génère 2 à 3 offres par référence (écart de −12 % à +12 %, délais Stock / 24 h / 48 h / 3 à 5 j) parmi `FOURNS_974`. En production, remplacer par les tarifs fournisseurs (fichiers de prix, EDI ou API) et les remises négociées.
