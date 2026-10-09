<script lang="ts">
	import { enhance } from '$app/forms';
	import MasteryBar from '$lib/components/MasteryBar.svelte';

	let { data, form } = $props();

	const groups = $derived([
		...data.sessions.map((s) => ({ ...s, href: `/sessions/${s.id}`, list: data.courses.filter((c) => c.sessionId === s.id) })),
		{
			id: 0,
			name: 'Hors session',
			active: false,
			href: '/sessions/hors',
			list: data.courses.filter((c) => c.sessionId === null),
			courses: data.courses.filter((c) => c.sessionId === null).length,
			questions: 0
		}
	]);
</script>

<svelte:head><title>Sessions · Étude</title></svelte:head>

<h1>Sessions</h1>
<p class="sub">Chaque session regroupe ses cours, et chaque cours ses chapitres ou sujets.</p>

{#if form?.ok}<p class="msg ok" role="status">{form.ok}</p>{/if}
{#if form?.error}<p class="msg ko" role="alert">{form.error}</p>{/if}

{#each groups as g}
	{#if g.id !== 0 || g.list.length}
		<section class="panel">
			<div class="top">
				<a class="title" href={g.href}><h2>{g.name}</h2></a>
				{#if g.active}<span class="pill">Session en cours</span>{/if}
				{#if g.id === 0}<span class="note">Cours qui ne dépendent d’aucune session</span>{/if}
			</div>
			{#each g.list as c}
				<a class="course" href="/cours/{c.id}">
					<span><b>{c.name}</b> <span class="note">{c.number ?? ''}</span></span>
					<span class="note">{c.chapters.length} chapitre{c.chapters.length > 1 ? 's' : ''} · {c.total} questions</span>
					<div class="span"><MasteryBar counts={c.counts} total={c.total} /></div>
				</a>
			{:else}
				<p class="note">Aucun cours pour l’instant.</p>
			{/each}
			<div class="row actions">
				<a class="btn small" href={g.href}>Ouvrir</a>
				{#if g.id && !g.active}
					<form method="POST" action="?/activer" use:enhance>
						<input type="hidden" name="id" value={g.id} />
						<button class="btn small">En faire la session en cours</button>
					</form>
				{/if}
			</div>
		</section>
	{/if}
{/each}

<section class="panel">
	<h2>Nouvelle session</h2>
	<form method="POST" action="?/creer" use:enhance class="row">
		<input type="text" name="name" placeholder="Hiver 2027" aria-label="Nom de la session" style="flex:1;min-width:180px" />
		<label class="row"><input type="checkbox" name="activate" checked /> En faire la session en cours</label>
		<button class="btn primary">Créer</button>
	</form>
	<p class="note">Tes cours actuels restent dans leur session : leurs questions continuent de revenir dans tes révisions jusqu’à ce que tu les archives.</p>
</section>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 6px;
	}
	.top h2 {
		margin: 0;
	}
	.title {
		color: var(--ink);
		text-decoration: none;
	}
	.course {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 12px;
		padding: 10px 0;
		border-top: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.course:hover b {
		color: var(--accent);
	}
	.span {
		grid-column: 1 / -1;
	}
	.actions {
		margin-top: 10px;
	}
</style>
