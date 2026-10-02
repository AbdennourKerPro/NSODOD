# NSOD'OD — le jardin sans sucre

Une semaine, quatre personnes, quatre mascottes. **NoSugarOrDieOfDiabetes** permet à Abdennour, Isabelle, Shérine et Meriem de noter leurs journées sans sucres ajoutés ni produits ultra-transformés, de suivre leur progression et de consulter leur classement commun. Les fruits entiers et les féculents nature restent au menu. Les règles sont accessibles par un bouton discret sous le pied de page de l'accueil et dans l'onglet « Le défi ».

Le site est statique et fonctionne sur ordinateur ou téléphone. Il peut être publié directement avec GitHub Pages, sans compilation et sans installation de dépendances.

## Essayer le site

Avec Node.js installé, ouvrir un terminal dans ce dossier :

```sh
npm run dev
```

Puis ouvrir **http://localhost:5173**. Le serveur local est nécessaire pour charger les modules JavaScript ; ouvrir directement `index.html` depuis l'explorateur ne suffit pas.

Choisir son prénom sur l'accueil, puis renseigner une réussite ou un échec pour chaque journée écoulée. Une journée non renseignée reste en attente. Les jours futurs sont désactivés dans l'interface. Les dates du défi suivent le fuseau **Europe/Paris**.

Le défi est prévu du **3 au 9 octobre 2026**, dans le fuseau Europe/Paris. Jusqu'au départ, le tableau de bord montre des conseils de préparation à la place des boutons de bilan. Ceux-ci deviennent disponibles le 3 octobre.

Le dernier bilan est celui du **vendredi 9 octobre**. Le calendrier affiche aussi la **sortie du samedi 10 octobre** pour fêter la fin du défi ; cette sortie n'ajoute pas de journée au score.

Le 9 octobre, un vote « Prolonger » ou « S’arrêter ici » s'ouvre pour chaque participant et reste disponible après la semaine. Les votes sont sauvegardés et modifiables ; le résultat s'affiche après les quatre votes. Une égalité invite le groupe à décider ensemble. Le vote ne démarre pas automatiquement une nouvelle semaine : le groupe choisit la durée de la suite.

Les anciennes sauvegardes locales sans bilan ni vote adoptent la nouvelle date, en gardant les couleurs. Les sauvegardes avec bilans et les jardins Firebase existants conservent leur calendrier pour préserver leurs résultats.

La mascotte d'Abdennour est bleu royal, celle d'Isabelle bleu turquoise, celle de Shérine violette et celle de Meriem rose. Chacun peut choisir sa couleur dans les paramètres de son profil, parmi bleu royal, bleu turquoise, bleu, vert, violet, rose, jaune et orange. Le choix est sauvegardé sans modifier les résultats ou la date du défi. Les anciens choix personnalisés restent conservés lorsque les couleurs par défaut évoluent.

## Sauvegarde locale ou jardin partagé

| Mode | Sauvegarde | Ce que voient les autres |
| --- | --- | --- |
| Local, avec une configuration Firebase vide | Dans ce navigateur, sur cet appareil | Aucune synchronisation entre vos appareils |
| Partagé, configuré actuellement | Dans Cloud Firestore | Les résultats, couleurs des mascottes, votes et classement du même jardin, actualisés en temps réel |

**Firebase est configuré pour le partage entre vos quatre téléphones.** Le mode local reste disponible si les valeurs de `firebase-config.js` sont retirées. Changer de navigateur ou effacer ses données fait perdre l'accès à la sauvegarde locale. Plusieurs onglets du même navigateur peuvent suivre cette même sauvegarde.

Les résultats locaux ne sont pas importés automatiquement dans Firebase. Activer le partage avant le défi, ou reporter les résultats déjà saisis dans le jardin partagé.

## Configuration Firebase des quatre personnes

Le projet [NSOD-OD (`nsod-od`)](https://console.firebase.google.com/project/nsod-od/overview) est configuré dans votre compte, avec l'offre gratuite **Spark**, sans Google Analytics et sans Firebase Hosting. Le site sera hébergé sur GitHub Pages.

Les étapes effectuées dans la console :

1. Création du projet et enregistrement de l'application web **NSOD'OD**.
2. Activation de **Authentication → Méthode de connexion → Anonyme**. Les participants n'ont ni adresse électronique ni mot de passe à renseigner.
3. Ajout du domaine **abdennourkerpro.github.io**, avec **localhost** et **127.0.0.1** pour les essais.
4. Création de la base **Cloud Firestore Standard**, identifiant **(default)**, dans **europe-west9 (Paris)**, initialement en mode production.
5. Publication du contenu de [firestore.rules](./firestore.rules) dans **Firestore → Règles**.
6. Enregistrement des identifiants publics de l'application dans [firebase-config.js](./firebase-config.js).

Au lancement, le site crée ou rejoint un jardin partagé pour le défi du 3 au 9 octobre 2026. La date d'un jardin partagé est fixe pour tous les participants. Le bouton **Inviter mes complices** affiche une adresse finissant par `#jardin=...`. Envoyer **ce même lien** aux trois autres personnes : chacune choisira ensuite son prénom et rejoindra le même classement.

La connexion anonyme et Firebase se lancent automatiquement lorsque la configuration est remplie. Sans lien d'invitation et sans jardin déjà mémorisé, un nouveau jardin est créé : pour rejoindre vos amis, utilisez leur lien.

La configuration web Firebase est publique par conception. Elle peut figurer dans le dépôt ; les droits d'accès dépendent des règles Firestore. **Ne jamais placer une clé de compte de service ou une clé privée dans le site.** [Documentation des clés Firebase](https://firebase.google.com/docs/projects/api-keys)

Le SDK Firebase est chargé depuis le CDN officiel, en version `12.19.0`, uniquement lorsque le partage est configuré. [Ajouter Firebase à une application web](https://firebase.google.com/docs/web/setup), [Authentification anonyme](https://firebase.google.com/docs/auth/web/anonymous-auth)

## Publier sur GitHub Pages

1. Mettre les fichiers du projet dans un dépôt GitHub et pousser la branche `main`.
2. Ouvrir **Settings → Pages** dans le dépôt.
3. Choisir **Deploy from a branch**, puis la branche **main** et le dossier **/ (root)**.
4. Enregistrer et attendre la publication. Ouvrir l'adresse indiquée par GitHub Pages.

L'adresse prévue est **https://abdennourkerpro.github.io/NSODOD/**. Les chemins relatifs permettent de servir le site sous ce dossier. Le fichier `.nojekyll` est fourni. Aucun dossier de compilation n'est à générer : `index.html`, `src/`, `assets/` et `firebase-config.js` doivent être publiés ensemble à la racine.

Pour conserver le classement partagé après publication, reprendre la partie `#jardin=...` du lien d'invitation et l'ajouter à l'adresse GitHub Pages. Le navigateur ne transfère pas automatiquement le jardin mémorisé sur `localhost` vers le nouveau domaine. Partager ensuite l'adresse publiée complète ; un lien commençant par `localhost` ne fonctionne pas sur le téléphone d'un ami.

Si Firebase affiche `auth/unauthorized-domain`, ajouter `votre-compte.github.io` dans **Authentication → Settings → Authorized domains**. Ajouter aussi `localhost` pour les essais si nécessaire ; Firebase ne l'ajoute plus automatiquement aux nouveaux projets depuis le 28 avril 2025. [Domaines autorisés Firebase](https://firebase.google.com/docs/auth/faq-and-troubleshooting)

## Fonctionnement du partage

Chaque jardin possède un identifiant aléatoire de 128 bits, encodé en 32 caractères hexadécimaux. Le lien d'invitation contient cet identifiant dans son fragment `#jardin=...`. Conserver ce lien entre les quatre participants ; ne pas le publier dans le dépôt ou dans une capture publique.

Le modèle repose sur la confiance entre amis : **toute personne ayant le lien peut choisir l'un des quatre prénoms et modifier ses résultats et la couleur de sa mascotte**. Le prénom choisi ne constitue pas une identité vérifiée. Une connexion anonyme protège l'accès à Firebase sans enfermer un prénom dans un seul téléphone.

Les règles interdisent l'énumération des jardins et vérifient l'appartenance au jardin avant l'accès aux résultats. Elles limitent chaque résultat aux quatre identifiants prévus, à un jour de `0` à `6`, à `success` ou `failure`, et imposent les champs attendus ainsi qu'un horodatage serveur. Chaque journée est écrite séparément afin que les saisies simultanées des participants ne remplacent pas toute la semaine.

Les couleurs et les votes sont enregistrés séparément pour chaque profil. Les règles limitent ces documents aux quatre prénoms, aux huit couleurs prévues et aux choix `yes` ou `no`, avec les mêmes contrôles de membre et d'horodatage serveur. Les votes s'ouvrent le dernier jour à minuit à Paris. Si Firebase était déjà configuré, republier les règles mises à jour pour activer les couleurs et les votes partagés.

```text
rooms/{identifiant-du-jardin}
  startDate, creatorUid, createdAt

rooms/{identifiant-du-jardin}/members/{identifiant-anonyme}
  joinedAt

rooms/{identifiant-du-jardin}/entries/{prenom}_{jour}
  participantId, day, status, updatedBy, updatedAt

rooms/{identifiant-du-jardin}/profiles/{prenom}
  color, updatedBy, updatedAt

rooms/{identifiant-du-jardin}/votes/{prenom}
  vote, updatedBy, updatedAt
```

Exemple de document : `entries/sherine_2`, pour le troisième jour de Shérine. Les identifiants sont `abdennour`, `isabelle`, `sherine` et `meriem`. Le classement est calculé depuis les résultats ; il n'est pas stocké séparément. Les modifications sont reçues avec les abonnements `onSnapshot` de Firestore. [Actualisation en temps réel](https://firebase.google.com/docs/firestore/query-data/listen)

La validation du calendrier et le blocage des jours futurs sont effectués par l'application. Les règles valident le format de la date de départ ; elles ne prouvent pas qu'une personne a effectivement respecté le défi. Les règles ont été acceptées et publiées par Firebase. La connexion anonyme, la création du jardin, le partage d'une couleur entre deux onglets et sa conservation après rechargement ont été vérifiés sur le projet réel. Les bilans quotidiens et les votes n'ont pas été saisis dans ce jardin avant leurs dates d'ouverture ; les 29 tests locaux couvrent leur logique, mais les règles n'ont pas été testées avec l'émulateur Firebase. [Validation dans les règles Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions), [Contrôle des champs](https://firebase.google.com/docs/firestore/security/rules-fields)

## Vérifier le projet

```sh
npm run check
npm test
```

Ces commandes utilisent les outils intégrés à Node.js pour vérifier les fichiers JavaScript et les tests du projet. Elles ne nécessitent pas de projet Firebase et ne vérifient pas ses règles côté serveur.

À partir du 3 octobre, pour valider le partage des bilans sur vos téléphones, ouvrir le même lien d'invitation dans deux navigateurs, enregistrer le résultat réel du jour dans le premier et vérifier son apparition dans le second. Recharger les deux pages pour confirmer la sauvegarde, puis essayer une correction de résultat si nécessaire.

Changer aussi la couleur d'un profil dans les paramètres et vérifier qu'elle se met à jour dans l'autre navigateur, sur les profils et dans le classement, puis qu'elle reste après rechargement. Les anciennes sauvegardes locales sans couleurs personnalisées restent compatibles.
