# Outil d'étude

Application web pour étudier par session, matière et chapitre, avec une **boucle de maîtrise** (une question ratée revient jusqu'à ce qu'elle soit réussie), une **répétition espacée adaptative** (FSRS) et une **correction 100 % automatique**.

- Plan du projet (objectifs, fonctionnement, feuille de route) : [docs/PLAN.md](docs/PLAN.md)
- Fichier d'instructions à donner à Claude avec un PowerPoint : [docs/GENERATEUR_QUESTIONS.md](docs/GENERATEUR_QUESTIONS.md)

## Démarrer

Il faut [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up -d --build
```

Ouvre ensuite **http://localhost:3000**.

Au premier démarrage, l'app crée la base de données et importe les 609 questions de l'ancien artefact. Les données sont conservées dans un volume Docker (`etude-db`) : arrêter l'app (`docker compose down`) ne les efface pas.

Après une mise à jour du code : `docker compose up -d --build`.

### Récupérer ta progression de l'artefact
Dans l'artefact, ouvre « Sauvegarder ou restaurer ma progression », clique sur **Créer mon code**, puis colle le texte `QC1:…` dans **Importer → Récupérer ma progression de l'artefact**.

## Ajouter des questions depuis un PowerPoint

1. Dans l'app, **Importer → Télécharge le fichier d'instructions**.
2. Dans Claude, joins ce fichier et ton PowerPoint (ou PDF), puis écris : *« Suis les instructions du fichier. Cours : Philosophie (code philo). Chapitre : Les présocratiques. »*
3. Dépose le `.json` obtenu dans **Importer**, vérifie l'aperçu, puis importe.

Un exemple avec les 9 types de questions : [data/exemples/exemple-tous-les-types.json](data/exemples/exemple-tous-les-types.json).

## Examens et suivi

- **Examens** : entre tes dates d'évaluation (et les chapitres couverts). L'app calcule ta préparation, répartit les nouvelles questions jusqu'au jour J (plan du jour sur l'accueil) et propose un **sprint** (les questions les plus à risque) et un **examen blanc** chronométré, corrigé à la fin. Après l'examen, entre ta vraie note pour la comparer à la prédiction.
- **Progrès** : jours d'étude, questions par jour, charge prévue sur 14 jours, courbe de maîtrise, alertes, et un **bilan de la semaine** à copier pour Claude.

## Sur ton téléphone

1. L'app tourne sur ton ordi, et le téléphone est sur le même Wi-Fi.
2. Sur le téléphone, ouvre `http://<adresse-de-ton-ordi>:3000` (par exemple `http://192.168.1.20:3000`).
3. Ajoute la page à l'écran d'accueil (iPhone : Partager → « Sur l'écran d'accueil » ; Android : ⋮ → « Ajouter à l'écran d'accueil »).

Pour y accéder **hors de chez toi** sans exposer l'app sur Internet, le plus simple est [Tailscale](https://tailscale.com/) (gratuit) sur l'ordi et le téléphone : l'app reste privée, accessible à l'adresse Tailscale de l'ordi. Si tu l'héberges sur un serveur public, mets-la derrière HTTPS (par exemple avec Caddy) et définis un mot de passe :

```bash
echo "APP_PASSWORD=un-mot-de-passe-solide" > .env
docker compose up -d
```

## Sauvegarde

- **Automatique** : avec Docker, une copie de la base est faite chaque jour dans le dossier `backups/` (30 jours conservés). Pour restaurer : `gunzip -c backups/etude-AAAA-MM-JJ.sql.gz | docker compose exec -T db psql -U etude etude` (sur une base vide).
- **Manuelle** : **Réglages → Télécharger une sauvegarde** exporte tout (questions, progression, historique) en JSON.

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
| `src/lib/server/study.ts` | Choix des questions et déroulement des séries (révision, ciblé, erreurs, sprint, examen blanc) |
| `src/lib/server/planning.ts` | Examens, préparation, plan du jour, prévision de charge, alertes |
| `src/lib/server/progress.ts` | Historique d'étude et bilan hebdomadaire |
| `src/lib/server/security.ts` | Protection CSRF et mot de passe optionnel |
| `migrations/` | Schéma de la base de données (appliqué au démarrage) |
| `tests/` | Tests unitaires |
