# Retour de développement → Claude Design

**Projet :** Chiffrage BTP 974 (application mobile)
**Handoff d'origine :** `docs/design-handoff/README.md` + `Chiffrage BTP 974 Mobile.dc.html`
**Branche :** `claude/exciting-volta-exbgb5`

Ce document résume ce qui a été construit à partir du handoff : les écarts, les corrections et les nouveaux
comportements. Il liste aussi **ce qui manque encore côté design** pour que la prochaine version du prototype
reflète l'app réelle. Les sections « À designer » sont celles où une maquette est attendue.


> **État au 2026-09-30.** Les sections 2 à 7 ont été traitées par les versions v5 et v12 du prototype.
> Elles restent ici pour l'historique. Le tableau ci-dessous résume l'état de chaque point, et la section 9 liste
> ce qui reste ouvert.

| Point | État |
| --- | --- |
| 2.1 Espacement haut en plein écran | ✅ Réglé en v5 (`max(20px, safe-area + 12px)`) |
| 2.2 Graisses 800 / 900 | ✅ Revu en v5 (800 conservé, aucun 900) |
| 2.3 Numéros à 4 chiffres | ✅ v5 : chasse fixe, ellipse sur le client uniquement |
| 2.4 Formats d'import affichés avant le choix | ✅ v5 / v13 |
| 3.1 Hors ligne | ✅ v5 (pastille, IA et synchronisation désactivées) ; v13 : pastille En ligne / Hors ligne à l'accueil |
| 3.2 Erreurs de l'IA + compteur | ✅ v5 (encart par code, compteur n / 600) |
| 3.3 Installer l'app | ✅ v5 (Réglages → Affichage) — **icône définitive toujours attendue** |
| 3.4 Mise à jour disponible | ✅ v5 (pilule « Nouvelle version disponible ») |
| 6 Questions ouvertes | ✅ Répondues en v5 (mode sombre, mise en page ordinateur, confirmation provisoire, compte) |
| 7.1 Thème sombre, police du PDF | ✅ Corrigé dans le prototype en v12 |
| 7.2 Assistant plan (9 pièces + terrasse) | ✅ Fiche de tests corrigée en v12 |
| 7.3 Détails du PDF | ✅ v12, vérifié sur le PDF généré (cadre ID sur 3 lignes, « 4 points lumineux » en entier, sections décalées) |
| 8.1 `noopener` sur les liens externes | ⏳ Appliqué par l'app à chaque import ; à reporter dans le prototype |
| 8.2 TVA de l'export CSV, données de démo | ⏳ Micro-entreprise corrigée par l'app (§ 9.1) ; données réelles toujours à brancher |
| 8.3 Largeur de la barre récap (ordinateur) | ✅ Voulu (confirmé le 2026-09-30) : rien à changer |

---

## 1. Ce qui a été implémenté

- **Fidélité** : le gabarit (`<x-dc>`) et la classe `Component` du prototype sont repris **tels quels**. Couleurs,
  textes, rayons, animations et règles métier sont identiques au prototype.
- **Plateforme** : application web installable sur téléphone (PWA React + Vite), et non React Native.
  Ce choix garde la logique du prototype à l'identique ; un portage natif reste possible plus tard.
- **Moteur de rendu** : `support.js` n'était pas fourni. Il est remplacé par `src/dc/runtime.js`, qui gère :
  `{{ chemin }}`, `<sc-if>`, `<sc-for>`, `style-active`, `style-hover`, `ref` et les `on*`.
- **Hors ligne** : après une première visite, l'app fonctionne sans réseau. Seule l'IA a besoin d'une connexion.

---

## 2. Écarts par rapport au prototype

### 2.1 Cadre téléphone et plein écran
| Contexte | Rendu |
| --- | --- |
| Ordinateur (> 520 px) | Cadre iPhone 390 × 844 mis à l'échelle, comme dans le prototype |
| Téléphone (≤ 520 px) ou app installée | **Plein écran** : pas de cadre, **pas de fausse barre d'état** (9:41, encoche) ; marges de sécurité iOS/Android (`safe-area-inset`) |

**À designer :** vérifier le haut de l'écran Accueil en plein écran. Sans la barre d'état simulée, le bloc
« Bonjour Julien / Mon entreprise » se retrouve à environ 10 px du bord sur les téléphones sans encoche.
Proposer l'espacement haut voulu.

### 2.2 Polices
Les polices sont maintenant **embarquées** (Caprasimo 400 et Figtree en police variable), sans appel à Google Fonts.
Le prototype ne chargeait que Figtree 400/600/700, alors que le gabarit utilise aussi **500, 800 et 900**.
Ces graisses étaient donc imitées par le navigateur. Elles sont désormais **réellement rendues**.

**À designer :** repasser sur les éléments en 800 et 900 (pastilles de compteur, libellés « VE » du schéma, badges)
et confirmer qu'ils ne paraissent pas trop lourds.

### 2.3 Numérotation des documents (bug corrigé)
Le prototype produisait `DEV-2026-0NN` avec l'année écrite en dur, ce qui donnait `DEV-2026-0100` au 100ᵉ devis.
Nouveau format : **`DEV-<année>-NNN`** et **`FAC-<année>-NNN`** (trois chiffres minimum, année en cours).

**À designer :** prévoir la largeur des numéros à 4 chiffres (`DEV-2027-1024`) dans les listes Documents,
le Récap et l'aperçu client.

### 2.4 Import de plans
Seuls les formats **PNG, JPEG, WebP, GIF et PDF** sont acceptés, 3 Mo maximum. Le SVG et le HTML sont refusés
pour des raisons de sécurité.
Nouveau message (toast) : « Format accepté : image PNG, JPEG, WebP ou PDF ».

**À designer :** indiquer les formats acceptés **avant** le choix du fichier, par exemple sous le bouton
« Importer un plan ».

---

## 3. États et écrans à designer (nouveaux comportements)

Ces comportements fonctionnent déjà, mais n'ont **aucune maquette** : aujourd'hui, ils réutilisent des éléments
existants ou ne montrent rien.

### 3.1 Hors ligne
- L'app s'ouvre sans réseau, mais **rien ne l'indique** à l'utilisateur.
- **À designer :**
  - un indicateur discret « Hors ligne » (bandeau ou pastille) ;
  - l'état du bouton « Générer avec l'IA » hors ligne : désactivé, avec une explication ;
  - l'état de « Facturation électronique → Synchroniser » hors ligne.

### 3.2 Erreurs de l'IA
Aujourd'hui, **un seul message** couvre tous les cas : « L'IA est indisponible pour l'instant. Ajoute les lignes
depuis le catalogue. » Le serveur distingue pourtant plusieurs situations :

| Cas | Code | Message proposé (à valider) |
| --- | --- | --- |
| Pas de réseau | — | « Pas de connexion : ajoute les lignes depuis le catalogue. » (**déjà en place**, texte provisoire) |
| Trop de demandes (plus de 20 par minute) | 429 | « Trop de demandes d'un coup. Réessaie dans une minute. » |
| Texte trop long (plus de 600 caractères) | 400 | « Décris le chantier en une ou deux phrases. » |
| Service IA en panne ou refus | 502 | message actuel |

**À designer :** le ton et la présentation de ces messages. Garder le toast ou utiliser un encart dans la carte IA ?
Ajouter un **compteur de caractères** (600 maximum) dans le champ IA ?

### 3.3 Installation de l'app
L'app peut être installée sur l'écran d'accueil (manifeste PWA, icône provisoire : maison blanche sur fond terracotta).

**À designer :**
- l'**icône définitive**, en 512 × 512 avec une variante « maskable » ;
- un éventuel encart « Installer l'app » dans Réglages → Affichage ;
- l'écran de démarrage (couleur de fond `#f5ead8`, déjà réglée).

### 3.4 Mise à jour disponible
Une nouvelle version s'installe en arrière-plan et s'applique à la prochaine ouverture.

**À designer (optionnel) :** un toast « Nouvelle version disponible — Recharger ».

---

## 4. Règles pour les prochains handoffs

Pour que le prochain prototype s'intègre **sans retouche** :

1. **Gabarit** : dans `{{ … }}`, uniquement des **chemins simples** (`{{ pa.facs }}`, `{{ k.onTap }}`), sans expression.
   Les balises `<sc-if value>` et `<sc-for list as>` sont gérées, ainsi que `style-active` et `style-hover`.
2. **Pas de ressource externe** : la politique de sécurité du navigateur n'autorise que les fichiers de l'app.
   Pas de CDN, pas de Google Fonts, pas de script externe comme `_ds_bundle.js`.
   Les polices et images doivent être fournies en fichiers.
3. **Pas de `<script>` ni de `onclick="…"` dans le gabarit** : toute la logique passe par `renderVals()`.
4. **IA** : ne pas écrire de prompt dans le prototype. Les prompts sont désormais côté serveur
   (`server/prompts.mjs`), avec deux tâches seulement : `devis` et `rdv`. Une nouvelle tâche IA
   (par exemple l'analyse d'un plan importé) doit être décrite dans le README du handoff : entrée, sortie JSON, repli local.
5. **Textes** : les nouveaux messages d'erreur ou d'état doivent figurer dans le gabarit ou le README, pas seulement dans les maquettes.
6. **Tests** : les règles de calcul (`totals()`) sont couvertes par des tests (`test/logic.spec.js`).
   Tout changement de règle (TVA, remise, acompte, marge) doit être signalé explicitement dans le README du handoff.

---

## 5. Inchangé, à valider par un professionnel (rappel)

- Règles NF C 15-100 et DTU : ce sont des résumés, à faire valider (Consuel, AFNOR, CSTB).
- Plateforme de facturation électronique : l'état de connexion et les statuts sont **simulés**.
- Données de démo (clients, catalogue, prix, historique de chiffre d'affaires) : à remplacer.
- Mentions légales des devis et factures : à faire relire.

---

## 6. Questions ouvertes pour le design

1. Faut-il un **mode sombre** ? Le système Organic n'a que des jetons clairs, en dehors du réglage « Mode plein soleil ».
2. Garde-t-on le **cadre téléphone** sur ordinateur, ou faut-il une mise en page tablette ou ordinateur ?
3. Faut-il une **confirmation** avant d'envoyer un devis sans acompte (statut « provisoire ») ?
4. Faut-il un espace **compte et connexion**, pour une future synchronisation entre appareils ?

---

## 7. Retour sur la mise à jour v11 (intégrée le 2026-09-27)

Tout le contenu de `MISES_A_JOUR.md` est intégré : v5 à v11, les points d'intégration (mise à jour disponible,
partage PDF, liens externes) et les nouvelles clés persistées. `totals()` est inchangé et les tests de calcul
passent sans modification. La liste « Tests à passer » est automatisée (`test/handoff.spec.js`) ou vérifiée dans le
navigateur.

### 7.1 Corrigé côté app (à reporter dans le prototype)
1. **Thème sombre inopérant.** Quand le « Mode plein soleil » est désactivé, `sun` vaut
   `{ n: 'inherit', div: 'inherit', bg: 'inherit' }`. Or le gabarit écrit `--color-bg:{{ sun.bg }}` **en ligne**,
   sur l'élément qui porte `data-theme`. `--color-bg: inherit` en ligne l'emporte sur `[data-theme="dark"]` :
   le fond restait clair. **Correction :** valeurs vides (`''`) quand le mode est désactivé, pour ne rien écrire en ligne.
2. **Police du PDF.** Le canvas utilise `Figtree`. Dans l'app, la police embarquée s'appelle `Figtree Variable` :
   un alias a été ajouté, et les graisses sont préchargées avant le dessin. Sans ce correctif, le texte débordait
   (« Disjoncteur de branchement » sortait de son cadre, titre tronqué « villa P… »).

### 7.2 Écarts avec la fiche de tests
- **Assistant plan** : avec 90 m², 3 chambres, cuisine fermée et cellier (autres réglages par défaut : WC séparé,
  1 salle de bain, pas de bureau ni de garage), le calcul donne **9 pièces + terrasse** (10 éléments), pas
  « 10 pièces + terrasse ». Détail : Entrée, Séjour (26 m²), Cuisine, Cellier, WC, 3 chambres, Salle de bain.
  Est-ce la fiche ou le calcul qui doit changer ?

### 7.3 Détails visuels relevés dans le PDF (à designer)
- Colonne « Points » du tableau de repérage : « 4 points lumi… » est coupé par une ellipse, alors que la règle v6
  interdit les ellipses. Élargir la colonne, ou passer à la ligne.
- Schéma : l'étiquette de l'ID affiche « 30 mA A » (sensibilité + type). Proposer « 30 mA · type A ».
- Schéma : la section verticale (« 1,5 mm² ») chevauche légèrement le début du nom du circuit.

### 7.4 Toujours attendu
- L'**icône définitive** 512 × 512 + maskable.

---

## 8. Retour sur les mises à jour v12 et v13 (intégrées le 2026-09-29)

Les corrections v12 (thème sombre, police du PDF, tableau de repérage, cadre des ID, sections) sont reprises.
Le catalogue électricien est complété. Toute la v13 est intégrée : encaissements, panier moyen, transformation
des devis, marge globale, vérification avant facture, aperçu des messages, recherche dans Documents,
« Implanter mes circuits », boutons retour, barre récap en mode ordinateur.
Les 12 « Tests v13 » sont automatisés (`test/v13.spec.js`) ou vérifiés dans le navigateur. Tous passent.

### 8.1 Corrigé côté app (à reporter dans le prototype)
- **Liens externes** : `window.open(href, '_blank')` ouvre `wa.me` ou le client mail sans `noopener`. La page
  ouverte pourrait alors rediriger l'onglet de l'app (« reverse tabnabbing »). L'app passe
  `'noopener,noreferrer'` en troisième argument (2 appels, dans `draft()` et l'aperçu e-mail du comptable).

### 8.2 À signaler avant la mise en production
- **Export CSV pour le comptable** : la TVA est **répartie par des ratios fixes** (`hh × 0,085 × 0,92` et
  `hh × 0,021 × 0,08`), et le HT est déduit du TTC par `/ 1,085`. Ce sont des données de démo. Le vrai
  export devra sommer la TVA des lignes de factures, taux par taux (et 0 en micro-entreprise), sinon les
  montants transmis au comptable seront faux.
- **Panier moyen et transformation** : les tables `TY`, `ART`, `CLI`, `MG`, `TR`, `QTY`, `SUG` et les délais
  (2 j, 9 j, 1,6) sont fixes. À calculer depuis les documents réels.

### 8.3 Détail visuel (mode ordinateur)
- La barre récap du devis ne passe plus sous le menu. En revanche, elle est plus large que la colonne de
  contenu : de 396 à 1 132 px pour une colonne de 528 à 1 000 px, sur un écran de 1 280 px. Est-ce voulu ?
- **Réponse (2026-09-30) : oui, c'est voulu.** La barre reste plus large que la colonne ; rien à modifier.

---

## 9. Vérification complète et corrections du 2026-09-30

Chaque point de ce document a été revérifié dans l'app (tests automatiques et navigateur). Deux bugs ont été
trouvés et corrigés côté app.

### 9.1 Corrigé côté app
1. **Sauvegarde perdue en silence (grave).** Toute la sauvegarde tenait dans `localStorage` (environ 5 Mo par site).
   Un plan importé de 2,6 Mo occupe environ 3,5 millions de caractères une fois encodé. Au **deuxième** plan, le quota
   était dépassé : **plus rien n'était enregistré**, sans aucun message. Le plan et toutes les modifications
   suivantes (client, lignes…) étaient perdus au rechargement.
   **Correction :** les gros contenus (plans importés, fonds d'implantation) sont stockés dans IndexedDB, et
   `localStorage` ne garde que des références (3 960 caractères au lieu de 3,4 millions dans le même scénario).
   Les anciennes sauvegardes sont reprises automatiquement. Si l'enregistrement échoue quand même, un message
   prévient : « Stockage plein : les dernières modifications ne sont pas enregistrées. Supprime un plan importé. »
   **À designer :** valider ce texte, et prévoir éventuellement une jauge d'espace utilisé dans Réglages.
2. **TVA affichée en micro-entreprise.** L'écran Facturation et l'export CSV calculaient la TVA (8,5 % / 2,1 %)
   quel que soit le régime. En franchise en base (art. 293 B), la TVA est maintenant à 0 et le HT est égal au TTC.
   **À reporter dans le prototype** (`statsVals`, lignes `ht / t85 / t21` et `exportCsv`).
3. **Libellé « IDn » traversé par le trait** (schéma à l'écran et PDF). Le trait d'alimentation vertical est à
   `x = 30` et le libellé était centré sur `x = 32`. **Correction :** `tx(36, yb - 22, 'ID' + (r + 1), { s: 10, w: 800, fill: K.sage })`,
   c'est-à-dire aligné à gauche, juste à droite du trait. Vérifié sur les deux plans de démo (1 et 2 différentiels).
   **À reporter dans le prototype** (`planDiagram`).

### 9.2 Toujours ouvert
- **Données réelles** : l'historique de Facturation (octobre 2025 à septembre 2026), le panier moyen et la
  transformation des devis sont des données de démo fixes. L'export CSV ne sera juste qu'une fois calculé depuis
  les factures, taux par taux.
- **Icône définitive** 512 × 512 + maskable.

---

## 10. Plateforme agréée (2026-09-30)

La connexion réelle à une plateforme agréée est livrée côté serveur et côté app (`docs/PA.md`). Les écrans
restent à faire : voir **`DEMANDE_PA.md`**, avec le contrat d'intégration `window.btpPA`.

Corrigé côté app, à reporter dans le prototype (`doFacture`) : la facture était datée « 24/09 » en dur. Elle prend
maintenant la date du jour (locale) et garde son contenu complet (`snap`).

---

## 11. Retour sur v13.1, v14, v14.1 et v14.2 (intégrées le 2026-09-30)

Tout est intégré : barre récap alignée (vérifiée : barre et contenu de 404 à 1 124 px à 1 280 px), module Équipe,
liens entre plannings, justificatifs, confirmation des statuts, statuts de la plateforme, instantané des factures,
TVA par ligne, SIREN / SIRET client, dates réelles. Tests automatisés : `test/v14.spec.js` ; vérifiés dans le
navigateur : `window.opener` nul pour WhatsApp, justificatif joint et envoyé dans IndexedDB.

### 11.1 Branché côté app
- **Menu de statut ↔ plateforme agréée** (`src/hooks/usePaBridge.js`) : quand une plateforme est configurée sur le
  serveur, « Transmettre à la plateforme » et « Enregistrer l'encaissement » partent réellement (file hors ligne
  comprise) et les statuts affichés (y compris Rejetée / Refusée / En litige et le motif) viennent du serveur.
  Sans plateforme configurée : la simulation du prototype reste, avec un toast « Démo : aucune plateforme agréée
  configurée, action simulée ». Plateforme configurée mais sans session : rien n'est simulé, un message dit quoi faire.
  Vérifié de bout en bout avec la PA simulée : connexion OAuth, Transmettre, dépôt, statut « Transmise » venu du serveur.
- Nouveau champ sur la facture : `paQueued` (action en attente d'envoi) et `paRemaining` (reste à encaisser).
  **À designer :** les afficher (« En attente d'envoi », « payé X € · reste Y € »).

### 11.2 Corrigé côté app (à reporter dans le prototype)
- **Justificatifs de notes de frais** : le contrôle `/^image\/|pdf/` acceptait le SVG et tout type contenant « pdf ».
  Remplacé par `/^(image\/(png|jpeg|webp)|application\/pdf)$/`, message « Photo (PNG, JPEG, WebP) ou PDF uniquement ».
  L'attribut `accept="image/*,application/pdf"` peut rester (appareil photo), le contrôle fait foi.

### 11.3 Points à corriger dans le prototype ou la fiche
1. **`0002` n'est pas le SIRET.** En ISO 6523, `0002` = SIREN (SIRENE), `0009` = SIRET. Le XML de l'app met le SIREN
   (9 premiers chiffres) en `0002` et, si un SIRET à 14 chiffres est saisi, le SIRET en `0009`. Corriger la mention
   « BT-47 préfixé `0002` pour un SIRET » dans `MISES_A_JOUR.md` et `PLATEFORME_AGREEE.md`.
2. **Codes de statut facultatifs** (v14.1 : « Transmise ← 200/201/202/209, Acceptée ← 204 ») : dans la liste officielle,
   204 = Prise en charge, 205 = Approuvée, 209 = Complétée. L'app affiche « Acceptée » pour 205, 206 et 211, et
   « Transmise » pour 200 à 204 et 209 (`server/pa/states.mjs`). À confirmer avec la PA retenue.
3. **Date d'encaissement** : « Enregistrer l'encaissement » écrit encore `paidOn` en JJ/MM (sans l'année), alors que
   v14.2 passe toutes les dates en JJ/MM/AAAA. En mode plateforme, la date envoyée est la date ISO du jour.
4. **Clients particuliers** : pas de facture électronique (B2B uniquement) ; prévoir l'e-reporting. Le bouton
   « Transmettre » ne devrait pas apparaître pour un client particulier (aujourd'hui, le serveur refuse avec un message).

### 11.4 Toujours à designer (voir `DEMANDE_PA.md`)
Écran de code d'accès, réglages de la plateforme (connecter / déconnecter, dernière relève), les 7 états de connexion
dans la carte Facturation électronique, encaissement partiel, « En attente d'envoi ».

---

## 12. Retour sur v15, v15.1 et v15.2 (intégrées le 2026-09-30)

Tout est intégré : nom **Alizé Pilote** (titre, manifeste, `apple-mobile-web-app-title`, README ; clé de sauvegarde
`btp974-mobile-v1` conservée), icônes `any` + `maskable` 192 / 512 (précachées pour le mode hors ligne), jauge d'espace,
adresse de facturation, écran de code d'accès, 7 états de connexion, encaissement partiel, « En attente d'envoi ».
Tests : `test/v15.spec.js` (liste v15), `test/auth.spec.js` ; parcours complet vérifié dans le navigateur avec le vrai
serveur : écran de code → code patron → Réglages « Connecter mon compte » (OAuth) → « Transmettre » → « Transmise à
<PA> le JJ/MM/AAAA » → encaissement partiel 500 € (« Payé 500,00 € · reste 585,00 € », 212 reçu par la PA) →
« Verrouiller maintenant » ferme la session serveur.

### 12.1 Branchements réalisés (tableau « Branchements côté app »)
| Prototype | Dans l'app |
| --- | --- |
| `paConn()`, `paName()`, `paAcc` | `paSt`, `paAcc { name, since }` et `paAgo` alimentés par `btpPA.status()` |
| « Connecter » / « Déconnecter » | `btpPA.connect()` / `disconnect()` ; échec (pas de PA, pas de session) → message clair |
| « Transmettre » | `btpPA.transmit(toPaInvoice(doc, coData()))`, adresse de facturation `doc.addr` (BG-8) |
| Encaissement (montant + date), « Marquer encaissée » | `btpPA.recordPayment(no, montant, 'AAAA-MM-JJ')` pour un client professionnel |
| `paQueued`, `paPaid`, `paRemaining`, `paSentAt`, `errors`, `motif`, `st` | écrits depuis `invoices()`, `pending()` et `btp:pa-update` |
| `paFlush()` | neutralisé quand le serveur répond (la vraie file est rejouée par l'app) |
| Écran de code `lk` | avec des sessions sur le serveur : code vérifié par `login()`, verrou au démarrage sans session, `logout()` au verrouillage |
| Jauge `store` | contrainte la plus serrée entre `localStorage` (5 Mo) et IndexedDB / quota de `navigator.storage.estimate()` |

Sans serveur joignable (démo statique), le prototype garde toutes ses simulations.

### 12.2 Sécurité du code d'accès (à reprendre dans le design)
> **Traité le 2026-10-01** : voir la section 14 (codes à 6 chiffres, plus aucun code en clair, portée du verrou).

1. **4 chiffres, c'est court.** 10 000 combinaisons : la limite de 5 essais par minute et par IP ne suffisait pas
   (quelques heures, moins avec plusieurs adresses). Ajouté côté serveur : verrou **global** progressif après 10 échecs
   d'affilée (15 min, puis 30, 60… jusqu'à 24 h), message « Trop d'essais : accès bloqué jusqu'à hh:mm ».
   **Proposition : passer le pavé à 6 chiffres** (6 points) pour le code patron.
2. **`ownerCode` en clair dans la sauvegarde locale** (`KEEP`, démo `1974`) : lisible par quiconque accède au
   navigateur. En mode serveur, il n'est pas utilisé (le serveur vérifie `APP_OWNER_CODE`). Pour la démo, le stocker
   haché ou le retirer de `KEEP`.
3. **Le verrouillage est un écran**, pas un chiffrement : les données locales (devis, factures, clients) restent
   lisibles dans le stockage du navigateur. À mentionner dans l'aide (« Verrouiller » protège l'usage de l'app, pas
   un téléphone perdu déverrouillé).

### 12.3 Corrigé côté app (à reporter dans le prototype)
- **Réémission d'une facture refusée** : la copie prenait encore une date JJ/MM (`toLocaleDateString` jour + mois) ;
  remplacée par `TODAY()` (JJ/MM/AAAA).

### 12.4 Toujours ouvert
Données réelles (historique, panier moyen, transformation, CSV taux par taux), Factur-X PDF/A-3, e-reporting des
ventes aux particuliers, vérification de la marque « Alizé Pilote » (INPI, domaines, stores).

## 13. Audit Web Interface Guidelines (2026-10-01)

Le prototype a été passé au crible des *Web Interface Guidelines* (accessibilité, focus, formulaires, animation,
typographie, thème). Base saine : aucun `<div onClick>`, zoom autorisé, `prefers-reduced-motion` respecté,
`tabular-nums` sur les montants, `aria-live` sur le toast, fenêtres en `role="dialog" aria-modal`, Échap géré.

### 13.1 Corrigé côté app (rien à faire dans le prototype)
- Les 161 SVG reçoivent `aria-hidden="true"` (pictos décoratifs) sauf s'ils ont un `role` ou un `aria-label`.
- Les 35 boutons-icônes nommés seulement par `title` reçoivent le même texte en `aria-label` (le `title` n'est pas
  lu de façon fiable sur mobile).
- `spellcheck` coupé sur les champs e-mail et téléphone.
- Thème sombre : `color-scheme` et `<meta name="theme-color">` suivent le thème choisi (barres de défilement,
  champs natifs, barre d'état du téléphone).
- `touch-action: manipulation` (pas de délai au double tap), surbrillance tactile neutralisée (le retour vient
  déjà de `style-active`), `overscroll-behavior: contain` sur les fenêtres.
- Anneau de focus clavier sur `select`, `textarea` et le champ de recherche des Documents (son `outline:none` en
  ligne le supprimait).

### 13.2 À reprendre dans le prototype
1. **Champs sans libellé** : seul le `placeholder` les nomme (il disparaît à la saisie). Ajouter un `<label>` ou un
   `aria-label` : texte de l'Assistant IA (l. ~268), Client et Adresse du chantier du devis (~319, ~330), titre
   d'intervention du planning (~1836), recherche du catalogue (~2708), recherche du nouveau chantier (~3355),
   « Ajouter une étape » (~3424).
2. **Interrupteurs** (`role="switch"`, ex. « Masquer les prix unitaires », « Mode plein soleil ») : sans nom
   accessible. Relier au texte voisin par `aria-labelledby` ou ajouter `aria-label`.
3. **Titres** : aucun `<h1>`–`<h3>` ; les titres d'écran sont des `<div>`. Utiliser `<h1>` pour le titre d'écran et
   `<h2>` pour les sections : les lecteurs d'écran naviguent par titres.
4. **Champs e-mail / téléphone** : ajouter `autocomplete` (`tel`, `email`) sur la fiche du nouveau chantier ; pour
   les destinataires d'e-mail, `autocomplete="off"` évite la proposition de sa propre adresse.
5. **Placeholders** : terminer par « … » et montrer un exemple (« Client » → « Mme Payet… »).
6. **Animations de largeur** (`transition: width/left`, 6 jauges) : préférer `transform: scaleX()` (fluide sur les
   téléphones d'entrée de gamme).
7. **Images** (justificatifs, plans importés) : `width`/`height` explicites pour éviter les sauts de mise en page.

## 14. Écran de verrouillage : codes à 6 chiffres, aucun code en clair (2026-10-01)

Suite de la § 12.2. Les décisions sont écrites dans `GLOSSARY.md` (Code d'accès, Code patron, Code salarié, Écran de
verrouillage, Verrouillage automatique, Code à renouveler) et dans deux ADR : `docs/adr/0001` (le verrou protège
l'usage de l'app, pas les données de l'appareil) et `docs/adr/0002` (codes gérés dans l'app, vérifiés un par un par
le serveur). « Code maître » n'est plus employé : on dit **Code patron**.

### 14.1 Ce que fait l'app
- **Ce que protège le verrou** : il sépare les rôles sur un téléphone partagé et empêche un tiers d'ouvrir l'app.
  Il ne chiffre pas les devis, factures et clients. Texte dans Réglages : « Le code protège l'accès à l'app, pas les
  données du téléphone : verrouille aussi ton téléphone. »
- **6 chiffres partout** (patron et salariés) : 6 points, validation automatique au 6ᵉ chiffre. 000000, 123456,
  654321… sont refusés pour le Code patron et ne sont jamais générés.
- **Aucun code en clair** : empreinte PBKDF2 dans la sauvegarde locale (mode démo), empreinte scrypt sur le serveur
  (`server/data/auth.json`, 0600). Le code de démo `1974` est supprimé.
- **Écran de code à chaque ouverture**, en démo comme avec le serveur (le rechargement ne déverrouille plus). Le
  blocage après trop d'essais est le même dans les deux modes et survit au rechargement : 5 essais par minute, puis
  après 10 échecs d'affilée « Trop d'essais : accès bloqué jusqu'à hh:mm » (15 min, 30, 60… jusqu'à 24 h).
- **Premier lancement sans serveur** : « Choisis ton code patron », puis « Confirme ton code patron ». Avec un serveur,
  le premier code vient de `APP_OWNER_CODE` (6 chiffres obligatoires).
- **Code salarié propre à chacun** : créé au hasard par le patron (Équipe → fiche du salarié → « Créer son code » /
  « Nouveau code »), affiché **une seule fois** avec « Envoyer par WhatsApp » et « C'est noté ». Ensuite, la fiche
  montre « Accès pointage · code actif depuis le JJ/MM/AAAA ». Avec un serveur, c'est lui qui génère le code et la
  session porte l'identifiant du salarié (corrige l'ancien `APP_STAFF_CODE` commun). Un nouveau code ferme les
  sessions de ce salarié.
- **« C'est bien toi, Kévin ? »** après un code salarié : « Oui, c'est moi » ouvre son pointage, « Non, ce n'est pas
  moi » revient à l'écran de code.
- **Changer le code patron** (Réglages → Code d'accès) : code actuel, nouveau code, confirmation, « Annuler ». Avec
  un serveur, il faut être en ligne (bouton « Connexion requise pour changer le code ») et les autres appareils sont
  déconnectés.
- **Verrouillage automatique** (Réglages → Code d'accès) : Immédiat, 1 min, 5 min (par défaut), 15 min en arrière-plan.
- **Code patron oublié** : avec un serveur, l'hébergeur le réinitialise (`docs/PA.md`) ; sans serveur, il faut
  réinitialiser l'app (les données de l'appareil sont effacées). Texte affiché dans Réglages.
- **Anciennes sauvegardes** : `ownerCode` n'est plus repris, l'app demande un nouveau Code patron ; les codes salariés
  à 4 chiffres sont désactivés, la fiche affiche « Code à renouveler » (« L'ancien code ne fonctionne plus. »).

### 14.2 Clés de sauvegarde (`KEEP`)
- Retirée : `ownerCode`. Ajoutées : `ownerHash`, `lkGuard` (blocage), `lockDelay` (minutes, 5 par défaut).
- Salarié : `pin` retiré ; `code: { hash | srv, at }` (empreinte locale, ou code tenu par le serveur) ; `pinRenew`
  après migration.
- États non persistés : `lkStep` (`login`, `setup`, `setup2`, `old`, `new`, `new2`, `who`), `lkTmp`, `lkOld`, `lkWho`,
  `lkBusy`, `lkChange`, `authMode` (`server` / `local`), `restored`, `rhPin` (code affiché une fois).

### 14.3 À designer / à reporter dans le prototype
- Les écrans ci-dessus n'ont pas de maquette : ils reprennent l'écran de code existant (titre en `<h1>`, 6 points) et
  la carte « Accès pointage ». À valider : ton des textes, écran « C'est bien toi ? », carte « Nouveau code »
  (code en grand, « Envoie-le maintenant : il ne sera plus affiché »), réglage du verrouillage automatique.
- Retirer du prototype : `ownerCode` et la ligne « Code patron (démo) », les `pin` en clair des salariés de démo et
  l'affichage du code sur la fiche, le contrôle `c === OWNER` et `slice(0, 4)` dans `lockVals()`.
- Tests : `test/lock.spec.js` (app), `test/auth.spec.js` et `test/pa.spec.js` (serveur). Parcours vérifié dans le
  navigateur, avec le serveur puis sans serveur : premier code, code salarié, « C'est bien toi ? », changement du
  Code patron, rechargement ; aucun code en clair dans `localStorage`.
