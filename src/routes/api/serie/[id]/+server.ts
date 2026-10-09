import { error, json } from '@sveltejs/kit';
import { getSeries } from '$lib/server/study';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const view = await getSeries(Number(params.id));
	if (!view) error(404, 'Série introuvable.');
	return json(view);
};
