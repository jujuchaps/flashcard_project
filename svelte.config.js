import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// La vérification d'origine est faite dans src/hooks.server.ts : elle compare l'hôte sans
		// tenir compte du protocole, pour fonctionner en http sur le réseau local (téléphone).
		csrf: { trustedOrigins: ['*'] }
	}
};

export default config;
