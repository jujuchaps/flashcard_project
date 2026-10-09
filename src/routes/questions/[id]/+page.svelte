<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const confidence: Record<string, string> = { sur: 'sûr', hesitant: 'hésitant', devine: 'deviné' };
</script>

<svelte:head><title>Modifier une question · Étude</title></svelte:head>

<p><a href="/cours/{data.question.courseId}/chapitres/{data.question.chapterId}">← {data.question.courseName} · {data.chapters.find((c) => c.id === data.question.chapterId)?.name}</a></p>
<h1>Modifier la question</h1>
<p class="sub">Même format que les fichiers produits par Claude (voir le fichier d’instructions). L’app vérifie tout avant d’enregistrer.</p>

{#if data.question.flagged}
	<p class="msg warn">Question signalée{data.question.flagNote ? ` : « ${data.question.flagNote} »` : ''}.</p>
{/if}
{#if form?.ok}<p class="msg ok" role="status">{form.ok}</p>{/if}
{#if form?.error}<p class="msg ko" role="alert">{form.error}</p>{/if}

<form method="POST" action="?/enregistrer" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<section class="panel">
		<label class="field">
			<span>Question (JSON)</span>
			<textarea name="json" rows="18" spellcheck="false" class="code">{form?.json ?? data.json}</textarea>
		</label>
		<label class="field">
			<span>Chapitre</span>
			<select name="chapterId" value={data.question.chapterId}>
				{#each data.chapters as ch}<option value={ch.id}>{ch.name}</option>{/each}
			</select>
		</label>
		<label class="check"><input type="checkbox" name="reset" /> Remettre ma progression à zéro (si la bonne réponse a changé)</label>
		{#if data.question.flagged}
			<label class="check"><input type="checkbox" name="unflag" checked /> Remettre la question dans les quiz</label>
		{/if}
	</section>
	<button class="go">Enregistrer</button>
</form>

{#if data.attempts.length}
	<section class="panel" style="margin-top:16px">
		<h2>Historique</h2>
		<ul class="hist">
			{#each data.attempts as a}
				<li>
					<span class={a.correct ? 'good' : 'bad'}>{a.correct ? '✔' : '✘'}</span>
					{new Date(a.at).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}
					<span class="note">
						{a.first_try ? '1er essai' : 'reprise'}{a.confidence ? ` · ${confidence[a.confidence] ?? a.confidence}` : ''}{a.overridden ? ' · corrigée à la main' : ''}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<form
	method="POST"
	action="?/supprimer"
	use:enhance={({ cancel }) => {
		if (!confirm('Supprimer définitivement cette question et sa progression?')) cancel();
	}}
	style="margin-top:16px"
>
	<button class="btn danger">Supprimer la question</button>
</form>

<style>
	.code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.85rem;
		line-height: 1.45;
	}
	.check {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-top: 8px;
	}
	.hist {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.hist li {
		padding: 4px 0;
		border-bottom: 1px solid var(--line);
	}
</style>
