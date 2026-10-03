# Activer l’analyse des repas

Le code est prêt pour Vercel. La clé OpenAI et les identifiants privés restent côté serveur ; ne les mets jamais dans `firebase-config.js`, le navigateur ou GitHub.

## Trois variables privées à renseigner

Dans ton projet Vercel, ouvre **Settings → Environment Variables** et ajoute ces variables pour **Production** (et Preview si tu souhaites tester une préversion) :

| Nom | Valeur |
| --- | --- |
| `OPENAI_API_KEY` | Ta clé API OpenAI, sur un projet ayant accès à `gpt-6-luna` et un moyen de paiement/crédits API. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Le contenu complet du fichier JSON d’un compte de service du projet **nsod-od**. |
| `ADMIN_PASSWORD` | Ton mot de passe personnel de contrôle, au moins 16 caractères. Ne le partage pas avec les autres participantes. |

Pour le compte de service, ouvre [Firebase → Paramètres du projet → Comptes de service](https://console.firebase.google.com/project/nsod-od/settings/serviceaccounts/adminsdk), puis **Générer une nouvelle clé privée**. Fais cette génération toi-même, copie le contenu du JSON dans la variable Vercel et conserve le fichier hors du dépôt. Ce fichier privé donne des droits serveur sur Firebase ; la configuration publique existante du site ne le remplace pas. [Configuration Firebase Admin](https://firebase.google.com/docs/admin/setup)

Enregistre les variables, puis ouvre **Deployments → dernier déploiement → Redeploy** : des variables ajoutées après un déploiement ne deviennent actives qu’au prochain déploiement. Si le projet Vercel avait des réglages personnalisés, le dossier de sortie doit être `dist`, le build `npm run build`, et le framework « Other » (le dépôt contient `vercel.json`).

## Utilisation

- Chaque ajout ou modification de repas déclenche une requête à GPT‑6 Luna. Le repas est sauvegardé avant l’analyse. En cas d’échec, il reste disponible avec une possibilité de relancer.
- L’analyse applique les règles actuelles : pas de sucre ajouté ni de produit ultra-transformé ; fruits entiers, pâtes nature, yaourt nature et aliments simplement conservés restent autorisés. Les descriptions ambiguës sont signalées comme « À clarifier ».
- Choisis le profil **Abdennour**, puis **Mon espace de contrôle**. Connecte-toi avec `ADMIN_PASSWORD`. Les alertes et leurs explications sont accessibles uniquement avec cette session administrateur, pas en choisissant simplement ce prénom.
- **Valider · 1 joker** consomme un joker pour ce repas. **Rejeter l’alerte** ne consomme rien. **Annuler ma validation** restitue le joker attaché à cette validation. Les décisions sont conservées côté serveur.
- Deux repas concernés dans la même journée consomment deux jokers. Un même repas ne peut en consommer qu’un, même s’il est modifié et analysé plusieurs fois. Les collations constituent une seule note de repas par jour. Un repas vide ne consomme rien.
- Trois jokers sont disponibles pour chacun sur les six jours du 4 au 9 octobre. Le 3 octobre est un galop d’essai : ses repas et analyses sont conservés, mais aucune validation ne peut consommer de joker ; les jokers précédemment consommés pour cette date sont restitués au chargement du jardin commun. Un quatrième repas validé affiche un dépassement ; le bilan quotidien, le classement et le prix du karaoké restent inchangés.
- Les anciennes versions signalées restent dans l’historique mais ne peuvent plus être validées. Une validation passée reste comptée si son repas est édité ou supprimé ; tu peux l’annuler explicitement.
- Les repas déjà saisis avant activation se trouvent dans **Repas sans analyse terminée** et peuvent être analysés manuellement.

## Données et vérifications

`mealChecks` conserve les analyses privées par version de repas ; `jokerLedger` empêche le double comptage ; `jokerCounts` expose uniquement les compteurs ; `analysisStates` expose seulement l’avancement. Ces collections sont écrites uniquement par Firebase Admin. Les règles Firestore empêchent les navigateurs de lire les alertes privées ou de modifier les décisions et compteurs. Le serveur vérifie le jeton Firebase et l’appartenance au jardin à chaque requête. La session administrateur dure quatre heures, est liée au jardin et au navigateur connecté, et utilise un cookie HttpOnly/SameSite/HTTPS.

La requête utilise l’API Responses, `model: "gpt-6-luna"`, une sortie JSON structurée et `store: false`. Seul le texte du repas est envoyé à OpenAI, sans prénom ni identifiant Firebase. Le texte est traité comme une donnée, jamais comme une instruction. [GPT‑6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sorties structurées](https://developers.openai.com/api/docs/guides/structured-outputs)

`npm run check` vérifie la logique avec des réponses simulées, sans facturation OpenAI ni données réelles. Après configuration, teste une note dans un jardin de test séparé : un repas simple, puis un soda sucré ; contrôle l’alerte, sa validation, son annulation et la conservation du bilan quotidien. Les appels réels ne sont pas testés tant que les variables privées ne sont pas renseignées.

Pour tester localement : Node.js 22 ou supérieur, `npm install`, copier `.env.example` vers `.env` (ignoré par Git), renseigner les trois variables puis `npm run dev`. Ne copie pas le compte de service dans le dossier public `dist`.
