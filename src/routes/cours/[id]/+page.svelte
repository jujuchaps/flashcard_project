<script lang="ts">
	import { enhance } from '$app/forms';
	import MasteryBar from '$lib/components/MasteryBar.svelte';
	import MasteryLegend from '$lib/components/MasteryLegend.svelte';
	import { MASTERY_LABELS, TYPE_LABELS } from '$lib/types';

	let { data, form } = $props();
	let filter = $state<'toutes' | 'faibles' | 'nouvelles'>('toutes');
	/** Garde les valeurs saisies après l'enregistrement. */
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });

	const flagged = $derived(data.questions.filter((q) => q.flagged));
	let copiedChapter = $state<number | null>(null);

	/** Couverture : nombre de questions par diapo (1 à N). */
	function coverage(ch: { id: number; slide_count: number | null }) {
		const qs = data.questions.filter((q) => q.chapterId === ch.id && !q.flagged && q.slide);
		const max = Math.max(ch.slide_count ?? 0, ...qs.map((q) => q.slide ?? 0));
		if (!max) return null;
		const counts = Array.from({ length: max }, (_, i) => qs.filter((q) => q.slide === i + 1).length);
		return { counts, missing: counts.map((n, i) => (n ? 0 : i + 1)).filter(Boolean) };
	}

	async function copyMissing(ch: { id: number; name: string; source: string | null }, missing: number[]) {
		const text = `Suis les instructions du fichier GENERATEUR_QUESTIONS.md. Cours : ${data.course.name} (code ${data.course.code}). Chapitre : ${ch.name}. Génère des questions UNIQUEMENT pour les diapos ${missing.join(', ')}${ch.source ? ` du document ${ch.source}` : ''} (ignore les diapos sans contenu à retenir).`;
		try {
			await navigator.clipboard.writeText(text);
			copiedChapter = ch.id;
		} catch {
			prompt('Copie ce message pour Claude :', text);
		}
	}
	function visible(chapterId: number) {
		return data.questions.filter(
			(q) =>
				q.chapterId === chapterId &&
				!q.flagged &&
				(filter === 'toutes' ||
					(filter === 'faibles' && (q.mastery === 'fragile' || q.wrong >= 2)) ||
					(filter === 'nouvelles' && q.mastery === 'nouvelle'))
		);
	}
</script>

<svelte:head><title>{data.course.name} · Étude</title></svelte:head>

<p><a href="/cours">← Cours</a></p>
<h1>{data.course.name}</h1>
<p class="sub">
	Code <code>{data.course.code}</code> · {data.questions.length} questions{data.course.archived ? ' · archivé' : ''}
</p>

{#if form?.ok}<p class="msg ok" role="status">{form.ok}</p>{/if}
{#if form?.error}<p class="msg ko" role="alert">{form.error}</p>{/if}

{#if data.stats}
	<section class="panel">
		<MasteryBar counts={data.stats.counts} total={data.stats.total} />
		<MasteryLegend />
		<form method="POST" action="/?/start" class="row" style="margin-top:14px">
			<input type="hidden" name="mode" value="cible" />
			<input type="hidden" name="course" value={data.course.id} />
			<input type="hidden" name="count" value="15" />
			<button class="btn primary">Quiz de 15 questions sur ce cours</button>
		</form>
	</section>
{/if}

{#if data.evaluations.length}
	<p class="note">Examens à venir : {data.evaluations.map((e) => `${e.name} (${e.date})`).join(', ')} · <a href="/examens">Gérer</a></p>
{/if}

<div class="chips filter" role="group" aria-label="Filtrer les questions">
	<button class="chip" aria-pressed={filter === 'toutes'} onclick={() => (filter = 'toutes')}>Toutes</button>
	<button class="chip" aria-pressed={filter === 'faibles'} onclick={() => (filter = 'faibles')}>Points faibles</button>
	<button class="chip" aria-pressed={filter === 'nouvelles'} onclick={() => (filter = 'nouvelles')}>Jamais vues</button>
</div>

{#each data.chapters as ch}
	{@const qs = visible(ch.id)}
	{@const st = data.stats?.chapters.find((c) => c.id === ch.id)}
	<section class="panel">
		<div class="chhead">
			<h2>{ch.name}</h2>
			<form method="POST" action="/?/start">
				<input type="hidden" name="mode" value="cible" />
				<input type="hidden" name="chapter" value={ch.id} />
				<input type="hidden" name="count" value="10" />
				<button class="btn small">Quiz du chapitre</button>
			</form>
		</div>
		{#if ch.source}<p class="note">Source : {ch.source}</p>{/if}
		{#if st}<MasteryBar counts={st.counts} total={st.total} />{/if}
		{#if coverage(ch)}
			{@const cov = coverage(ch)!}
			<div class="cov" role="list" aria-label="Couverture des diapos">
				{#each cov.counts as n, i}
					<span role="listitem" class="slide c{Math.min(3, n)}" title="Diapo {i + 1} : {n} question{n > 1 ? 's' : ''}">{i + 1}</span>
				{/each}
			</div>
			{#if cov.missing.length}
				<p class="note">
					{cov.missing.length} diapo{cov.missing.length > 1 ? 's' : ''} sans question{cov.missing.length <= 15 ? ` : ${cov.missing.join(', ')}` : ''}.
					<button class="btn small" onclick={() => copyMissing(ch, cov.missing)}>
						{copiedChapter === ch.id ? 'Message copié ✔' : 'Demander ces questions à Claude'}
					</button>
				</p>
			{:else}
				<p class="note">Toutes les diapos ont au moins une question ✔</p>
			{/if}
		{/if}
		<details>
			<summary>{qs.length} question{qs.length > 1 ? 's' : ''}</summary>
			<ul class="qs">
				{#each qs as q}
					<li>
						<span class="dot {q.mastery}" title={MASTERY_LABELS[q.mastery]}></span>
						<a class="txt" href="/questions/{q.id}">
							{q.prompt}
							<span class="note">
								{TYPE_LABELS[q.type]}{q.concept ? ` · ${q.concept}` : ''}{q.slide ? ` · diapo ${q.slide}` : ''}
								{#if q.right + q.wrong}· {q.right} ✔ {q.wrong} ✘{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
			<form method="POST" action="?/renommerChapitre" use:enhance={keep} class="row rename">
				<input type="hidden" name="chapterId" value={ch.id} />
				<input type="text" name="name" value={ch.name} aria-label="Nom du chapitre" />
				<input type="number" name="slideCount" value={ch.slide_count ?? ''} min="1" max="1000" placeholder="Nb de diapos" aria-label="Nombre de diapos" class="slides" />
				<button class="btn small">Enregistrer</button>
			</form>
		</details>
	</section>
{/each}

{#if flagged.length}
	<section class="panel">
		<h2>Questions signalées ({flagged.length})</h2>
		<p class="note">Retirées des quiz. Corrige-les en réimportant une version corrigée (même énoncé), puis remets-les.</p>
		{#each flagged as q}
			<div class="flag">
				<p>{q.prompt}</p>
				{#if q.flagNote}<p class="note">Note : {q.flagNote}</p>{/if}
				<div class="row">
					<a class="btn small" href="/questions/{q.id}">Modifier</a>
					<form method="POST" action="?/retablir" use:enhance>
						<input type="hidden" name="questionId" value={q.id} />
						<button class="btn small">Remettre dans les quiz</button>
					</form>
					<form method="POST" action="?/supprimer" use:enhance={({ cancel }) => { if (!confirm('Supprimer définitivement cette question et sa progression?')) cancel(); }}>
						<input type="hidden" name="questionId" value={q.id} />
						<button class="btn small danger">Supprimer</button>
					</form>
				</div>
			</div>
		{/each}
	</section>
{/if}

<section class="panel">
	<h2>Gérer le cours</h2>
	<form method="POST" action="?/renommer" use:enhance={keep} class="row">
		<input type="text" name="name" value={data.course.name} aria-label="Nom du cours" style="flex:1" />
		<button class="btn">Renommer</button>
	</form>
	<form method="POST" action="?/archiver" use:enhance style="margin-top:10px">
		<button class="btn">{data.course.archived ? 'Désarchiver' : 'Archiver (retirer des quiz, garder l’historique)'}</button>
	</form>
</section>

<style>
	code {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: 1px 6px;
	}
	.filter {
		margin-bottom: 16px;
	}
	.chhead {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 6px;
	}
	.chhead h2 {
		margin: 0;
	}
	details {
		margin-top: 10px;
	}
	summary {
		cursor: pointer;
		font-weight: 700;
		min-height: 36px;
		display: flex;
		align-items: center;
	}
	.qs {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.qs li {
		display: flex;
		gap: 10px;
		padding: 8px 0;
		border-top: 1px solid var(--line);
	}
	.txt {
		display: flex;
		flex-direction: column;
		white-space: pre-line;
		color: var(--ink);
		text-decoration: none;
	}
	.txt:hover {
		color: var(--accent);
	}
	.cov {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		margin: 10px 0 4px;
	}
	.slide {
		width: 26px;
		height: 22px;
		display: inline-grid;
		place-items: center;
		font-size: 0.7rem;
		border-radius: 5px;
		font-variant-numeric: tabular-nums;
	}
	.slide.c0 {
		border: 1px dashed var(--bad);
		color: var(--bad);
	}
	.slide.c1 {
		background: color-mix(in oklab, var(--chart) 30%, var(--surface));
	}
	.slide.c2 {
		background: color-mix(in oklab, var(--chart) 60%, var(--surface));
	}
	.slide.c3 {
		background: var(--chart);
		color: var(--accent-ink);
	}
	.slides {
		max-width: 130px;
	}
	.dot {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-top: 8px;
		background: var(--m-new);
	}
	.dot.fragile {
		background: var(--m-fragile);
	}
	.dot.apprentissage {
		background: var(--m-learning);
	}
	.dot.maitrisee {
		background: var(--m-mastered);
	}
	.dot.ancree {
		background: var(--m-anchored);
	}
	.rename {
		margin-top: 10px;
	}
	.rename input {
		flex: 1;
		min-width: 180px;
	}
	.flag {
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}
	.flag p {
		margin: 2px 0 6px;
	}
</style>
