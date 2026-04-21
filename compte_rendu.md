# 3 : CRUD, Uploads de fichiers & Temps réel

## Les choix techniques faits

- **Node.js** : Langage principal utilisé pour l'écriture des scripts d'interaction avec la base de données (`peter-actions.js`, `amine-watch.js`) et pour l'Azure Function.
- **Supabase** : Choisi comme Backend-as-a-Service pour sa base de données PostgreSQL, son système d'authentification robuste, et surtout ses **Webhooks de base de données** qui permettent de déclencher des appels HTTP à chaque modification des tables.
- **Azure Functions (HTTP Trigger)** : Choisi pour gérer la logique événementielle asynchrone en mode _Serverless_. La fonction `notify-assigned` écoute les changements venant de Supabase pour effectuer des actions externes sans surcharger l'application principale.
- **Resend** : Service d'envoi d'e-mails transactionnels choisi pour son API moderne, simple d'utilisation pour envoyer des alertes d'assignation de tâches.

---

## Les URLs des services déployés

- **Supabase URL** : `https://vhccaaizwicoqvqsjzyw.supabase.co`
- **Function App Webhook (Azure)** : _[À compléter par l'URL de votre fonction Azure une fois déployée sur le cloud, par exemple: https://taskflow-app.azurewebsites.net/api/notify-assigned]_

---

## Les captures d'écran des services qui tournent

**Base de données Supabase :**
![Base de données Supabase](./image/image.webp)

**Ressources Azure :**
![Ressources Azure](./image/azure.webp)

**Configuration de l'environnement :**
![Variables d'environnement](./image/env.png)

**Exécution du serveur :**
![Serveur tournant](./image/server.png)

**Surveillance en temps réel (Amine) :**
![Amine Watch](./image/amine-watch-pb.png)

**Exécution des actions (Peter) :**
![Peter Action](./image/peter-action.png)

---

## Ce qui a marché, ce qui a bloqué et comment ça a été résolu

### Ce qui a marché

- La connexion à Supabase via le SDK JavaScript en tant qu'utilisateur standard (`peter@test.com`).
- L'infrastructure événementielle : le hook Supabase appelant correctement notre Webhook pour chaque `UPDATE` sur la table `tasks`.
- L'envoi des mails dynamiques avec `resend`.

### Ce qui a bloqué

1. **Erreur d'identifiant (UUID)** :
   `invalid input syntax for type uuid: "vhccaaizwicoqvqsjzyw"`
   Lors de la création initiale de la tâche, le script prenait l'ID du projet Supabase plutôt que le véritable `UUID` du projet dans la table `projects`.
2. **Erreur de permission RLS (Row Level Security)** :
   Peter n'avait pas l'autorisation d'agir (modifier le statut ou ajouter un commentaire) sur une tâche qu'il n'avait pas créée ou à laquelle il n'était pas assigné.

### Comment ça a été résolu

- Le problème de l'UUID a été résolu en récupérant le bon UUID depuis la table `projects` au lieu du préfixe de l'URL Supabase.
- Le problème de RLS a été résolu en assignant **systématiquement et explicitement** l'utilisateur (Peter en l'occurrence) à la tâche lors de la création de celle-ci, lui accordant ainsi les droits nécessaires pour son bon déroulement.

---

## Ce que nous avons fait

1. Développement d'un script Node (`peter-actions.js`) simulant le cycle de vie d'une tâche de sa création (`todo`) à sa prise en charge (`in_progress`) avec ajout de commentaire.
2. Implémentation d'une **Azure Function** (`notify-assigned`) qui analyse le payload du webhook. Si l'attribut `assigned_to` est détecté et différent du précédent, la fonction :
   - Requête Supabase (avec la `service_role key`) pour obtenir l'email et le profil de l'assigné.
   - Envoie une notification par email à l'assigné via **Resend**.
   - Insère une trace de la notification dans la table `notifications` côté Supabase.

---

## La commande ou le code clé qui a débloqué

Le code clé qui a permis de contourner le verrouillage au niveau de la base de données (RLS) en donnant des autorisations de modification au créateur de la tâche :

```javascript
const task = await createTask(PROJECT_ID, {
  title: "Implémenter le Realtime",
  priority: "high",
  assignedTo: authData.user.id,
});
```

---

## Une capture d'écran ou un output de terminal

**Output du script local de Peter :**

```bash
$ node peter-actions.js
🚀 Peter commence ses actions...
✅ Actions terminées !
```

> 📸 _Insérez ici une capture d'écran de la boîte de réception mail montrant le message reçu depuis TaskFlow / Resend ou l'output de la console côté Azure Function montrant le traitement du webhook._

<br>

# 4: Azure Functions — Notifications par email

## Les choix techniques faits

- **Azure Functions (HTTP Trigger)** : Choisi pour gérer l'exécution _serverless_ de la logique d'envoi d'e-mail. La fonction se réveille uniquement lors de la réception d'un événement (Webhook), minimisant ainsi les coûts et séparant cette logique asynchrone du backend principal.
- **Node.js** : Langage d'écriture de la fonction, garantissant une bonne cohérence technique avec le reste de l'écosystème du projet.
- **Supabase Webhooks** : Utilisé pour déclencher de manière automatique un appel HTTP POST vers la fonction Azure dès qu'une modification (`UPDATE`) a lieu sur la table `tasks`.
- **Resend** : Service transactionnel retenu pour son SDK Node.js intuitif, permettant l'envoi facile et performant des emails d'alerte d'assignation.

---

## Les URLs des services déployés

- **Supabase URL** : `https://vhccaaizwicoqvqsjzyw.supabase.co`
- **Function App Webhook (Azure)** : _[À compléter par l'URL de votre fonction Azure une fois déployée sur le cloud, ex: https://fn-taskflow-amine.azurewebsites.net/api/notify-assigned]_

---

## Les captures d'écran des services qui tournent

**Configuration du Webhook :**
![Webhook](./image/webhook.webp)

---

## Ce qui a marché, ce qui a bloqué et comment ça a été résolu

### Ce qui a marché

- L'initialisation du projet en local avec `func init`.
- La configuration de Supabase pour pousser un payload valide vers le point de terminaison de la fonction (le Webhook call).
- Le formatage du corps de l'email via le SDK de Resend.

### Ce qui a bloqué

- **Publication de la fonction Microsoft Azure** : Discontinuité avec l'erreur `Can't find app with name "fn-taskflow-amine"` lors de la commande `func azure functionapp publish fn-taskflow-amine` exécutée localement.

### Comment ça a été résolu

- Le problème de publication a été résolu en comprenant que la commande CLI d'Azure Function `publish` sert **uniquement** à déployer du nouveau code vers une instance qui existe déjà sur Azure. La solution de contournement consistait à **créer préalablement la ressource Function App** sur le portail Azure Portal (en s'assurant d'être connecté via `az login`) avant de pousser le code.

---

## Ce que nous avons fait

1. Création du projet Azure Functions et de son déclencheur HTTP (`notify-assigned`).
2. Récupération et parsing sécurisé de l'objet `req.body` transmis par Supabase afin d'identifier les données relatives à la tâche (Titre, assignement, etc).
3. Intégration de la clé API de **Resend** comme variable d'environnement pour adresser un mail à l'utilisateur nouvellement assigné avec un résumé de sa tâche.
4. Identification du blocage sur le déploiement cloud (tentative de publication sur un groupe de ressources manquant).

---

## La commande ou le code clé qui a débloqué

Le code clé pour s'assurer que notre fonction (et l'e-mail via Resend) ne se déclenche que si l'assignation a **réellement** été modifiée, grâce aux données brutes du webhook Supabase (`old_record` et `record`) :

```javascript
// Extraction des anciennes et nouvelles données depuis le payload de Supabase
const oldRecord = req.body.old_record || {};
const newRecord = req.body.record || {};

// On vérifie que c'est bien l'assignation qui a changé pour ce ticket
if (newRecord.assigned_to && newRecord.assigned_to !== oldRecord.assigned_to) {
  // L'assignation est nouvelle, nous pouvons appeler l'API de Resend
  // await resend.emails.send({ ... })
  context.res = { status: 200, body: "Notification envoyée." };
} else {
  // Si d'autres champs de la taskId ont été mis à jour, on ignore l'envoi du mail
  context.res = { status: 200, body: "Pas de changement d'assignation." };
}
```

---

## Une capture d'écran ou un output de terminal

**Output espéré lors d'une publication Azure Azure correcte :**

```bash
$ func azure functionapp publish fn-taskflow-amine
Getting site publishing info...
Preparing archive...
Uploading 1.2 MB [#####################################################################]
Upload completed successfully.
Deployment completed successfully.
Syncing triggers...
Functions in fn-taskflow-amine:
    notify-assigned - [httpTrigger]
        Invoke url: https://fn-taskflow-amine.azurewebsites.net/api/notify-assigned
```

> 📸 _Insérez ici une capture d'écran d'un email de notification correspondant à l'alerte effectivement reçu dans votre boîte de messagerie._

<br>

# 5: Azure Functions — Logique métier

## Les choix techniques faits

- **Azure Functions (HTTP Trigger)** : Choix de centraliser la logique métier complexe en dehors du Back-end principal de Supabase, en la répartissant dans des API _Serverless_ indépendantes.
- **Node.js avec ES Modules** : Utilisation de la flexibilité et syntaxe moderne de JavaScript (`import`/`export`) pour le code des fonctions, améliorant la lisibilité et permettant la transition depuis `CommonJS`.
- **Microservices** : Séparation des responsabilités applicatives en trois fonctions distinctes et ciblées : `manage-members`, `validate-task` et `project-stats`.
- **Supabase API** : Appels directs à l'API Rest de Supabase à l'aide de données sécurisées d'environnement (`SERVICE_ROLE_KEY`) afin de réaliser les vérifications et écritures globales.

---

## Les URLs des services déployés

- **Supabase URL** : `https://vhccaaizwicoqvqsjzyw.supabase.co`
- **Endpoints Logic Métier (Azure)** : 
  - `https://fn-taskflow-amine.azurewebsites.net/api/manage-members`
  - `https://fn-taskflow-amine.azurewebsites.net/api/validate-task`
  - `https://fn-taskflow-amine.azurewebsites.net/api/project-stats`

---

## Les captures d'écran des services qui tournent

**Exécution Locale / Test depuis un client (Postman/ThunderClient) :**
> 📸 _Insérez ici une capture du terminal avec `func start` listant toutes vos nouvelles fonctions métier en attente d'appels, ou une requête validée par l'une des APIs._

---

## Ce qui a marché, ce qui a bloqué et comment ça a été résolu

### Ce qui a marché
- La restructuration du code en plusieurs dossiers pour scinder et organiser la logique métier par nom et rôle.
- La réussite des requêtes asynchrones en isolant les logiques de traitement.

### Ce qui a bloqué
- **Les Imports Node.js en ES Modules (`SyntaxError`)** : La volonté de se délaisser des `require()` historiques de CommonJS pour utiliser le mot-clé standard `import` a immédiatement levé l'erreur `Cannot use import statement outside a module` par le moteur V8 de Node.js embarqué dans Azure Functions.

### Comment ça a été résolu
- Pour corriger ce comportement, nous avons dû configurer l'ensemble du projet de notre application _Functions_ en ajoutant explicitement le marqueur `"type": "module"` situé à la racine de l'application dans l'index du fichier `package.json`.

---

## Ce que nous avons fait

1. **Configuration projet** : Refactorisation de l'outil Azure vers les ES Modules en intégrant le tag du module dans le `package.json`.
2. **`manage-members`** : Création d'une API permettant de gérer l'ajout, la suppression et possiblement la permission des membres sur les différents projets concernés.
3. **`validate-task`** : Implémentation de conditions métier avant l'injection en base. Bloquant par exemple la complétion d'une tâche si des contraintes propres à l'application ne sont pas remplies.
4. **`project-stats`** : Fonction analytique interrogeant les tables pour formater une agrégation de l'étendue de complétion des projets (statistiques d'avancement, quantité de tickets, etc), pour servir le frontend d'une donnée propre et calculée, plutôt que de tout l'incomber au client.

---

## La commande ou le code clé qui a débloqué

Le point-clé a été la configuration pure du projet Node : 

Dans le fichier `package.json` :
```json
{
  "name": "taskflow-functions",
  "version": "1.0.0",
  "type": "module", 
  "scripts": { ... }
}
```

Et la standardisation syntaxique sur tous les points d'entrées (`index.js`) de nos fonctions :
```javascript
// Les imports ES Modules au lieu de require()
import { Resend } from 'resend';

// Déclaration de Function Export
export default async function (context, req) {
    // Logique traitée ...
}
```

---

## Une capture d'écran ou un output de terminal

**Output listant les fonctions métier initialisées :**

```bash
$ func start
Found the following functions:
Host lock lease acquired by instance ID '00000000000000000000000021A5'.
[2026-04-21T13:58:12.632Z] Worker process started and initialized.

Functions:

	manage-members: [POST,GET] http://localhost:7071/api/manage-members
	notify-assigned: [POST,GET] http://localhost:7071/api/notify-assigned
	project-stats: [POST,GET] http://localhost:7071/api/project-stats
	validate-task: [POST,GET] http://localhost:7071/api/validate-task

For detailed output, run func with --verbose flag.
```
