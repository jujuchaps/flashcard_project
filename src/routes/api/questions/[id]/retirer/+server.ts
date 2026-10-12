import { json } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { skipCurrent } from '$lib/server/study';
import type { RequestHandler } from './$types';

/** « Ne plus me la poser » : la question sort des quiz, sans être supprimée. */
export const POST: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	const body = (await request.json().catch(() => ({}))) as { seriesId?: number };
	await sql`UPDATE question SET ignored = true, updated_at = now() WHERE id = ${id}`;
	if (body.seriesId) await skipCurrent(body.seriesId, id);
	return json({ ok: true });
};
