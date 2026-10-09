<script lang="ts">
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import StudyCalendar from '$lib/components/charts/StudyCalendar.svelte';
	import { longDay, shortDay } from '$lib/components/charts/scale';

	let { data } = $props();

	const last30 = $derived(data.days.slice(-30));
	const activityBars = $derived(
		last30.map((d) => ({
			label: shortDay(d.day),
			value: d.first,
			tip: `${longDay(d.day)}\n${d.first} question${d.first > 1 ? 's' : ''}, ${d.first ? Math.round((d.ok / d.first) * 100) : 0} % du premier coup`
		}))
	);
	const forecastBars = $derived(
		data.forecast.map((d, i) => ({
			label: i === 0 ? 'auj.' : shortDay(d.day),
			value: d.reviews + d.fresh,
			tip: `${longDay(d.day)}\n${d.reviews} révision${d.reviews > 1 ? 's' : ''} + ${d.fresh} nouvelle${d.fresh > 1 ? 's' : ''}`
		}))
	);
	const heavy = $derived(data.forecast.filter((d) => d.reviews + d.fresh > data.capacity));
	const masteryPoints = $derived(
		data.history.map((h) => ({
			label: shortDay(h.day),
			value: h.mastered,
			tip: `${longDay(h.day)}\n${h.mastered} maîtrisées ou ancrées sur ${h.total}`
		}))
	);

	function pct(x: number | null) {
		return x === null ? '—' : `${Math.round(x * 100)} %`;
	}

	function delta(cur: number | null, prev: number | null, unit = '') {
		if (cur === null || prev === null) return null;
		const d = Math.round(cur - prev);
		if (d === 0) return { text: 'comme la semaine passée', dir: 'same' as const };
		return { text: `${d > 0 ? '+' : ''}${d}${unit} vs semaine passée`, dir: d > 0 ? ('up' as const) : ('down' as const) };
	}

	const tiles = $derived([
		{ label: 'Jours d’étude', value: `${data.week.daysStudied}/7`, delta: delta(data.week.daysStudied, data.week.previous.daysStudied) },
		{ label: 'Questions répondues', value: String(data.week.answers), delta: delta(data.week.answers, data.week.previous.answers) },
		{
			label: 'Réussite du premier coup',
			value: pct(data.week.firstTryRate),
			delta: delta(
				data.week.firstTryRate === null ? null : data.week.firstTryRate * 100,
				data.week.previous.firstTryRate === null ? null : data.week.previous.firstTryRate * 100,
				' pts'
			)
		},
		{
			label: 'Nouvelles maîtrisées',
			value: data.week.masteredGain === null ? '—' : `${data.week.masteredGain >= 0 ? '+' : ''}${data.week.masteredGain}`,
			delta: null
		}
	]);
</script>

<svelte:head><title>Progrès · Étude</title></svelte:head>

<div class="top">
	<div>
		<h1>Progrès</h1>
		<p class="sub">Les 7 derniers jours, ton historique et la charge qui s’en vient.</p>
	</div>
	<a class="btn primary" href="/progres/bilan">Bilan de la semaine</a>
</div>

{#each data.alerts as a}
	<p class="msg {a.level === 'bad' ? 'ko' : 'warn'}">{a.text}</p>
{/each}

<div class="tiles">
	{#each tiles as t}
		<div class="panel tile">
			<span class="tl">{t.label}</span>
			<span class="tv">{t.value}</span>
			{#if t.delta}
				<span class="td {t.delta.dir === 'up' ? 'good' : t.delta.dir === 'down' ? 'bad' : 'note'}">
					{t.delta.dir === 'up' ? '▲' : t.delta.dir === 'down' ? '▼' : '='} {t.delta.text}
				</span>
			{/if}
		</div>
	{/each}
</div>

<section class="panel">
	<h2>Jours d’étude</h2>
	<p class="note sub2">18 dernières semaines. La régularité compte plus que la durée.</p>
	<StudyCalendar days={data.days} />
</section>

<section class="panel">
	<h2>Questions répondues par jour</h2>
	<p class="note sub2">Premiers essais seulement, 30 derniers jours.</p>
	<BarChart data={activityBars} caption="Questions répondues par jour, 30 derniers jours" />
</section>

<section class="panel">
	<h2>Charge prévue, 14 prochains jours</h2>
	<p class="note sub2">Révisions dues selon la répétition espacée, plus les nouvelles questions du plan. La ligne marque ton objectif de {data.targetMinutes} min par jour.</p>
	<BarChart
		data={forecastBars}
		reference={{ value: data.capacity, label: `objectif ${data.targetMinutes} min` }}
		caption="Charge prévue pour les 14 prochains jours"
	/>
	{#if heavy.length}
		<p class="msg warn" style="margin-top:10px">
			{heavy.length} jour{heavy.length > 1 ? 's' : ''} au-dessus de ton objectif ({heavy.map((d) => shortDay(d.day)).join(', ')}). Fais un peu plus les jours précédents pour lisser la charge.
		</p>
	{/if}
</section>

<section class="panel">
	<h2>Questions maîtrisées ou ancrées</h2>
	<p class="note sub2">Un point par jour où tu as ouvert l’app.</p>
	{#if masteryPoints.length >= 2}
		<LineChart data={masteryPoints} caption="Questions maîtrisées ou ancrées dans le temps" />
	{:else}
		<p class="note">La courbe apparaîtra après quelques jours d’utilisation.</p>
	{/if}
</section>

<style>
	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		flex-wrap: wrap;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-bottom: 6px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-bottom: 10px;
	}
	.tl {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.tv {
		font-weight: 700;
		font-size: 1.6rem;
		line-height: 1.2;
	}
	.td {
		font-size: 0.8rem;
	}
	.sub2 {
		margin: -6px 0 12px;
	}
	@media (max-width: 640px) {
		.tiles {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
