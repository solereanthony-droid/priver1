# Mises à jour pour Claude Code : Alizé Pilote (ex-Chiffrage BTP 974)

**Date :** 2026-10-01 (v15.8)
**Base :** le code livré après le retour de développement (`RETOUR_DEV.md`), c'est-à-dire le handoff jusqu'à la v4 (export PDF des plans).
**Référence :** `Chiffrage BTP 974 Mobile.dc.html`, fourni dans ce dossier. Le gabarit `<x-dc>` et la classe `Component` restent la source de vérité.

## v15.3 à v15.8 (2026-10-01)

Détail complet dans `MISE_A_JOUR_v15.md` : tableau de bord Facturation (v15.3), sécurité et accessibilité RETOUR_DEV §12–13 (v15.4), écran de verrouillage MISE_A_JOUR_VERROU (v15.5), changement d'état d'un devis avec e-mail de validation (v15.6), session d'onglet (v15.7), finitions d'interface Équipe et Outils + bouton Verrouiller (v15.8).

---

## Comment appliquer
1. Remplacer le gabarit et la classe `Component` par ceux du fichier fourni. Les règles de ton retour sont respectées : chemins simples dans `{{ }}`, pas de ressource externe, pas de `<script>` dans le gabarit, pas de prompt IA ajouté.
2. Ajouter à la persistance les nouvelles clés d'état (voir ci-dessous).
3. Brancher les deux points d'intégration signalés (mise à jour disponible, service worker).
4. Lancer la liste de tests en fin de document.

**Règles de calcul** : `totals()` (TVA, remise, acompte, marge) **n'a pas changé**. Les tests `test/logic.spec.js` doivent passer sans modification. Seul le choix d'un fournisseur (v11) change `achat` et `pu` sur les lignes concernées, avec la même formule qu'avant (`pu = achat × COEF`).

## Nouvelles clés d'état persistées
Liste complète `Component.KEEP` :
```
'lines','client','cliSiren','cliAddr','paAcc','ownerCode','chantier','acompte','remiseTxt','docs','devisSeq','facSeq','metier','regime','events','co','tauxMO','targetM','seuil','coutMO','trRel','rh','puHidden','ordered','relances','acompteDef','formeInfo','planMode','plans','compta','aiHistory','lcShow','payTerm','clientType','retenue','reserve','projSteps','editNo','versionOf','baseCount','sun','paAgo','themePref','layout','account','userProj','orders','cmdSeq','catPref'
```
Nouvelles par rapport à la v4 : `userProj`, `orders`, `cmdSeq`, `catPref`. Les plans (`plans`) gagnent les champs `impl` (implantation) et `rooms` (équipement par pièce).

## Nouvelles fonctions (classe `Component` et module)
- Plan :
  - `planIssues` (enrichi), `roomsVals`, `implVals` ;
  - `planPdfBlob` (page implantation) et `sharePlanPdf` ;
  - `idNeed`, `idStd`, `imDef`, `imRooms`, `wizRooms`, `wizLayout`, `fitLab` ;
  - `IM_SYM`, `IM_COL`.
- Projets : `projOf`, `allProj`, `npVals`.
- Commandes : `ncVals` (nouvelle commande), `odVals` (fiche commande).
- Catalogue : `offersOf` et `FOURNS_974` (offres de démo, **à remplacer par les vrais tarifs**).
- Divers : `LIVE_NO` (numéro sans année en dur).

## Points d'intégration côté app
- **Mise à jour disponible** : émettre `window.dispatchEvent(new Event('btp:update-ready'))` quand le service worker a une version en attente, et exposer `window.__btpApplyUpdate()` (skipWaiting puis rechargement).
- **Partage PDF** : `navigator.share({ files })` sur mobile, téléchargement + feuille WhatsApp / e-mail sinon. Vérifier que la CSP autorise les URLs `blob:` et `data:` pour les images.
- **Liens externes** (`mailto:`, `wa.me`) : ils s'ouvrent via un lien `target=_blank` créé à la volée, pour ne pas quitter la PWA.

---

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


---

## Mise à jour v12 : réponse au retour v11 (RETOUR_DEV §7)
**7.1 Corrections reportées dans le prototype**
1. **Thème sombre** : `sun` vaut maintenant `{ n: '', div: '', bg: '' }` quand le « Mode plein soleil » est désactivé. Rien n'est écrit en ligne, et `[data-theme="dark"]` s'applique.
2. **Police du PDF** : la pile de polices du canvas et du SVG exporté est `'Figtree Variable', Figtree, system-ui, sans-serif`. Les graisses 400 à 800 des deux noms sont préchargées, puis `document.fonts.ready` est attendu avant le dessin.

**7.2 Assistant plan** : **c'est la fiche de tests qui change.** Le calcul est correct : 9 pièces + terrasse (Entrée, Séjour 26 m², Cuisine, Cellier, WC, 3 chambres, Salle de bain). Test corrigé : « 90 m², 3 chambres, cuisine fermée, cellier → 9 pièces + terrasse (10 éléments) ».

**7.3 Détails visuels**
- Tableau de repérage (PDF) : colonnes redistribuées `[0, 14, 72, 98, 116, 138]` mm. La colonne « Points » passe de 26 à 48 mm, et « 4 points lumineux » tient sans ellipse.
- Cadre des ID sur le schéma : trois lignes, « 40 A », « 30 mA », « type A » (au lieu de « 30 mA A » qui débordait du cadre de 48 unités).
- Section verticale : décalée à `x + 16.5` (`x + 17` quand le nom tient sur deux lignes), au lieu de `x + 12`. Plus de chevauchement avec le nom du circuit.

**7.4** L'icône définitive reste à produire par un graphiste (je ne génère pas d'image).

### v12.1 : catalogue électricien complété
27 articles ajoutés à la **fin** de `CAT_RAW.elec`, pour ne pas décaler `CAT_RAW.multi = elec.slice(16, 22)`. Deux nouvelles familles de filtre : « Conduits » et « Connexion ».
- **Goulottes et moulures** : goulottes 60×40 et 80×60, moulures 20×10 et 32×12,5, angles et embouts.
- **Tubes IRL rigides** (type Tubiro) : Ø16, Ø20 et Ø25 en 3 m, manchons et coudes, colliers.
- **Gaines ICTA** : Ø16 et Ø25, gaines préfilées 3G1,5 et 3G2,5.
- **Wago** : 221-412, 221-413, 221-415, 2273-203, 2273-205.
- **Boîtes** : boîte de dérivation IP55, boîte d'encastrement placo.
- **Fils et câbles** : H07V-U 1,5 et 2,5 mm², H07V-R 10 mm² vert/jaune, R2V 3G6.
- **Petites fournitures** : embouts de câblage, colliers de serrage.

Les prix d'achat sont indicatifs (démo).

### v12.2 : famille « Petit matériel »
Nouveau filtre du catalogue électricien. 12 articles ajoutés à la fin de `CAT_RAW.elec` : chevilles à frapper et Molly, vis, cavaliers, ruban isolant, gaine thermorétractable, repères de câbles, étiquettes de tableau, bornier de terre, mastic coupe-feu, foret SDS Ø6, scie cloche Ø68. Trois articles changent de famille : embouts de câblage, colliers de serrage, colliers IRL.

---

## Mise à jour v13 : encaissements, indicateurs, vérification avant facture (2026-09-29)

**Règles de calcul** : `totals()` n'a pas changé. Aucun envoi au client n'est automatique : tout e-mail ou message WhatsApp passe par un aperçu modifiable, et toute facture par une vérification.

### Nouvelles clés d'état persistées
Ajouter à `Component.KEEP` : `'coutMO'`, `'trRel'`. Liste complète :
```
'lines','client','chantier','acompte','remiseTxt','docs','devisSeq','facSeq','metier','regime','events','co','tauxMO','targetM','seuil','coutMO','trRel','puHidden','ordered','relances','acompteDef','formeInfo','planMode','plans','compta','aiHistory','lcShow','payTerm','clientType','retenue','reserve','projSteps','editNo','versionOf','baseCount','sun','paAgo','themePref','layout','account','userProj','orders','cmdSeq','catPref'
```
États non persistés ajoutés : `facVerif`, `fvChecks`, `fvOpen`, `simRem`, `panSort`, `panCl`, `docQ`. Documents : champ optionnel `paidOn` (jj/mm) posé par « Marquer encaissée ».

### Nouveaux onglets (`s.tab`)
`enc` (Encaissements), `panier` (Panier moyen), `transfo` (Transformation des devis). Libellés ajoutés à la table du bouton retour : `enc: 'Encaissements'`, `panier: 'Panier moyen'`, `transfo: 'Transformation'`.

### Nouvelles fonctions
- `encVals(docs)` : encaissé / à encaisser, relevé des payées, factures dues (échéance date + 30 j), regroupement par client et chantier (devis acceptés, acomptes, reste à facturer).
- `trVals(docs)` : taux en nombre et en valeur, entonnoir Créés → Envoyés → Acceptés → Facturés, relances J+3 / J+7 / J+15 (`trRel`), acceptés à facturer, taux par segment.
- `draft(o, cb)` : ouvre l'aperçu modifiable (e-mail ou WhatsApp). `o = { title, channel: 'mail'|'wa', subject, body, to, attach }`. `cb` n'est appelé qu'après « Ouvrir », jamais à la fermeture.
- `implantFrom(planId)` : crée ou reprend le schéma unifilaire du devis lié et pose l'image importée en fond (`impl.bg`), puis ouvre la vue Implantation.
- `statsVals` : ajoute `htTxt`, `encTxt`, `waitTxt`, `goEnc`, `exportCsv` et l'objet `pan` (panier moyen).
- `margeVals` : ajoute marge globale (matériel + MO), `coutMO` (coût horaire chargé, 32 € par défaut), prix plancher, simulateur de remise, correction des lignes sous le seuil.
- Liste Documents : recherche `docQ` (sans accents), `docChips` (4 statuts), `docSum`, action directe par document (`hasAct`, `act`, `onAct`).

### Changements par écran
**Accueil**
- Titre : nom de l'entreprise des Réglages, prénom abrégé (« J. Hoarau Électricité »). Forme juridique en tête ou nom d'un seul mot : affiché en entier. « Bonjour Julien » supprimé.
- Pastille En ligne (sauge) / Hors ligne (terracotta) sous le titre, pilotée par `s.offline`, `role="status"`.
- Tuile « CA facturé TTC » : sous-titre « dont X encaissé », ouvre `enc`.
- Tuile « Transformés en facture » : ouvre `transfo`.

**Encaissements** (nouveau, écran complet)
- Encaissé / À encaisser côte à côte.
- Relevé des encaissements, bouton « Voir les non payées ».
- Relance e-mail / WhatsApp via `draft()`, « Marquer encaissée ».
- Par client et chantier.

**Facturation**
- Graphique « Par mois » supprimé (doublon de la courbe).
- Carte du haut : HT / Encaissé / En attente + « Voir les encaissements ».
- Tuile « En attente de paiement » : ouvre `enc`. Tuile « Panier moyen » : ouvre `panier`.
- TVA : mention de période + « Exporter pour le comptable (CSV) » (UTF-8 avec BOM, séparateur `;`, décimales à virgule).

**Panier moyen** (nouveau)
- En-tête avec évolution.
- Par type d'intervention, composition matériel / MO.
- Articles les plus vendus : tri Quantité / CA HT / Marge, rang, tendance.
- Par client : tri Panier / Cumulé / Fréquence, initiales, 3 articles avec quantités, suggestion « À proposer ».
- **Données de démo fixes** (`TY`, `ART`, `CLI`, `MG`, `TR`, `QTY`, `SUG`) : à calculer depuis les lignes des factures.

**Transformation des devis** (nouveau)
- Taux en nombre et en valeur, repère sectoriel 10 à 30 %.
- Entonnoir cliquable, relances J+3 / J+7 / J+15, « Vérifier et facturer ».
- Délais (2 j, 9 j, 1,6) : **démo fixe**.

**Calcul de marge**
- Retour vers l'écran précédent (`goBack`).
- Marge globale, coût horaire −/+, prix plancher.
- Simuler une remise 0–30 % avec remise maximale ; « Appliquer » écrit `remiseTxt`.
- Lignes triées de la plus faible marge à la plus forte, « Corriger » par ligne et global (`pu = achat × coef`).

**Devis → facture**
- « Transformer en facture » ouvre la feuille « Vérifier avant de facturer ».
- La feuille présente :
  - les pastilles Devis → Facture (brouillon) et la mention cadenas « Rien n'est envoyé au client » ;
  - le récapitulatif HT / TVA / TTC / acompte / net ;
  - les alertes bloquantes (client vide, SIRET manquant) ;
  - le menu déroulant « Je confirme avoir vérifié » (3 cases, compteur n / 3) ;
  - le bouton « Revoir l'aperçu du devis ».
- « Valider et créer la facture » appelle `doFacture()` (ancien corps de `toFacture`). La facture est créée **non transmise**.

**Aperçu des messages**
- `draft()` est utilisé par :
  - les relances de factures et de devis ;
  - les commandes fournisseur ;
  - le partage de plan de secours.
- E-mail : À (facultatif), Cc, Objet, texte, pièces jointes. WhatsApp : texte seul. « Revenir au texte proposé » restaure le texte d'origine. Couche `z-index: 40`.

**Documents**
- Retour arrière.
- Recherche client / n° / adresse.
- Bandeau de 4 cases de statut (nombre + point de couleur, toujours affichées), « Tout afficher ».
- Nombre et total TTC visibles.
- Boutons « Relancer » / « Facturer » sur chaque ligne. Retards en terracotta foncé : devis > 7 j, facture > 30 j.

**Plans**
- Mention « PNG, JPEG, WebP ou PDF · 3 Mo maximum » centrée sous les boutons Unifilaire / Importer.
- Plan importé (image, métier électricien) : carte « Implanter mes circuits » → `implantFrom()`. PDF : à convertir en image d'abord.

**Devis, Réglages** : bouton retour ajouté.

**Ordinateur** : barre récap du devis calée sur la colonne de contenu (`fr.barL`, `fr.barR`, `fr.barB` = 24 px) ; téléphone inchangé (12 / 12 / 96 px).

### Tests v13
- [ ] Accueil : modifier le nom dans Réglages change le titre ; « SARL Dupont » reste entier.
- [ ] Couper le réseau : la pastille passe à « Hors ligne », puis revient à « En ligne ».
- [ ] Encaissements : « Marquer encaissée » déplace la facture dans le relevé et met à jour les totaux et la tuile d'accueil.
- [ ] Relance : fermer l'aperçu n'enregistre rien ; « Ouvrir » coche J+3 (Transformation) et marque la relance.
- [ ] Aperçu e-mail : objet et texte modifiés sont bien transmis au `mailto:` ; « Revenir au texte proposé » restaure.
- [ ] Vérification facture : bouton grisé tant que les 3 cases ne sont pas cochées ; client vide → alerte bloquante ; la facture créée a le statut « Émise », non transmise.
- [ ] Export CSV : s'ouvre dans Excel avec accents et virgules décimales corrects.
- [ ] Marge : remise simulée au-delà de la remise maximale → marge en terracotta ; « Corriger les N lignes » supprime les alertes de seuil.
- [ ] Documents : recherche « grondin » trouve « M. Grondin » ; case de statut active → liste filtrée ; retoucher → liste complète.
- [ ] Implanter sur un plan importé PNG : l'image est en fond de l'implantation ; revenir sur le plan affiche « Reprendre l'implantation ».
- [ ] Retour arrière sur Documents, Devis, Réglages, Marge, Encaissements, Panier, Transformation : revient à l'écran précédent, sinon à l'Accueil.
- [ ] Ordinateur : la barre récap ne passe plus sous le menu latéral.

---

## Mise à jour v13.1 : réponse au retour dev §8 (2026-09-29)

`totals()` inchangé.

**8.1 Liens externes** : repris. Les 2 appels `window.open(href, '_blank', 'noopener,noreferrer')` (`draft()` et aperçu e-mail du comptable).

**8.2 Données de démo** : confirmé, rien à changer dans le prototype. Un commentaire `// DÉMO` est ajouté au-dessus de l'export CSV. En production :
- TVA du CSV : somme de la TVA des lignes de chaque facture, taux par taux (8,5 %, 2,1 %, 0 en micro-entreprise) ; HT = somme des HT des lignes, pas `TTC / 1,085`.
- Panier moyen et Transformation : calculer `TY`, `ART`, `CLI`, `MG`, `TR`, `QTY`, `SUG` et les délais depuis `docs` (lignes, dates d'envoi, d'acceptation et de relance).

**8.3 Barre récap (ordinateur)** : non, ce n'était pas voulu. La cause était la colonne elle-même : le padding `fr.sp` était calculé sur la largeur totale (menu compris), ce qui réduisait la colonne à 472 px au lieu de 720 px.
- `fr.sp` : `0 max(0px, calc((100% - 248px - 760px) / 2))`. La colonne est centrée dans la zone à droite du menu, 760 px maximum (720 px de contenu).
- `fr.barL` : `calc(248px + max(0px, (100% - 248px - 760px) / 2) + 20px)` ; `fr.barR` : `calc(max(0px, (100% - 248px - 760px) / 2) + 20px)`. La barre a exactement les bords du contenu.
- À 1 280 px : colonne et barre de 404 à 1 124 px.

### Tests v13.1
- [ ] Ordinateur 1 280 px : bords gauche et droit de la barre récap alignés sur les cartes du devis.
- [ ] Ordinateur 1 024 px : colonne pleine largeur à droite du menu, barre à 20 px des bords.
- [ ] Relance WhatsApp : `window.opener` est `null` dans l'onglet ouvert.

---

## Mise à jour v15.2 : nom de l'app « Alizé Pilote » (2026-09-30)

Le nom retenu est **Alizé Pilote** (l'alizé, vent de La Réunion qui porte et guide ; « pilote » : piloter son entreprise depuis l'app).
- Prototype : en-tête de la barre latérale (mode ordinateur), pied de Réglages « Alizé Pilote · version démo », pied des PDF de plan « Édité avec Alizé Pilote le … » (HTML et canvas).
- **À faire côté app** : `manifest.webmanifest` → `"name": "Alizé Pilote"`, `"short_name": "Alizé Pilote"` (12 caractères, tient sous l'icône) ; `<title>` ; `apple-mobile-web-app-title` ; textes des e-mails et partages qui citent l'ancien nom ; README. La clé de sauvegarde `btp974-mobile-v1` **ne change pas** (sinon les données locales seraient perdues).
- Avant publication : vérifier la marque (INPI, classes 9 et 42), les domaines (.fr, .re, .com) et les stores.

---

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

---

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

---

## Mise à jour v14.1 et v14.2 : statuts de la plateforme agréée et données de facture (2026-09-30)

`totals()` inchangé. Détail technique complet et tests : **`PLATEFORME_AGREEE.md`** (même dossier), à lire avant de coder la connexion à la plateforme.

### v14.1 : statuts de facture alignés sur la réforme
- `FAC_ST` : indices 0 à 3 inchangés (Émise, Transmise, Acceptée, Encaissée) + **4 Rejetée, 5 Refusée, 6 En litige**. Champ `motif` sur la facture. Couleurs dans `TONE`.
- Menu de statut (`_cf`) d'une facture : seules les actions de l'artisan sont proposées. Émise → « Transmettre à la plateforme » ; Transmise / Acceptée / En litige → « Enregistrer l'encaissement » ; Rejetée → « Corriger et réémettre » (même numéro) ; Refusée → « Réémettre sous un nouveau numéro » (copie, champ `replaces`) ; Encaissée → information seule.
- **Plus de passage manuel vers Transmise ou Acceptée** : en production, ces statuts viennent de la plateforme et du client ; correspondance retenue par l'app (`server/pa/states.mjs`) : « Transmise » pour 200 à 204 et 209, « Acceptée » pour 205, 206 et 211, à confirmer avec la PA retenue.
- Carte Facturation électronique : compteurs et frise limités aux statuts 0 à 3.
- Démo : `FAC-2026-026` Rejetée (« SIRET du client absent de l'annuaire »).

### v14.2 : correctifs bloquants sur les données de facture
1. **Instantané complet** à la création (`doFacture`) : `lines[{ name, ref, kind, unit, tva, qty, pu }]`, `rem`, `ht`, `t85`, `t21`, `ttcFull`, `ac`, `ttc` (net à payer), `micro`, `devisNo`, `chantier`, `siren`, `pro`, `date`.
2. **TVA par ligne** dans l'éditeur de facture (bouton 8,5 % / 2,1 %), ventilation recalculée avec la remise. Avant : 8,5 % sur tout.
3. **SIREN / SIRET client** : nouvel état persisté `cliSiren` ; interrupteur Particulier / Professionnel (`clientType` existant) et champ sous le nom du client, dans le devis et dans l'éditeur de facture. `SIREN_OK()` : 9 ou 14 chiffres + clé de Luhn. Obligatoire si client professionnel.
4. **Dates** : `TODAY()` (JJ/MM/AAAA) pour toute création ; `DOC_D()` lit JJ/MM/AAAA et l'ancien JJ/MM. Tous les `new Date(2026, …)`, `'24/09'` et `'26/09'` sont supprimés.
5. **Blocages** : vérification avant facture (client pro sans SIREN, SIREN invalide, devis sans ligne) ; une facture Émise incomplète propose « Compléter la facture » au lieu de « Transmettre ». L'enregistrement de l'éditeur est refusé si le SIREN est invalide.

### Migration à prévoir côté app
- Anciennes factures sans `lines` : les garder, les afficher « à compléter » ; elles ne peuvent pas être transmises.
- Anciennes dates JJ/MM : lues par `DOC_D()`, ou converties une fois en JJ/MM/AAAA au chargement.
- `cliSiren` absent des anciennes sauvegardes : vide par défaut.

### Reste à faire côté app
- Générer le XML CII EN 16931 à partir de l'instantané (BT-1, BT-2 en date ISO, BT-47 : SIREN (9 premiers chiffres) avec le schéma `0002`, et SIRET (14 chiffres) avec le schéma `0009` s'il est saisi, BG-23, BG-25, BT-113) et le Factur-X PDF/A-3.
- Adresse de facturation du client distincte du chantier (à designer si besoin).
- Toute la connexion à la plateforme décrite dans `PLATEFORME_AGREEE.md` (OAuth2, idempotence, webhooks signés, file hors ligne).

### Tests v14.1 / v14.2
- [ ] Facture Émise complète : « Transmettre » ; incomplète (sans lignes ou client pro sans SIREN) : « Compléter la facture » ouvre l'éditeur.
- [ ] Aucun chemin manuel vers Transmise → Acceptée.
- [ ] Rejetée → « Corriger et réémettre » : même numéro, retour en Émise, motif effacé. Refusée → nouvelle facture `FAC-<année>-NNN` avec `replaces`, l'originale reste Refusée.
- [ ] Devis 8,5 % + 2,1 % avec remise 5 % → facture : `t85`, `t21`, `ht` identiques à `totals()` au centime.
- [ ] Éditeur de facture : basculer une ligne en 2,1 % met à jour le libellé et le total TVA.
- [ ] SIREN `812 453 678` accepté ; `812 453 679` refusé ; 14 chiffres (SIRET) acceptés si la clé est bonne.
- [ ] Date d'une nouvelle facture = date du jour avec l'année.

---

## Mise à jour v14 : module Équipe (RH), liens entre plannings, justificatifs, confirmation des statuts (2026-09-30)

`totals()` inchangé. Aucune règle de calcul du devis ne bouge. Le module Équipe n'avait pas encore été documenté : cette section le décrit en entier.

### Persistance
- Clé persistée : `'rh'` (déjà dans `KEEP`). Si `state.rh` est absent, `rhData()` renvoie les données de démo.
- États non persistés : `rhTab` (team | pt | pl | abs | paie), `rhWk` (-1 | 0), `rhPw` (0 | 1), `rhF`, `rhEmp`, `rhAdd`, `rhOpen`, `rhOblig`, `absF`, `fraisF`, `fraisView`, `stCf`.
- Événements d'agenda (`events`) : champ optionnel `ch` (clé de chantier), posé à la création d'un projet.

### Modèle `rh`
```
staff[]  { id, nom, role, kind: 'dir'|'sal'|'app', contrat, entree, fin?, brut, coef, pin, hab[[l,date,mois]], visite[type,date,mois], epi[[l,date,mois]], outils[] }
ext[]    { id, nom, org, kind: 'int'|'st', role, fin?, cout?, docs[[l,date,mois]] }
points[] { id, who, d:'jj/mm/aaaa', ch, h, panier, emp? }        // emp = envoyé par le salarié, à valider
plan     { 'jj/mm/aaaa' (lundi) : { who: [ch lun … ch ven] } }   // surcharge de RH_DEF
panier   10.5                                                     // € par repas
abs[]    { id, who, type, du, au, st: 'Demandée'|'Validée'|'Refusée' }
frais[]  { id, who, d, l, m, pj?: { src, name, pdf, by: 'sal'|'pat' }, emp? }
```
Constantes module : `RH_CH` (chantiers de démo : [libellé, commune, zone, fond, texte]), `RH_DEF` (planning par défaut semaine 0 et 1), `RH_ZONES` (zones BTP Réunion, €/jour), `RH_FD` (texte selon la forme juridique), helpers `RH_D`, `RH_P`, `RH_MON`, `RH_ADD`.

### Onglet Équipe (`s.tab = 'rh'`, 6ᵉ onglet entre Catalogue et Réglages)
- **Équipe** : obligations de l'employeur selon la forme juridique ; carte « Aujourd'hui » (chantier prévu, état du pointage, rappel WhatsApp) ; échéances à 60 jours (habilitations, visite médicale, EPI, attestations, fin de mission) avec actions « fait » ou e-mail prérempli ; fiches salarié (contrat, taux brut modifiable, coût chargé, habilitations, EPI, code de pointage, « Voir son écran ») ; ajout d'un salarié avec rappel DPAE ; intérimaires et sous-traitants.
- **Pointage** : heures de la semaine par personne (repère 35 h, alerte > 48 h / semaine ou > 10 h / jour, heures sup.), pointages salarié à valider, formulaire « Ajouter des heures » (Qui, Chantier, Durée, Panier repas), liste par jour.
- **Planning** : grille lundi–vendredi, semaine en cours / prochaine ; toucher une case fait tourner l'affectation ; les absences validées bloquent la case.
- **Absences** : demande, validation, refus ; congés payés, maladie, intempéries, formation, sans solde ; rappel caisse de congés BTP.
- **Paie** (mois en cours) : heures normales, HS 25 % (36ᵉ à 43ᵉ h) et 50 % (au-delà), paniers, indemnités de zone, notes de frais validées, absences ; coût réel de la main-d'œuvre par chantier contre heures vendues ; export CSV et e-mail au comptable.
- **Écran salarié** (aperçu, `rhe`) : le salarié ne voit que son pointage et ses notes de frais. Tout arrive « à valider ».

### Liens entre les plannings (nouveau)
Fonctions : `rhChs()`, `rhPlanOn(R, who, date)`, `rhTeamOn(date, R)`, `agendaDay(iso, R)`, `evRow(e)`, `dayVals()`.
1. **Chantiers dynamiques** : `rhChs()` = `RH_CH` + un chantier par projet créé (`userProj`), libellé = dernier mot du nom du client, placé avant « Dépôt ». Utilisé partout dans `rhVals` (grille, pointage, paie).
2. **Agenda → équipe** : chaque événement « Chantier » affiche « Équipe : … » (personnes planifiées ce jour-là, absents exclus). Rapprochement par `e.ch`, sinon par le libellé du chantier dans le titre.
3. **Planning RH → Agenda** : un jour où des personnes sont affectées à un chantier sans événement correspondant crée un événement virtuel (`virt: true`, 07 h 30, « Depuis le planning équipe », non supprimable depuis l'Agenda).
4. **Pointage patron** : le chantier est prérempli avec l'affectation du jour de la personne choisie ; « prévu : X » à côté du libellé Chantier.
5. **Accueil** : carte « Aujourd'hui » (même source `agendaDay`) avec équipe par chantier, absents du jour, lien vers l'Agenda.
6. **Alerte « sans équipe »** : événement « Chantier » en semaine, dans l'horizon du planning (semaine en cours et suivante, à partir d'aujourd'hui), sans personne affectée. Affichée dans l'Agenda (bandeau des 14 prochains jours + bouton « Affecter ») et dans l'onglet Planning.

### Notes de frais avec justificatif (nouveau)
- Justificatif **obligatoire** : photo ou scan (PNG, JPEG, WebP ou PDF, 3 Mo maximum), `<input type="file" accept="image/*,application/pdf" capture="environment">`, lu en data URL.
- Patron : « Ajouter la note » refuse l'enregistrement sans justificatif. Une note sans justificatif affiche « Justificatif manquant » et un bouton appareil photo pour l'ajouter ; un compteur l'indique en tête de carte.
- Salarié : section « Note de frais » dans son écran ; la note arrive `emp: true`, « Photo envoyée par … · à valider », avec Valider / Refuser. Pastille sur l'onglet Paie. La validation exige un justificatif.
- Seules les notes validées entrent dans la paie et le total.
- Visionneuse `nfv` (feuille) : image en grand ou téléchargement du PDF, « Remplacer le justificatif ».
- **Production** : ne pas garder les justificatifs en data URL dans le stockage local (quota). Les envoyer au serveur ou dans IndexedDB, et ne garder qu'une référence dans `pj`. CSP : autoriser `data:` et `blob:` pour les images.

### Confirmation avant changement de statut (nouveau)
- Toucher une pastille de statut ouvre un menu sous le document au lieu de changer le statut : type et numéro, client, date, montant TTC, statut actuel → suivant, conséquence en une phrase, boutons « Annuler » et « Passer en … ».
- Appliqué aux trois listes : Accueil › Facture électronique (`pa.facs`, contexte `pa`), Accueil › documents récents (`rec`), Documents (`docs`). Un seul menu ouvert à la fois (`stCf = { no, ctx }`). Implémentation : `_cf(ctx)` dans le map des documents.

### Autres retouches
- Carte « Ajouter des heures » : trois blocs titrés (Qui, Chantier, Durée), compteur d'heures agrandi, interrupteur panier pleine largeur.

### Report des corrections de l'app (RETOUR_DEV §8.1 et §9.1)
- **Liens externes** : les 2 appels `window.open` (`draft()` et l'e-mail du comptable) passent déjà `'noopener,noreferrer'`. Rien à reprendre.
- **TVA en micro-entreprise** (`statsVals`) : `ht = total`, `t85 = t21 = 0` quand `regime === 'micro'`, dans l'écran Facturation comme dans `exportCsv`. Reprend la correction de l'app.
- **Libellé « IDn »** (`planDiagram`) : `tx(36, yb - 22, 'ID' + (r + 1), { s: 10, w: 800, fill: K.sage })`, aligné à gauche à droite du trait. Identique à l'app.
- **Stockage plein** : texte validé, « Stockage plein : les dernières modifications ne sont pas enregistrées. Supprime un plan importé. » Le prototype l'affiche une fois par échec (toast), puis se réarme après une sauvegarde réussie. Garder le stockage IndexedDB de l'app ; la même règle vaut pour les justificatifs des notes de frais. Jauge d'espace dans Réglages : non retenue pour l'instant.
- **Toujours ouvert** : données réelles (historique, panier moyen, transformation, CSV taux par taux) et icône définitive 512 × 512 + maskable.

### Tests v14
- [ ] Planning semaine prochaine : « Lun · M. Grondin — clôture chantier » est listé sans équipe ; l'Agenda affiche « 1 chantier sans équipe » et le bouton « Affecter » ouvre le Planning sur la bonne semaine.
- [ ] Affecter quelqu'un sur Grondin ce lundi : l'alerte disparaît dans le Planning et l'Agenda, l'événement affiche « Équipe : … ».
- [ ] Un jour avec des affectations sans événement : l'Agenda montre l'événement « Depuis le planning équipe », sans bouton supprimer.
- [ ] Une absence validée retire la personne de l'équipe affichée (Agenda, Accueil, carte Aujourd'hui).
- [ ] Créer un projet : son chantier apparaît dans la grille Planning, le pointage et l'événement d'agenda lié.
- [ ] Pointage patron : choisir Kévin préremplit son chantier du jour ; « prévu : … » est juste.
- [ ] Accueil : la carte « Aujourd'hui » liste les événements du jour avec l'équipe ; toucher une ligne ouvre l'Agenda (ou le Planning si personne n'est affecté).
- [ ] Note de frais patron sans justificatif : refusée avec « Joins la photo ou le scan du justificatif » ; avec une image : « Justificatif joint », vignette, visionneuse.
- [ ] Note envoyée depuis l'écran salarié : « à valider », hors total ; Valider l'ajoute au total et à la paie ; Refuser la supprime.
- [ ] Fichier de plus de 3 Mo ou autre qu'une image ou un PDF : refusé avec message.
- [ ] Statut : toucher une pastille ouvre le récapitulatif ; Annuler ne change rien ; confirmer 4 fois revient au statut de départ ; le toucher ne déclenche pas l'ouverture du document.

---

## Tests à passer
- [ ] Plan unifilaire : « Tout corriger » supprime toutes les alertes du plan de démo « villa Payet ».
- [ ] Calibre des ID : un ID en 40 A avec 76 A calculés affiche l'alerte ; « Passer en 63 A » la résout.
- [ ] PDF : aucun tableau ni paragraphe n'est coupé entre deux pages ; la page implantation est entière.
- [ ] Assistant plan : avec 90 m², 3 chambres, cuisine fermée et cellier, on obtient 9 pièces + terrasse (10 éléments).
- [ ] « Placer selon la norme » : séjour de 26 m² → 7 prises, 2 RJ45 ; chaque chambre → 3 prises, 1 RJ45 ; cuisine → 6 prises (dont 4 au plan de travail) + plaque 32 A + lave-vaisselle + four. Aucun circuit ne dépasse 8 points (12 socles en 20 A, 6 sur la cuisine).
- [ ] Implantation : Annuler revient à l'état précédent (30 niveaux) ; le zoom ×2 garde des coordonnées justes.
- [ ] Nouveau projet : le nom du client est obligatoire ; le devis, le plan (électricien) et le RDV sont créés et liés ; la fiche projet s'ouvre.
- [ ] Nouvelle commande : les lignes du devis en cours sont pré-remplies ; une commande est créée par fournisseur ; les lignes sont marquées commandées.
- [ ] Fiche commande : l'envoi par e-mail ou WhatsApp passe « À envoyer » à « Commandée » sans quitter l'app.
- [ ] Comparateur : « Choisir » met à jour le fournisseur, l'achat et le PU des lignes du devis ayant la même référence ; `totals()` est recalculé.
- [ ] Hors ligne : la pastille « Hors ligne » s'affiche, le bouton IA et la synchronisation sont désactivés.

## Rappel : à valider par un professionnel
Règles NF C 15-100 et DTU (résumés), tarifs fournisseurs (démo), plateforme de facture électronique (simulée), mentions légales.
