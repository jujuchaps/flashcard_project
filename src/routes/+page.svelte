<script lang="ts">
	import { enhance } from '$app/forms';
	import MasteryBar from '$lib/components/MasteryBar.svelte';
	import MasteryLegend from '$lib/components/MasteryLegend.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import { hhmm } from '$lib/schedule';

	let { data, form } = $props();

	const STORE_KEY = 'etude:cible';
	let count = $state(10);
	let selected = $state<number[]>([]);
	let selectedChapters = $state<number[]>([]);

	$effect.pre(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
			if (saved) {
				count = saved.count ?? 10;
				selected = (saved.selected ?? []).filter((id: number) => data.courses.some((c) => c.id === id));
			}
		} catch {}
	});

	function remember() {
		try {
			localStorage.setItem(STORE_KEY, JSON.stringify({ count, selected }));
		} catch {}
	}

	function toggle(id: number) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
		selectedChapters = [];
		remember();
	}

	function toggleChapter(id: number) {
		selectedChapters = selectedChapters.includes(id) ? selectedChapters.filter((x) => x !== id) : [...selectedChapters, id];
	}

	/** Un seul cours choisi : on peut préciser les chapitres. */
	const chapterChoices = $derived(
		selected.length === 1 ? (data.courses.find((c) => c.id === selected[0])?.chapters.filter((ch) => ch.total) ?? []) : []
	);

	const totals = $derived(
		data.courses.reduce(
			(acc, c) => {
				acc.total += c.total;
				acc.done += c.counts.maitrisee + c.counts.ancree;
				return acc;
			},
			{ total: 0, done: 0 }
		)
	);
	const newQuota = $derived(Math.min(Math.max(data.newPerSeries, data.plan.newToday), data.counts.fresh));
	const reviewCount = $derived(Math.min(data.reviewSize, data.counts.due + newQuota));
	const minutes = $derived(Math.max(1, Math.round((reviewCount * 25) / 60)));

	function when(days: number) {
		if (days === 0) return 'aujourd’hui';
		if (days === 1) return 'demain';
		return `dans ${days} jours`;
	}
</script>

<svelte:head><title>Accueil · Étude</title></svelte:head>

<h1>Bonjour!</h1>
<p class="sub">
	{#if data.streak.days > 0}
		Série de <strong>{data.streak.days} jour{data.streak.days > 1 ? 's' : ''}</strong>
		{data.streak.today ? '· déjà étudié aujourd’hui ✔' : '· étudie aujourd’hui pour la garder'}
	{:else}
		Ce que tu rates revient vite. Ce que tu réussis revient de plus en plus tard.
	{/if}
</p>

{#if form?.error}
	<p class="msg ko" role="alert">{form.error}</p>
{/if}

{#if data.current}
	<a class="resume msg warn" href="/serie/{data.current}">Tu as une série en cours : la reprendre →</a>
{/if}

{#each data.alerts as a}
	<p class="msg {a.level === 'bad' ? 'ko' : 'warn'} alert">
		{a.text}
		{#if a.href}<a href={a.href}>Voir</a>{/if}
	</p>
{/each}

{#if data.classes.today.length || data.classes.tomorrow.length}
	<section class="panel classes">
		{#each [{ title: 'Aujourd’hui en classe', list: data.classes.today }, { title: 'Demain', list: data.classes.tomorrow }] as { title, list }}
			{#if list.length}
				<div>
					<p class="label">{title}</p>
					{#each list as s}
						<a href="/cours/{s.courseId}" class="cls">
							<b>{s.courseName}</b>
							<span class="note">{hhmm(s.starts)} à {hhmm(s.ends)}{s.room ? ` · ${s.room}` : ''}</span>
						</a>
					{/each}
				</div>
			{/if}
		{/each}
		<p class="note full">Les révisions de ces cours passent en premier : arrive en classe avec la matière fraîche.</p>
	</section>
{/if}

<section class="panel today">
	<h2>Révision du jour</h2>
	<div class="kpis">
		<div><b>{data.counts.due}</b><span>à réviser</span></div>
		<div><b>{newQuota}</b><span>nouvelles</span></div>
		<div><b>{data.today.answers}</b><span>réponses aujourd’hui</span></div>
	</div>
	<form method="POST" action="?/start" use:enhance>
		<input type="hidden" name="mode" value="revision" />
		<input type="hidden" name="count" value={data.reviewSize} />
		<button class="go" disabled={reviewCount === 0}>
			{reviewCount ? `Commencer (${reviewCount} questions, ≈ ${minutes} min)` : 'Rien à réviser pour l’instant'}
		</button>
	</form>
	{#if data.plan.items.length}
		<div class="plan">
			<p class="label">Plan du jour selon tes examens</p>
			<ul>
				{#each data.plan.items as it}
					<li>
						<strong>{it.courseName}</strong> : {it.remainingToday
							? `${it.remainingToday} nouvelle${it.remainingToday > 1 ? 's' : ''} à voir aujourd’hui`
							: 'objectif du jour atteint ✔'}
						<span class="note">({it.fresh} jamais vues avant « {it.evaluation} », {when(it.daysLeft)})</span>
					</li>
				{/each}
			</ul>
			<p class="note">
				Charge estimée : {data.plan.reviews} révisions + {data.plan.newToday} nouvelles ≈ {data.plan.minutes} min
				(objectif : {data.plan.targetMinutes} min).
			</p>
			{#if data.plan.overloaded}
				<p class="msg warn">Journée chargée : fais au moins tes révisions, et augmente ton temps d’étude ou commence plus tôt pour les prochains examens.</p>
			{/if}
		</div>
	{:else}
		<p class="note">Toutes les matières mélangées : d’abord ce qui est sur le point de s’effacer, puis quelques nouvelles questions. <a href="/examens">Ajoute tes dates d’examen</a> pour obtenir un plan quotidien.</p>
	{/if}
</section>

{#if data.evaluations.length}
	<section class="panel">
		<h2>Examens à venir</h2>
		{#each data.evaluations as ev}
			<div class="exam">
				<div class="exam-top">
					<span><strong>{ev.name}</strong> <span class="note">· {ev.courseName}</span></span>
					<span class="pill {ev.daysLeft <= 7 ? 'warn' : ''}">{when(ev.daysLeft)}</span>
				</div>
				<Meter value={ev.readiness.index} label="Préparation pour {ev.name}" />
				<p class="note">
					Préparation {Math.round(ev.readiness.index * 100)} % · {ev.readiness.seen}/{ev.readiness.total} questions vues
				</p>
				<div class="row">
					<form method="POST" action="?/start" use:enhance>
						<input type="hidden" name="mode" value="sprint" />
						<input type="hidden" name="evaluationId" value={ev.id} />
						<input type="hidden" name="count" value="20" />
						<button class="btn small">Sprint (20)</button>
					</form>
					<form method="POST" action="?/start" use:enhance>
						<input type="hidden" name="mode" value="examen" />
						<input type="hidden" name="evaluationId" value={ev.id} />
						<input type="hidden" name="count" value="20" />
						<input type="hidden" name="durationMin" value="20" />
						<button class="btn small">Examen blanc (20 min)</button>
					</form>
				</div>
			</div>
		{/each}
		<p class="note"><a href="/examens">Gérer les examens</a></p>
	</section>
{/if}

<section class="panel">
	<h2>Quiz ciblé</h2>
	<form method="POST" action="?/start" use:enhance>
		<input type="hidden" name="mode" value="cible" />
		<div class="row count">
			<button type="button" class="btn sq" aria-label="Moins de questions" onclick={() => { count = Math.max(1, count - 1); remember(); }}>−</button>
			<input type="number" name="count" min="1" max="200" bind:value={count} onchange={remember} aria-label="Nombre de questions" />
			<button type="button" class="btn sq" aria-label="Plus de questions" onclick={() => { count = Math.min(200, count + 1); remember(); }}>+</button>
			{#each [5, 10, 20] as n}
				<button type="button" class="chip" aria-pressed={count === n} onclick={() => { count = n; remember(); }}>{n}</button>
			{/each}
		</div>
		<p class="label">Cours <span class="note">(aucun = tous)</span></p>
		<div class="chips">
			{#each data.courses.filter((c) => c.total) as c}
				<button type="button" class="chip" aria-pressed={selected.includes(c.id)} onclick={() => toggle(c.id)}>{c.name}</button>
			{/each}
		</div>
		{#if chapterChoices.length > 1}
			<p class="label">Chapitres <span class="note">(aucun = tout le cours)</span></p>
			<div class="chips">
				{#each chapterChoices as ch}
					<button type="button" class="chip" aria-pressed={selectedChapters.includes(ch.id)} onclick={() => toggleChapter(ch.id)}>{ch.name}</button>
				{/each}
			</div>
		{/if}
		{#each selected as id}<input type="hidden" name="course" value={id} />{/each}
		{#each selectedChapters as id}<input type="hidden" name="chapter" value={id} />{/each}
		<button class="go" style="margin-top:16px">Commencer</button>
	</form>
	{#if data.counts.misconceptions + data.weak.length > 0}
		<form method="POST" action="?/start" use:enhance class="errors">
			<input type="hidden" name="mode" value="erreurs" />
			<input type="hidden" name="count" value="20" />
			{#each selected as id}<input type="hidden" name="course" value={id} />{/each}
			<button class="btn">Retravailler mes erreurs</button>
		</form>
	{/if}
</section>

<section class="panel">
	<h2>Où tu en es{data.session ? ` · ${data.session.name}` : ''}</h2>
	<p class="note" style="margin-top:-6px">
		{totals.done} / {totals.total} questions maîtrisées ou ancrées · <a href="/sessions">Toutes les sessions</a>
	</p>
	{#each data.courses as c}
		<a class="course" href="/cours/{c.id}">
			<b>{c.name}{c.sessionId === null ? ' (hors session)' : ''}</b>
			<small>
				{c.counts.maitrisee + c.counts.ancree}/{c.total}
				{#if c.firstTryRate !== null}· {Math.round(c.firstTryRate * 100)} % du 1er coup{/if}
			</small>
			<div class="span"><MasteryBar counts={c.counts} total={c.total} /></div>
		</a>
	{:else}
		<p class="note">Aucun cours pour l’instant. <a href="/importer">Importe des questions</a>.</p>
	{/each}
	<MasteryLegend />
</section>

<section class="panel">
	<h2>Mes points faibles</h2>
	{#if data.counts.misconceptions > 0}
		<p class="msg ko">
			<strong>{data.counts.misconceptions} fausse{data.counts.misconceptions > 1 ? 's' : ''} croyance{data.counts.misconceptions > 1 ? 's' : ''}</strong> :
			des questions ratées alors que tu étais sûr de toi. Ce sont les plus importantes à corriger.
		</p>
	{/if}
	{#each data.weak as w}
		<div class="weak">
			<p class="note">{w.course}</p>
			<p>{w.prompt}</p>
			<span class="pill bad">ratée {w.wrong} fois</span>
			{#if w.misconception}<span class="pill warn">fausse croyance</span>{/if}
		</div>
	{:else}
		<p class="note">Fais quelques séries et tes points faibles apparaîtront ici.</p>
	{/each}
</section>

<style>
	.classes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 4px 16px;
	}
	.classes .label {
		margin: 0 0 6px;
	}
	.cls {
		display: flex;
		flex-direction: column;
		padding: 6px 0;
		border-top: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.full {
		grid-column: 1 / -1;
		margin: 6px 0 0;
	}
	.alert a {
		margin-left: 6px;
	}
	.plan ul {
		margin: 0 0 8px;
		padding-left: 18px;
	}
	.plan li {
		margin-bottom: 4px;
	}
	.exam {
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}
	.exam:first-of-type {
		border-top: 0;
	}
	.exam-top {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 6px;
		flex-wrap: wrap;
	}
	.exam p {
		margin: 4px 0 8px;
	}
	.resume {
		display: block;
		text-decoration: none;
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 14px;
	}
	.kpis div {
		background: var(--bg);
		border-radius: 10px;
		padding: 10px;
		text-align: center;
	}
	.kpis b {
		display: block;
		font-family: 'Bricolage Grotesque', system-ui, sans-serif;
		font-size: 1.8rem;
		line-height: 1.1;
	}
	.kpis span {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.count input {
		width: 80px;
		text-align: center;
		font-weight: 700;
		font-size: 1.15rem;
	}
	.sq {
		width: 44px;
		font-size: 1.3rem;
		font-weight: 700;
		padding: 0;
	}
	.label {
		font-weight: 700;
		margin: 16px 0 8px;
	}
	.errors {
		margin-top: 10px;
	}
	.errors .btn {
		width: 100%;
	}
	.course {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 12px;
		align-items: center;
		padding: 10px 0;
		border-top: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.course:first-of-type {
		border-top: 0;
	}
	.course small {
		color: var(--muted);
		text-align: right;
	}
	.span {
		grid-column: 1 / -1;
	}
	.weak {
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}
	.weak:first-of-type {
		border-top: 0;
	}
	.weak p {
		margin: 2px 0;
	}
</style>
