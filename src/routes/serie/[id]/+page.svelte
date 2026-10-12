<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import QuestionInput from '$lib/components/QuestionInput.svelte';
	import { correctAnswerText, DEVELOPPEMENT_SEUIL, grade } from '$lib/grading';
	import type { Answer, Confidence, GradeResult } from '$lib/types';
	import type { SeriesView } from '$lib/server/study';

	let { data } = $props();

	let view = $state<SeriesView>(untrack(() => data.view));
	let result = $state<GradeResult | null>(null);
	let submitted = $state<Answer | null>(null);
	let override = $state(false);
	let busy = $state(false);
	let errorMsg = $state('');
	let copied = $state(false);
	let startedAt = Date.now();
	let adjusted = $state(false);
	let now = $state(Date.now());
	const timer = setInterval(() => (now = Date.now()), 1000);
	onDestroy(() => clearInterval(timer));

	const remainingMs = $derived(view.exam?.endsAt ? new Date(view.exam.endsAt).getTime() - now : null);
	let finishing = false;
	$effect(() => {
		if (remainingMs !== null && remainingMs <= 0 && view.current && !finishing) {
			finishing = true;
			finishExam();
		}
	});

	async function finishExam() {
		const res = await fetch(`/api/serie/${view.id}/terminer`, { method: 'POST' });
		if (res.ok) view = await res.json();
		reset();
	}

	function clock(ms: number) {
		const t = Math.max(0, Math.ceil(ms / 1000));
		return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
	}

	/** Développement : l'étudiant peut cocher un élément clé que les mots-clés n'ont pas repéré. */
	function adjust(i: number) {
		if (!q || !result?.details || q.payload.type !== 'developpement') return;
		const details = result.details.map((d, k) => (k === i ? !d : d));
		const total = q.payload.elements.reduce((s, e) => s + e.points, 0) || 1;
		const score = q.payload.elements.reduce((s, e, k) => s + (details[k] ? e.points : 0), 0) / total;
		result = { details, score, correct: score >= DEVELOPPEMENT_SEUIL };
		adjusted = true;
	}

	const q = $derived(view.current);
	const pct = $derived(view.progress.total ? (view.progress.done / view.progress.total) * 100 : 0);
	const finalCorrect = $derived(!!result && (result.correct || override));
	const canOverride = $derived(
		!!result && !result.correct && !!q && ['courte', 'trous', 'numerique', 'developpement'].includes(q.payload.type)
	);

	function onsubmit(a: Answer) {
		if (!q || result) return;
		submitted = a;
		if (view.exam) {
			send('non');
			return;
		}
		result = grade(q.payload, a);
	}

	async function send(confidence: Confidence) {
		if (!q || !submitted || busy) return;
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch(`/api/serie/${view.id}/repondre`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					questionId: q.id,
					answer: submitted,
					confidence,
					override,
					adjusted: adjusted && result?.details ? result.details : undefined,
					durationMs: Date.now() - startedAt
				})
			});
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Erreur du serveur.');
			view = await res.json();
			reset();
		} catch (e) {
			errorMsg = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	function reset() {
		result = null;
		submitted = null;
		override = false;
		adjusted = false;
		copied = false;
		startedAt = Date.now();
		window.scrollTo(0, 0);
	}

	async function flag() {
		if (!q) return;
		const note = prompt('Qu’est-ce qui ne va pas avec cette question? (optionnel)');
		if (note === null) return;
		await fetch(`/api/questions/${q.id}/signaler`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ seriesId: view.id, note })
		});
		const res = await fetch(`/api/serie/${view.id}`);
		if (res.ok) view = await res.json();
		reset();
		view.notices = ['Question signalée et retirée des quiz. Tu la retrouveras dans la page du cours.'];
	}

	async function retire() {
		if (!q) return;
		const label = q.courseName + (q.chapterName && q.chapterName !== 'Général' ? ` › ${q.chapterName}` : '');
		await fetch(`/api/questions/${q.id}/retirer`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ seriesId: view.id })
		});
		const res = await fetch(`/api/serie/${view.id}`);
		if (res.ok) view = await res.json();
		reset();
		view.notices = [`Question retirée : elle ne te sera plus posée. Pour la remettre, ouvre ${label} dans Cours.`];
	}

	async function askClaude() {
		if (!q || !result) return;
		const text = [
			`J'étudie « ${q.courseName} ». Peux-tu m'expliquer cette notion autrement (analogie, exemple concret), en restant bref?`,
			``,
			`Question : ${q.prompt}`,
			`Bonne réponse : ${correctAnswerText(q.payload)}`,
			q.explanation ? `Explication donnée : ${q.explanation}` : '',
			submitted && 'texte' in submitted ? `Ma réponse : ${submitted.texte}` : ''
		]
			.filter(Boolean)
			.join('\n');
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			prompt('Copie ce message et colle-le dans Claude :', text);
		}
	}

	function onkey(e: KeyboardEvent) {
		if (!result || busy || e.ctrlKey || e.metaKey || e.altKey) return;
		const t = e.target as HTMLElement;
		if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.hasAttribute('disabled')) return;
		if (view.askConfidence) {
			const map: Record<string, Confidence> = { '1': 'sur', '2': 'hesitant', '3': 'devine' };
			if (map[e.key]) {
				e.preventDefault();
				send(map[e.key]);
			}
		} else if (e.key === 'Enter') {
			e.preventDefault();
			send('non');
		}
	}

	const devScore = $derived(
		result && q?.payload.type === 'developpement'
			? (() => {
					const p = q.payload;
					const total = p.elements.reduce((s, e) => s + e.points, 0);
					return { got: Math.round(result.score * total * 10) / 10, total };
				})()
			: null
	);
</script>

<svelte:window onkeydown={onkey} />
<svelte:head><title>Série · Étude</title></svelte:head>

{#if q && view.exam}
	<div class="head">
		<span class="note"><strong>{view.exam.title}</strong> · question {view.progress.done + 1} sur {view.progress.total}</span>
		<div class="row">
			{#if remainingMs !== null}
				<span class="pill {remainingMs < 120000 ? 'bad' : ''}" aria-live="polite">⏱ {clock(remainingMs)}</span>
			{/if}
			<button class="btn small" onclick={() => confirm('Terminer l’examen maintenant? Les questions restantes compteront comme non répondues.') && finishExam()}>Terminer</button>
		</div>
	</div>
	<div class="prog" aria-hidden="true"><div style="width:{pct}%"></div></div>
	<p class="note">Conditions d’examen : la correction s’affiche à la fin.</p>
	<div class="tags"><span class="note">{q.courseName}</span></div>
	{#key q.id}
		<QuestionInput payload={q.payload} prompt={q.prompt} result={null} submitted={null} {onsubmit} />
	{/key}
	{#if errorMsg}<p class="msg ko">{errorMsg}</p>{/if}
{:else if q}
	<div class="head">
		<span class="note">{view.progress.done} réglée{view.progress.done > 1 ? 's' : ''} sur {view.progress.total}</span>
		<div class="row">
			<button class="btn small" onclick={retire} title="Retirer cette question de tous les quiz (tu pourras la remettre)">Ne plus me la poser</button>
			<button class="btn small" onclick={flag} title="Question fausse, ambiguë ou mal formulée">Signaler</button>
			<a class="btn small" href="/">Quitter</a>
		</div>
	</div>
	<div class="prog" aria-hidden="true"><div style="width:{pct}%"></div></div>

	{#each view.notices as n}
		<p class="msg warn" role="status">{n}</p>
	{/each}

	<div class="tags">
		<span class="note">{q.courseName}{q.chapterName && !['Général', 'Questions de l’artefact'].includes(q.chapterName) ? ` · ${q.chapterName}` : ''}</span>
		{#if q.attempts > 0}<span class="pill warn">On la repasse</span>{/if}
		{#if q.needed > 1}<span class="pill warn">À réussir 2 fois ({q.streak}/2)</span>{/if}
		{#if q.origin === 'renfort'}<span class="pill">Renforcement</span>{/if}
		{#if q.origin === 'concept'}<span class="pill">Même concept</span>{/if}
	</div>

	{#key `${q.id}-${q.attempts}`}
		<QuestionInput payload={q.payload} prompt={q.prompt} {result} {submitted} {onsubmit} onadjust={adjust} />
	{/key}

	{#if result}
		<div class="fb {finalCorrect ? 'ok' : 'ko'}" role="status">
			<strong>
				{#if adjusted && devScore}
					{devScore.got} / {devScore.total} points après ton ajustement{result.correct ? ' : réussie.' : '.'}
				{:else if result.correct}
					Bonne réponse.
				{:else if override}
					Comptée comme bonne.
				{:else if devScore}
					{devScore.got} / {devScore.total} points : il faut {Math.round(DEVELOPPEMENT_SEUIL * 100)} % pour la réussir.
				{:else if result.score > 0}
					Presque : {Math.round(result.score * 100)} % de bon.
				{:else}
					Pas tout à fait.
				{/if}
			</strong>
			{#if !result.correct && !['qcm', 'vrai_faux', 'qcm_multi', 'trous', 'ordre', 'association'].includes(q.payload.type)}
				<p>
					<span class="note">{q.payload.type === 'developpement' ? 'Réponse modèle :' : 'Réponse attendue :'}</span>
					{correctAnswerText(q.payload)}
				</p>
			{/if}
			{#if q.payload.type === 'developpement' && result.correct}
				<p><span class="note">Réponse modèle :</span> {q.payload.reponse_modele}</p>
			{/if}
			{#if q.explanation}<p>{q.explanation}</p>{/if}
			{#if (q.source && q.source !== 'artefact quiz-cégep') || q.slide}
				<p class="note">Source : {q.source ?? q.chapterName}{q.slide ? `, diapo ${q.slide}` : ''}</p>
			{/if}
			<div class="row tools">
				{#if canOverride}
					<button class="btn small" aria-pressed={override} onclick={() => (override = !override)}>
						{override ? '✔ ' : ''}J’avais raison
					</button>
				{/if}
				<button class="btn small" onclick={askClaude}>{copied ? 'Message copié ✔' : 'Demander à Claude'}</button>
				<a class="btn small" href="/questions/{q.id}" target="_blank" rel="noopener">Modifier</a>
			</div>
		</div>

		{#if errorMsg}<p class="msg ko">{errorMsg}</p>{/if}

		{#if view.askConfidence}
			<p class="conf-label">Avant de continuer : à quel point étais-tu sûr?</p>
			<div class="conf">
				<button class="btn" disabled={busy} onclick={() => send('sur')}><span class="key">1</span>Sûr</button>
				<button class="btn" disabled={busy} onclick={() => send('hesitant')}><span class="key">2</span>Hésitant</button>
				<button class="btn" disabled={busy} onclick={() => send('devine')}><span class="key">3</span>Deviné</button>
			</div>
		{:else}
			<button class="go next" disabled={busy} onclick={() => send('non')}>Suivante <span class="hint">(Entrée)</span></button>
		{/if}
	{/if}
{:else if view.review}
	{@const total = view.review.length}
	{@const ok = view.review.filter((r) => r.ok).length}
	<h1>Examen terminé</h1>
	<p class="sub">{view.exam?.title}</p>
	<div class="panel">
		<div class="score">{total ? Math.round((ok / total) * 100) : 0} %</div>
		<p class="note">
			{ok} bonne{ok > 1 ? 's' : ''} réponse{ok > 1 ? 's' : ''} sur {total}{view.progress.unanswered ? ` · ${view.progress.unanswered} non répondue(s)` : ''}.
			Les questions ratées reviendront plus tôt dans tes révisions.
		</p>
	</div>
	<div class="panel">
		<h2>Corrigé</h2>
		{#each view.review as r, i}
			<div class="miss">
				<p class="note">Question {i + 1} · {r.course}</p>
				<p>
					<span class={r.ok ? 'good' : r.ok === null ? 'note' : 'bad'}>{r.ok ? '✔' : r.ok === null ? '— non répondue :' : '✘'}</span>
					{r.prompt}
				</p>
				{#if !r.ok}<p class="good"><strong>{correctAnswerText(r.payload)}</strong></p>{/if}
				{#if !r.ok && r.explanation}<p class="note">{r.explanation}</p>{/if}
			</div>
		{/each}
	</div>
	<button class="go" onclick={() => goto('/examens')}>Retour aux examens</button>
{:else}
	<h1>Série terminée</h1>
	{@const p = view.progress}
	<p class="sub">
		{#if p.firstTryOk === p.firstTryCount}
			Aucune erreur. Ces questions reviendront plus tard pour s’ancrer.
		{:else}
			Toutes les questions sont réglées. Celles que tu as ratées reviendront plus tôt.
		{/if}
	</p>
	<div class="panel">
		<div class="score">{p.firstTryOk} / {p.firstTryCount}</div>
		<p class="note">
			{p.firstTryCount ? Math.round((p.firstTryOk / p.firstTryCount) * 100) : 0} % de réussite du premier coup
		</p>
	</div>
	{#if view.missed?.length}
		<div class="panel">
			<h2>À retenir</h2>
			{#each view.missed as m}
				<div class="miss">
					<p class="note">{m.course}</p>
					<p>{m.prompt}</p>
					<p class="good"><strong>{correctAnswerText(m.payload)}</strong></p>
					{#if m.explanation}<p class="note">{m.explanation}</p>{/if}
				</div>
			{/each}
		</div>
	{/if}
	<button class="go" onclick={() => goto('/')}>Retour à l’accueil</button>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
	}
	.prog {
		height: 8px;
		background: var(--line);
		border-radius: 6px;
		overflow: hidden;
		margin-bottom: 16px;
	}
	.prog div {
		height: 100%;
		background: var(--accent);
		transition: width 0.25s;
	}
	.tags {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.fb {
		margin-top: 16px;
		border-radius: var(--radius);
		padding: 14px 16px;
	}
	.fb.ok {
		background: var(--good-bg);
	}
	.fb.ko {
		background: var(--bad-bg);
	}
	.fb p {
		margin: 6px 0 0;
	}
	.tools {
		margin-top: 10px;
	}
	.tools .btn[aria-pressed='true'] {
		border-color: var(--good);
		color: var(--good);
		font-weight: 700;
	}
	.conf-label {
		margin: 18px 0 8px;
		font-weight: 700;
	}
	.conf {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.conf .btn {
		min-height: 54px;
		font-weight: 700;
	}
	.key {
		display: inline-grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 6px;
		background: var(--bg);
		color: var(--muted);
		font-size: 0.8rem;
	}
	.next {
		margin-top: 14px;
	}
	.next .hint {
		font-weight: 400;
		opacity: 0.75;
		font-size: 0.9rem;
	}
	.score {
		font-family: 'Bricolage Grotesque', system-ui, sans-serif;
		font-size: 3.4rem;
		font-weight: 800;
		line-height: 1;
	}
	.miss {
		padding: 12px 0;
		border-top: 1px solid var(--line);
	}
	.miss:first-of-type {
		border-top: 0;
	}
	.miss p {
		margin: 2px 0;
	}
</style>
