<script lang="ts">
	import Meter from '$lib/components/Meter.svelte';
	import { longDay } from '$lib/components/charts/scale';

	let { data } = $props();
	let copied = $state(false);
	const r = $derived(data.report);

	function pct(x: number | null) {
		return x === null ? '—' : `${Math.round(x * 100)} %`;
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(data.markdown);
			copied = true;
		} catch {
			prompt('Copie ce bilan et colle-le dans Claude :', data.markdown);
		}
	}
</script>

<svelte:head><title>Bilan · Étude</title></svelte:head>

<p><a href="/progres">← Progrès</a></p>
<h1>Bilan de la semaine</h1>
<p class="sub">Du {longDay(r.from)} au {longDay(r.to)}</p>

<section class="panel">
	<h2>Recommandations</h2>
	<ol class="recs">
		{#each r.recommendations as rec}<li>{rec}</li>{/each}
	</ol>
</section>

<section class="panel">
	<h2>En chiffres</h2>
	<table class="nums">
		<thead><tr><th></th><th>Cette semaine</th><th>Semaine passée</th></tr></thead>
		<tbody>
			<tr><td>Jours d’étude</td><td>{r.daysStudied}/7</td><td>{r.previous.daysStudied}/7</td></tr>
			<tr><td>Questions répondues</td><td>{r.answers}</td><td>{r.previous.answers}</td></tr>
			<tr><td>Temps (environ)</td><td>{r.minutes} min</td><td>{r.previous.minutes} min</td></tr>
			<tr><td>Réussite du premier coup</td><td>{pct(r.firstTryRate)}</td><td>{pct(r.previous.firstTryRate)}</td></tr>
		</tbody>
	</table>
	<p class="note">
		{r.mastered} questions maîtrisées ou ancrées sur {r.total}{r.masteredGain !== null ? ` (${r.masteredGain >= 0 ? '+' : ''}${r.masteredGain} cette semaine)` : ''}.
		{#if r.misconceptions}{r.misconceptions} fausse{r.misconceptions > 1 ? 's' : ''} croyance{r.misconceptions > 1 ? 's' : ''} à corriger.{/if}
	</p>
</section>

{#if r.courses.length}
	<section class="panel">
		<h2>Par cours</h2>
		<table class="nums">
			<thead><tr><th>Cours</th><th>Réponses</th><th>1er coup</th></tr></thead>
			<tbody>
				{#each r.courses as c}<tr><td>{c.course}</td><td>{c.answers}</td><td>{pct(c.rate)}</td></tr>{/each}
			</tbody>
		</table>
	</section>
{/if}

{#if r.evaluations.length}
	<section class="panel">
		<h2>Examens à venir</h2>
		{#each r.evaluations as e}
			<div class="ev">
				<p><strong>{e.name}</strong> <span class="note">· {e.courseName} · dans {e.daysLeft} j</span></p>
				<Meter value={e.index} label="Préparation pour {e.name}" />
				<p class="note">Préparation {pct(e.index)} · {e.seen}/{e.total} questions vues</p>
			</div>
		{/each}
	</section>
{/if}

{#if r.weakConcepts.length}
	<section class="panel">
		<h2>Concepts fragiles (14 jours)</h2>
		<ul>
			{#each r.weakConcepts as w}<li>{w.concept} <span class="note">· {w.course} · raté {w.wrong} fois sur {w.wrong + w.right}</span></li>{/each}
		</ul>
	</section>
{/if}

<section class="panel">
	<h2>Faire le point avec Claude</h2>
	<p class="note">Copie ce bilan et colle-le dans une conversation avec Claude pour organiser ta semaine.</p>
	<button class="go" onclick={copy}>{copied ? 'Bilan copié ✔' : 'Copier le bilan pour Claude'}</button>
	<details>
		<summary>Aperçu du texte</summary>
		<pre>{data.markdown}</pre>
	</details>
</section>

<style>
	.recs {
		margin: 0;
		padding-left: 20px;
	}
	.recs li {
		margin-bottom: 8px;
	}
	.nums {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.nums th,
	.nums td {
		text-align: right;
		padding: 6px 4px;
		border-bottom: 1px solid var(--line);
	}
	.nums th:first-child,
	.nums td:first-child {
		text-align: left;
	}
	.nums th {
		color: var(--muted);
		font-weight: 400;
		font-size: 0.88rem;
	}
	.ev p {
		margin: 4px 0;
	}
	.ev {
		margin-bottom: 10px;
	}
	details {
		margin-top: 12px;
	}
	pre {
		white-space: pre-wrap;
		font-size: 0.82rem;
		background: var(--bg);
		padding: 10px;
		border-radius: 10px;
	}
</style>
