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
expressions régulières pour les rendez-vous). Le modèle se règle avec `CLAUDE_MODEL`
(défaut `claude-opus-5`).

## Organisation

| Chemin | Rôle |
| --- | --- |
| `src/app/template.html` | Gabarit des écrans, repris du prototype (`<x-dc>`) |
| `src/app/logic.js` | Logique métier du prototype (totaux, TVA DOM, NF C 15-100, DTU, planning…) |
| `src/dc/runtime.js` | Moteur qui rend le gabarit en React (`{{ }}`, `sc-if`, `sc-for`, `style-active`…) ; remplace `support.js`, absent du handoff |
| `src/styles/organic.css` | Jetons et composants du système Organic |
| `src/styles/app.css` | Styles globaux et mode plein écran sur téléphone |
| `src/claude.js` | `window.claude.complete` → `POST /api/complete` |
| `server/index.mjs` | Sert `dist/` et relaie l'IA vers l'API Claude (la clé reste côté serveur) |
| `docs/design-handoff/` | Handoff de design d'origine (référence) |

Sur ordinateur, l'app s'affiche dans le cadre téléphone 390 × 844 du prototype, mis à l'échelle.
Sur téléphone (≤ 520 px) ou installée en PWA, elle occupe tout l'écran, sans cadre ni fausse barre d'état.

Les données (devis, factures, réglages) sont gardées sur l'appareil (`localStorage`, clé `btp974-mobile-v1`).

## Avant la mise en production

Voir la fin de `docs/design-handoff/README.md` : validation des règles normatives par un professionnel,
branchement d'une vraie plateforme agréée (PA), remplacement des données de démo, relecture des mentions légales.
