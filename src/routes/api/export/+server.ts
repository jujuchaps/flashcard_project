import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

/** Sauvegarde complète en JSON : structure, questions, progression et historique. */
export const GET: RequestHandler = async () => {
	const [sessions, courses, chapters, questions, cards, attempts, settings] = await Promise.all([
		sql`SELECT * FROM study_session ORDER BY id`,
		sql`SELECT * FROM course ORDER BY id`,
		sql`SELECT * FROM chapter ORDER BY id`,
		sql`SELECT * FROM question ORDER BY id`,
		sql`SELECT * FROM card ORDER BY question_id`,
		sql`SELECT id::text, question_id, series_id, at, first_try, correct, score, confidence, overridden, answer, duration_ms FROM attempt ORDER BY id`,
		sql`SELECT * FROM setting ORDER BY key`
	]);
	const body = JSON.stringify(
		{ format: 'etude-sauvegarde/v1', exportedAt: new Date(), sessions, courses, chapters, questions, cards, attempts, settings },
		null,
		1
	);
	const date = new Date().toISOString().slice(0, 10);
	return new Response(body, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="etude-sauvegarde-${date}.json"`
		}
	});
};
