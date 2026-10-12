# Outil d'étude

Application web pour étudier par session, matière et chapitre, avec une **boucle de maîtrise** (une question ratée revient jusqu'à ce qu'elle soit réussie), une **répétition espacée adaptative** (FSRS) et une **correction 100 % automatique**.

- Plan du projet (objectifs, fonctionnement, feuille de route) : [docs/PLAN.md](docs/PLAN.md)
- Fichier d'instructions à donner à Claude avec un PowerPoint : [docs/GENERATEUR_QUESTIONS.md](docs/GENERATEUR_QUESTIONS.md)

## Démarrer

> **Débutant?** Suis le guide pas à pas : [docs/INSTALLATION.md](docs/INSTALLATION.md) (installation, utilisation, mises à jour).

Il faut [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up -d --build
```

Ouvre ensuite **http://localhost:3000**.

Au premier démarrage, l'app crée la base de données, importe les 609 questions de l'ancien artefact rangées par **session → cours → chapitre** (session Automne 2026 avec ton horaire, voir `data/seed/session-automne-2026.json`) et y applique ta progression récupérée de l'artefact (250 questions, fichier `data/seed/progression-artefact.json`). Chaque étape ne s'exécute qu'une seule fois ; une base créée avec une version précédente est réorganisée automatiquement, sans perte de progression.

## Organisation

- **Cours** (menu) ouvre la session en cours : ses cours, leur horaire de la semaine, et un lien vers toutes les sessions.
- Un **cours** contient ses **chapitres ou sujets** (créer, renommer, réordonner, déplacer vers un autre cours), son horaire, ses examens. On peut aussi fusionner deux cours.
- Un **chapitre** montre ses questions, la couverture des diapos et les questions signalées.
- **Hors session** : les cours qui ne dépendent d'aucune session (ex. Culture et intérêts perso).
- Nouvelle session (ex. Hiver 2027) : page **Sessions**. Les cours des sessions passées continuent de revenir dans les révisions jusqu'à ce que tu les archives. Les données sont conservées dans un volume Docker (`etude-db`) : arrêter l'app (`docker compose down`) ne les efface pas.

Après une mise à jour du code : `docker compose up -d --build`.

### Récupérer une autre progression de l'artefact
Ta progression est déjà appliquée automatiquement. Si tu as étudié sur un autre appareil, ouvre l'artefact sur cet appareil, puis « Sauvegarder ou restaurer ma progression » → **Créer mon code**, et colle le texte `QC1:…` dans **Importer → Récupérer ma progression de l'artefact**. Les questions déjà suivies ne sont pas écrasées.

## Ajouter des questions depuis un PowerPoint

1. Dans l'app, **Importer → Télécharge le fichier d'instructions**.
2. Dans Claude, joins ce fichier et ton PowerPoint (ou PDF), puis écris : *« Suis les instructions du fichier. Cours : Philosophie et rationalité (code philo). Chapitre : Les présocratiques. »*
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
| `src/lib/server/structure.ts` | Sessions, cours, chapitres, horaire : lecture, déplacement, fusion |
| `src/lib/server/setup.ts` | Migrations de données (réorganisation, session et horaire de départ) |
| `migrations/` | Schéma de la base de données (appliqué au démarrage) |
| `tests/` | Tests unitaires |
