# Le verrou protège l'usage de l'app, pas les données locales

L'Écran de verrouillage sépare les rôles sur un appareil partagé : un salarié ne voit que son pointage. Il empêche aussi un tiers d'ouvrir l'app sur un téléphone déverrouillé. Il ne chiffre pas les devis, factures et clients enregistrés dans le navigateur. Une clé dérivée d'un Code d'accès à 6 chiffres se casse hors ligne en quelques secondes, alors que chiffrer `localStorage`, IndexedDB et la sauvegarde automatique coûte cher. La protection d'un téléphone perdu repose sur le verrouillage du téléphone. L'aide de l'app le dit.

## Considered Options

- Chiffrement local avec une clé dérivée du Code patron : rejeté (espace de clés trop petit, complexité, risque de perte de données si le code est oublié).
