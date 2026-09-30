# Fiche Claude Code : connexion sécurisée et fiable aux plateformes agréées (PA)

**Projet :** Chiffrage BTP 974 (PWA React + Vite)
**Date :** 2026-09-30
**Branche :** `claude/exciting-volta-exbgb5`
**Portée :** remplacer la connexion **simulée** à la plateforme agréée (`paName`, statuts Émise → Transmise → Acceptée → Encaissée) par une vraie intégration. Aucune règle de calcul (`totals()`) ne change.

---

## 1. Cadre réglementaire à respecter (résumé)

- **Calendrier.** Réception obligatoire pour toutes les entreprises depuis le 1er septembre 2026. Émission obligatoire pour les PME, TPE et micro-entreprises au 1er septembre 2027. Tant que l'utilisateur n'est pas obligé d'émettre, l'intégration doit fonctionner en mode « réception + émission volontaire ».
- **Passage obligé par une PA.** Le Portail Public de Facturation (PPF) n'échange plus les factures : il ne tient que l'annuaire central et le concentrateur de données. Son API est réservée aux PA (mTLS, certificats AIFE). **L'app ne parle jamais au PPF. Elle parle uniquement à la PA choisie par l'utilisateur.**
- **Vérifier l'agrément.** La liste officielle des PA est publiée par la DGFiP sur impots.gouv.fr (≈ 150 PA au 31/08/2026). Un statut affiché sur le site d'un éditeur ne suffit pas.
- **Formats.** Factur-X (PDF/A-3 + XML CII), UBL ou CII, tous conformes EN 16931. **Cible : Factur-X profil EN 16931.** Les profils MINIMUM et BASIC WL ne valent pas facture de vente et ne doivent pas être utilisés.
- **API standard.** La norme AFNOR **XP Z12-013** définit une API REST commune entre logiciels et PA, en deux briques (**Flux** et **Annuaire**), avec authentification **OAuth2**. Une PA qui l'expose peut être remplacée par une autre sans nouveau développement. Il n'existe pas de « certification XP Z12-013 » : on s'y aligne.
- **Cycle de vie (XP Z12-012).** 14 statuts, codes 200 à 213. **4 obligatoires** :

| Code | Statut | Posé par | Sens |
| --- | --- | --- | --- |
| 200 | Déposée | PA émettrice | La PA a contrôlé la facture et l'a acceptée en dépôt. Ce n'est **pas** une acceptation du client. |
| 213 | Rejetée | PA émettrice ou réceptrice | Anomalie technique (format, mention manquante, destinataire absent de l'annuaire). Terminal. |
| 210 | Refusée | Client | Refus métier de toute la facture, avec motif normalisé. Terminal. |
| 212 | Encaissée | **Fournisseur (notre app)** | Paiement reçu, partiel ou total, avec date et montant. |

Statuts facultatifs : la numérotation exacte est celle de la liste officielle XP Z12-012 (d'après le retour dev : 204 = Prise en charge, 205 = Approuvée, 209 = Complétée). Correspondance appliquée par l'app (`server/pa/states.mjs`) : « Transmise » pour 200 à 204 et 209, « Acceptée » pour 205, 206 et 211, « En litige » pour 207. À confirmer avec la PA retenue. Après 210 ou 213, la facture est morte : il faut émettre une nouvelle facture (ou, pour un rejet de données, régénérer le fichier avec le même numéro selon la PA).

> À faire valider par l'expert-comptable de l'utilisateur : règles d'envoi du 212 (TVA sur les débits ou sur les encaissements, BTP) et mentions propres à La Réunion (TVA 8,5 % / 2,1 %, franchise 293 B).

---

## 2. Architecture cible

```
PWA (téléphone)  ──HTTPS──▶  Serveur de l'app (server/)  ──OAuth2 + TLS 1.2+──▶  PA (API XP Z12-013)
      ▲                            │   ▲
      └──── état des factures ─────┘   └──── webhooks signés (HMAC) ou relève périodique
```

Règles :
1. **Aucun secret PA dans la PWA.** Le `client_secret`, les jetons et les clés de signature restent sur le serveur (coffre ou variables d'environnement chiffrées, jamais dans le dépôt). La PWA ne connaît qu'une session vers **notre** serveur.
2. **Un adaptateur par PA**, derrière une interface commune. Implémenter d'abord l'adaptateur **XP Z12-013 générique** ; un adaptateur propriétaire seulement si la PA choisie n'expose pas l'API AFNOR.
3. La PWA conserve son mode hors ligne : les actions « Transmettre » et « Marquer encaissée » sont mises en **file d'attente locale** et rejouées à la reconnexion (voir § 5).

### Interface de l'adaptateur (`server/pa/adapter.mjs`)
```js
// Toutes les méthodes reçoivent un contexte { tenantId, correlationId }
connect(tenantId, authCode)                 // OAuth2 authorization_code (+ PKCE) → stocke refresh_token chiffré
disconnect(tenantId)                        // révoque et efface les jetons
lookupRecipient(siren | siret)              // Annuaire : le client peut-il recevoir ? sur quelle PA ?
submitInvoice(facturxPdf, meta, idemKey)    // Flux : dépôt → { flowId, status: 'received' | 200 | 213, errors[] }
getStatus(flowId)                           // relève : dernier statut + historique
postLifecycle(flowId, code, payload)        // 212 Encaissée (date, montant), 211 éventuellement
listInbound(since)                          // factures reçues (fournisseurs de l'utilisateur)
```

---

## 3. Sécurité

### 3.1 Authentification
- **OAuth2 `authorization_code` + PKCE** pour relier le compte PA de l'artisan à l'app (l'app agit pour son compte). `client_credentials` seulement si la PA l'impose pour un éditeur partenaire.
- Paramètre `state` aléatoire vérifié au retour, `redirect_uri` fixe et enregistrée côté PA.
- Jetons d'accès en mémoire serveur uniquement ; `refresh_token` **chiffré au repos** (AES-256-GCM, clé hors base). Renouvellement automatique avant expiration ; en cas d'échec, passer l'état de connexion à `reauth` (voir § 6).
- Si la PA exige mTLS ou la signature JWT des requêtes, la clé privée reste dans le coffre du serveur.

### 3.2 Transport
- TLS 1.2 minimum, 1.3 de préférence. Vérification stricte du certificat ; aucune option « ignorer les erreurs TLS », même en recette.
- Liste blanche des hôtes PA côté serveur (pas d'URL fournie par le client → pas de SSRF).
- CSP de la PWA inchangée : la PWA n'appelle que `self` ; aucune URL de PA dans le front.

### 3.3 Webhooks entrants
- Vérifier la **signature HMAC** (`X-Signature` ou équivalent) sur le corps brut, comparaison à temps constant.
- Refuser si l'horodatage a plus de 5 minutes ; mémoriser l'identifiant d'événement pour ignorer les rejeux.
- Répondre `2xx` vite, traiter en file. Un webhook ne fait **que** déclencher un `getStatus()` : on ne fait jamais confiance au contenu seul.

### 3.4 Données
- Ne jamais écrire les XML ou PDF de facture dans les journaux (secret fiscal, RGPD). Journaliser : `tenantId`, numéro de facture, `flowId`, `correlationId`, code HTTP, code statut, durée.
- Conserver chaque `correlationId` et l'historique des statuts avec les factures (archivage 10 ans, à confirmer avec la PA qui archive aussi).
- Limiter les droits : un utilisateur « salarié » (écran pointage) n'a **aucun** accès aux routes PA.
- Débit : limiter les appels sortants par locataire (file + jeton), respecter les limites publiées par la PA et l'en-tête `Retry-After`.

---

## 4. Fiabilité de l'envoi

### 4.1 Avant l'envoi (contrôles locaux, bloquants)
À ajouter à la vérification avant facture existante (`facVerif`) :
1. Numéro unique, séquentiel, jamais réutilisé (`FAC-<année>-NNN`).
2. SIREN/SIRET vendeur et client présents et valides (clé de Luhn), identifiant avec son schéma ISO 6523 (`0002` = SIREN, `0009` = SIRET).
3. Client joignable : `lookupRecipient()` a répondu dans les 24 h (cache).
4. Cohérence EN 16931 : au moins une ligne ; total HT + TVA = TTC au centime ; catégorie TVA cohérente avec le taux (`S` + 8,5 % ou 2,1 % ; micro-entreprise : catégorie d'exonération avec la mention art. 293 B du CGI).
5. Devise `EUR` (code ISO, pas « € »).
6. Factur-X généré en **PDF/A-3** (polices embarquées : Caprasimo et Figtree sont déjà des fichiers locaux), XML profil EN 16931, niveau de conformité déclaré dans les métadonnées XMP identique au XML.
7. Validation XSD + Schematron EN 16931 **sur le serveur** avant dépôt. Échec → la facture reste « Émise », message clair, rien n'est envoyé.

### 4.2 Pendant l'envoi
- **Clé d'idempotence** = hash(tenantId + numéro de facture + hash du fichier). Réutilisée à chaque nouvel essai : un double clic, une coupure réseau ou un rejeu hors ligne ne créent jamais deux dépôts.
- Délai d'attente 30 s. Nouvel essai uniquement sur erreur réseau, 429 ou 5xx : délai exponentiel avec variation aléatoire (2 s, 4 s, 8 s… plafond 5 min), 8 essais maximum, puis état `echec` visible.
- Jamais de nouvel essai automatique sur 4xx (sauf 408 et 429) : c'est une erreur de contenu.

### 4.3 Après l'envoi
- Machine d'états locale, **seul le serveur la fait avancer** à partir des réponses PA :

```
brouillon → emise → en_file → deposee(200) → transmise(201…204, 209) → acceptee(205, 206, 211) → encaissee(212)
                        │            └──────────▶ rejetee(213)  (terminal)
                        └── echec (réseau)       └──────────▶ refusee(210)  (terminal)
                                                 └──────────▶ en_litige(207) → completee(208) → …
```
- Relève de secours : `getStatus()` toutes les 15 min pour les factures non terminales de moins de 60 jours, même si les webhooks marchent.
- 212 Encaissée : envoyé depuis l'app quand l'utilisateur confirme un encaissement (écran Encaissements). Gérer le paiement **partiel** : montant encaissé + reste à payer, la facture n'est pas soldée tant que le reste > 0.
- Refusée ou Rejetée : afficher le **motif normalisé** renvoyé par la PA, proposer « Corriger et réémettre » (nouveau numéro pour 210 ; même numéro possible pour un rejet de données 213 selon la PA).

---

## 5. Hors ligne (PWA)

- File locale `paQueue` en IndexedDB (pas `localStorage`) : `{ id, kind: 'submit'|'lifecycle', invoiceNo, idemKey, payload, tries, nextAt }`.
- Rejouée à l'événement `online` et au démarrage, dans l'ordre, avec la même clé d'idempotence.
- L'interface montre « En attente d'envoi » sur la facture et la pastille « Hors ligne » existante.

---

## 6. Correspondance avec le prototype

Le prototype affiche aujourd'hui 4 statuts simulés : **Émise, Transmise, Acceptée, Encaissée**, que l'utilisateur fait avancer à la main (menu de confirmation v14). En production :

| Prototype | Réel | Qui fait avancer |
| --- | --- | --- |
| Émise | `emise` (validée localement, pas encore déposée) ou `en_file` | Utilisateur : « Transmettre » |
| Transmise | codes 200 à 204 et 209 | **PA uniquement** |
| Acceptée | codes 205, 206, 211 | **Client via sa PA uniquement** |
| Encaissée | `encaissee` (212), total ou partiel | Utilisateur : « Marquer encaissée » → envoi 212 |
| *(absent)* | `rejetee` (213), `refusee` (210), `en_litige` (207), `echec` | PA / client / réseau |

Conséquences pour l'app :
1. Le menu de confirmation de statut ne propose que les actions **possibles pour l'utilisateur** : « Transmettre à la plateforme » (depuis Émise) et « Enregistrer l'encaissement » (depuis un statut déposé). Les passages à Transmise et Acceptée ne sont plus manuels.
2. Ajouter les pastilles **Rejetée**, **Refusée** et **En litige** (fond `--color-accent-200`, texte `--color-accent-900`) avec le motif et le bouton « Corriger et réémettre ».
3. États de connexion à la PA (carte Facturation électronique, `paVals`) : `non_connecte`, `connecte`, `sync`, `reauth` (« Reconnecte ton compte <PA> »), `hors_ligne`, `panne_pa` (« <PA> ne répond pas, nouvel essai à hh:mm »). Le nom affiché vient du compte connecté, plus de `paName` en dur.
4. Réglages → Facture électronique : choisir la PA dans la liste officielle, « Connecter mon compte » (OAuth), date de dernière relève, « Déconnecter ».

Textes à ajouter (à relire) :
- « Transmise à <PA> le <date>. Ce n'est pas encore une acceptation du client. »
- « Rejetée par la plateforme : <motif>. Corrige la facture puis réémets-la. »
- « Refusée par le client : <motif>. »
- « En attente d'envoi : la facture partira à la reconnexion. »
- « Ce client n'est pas encore joignable par facture électronique. Vérifie son SIREN. »

---

### Déjà fait dans le prototype (v14.1)
- `FAC_ST` = Émise, Transmise, Acceptée, Encaissée (0 à 3, inchangés) + **Rejetée (4), Refusée (5), En litige (6)**. Champ `motif` sur la facture.
- Menu de statut d'une facture : Émise → « Transmettre à la plateforme » ; Transmise, Acceptée ou En litige → « Enregistrer l'encaissement » ; Rejetée → « Corriger et réémettre » (même numéro, ouvre la facture) ; Refusée → « Réémettre sous un nouveau numéro » (copie en Émise, champ `replaces`) ; Encaissée → information seule. Aucun passage manuel vers Transmise → Acceptée.
- Démo : `FAC-2026-026` Rejetée, motif « SIRET du client absent de l'annuaire ». Les compteurs « transmises » et la frise de la carte Facturation électronique ignorent les statuts 4 à 6.

### Correctifs bloquants (v14.2) : données de facture
Constat : les factures ne gardaient ni lignes, ni TVA, ni SIREN client, et les dates étaient écrites en dur. Corrigé dans le prototype :
- **Instantané complet à la création** (`doFacture`) : `lines[{ name, ref, kind, unit, tva, qty, pu }]`, `rem` (remise), `ht`, `t85`, `t21`, `ttcFull`, `ac` (acompte déduit, BT-113), `ttc` (net à payer), `micro`, `devisNo`, `chantier`, `siren`, `pro`, `date`. Les factures ne dépendent plus du devis après création.
- **TVA par taux** dans l'éditeur de facture : chaque ligne garde son taux (bouton « TVA 8,5 % / 2,1 % »), ventilation recalculée avec la remise ; libellé « TVA 8,5 % + 2,1 % » si les deux taux sont présents. Avant : 8,5 % appliqué à tout.
- **SIREN / SIRET client** : champ + interrupteur « Client particulier / professionnel » dans le devis (état `cliSiren`, persisté ; `clientType` existant) et dans l'éditeur de facture. Contrôle 9 ou 14 chiffres + clé de Luhn (`SIREN_OK`). Obligatoire si client professionnel. Enregistrement de la facture refusé si invalide.
- **Vérification avant facture** : bloque si client pro sans SIREN, SIREN invalide, ou devis sans ligne.
- **Transmission** : une facture Émise sans lignes ou sans SIREN valide (client pro) propose « Compléter la facture » au lieu de « Transmettre ».
- **Dates** : `TODAY()` (JJ/MM/AAAA) pour toute création (devis, version, facture, rectificative) ; `DOC_D()` lit JJ/MM/AAAA ou l'ancien JJ/MM (année courante, ou précédente si la date tomberait plus de 30 jours dans le futur). Plus aucun `new Date(2026, …)` ni `'24/09'` / `'26/09'`.
- Facture rectificative : champ `replaces` = numéro remplacé.
- **Reste côté app** : mapper l'instantané vers le XML CII EN 16931 (BT-1 numéro, BT-2 date ISO, BT-47 : SIREN client en schéma `0002`, SIRET en schéma `0009`, BG-25 lignes, BG-23 ventilation TVA, BT-113 acompte), adresse de facturation du client distincte du chantier (champ à ajouter si besoin), et migration des anciennes factures sans lignes (les marquer « à compléter »).

## 7. Tests à écrire (`test/pa.spec.js`)

- [ ] Double appel « Transmettre » (ou rejeu hors ligne) → un seul dépôt côté PA simulée (clé d'idempotence).
- [ ] 503 puis 200 → un nouvel essai, statut final `deposee`. 400 → aucun nouvel essai, statut `emise` + message.
- [ ] 429 avec `Retry-After: 30` → nouvel essai après 30 s minimum.
- [ ] Webhook avec signature fausse, horodatage de plus de 5 min ou identifiant déjà vu → refusé, aucun changement d'état.
- [ ] Webhook valide → déclenche `getStatus()` ; l'état ne change que d'après la réponse de `getStatus()`.
- [ ] Transitions interdites refusées (ex. `encaissee` → `deposee`, sortie d'un état terminal).
- [ ] Encaissement partiel 1 500 € sur 3 000 € → 212 envoyé avec le montant, reste à payer 1 500 €, facture non soldée.
- [ ] Micro-entreprise : XML sans TVA, mention 293 B, validation Schematron OK.
- [ ] TVA La Réunion : lignes 8,5 % et 2,1 % → ventilation par taux correcte, HT + TVA = TTC au centime.
- [ ] Journaux : aucun contenu XML/PDF, `correlationId` présent sur chaque appel.
- [ ] `refresh_token` expiré → état `reauth`, aucune perte de la file d'envoi.
- [ ] Facture créée depuis un devis 8,5 % + 2,1 % avec remise 5 % : `lines`, `t85`, `t21`, `ht` identiques à `totals()` au centime.
- [ ] Client pro sans SIREN, ou SIREN à clé fausse : création et transmission bloquées.
- [ ] Date de facture = date du jour (JJ/MM/AAAA) ; ancienne date « 15/09 » lue correctement en janvier de l'année suivante.
- [ ] Compte salarié → 403 sur toutes les routes `/api/pa/*`.

---

## 8. Ce qui reste à décider par le client

1. **Quelle PA ?** Critères : présente dans la liste officielle DGFiP, API XP Z12-013 (Flux + Annuaire), bac à sable sans contrat, webhooks signés, tarif adapté à un artisan (quelques dizaines de factures par mois).
2. Validation par l'expert-comptable : envoi du statut 212, TVA sur les débits ou les encaissements, mentions DOM.
3. Qui archive (PA seule, ou copie dans l'app) et pendant combien de temps.
