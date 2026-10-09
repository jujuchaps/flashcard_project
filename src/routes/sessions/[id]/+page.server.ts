import { error, fail, redirect } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { listEvaluations } from '$lib/server/planning';
import { courseStats } from '$lib/server/stats';
import { codeFrom, getSession, slotsFor } from '$lib/server/structure';
import type { Actions, PageServerLoad } from './$types';

function sessionParam(raw: string): number | null {
	if (raw === 'hors') return null;
	const id = Number(raw);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Session introuvable.');
	return id;
}

export const load: PageServerLoad = async ({ params }) => {
	const sessionId = sessionParam(params.id);
	const session = sessionId === null ? { id: 0, name: 'Hors session', active: false } : await getSession(sessionId);
	if (!session) error(404, 'Session introuvable.');
	const courses = await courseStats(new Date(), { sessionId });
	const slots = await slotsFor(courses.map((c) => c.id));
	const evaluations = (await listEvaluations({ upcoming: true })).filter((e) => courses.some((c) => c.id === e.courseId));
	const archived = await sql<{ id: number; name: string }[]>`
		SELECT id, name FROM course WHERE archived AND session_id IS NOT DISTINCT FROM ${sessionId} ORDER BY name`;
	return {
		session,
		courses,
		slots: slots.map((s) => ({ ...s, courseName: courses.find((c) => c.id === s.courseId)?.name ?? '' })),
		evaluations,
		archived
	};
};

export const actions: Actions = {
	ajouterCours: async ({ request, params }) => {
		const sessionId = sessionParam(params.id);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Donne un nom au cours.' });
		const code = String(form.get('code') ?? '').trim().toLowerCase() || codeFrom(name);
		const [exists] = await sql`SELECT 1 FROM course WHERE code = ${code} AND session_id IS NOT DISTINCT FROM ${sessionId}`;
		if (exists) return fail(400, { error: `Le code « ${code} » est déjà utilisé dans cette session.` });
		const [c] = await sql<{ id: number }[]>`
			INSERT INTO course (session_id, code, name, number, position)
			VALUES (${sessionId}, ${code}, ${name}, ${String(form.get('number') ?? '').trim() || null},
				(SELECT coalesce(max(position), 0) + 1 FROM course WHERE session_id IS NOT DISTINCT FROM ${sessionId}))
			RETURNING id`;
		redirect(303, `/cours/${c.id}`);
	},
	renommer: async ({ request, params }) => {
		const sessionId = sessionParam(params.id);
		if (sessionId === null) return fail(400, { error: 'Ce groupe ne se renomme pas.' });
		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Le nom est obligatoire.' });
		await sql`UPDATE study_session SET name = ${name} WHERE id = ${sessionId}`;
		return { ok: 'Session renommée.' };
	}
};
