# Mises à jour pour Claude Code : Chiffrage BTP 974

**Date :** 2026-09-29 (v13)
**Base :** le code livré après le retour de développement (`RETOUR_DEV.md`), c'est-à-dire le handoff jusqu'à la v4 (export PDF des plans).
**Référence :** `Chiffrage BTP 974 Mobile.dc.html`, fourni dans ce dossier. Le gabarit `<x-dc>` et la classe `Component` restent la source de vérité.

## Comment appliquer
1. Remplacer le gabarit et la classe `Component` par ceux du fichier fourni. Les règles de ton retour sont respectées : chemins simples dans `{{ }}`, pas de ressource externe, pas de `<script>` dans le gabarit, pas de prompt IA ajouté.
2. Ajouter à la persistance les nouvelles clés d'état (voir ci-dessous).
3. Brancher les deux points d'intégration signalés (mise à jour disponible, service worker).
4. Lancer la liste de tests en fin de document.

**Règles de calcul** : `totals()` (TVA, remise, acompte, marge) **n'a pas changé**. Les tests `test/logic.spec.js` doivent passer sans modification. Seul le choix d'un fournisseur (v11) change `achat` et `pu` sur les lignes concernées, avec la même formule qu'avant (`pu = achat × COEF`).

## Nouvelles clés d'état persistées
Liste complète `Component.KEEP` :
```
'lines','client','chantier','acompte','remiseTxt','docs','devisSeq','facSeq','metier','regime','events','co','tauxMO','targetM','seuil','puHidden','ordered','relances','acompteDef','formeInfo','planMode','plans','compta','aiHistory','lcShow','payTerm','clientType','retenue','reserve','projSteps','editNo','versionOf','baseCount','sun','paAgo','themePref','layout','account','userProj','orders','cmdSeq','catPref'
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
