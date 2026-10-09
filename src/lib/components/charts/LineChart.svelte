<script lang="ts">
	import { fmtNumber, niceTicks } from './scale';

	interface Point {
		label: string;
		value: number;
		tip: string;
	}

	let { data, height = 180, caption }: { data: Point[]; height?: number; caption: string } = $props();

	let width = $state(0);
	let hover = $state<number | null>(null);

	const pad = { top: 16, right: 40, bottom: 26, left: 40 };
	const ticks = $derived(niceTicks(Math.max(1, ...data.map((d) => d.value))));
	const top = $derived(ticks[ticks.length - 1]);
	const innerW = $derived(Math.max(10, width - pad.left - pad.right));
	const innerH = $derived(height - pad.top - pad.bottom);
	const x = (i: number) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
	const y = (v: number) => pad.top + innerH - (v / top) * innerH;
	const line = $derived(data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' '));
	const area = $derived(
		data.length ? `${line} L${x(data.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z` : ''
	);
	const labelEvery = $derived(Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 56)))));

	function move(e: MouseEvent) {
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left;
		const i = data.length <= 1 ? 0 : Math.round(((px - pad.left) / innerW) * (data.length - 1));
		hover = Math.max(0, Math.min(data.length - 1, i));
	}
</script>

<figure>
	<div class="wrap" bind:clientWidth={width} style="--h:{height}px">
		{#if width > 0}
		<svg {width} {height} role="img" aria-label={caption} onmousemove={move} onmouseleave={() => (hover = null)}>
			{#each ticks as t}
				<line class="grid" x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
				<text class="tick" x={pad.left - 6} y={y(t)} dy="0.32em" text-anchor="end">{fmtNumber(t)}</text>
			{/each}
			{#each data as d, i}
				{#if i % labelEvery === 0 || i === data.length - 1}
					<text class="tick" x={x(i)} y={height - 8} text-anchor="middle">{d.label}</text>
				{/if}
			{/each}
			{#if data.length}
				<path class="area" d={area} />
				<path class="line" d={line} />
				<circle class="dot" cx={x(data.length - 1)} cy={y(data[data.length - 1].value)} r="4" />
				<text class="end" x={x(data.length - 1) + 8} y={y(data[data.length - 1].value)} dy="0.32em">
					{fmtNumber(data[data.length - 1].value)}
				</text>
			{/if}
			{#if hover !== null}
				<line class="cross" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} />
				<circle class="dot" cx={x(hover)} cy={y(data[hover].value)} r="4" />
			{/if}
		</svg>
		{/if}
		{#if hover !== null}
			<div class="tip" style="left:{Math.min(width - 160, Math.max(0, x(hover) - 80))}px; top:{Math.max(0, y(data[hover].value) - 60)}px">
				{data[hover].tip}
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
	.tick,
	.end {
		fill: var(--muted);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.end {
		fill: var(--ink);
		font-weight: 700;
	}
	.area {
		fill: var(--chart);
		opacity: 0.1;
	}
	.line {
		fill: none;
		stroke: var(--chart);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.dot {
		fill: var(--chart);
		stroke: var(--surface);
		stroke-width: 2;
	}
	.cross {
		stroke: var(--muted);
		stroke-width: 1;
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
