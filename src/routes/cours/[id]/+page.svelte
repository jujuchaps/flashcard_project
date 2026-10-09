<script lang="ts">
	import { enhance } from '$app/forms';
	import MasteryBar from '$lib/components/MasteryBar.svelte';
	import MasteryLegend from '$lib/components/MasteryLegend.svelte';
	import { MASTERY_LABELS, TYPE_LABELS } from '$lib/types';

	let { data, form } = $props();
	let filter = $state<'toutes' | 'faibles' | 'nouvelles'>('toutes');

	const flagged = $derived(data.questions.filter((q) => q.flagged));
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
		<details>
			<summary>{qs.length} question{qs.length > 1 ? 's' : ''}</summary>
			<ul class="qs">
				{#each qs as q}
					<li>
						<span class="dot {q.mastery}" title={MASTERY_LABELS[q.mastery]}></span>
						<span class="txt">
							{q.prompt}
							<span class="note">
								{TYPE_LABELS[q.type]}{q.concept ? ` · ${q.concept}` : ''}{q.slide ? ` · diapo ${q.slide}` : ''}
								{#if q.right + q.wrong}· {q.right} ✔ {q.wrong} ✘{/if}
							</span>
						</span>
					</li>
				{/each}
			</ul>
			<form method="POST" action="?/renommerChapitre" use:enhance class="row rename">
				<input type="hidden" name="chapterId" value={ch.id} />
				<input type="text" name="name" value={ch.name} aria-label="Nom du chapitre" />
				<button class="btn small">Renommer le chapitre</button>
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
	<form method="POST" action="?/renommer" use:enhance class="row">
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
