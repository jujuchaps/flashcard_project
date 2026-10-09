<script lang="ts">
	import { longDay } from './scale';

	/** Calendrier d'étude façon GitHub : une colonne par semaine, intensité = nombre de réponses. */
	let { days }: { days: { day: string; answers: number }[] } = $props();

	let hover = $state<{ text: string; x: number; y: number } | null>(null);

	const CELL = 13;
	const GAP = 2;
	// Aligne la première colonne sur un lundi.
	const cells = $derived.by(() => {
		if (!days.length) return [];
		const [y, m, d] = days[0].day.split('-').map(Number);
		const offset = (new Date(y, m - 1, d).getDay() + 6) % 7;
		return days.map((x, i) => ({ ...x, col: Math.floor((i + offset) / 7), row: (i + offset) % 7 }));
	});
	const cols = $derived(cells.length ? cells[cells.length - 1].col + 1 : 0);
	const max = $derived(Math.max(1, ...days.map((d) => d.answers)));

	function level(n: number): number {
		if (n <= 0) return 0;
		return Math.min(4, 1 + Math.floor((n / max) * 3.999));
	}
</script>

<div class="outer">
<div class="cal">
	<svg width={cols * (CELL + GAP)} height={7 * (CELL + GAP)} role="img" aria-label="Calendrier des jours d’étude">
		{#each cells as c}
			<rect
				class="l{level(c.answers)}"
				x={c.col * (CELL + GAP)}
				y={c.row * (CELL + GAP)}
				width={CELL}
				height={CELL}
				rx="3"
				role="presentation"
				onmouseenter={() =>
					(hover = {
						text: `${longDay(c.day)}\n${c.answers} réponse${c.answers > 1 ? 's' : ''}`,
						x: c.col * (CELL + GAP),
						y: c.row * (CELL + GAP)
					})}
				onmouseleave={() => (hover = null)}
			/>
		{/each}
	</svg>
</div>
	{#if hover}
		<div class="tip" style="left:{Math.max(0, hover.x - 70)}px; top:{hover.y + 20}px">{hover.text}</div>
	{/if}
</div>
<div class="legend">
	<span>Moins</span>
	{#each [0, 1, 2, 3, 4] as l}<svg width={CELL} height={CELL} aria-hidden="true"><rect class="l{l}" width={CELL} height={CELL} rx="3" /></svg>{/each}
	<span>Plus</span>
</div>

<style>
	.outer {
		position: relative;
	}
	.cal {
		overflow-x: auto;
		padding-top: 4px;
	}
	svg {
		display: block;
	}
	.l0 {
		fill: var(--line);
	}
	.l1 {
		fill: color-mix(in oklab, var(--chart) 30%, var(--surface));
	}
	.l2 {
		fill: color-mix(in oklab, var(--chart) 55%, var(--surface));
	}
	.l3 {
		fill: color-mix(in oklab, var(--chart) 78%, var(--surface));
	}
	.l4 {
		fill: var(--chart);
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--muted);
		font-size: 0.82rem;
		margin-top: 6px;
	}
	.legend svg {
		display: inline-block;
	}
	.tip {
		position: absolute;
		width: 160px;
		pointer-events: none;
		background: var(--ink);
		color: var(--bg);
		font-size: 0.82rem;
		line-height: 1.35;
		padding: 6px 8px;
		border-radius: 8px;
		white-space: pre-line;
		z-index: 1;
	}
</style>
