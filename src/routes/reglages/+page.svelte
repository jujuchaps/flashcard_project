<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let retention = $state(untrack(() => Math.round(data.retention * 100)));
</script>

<svelte:head><title>Réglages · Étude</title></svelte:head>

<h1>Réglages</h1>
<p class="sub">Ajuste le rythme d’étude à ton horaire.</p>

{#if form?.ok}<p class="msg ok" role="status">Réglages enregistrés.</p>{/if}
{#if form?.error}<p class="msg ko" role="alert">{form.error}</p>{/if}

<form method="POST" use:enhance={() => async ({ update }) => update({ reset: false })}>
	<section class="panel">
		<label class="field">
			<span>Nom de la session</span>
			<input type="text" name="sessionName" value={data.sessionName} />
		</label>
		<label class="field">
			<span>Taille de la révision du jour</span>
			<input type="number" name="reviewSize" min="5" max="200" value={data.reviewSize} />
			<small class="note">Nombre maximum de questions dans une série de révision.</small>
		</label>
		<label class="field">
			<span>Nouvelles questions par série de révision</span>
			<input type="number" name="newPerSeries" min="0" max="100" value={data.newPerSeries} />
			<small class="note">Plus il y en a, plus tu avances vite, mais plus les révisions des jours suivants seront nombreuses.</small>
		</label>
		<label class="field">
			<span>Rétention visée : {retention} %</span>
			<input type="range" name="retention" min="80" max="97" bind:value={retention} />
			<small class="note">
				Probabilité de te souvenir d’une question au moment où elle revient. Plus c’est haut, plus les révisions sont
				fréquentes. 90 % est un bon équilibre.
			</small>
		</label>
		<label class="check">
			<input type="checkbox" name="askConfidence" checked={data.askConfidence} />
			Me demander mon niveau de confiance après chaque réponse (recommandé)
		</label>
	</section>
	<button class="go">Enregistrer</button>
</form>

<section class="panel" style="margin-top:16px">
	<h2>Sauvegarde</h2>
	<p class="note">Télécharge toutes tes données (questions, progression, historique) dans un fichier JSON.</p>
	<a class="btn" href="/api/export" download>Télécharger une sauvegarde</a>
</section>

<style>
	input[type='range'] {
		width: 100%;
	}
	.check {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}
	.check input {
		margin-top: 5px;
		width: 18px;
		height: 18px;
	}
	small {
		display: block;
		margin-top: 4px;
	}
</style>
