import { error, json } from '@sveltejs/kit';
import { finishSeries } from '$lib/server/study';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	const view = await finishSeries(Number(params.id));
	if (!view) error(404, 'Série introuvable.');
	return json(view);
};
