# Mise à jour pour Claude Code : Alizé Pilote (ex-Chiffrage BTP 974) · v15 → v15.8

**Date :** 2026-09-30
**Base :** l'app telle qu'intégrée après `RETOUR_DEV-5.md` (v14.2 comprise).
**Référence :** `Chiffrage BTP 974 Mobile.dc.html` (même dossier) : gabarit `<x-dc>` et classe `Component` = source de vérité. Icônes dans `icons/`. Détail de la connexion à la plateforme : `PLATEFORME_AGREEE.md`.
**Historique complet** (v5 à v15.2) : `MISES_A_JOUR.md`.

## Comment appliquer
1. Reprendre le gabarit et la classe `Component` du fichier fourni (règles §4 du retour dev respectées : chemins simples, pas de ressource externe, pas de `<script>`, pas de prompt IA).
2. Ajouter les nouvelles clés persistées (ci-dessous). La clé de sauvegarde `btp974-mobile-v1` **ne change pas**.
3. Brancher les écrans sur `window.btpPA` et la session (tableau « Branchements »).
4. Copier `icons/` et mettre à jour le manifeste.
5. Passer la liste de tests en fin de fiche.

**`totals()` inchangé.** Aucune règle de calcul (TVA, remise, acompte, marge) ne bouge : `test/logic.spec.js` doit passer tel quel.

## v15.8 : finitions d'interface (2026-10-01)

`totals()` inchangé. Nouvelle clé persistée : `absInfo`.

### Bouton Verrouiller (Accueil)
- Cadenas rond 44 px (`--color-accent-200` / `--color-accent-900`, survol `--color-accent-300`) à droite du choix du métier, dans un groupe `flex` gap 8 px. `onClick = lockNow` → `lock()` (efface aussi la session d'onglet). `aria-label="Verrouiller l'app"`.
- Démo : le code patron choisi au premier lancement reste enregistré (`ownerHash`) ; ne pas le réinitialiser entre deux démonstrations.

### Onglets des écrans Outils (Projets, Devis, Planning, Matériel)
- `role="tablist"` / `role="tab"` + `aria-selected` (`t.sel`). Hauteur 64 px, bordure 2 px (`t.bd` : `--color-neutral-400`, ou `--color-neutral-900` si actif ; `--color-neutral-700` au survol), fond `--color-neutral-100` (actif : `--color-neutral-900`).
- Compteur en Caprasimo 22 px, libellé Figtree 700 13 px (avant : 15 px / 11 px). Sous-titre de l'écran 15 px 600 `--color-neutral-800`.
- `body` : `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility`.

### Équipe › Nouvelle absence
- Titres de groupe « Salarié » et « Type d'absence » (13 px 700 `--color-neutral-800`).
- Types en `role="radiogroup"` : grille `repeat(auto-fill, minmax(140px, 1fr))`, cases de 60 px, rayon 18 px, rond de sélection 18 px (point 8 px sauge si choisi), libellé + précision : Congés payés « payés par la caisse », Maladie « arrêt de travail », Intempéries « chantier arrêté », Formation « CFA, stage », Sans solde « non rémunéré ». Champs ajoutés à `af.types[]` : `sub`, `ring`, `dot`.

### Équipe › Règles d'absence (repliables)
- Même modèle que les particularités des formes juridiques : lien « ? Masquer les règles d'absence » / « Voir les règles d'absence » (`aria-expanded`), encadré sauge `--color-accent-2-200` avec rubriques en petites capitales (Congés payés, Intempéries, Apprenti) et la note « Règles 2026, à confirmer avec ton comptable. »
- `rh.absInfo` = { on, label, toggle, rows[] } ; état `absInfo` persisté (ouvert par défaut).

### Équipe › Ajouter des heures (même style que Nouvelle absence)
- Plus d'encadré intérieur ni de traits : titres simples « Salarié », « Chantier » (avec « prévu : … » à droite), « Durée ».
- Chantiers en `role="radiogroup"`, cases 52 px avec rond de sélection (champs `ring`, `dot` ajoutés à `f.ch[]`).
- Durée : − / + de 48 px dans une barre arrondie `--color-surface` ; heures en Caprasimo 32 px.
- Panier repas : interrupteur dans un bloc `--color-surface` rayon 18 px, 56 px de haut.

### Tests v15.8
- [ ] Cadenas de l'Accueil → écran de code ; recharger → code toujours demandé.
- [ ] Lecteur d'écran : onglets annoncés « onglet, sélectionné » ; types d'absence et chantiers annoncés comme boutons radio.
- [ ] Règles d'absence masquées → toujours masquées après rechargement.
- [ ] Ajouter des heures : choisir un salarié présélectionne son chantier prévu ; ajout d'une ligne inchangé.

## v15.7 : moins de demandes de code (2026-10-01)

Constat : le code était redemandé à chaque rechargement (`locked: true` au démarrage), même quelques secondes après l'avoir saisi.
- Session d'onglet `sessionStorage['btp974-session']` = { role, rhEmp (salarié seulement), at }. Écrite au déverrouillage, toutes les 15 s d'activité au plus et au passage en arrière-plan ; effacée par `lock()`.
- Au chargement : si `at` date de moins de `lockDelay` minutes (5 par défaut), l'app s'ouvre directement avec le même rôle. Délai « Immédiat » (0) : code toujours demandé. Onglet ou app fermés : `sessionStorage` vidé, code demandé.
- Aucun code ni empreinte dans cette session ; mode `server` non concerné (`session()` côté serveur fait foi).
- Tests : saisir le code, recharger → pas de code ; attendre plus que le délai, recharger → code ; « Verrouiller maintenant », recharger → code.

- **Bouton Verrouiller** (cadenas rond 44 px, fond `--color-accent-200`) en haut à droite de l'Accueil, à côté du choix du métier : appelle `lock()` (efface la session d'onglet). « Verrouiller maintenant » reste dans Réglages.
- Démo : le code patron choisi au premier lancement reste enregistré (`ownerHash` dans `KEEP`) ; ne pas le réinitialiser entre deux démonstrations.

## v15.6 : changement d'état d'un devis (2026-10-01)

- **Choix libre** : les 4 états du devis sont des pastilles (`cfOpts`, `role="radio"`) ; l'état suivant est présélectionné (le précédent si le devis est Facturé). Le bouton dit « Passer en … » ou « Revenir à … ». Factures inchangées (flèche actuel → suivant).
- **Blocages** (`A.warn`, bandeau d'alerte terracotta, bouton à 45 % d'opacité, pastille marquée « bloqué ») :
  - Brouillon → Accepté ou Facturé : « Devis pas encore envoyé : envoie-le au client avant de le passer en … »
  - Envoyé → Facturé : « Le client n'a pas encore accepté ce devis : passe-le d'abord en accepté, avec son e-mail de validation. »
- **Passage en Accepté = e-mail de validation obligatoire** : encart sauge avec « Demander la validation par e-mail » (brouillon d'e-mail au client, devis en pièce jointe, demande de réponse « Bon pour accord » ; à l'envoi, `valReqAt` = date du jour) et « Joindre la réponse du client » (capture PNG / JPEG / WebP ou PDF, 3 Mo max). Sans pièce jointe, le bouton reste inactif.
- Nouveaux champs du devis : `valReqAt`, `accProof` ({ src, name, pdf }), `accAt`. Retour à Brouillon ou Envoyé efface `accProof` et `accAt`.
- **À faire côté app** : stocker `accProof` en IndexedDB (comme les justificatifs), et l'archiver avec la facture issue du devis (preuve d'accord du client).
- Tests : Brouillon → Accepté refusé avec l'alerte ; Envoyé → Accepté impossible sans pièce jointe, possible avec ; Accepté → Brouillon efface la preuve.

## v15.5 : écran de verrouillage (MISE_A_JOUR_VERROU.md appliquée)

La fiche `MISE_A_JOUR_VERROU.md` (2026-10-01) est appliquée **telle quelle** au prototype : utilitaires d'accès avec leurs commentaires de bornes (« Blocage après trop d'essais » … « Fin des utilitaires d'accès »), `lock()`, `lkSubmit()`, `lockVals()`, `lockSetVals()`, `staffCode()`, migration au chargement, verrouillage automatique, et les trois blocs du gabarit (§ 5.1, 5.2, 5.3). `scripts/import-handoff.py` peut donc s'exécuter sur ce prototype.
- Remplace la v15.4 sur ce point : plus d'empreinte `OWNER_H` ni de code `974974` ; codes à 6 chiffres pour tous (PBKDF2) ; `lkTries` supprimé.
- Seuls écarts par rapport au texte de la fiche, pour rester cohérent avec §13.2 : le titre « Code d'accès » de Réglages est un `<h2>` et le `<h1>` de l'écran de code reçoit `line-height:inherit`.
- `KEEP` = liste du § 3 de la fiche.
- Tests : ceux du § 8 de `MISE_A_JOUR_VERROU.md`.

## v15.4 : retour RETOUR_DEV §12 et §13 (2026-10-01)

`totals()` inchangé.

### §12.2 Sécurité du code d'accès
- **Code patron à 6 chiffres** (6 points sur l'écran). Code salarié : 4 chiffres (`rh.staff[].pin`). Le pavé teste un code salarié à 4 chiffres, puis le code patron à 6.
- **`ownerCode` retiré de `KEEP`** : le prototype ne garde qu'une empreinte (`Component.OWNER_H`, FNV-1a, démo `974974`). C'est une protection de démo, pas une sécurité : en production, seul le serveur vérifie (`APP_OWNER_CODE`).
- **Blocage progressif** (reflet du serveur) : 5 erreurs → 1 min (« Trop d'essais : patiente une minute ») ; 10 erreurs d'affilée → 15 min, puis 30, 60… jusqu'à 24 h, message « Trop d'essais : accès bloqué jusqu'à hh:mm ». Nouvel état non persisté `lkFails`.
- **Aide** sous Réglages › Code d'accès : « "Verrouiller" protège l'usage de l'app. Il ne chiffre pas les données : un téléphone perdu et déverrouillé reste lisible. Verrouille aussi ton téléphone. »
- Libellé de l'écran : « Patron : 6 chiffres · salarié : 4 chiffres ».

### §12.3 Réémission d'une facture refusée
- La copie prend `TODAY()` (JJ/MM/AAAA). Plus aucun `toLocaleDateString` jour + mois pour une date de document.

### §13.2 Accessibilité
1. **Champs nommés** : `aria-label` sur l'assistant IA, Client, Adresse du chantier, titre d'intervention, deux recherches du catalogue (`type="search"`), « Ajouter une étape ».
2. **Interrupteurs** : `aria-label` sur Masquer les prix unitaires, Retenue de garantie 5 %, Réserve de propriété, Mode plein soleil. Les 4 autres (`role="switch"` avec texte à l'intérieur) ont déjà un nom.
3. **Titres** : 14 `<h1>` (titre d'écran, taille 32, « Code d'accès », « Bonjour … ») et 74 `<h2>` (titres de section 20 à 28 px). Style en ligne `margin:0;font-weight:400;line-height:inherit;letter-spacing:normal` pour un rendu identique (la feuille Organic met h1/h2 à 1,12 et −0,015 em).
4. **autocomplete** : `name`, `tel`, `street-address` sur la fiche nouveau chantier et le devis ; destinataires d'e-mail et coordonnées du comptable en `autocomplete="off"` + `spellcheck="false"`.
5. **Placeholders** : terminés par « … » avec un exemple (« Client : Mme Payet… », « Adresse du chantier : 12 rue des Letchis… », « SIREN ou SIRET : 812 453 678… »…).
6. **Jauges** : les 6 animations de largeur passent en `scale: <pct> 1` + `transform-origin: left` (propriété CSS `scale`, pourcentage accepté) ; le curseur de marge en `translate: <pct> 0` sur un calque pleine largeur. Les extrémités arrondies se tassent légèrement pendant l'animation, c'est attendu.
7. **Images** : `width`/`height` explicites sur les miniatures de justificatifs (44 × 44, 64 × 64) et l'aperçu (600 × 480, hauteur fixe 480 px, `object-fit: contain`). Plans importés : dimensions lues à l'import (`iw`, `ih` sur le plan, nouveaux champs) et `aspect-ratio` ; anciens plans : 4 / 3 par défaut.

### Tests v15.4
- [ ] Code `974974` → app complète ; code salarié à 4 chiffres → écran salarié ; `ownerCode` absent de la sauvegarde locale.
- [ ] 10 codes faux → « accès bloqué jusqu'à hh:mm » (15 min).
- [ ] Facture refusée réémise : date JJ/MM/AAAA.
- [ ] Lecteur d'écran : navigation par titres sur chaque écran ; tous les champs et interrupteurs annoncés.
- [ ] Jauges (marge, espace, projet, implantation, fiche entreprise) animées sans saut ; curseur de marge suit la barre.
- [ ] Import d'un plan 1600 × 900 : pas de saut de mise en page, `iw`/`ih` enregistrés.

## v15.3 : écran Facturation en tableau de bord (2026-10-01)

Écran `05 Facturation` réorganisé en tableau de pilotage, sur le modèle des 4 blocs d'un tableau de bord du bâtiment (activité, marge, trésorerie, RH) avec 3 ou 4 indicateurs par bloc et un statut par rapport à une cible. Calculs de `totals()` inchangés ; tout est dans `statsVals()` → `st.*`.

**Ordre de l'écran**
1. Sélecteur de période (inchangé).
2. **Bandeau santé** (`st.health`) : « N alertes · N à surveiller » ou « Tous les indicateurs sont dans la cible ».
3. Grille 2 colonnes sur grand écran (1 sur téléphone) : carte CA (inchangée) + **« À traiter »** (`st.alerts`) : factures impayées depuis plus de 30 jours, factures rejetées ou refusées, envois en attente vers la plateforme, devis envoyés sans réponse depuis 10 jours. Chaque ligne mène à l'écran concerné.
4. **3 blocs d'indicateurs** (`st.blocks`), chacun avec sa question :
   - Trésorerie, « Est-ce que l'argent rentre ? » : Encaissé, Reste à encaisser (cible < 10 % du CA), Délai de paiement (cible 30 j), TVA à reverser.
   - Activité, « Aurai-je du travail dans 3 mois ? » : Transformation (cible 40 %), Carnet de commandes en semaines de travail (cible 4), Devis à relancer.
   - Rentabilité, « Est-ce que je gagne de l'argent ? » : Marge moyenne (cible 30 %), Panier moyen, Factures émises.
   - Pastille par indicateur : Conforme (sauge), À surveiller (orange clair), Alerte (terracotta). Seuils dans `lvl()`.
5. Grille responsive : Évolution, Statut sur la plateforme, Meilleurs clients, TVA collectée + export CSV (blocs inchangés). L'ancienne grille de 4 tuiles est remplacée par les blocs.

**À faire côté app**
- Brancher les valeurs réelles : délai de paiement (aujourd'hui `23 j` fixe) = moyenne (date d'encaissement − date de transmission) ; transformation, carnet et marge depuis `docs` (déjà calculés ainsi).
- Les cibles (10 %, 30 j, 40 %, 4 semaines, 30 %) sont des valeurs par défaut : prévoir de les rendre réglables dans Réglages (à designer si besoin).

**Tests**
- [ ] Une facture Transmise datée de plus de 30 jours apparaît dans « À traiter » et le bandeau passe en alerte si le reste à encaisser dépasse 20 %.
- [ ] Aucune alerte → « Rien d'urgent… » et bandeau sauge.
- [ ] Mode ordinateur : CA et « À traiter » côte à côte ; téléphone : empilés.

## Clés persistées
Nouvelles depuis v14.2 : `cliAddr`, `paAcc` (`ownerCode` retiré en v15.4 ; champs de plan `iw`, `ih`).
Liste complète `Component.KEEP` :
```
'lines','client','cliSiren','cliAddr','paAcc','ownerHash','lkGuard','lockDelay','chantier','acompte','remiseTxt','docs','devisSeq','facSeq','metier','regime','events','co','tauxMO','targetM','seuil','coutMO','trRel','rh','puHidden','ordered','relances','acompteDef','formeInfo','absInfo','planMode','plans','compta','aiHistory','lcShow','payTerm','clientType','retenue','reserve','projSteps','editNo','versionOf','baseCount','sun','paAgo','themePref','layout','account','userProj','orders','cmdSeq','catPref'
```
États non persistés ajoutés : `paSt`, `stPay`, `storeEst`, `locked`, `lkCode`, `lkErr`, `lkTries`, `lkUntil`, `role`.
Nouvelle prop (Tweaks, revue design uniquement) : `paState` (`connecte` par défaut).

## Branchements côté app
| Prototype | À brancher sur |
| --- | --- |
| `paConn()` (7 états) | `btpPA.status().state` ; `hors_ligne` si `navigator.onLine` est faux |
| `paName()` / `paAcc` | `btpPA.status().paName` ; « Connecté depuis » = date de connexion |
| « Connecter mon compte » / « Déconnecter » | `btpPA.connect()` / `btpPA.disconnect()` (déjà appelés si `window.btpPA` existe) |
| « Transmettre à la plateforme » | `btpPA.transmit(toPaInvoice(doc, coData(), { buyerSiren }))` |
| Encaissement (montant + date) | `btpPA.recordPayment(no, montant, 'AAAA-MM-JJ')` ; convertir la date JJ/MM/AAAA saisie |
| `paQueued`, `paPaid`, `paRemaining`, `errors`, `motif`, `st` | `btpPA.invoices()`, `btpPA.pending()`, événements `btp:pa-update` / `btp:pa-error` |
| `paFlush()` (simulation) | supprimer : la file réelle est rejouée par l'app |
| Écran code d'accès `lk` | `login(code)`, `session()`, `logout()` ; blocage réel côté serveur ; rôle `owner` / `staff` |
| Jauge d'espace `store` | `localStorage` + IndexedDB rapportés à `navigator.storage.estimate().quota` |

## Mise à jour v15.2 : nom de l'app « Alizé Pilote » (2026-09-30)

Le nom retenu est **Alizé Pilote** (l'alizé, vent de La Réunion qui porte et guide ; « pilote » : piloter son entreprise depuis l'app).
- Prototype : en-tête de la barre latérale (mode ordinateur), pied de Réglages « Alizé Pilote · version démo », pied des PDF de plan « Édité avec Alizé Pilote le … » (HTML et canvas).
- **À faire côté app** : `manifest.webmanifest` → `"name": "Alizé Pilote"`, `"short_name": "Alizé Pilote"` (12 caractères, tient sous l'icône) ; `<title>` ; `apple-mobile-web-app-title` ; textes des e-mails et partages qui citent l'ancien nom ; README. La clé de sauvegarde `btp974-mobile-v1` **ne change pas** (sinon les données locales seraient perdues).
- Avant publication : vérifier la marque (INPI, classes 9 et 42), les domaines (.fr, .re, .com) et les stores.

## Mise à jour v15.1 : derniers écrans ouverts (2026-09-30)

`totals()` inchangé. Ferme les derniers points « à designer » de RETOUR_DEV (§3.3, §9.1, §9.2) et l'adresse de facturation.

### Icône de l'app (RETOUR_DEV §3.3 / §9.2)
- Fichiers dans `icons/` : `icon-512.svg`, `icon-512.png`, `icon-192.png` (usage `any`) et `icon-maskable-512.svg`, `icon-maskable-512.png`, `icon-maskable-192.png` (usage `maskable`, motif dans la zone sûre de 80 %).
- Motif : maison et éclair crème `#f5ead8` sur terracotta `#c67139`, pastille sauge `#7a8a5e`. Fond plein, sans coins arrondis (le système les applique).
- Manifeste :
```json
"icons": [
  { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
],
"background_color": "#f5ead8", "theme_color": "#c67139"
```
- Ajouter `<link rel="apple-touch-icon" href="/icons/icon-192.png">` pour iOS. Aperçu de l'icône dans Réglages › Affichage › Installer l'app.

### Jauge d'espace (RETOUR_DEV §9.1)
- Réglages › Affichage et données › « Espace utilisé » : barre (sauge < 60 %, terracotta 60–85 %, terracotta foncé ≥ 85 %), « X Mo sur 5 Mo (sauvegarde locale) », nombre de plans importés et de justificatifs, usage de l'appareil via `navigator.storage.estimate()`.
- À 85 % ou plus : « Presque plein : supprime un plan importé pour continuer à enregistrer. » + bouton « Voir les plans ».
- Texte du toast d'échec validé : « Stockage plein : les dernières modifications ne sont pas enregistrées. Supprime un plan importé. »
- **Dans l'app** : la base doit être la taille de la sauvegarde `localStorage` + IndexedDB (plans, fonds, justificatifs) rapportée au quota de `estimate()`, pas 5 Mo fixes.

### Adresse de facturation du client
- Nouvel état persisté `cliAddr` : champ « Adresse de facturation (si différente du chantier) » sous le SIREN dans le devis, et dans l'éditeur de facture.
- Instantané de facture : `addr` = `cliAddr`, ou l'adresse du chantier si vide. À utiliser pour le XML (BG-8, adresse de l'acheteur).
- Vérification avant facture : client professionnel sans adresse → « Adresse de facturation du client manquante. »

### Tests v15.1
- [ ] Icônes 192 et 512 valides dans le manifeste (Lighthouse « installable »), maskable correctement rognée en cercle.
- [ ] Jauge : importer des plans fait monter le pourcentage ; au-delà de 85 %, l'encart et « Voir les plans » apparaissent.
- [ ] Client pro sans adresse de facturation : vérification bloquée ; adresse saisie → présente dans `doc.addr` de la facture.

## Mise à jour v15 : retours RETOUR_DEV §11 et DEMANDE_PA (2026-09-30)

`totals()` inchangé. Tous les points restants de `DEMANDE_PA.md` (3, 4, 5, 6, 8, 9) sont maquettés, ainsi que les corrections §11.2 et §11.3 du retour dev.

### Corrections reportées
- **Justificatifs** (§11.2) : contrôle `/^(image\/(png|jpeg|webp)|application\/pdf)$/`, message « Photo (PNG, JPEG, WebP) ou PDF uniquement ». `pdf` = `type === 'application/pdf'`.
- **ISO 6523** (§11.3.1) : `0002` = SIREN, `0009` = SIRET. Mentions corrigées ici et dans `PLATEFORME_AGREEE.md`.
- **Codes facultatifs** (§11.3.2) : `PLATEFORME_AGREEE.md` reprend la correspondance de `server/pa/states.mjs` (Transmise 200–204 et 209 ; Acceptée 205, 206, 211 ; à confirmer avec la PA).
- **Date d'encaissement** (§11.3.3) : `paidOn` en JJ/MM/AAAA partout (menu de statut et écran Encaissements).
- **Particuliers** (§11.3.4 / point 8) : plus de « Transmettre » pour un client particulier. Le menu propose « Enregistrer l'encaissement » avec la mention « Facture à un particulier : pas de facture électronique. Les ventes aux particuliers seront déclarées en e-reporting. » Ligne « Client particulier : pas de facture électronique (e-reporting) » sous la facture.

### Nouveaux champs de facture lus par le gabarit
`paQueued` (bool), `paPaid` (déjà encaissé), `paRemaining` (reste), `paSentAt` (JJ/MM/AAAA), `errors[]` (contrôles renvoyés par la PA), `motif`. L'app peut les écrire depuis `invoices()` / `btp:pa-update` ; le prototype les simule.
Ligne d'état sous chaque facture (`paLine`, Documents et carte Facturation électronique), par ordre de priorité :
1. « En attente d'envoi : la facture partira à la reconnexion. » (`paQueued`)
2. « Payé X € · reste Y € » (encaissement partiel)
3. « Transmise à <PA> le <date>. Ce n'est pas encore une acceptation du client. »
4. « Rejetée par la plateforme : <motif>. Corrige la facture puis réémets-la. » / « Refusée par le client : <motif>. »
5. « Client particulier : pas de facture électronique (e-reporting). »

### Menu de statut (compléments)
- **Encaissement partiel** (point 4) : champs « Montant encaissé (€) » (prérempli avec le reste) et « Date » (JJ/MM/AAAA, pas dans le futur). Montant > reste refusé. Reste > 0 : statut inchangé, `paPaid` / `paRemaining` mis à jour, toast « Encaissement partiel : reste X ». Reste = 0 : Encaissée. Le récap affiche « Déjà encaissé » et « Reste ». En mode plateforme : `recordPayment(no, montant, 'AAAA-MM-JJ')`.
- **Hors ligne** (point 3) : « Transmettre » ou un encaissement pro hors ligne met `paQueued` ; le menu n'offre plus d'action tant que l'envoi attend. À la reconnexion (`online`, état `connecte`), `paFlush()` vide la file (dans l'app : `pending()` et l'événement `btp:pa-update`).
- **Plateforme non prête** : Émise + état `non_configure` → « Choisir ma plateforme » ; `non_connecte` / `reauth` / `panne_pa` → « Connecter mon compte » (ouvre Réglages), avec le message adapté.
- **Erreurs de contrôle** (point 10) : `errors[]` affichées dans un encart orange du menu (démo : FAC-2026-026, « SIREN du client absent ou invalide »).
- Compte salarié : aucune action sur les statuts (« Réservé au patron »).

### Carte « Facturation électronique » et Réglages (points 5 et 6)
- `paConn()` : `hors_ligne` si pas de réseau, sinon `state.paSt` ?? prop `paState` ?? `connecte`. Les 7 états : `non_configure`, `non_connecte`, `connecte`, `sync`, `reauth`, `hors_ligne`, `panne_pa`, chacun avec libellé, pastille, action et message (« Reconnecte ton compte <PA>… », « <PA> ne répond pas, nouvel essai à hh:mm. »…). Dans l'app : brancher sur `btpPA.status()`.
- `paName()` : nom du compte connecté (`paAcc.name`, persisté), sinon prop `paName`. Plus de « FactuPro 974 » en dur dans la logique.
- Réglages › Facture électronique : plateforme, connexion, dernière relève, « Connecté depuis », envois en attente, bouton d'action, « Déconnecter », lien vers la liste officielle. `connect()` / `disconnect()` appellent `window.btpPA` s'il existe, sinon simulation. Section masquée pour un salarié.
- Nouvelle prop (Tweaks) `paState` pour revoir chaque état.

### Écran de code d'accès (point 9)
- Superposition plein écran (`lk`), pavé 3 × 4, 4 points, « Code incorrect », blocage 60 s après 5 erreurs : « Trop d'essais : patiente une minute ».
- Code patron (démo `1974`, clé persistée `ownerCode`) → rôle `owner`. Code d'un salarié (`rh.staff[].pin`) → rôle `staff` : ouvre directement son écran pointage / notes de frais ; « Se déconnecter » revient au code.
- Réglages › Code d'accès : « Verrouiller maintenant ». Dans l'app : `login(code)`, `session()`, `logout()` ; le blocage réel est côté serveur.

### SIREN (point 7)
- Lien « Où le trouver ? annuaire-entreprises.data.gouv.fr » sous le champ (devis si client professionnel, éditeur de facture). Liens externes en `rel="noopener noreferrer"`.

### Nouvelles clés
`paAcc` ({ name, since }), `ownerCode`. États non persistés : `paSt`, `stPay`, `locked`, `lkCode`, `lkErr`, `lkTries`, `lkUntil`, `role`.

### Tests v15
- [ ] SVG ou fichier « x-pdf » refusé comme justificatif ; PNG, JPEG, WebP, PDF acceptés.
- [ ] Facture particulier : aucun « Transmettre » ; encaissement possible avec la mention e-reporting.
- [ ] Encaissement de 500 € sur 1 173 € : « Payé 500,00 € · reste 673,00 € », statut inchangé ; second encaissement de 673 € → Encaissée, `paidOn` JJ/MM/AAAA.
- [ ] Montant supérieur au reste, ou date future : refusé.
- [ ] Hors ligne : « Transmettre » → « En attente d'envoi », compteur Réglages = 1 ; retour en ligne → Transmise + « Transmise à <PA> le <date> ».
- [ ] Prop `paState` = `non_configure` / `non_connecte` / `reauth` / `panne_pa` : carte, Réglages et menu affichent le bon libellé et la bonne action.
- [ ] Déconnecter → `non_connecte` ; Connecter → `connecte`, « Connecté depuis » = date du jour.
- [ ] Code 1974 → app complète ; code d'un salarié → écran salarié seul, sans réglages ni transmission ; 5 codes faux → blocage 1 minute.

## Tests (récapitulatif v15 → v15.2)
- [ ] Nom « Alizé Pilote » : barre latérale (ordinateur), pied de Réglages, pied des PDF de plan, `<title>`, manifeste (`name`, `short_name`).
- [ ] Anciennes données toujours présentes après la mise à jour (clé `btp974-mobile-v1` inchangée).
- [ ] Icônes : 192 et 512 `any` + `maskable` ; installable (Lighthouse) ; aperçu dans Réglages › Installer l'app.
- [ ] Jauge d'espace : monte à l'import de plans ; encart « Presque plein » et « Voir les plans » à 85 %.
- [ ] Client pro sans adresse de facturation : vérification avant facture bloquée ; adresse présente dans `doc.addr`.
- [ ] Justificatifs : SVG et types « …pdf » exotiques refusés ; PNG, JPEG, WebP, PDF acceptés.
- [ ] Particulier : pas de « Transmettre » ; encaissement avec mention e-reporting.
- [ ] Encaissement partiel 500 € sur 1 173 € → « Payé 500,00 € · reste 673,00 € » ; solde → Encaissée, `paidOn` JJ/MM/AAAA ; montant > reste ou date future refusés.
- [ ] Hors ligne : Transmettre → « En attente d'envoi » ; retour réseau → Transmise.
- [ ] 7 états de connexion : carte, Réglages et menu de statut cohérents.
- [ ] Premier lancement → « Choisis ton code patron » (6 chiffres) ; code salarié à 6 chiffres → « C'est bien toi, … ? » ; voir § 8 de MISE_A_JOUR_VERROU.md.
- [ ] Lien « Où le trouver ? » (SIREN) et lien liste officielle des PA en `noopener noreferrer`.

## Toujours ouvert
- Données de démo à remplacer (historique Facturation, panier moyen, transformation, export CSV taux par taux).
- XML CII EN 16931 + Factur-X PDF/A-3 depuis l'instantané (BT-47 : SIREN `0002`, SIRET `0009` ; BG-8 = `doc.addr`).
- Vérification de la marque « Alizé Pilote » (INPI) et des domaines avant publication.
- Règles NF C 15-100, mentions légales et règles TVA DOM : à faire valider par un professionnel.
