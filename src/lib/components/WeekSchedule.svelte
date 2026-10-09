<script lang="ts">
	import { isoWeekday, JOURS, kindLabel, type Slot } from '$lib/schedule';

	let { slots }: { slots: (Slot & { courseName: string; href?: string })[] } = $props();

	const days = $derived.by(() => {
		const max = Math.max(5, ...slots.map((s) => s.weekday));
		return Array.from({ length: max }, (_, i) => ({ day: i + 1, list: slots.filter((s) => s.weekday === i + 1) }));
	});
	const today = isoWeekday(new Date());
</script>

<div class="week">
	{#each days as d}
		<div class="day" class:today={d.day === today}>
			<h3>{JOURS[d.day]}{d.day === today ? ' · aujourd’hui' : ''}</h3>
			{#each d.list as s}
				<a class="slot" href={s.href ?? `/cours/${s.courseId}`}>
					<b>{s.courseName}</b>
					<span class="time">{s.starts}–{s.ends}</span>
					<span class="note">{[s.room, kindLabel(s.kind)].filter(Boolean).join(' · ')}</span>
				</a>
			{:else}
				<p class="note">—</p>
			{/each}
		</div>
	{/each}
</div>

<style>
	.week {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 8px;
	}
	.day {
		background: var(--bg);
		border-radius: 10px;
		padding: 8px;
	}
	.day.today {
		outline: 2px solid var(--accent);
	}
	h3 {
		font-size: 0.9rem;
		margin: 0 0 6px;
	}
	.slot {
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 6px 8px;
		margin-bottom: 6px;
		font-size: 0.85rem;
		color: var(--ink);
		text-decoration: none;
		line-height: 1.35;
	}
	.slot:hover {
		border-color: var(--accent);
	}
	.note {
		font-size: 0.8rem;
	}
	.time {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
</style>
