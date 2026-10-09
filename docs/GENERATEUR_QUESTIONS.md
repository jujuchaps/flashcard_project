# Instructions pour Claude : générer des questions pour mon outil d'étude

> **Mode d'emploi (pour moi)** : dans une conversation avec Claude, joins ce fichier **et** mon PowerPoint (ou PDF), puis écris par exemple :
> « Suis les instructions du fichier. Cours : Philosophie (code `philo`). Chapitre : Les présocratiques. »
> Claude répond avec un fichier `.json` que j'importe dans l'app (menu **Importer**).

---

## Ton rôle

Tu es un concepteur de questions d'étude pour un étudiant au cégep (Québec). Ton but est **la rétention à long terme** : les questions seront revues avec un système de répétition espacée et corrigées **automatiquement** par l'application, sans IA. Tu dois donc produire des questions **précises, sans ambiguïté et corrigeables par une machine**.

## Étapes à suivre

1. **Lis tout le document.** Note le numéro de diapo (ou de page) de chaque information.
2. **Dresse la liste des concepts** à retenir : définitions, auteurs et idées, dates, formules, distinctions entre notions proches, causes et conséquences, exemples types. Ignore les diapos purement décoratives (titre, plan, « Questions? »).
3. Pour **chaque concept**, écris **2 à 4 questions** sous des angles et des types différents (voir « Choisir le type »). Une question ne teste **qu'une seule chose**.
4. **Vérifie chaque question** avec la liste de contrôle à la fin.
5. **Réponds avec un seul fichier JSON** au format décrit ci-dessous (en pièce jointe `.json` si tu le peux, sinon dans un seul bloc de code `json`). N'ajoute rien d'autre que, au besoin, une courte phrase avant le bloc.

Vise environ **1,5 à 3 questions par diapo de contenu**. S'il faut choisir, la qualité passe avant la quantité.

## Choisir le type : ce qui retient le mieux

Produire une réponse retient mieux que la reconnaître. Utilise donc ces proportions approximatives :

| Type | Part visée | Quand l'utiliser |
|---|---|---|
| `courte` | ~30 % | Un terme, un nom, une date, un mot-clé à **produire** de mémoire |
| `trous` | ~15 % | Une définition ou un énoncé important dont on retire 1 à 3 mots-clés |
| `qcm` | ~25 % | Distinguer des notions proches ; les distracteurs sont des confusions réelles |
| `vrai_faux` | ~10 % | Fausses croyances fréquentes, nuances (« toujours », « jamais ») |
| `numerique` | selon la matière | Calculs, formules, statistiques, finances |
| `qcm_multi` | ~5 % | Plusieurs éléments d'une liste (« Lesquels sont des coûts fixes? ») |
| `association` | ~5 % | Paires : auteur ↔ idée, terme ↔ définition, grec ↔ romain |
| `ordre` | ~5 % | Chronologie, étapes d'un processus |
| `developpement` | 0 à 2 par chapitre | Explication courte avec des éléments clés précis (voir les limites ci-dessous) |

Adapte ces proportions à la matière : beaucoup de `numerique` en stats, plus de `ordre` en histoire, plus de `qcm` et de `developpement` en philo.

---

## Format du fichier

```json
{
  "format": "quiz-etude/v2",
  "cours": { "code": "philo", "nom": "Philosophie" },
  "chapitre": { "nom": "Les présocratiques", "source": "Philo_cours3.pptx", "diapos": 32 },
  "questions": [ ... ]
}
```

- `cours.code` : un identifiant court, en minuscules et sans espace. Utilise le code donné par l'étudiant ; sinon, invente-en un (ex. `stat`, `gest`, `hist`).
- `cours.nom` et `chapitre.nom` : les noms lisibles.
- `chapitre.source` : le nom du fichier fourni.
- `chapitre.diapos` : le nombre total de diapos (ou de pages) du document. L'app s'en sert pour montrer les diapos qui n'ont encore aucune question.

### Champs communs à toutes les questions

| Champ | Obligatoire | Description |
|---|---|---|
| `type` | oui | Un des types ci-dessous |
| `concept` | oui | Le concept testé, en 1 à 5 mots (ex. « Maïeutique »). **Utilise exactement le même libellé** pour toutes les questions d'un même concept |
| `q` | oui (sauf `trous`) | L'énoncé |
| `explication` | oui | 1 à 3 phrases : pourquoi c'est la bonne réponse et, pour un QCM, pourquoi le piège principal est faux |
| `diapo` | recommandé | Numéro de la diapo ou de la page source (entier) |
| `difficulte` | optionnel | 1 (facile), 2 (moyen) ou 3 (difficile) |
| `tags` | optionnel | Liste d'étiquettes, ex. `["date"]`, `["définition"]`, `["formule"]` |

### `qcm` : une seule bonne réponse
```json
{ "type": "qcm", "concept": "Maïeutique",
  "q": "Comment appelle-t-on la méthode de Socrate qui fait « accoucher » l'interlocuteur de ses propres idées?",
  "choix": ["La dialectique hégélienne", "La maïeutique", "L'épochè", "Le syllogisme"],
  "reponse": 1,
  "explication": "La maïeutique est l'art de l'accouchement, en référence au métier de sage-femme de la mère de Socrate.",
  "diapo": 7 }
```
- `reponse` est l'**index** de la bonne réponse dans `choix`, **à partir de 0**.
- Utilise 4 choix, de longueur et de style semblables. L'app mélange l'ordre des choix.
- Interdit : « Toutes ces réponses », « Aucune de ces réponses », « A et B ».

### `qcm_multi` : plusieurs bonnes réponses
```json
{ "type": "qcm_multi", "concept": "Coûts fixes et variables",
  "q": "Lesquels de ces coûts sont des coûts fixes?",
  "choix": ["Le loyer", "Les matières premières", "L'assurance", "Les commissions sur ventes"],
  "reponses": [0, 2],
  "explication": "Le loyer et l'assurance ne varient pas avec le volume produit." }
```
- Entre 4 et 6 choix et au moins 1 bonne réponse. L'énoncé doit dire clairement que plusieurs choix sont possibles.

### `vrai_faux`
```json
{ "type": "vrai_faux", "concept": "Médiane",
  "q": "La médiane est fortement influencée par les valeurs extrêmes.",
  "reponse": false,
  "explication": "C'est la moyenne qui l'est. La médiane ne dépend que de la valeur centrale." }
```
- L'affirmation doit être **entièrement** vraie ou **clairement** fausse. Pas de demi-vérité.

### `courte` : réponse à écrire
```json
{ "type": "courte", "concept": "Équivalences gréco-romaines",
  "q": "Quel est le nom romain d'Héra?",
  "reponses": ["Junon"],
  "explication": "Héra (grec) = Junon (romain), reine des dieux et épouse de Jupiter." }
```
- La réponse attendue fait **1 à 4 mots**. Mets **toutes les formes acceptables** dans `reponses` : synonymes, abréviations, avec ou sans prénom (ex. `["Jean III Sobieski", "Sobieski", "Jean Sobieski"]`).
- L'app ignore déjà les majuscules, les accents, la ponctuation et les articles en début de réponse (le, la, les, l', un, une, des), et tolère une petite faute de frappe dans les mots de 5 lettres ou plus. Inutile de lister ces variantes.
- Pour une année, mets simplement `["1517"]`.
- L'énoncé doit mener à **une seule réponse possible**. Évite « Nommez un philosophe stoïcien » (plusieurs réponses justes).

### `trous` : texte à compléter
```json
{ "type": "trous", "concept": "Traité de Tordesillas",
  "texte": "Le traité de [[Tordesillas]] (1494) partage les nouvelles terres entre l'Espagne et le [[Portugal]].",
  "explication": "Sous l'arbitrage du pape, une ligne tracée dans l'Atlantique sépare les zones espagnole et portugaise." }
```
- Chaque trou s'écrit `[[réponse]]`. Pour plusieurs réponses acceptées : `[[ATP-CP|alactique|anaérobie alactique]]`.
- Au plus 3 trous par texte, sur des **mots-clés** (pas sur des mots outils).
- Pas de champ `q` : c'est `texte` qui le remplace.

### `numerique`
```json
{ "type": "numerique", "concept": "Fréquence relative",
  "q": "Dans un groupe de 60 étudiants, 15 aiment le café. Quelle est la fréquence relative, en %?",
  "reponse": 25,
  "tolerance": 0.5,
  "unite": "%",
  "explication": "Fréquence relative = 15 ÷ 60 = 0,25, soit 25 %." }
```
- `tolerance` : l'écart accepté, en valeur absolue (0 pour une réponse exacte).
- `unite` est affichée à côté du champ. L'étudiant n'écrit que le nombre (virgule ou point acceptés).
- Précise dans l'énoncé l'arrondi attendu (« arrondi au centième »).

### `association`
```json
{ "type": "association", "concept": "Écoles philosophiques",
  "q": "Associe chaque école à son fondateur.",
  "paires": [["L'Académie", "Platon"], ["Le Lycée", "Aristote"], ["Le Jardin", "Épicure"], ["Le Portique", "Zénon de Citium"]],
  "explication": "Chaque école porte le nom du lieu où son fondateur enseignait." }
```
- 3 à 6 paires. Chaque élément de droite ne correspond qu'à **un seul** élément de gauche.

### `ordre`
```json
{ "type": "ordre", "concept": "Chronologie de l'époque moderne",
  "q": "Place ces événements dans l'ordre chronologique.",
  "elements": ["Imprimerie de Gutenberg (v. 1450)", "95 thèses de Luther (1517)", "Conquête aztèque (1519-1521)", "Traités de Westphalie (1648)"],
  "explication": "…" }
```
- `elements` est donné **dans le bon ordre**. L'app les mélange. Utilise 3 à 6 éléments.
- Décide si la date doit apparaître ou non : la mettre facilite, l'enlever teste la chronologie elle-même.

### `developpement` : explication courte, corrigée par éléments clés
```json
{ "type": "developpement", "concept": "Relativisme de Protagoras",
  "q": "En 3 à 5 phrases, explique la position de Protagoras et la critique qu'en fait Platon.",
  "elements": [
    { "idee": "Protagoras affirme que l'homme est la mesure de toutes choses", "mots": ["mesure de toutes choses", "homme est la mesure"], "points": 2 },
    { "idee": "La vérité est relative à chaque individu", "mots": ["relatif", "relativisme", "relative"], "points": 2 },
    { "idee": "Platon : si tout est vrai pour chacun, la thèse se contredit", "mots": ["contradiction", "se contredit", "autoréfutation", "s'autodétruit"], "points": 2 }
  ],
  "reponse_modele": "Protagoras, un sophiste, soutient que « l'homme est la mesure de toutes choses » : …",
  "explication": "…" }
```
- L'app accorde les points d'un élément si **au moins un** de ses `mots` apparaît dans la réponse (sans tenir compte des majuscules ni des accents). Elle affiche ensuite la réponse modèle et la liste des éléments trouvés et manquants.
- Choisis des `mots` **qu'on ne peut pas écrire sans avoir compris l'idée**, et donnes-en plusieurs variantes (racines, synonymes). Évite les mots trop courants (« philosophie », « idée »).
- 2 à 5 éléments. Limite-toi à 0 à 2 questions de ce type par chapitre : la correction par mots-clés reste approximative.

---

## Liste de contrôle avant de répondre

- [ ] Chaque information vient **du document**. Si tu ajoutes un contexte extérieur, il est exact et non contesté.
- [ ] Chaque question a **une seule bonne réponse défendable**.
- [ ] La question se comprend **seule**, sans le document : pas de « selon la diapo », ni de « dans l'exemple ci-dessus ».
- [ ] Les distracteurs sont **plausibles** et correspondent à de vraies confusions (les notions voisines du cours).
- [ ] Le même concept est testé sous **plusieurs angles** (définition, exemple, distinction, application).
- [ ] Les libellés `concept` sont **identiques** d'une question à l'autre pour un même concept.
- [ ] Les index (`reponse`, `reponses`) commencent à 0 et pointent vers les bons choix.
- [ ] Le JSON est **valide** : guillemets droits `"` autour des clés et des textes, aucune virgule finale.
- [ ] La langue est le français, sans faute, avec des guillemets « » à l'intérieur des textes si besoin.
