# Mise à jour pour Claude Code : Alizé Pilote (ex-Chiffrage BTP 974) · v15 → v15.2

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

## Clés persistées
Nouvelles depuis v14.2 : `cliAddr`, `paAcc`, `ownerCode`.
Liste complète `Component.KEEP` :
```
'lines','client','cliSiren','cliAddr','paAcc','ownerCode','chantier','acompte','remiseTxt','docs','devisSeq','facSeq','metier','regime','events','co','tauxMO','targetM','seuil','coutMO','trRel','rh','puHidden','ordered','relances','acompteDef','formeInfo','planMode','plans','compta','aiHistory','lcShow','payTerm','clientType','retenue','reserve','projSteps','editNo','versionOf','baseCount','sun','paAgo','themePref','layout','account','userProj','orders','cmdSeq','catPref'
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
- [ ] Code 1974 → app complète ; code salarié → écran salarié seul ; 5 erreurs → blocage 1 min.
- [ ] Lien « Où le trouver ? » (SIREN) et lien liste officielle des PA en `noopener noreferrer`.

## Toujours ouvert
- Données de démo à remplacer (historique Facturation, panier moyen, transformation, export CSV taux par taux).
- XML CII EN 16931 + Factur-X PDF/A-3 depuis l'instantané (BT-47 : SIREN `0002`, SIRET `0009` ; BG-8 = `doc.addr`).
- Vérification de la marque « Alizé Pilote » (INPI) et des domaines avant publication.
- Règles NF C 15-100, mentions légales et règles TVA DOM : à faire valider par un professionnel.
