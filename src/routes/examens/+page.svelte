<script lang="ts">
	import { enhance } from '$app/forms';
	import Meter from '$lib/components/Meter.svelte';

	let { data, form } = $props();

	let courseId = $state<number | null>(null);
	const chapters = $derived(data.chapters.filter((c) => c.course_id === courseId));
	const upcoming = $derived(data.evaluations.filter((e) => e.daysLeft >= 0));
	const past = $derived(data.evaluations.filter((e) => e.daysLeft < 0).reverse());

	function when(days: number) {
		if (days === 0) return 'aujourd’hui';
		if (days === 1) return 'demain';
		return `dans ${days} jours`;
	}

	function fmt(day: string) {
		const [y, m, d] = day.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
	}
</script>

<svelte:head><title>Examens · Étude</title></svelte:head>

<h1>Examens</h1>
<p class="sub">Entre tes dates d’évaluation : l’app répartit les nouvelles questions jusqu’au jour J et suit ta préparation.</p>

{#if form?.ok}<p class="msg ok" role="status">{form.ok}</p>{/if}
{#if form?.error}<p class="msg ko" role="alert">{form.error}</p>{/if}

{#each upcoming as ev}
	<section class="panel">
		<div class="top">
			<div>
				<h2>{ev.name}</h2>
				<p class="note">
					{ev.courseName} · {fmt(ev.date)}{ev.weight !== null ? ` · ${ev.weight} %` : ''}
					<br />{ev.chapterNames.length ? ev.chapterNames.join(', ') : 'Tout le cours'}
				</p>
			</div>
			<span class="pill {ev.daysLeft <= 7 ? 'warn' : ''}">{when(ev.daysLeft)}</span>
		</div>
		<div class="ready">
			<span class="big">{Math.round(ev.readiness.index * 100)} %</span>
			<span class="note">de préparation</span>
		</div>
		<Meter value={ev.readiness.index} label="Préparation pour {ev.name}" />
		<p class="note">
			Ce que tu retiendrais le jour J si tu arrêtais d’étudier maintenant. Ça monte à mesure que tu révises.
			{ev.readiness.seen}/{ev.readiness.total} questions vues{ev.readiness.fragile ? `, ${ev.readiness.fragile} à retravailler` : ''}.
		</p>
		<div class="row">
			<form method="POST" action="/?/start">
				<input type="hidden" name="mode" value="sprint" />
				<input type="hidden" name="evaluationId" value={ev.id} />
				<input type="hidden" name="count" value="20" />
				<button class="btn primary">Sprint : 20 questions à risque</button>
			</form>
			<form method="POST" action="/?/start" class="row">
				<input type="hidden" name="mode" value="examen" />
				<input type="hidden" name="evaluationId" value={ev.id} />
				<label class="inline">Questions <input type="number" name="count" value="20" min="5" max="100" /></label>
				<label class="inline">Minutes <input type="number" name="durationMin" value="30" min="0" max="300" /></label>
				<button class="btn">Examen blanc</button>
			</form>
		</div>
		<form method="POST" action="?/supprimer" use:enhance={({ cancel }) => { if (!confirm('Supprimer cet examen?')) cancel(); }}>
			<input type="hidden" name="id" value={ev.id} />
			<button class="btn small danger del">Supprimer</button>
		</form>
	</section>
{:else}
	<p class="panel note">Aucun examen à venir. Ajoute le prochain ci-dessous.</p>
{/each}

<section class="panel">
	<h2>Ajouter un examen</h2>
	<form method="POST" action="?/ajouter" use:enhance>
		<div class="grid">
			<label class="field">
				<span>Cours</span>
				<select name="courseId" bind:value={courseId} required>
					<option value={null} disabled>Choisir…</option>
					{#each data.courses as c}<option value={c.id}>{c.name}</option>{/each}
				</select>
			</label>
			<label class="field">
				<span>Nom</span>
				<input type="text" name="name" placeholder="Examen intra" required />
			</label>
			<label class="field">
				<span>Date</span>
				<input type="date" name="date" required />
			</label>
			<label class="field">
				<span>Pondération (%)</span>
				<input type="text" name="weight" inputmode="decimal" placeholder="30" />
			</label>
		</div>
		{#if chapters.length > 1}
			<p class="label">Chapitres couverts <span class="note">(aucun = tout le cours)</span></p>
			<div class="chips">
				{#each chapters as ch}
					<label class="chip"><input type="checkbox" name="chapter" value={ch.id} /> {ch.name}</label>
				{/each}
			</div>
		{/if}
		<button class="go" style="margin-top:14px">Ajouter</button>
	</form>
</section>

{#if past.length}
	<section class="panel">
		<h2>Journal des examens</h2>
		<p class="note">Entre ta vraie note : elle se compare à la prédiction de l’app et permet de la calibrer.</p>
		{#each past as ev}
			<div class="past">
				<p><strong>{ev.name}</strong> <span class="note">· {ev.courseName} · {fmt(ev.date)}</span></p>
				<p class="note">
					Préparation prédite : {ev.predictedGrade !== null ? `${Math.round(ev.predictedGrade)} %` : '—'}
					{#if ev.actualGrade !== null && ev.predictedGrade !== null}
						· note réelle {ev.actualGrade} % · écart {ev.actualGrade - Math.round(ev.predictedGrade) > 0 ? '+' : ''}{Math.round(ev.actualGrade - ev.predictedGrade)} points
					{/if}
				</p>
				<form method="POST" action="?/note" use:enhance class="row">
					<input type="hidden" name="id" value={ev.id} />
					<input type="text" name="grade" inputmode="decimal" value={ev.actualGrade ?? ''} placeholder="Note sur 100" aria-label="Note réelle" style="max-width:160px" />
					<button class="btn small">Enregistrer</button>
				</form>
			</div>
		{/each}
	</section>
{/if}

<style>
	.top {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		align-items: flex-start;
	}
	.top h2 {
		margin: 0 0 2px;
	}
	.top p {
		margin: 0;
	}
	.ready {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 12px 0 6px;
	}
	.big {
		font-family: 'Bricolage Grotesque', system-ui, sans-serif;
		font-weight: 800;
		font-size: 2.2rem;
		line-height: 1;
	}
	.inline {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.92rem;
	}
	.inline input {
		width: 76px;
	}
	.del {
		margin-top: 10px;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 12px;
	}
	.label {
		font-weight: 700;
		margin: 6px 0 8px;
	}
	.chip input {
		margin: 0;
	}
	.past {
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}
	.past:first-of-type {
		border-top: 0;
	}
	.past p {
		margin: 2px 0 6px;
	}
	@media (max-width: 520px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
