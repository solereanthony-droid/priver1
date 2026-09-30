# Plateforme agréée (facture électronique) : état de l'intégration

Fiche de départ : [`PLATEFORME_AGREEE.md`](PLATEFORME_AGREEE.md). Ce document décrit ce qui est livré, comment
l'exploiter, et ce qui reste à faire avant la mise en production.

## 1. Architecture livrée

```
PWA ──HTTPS (cookie de session)──▶ server/ ──OAuth2 + TLS──▶ PA (API XP Z12-013)
 │  window.btpPA + file paQueue        │  server/pa/*              ▲
 │  (IndexedDB, rejeu hors ligne)      │  file persistante, relève  └── webhooks signés (HMAC)
```

| Fichier | Rôle |
| --- | --- |
| `server/pa/adapter.mjs` | Adaptateur **XP Z12-013 générique** (Flux + Annuaire, OAuth2) : hôtes en liste blanche, HTTPS obligatoire, délai de 30 s, pas de redirection suivie, `X-Correlation-Id` |
| `server/pa/service.mjs` | Connexion OAuth2 + PKCE, file d'envoi persistante, idempotence, nouveaux essais, relève toutes les 15 min, webhooks, encaissements (212) partiels, état `reauth` / `panne_pa` |
| `server/pa/states.mjs` | Codes 200 à 213, machine d'états (transitions interdites refusées), correspondance avec les statuts affichés |
| `server/pa/einvoice.mjs` | Contrôles bloquants avant dépôt, montants EN 16931 recalculés côté serveur, **XML CII profil EN 16931** |
| `server/pa/retry.mjs` | Délai exponentiel 2 s → 5 min avec variation, `Retry-After` respecté, 8 essais, jamais sur 4xx (sauf 408 / 429) |
| `server/pa/crypto.mjs` | AES-256-GCM (jetons et fichiers au repos), PKCE S256, HMAC à temps constant |
| `server/pa/store.mjs` | État serveur (fichier JSON, écriture atomique, droits 600) |
| `server/pa/log.mjs` | Journal JSON à champs autorisés uniquement (aucun contenu de facture) |
| `server/pa/routes.mjs`, `server/auth.mjs` | `/api/session`, `/api/pa/*`, sessions « patron » / « salarié » |
| `server/pa/mock.mjs` | PA simulée (tests, démonstration locale avec `PA_PROVIDER=mock`) |
| `src/pa/paClient.js` | `window.btpPA` : file hors ligne IndexedDB, rejeu dans l'ordre avec la même clé d'idempotence |
| `src/pa/invoicePayload.js` | Facture de l'app (format du prototype v14.2 : lignes, remise, acompte, SIREN/SIRET, date JJ/MM/AAAA) → format serveur |
| `src/hooks/usePaBridge.js` | Relie le menu de statut du prototype à `btpPA` : envoi réel si une PA est configurée, simulation « Démo » sinon ; statuts affichés synchronisés depuis le serveur |
| `GET /api/pa/config` | Public : `{ configured, sessions, role }` — l'app sait si une PA est configurée, si les sessions sont actives (écran de code) et si une session est ouverte |

## 2. Configuration (variables d'environnement)

| Variable | Rôle |
| --- | --- |
| `APP_OWNER_CODE`, `APP_STAFF_CODE` | Codes d'accès « patron » (tout) et « salarié » (aucun accès PA). Le pavé de l'app saisit **4 chiffres** : choisir un code non trivial (pas 1974, 0000, 1234…). Avec ces variables, l'app s'ouvre sur l'écran de code. |
| `PA_PROVIDER` | `xpz12` (vraie PA) ou `mock` (PA simulée). Absent : intégration désactivée (503). |
| `PA_ENC_KEY` | Clé AES-256 en base64 (`openssl rand -base64 32`), depuis un coffre. **Sans elle, le serveur refuse de démarrer la PA.** |
| `PA_NAME` | Nom affiché de la PA |
| `PA_BASE_URL`, `PA_AUTHORIZE_URL`, `PA_TOKEN_URL`, `PA_REVOKE_URL` | Adresses fournies par la PA (seuls ces hôtes sont joignables) |
| `PA_CLIENT_ID`, `PA_CLIENT_SECRET`, `PA_SCOPE` | Identifiants OAuth2 de l'app chez la PA |
| `PA_REDIRECT_URI` | `https://<domaine>/api/pa/callback`, déclarée à l'identique chez la PA |
| `PA_PATHS` | JSON pour ajuster les chemins de l'API (`flows`, `flow`, `lifecycle`, `search`, `directory`) selon la documentation de la PA |
| `PA_WEBHOOK_SECRET` | Secret HMAC des webhooks (`POST /api/pa/webhook`, en-têtes `X-Timestamp` et `X-Signature: sha256=…` sur `horodatage.corps`) |
| `PA_VALIDATOR_CMD` | Commande de validation officielle XSD + Schematron EN 16931 (XML sur l'entrée standard, code 0 = conforme) |
| `PA_RESUBMIT_REJECTED` | `1` si la PA accepte de redéposer une facture rejetée (213) sous le même numéro |
| `PA_DATA_FILE` | Fichier d'état (défaut `server/data/pa.json`, hors dépôt) |
| `APP_URL` | Page de retour après la connexion OAuth (défaut `/`) |

Démonstration locale : `APP_OWNER_CODE=… PA_PROVIDER=mock PA_ENC_KEY=$(openssl rand -base64 32) npm start`.

## 3. Sécurité : ce qui est en place

- Aucun secret PA dans l'app : le `client_secret`, les jetons et les clés restent sur le serveur. Le `refresh_token`
  et le fichier XML déposé sont chiffrés au repos (AES-256-GCM, données associées liées au locataire). Les jetons
  d'accès ne vivent qu'en mémoire.
- OAuth2 `authorization_code` + PKCE (S256), `state` aléatoire à usage unique valable 10 min, `redirect_uri` fixe.
- Hôtes PA en liste blanche, HTTPS obligatoire, aucune redirection suivie, aucune option pour ignorer TLS
  (Node vérifie les certificats ; TLS 1.2 minimum par défaut).
- Webhooks : HMAC-SHA256 sur le corps brut, comparaison à temps constant, horodatage à ± 5 min, identifiant
  d'événement mémorisé 24 h (rejeu refusé). Un webhook ne fait que déclencher une relève `getStatus()`.
- Sessions : cookie `HttpOnly`, `SameSite=Strict`, `Secure` en HTTPS ; 5 essais de code par minute et par IP, et verrou
  global progressif après 10 échecs d'affilée (15 min, 30 min… 24 h max) car le pavé de l'app saisit des codes courts ;
  compte salarié → 403 sur toutes les routes PA. Requêtes `POST` d'une autre origine refusées.
- Journaux : champs autorisés uniquement (locataire, numéro, `flowId`, `correlationId`, code HTTP, statut, durée).
- CSP de l'app inchangée : l'app n'appelle que son propre serveur.

## 4. Fiabilité : ce qui est en place

- Clé d'idempotence serveur = SHA-256(locataire + numéro + empreinte du fichier), réutilisée à chaque essai ;
  clé d'idempotence client (en-tête `Idempotency-Key`) pour les rejeux de la file hors ligne.
- Un numéro déposé ne peut jamais être réutilisé ; facture refusée (210) → nouveau numéro obligatoire.
- File persistante (survit aux redémarrages), traitée toutes les 5 s, dans l'ordre, 5 actions par passage et par locataire.
- État `panne_pa` (avec l'heure du prochain essai) sur erreur réseau ou 5xx ; retour à `connecte` au premier succès.
- Renouvellement du jeton 60 s avant expiration ; refus du renouvellement → `reauth`, la file est conservée
  et repart après reconnexion.
- Annuaire : le client doit être joignable (réponse de moins de 24 h, en cache) avant tout dépôt.
- Encaissement partiel : statut 212 avec montant, date et reste à payer ; la facture n'est soldée qu'à 0 €.

## 5. Écarts avec la fiche, à trancher

1. **Numérotation des statuts facultatifs.** La fiche indique 202 Mise à disposition, 204 Approuvée,
   208 Complétée, 209 Reçue. La liste officielle des spécifications externes donne : 202 Reçue par la plateforme,
   203 Mise à disposition, 204 Prise en charge, 205 Approuvée, 206 Approuvée partiellement, 208 Suspendue,
   209 Complétée. Le code suit la liste officielle (`server/pa/states.mjs`, une seule table). Les 4 statuts
   obligatoires (200, 210, 212, 213) sont identiques. **À confirmer avec la PA retenue.**
2. **Identifiant ISO 6523.** La fiche associe `0002` au SIRET. En ISO 6523, `0002` désigne le **SIREN**
   (SIRENE) et `0009` le SIRET. Le XML porte donc le SIREN en `0002` (identifiant légal) et l'adresse électronique
   en `0225` (annuaire français). **À confirmer avec la PA.**
3. **Clients particuliers.** La facture électronique ne concerne que les ventes entre entreprises (B2B). Pour un
   particulier (majorité des chantiers d'un artisan), il n'y a pas de dépôt de facture mais un **e-reporting** des
   opérations, non couvert par la fiche. L'envoi est refusé avec un message clair pour un client « Particulier ».
   **L'e-reporting reste à spécifier.**
4. **Format.** La fiche vise Factur-X (PDF/A-3 + XML). Livré : **CII seul, profil EN 16931**, un des trois formats
   admis. Un vrai PDF/A-3 exige des polices TTF embarquées, un profil ICC sRGB et une validation (veraPDF) ;
   produire un fichier qui se déclarerait PDF/A-3 sans l'être serait pire. Factur-X est l'étape suivante.
5. **Cadre de facturation** (BT-23) : `M1` (biens et services mêlés, cas du BTP) par défaut. Franchise en base :
   catégorie `E`, code `VATEX-FR-FRANCHISE`, mention art. 293 B ; le vendeur sans numéro de TVA : à faire valider
   par l'expert-comptable (règle BR-E-02).

## 6. Reste à faire avant la production

- **Choisir la PA** (liste officielle DGFiP) et régler `PA_*` d'après son bac à sable ; vérifier les chemins, le
  format des réponses et des webhooks, et adapter `PA_PATHS` ou écrire un adaptateur propriétaire.
- **Brancher `PA_VALIDATOR_CMD`** sur un validateur officiel EN 16931 (validateur KoSIT avec le scénario EN 16931 CII,
  ou Mustang) : aujourd'hui, seules les règles de cohérence principales sont vérifiées localement.
- **Écrans** (voir `design-handoff/DEMANDE_PA.md`) : statuts et actions, pastilles Rejetée / Refusée / En litige,
  états de connexion, réglages de la PA, **champ SIREN du client**, écran de code d'accès.
- **Factur-X** (PDF/A-3), **e-reporting** des ventes aux particuliers, factures reçues (`listInbound`).
- Archivage (10 ans) et durée de conservation de `server/data/pa.json` : à décider avec la PA et le comptable.
- Plusieurs instances du serveur : remplacer `store.mjs` par une base de données (même interface) et partager la file.
