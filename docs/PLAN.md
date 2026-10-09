# Plan du projet : outil d'étude à rétention maximale

> Document vivant. Il décrit **quoi** on construit et **pourquoi**. La technique est volontairement reléguée à l'annexe.
> Les décisions encore ouvertes sont marquées **❓** et regroupées à la section 14.

---

## 1. Point de départ

### Ce qui marche déjà (l'artefact actuel)
- Environ **610 questions** réparties dans **20 cours** (Philo/JO et mythes, Analyse quantitative, Français, Gestion, Histoire, etc.).
- Un QCM simple avec explication après chaque réponse.
- Une répétition espacée de base : 5 niveaux, avec des intervalles fixes de 0, 1, 3, 7 et 14 jours.
- Une question ratée est reposée à la fin de la série, une seule fois.
- Des stats par cours (maîtrisées, en apprentissage, à retravailler) et une liste des questions les plus ratées.

### Ce qui coince
| Problème | Conséquence |
|---|---|
| Les questions sont écrites en dur dans le fichier | Chaque ajout passe par Claude, qui régénère l'artefact |
| La progression vit dans le navigateur | Elle se perd facilement : il faut des « codes de sauvegarde » manuels |
| Il n'y a pas de notion de session, de chapitre ni d'examen | Impossible de cibler « le chapitre 3 de Stats avant l'examen de jeudi » |
| Il n'y a que des QCM | La reconnaissance (choisir parmi 4) retient moins que le rappel (produire la réponse) |
| Une question ratée revient une seule fois, puis la série se termine | Aucune garantie de maîtrise à la fin de la série |
| Les intervalles sont fixes (max 14 jours) | Rien n'est adapté à toi ni à la difficulté de la question, et rien ne vise le long terme |
| Le suivi est minimal | Pas d'historique, de tendance ni de prédiction pour l'examen |

---

## 2. Vision

> **Un seul endroit où je dépose mes cours, et qui me dit chaque jour quoi réviser, pendant combien de temps, pour arriver à l'examen en maîtrisant tout, et m'en souvenir encore après.**

L'outil :
1. **avale** tes documents (PowerPoint, PDF, notes) et en tire des questions de qualité, rattachées à la diapo source ;
2. **t'interroge** de la bonne façon, au bon moment, avec plusieurs formats de questions ;
3. **ne te lâche pas** tant qu'une notion n'est pas réellement acquise ;
4. **corrige** aussi les réponses à développement ;
5. **mesure, prédit et rend compte** : où tu en es, ce qui est en train de s'effacer, à quel point tu es prêt pour chaque examen ;
6. **dure** : tes données t'appartiennent, survivent aux sessions et peuvent être hébergées plus tard.

---

## 3. Objectifs mesurables

| # | Objectif | Comment on le mesure | Cible |
|---|---|---|---|
| O1 | Rétention à long terme | Taux de bonnes réponses aux questions revues après plus de 21 jours | ≥ 85 % |
| O2 | Maîtrise avant l'examen | « Indice de préparation » de la matière la veille de l'examen | ≥ 90 % |
| O3 | Passer vite du document au quiz | Temps entre le dépôt du PowerPoint et le premier quiz | < 5 min (plus ta révision des questions) |
| O4 | Régularité | Jours d'étude par semaine (série de jours) | ≥ 5 / 7 |
| O5 | Efficacité | Temps quotidien recommandé respecté sans surcharge | 15 à 45 min selon la période |
| O6 | Prédiction fiable | Écart entre la note prédite et la note réelle à l'examen | < 10 points |
| O7 | Zéro perte de données | Sauvegarde automatique et export complet possible | Toujours |

---

## 4. Principes d'apprentissage (le « pourquoi » derrière chaque fonction)

Chaque fonction de l'outil doit servir au moins un de ces principes, qui sont parmi les mieux documentés en sciences cognitives.

1. **Rappel actif** (*testing effect*) : se forcer à produire la réponse grave l'information bien plus que relire. → On privilégie la réponse courte, le texte à trous et le développement plutôt que le QCM seul.
2. **Répétition espacée** : revoir une notion juste avant de l'oublier. → Un algorithme adaptatif calcule pour chaque question le meilleur moment pour la revoir.
3. **Rétroaction immédiate et expliquée** : savoir *pourquoi* on s'est trompé. → Chaque question a une explication, la source (diapo) et, si besoin, une réexplication par l'IA.
4. **Maîtrise avant progression** (*mastery learning*) : on ne passe pas à autre chose tant que ce n'est pas acquis. → C'est la boucle de maîtrise (section 7).
5. **Entrelacement** : mélanger les matières et les chapitres améliore la discrimination entre notions proches. → La révision du jour mélange tout ; les modes ciblés restent disponibles.
6. **Difficulté désirable** : un effort raisonnable consolide la mémoire. → Questions reformulées, formats variés, choix mélangés, pas de question reposée immédiatement après un échec.
7. **Métacognition** : savoir ce qu'on sait vraiment. → On te demande ton niveau de confiance, et une bonne réponse devinée ne compte pas comme maîtrisée.
8. **Élaboration** : relier, expliquer dans ses mots. → Questions « explique dans tes mots » corrigées par l'IA.

---

## 5. Organisation du contenu

```
Session (ex. Automne 2026)
 └─ Cours / Matière (ex. Philosophie 101, prof, pondération des évaluations)
     ├─ Évaluations (Examen intra le 24 oct. → chapitres 1 à 4, 30 %)
     └─ Chapitre / Thème (souvent = 1 PowerPoint)
         ├─ Document source (diapos consultables)
         └─ Concepts (ex. « maïeutique », « médiane »)
             └─ Questions (plusieurs formats par concept)
```

**Objectifs de cette structure**
- **Flexibilité totale** : créer, renommer, fusionner, déplacer des sessions, cours et chapitres ; un cours peut exister sans session.
- **Concept = unité de maîtrise.** Plusieurs questions testent le même concept sous des angles différents. On peut ainsi dire « tu maîtrises 18 concepts sur 25 du chapitre 3 », pas seulement « 70 % des questions ».
- **Étiquettes libres** (ex. « dates », « définitions », « formules ») pour des quiz transversaux.
- **Historique conservé entre les sessions** : un cours terminé passe en mode *archive* (rien n'est perdu) ou en mode *entretien* (quelques révisions légères, utile pour les cours cumulatifs comme Philo 1 → 2 ou Français).
- **Migration** : les 20 cours et 610 questions actuels sont importés tels quels dans une session « Automne 2026 » (à confirmer **❓**), avec ta progression si tu fournis ton code de sauvegarde `QC1:`.

---

## 6. Types de questions

| Type | Exemple | Correction | Priorité |
|---|---|---|---|
| **QCM, une bonne réponse** | Format actuel | Automatique | V1 |
| **QCM, plusieurs bonnes réponses** | « Lesquelles sont des coûts variables? » | Automatique, points partiels | V1 |
| **Vrai / Faux** (+ justification optionnelle) | « La médiane est sensible aux valeurs extrêmes. » | Automatique (la justification par l'IA) | V1 |
| **Réponse courte** | « Nom romain d'Héra? » → *Junon* | Automatique, tolère accents, majuscules et petites fautes ; variantes acceptées | V1 |
| **Texte à trous** | « Le traité de ___ (1494) partage… » | Automatique | V1 |
| **Carte recto / verso** (flashcard) | Terme → définition | Auto-évaluation : *Raté / Difficile / Bien / Facile* | V1 |
| **Numérique** | « Fréquence relative de 15 sur 60? » | Automatique, avec tolérance et unités | V1 |
| **Association** | Dieu grec ↔ dieu romain | Automatique, points partiels | V2 |
| **Mise en ordre** | Classer des événements chronologiquement | Automatique, points partiels | V2 |
| **Réponse à développement** | « Expliquez la critique platonicienne du relativisme de Protagoras. » | **IA avec grille de correction** (section 8) | V2 |
| **Explique dans tes mots** | « Explique la surcharge progressive à un ami. » | IA : exactitude, complétude, clarté | V2 |
| **Question sur image** | Identifier une partie d'un schéma | Automatique | V3 |

**Règles communes à toutes les questions**
- Une **explication** (pourquoi c'est la bonne réponse et pourquoi les autres choix sont faux).
- Un **lien vers la source** (document et numéro de diapo) quand elle existe.
- Une **difficulté estimée**, ajustée ensuite selon tes vrais résultats.
- Les **choix sont mélangés** à chaque affichage, pour qu'on ne retienne pas une position.
- Des **variantes** : une même notion peut avoir 2 ou 3 formulations, qui alternent pour qu'on ne retienne pas la phrase par cœur.
- Un bouton **« Signaler »** (question ambiguë, fausse ou mal formulée) qui retire la question des quiz jusqu'à correction.

---

## 7. Le cœur : la boucle de maîtrise et la répétition espacée

C'est la partie la plus importante. Deux échelles de temps s'emboîtent.

### 7.1 À l'intérieur d'une série : « tu ne sors pas tant que ce n'est pas réussi »

1. **Une question ratée revient plus tard dans la même série**, après 3 à 5 autres questions, jamais tout de suite (sinon c'est la mémoire à court terme qui répond).
2. **Une question ratée doit être réussie pour terminer la série.** La barre de progression montre les questions *réglées* et les questions *encore en jeu*.
3. **Ratée 2 fois dans la même série** :
   - l'outil affiche une **explication approfondie** et ouvre la diapo source ;
   - la question doit être réussie **2 fois** avant de sortir, idéalement une fois sous une **autre forme** (variante ou autre format sur le même concept).
4. **Renforcement automatique**, ce que tu demandes avec « s'il échoue, il doit recommencer plus de questions de la matière » : si, dans une série, un chapitre ou un concept dépasse un seuil d'échec au premier essai (proposition : 40 %, ou au moins 3 échecs), l'outil **ajoute des questions supplémentaires de ce chapitre** (des nouvelles d'abord, puis les plus fragiles) et le signale clairement : « Renforcement : +5 questions sur *Les présocratiques* ».
5. **Plafond anti-épuisement** : une série ne peut pas gonfler sans fin (proposition : au plus 2 fois sa taille de départ). Au-delà, on te propose d'arrêter, et les questions non réglées passent **en tête de la prochaine série**.
6. **Sortie possible à tout moment** : rien n'est perdu, la série reprend là où tu l'as laissée.

### 7.2 Entre les séries : la répétition espacée adaptative

- On remplace les intervalles fixes (0, 1, 3, 7, 14 jours) par un **algorithme adaptatif moderne** (de type FSRS, celui d'Anki). Il estime pour chaque question la **probabilité que tu t'en souviennes aujourd'hui** et la reprogramme juste avant qu'elle ne tombe sous ta **rétention cible** (90 % par défaut, réglable).
- Les intervalles **s'allongent sans limite** pour ce qui est bien ancré (des semaines, puis des mois). C'est ce qui donne la rétention à long terme.
- **Seul le premier essai compte** pour la planification : réussir après 3 tentatives dans la même série n'est pas une maîtrise.
- **Mode examen proche** : à l'approche d'une évaluation, les questions de son contenu sont resserrées pour arriver à l'examen avec une rétention maximale ce jour-là.

### 7.3 Confiance et métacognition

Après chaque réponse (en un clic, désactivable) : **Sûr / Hésitant / Deviné**.

| Résultat | Interprétation | Effet |
|---|---|---|
| Bonne + Sûr | Acquis | Intervalle normal |
| Bonne + Hésitant | Fragile | Intervalle raccourci |
| Bonne + Deviné | Pas acquis | Traitée presque comme un échec |
| Mauvaise + Sûr | **Fausse croyance** (le plus dangereux) | Priorité maximale, explication approfondie, signalée au tableau de bord |
| Mauvaise + Hésitant ou Deviné | Lacune connue | Échec normal |

### 7.4 Niveaux de maîtrise affichés

Pour chaque question, puis agrégés par concept, chapitre et cours :

**Nouvelle → En apprentissage → Fragile → Maîtrisée → Ancrée** (souvenir prévu à plus d'un mois)

En plus, une **« sangsue »** est une question ratée 5 fois ou plus au total. Elle est signalée, et l'outil propose de la reformuler, de la scinder, d'ajouter un moyen mnémotechnique ou de demander à Claude une autre explication.

---

## 8. Réponses à développement corrigées

**Objectif** : t'entraîner aux questions longues (philo, français, histoire, gestion) avec une correction utile, pas seulement une note.

**Chaque question à développement contient**
- l'énoncé, et éventuellement une longueur visée et un temps limite ;
- une **réponse modèle** tirée du cours ;
- une **grille de correction** : des critères pondérés (ex. « définit le relativisme (2 pts) », « cite Protagoras (1 pt) », « présente l'objection de Platon (3 pts) », « structure et clarté (2 pts) »).

**Déroulement**
1. Tu rédiges, avec un chronomètre optionnel pour les conditions d'examen.
2. L'IA corrige **critère par critère** : points obtenus, ce qui est présent, ce qui manque, les erreurs factuelles, et en option la qualité de la langue (utile en français).
3. Tu vois ta **note**, une **rétroaction concrète** (« il te manque l'exemple; ta définition confond X et Y ») et la **réponse modèle** à côté de la tienne.
4. Tu peux **contester** (« mon 2ᵉ paragraphe couvre ce critère ») et obtenir une réévaluation.
5. La note alimente la répétition espacée : à 80 % ou plus, c'est réussi ; sinon la question revient plus tôt.
6. **Repli sans IA** : tu t'auto-évalues avec la grille, critère par critère.

**Garde-fous** : l'IA corrige à partir de la grille et du contenu du cours, pas de ses connaissances générales, et elle explique chaque point retiré.

---

## 9. Ajouter du contenu : du PowerPoint au quiz en quelques minutes

### 9.1 Génération à partir d'un document (V2)
1. Tu déposes un **PowerPoint ou un PDF** (plus tard : photos de notes manuscrites) dans un chapitre.
2. L'outil extrait le texte diapo par diapo et le garde consultable.
3. Claude génère des questions **de formats variés**, regroupées par **concept**, chacune rattachée à sa **diapo source**, avec explication.
4. Tu passes par une **file de validation** : tu acceptes, modifies ou rejettes chaque question (ou tu acceptes tout en un clic).
5. Une **carte de couverture** montre les diapos qui n'ont encore aucune question, et tu peux en demander davantage sur une diapo ou un concept précis.
6. Un **détecteur de doublons** empêche qu'une même question soit importée deux fois.

### 9.2 Autres façons d'ajouter du contenu
- **Import JSON** compatible avec le format actuel de l'artefact (`c`, `q`, `o`, `a`, `e`), étendu aux nouveaux types de questions. Ça te permet de continuer à faire générer des questions dans Claude.ai et de les coller dans l'outil.
- **Création et édition manuelles** de n'importe quelle question.
- **(V4) Connexion directe avec Claude** : Claude (Desktop, Code, puis claude.ai une fois l'outil hébergé) peut lire et écrire dans ton outil d'étude. Tu lui donnes ton PowerPoint dans la conversation et il **ajoute lui-même** les questions dans le bon chapitre, ou il **lit tes stats** pour te coacher.

### 9.3 Modifier une question sans casser l'historique
Corriger une coquille garde la progression. Changer le fond de la question (la bonne réponse change) la remet à zéro, et l'outil te demande lequel des deux cas s'applique.

---

## 10. Modes d'étude

| Mode | Pour quoi | Comportement |
|---|---|---|
| **Révision du jour** (mode par défaut) | Entretenir tout ce que tu as appris | Questions dues toutes matières confondues, plus un quota de nouvelles questions ; durée estimée affichée |
| **Quiz ciblé** | Travailler une matière, un chapitre, un concept ou une étiquette | Tu choisis le périmètre et le nombre de questions ; boucle de maîtrise active |
| **Apprentissage d'un chapitre neuf** | Découvrir un nouveau PowerPoint | Questions introduites par petits paquets, du plus simple au plus complexe |
| **Mes erreurs** | Régler ce qui accroche | Questions ratées récemment, fausses croyances et sangsues |
| **Examen blanc** | Se mettre en conditions réelles | Contenu d'une évaluation, chronométré, **aucune rétroaction avant la fin**, note sur 100, corrigé détaillé |
| **Sprint pré-examen** | Les 2 ou 3 derniers jours | Priorise le contenu de l'examen selon la probabilité d'oubli et le poids des chapitres |
| **Flashcards rapides** | 5 minutes dans l'autobus | Recto / verso, auto-évaluation, gros boutons, idéal sur téléphone |
| **Développement** | Pratiquer les questions longues | Une ou plusieurs questions à développement, corrigées par l'IA |

**Confort d'utilisation** : raccourcis clavier (1 à 4 pour répondre, Entrée pour continuer), mode sombre, lisible sur téléphone, accessible.

---

## 11. Score, suivi et coaching

### 11.1 Scores
- **Par série** : % de réussite **au premier essai** (le vrai indicateur), nombre de questions réglées, renforcements déclenchés, temps passé.
- **Par concept, chapitre et cours** : % de maîtrise (selon les niveaux de la section 7.4) et rétention estimée aujourd'hui.
- **Indice de préparation à un examen** : la probabilité moyenne que tu réussisses les questions de son contenu le jour J, pondérée par chapitre. Il est affiché sous forme de **note prédite** (ex. « Philo intra, 24 oct. : note prédite ≈ 84 % »).
- **Développement** : moyenne des notes et critères le plus souvent manqués.

### 11.2 Tableau de bord
- **Aujourd'hui** : ce qu'il y a à faire, la durée estimée et la série de jours.
- **Calendrier des évaluations** avec compte à rebours et indice de préparation.
- **Carte de chaleur** de tes jours d'étude (comme GitHub).
- **Courbes** : maîtrise dans le temps par cours, et rétention réelle comparée à la cible.
- **Alertes** : « Le chapitre 2 de Gestion s'efface (rétention estimée 68 %) », « 3 fausses croyances en Stats ».
- **Points faibles** : concepts les plus fragiles, sangsues, critères de développement manqués.

### 11.3 Planification
- Tu entres tes **dates d'évaluation** et leur contenu.
- L'outil calcule un **plan quotidien** : combien de nouvelles questions introduire chaque jour par cours pour avoir tout vu **au moins quelques jours avant l'examen**, sans dépasser ton **temps quotidien cible**.
- Il **lisse la charge** : il prévient si un jour risque d'être trop chargé et propose d'avancer du travail.

### 11.4 Le suivi avec moi (Claude)
- **Bilan hebdomadaire** automatique : progrès, temps, matières en retard, prévisions d'examen, et 3 recommandations concrètes pour la semaine.
- **Export « pour Claude »** en un clic : un résumé texte de tes stats à me coller dans une conversation pour qu'on fasse le point ensemble. Plus tard, avec la connexion directe (9.2), je pourrai le lire moi-même.
- **Journal d'examen** : après un vrai examen, tu entres ta note réelle. Ça calibre les prédictions et montre ce qui a fonctionné.
- **« Explique-moi autrement »** : sur n'importe quelle question, Claude réexplique la notion avec une analogie ou un exemple, à partir de la diapo source.

### 11.5 Motivation (sans gadget inutile) ❓
Série de jours, objectifs quotidiens, jalons (« 100 concepts ancrés »). Tout est désactivable, et rien ne récompense la quantité au détriment de la qualité.

---

## 12. Exigences de durabilité (« futureproof »)

| Exigence | Pourquoi |
|---|---|
| **Vraie base de données** (Postgres) avec un **historique complet de chaque tentative** | Toutes les stats et prédictions futures se calculent à partir de l'historique, et on ne peut pas reconstituer ce qu'on n'a pas gardé |
| **Sauvegarde automatique** quotidienne et **export complet** (JSON / CSV) | Zéro perte, et tu restes propriétaire de tes données |
| **Formats ouverts** d'import et d'export | Pas de dépendance à l'outil |
| **Prêt pour l'hébergement** : comptes et connexion, mais aussi un mode local sans mot de passe | Local aujourd'hui, en ligne demain sans réécrire l'outil |
| **Utilisable sur téléphone** (application web installable), hors ligne plus tard | Étudier n'importe où |
| **IA optionnelle et remplaçable** | L'outil reste pleinement utilisable sans IA, avec auto-évaluation et import manuel |
| **Multi-sessions et multi-années** | Cégep aujourd'hui, université demain |
| **Tests automatisés** sur la logique de maîtrise et de planification | Ces règles doivent rester fiables quand on ajoute des fonctions |

---

## 13. Feuille de route

Chaque phase est utilisable seule. On ne passe à la suivante que lorsque la précédente sert réellement à étudier.

### Phase 0 : Fondations et migration
- Lancement en local en une commande.
- Import des **610 questions et 20 cours** de l'artefact, et de ta progression (code `QC1:`).
- **Critère de réussite** : tu peux faire exactement ce que l'artefact faisait, sans perte.

### Phase 1 : MVP d'étude
- Sessions, cours, chapitres, concepts et étiquettes, avec création et édition.
- Types de questions V1 : QCM simple et multiple, vrai/faux, réponse courte, texte à trous, flashcard, numérique.
- **Boucle de maîtrise complète** (7.1), **répétition espacée adaptative** (7.2), **confiance** (7.3).
- Modes : révision du jour, quiz ciblé, mes erreurs, flashcards.
- Import JSON étendu, bouton « Signaler », tableau de bord de base (maîtrise par cours et chapitre, série de jours).
- **Critère de réussite** : tu étudies tous les jours avec l'outil et tu n'ouvres plus l'artefact.

### Phase 2 : IA
- Génération depuis PowerPoint et PDF, avec file de validation et carte de couverture.
- Réponses à développement et « explique dans tes mots » corrigées avec grille.
- « Explique-moi autrement », reformulation des sangsues, génération de variantes.
- Types association et mise en ordre.
- **Critère de réussite** : un nouveau PowerPoint devient un quiz validé en moins de 5 minutes.

### Phase 3 : Examens et suivi
- Évaluations datées, examen blanc, sprint pré-examen.
- Indice de préparation et note prédite, journal d'examen.
- Plan quotidien et lissage de la charge.
- Graphiques, alertes, bilan hebdomadaire, export « pour Claude ».
- **Critère de réussite** : la note prédite est à moins de 10 points de ta note réelle.

### Phase 4 : Mobilité et hébergement
- Application web installable sur téléphone, comptes, hébergement externe, sauvegardes distantes.
- **Connexion directe avec Claude** : il ajoute des questions et lit tes stats.

### Phase 5 : Bonus (selon tes envies)
- Moyens mnémotechniques générés, cartes conceptuelles par chapitre, questions sur image.
- Lecture audio des questions, mode hors ligne complet, partage d'un cours avec des amis ❓.

### Hors de portée (pour l'instant)
- Réseau social, classement public, application native iOS ou Android.
- Correction de devoirs remis au prof : l'outil sert à apprendre, pas à produire tes travaux.

---

## 14. Questions ouvertes pour toi ❓

1. **IA intégrée et coût** : es-tu d'accord pour utiliser une **clé API Claude** (paiement à l'usage, généralement quelques sous par PowerPoint ou par correction) ? Sinon, la génération passe par Claude.ai avec copier-coller, et le développement se fait en auto-évaluation.
2. **Téléphone** : veux-tu étudier sur ton téléphone dès le début ? Si oui, l'accès en réseau local, puis l'hébergement, remontent dans les priorités.
3. **Utilisateurs** : l'outil sert-il seulement à toi, ou aussi à des amis plus tard ?
4. **Session actuelle** : quels sont tes cours de cette session et tes **prochaines dates d'examen** ? Les 20 cours de l'artefact sont-ils tous de cette session ?
5. **Progression existante** : veux-tu la récupérer ? Il faudra ton code `QC1:` (bouton « Créer mon code » dans l'artefact).
6. **Temps d'étude** : combien de minutes par jour, en semaine normale et en période d'examens ?
7. **Documents** : surtout des PowerPoint ? Aussi des PDF, des Word, des notes manuscrites, des manuels ?
8. **Sévérité de la boucle de maîtrise** : les seuils proposés (revient après 3 à 5 questions, renforcement à partir de 40 % d'échec, plafond à 2 fois la taille de la série) te conviennent-ils, ou tu veux plus ou moins strict ?
9. **Motivation** : série de jours et jalons, ou interface sobre sans gamification ?
10. **Types d'examens** à tes cours : surtout du choix multiple, des questions courtes, du développement, des dissertations ? Ça oriente les types de questions à prioriser.

---

## Annexe : choix techniques (résumé)

- **Interface et serveur** : SvelteKit (Svelte 5, TypeScript).
- **Données** : PostgreSQL dans Docker, schéma versionné par migrations.
- **Lancement** : `docker compose up`, ce qui démarre la base de données et l'application.
- **IA** : API Claude pour la génération et la correction, isolée derrière une couche remplaçable et désactivable.
- **Répétition espacée** : implémentation FSRS (bibliothèque open source), paramètres ajustables.
- **Tests** : tests unitaires sur la boucle de maîtrise, la planification et la correction automatique.
