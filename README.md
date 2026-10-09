# Outil d'étude

Application web pour étudier par session, matière et chapitre, avec une **boucle de maîtrise** (une question ratée revient jusqu'à ce qu'elle soit réussie), une **répétition espacée adaptative** (FSRS) et une **correction 100 % automatique**.

- Plan du projet (objectifs, fonctionnement, feuille de route) : [docs/PLAN.md](docs/PLAN.md)
- Fichier d'instructions à donner à Claude avec un PowerPoint : [docs/GENERATEUR_QUESTIONS.md](docs/GENERATEUR_QUESTIONS.md)

## Démarrer

Il faut [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up -d --build
```

Ouvre ensuite **http://localhost:3000** (utilise bien `localhost` : avec `127.0.0.1`, les formulaires sont refusés par la protection CSRF).

Au premier démarrage, l'app crée la base de données et importe les 609 questions de l'ancien artefact. Les données sont conservées dans un volume Docker (`etude-db`) : arrêter l'app (`docker compose down`) ne les efface pas.

Après une mise à jour du code : `docker compose up -d --build`.

### Récupérer ta progression de l'artefact
Dans l'artefact, ouvre « Sauvegarder ou restaurer ma progression », clique sur **Créer mon code**, puis colle le texte `QC1:…` dans **Importer → Récupérer ma progression de l'artefact**.

## Ajouter des questions depuis un PowerPoint

1. Dans l'app, **Importer → Télécharge le fichier d'instructions**.
2. Dans Claude, joins ce fichier et ton PowerPoint (ou PDF), puis écris : *« Suis les instructions du fichier. Cours : Philosophie (code philo). Chapitre : Les présocratiques. »*
3. Dépose le `.json` obtenu dans **Importer**, vérifie l'aperçu, puis importe.

Un exemple avec les 9 types de questions : [data/exemples/exemple-tous-les-types.json](data/exemples/exemple-tous-les-types.json).

## Sauvegarde

**Réglages → Télécharger une sauvegarde** exporte tout (questions, progression, historique) en JSON.

## Développement

```bash
npm install
docker compose up -d db          # base de données seulement
cp .env.example .env
npm run dev                      # http://localhost:5173
npm test                         # tests unitaires
npm run check                    # vérification des types
```

Structure :

| Dossier | Contenu |
|---|---|
| `src/lib/grading.ts` | Correction automatique des 9 types de questions |
| `src/lib/mastery.ts` | Boucle de maîtrise d'une série (reprises, renforcement, plafond) |
| `src/lib/import-format.ts` | Validation du format `quiz-etude/v2` et de l'ancien format |
| `src/lib/server/srs.ts` | Répétition espacée FSRS, confiance, niveaux de maîtrise |
| `src/lib/server/study.ts` | Choix des questions et déroulement des séries |
| `migrations/` | Schéma de la base de données (appliqué au démarrage) |
| `tests/` | Tests unitaires |
