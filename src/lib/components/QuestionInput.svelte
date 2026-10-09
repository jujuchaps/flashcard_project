<script lang="ts">
	import { untrack } from 'svelte';
	import { normalize, parseTrous } from '$lib/grading';
	import type { Answer, GradeResult, Payload } from '$lib/types';

	let {
		payload,
		prompt,
		result,
		submitted,
		onsubmit,
		onadjust
	}: {
		payload: Payload;
		prompt: string;
		result: GradeResult | null;
		submitted: Answer | null;
		onsubmit: (a: Answer) => void;
		onadjust?: (index: number) => void;
	} = $props();

	function shuffled(n: number): number[] {
		const a = Array.from({ length: n }, (_, i) => i);
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	/** Mélange sans jamais laisser l'ordre initial (pour la mise en ordre). */
	function derange(n: number): number[] {
		if (n < 2) return shuffled(n);
		let a = shuffled(n);
		while (a.every((v, i) => v === i)) a = shuffled(n);
		return a;
	}

	const locked = $derived(result !== null);

	// États locaux, figés à la création : le parent recrée le composant à chaque question.
	const init = untrack(() => {
		const p = payload;
		const segs = p.type === 'trous' ? parseTrous(p.texte) : [];
		return {
			choiceOrder: 'choix' in p ? shuffled(p.choix.length) : [],
			segments: segs,
			blanks: segs.filter((s) => typeof s !== 'string').length,
			rightOrder: p.type === 'association' ? shuffled(p.paires.length) : [],
			pairCount: p.type === 'association' ? p.paires.length : 0,
			order: p.type === 'ordre' ? derange(p.elements.length) : []
		};
	});
	const { choiceOrder, segments, rightOrder } = init;
	let multi = $state<number[]>([]);
	let text = $state('');
	let blankValues = $state<string[]>(Array(init.blanks).fill(''));
	let pairs = $state<number[]>(Array(init.pairCount).fill(-1));
	let order = $state<number[]>(init.order);

	const canSubmit = $derived.by(() => {
		switch (payload.type) {
			case 'qcm_multi':
				return multi.length > 0;
			case 'courte':
			case 'numerique':
			case 'developpement':
				return text.trim().length > 0;
			case 'trous':
				return blankValues.some((v) => v.trim());
			case 'association':
				return pairs.every((p) => p >= 0);
			default:
				return true;
		}
	});

	function submit() {
		if (locked || !canSubmit) return;
		switch (payload.type) {
			case 'qcm_multi':
				return onsubmit({ type: 'qcm_multi', choix: [...multi].sort() });
			case 'courte':
				return onsubmit({ type: 'courte', texte: text });
			case 'numerique':
				return onsubmit({ type: 'numerique', texte: text });
			case 'developpement':
				return onsubmit({ type: 'developpement', texte: text });
			case 'trous':
				return onsubmit({ type: 'trous', textes: [...blankValues] });
			case 'association':
				return onsubmit({ type: 'association', droite: [...pairs] });
			case 'ordre':
				return onsubmit({ type: 'ordre', ordre: [...order] });
		}
	}

	function move(i: number, d: number) {
		const j = i + d;
		if (locked || j < 0 || j >= order.length) return;
		const next = [...order];
		[next[i], next[j]] = [next[j], next[i]];
		order = next;
	}

	function onkey(e: KeyboardEvent) {
		if (locked || e.ctrlKey || e.metaKey || e.altKey) return;
		const t = e.target as HTMLElement;
		if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
		const n = Number(e.key);
		if (payload.type === 'qcm' && n >= 1 && n <= choiceOrder.length) {
			e.preventDefault();
			onsubmit({ type: 'qcm', choix: choiceOrder[n - 1] });
		} else if (payload.type === 'vrai_faux' && ['1', '2', 'v', 'f'].includes(e.key.toLowerCase())) {
			e.preventDefault();
			onsubmit({ type: 'vrai_faux', valeur: e.key === '1' || e.key.toLowerCase() === 'v' });
		} else if (payload.type === 'qcm_multi' && n >= 1 && n <= choiceOrder.length) {
			e.preventDefault();
			const i = choiceOrder[n - 1];
			multi = multi.includes(i) ? multi.filter((x) => x !== i) : [...multi, i];
		}
	}

	function enterSubmits(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

	function ctrlEnterSubmits(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			submit();
		}
	}

	function choiceClass(i: number): string {
		if (!result || !submitted) return '';
		if (payload.type === 'qcm' && submitted.type === 'qcm') {
			if (i === payload.reponse) return 'ok';
			if (i === submitted.choix) return 'ko';
		}
		if (payload.type === 'qcm_multi' && submitted.type === 'qcm_multi') {
			const good = payload.reponses.includes(i);
			const chosen = submitted.choix.includes(i);
			if (good) return chosen ? 'ok' : 'missed';
			if (chosen) return 'ko';
		}
		return '';
	}

	function vfClass(v: boolean): string {
		if (!result || !submitted || payload.type !== 'vrai_faux' || submitted.type !== 'vrai_faux') return '';
		if (v === payload.reponse) return 'ok';
		if (v === submitted.valeur) return 'ko';
		return '';
	}

	let root = $state<HTMLElement | null>(null);
	$effect(() => {
		root?.querySelector<HTMLElement>('input[type="text"], textarea')?.focus();
	});

	const words = $derived(normalize(text).split(' ').filter(Boolean).length);
</script>

<svelte:window onkeydown={onkey} />

<div bind:this={root}>
{#if payload.type !== 'trous'}
	<h2 class="question">{prompt}</h2>
{:else if prompt.includes('\n')}
	<h2 class="question">{prompt.split('\n')[0]}</h2>
{/if}

{#if payload.type === 'qcm'}
	<div class="opts">
		{#each choiceOrder as i, k}
			<button class="opt {choiceClass(i)}" disabled={locked} onclick={() => onsubmit({ type: 'qcm', choix: i })}>
				<span class="key">{k + 1}</span>{payload.choix[i]}
			</button>
		{/each}
	</div>
{:else if payload.type === 'qcm_multi'}
	<p class="hint">Plusieurs réponses possibles.</p>
	<div class="opts">
		{#each choiceOrder as i, k}
			<label class="opt check {choiceClass(i)}" class:sel={multi.includes(i)}>
				<input type="checkbox" value={i} bind:group={multi} disabled={locked} />
				<span class="key">{k + 1}</span>{payload.choix[i]}
			</label>
		{/each}
	</div>
{:else if payload.type === 'vrai_faux'}
	<div class="opts two">
		<button class="opt {vfClass(true)}" disabled={locked} onclick={() => onsubmit({ type: 'vrai_faux', valeur: true })}>
			<span class="key">V</span>Vrai
		</button>
		<button class="opt {vfClass(false)}" disabled={locked} onclick={() => onsubmit({ type: 'vrai_faux', valeur: false })}>
			<span class="key">F</span>Faux
		</button>
	</div>
{:else if payload.type === 'courte'}
	<input
		class="answer {result ? (result.correct ? 'ok' : 'ko') : ''}"
		type="text"
		bind:value={text}
		disabled={locked}
		onkeydown={enterSubmits}
		placeholder="Ta réponse"
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		aria-label="Ta réponse"
	/>
{:else if payload.type === 'numerique'}
	<div class="row num">
		<input
				class="answer {result ? (result.correct ? 'ok' : 'ko') : ''}"
			type="text"
			inputmode="decimal"
			bind:value={text}
			disabled={locked}
			onkeydown={enterSubmits}
			placeholder="Nombre"
			autocomplete="off"
			aria-label="Ta réponse (nombre)"
		/>
		{#if payload.unite}<span class="unit">{payload.unite}</span>{/if}
	</div>
{:else if payload.type === 'trous'}
	<p class="trous">
		{#each segments as seg, i}
			{#if typeof seg === 'string'}
				{seg}
			{:else}
				{@const b = segments.slice(0, i).filter((s) => typeof s !== 'string').length}
				<input
					class="blank {result?.details ? (result.details[b] ? 'ok' : 'ko') : ''}"
					type="text"
					bind:value={blankValues[b]}
					disabled={locked}
					onkeydown={enterSubmits}
					size={Math.max(6, Math.min(22, seg.answers[0].length + 2))}
					autocomplete="off"
					spellcheck="false"
					aria-label="Trou {b + 1}"
				/>{#if result?.details && !result.details[b]}<span class="expected">({seg.answers[0]})</span>{/if}
			{/if}
		{/each}
	</p>
{:else if payload.type === 'association'}
	<div class="assoc">
		{#each payload.paires as [left], i}
			<div class="assoc-row {result?.details ? (result.details[i] ? 'ok' : 'ko') : ''}">
				<span class="left">{left}</span>
				<select bind:value={pairs[i]} disabled={locked} aria-label="Associer « {left} »">
					<option value={-1} disabled>Choisir…</option>
					{#each rightOrder as r}
						<option value={r}>{payload.paires[r][1]}</option>
					{/each}
				</select>
				{#if result?.details && !result.details[i]}
					<span class="expected">→ {payload.paires[i][1]}</span>
				{/if}
			</div>
		{/each}
	</div>
{:else if payload.type === 'ordre'}
	<p class="hint">Utilise les flèches pour placer les éléments dans le bon ordre (du premier au dernier).</p>
	<ol class="order">
		{#each order as el, i (el)}
			<li class={result?.details ? (result.details[i] ? 'ok' : 'ko') : ''}>
				<span class="txt">{payload.elements[el]}</span>
				{#if !locked}
					<span class="arrows">
						<button class="btn small" onclick={() => move(i, -1)} disabled={i === 0} aria-label="Monter « {payload.elements[el]} »">↑</button>
						<button class="btn small" onclick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Descendre « {payload.elements[el]} »">↓</button>
					</span>
				{/if}
			</li>
		{/each}
	</ol>
	{#if result && !result.correct}
		<p class="note"><strong>Bon ordre :</strong> {payload.elements.join(' → ')}</p>
	{/if}
{:else if payload.type === 'developpement'}
	<textarea
		bind:value={text}
		disabled={locked}
		onkeydown={ctrlEnterSubmits}
		placeholder="Rédige ta réponse en quelques phrases…"
		aria-label="Ta réponse"
		rows="7"
	></textarea>
	{#if !locked}<p class="note">{words} mot{words > 1 ? 's' : ''} · Ctrl + Entrée pour valider</p>{/if}
	{#if result && result.details}
		<div class="elements">
			{#each payload.elements as el, i}
				<button
					type="button"
					class="element {result.details[i] ? 'good' : 'bad'}"
					aria-pressed={result.details[i]}
					disabled={!onadjust}
					onclick={() => onadjust?.(i)}
					title="Clique pour corriger : j'avais (ou je n'avais pas) cette idée"
				>
					{result.details[i] ? '✔' : '✘'} {el.idee} <span class="note">({el.points} pt{el.points > 1 ? 's' : ''})</span>
				</button>
			{/each}
			{#if onadjust}<p class="note">Clique sur un élément si la correction automatique s’est trompée.</p>{/if}
		</div>
	{/if}
{/if}

{#if !locked && !['qcm', 'vrai_faux'].includes(payload.type)}
	<button class="go validate" disabled={!canSubmit} onclick={submit}>Valider</button>
{/if}
</div>

<style>
	.question {
		font-size: 1.4rem;
		font-weight: 800;
		margin: 6px 0 18px;
		white-space: pre-line;
	}
	.hint {
		color: var(--muted);
		margin: -8px 0 12px;
	}
	.opts {
		display: grid;
		gap: 10px;
	}
	.opts.two {
		grid-template-columns: 1fr 1fr;
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 12px;
		text-align: left;
		border: 2px solid var(--line);
		background: var(--surface);
		border-radius: var(--radius);
		padding: 12px 16px;
		min-height: 54px;
		cursor: pointer;
	}
	.opt:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.opt:disabled {
		cursor: default;
	}
	.opt.sel {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.opt input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.opt.ok {
		border-color: var(--good);
		background: var(--good-bg);
	}
	.opt.ko {
		border-color: var(--bad);
		background: var(--bad-bg);
	}
	.opt.missed {
		border-color: var(--good);
		border-style: dashed;
	}
	.key {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 7px;
		background: var(--bg);
		color: var(--muted);
		font-size: 0.85rem;
		font-weight: 700;
	}
	.answer {
		font-size: 1.2rem;
		min-height: 54px;
		border-width: 2px;
	}
	.num .answer {
		flex: 1;
	}
	.unit {
		font-weight: 700;
		font-size: 1.2rem;
	}
	.ok.answer,
	.blank.ok {
		border-color: var(--good);
		background: var(--good-bg);
	}
	.ko.answer,
	.blank.ko {
		border-color: var(--bad);
		background: var(--bad-bg);
	}
	.trous {
		font-size: 1.25rem;
		line-height: 2.2;
		margin: 6px 0 12px;
	}
	.blank {
		width: auto;
		min-height: 38px;
		padding: 4px 8px;
		border: 2px solid var(--line);
		border-radius: 8px;
		background: var(--surface);
		font-size: 1.1rem;
	}
	.expected {
		color: var(--good);
		font-weight: 700;
		margin-left: 4px;
	}
	.assoc {
		display: grid;
		gap: 10px;
	}
	.assoc-row {
		display: grid;
		grid-template-columns: 1fr 1.2fr;
		gap: 10px;
		align-items: center;
		background: var(--surface);
		border: 2px solid var(--line);
		border-radius: var(--radius);
		padding: 10px 12px;
	}
	.assoc-row .expected {
		grid-column: 1 / -1;
		margin: 0;
	}
	.assoc-row.ok {
		border-color: var(--good);
	}
	.assoc-row.ko {
		border-color: var(--bad);
	}
	.left {
		font-weight: 700;
	}
	.order {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 8px;
		counter-reset: o;
	}
	.order li {
		counter-increment: o;
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--surface);
		border: 2px solid var(--line);
		border-radius: var(--radius);
		padding: 8px 12px;
	}
	.order li::before {
		content: counter(o);
		font-weight: 800;
		color: var(--muted);
		width: 20px;
	}
	.order li.ok {
		border-color: var(--good);
	}
	.order li.ko {
		border-color: var(--bad);
	}
	.txt {
		flex: 1;
	}
	.arrows {
		display: flex;
		gap: 4px;
	}
	.elements {
		margin-top: 12px;
	}
	.elements .element {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: 1px dashed transparent;
		border-radius: 8px;
		padding: 4px 6px;
		margin: 2px 0;
	}
	.elements .element:hover:not(:disabled) {
		border-color: var(--line);
	}
	.elements .good {
		color: var(--good);
	}
	.elements .bad {
		color: var(--bad);
	}
	.validate {
		margin-top: 16px;
	}
	@media (max-width: 520px) {
		.assoc-row {
			grid-template-columns: 1fr;
		}
	}
</style>
