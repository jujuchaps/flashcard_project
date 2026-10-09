import { error, json } from '@sveltejs/kit';
import { answerSeries, type AnswerInput } from '$lib/server/study';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json()) as AnswerInput;
	if (!body || typeof body.questionId !== 'number' || !body.answer || typeof body.answer !== 'object')
		error(400, 'Réponse invalide.');
	try {
		return json(await answerSeries(Number(params.id), body));
	} catch (e) {
		error(409, (e as Error).message);
	}
};
