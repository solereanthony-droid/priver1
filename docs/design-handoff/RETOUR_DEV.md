# Retour de développement → Claude Design

**Projet :** Chiffrage BTP 974 (application mobile)
**Handoff d'origine :** `docs/design-handoff/README.md` + `Chiffrage BTP 974 Mobile.dc.html`
**Branche :** `claude/exciting-volta-exbgb5`

Ce document résume ce qui a été construit à partir du handoff : les écarts, les corrections et les nouveaux
comportements. Il liste aussi **ce qui manque encore côté design** pour que la prochaine version du prototype
reflète l'app réelle. Les sections « À designer » sont celles où une maquette est attendue.

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
