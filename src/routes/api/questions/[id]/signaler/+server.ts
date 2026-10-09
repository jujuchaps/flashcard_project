import { json } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { skipCurrent } from '$lib/server/study';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	const body = (await request.json().catch(() => ({}))) as { seriesId?: number; note?: string };
	await sql`UPDATE question SET flagged = true, flag_note = ${body.note?.trim() || null}, updated_at = now() WHERE id = ${id}`;
	if (body.seriesId) await skipCurrent(body.seriesId, id);
	return json({ ok: true });
};
