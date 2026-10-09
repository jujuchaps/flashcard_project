<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let busy = $state(false);

	const submitting = () => {
		busy = true;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = false;
		};
	};

	const lots = $derived(form && 'lots' in form ? form.lots : null);
	const importable = $derived(lots ? lots.reduce((s, l) => s + l.count, 0) : 0);
</script>

<svelte:head><title>Importer · Étude</title></svelte:head>

<h1>Importer des questions</h1>
<p class="sub">Du PowerPoint au quiz : Claude prépare le fichier, l’app l’importe et corrige tout elle-même.</p>

<section class="panel steps">
	<h2>Comment faire</h2>
	<ol>
		<li><a href="/instructions.md" download>Télécharge le fichier d’instructions</a> (GENERATEUR_QUESTIONS.md).</li>
		<li>Dans Claude, joins ce fichier <strong>et</strong> ton PowerPoint ou PDF, puis écris par exemple : <em>« Suis les instructions du fichier. Cours : Philosophie (code philo). Chapitre : Les présocratiques. »</em></li>
		<li>Dépose ici le fichier <code>.json</code> que Claude te donne, ou colle son contenu.</li>
	</ol>
	{#if data.courses.length}
		<details>
			<summary>Codes de tes cours actuels</summary>
			<p class="note">Donne le même code à Claude pour que les questions s’ajoutent au bon cours.</p>
			<ul class="codes">
				{#each data.courses as c}<li><code>{c.code}</code> {c.name}</li>{/each}
			</ul>
		</details>
	{/if}
</section>

{#if form?.step === 'done' && 'summary' in form && form.summary}
	<p class="msg ok" role="status">
		<strong>Import terminé.</strong>
		{form.summary.added} ajoutée{form.summary.added > 1 ? 's' : ''},
		{form.summary.updated} mise{form.summary.updated > 1 ? 's' : ''} à jour,
		{form.summary.unchanged} déjà présente{form.summary.unchanged > 1 ? 's' : ''}{form.summary.duplicates ? `, ${form.summary.duplicates} doublon(s) ignoré(s)` : ''}
		· {form.summary.courses.join(', ')}.
		<a href="/">Commencer à étudier →</a>
	</p>
{/if}

<section class="panel">
	<h2>1. Le fichier</h2>
	<form method="POST" action="?/analyser" enctype="multipart/form-data" use:enhance={submitting}>
		<label class="field">
			<span>Fichier .json</span>
			<input type="file" name="file" accept=".json,application/json,text/plain" />
		</label>
		<label class="field">
			<span>… ou colle le texte</span>
			<textarea name="text" rows="8" placeholder={'{ "format": "quiz-etude/v2", "cours": { … }, "questions": [ … ] }'}>{form && 'text' in form ? form.text : ''}</textarea>
		</label>
		<button class="btn primary" disabled={busy}>Analyser</button>
	</form>
	{#if form?.step === 'analyse' && 'error' in form && form.error}
		<p class="msg ko" role="alert" style="margin-top:12px">{form.error}</p>
	{/if}
</section>

{#if lots}
	<section class="panel">
		<h2>2. Aperçu</h2>
		{#each lots as l}
			<div class="lot">
				<p><strong>{l.course}</strong> <code>{l.code}</code> · {l.chapter}{l.source ? ` (${l.source})` : ''}</p>
				<p class="note">
					{l.count} question{l.count > 1 ? 's' : ''} valide{l.count > 1 ? 's' : ''}{l.concepts ? `, ${l.concepts} concepts` : ''} :
					{Object.entries(l.byType).map(([t, n]) => `${t} ${n}`).join(' · ')}
				</p>
				{#if l.errorCount}
					<div class="msg ko">
						<strong>{l.errorCount} question{l.errorCount > 1 ? 's' : ''} rejetée{l.errorCount > 1 ? 's' : ''} :</strong>
						<ul>
							{#each l.errors as e}<li>{e.index >= 0 ? `Question n° ${e.index + 1} : ` : ''}{e.message}</li>{/each}
						</ul>
						{#if l.errorCount > l.errors.length}<p class="note">… et {l.errorCount - l.errors.length} autre(s).</p>{/if}
						<p class="note">Tu peux importer les questions valides, puis demander à Claude de corriger les autres.</p>
					</div>
				{/if}
			</div>
		{/each}

		<form method="POST" action="?/importer" use:enhance={submitting}>
			<input type="hidden" name="text" value={form && 'text' in form ? form.text : ''} />
			{#if lots.length === 1}
				<div class="grid">
					<label class="field">
						<span>Cours</span>
						<select name="courseId">
							<option value="">Selon le fichier ({lots[0].course})</option>
							{#each data.courses as c}<option value={c.id}>{c.name}</option>{/each}
						</select>
					</label>
					<label class="field">
						<span>Chapitre</span>
						<input type="text" name="chapterName" placeholder={lots[0].chapter} />
					</label>
				</div>
			{/if}
			<button class="go" disabled={busy || importable === 0}>Importer {importable} question{importable > 1 ? 's' : ''}</button>
		</form>
		<p class="note">Une question déjà présente (même énoncé) est mise à jour sans perdre ta progression.</p>
	</section>
{/if}

<section class="panel">
	<h2>Récupérer ma progression de l’artefact</h2>
	<p class="note">
		Dans l’artefact, ouvre « Sauvegarder ou restaurer ma progression », clique sur <strong>Créer mon code</strong>,
		puis colle ici le texte qui commence par <code>QC1:</code>. Tes questions ajoutées à la main dans l’artefact sont aussi récupérées.
	</p>
	<form method="POST" action="?/restaurer" use:enhance={submitting}>
		<textarea name="code" rows="3" placeholder="QC1:…" aria-label="Code de sauvegarde"></textarea>
		<button class="btn primary" disabled={busy} style="margin-top:8px">Restaurer</button>
	</form>
	{#if form?.step === 'restore'}
		{#if 'restoreError' in form && form.restoreError}
			<p class="msg ko" style="margin-top:12px">{form.restoreError}</p>
		{:else if 'restore' in form && form.restore}
			<p class="msg ok" style="margin-top:12px">
				Progression restaurée pour <strong>{form.restore.restored}</strong> question{form.restore.restored > 1 ? 's' : ''}.
				{#if form.restore.customAdded}{form.restore.customAdded} question(s) ajoutée(s) depuis l’artefact.{/if}
				{#if form.restore.alreadyTracked}{form.restore.alreadyTracked} déjà suivie(s) ici (conservées).{/if}
				{#if form.restore.unknown}{form.restore.unknown} introuvable(s).{/if}
			</p>
		{/if}
	{/if}
</section>

<style>
	.steps ol {
		margin: 0;
		padding-left: 20px;
	}
	.steps li {
		margin-bottom: 6px;
	}
	.codes {
		columns: 2;
		padding-left: 18px;
		font-size: 0.92rem;
	}
	.lot {
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}
	.lot:first-of-type {
		border-top: 0;
	}
	.lot p {
		margin: 2px 0;
	}
	.lot ul {
		margin: 6px 0;
		padding-left: 18px;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-top: 12px;
	}
	code {
		background: var(--bg);
		border-radius: 6px;
		padding: 1px 6px;
		font-size: 0.88em;
	}
	@media (max-width: 520px) {
		.grid,
		.codes {
			grid-template-columns: 1fr;
			columns: 1;
		}
	}
</style>
