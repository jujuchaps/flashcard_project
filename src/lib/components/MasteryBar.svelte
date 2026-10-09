<script lang="ts">
	import { MASTERY_LABELS, type Mastery } from '$lib/types';

	let { counts, total }: { counts: Record<Mastery, number>; total: number } = $props();

	const order: Mastery[] = ['ancree', 'maitrisee', 'apprentissage', 'fragile', 'nouvelle'];
	const label = $derived(
		order
			.filter((m) => counts[m])
			.map((m) => `${MASTERY_LABELS[m]} : ${counts[m]}`)
			.join(', ')
	);
</script>

<div class="bar" role="img" aria-label={label} title={label}>
	{#each order as m}
		{#if counts[m]}
			<i class={m} style="width:{(counts[m] / Math.max(1, total)) * 100}%"></i>
		{/if}
	{/each}
</div>

<style>
	.bar {
		display: flex;
		height: 10px;
		border-radius: 6px;
		overflow: hidden;
		background: var(--m-new);
		gap: 2px;
	}
	i {
		display: block;
		height: 100%;
	}
	.ancree {
		background: var(--m-anchored);
	}
	.maitrisee {
		background: var(--m-mastered);
	}
	.apprentissage {
		background: var(--m-learning);
	}
	.fragile {
		background: var(--m-fragile);
	}
	.nouvelle {
		background: var(--m-new);
	}
</style>
