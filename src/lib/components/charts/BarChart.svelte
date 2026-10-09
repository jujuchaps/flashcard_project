<script lang="ts">
	import { fmtNumber, niceTicks } from './scale';

	interface Bar {
		label: string;
		value: number;
		tip: string;
	}

	let {
		data,
		height = 180,
		reference = null,
		caption
	}: { data: Bar[]; height?: number; reference?: { value: number; label: string } | null; caption: string } = $props();

	let width = $state(0);
	let hover = $state<number | null>(null);

	const pad = { top: 14, right: 8, bottom: 26, left: 36 };
	const max = $derived(Math.max(1, ...data.map((d) => d.value), reference?.value ?? 0));
	const ticks = $derived(niceTicks(max));
	const top = $derived(ticks[ticks.length - 1]);
	const innerW = $derived(Math.max(10, width - pad.left - pad.right));
	const innerH = $derived(height - pad.top - pad.bottom);
	const band = $derived(innerW / Math.max(1, data.length));
	const barW = $derived(Math.max(2, Math.min(24, band - 2)));
	const y = (v: number) => pad.top + innerH - (v / top) * innerH;
	const labelEvery = $derived(Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 48)))));

	/** Barre arrondie (4 px) au bout, carrée sur la ligne de base. */
	function barPath(i: number, v: number): string {
		const x = pad.left + i * band + (band - barW) / 2;
		const h = (v / top) * innerH;
		if (h <= 0) return '';
		const r = Math.min(4, h, barW / 2);
		const b = pad.top + innerH;
		return `M${x},${b} V${b - h + r} Q${x},${b - h} ${x + r},${b - h} H${x + barW - r} Q${x + barW},${b - h} ${x + barW},${b - h + r} V${b} Z`;
	}
</script>

<figure>
	<div class="wrap" bind:clientWidth={width} style="--h:{height}px">
		{#if width > 0}
		<svg {width} {height} role="img" aria-label={caption}>
			{#each ticks as t}
				<line class="grid" x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
				<text class="tick" x={pad.left - 6} y={y(t)} dy="0.32em" text-anchor="end">{fmtNumber(t)}</text>
			{/each}
			{#each data as d, i}
				<path class="bar" class:dim={hover !== null && hover !== i} d={barPath(i, d.value)} />
				{#if i % labelEvery === 0 || i === data.length - 1}
					<text class="tick" x={pad.left + i * band + band / 2} y={height - 8} text-anchor="middle">{d.label}</text>
				{/if}
			{/each}
			{#if reference}
				<line class="ref" x1={pad.left} x2={width - pad.right} y1={y(reference.value)} y2={y(reference.value)} />
				<text class="ref-label" x={width - pad.right} y={y(reference.value) - 5} text-anchor="end">{reference.label}</text>
			{/if}
			{#each data as _, i}
				<rect
					class="hit"
					x={pad.left + i * band}
					y={pad.top}
					width={band}
					height={innerH}
					role="presentation"
					onmouseenter={() => (hover = i)}
					onmouseleave={() => (hover = null)}
				/>
			{/each}
		</svg>
		{/if}
		{#if hover !== null}
			{@const d = data[hover]}
			<div
				class="tip"
				style="left:{Math.min(width - 150, Math.max(0, pad.left + hover * band + band / 2 - 75))}px; top:{Math.max(0, y(d.value) - 58)}px"
			>
				{d.tip}
			</div>
		{/if}
	</div>
	<figcaption>
		<details>
			<summary>Voir les données</summary>
			<table>
				<tbody>
					{#each data as d}<tr><td>{d.tip}</td></tr>{/each}
				</tbody>
			</table>
		</details>
	</figcaption>
</figure>

<style>
	figure {
		margin: 0;
	}
	.wrap {
		position: relative;
		min-height: var(--h);
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--line);
		stroke-width: 1;
	}
	.tick {
		fill: var(--muted);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.bar {
		fill: var(--chart);
		transition: opacity 0.15s;
	}
	.bar.dim {
		opacity: 0.45;
	}
	.ref {
		stroke: var(--muted);
		stroke-width: 1;
	}
	.ref-label {
		fill: var(--muted);
		font-size: 11px;
	}
	.hit {
		fill: transparent;
	}
	.tip {
		position: absolute;
		width: 150px;
		pointer-events: none;
		background: var(--ink);
		color: var(--bg);
		font-size: 0.82rem;
		line-height: 1.35;
		padding: 6px 8px;
		border-radius: 8px;
		white-space: pre-line;
	}
	details {
		font-size: 0.85rem;
		color: var(--muted);
		margin-top: 4px;
	}
	table {
		border-collapse: collapse;
		margin-top: 6px;
	}
	td {
		padding: 2px 0;
		white-space: pre-line;
		border-bottom: 1px solid var(--line);
	}
</style>
