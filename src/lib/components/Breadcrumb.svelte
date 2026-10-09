<script lang="ts">
	let { items }: { items: { label: string; href?: string }[] } = $props();
</script>

<nav class="crumbs" aria-label="Fil d’Ariane">
	{#each items as it, i}
		{#if i}<span aria-hidden="true">›</span>{/if}
		{#if it.href}<a href={it.href}>{it.label}</a>{:else}<span aria-current="page">{it.label}</span>{/if}
	{/each}
</nav>

<style>
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		color: var(--muted);
		font-size: 0.92rem;
		margin-bottom: 10px;
	}
	.crumbs a {
		color: var(--accent);
		text-decoration: none;
	}
	.crumbs a:hover {
		text-decoration: underline;
	}
</style>
