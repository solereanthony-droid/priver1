# Les codes d'accès sont gérés dans l'app et vérifiés un par un par le serveur

Chaque salarié a son propre Code salarié, et le serveur le vérifie individuellement : la session porte l'identifiant du salarié. `APP_STAFF_CODE` (code salarié commun) est supprimé, car il permettait à un salarié de pointer pour un autre. `APP_OWNER_CODE` ne sert plus qu'à fixer le Code patron au premier démarrage du serveur. Ensuite, le patron change son code dans l'app, et le serveur conserve l'empreinte dans `server/data/auth.json`, qui prime alors sur la variable d'environnement. Le serveur et l'appareil ne stockent jamais un code d'accès en clair, seulement une empreinte salée. Un code salarié ne s'affiche qu'une seule fois, à sa création.

## Consequences

- Changer `APP_OWNER_CODE` après le premier démarrage n'a plus d'effet. En cas de Code patron oublié, l'hébergeur supprime l'entrée du patron dans `auth.json` et redémarre le serveur avec un nouveau `APP_OWNER_CODE`.
- Les sauvegardes existantes (codes à 4 chiffres, `ownerCode` en clair) sont migrées : nouveau Code patron demandé, codes salariés désactivés (Code à renouveler).
