# Installer et mettre à jour l'app (guide pour débutant)

Ce guide ne demande aucune connaissance en informatique. Tu installes **deux logiciels gratuits** une seule fois, puis tu tapes **une seule commande**.

- **Docker Desktop** fait tourner l'app et sa base de données sur ton ordi.
- **GitHub Desktop** télécharge le code de l'app, puis ses mises à jour.

---

## A. Première installation (une seule fois, environ 20 minutes)

### 1. Installer Docker Desktop
1. Va sur https://www.docker.com/products/docker-desktop/ et télécharge la version pour ton ordi (Windows ou Mac).
2. Lance l'installation et accepte les options proposées.
   - **Sur Windows**, si l'installateur parle de « WSL 2 », accepte. Si l'ordi demande de redémarrer, redémarre.
3. Ouvre **Docker Desktop**. Tu peux passer la création de compte (« Skip »).
4. Attends que la petite baleine en bas à gauche soit verte, avec le message « Engine running ».

### 2. Installer GitHub Desktop et télécharger l'app
1. Va sur https://desktop.github.com/ et installe GitHub Desktop.
2. Ouvre-le et connecte-toi avec ton compte GitHub (**jujuchaps**).
3. Menu **File → Clone repository…**
4. Dans l'onglet **GitHub.com**, choisis **jujuchaps/flashcard_project**.
5. Dans « Local path », choisis où mettre le dossier (par exemple `Documents\flashcard_project`), puis clique sur **Clone**.

### 3. Lancer l'app
1. Dans GitHub Desktop, menu **Repository → Open in Command Prompt** (sur Mac : **Open in Terminal**).
   - Une fenêtre noire s'ouvre, déjà placée dans le bon dossier. Si GitHub Desktop te demande de choisir un terminal, accepte celui qu'il propose.
2. Tape exactement cette commande, puis appuie sur **Entrée** :
   ```
   docker compose up -d --build
   ```
3. La première fois, ça prend **3 à 5 minutes**, parce que Docker télécharge tout ce qu'il faut. Attends le retour de la ligne de commande : des lignes « Started » ou « Running » s'affichent.
4. Ouvre ton navigateur à l'adresse **http://localhost:3000**.

Au premier démarrage, l'app prépare tout toute seule : la session Automne 2026, tes cours avec leur horaire, les 609 questions et ta progression de l'artefact.

---

## B. Utilisation au quotidien

- Il suffit que **Docker Desktop soit ouvert**. L'app redémarre toute seule avec lui, tu n'as pas besoin de retaper la commande.
- Ouvre **http://localhost:3000**. Mets-le dans tes favoris.
- Sur ton téléphone (même Wi-Fi que l'ordi) : la page **Réglages** de l'app explique comment faire.

---

## C. Récupérer une mise à jour (quand Claude a modifié l'app)

À faire chaque fois que je te dis qu'une modification est poussée.

1. Ouvre **GitHub Desktop**.
2. Clique sur **Fetch origin** en haut. Si le bouton devient **Pull origin**, clique dessus : le nouveau code est téléchargé.
3. Menu **Repository → Open in Command Prompt** (ou **Open in Terminal**), puis tape :
   ```
   docker compose up -d --build
   ```
4. Attends environ 1 minute, puis **rafraîchis** la page http://localhost:3000.

**Tes données sont conservées** : ta progression, tes questions et tes examens restent dans la base de données. L'app applique automatiquement les changements nécessaires au démarrage.

---

## D. En cas de problème

| Ce que tu vois | Quoi faire |
|---|---|
| « Cannot connect to the Docker daemon » ou « docker n'est pas reconnu » | Docker Desktop n'est pas ouvert : ouvre-le, attends « Engine running », puis recommence. |
| La page http://localhost:3000 ne s'ouvre pas | Attends une minute (l'app démarre), puis rafraîchis. Sinon, vérifie dans Docker Desktop que le groupe « flashcard_project » est vert. |
| « port is already allocated » | Un autre programme utilise le port 3000. Redémarre l'ordi, puis relance la commande. |
| Autre message d'erreur | Tape `docker compose logs app`, copie les dernières lignes et envoie-les-moi. |

### Arrêter l'app (rarement utile)
```
docker compose down
```
Ça **garde** tes données. Pour relancer : `docker compose up -d`.

> ⚠️ **Ne tape jamais** `docker compose down -v` : le `-v` **efface la base de données**, donc toute ta progression.

### Sauvegardes
- Une copie automatique de la base est faite chaque jour dans le dossier `backups` du projet (30 jours conservés).
- Tu peux aussi télécharger une sauvegarde complète : page **Réglages → Télécharger une sauvegarde**.
