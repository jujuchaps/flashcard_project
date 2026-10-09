import { error } from '@sveltejs/kit';
import { getSeries } from '$lib/server/study';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const view = await getSeries(Number(params.id));
	if (!view) error(404, 'Série introuvable.');
	return { view };
};
