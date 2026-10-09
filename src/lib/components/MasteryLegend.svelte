<script lang="ts">
	const items = [
		['--m-anchored', 'Ancrée'],
		['--m-mastered', 'Maîtrisée'],
		['--m-learning', 'En apprentissage'],
		['--m-fragile', 'À retravailler'],
		['--m-new', 'Nouvelle']
	];
</script>

<div class="legend">
	{#each items as [color, label]}
		<span><span class="dot" style="background:var({color})"></span>{label}</span>
	{/each}
</div>

<style>
	.legend {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
		color: var(--muted);
		font-size: 0.88rem;
		margin-top: 10px;
	}
	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-right: 5px;
	}
</style>
