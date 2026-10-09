import type { ServerInit } from '@sveltejs/kit';
import { migrate } from '$lib/server/db';
import { seedIfEmpty } from '$lib/server/importer';

export const init: ServerInit = async () => {
	await migrate();
	await seedIfEmpty();
};
