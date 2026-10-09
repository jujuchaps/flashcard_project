<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const links = [
		{ href: '/', label: 'Accueil' },
		{ href: '/cours', label: 'Cours' },
		{ href: '/importer', label: 'Importer' },
		{ href: '/reglages', label: 'Réglages' }
	];

	const inQuiz = $derived(page.url.pathname.startsWith('/serie/'));
</script>

{#if !inQuiz}
	<nav aria-label="Navigation principale">
		<div class="inner">
			<a class="brand" href="/">Étude</a>
			<div class="links">
				{#each links as l}
					<a
						href={l.href}
						aria-current={(l.href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(l.href))
							? 'page'
							: undefined}>{l.label}</a
					>
				{/each}
			</div>
		</div>
	</nav>
{/if}

<main class:quiz={inQuiz}>
	{@render children()}
</main>

<style>
	nav {
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}
	.inner {
		max-width: 760px;
		margin: 0 auto;
		padding: 0 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 56px;
		flex-wrap: wrap;
	}
	.brand {
		font-family: 'Bricolage Grotesque', system-ui, sans-serif;
		font-weight: 800;
		font-size: 1.3rem;
		color: var(--ink);
		text-decoration: none;
	}
	.links {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.links a {
		color: var(--muted);
		text-decoration: none;
		padding: 8px 10px;
		border-radius: 8px;
	}
	.links a[aria-current='page'] {
		color: var(--ink);
		background: var(--bg);
		font-weight: 700;
	}
	main {
		max-width: 760px;
		margin: 0 auto;
		padding: 24px 16px 64px;
	}
	main.quiz {
		max-width: 680px;
		padding-top: 16px;
	}
</style>
