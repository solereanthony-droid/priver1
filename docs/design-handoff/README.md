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
- **Numérotation** : `DEV-2026-0NN`, `FAC-2026-0NN`, versions `-V2`.
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
