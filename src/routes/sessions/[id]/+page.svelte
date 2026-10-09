<script lang="ts">
	import { enhance } from '$app/forms';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import MasteryBar from '$lib/components/MasteryBar.svelte';
	import MasteryLegend from '$lib/components/MasteryLegend.svelte';
	import WeekSchedule from '$lib/components/WeekSchedule.svelte';

	let { data, form } = $props();
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });

	function nextExam(courseId: number) {
		return data.evaluations.find((e) => e.courseId === courseId);
	}
</script>

<svelte:head><title>{data.session.name} · Étude</title></svelte:head>

<Breadcrumb items={[{ label: 'Sessions', href: '/sessions' }, { label: data.session.name }]} />
<h1>{data.session.name}</h1>
<p class="sub">
	{data.courses.length} cours · {data.courses.reduce((s, c) => s + c.total, 0)} questions
	{#if data.session.active}· <span class="pill">Session en cours</span>{/if}
</p>

{#if form?.ok}<p class="msg ok" role="status">{form.ok}</p>{/if}
{#if form?.error}<p class="msg ko" role="alert">{form.error}</p>{/if}

<div class="grid">
	{#each data.courses as c}
		{@const ex = nextExam(c.id)}
		<a class="panel card" href="/cours/{c.id}">
			<h2>{c.name}</h2>
			<p class="note meta">{[c.number, c.teacher].filter(Boolean).join(' · ') || ' '}</p>
			<MasteryBar counts={c.counts} total={c.total} />
			<p class="note">
				{c.chapters.length} chapitre{c.chapters.length > 1 ? 's' : ''} · {c.total} questions
				{#if c.due}· <strong>{c.due} à réviser</strong>{/if}
			</p>
			<ul class="chaps">
				{#each c.chapters.slice(0, 5) as ch}<li>{ch.name}</li>{/each}
				{#if c.chapters.length > 5}<li class="note">… et {c.chapters.length - 5} autres</li>{/if}
			</ul>
			{#if ex}<p class="exam">📅 {ex.name} {ex.daysLeft === 0 ? 'aujourd’hui' : `dans ${ex.daysLeft} j`}</p>{/if}
		</a>
	{:else}
		<p class="panel note">Aucun cours dans cette session.</p>
	{/each}
</div>
<MasteryLegend />

{#if data.slots.length}
	<section class="panel" style="margin-top:16px">
		<h2>Horaire de la semaine</h2>
		<WeekSchedule slots={data.slots} />
	</section>
{/if}

<section class="panel" style="margin-top:16px">
	<h2>Ajouter un cours</h2>
	<form method="POST" action="?/ajouterCours" use:enhance>
		<div class="fields">
			<label class="field"><span>Nom</span><input type="text" name="name" placeholder="Psychologie" required /></label>
			<label class="field"><span>Numéro (optionnel)</span><input type="text" name="number" placeholder="350-102-RE" /></label>
			<label class="field"><span>Code court (optionnel)</span><input type="text" name="code" placeholder="psycho" /></label>
		</div>
		<button class="btn primary">Créer le cours</button>
	</form>
	<p class="note">Le code court sert à dire à Claude dans quel cours ranger les questions (ex. « code psycho »).</p>
</section>

{#if data.session.id}
	<section class="panel">
		<h2>Renommer la session</h2>
		<form method="POST" action="?/renommer" use:enhance={keep} class="row">
			<input type="text" name="name" value={data.session.name} aria-label="Nom de la session" style="flex:1" />
			<button class="btn">Renommer</button>
		</form>
	</section>
{/if}

{#if data.archived.length}
	<section class="panel">
		<h2>Cours archivés</h2>
		{#each data.archived as a}<p><a href="/cours/{a.id}">{a.name}</a></p>{/each}
	</section>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 12px;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		color: var(--ink);
		text-decoration: none;
	}
	.card:hover {
		border-color: var(--accent);
	}
	.card h2 {
		margin: 0;
	}
	.card p {
		margin: 0;
	}
	.meta {
		min-height: 1.4em;
	}
	.chaps {
		margin: 0;
		padding-left: 18px;
		font-size: 0.9rem;
	}
	.exam {
		font-size: 0.9rem;
		color: var(--warn);
		font-weight: 700;
	}
	.fields {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 0 12px;
	}
	@media (max-width: 600px) {
		.fields {
			grid-template-columns: 1fr;
		}
	}
</style>
