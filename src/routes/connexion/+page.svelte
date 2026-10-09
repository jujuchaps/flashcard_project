<script lang="ts">
	let { form } = $props();
</script>

<svelte:head><title>Connexion · Étude</title></svelte:head>

<div class="box">
	<h1>Étude</h1>
	<p class="sub">Entre le mot de passe de l’application.</p>
	{#if form?.error}<p class="msg ko" role="alert">{form.error}</p>{/if}
	<form method="POST" class="panel">
		<label class="field">
			<span>Mot de passe</span>
			<input type="password" name="password" autocomplete="current-password" required />
		</label>
		<button class="go">Se connecter</button>
	</form>
</div>

<style>
	.box {
		max-width: 380px;
		margin: 10vh auto 0;
	}
</style>
