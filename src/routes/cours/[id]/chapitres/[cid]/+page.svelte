<script lang="ts">
	import { enhance } from '$app/forms';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import MasteryBar from '$lib/components/MasteryBar.svelte';
	import MasteryLegend from '$lib/components/MasteryLegend.svelte';
	import { MASTERY_LABELS, TYPE_LABELS } from '$lib/types';

	let { data, form } = $props();
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });

	let filter = $state<'toutes' | 'faibles' | 'nouvelles'>('toutes');
	let copied = $state(false);

	const active = $derived(data.questions.filter((q) => !q.flagged));
	const flagged = $derived(data.questions.filter((q) => q.flagged));
	const visible = $derived(
		active.filter(
			(q) =>
				filter === 'toutes' ||
				(filter === 'faibles' && (q.mastery === 'fragile' || q.wrong >= 2)) ||
				(filter === 'nouvelles' && q.mastery === 'nouvelle')
		)
	);
	const sessionHref = $derived(data.course.sessionId ? `/sessions/${data.course.sessionId}` : '/sessions/hors');

	/** Couverture : nombre de questions par diapo (1 à N). */
	const coverage = $derived.by(() => {
		const withSlide = active.filter((q) => q.slide);
		const max = Math.max(data.chapter.slide_count ?? 0, ...withSlide.map((q) => q.slide ?? 0));
		if (!max) return null;
		const counts = Array.from({ length: max }, (_, i) => withSlide.filter((q) => q.slide === i + 1).length);
		return { counts, missing: counts.map((n, i) => (n ? 0 : i + 1)).filter(Boolean) };
	});

	async function copyMissing(missing: number[]) {
		const text = `Suis les instructions du fichier GENERATEUR_QUESTIONS.md. Cours : ${data.course.name} (code ${data.course.code}). Chapitre : ${data.chapter.name}. Génère des questions UNIQUEMENT pour les diapos ${missing.join(', ')}${data.chapter.source ? ` du document ${data.chapter.source}` : ''} (ignore les diapos sans contenu à retenir).`;
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			prompt('Copie ce message pour Claude :', text);
		}
	}
</script>

<svelte:head><title>{data.chapter.name} · {data.course.name} · Étude</title></svelte:head>

<Breadcrumb
	items={[
		{ label: 'Sessions', href: '/sessions' },
		{ label: data.course.sessionName ?? 'Hors session', href: sessionHref },
		{ label: data.course.name, href: `/cours/${data.course.id}` },
		{ label: data.chapter.name }
	]}
/>
<h1>{data.chapter.name}</h1>
<p class="sub">
	{data.course.name} · {active.length} question{active.length > 1 ? 's' : ''}{data.chapter.source && data.chapter.source !== 'artefact quiz-cégep' ? ` · source : ${data.chapter.source}` : ''}
</p>

{#if form?.ok}<p class="msg ok" role="status">{form.ok}</p>{/if}
{#if form?.error}<p class="msg ko" role="alert">{form.error}</p>{/if}

<section class="panel">
	{#if data.chapterStats && data.chapterStats.total}
		<MasteryBar counts={data.chapterStats.counts} total={data.chapterStats.total} />
		<MasteryLegend />
		<div class="row" style="margin-top:12px">
			<form method="POST" action="/?/start">
				<input type="hidden" name="mode" value="cible" />
				<input type="hidden" name="chapter" value={data.chapter.id} />
				<input type="hidden" name="count" value="10" />
				<button class="btn primary">Quiz de 10 questions</button>
			</form>
			<form method="POST" action="/?/start">
				<input type="hidden" name="mode" value="cible" />
				<input type="hidden" name="chapter" value={data.chapter.id} />
				<input type="hidden" name="count" value={active.length} />
				<button class="btn">Tout le chapitre ({active.length})</button>
			</form>
		</div>
	{:else}
		<p class="note">Aucune question. Importe-en en choisissant le cours « {data.course.name} » et le chapitre « {data.chapter.name} ».</p>
	{/if}

	{#if coverage}
		<p class="label">Couverture des diapos</p>
		<div class="cov" role="list" aria-label="Couverture des diapos">
			{#each coverage.counts as n, i}
				<span role="listitem" class="slide c{Math.min(3, n)}" title="Diapo {i + 1} : {n} question{n > 1 ? 's' : ''}">{i + 1}</span>
			{/each}
		</div>
		{#if coverage.missing.length}
			<p class="note">
				{coverage.missing.length} diapo{coverage.missing.length > 1 ? 's' : ''} sans question{coverage.missing.length <= 15 ? ` : ${coverage.missing.join(', ')}` : ''}.
				<button class="btn small" onclick={() => copyMissing(coverage.missing)}>{copied ? 'Message copié ✔' : 'Demander ces questions à Claude'}</button>
			</p>
		{:else}
			<p class="note">Toutes les diapos ont au moins une question ✔</p>
		{/if}
	{/if}
</section>

<div class="chips filter" role="group" aria-label="Filtrer les questions">
	<button class="chip" aria-pressed={filter === 'toutes'} onclick={() => (filter = 'toutes')}>Toutes ({active.length})</button>
	<button class="chip" aria-pressed={filter === 'faibles'} onclick={() => (filter = 'faibles')}>Points faibles</button>
	<button class="chip" aria-pressed={filter === 'nouvelles'} onclick={() => (filter = 'nouvelles')}>Jamais vues</button>
</div>

<section class="panel">
	<ul class="qs">
		{#each visible as q}
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
		{:else}
			<li class="note">Aucune question dans ce filtre.</li>
		{/each}
	</ul>
</section>

{#if flagged.length}
	<section class="panel">
		<h2>Questions signalées ({flagged.length})</h2>
		<p class="note">Retirées des quiz. Corrige-les avec « Modifier », puis remets-les.</p>
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
					<form
						method="POST"
						action="?/supprimer"
						use:enhance={({ cancel }) => {
							if (!confirm('Supprimer définitivement cette question et sa progression?')) cancel();
						}}
					>
						<input type="hidden" name="questionId" value={q.id} />
						<button class="btn small danger">Supprimer</button>
					</form>
				</div>
			</div>
		{/each}
	</section>
{/if}

<section class="panel">
	<h2>Gérer le chapitre</h2>
	<form method="POST" action="?/modifier" use:enhance={keep} class="row">
		<input type="text" name="name" value={data.chapter.name} aria-label="Nom du chapitre" style="flex:1;min-width:180px" />
		<input type="number" name="slideCount" value={data.chapter.slide_count ?? ''} min="1" max="1000" placeholder="Nb de diapos" aria-label="Nombre de diapos" class="slides" />
		<button class="btn">Enregistrer</button>
	</form>
	<p class="label">Déplacer vers un autre cours</p>
	<form method="POST" action="?/deplacer" use:enhance class="row">
		<select name="targetId" aria-label="Cours visé" style="flex:1">
			{#each data.otherCourses as c}<option value={c.id}>{c.name}{c.sessionName ? ` (${c.sessionName})` : ' (hors session)'}</option>{/each}
		</select>
		<button class="btn">Déplacer</button>
	</form>
	<form
		method="POST"
		action="?/supprimerChapitre"
		use:enhance={({ cancel }) => {
			if (!confirm(`Supprimer ce chapitre et ses ${data.questions.length} questions (avec leur progression)?`)) cancel();
		}}
		style="margin-top:14px"
	>
		<button class="btn danger">Supprimer le chapitre</button>
	</form>
</section>

<style>
	.label {
		font-weight: 700;
		margin: 16px 0 8px;
	}
	.filter {
		margin-bottom: 12px;
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
	.qs li:first-child {
		border-top: 0;
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
	.cov {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
		margin-bottom: 4px;
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
	.flag {
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}
	.flag p {
		margin: 2px 0 6px;
	}
</style>
