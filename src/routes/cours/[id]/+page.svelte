<script lang="ts">
	import { enhance } from '$app/forms';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import MasteryBar from '$lib/components/MasteryBar.svelte';
	import MasteryLegend from '$lib/components/MasteryLegend.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import { JOURS, slotText } from '$lib/schedule';

	let { data, form } = $props();
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });

	const sessionHref = $derived(data.course.sessionId ? `/sessions/${data.course.sessionId}` : '/sessions/hors');
	const chapters = $derived(data.stats?.chapters ?? []);
</script>

<svelte:head><title>{data.course.name} · Étude</title></svelte:head>

<Breadcrumb
	items={[
		{ label: 'Sessions', href: '/sessions' },
		{ label: data.course.sessionName ?? 'Hors session', href: sessionHref },
		{ label: data.course.name }
	]}
/>
<h1>{data.course.name}</h1>
<p class="sub">
	{[data.course.number, data.course.teacher].filter(Boolean).join(' · ')}
	{#if data.course.number || data.course.teacher}·{/if}
	code <code>{data.course.code}</code>{data.course.archived ? ' · archivé' : ''}
</p>

{#if form?.ok}<p class="msg ok" role="status">{form.ok}</p>{/if}
{#if form?.error}<p class="msg ko" role="alert">{form.error}</p>{/if}

<section class="panel">
	{#if data.stats && data.stats.total}
		<MasteryBar counts={data.stats.counts} total={data.stats.total} />
		<MasteryLegend />
		<p class="note">
			{data.stats.total} questions · {data.stats.counts.maitrisee + data.stats.counts.ancree} maîtrisées ou ancrées
			{#if data.stats.due}· {data.stats.due} à réviser{/if}
			{#if data.stats.firstTryRate !== null}· {Math.round(data.stats.firstTryRate * 100)} % du premier coup{/if}
		</p>
		<form method="POST" action="/?/start" class="row">
			<input type="hidden" name="mode" value="cible" />
			<input type="hidden" name="course" value={data.course.id} />
			<input type="hidden" name="count" value="15" />
			<button class="btn primary">Quiz de 15 questions sur tout le cours</button>
		</form>
	{:else}
		<p class="note">Aucune question pour l’instant. <a href="/importer">Importe des questions</a> en choisissant ce cours.</p>
	{/if}
	{#if data.slots.length}
		<p class="slots">🕒 {data.slots.map(slotText).join(' — ')}</p>
	{/if}
</section>

{#if data.evaluations.length}
	<section class="panel">
		<h2>Examens à venir</h2>
		{#each data.evaluations as ev}
			<div class="ev">
				<p>
					<strong>{ev.name}</strong>
					<span class="note">· {ev.daysLeft === 0 ? 'aujourd’hui' : `dans ${ev.daysLeft} jours`} · {ev.chapterNames.length ? ev.chapterNames.join(', ') : 'tout le cours'}</span>
				</p>
				<Meter value={ev.readiness.index} label="Préparation pour {ev.name}" />
				<p class="note">Préparation {Math.round(ev.readiness.index * 100)} %</p>
			</div>
		{/each}
		<a class="note" href="/examens">Gérer les examens</a>
	</section>
{/if}

<h2 class="section">Chapitres et sujets</h2>
<div class="chapters">
	{#each chapters as ch, i}
		<div class="panel chapter">
			<a class="ch-link" href="/cours/{data.course.id}/chapitres/{ch.id}">
				<h3>{ch.name}</h3>
				<p class="note">
					{ch.total} question{ch.total > 1 ? 's' : ''}{ch.due ? ` · ${ch.due} à réviser` : ''}{ch.source && ch.source !== 'artefact quiz-cégep' ? ` · ${ch.source}` : ''}
				</p>
				{#if ch.total}<MasteryBar counts={ch.counts} total={ch.total} />{/if}
			</a>
			<div class="row ch-actions">
				{#if ch.total}
					<form method="POST" action="/?/start">
						<input type="hidden" name="mode" value="cible" />
						<input type="hidden" name="chapter" value={ch.id} />
						<input type="hidden" name="count" value="10" />
						<button class="btn small">Quiz</button>
					</form>
				{/if}
				<form method="POST" action="?/ordreChapitre" use:enhance class="order">
					<input type="hidden" name="chapterId" value={ch.id} />
					<button class="btn small" name="dir" value="up" disabled={i === 0} aria-label="Monter « {ch.name} »">↑</button>
					<button class="btn small" name="dir" value="down" disabled={i === chapters.length - 1} aria-label="Descendre « {ch.name} »">↓</button>
				</form>
			</div>
		</div>
	{:else}
		<p class="panel note">Aucun chapitre. Ajoute-en un ci-dessous ou importe des questions dans ce cours.</p>
	{/each}
</div>
{#if data.flagged}
	<p class="note">{data.flagged} question{data.flagged > 1 ? 's' : ''} signalée{data.flagged > 1 ? 's' : ''} : ouvre le chapitre concerné pour la corriger.</p>
{/if}

<section class="panel">
	<h2>Ajouter un chapitre ou un sujet</h2>
	<form method="POST" action="?/ajouterChapitre" use:enhance class="row">
		<input type="text" name="name" placeholder="Chapitre 3 : Les sophistes" aria-label="Nom du chapitre" style="flex:1;min-width:200px" />
		<button class="btn primary">Ajouter</button>
	</form>
</section>

<section class="panel">
	<h2>Horaire</h2>
	{#each data.slots as s}
		<form method="POST" action="?/supprimerCreneau" use:enhance class="row slot-row">
			<input type="hidden" name="slotId" value={s.id} />
			<span>{slotText(s)}</span>
			<button class="btn small danger">Retirer</button>
		</form>
	{:else}
		<p class="note">Aucune plage horaire.</p>
	{/each}
	<form method="POST" action="?/ajouterCreneau" use:enhance class="slot-form">
		<select name="weekday" aria-label="Jour">
			{#each [1, 2, 3, 4, 5, 6, 7] as d}<option value={d}>{JOURS[d]}</option>{/each}
		</select>
		<input type="time" name="starts" aria-label="Début" required />
		<input type="time" name="ends" aria-label="Fin" required />
		<input type="text" name="room" placeholder="Local" aria-label="Local" />
		<select name="kind" aria-label="Type">
			<option value="">Type</option>
			<option value="T">Théorie</option>
			<option value="L">Labo</option>
		</select>
		<button class="btn">Ajouter</button>
	</form>
</section>

<section class="panel">
	<h2>Gérer le cours</h2>
	<form method="POST" action="?/modifier" use:enhance={keep}>
		<div class="fields">
			<label class="field"><span>Nom</span><input type="text" name="name" value={data.course.name} /></label>
			<label class="field"><span>Code court</span><input type="text" name="code" value={data.course.code} /></label>
			<label class="field"><span>Numéro</span><input type="text" name="number" value={data.course.number ?? ''} /></label>
			<label class="field"><span>Enseignant·e</span><input type="text" name="teacher" value={data.course.teacher ?? ''} /></label>
			<label class="field">
				<span>Session</span>
				<select name="sessionId" value={data.course.sessionId ?? 'hors'}>
					{#each data.sessions as s}<option value={s.id}>{s.name}</option>{/each}
					<option value="hors">Hors session</option>
				</select>
			</label>
		</div>
		<button class="btn">Enregistrer</button>
	</form>

	<details>
		<summary>Fusionner dans un autre cours</summary>
		<p class="note">Tous les chapitres, questions et examens de « {data.course.name} » seront déplacés dans le cours choisi, puis ce cours sera supprimé. Ta progression est conservée.</p>
		<form
			method="POST"
			action="?/fusionner"
			use:enhance={({ cancel }) => {
				if (!confirm('Fusionner ce cours dans le cours choisi?')) cancel();
			}}
			class="row"
		>
			<select name="targetId" aria-label="Cours visé" style="flex:1">
				{#each data.otherCourses as c}<option value={c.id}>{c.name}{c.sessionName ? ` (${c.sessionName})` : ' (hors session)'}</option>{/each}
			</select>
			<button class="btn">Fusionner</button>
		</form>
	</details>

	<form method="POST" action="?/archiver" use:enhance style="margin-top:12px">
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
	.slots {
		margin: 12px 0 0;
		font-size: 0.92rem;
	}
	.ev p {
		margin: 4px 0;
	}
	.section {
		margin: 24px 0 12px;
	}
	.chapters {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 12px;
		margin-bottom: 16px;
	}
	.chapter {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 8px;
		margin: 0;
	}
	.ch-link {
		color: var(--ink);
		text-decoration: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.ch-link:hover h3 {
		color: var(--accent);
	}
	.ch-link h3 {
		margin: 0;
		font-size: 1.05rem;
	}
	.ch-link p {
		margin: 0;
	}
	.ch-actions {
		justify-content: space-between;
	}
	.order {
		display: flex;
		gap: 4px;
		margin-left: auto;
	}
	.slot-row {
		justify-content: space-between;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
	}
	.slot-form {
		display: grid;
		grid-template-columns: 1.3fr 1fr 1fr 1fr 1fr auto;
		gap: 8px;
		margin-top: 12px;
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 12px;
	}
	details {
		margin-top: 14px;
	}
	summary {
		cursor: pointer;
		font-weight: 700;
	}
	@media (max-width: 600px) {
		.fields,
		.slot-form {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
