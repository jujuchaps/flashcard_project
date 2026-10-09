import { error, fail, redirect } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { evaluationsWithReadiness } from '$lib/server/planning';
import { courseStats } from '$lib/server/stats';
import { allCourses, getCourse, listSessions, mergeCourse, MoveError, slotsFor } from '$lib/server/structure';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const course = await getCourse(id);
	if (!course) error(404, 'Cours introuvable.');
	const [stats] = await courseStats(new Date(), { courseId: id });
	const [slots, evaluations, sessions, courses, flagged] = await Promise.all([
		slotsFor([id]),
		evaluationsWithReadiness({ courseId: id, upcoming: true }),
		listSessions(),
		allCourses(),
		sql<{ n: number }[]>`SELECT count(*)::int AS n FROM question WHERE course_id = ${id} AND flagged`
	]);
	return {
		course,
		stats: stats ?? null,
		slots,
		evaluations,
		sessions,
		otherCourses: courses.filter((c) => c.id !== id),
		flagged: flagged[0].n
	};
};

const time = (v: FormDataEntryValue | null) => (/^\d{1,2}:\d{2}$/.test(String(v ?? '')) ? String(v) : null);

export const actions: Actions = {
	modifier: async ({ request, params }) => {
		const id = Number(params.id);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const code = String(form.get('code') ?? '').trim().toLowerCase();
		if (!name || !code) return fail(400, { error: 'Le nom et le code sont obligatoires.' });
		const rawSession = String(form.get('sessionId') ?? '');
		const sessionId = rawSession === 'hors' ? null : Number(rawSession) || null;
		const [dup] = await sql`SELECT 1 FROM course WHERE code = ${code} AND id <> ${id} AND session_id IS NOT DISTINCT FROM ${sessionId}`;
		if (dup) return fail(400, { error: `Le code « ${code} » est déjà utilisé dans cette session.` });
		await sql`UPDATE course SET name = ${name}, code = ${code}, session_id = ${sessionId},
			number = ${String(form.get('number') ?? '').trim() || null}, teacher = ${String(form.get('teacher') ?? '').trim() || null}
			WHERE id = ${id}`;
		return { ok: 'Cours mis à jour.' };
	},
	ajouterChapitre: async ({ request, params }) => {
		const id = Number(params.id);
		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Donne un nom au chapitre.' });
		const [exists] = await sql`SELECT 1 FROM chapter WHERE course_id = ${id} AND name = ${name}`;
		if (exists) return fail(400, { error: 'Ce chapitre existe déjà.' });
		await sql`INSERT INTO chapter (course_id, name, position)
			VALUES (${id}, ${name}, (SELECT coalesce(max(position), 0) + 1 FROM chapter WHERE course_id = ${id}))`;
		return { ok: `Chapitre « ${name} » ajouté. Pour y mettre des questions, choisis ce cours et ce chapitre à l’import.` };
	},
	ordreChapitre: async ({ request, params }) => {
		const id = Number(params.id);
		const form = await request.formData();
		const chapterId = Number(form.get('chapterId'));
		const dir = form.get('dir') === 'up' ? -1 : 1;
		const chapters = await sql<{ id: number }[]>`SELECT id FROM chapter WHERE course_id = ${id} ORDER BY position, id`;
		const i = chapters.findIndex((c) => c.id === chapterId);
		const j = i + dir;
		if (i < 0 || j < 0 || j >= chapters.length) return;
		[chapters[i], chapters[j]] = [chapters[j], chapters[i]];
		await sql.begin(async (tx) => {
			for (const [k, c] of chapters.entries()) await tx`UPDATE chapter SET position = ${k + 1} WHERE id = ${c.id}`;
		});
	},
	ajouterCreneau: async ({ request, params }) => {
		const form = await request.formData();
		const weekday = Number(form.get('weekday'));
		const starts = time(form.get('starts'));
		const ends = time(form.get('ends'));
		if (!(weekday >= 1 && weekday <= 7) || !starts || !ends || ends <= starts)
			return fail(400, { error: 'Vérifie le jour et les heures (la fin doit être après le début).' });
		await sql`INSERT INTO course_slot (course_id, weekday, starts, ends, room, kind)
			VALUES (${Number(params.id)}, ${weekday}, ${starts}, ${ends}, ${String(form.get('room') ?? '').trim() || null},
				${['T', 'L'].includes(String(form.get('kind'))) ? String(form.get('kind')) : null})`;
		return { ok: 'Plage horaire ajoutée.' };
	},
	supprimerCreneau: async ({ request, params }) => {
		const slotId = Number((await request.formData()).get('slotId'));
		await sql`DELETE FROM course_slot WHERE id = ${slotId} AND course_id = ${Number(params.id)}`;
		return { ok: 'Plage horaire retirée.' };
	},
	archiver: async ({ params }) => {
		await sql`UPDATE course SET archived = NOT archived WHERE id = ${Number(params.id)}`;
		return { ok: 'C’est noté.' };
	},
	fusionner: async ({ request, params }) => {
		const target = Number((await request.formData()).get('targetId'));
		try {
			await mergeCourse(Number(params.id), target);
		} catch (e) {
			if (e instanceof MoveError) return fail(400, { error: e.message });
			throw e;
		}
		redirect(303, `/cours/${target}`);
	}
};
