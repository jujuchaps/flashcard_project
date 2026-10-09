<script lang="ts">
	import MasteryBar from '$lib/components/MasteryBar.svelte';
	import MasteryLegend from '$lib/components/MasteryLegend.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Cours · Étude</title></svelte:head>

<h1>Cours</h1>
<p class="sub">{data.courses.length} cours · {data.courses.reduce((s, c) => s + c.total, 0)} questions</p>

{#each data.courses as c}
	<a class="panel course" href="/cours/{c.id}">
		<div class="top">
			<h2>{c.name}</h2>
			<span class="note">{c.total} questions{c.due ? ` · ${c.due} à réviser` : ''}</span>
		</div>
		<MasteryBar counts={c.counts} total={c.total} />
		{#if c.chapters.length > 1}
			<p class="note chapters">{c.chapters.map((ch) => ch.name).join(' · ')}</p>
		{/if}
	</a>
{:else}
	<p class="panel note">Aucun cours. <a href="/importer">Importe des questions</a> pour commencer.</p>
{/each}
<MasteryLegend />

<style>
	.course {
		display: block;
		color: var(--ink);
		text-decoration: none;
	}
	.course:hover {
		border-color: var(--accent);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}
	.top h2 {
		margin: 0;
	}
	.chapters {
		margin: 8px 0 0;
	}
</style>
