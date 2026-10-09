<script lang="ts">
	/** Jauge 0 à 1 : la couleur porte l'état, la piste est une teinte plus claire de la même couleur. */
	let { value, label }: { value: number; label: string } = $props();
	const pct = $derived(Math.round(Math.max(0, Math.min(1, value)) * 100));
	const tone = $derived(value >= 0.8 ? 'accent' : value >= 0.6 ? 'warn' : 'bad');
</script>

<div class="meter {tone}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct} aria-label={label}>
	<div class="fill" style="width:{pct}%"></div>
</div>

<style>
	.meter {
		height: 10px;
		border-radius: 6px;
		overflow: hidden;
		--c: var(--chart);
		background: color-mix(in oklab, var(--c) 18%, var(--surface));
	}
	.meter.warn {
		--c: var(--warn);
	}
	.meter.bad {
		--c: var(--bad);
	}
	.fill {
		height: 100%;
		background: var(--c);
		border-radius: 0 4px 4px 0;
	}
</style>
