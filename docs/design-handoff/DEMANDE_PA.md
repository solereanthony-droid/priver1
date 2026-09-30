# Demande à Claude Design : écrans de la facture électronique (plateforme agréée)

**Date :** 2026-09-30
**Contexte :** la connexion réelle à une plateforme agréée (PA) est prête côté serveur et côté app (`docs/PA.md`).
Le prototype affiche encore 4 statuts **simulés** que l'utilisateur fait avancer à la main. Il faut les écrans
suivants, dans le prototype (gabarit + `Component`), en respectant les règles habituelles (§ 4 de `RETOUR_DEV.md`).

## 1. Contrat d'intégration (déjà disponible dans l'app)

`window.btpPA` (toutes les fonctions renvoient une promesse) :

| Appel | Résultat |
| --- | --- |
| `status()` | `{ state, paName, lastSync, retryAt, queued }` — `state` : `non_configure`, `non_connecte`, `connecte`, `sync`, `reauth`, `hors_ligne`, `panne_pa` |
| `connect()` | redirige vers la PA (consentement OAuth) ; au retour, l'app s'ouvre sur `/?pa=connecte` ou `/?pa=erreur` |
| `disconnect()` | révoque et efface la connexion |
| `transmit(invoice)` | met en file le dépôt ; `invoice` se construit avec `toPaInvoice(doc, coData(), { buyerSiren })` (`src/pa/invoicePayload.js`) |
| `recordPayment(no, montant, 'AAAA-MM-JJ')` | met en file l'encaissement (statut 212), partiel ou total |
| `invoices()` | `{ data: { invoices: [{ no, state, status, reason, errors, remaining, paid, queued, depositedAt, lastCode }] } }` |
| `pending()` | actions en attente d'envoi (hors ligne) : `[{ no, kind, tries }]` |
| `login(code)`, `session()`, `logout()` | session de l'app : rôle `owner` (patron) ou `staff` (salarié) |

Événements `window` : `btp:pa-update` (`{ no, invoice }` ou `{ no, queued }`) et `btp:pa-error` (`{ no, message, errors }`).

`status` (dans `invoices()`) vaut `Émise`, `Transmise`, `Acceptée`, `Encaissée`, `Rejetée`, `Refusée` ou `En litige`.

## 2. Écrans et états à designer

1. **Menu de statut d'une facture** : seules les actions possibles pour l'utilisateur.
   - Depuis « Émise » : « Transmettre à la plateforme ».
   - Depuis un statut déposé : « Enregistrer l'encaissement » (montant, date ; encaissement partiel possible).
   - Plus de passage manuel à « Transmise » ou « Acceptée » : c'est la PA qui les pose.
2. **Nouvelles pastilles** : Rejetée, Refusée, En litige (fond `--color-accent-200`, texte `--color-accent-900`),
   avec le motif renvoyé par la PA et le bouton « Corriger et réémettre ».
   - Refusée → nouvelle facture (nouveau numéro).
   - Rejetée → correction ; même numéro seulement si la PA l'autorise.
3. **« En attente d'envoi »** sur la facture quand l'action est dans la file hors ligne (`pending()`), avec la
   pastille « Hors ligne » existante.
4. **Encaissement partiel** : afficher « payé X € · reste Y € » tant que la facture n'est pas soldée.
5. **Carte « Facturation électronique »** (`paVals`) : les 7 états ci-dessus. Le nom vient du compte connecté
   (`paName`), plus de « FactuPro 974 » en dur. `reauth` : « Reconnecte ton compte <PA> ». `panne_pa` : « <PA> ne
   répond pas, nouvel essai à hh:mm ». `non_configure` : la PA n'est pas encore choisie.
6. **Réglages → Facture électronique** : PA connectée, « Connecter mon compte », date de dernière relève, « Déconnecter ».
7. **SIREN du client** (nouveau champ, obligatoire pour transmettre) quand le client est « Professionnel » :
   9 chiffres, contrôle de clé, aide « Où le trouver ? » (annuaire-entreprises.data.gouv.fr).
8. **Client « Particulier »** : pas de bouton « Transmettre ». Mention : « Facture à un particulier : pas de facture
   électronique. Les ventes aux particuliers seront déclarées en e-reporting. » (texte à valider).
9. **Écran de code d'accès** (connexion à l'app) : saisie du code, erreur « Code incorrect », blocage « Trop
   d'essais : patiente une minute ». Le compte salarié ne voit ni les réglages de la PA ni les actions de transmission.
10. **Erreurs de contrôle avant dépôt** : liste des erreurs renvoyées (`errors`), par exemple « SIREN du client absent
    ou invalide », dans la vérification avant facture existante.

## 3. Textes (à relire)

- « Transmise à <PA> le <date>. Ce n'est pas encore une acceptation du client. »
- « Rejetée par la plateforme : <motif>. Corrige la facture puis réémets-la. »
- « Refusée par le client : <motif>. »
- « En attente d'envoi : la facture partira à la reconnexion. »
- « Ce client n'est pas encore joignable par facture électronique. Vérifie son SIREN. »

## 4. Rappels

- Ne pas faire avancer les statuts dans le prototype : lire `invoices()` et les événements.
- Les factures créées gardent désormais leur contenu (`doc.snap` : lignes, taux, client, remise, acompte) et leur
  vraie date : c'est ce qui permet de produire le XML EN 16931.
