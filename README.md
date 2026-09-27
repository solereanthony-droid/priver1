# Chiffrage BTP 974

Application mobile (PWA) de chiffrage pour artisans du BTP à La Réunion : devis (saisie, catalogue ou IA),
contrôle de marge, factures et suivi de la facturation électronique, planning, projets, plans unifilaires
NF C 15-100 et informations légales de l'entreprise.

Le design vient du handoff `docs/design-handoff/` (prototype haute fidélité + système Organic).

## Démarrer

```bash
npm install
npm run build
ANTHROPIC_API_KEY=... npm start      # http://localhost:8787
```

Développement avec rechargement à chaud :

```bash
npm run dev:api   # serveur IA sur :8787
npm run dev       # Vite sur :5173 (proxy /api → :8787)
```

Sans clé API, l'app fonctionne : l'IA bascule sur ses replis locaux (mots-clés pour le devis,
expressions régulières pour les rendez-vous).

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Clé de l'API Claude (côté serveur uniquement) |
| `CLAUDE_MODEL` | `claude-opus-5` | Modèle utilisé |
| `PORT` / `HOST` | `8787` / `127.0.0.1` | Écoute ; mettre `HOST=0.0.0.0` derrière un reverse proxy ou dans un conteneur |
| `AI_RATE_LIMIT` | `20` | Requêtes IA par minute et par IP |
| `TRUST_PROXY` | — | `1` pour lire l'IP client dans `X-Forwarded-For` (seulement derrière un proxy de confiance) |

## Sécurité

- **Pas de relais IA générique** : le client envoie une tâche (`devis` ou `rdv`) et un texte court ;
  les prompts sont construits dans `server/prompts.mjs`. La clé ne sert qu'à ces deux usages.
- `/api/ai` : même origine exigée, `Content-Type: application/json` obligatoire (bloque les formulaires
  inter-sites), corps ≤ 8 Ko, texte ≤ 600 caractères, `max_tokens` fixé par le serveur, limitation de débit par IP,
  délais d'expiration sur l'appel Claude et sur les requêtes HTTP.
- En-têtes : CSP stricte (scripts du site seulement, pas d'iframe), `nosniff`, `no-referrer`, COOP/CORP,
  `Permissions-Policy` (micro autorisé pour la dictée, le reste coupé).
- Fichiers statiques : chemins normalisés et confinés à `dist/`, URL mal formées refusées sans planter le serveur.
- Import de plans : PNG, JPEG, WebP, GIF ou PDF uniquement (pas de SVG/HTML), 3 Mo max ; les sources
  restaurées sont revalidées avant affichage.
- Sauvegarde locale : seules les clés attendues sont restaurées.
- Servir l'app en **HTTPS** en production (derrière un reverse proxy : Caddy, Nginx…).
- Les données restent dans le `localStorage` de l'appareil, en clair : pas de mot de passe ni de donnée
  bancaire à y mettre. Une vraie synchronisation serveur demandera une authentification.

## Organisation

| Chemin | Rôle |
| --- | --- |
| `src/app/template.html` | Gabarit des écrans, repris du prototype (`<x-dc>`) |
| `src/app/logic.js` | Logique métier du prototype (totaux, TVA DOM, NF C 15-100, DTU, planning…) |
| `src/dc/runtime.js` | Moteur qui rend le gabarit en React (`{{ }}`, `sc-if`, `sc-for`, `style-active`…) ; remplace `support.js`, absent du handoff |
| `src/styles/organic.css` | Jetons et composants du système Organic |
| `src/styles/app.css` | Styles globaux et mode plein écran sur téléphone |
| `src/claude.js` | `window.btpAI(tâche, paramètres)` → `POST /api/ai` |
| `server/index.mjs` | Sert `dist/` et exécute les tâches IA (la clé reste côté serveur) |
| `server/prompts.mjs` | Prompts IA et validation des paramètres |
| `src/app/data.js` | Données de démo partagées (catalogues, DTU, métiers, projets) |
| `docs/design-handoff/` | Handoff de design d'origine (référence) |

Sur ordinateur, l'app s'affiche dans le cadre téléphone 390 × 844 du prototype, mis à l'échelle.
Sur téléphone (≤ 520 px) ou installée en PWA, elle occupe tout l'écran, sans cadre ni fausse barre d'état.

Les données (devis, factures, réglages) sont gardées sur l'appareil (`localStorage`, clé `btp974-mobile-v1`).

## Avant la mise en production

Voir la fin de `docs/design-handoff/README.md` : validation des règles normatives par un professionnel,
branchement d'une vraie plateforme agréée (PA), remplacement des données de démo, relecture des mentions légales.
