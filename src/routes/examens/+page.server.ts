import { fail } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { evaluationsWithReadiness } from '$lib/server/planning';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [evaluations, courses, chapters] = await Promise.all([
		evaluationsWithReadiness(),
		sql<{ id: number; name: string }[]>`SELECT id, name FROM course WHERE NOT archived ORDER BY name`,
		sql<{ id: number; course_id: number; name: string }[]>`SELECT id, course_id, name FROM chapter ORDER BY position, id`
	]);
	return { evaluations, courses, chapters };
};

export const actions: Actions = {
	ajouter: async ({ request }) => {
		const form = await request.formData();
		const courseId = Number(form.get('courseId'));
		const name = String(form.get('name') ?? '').trim();
		const date = String(form.get('date') ?? '');
		const weightRaw = String(form.get('weight') ?? '').replace(',', '.');
		const weight = weightRaw ? Number(weightRaw) : null;
		const chapterIds = form.getAll('chapter').map(Number).filter(Boolean);
		if (!courseId || !name || !/^\d{4}-\d{2}-\d{2}$/.test(date))
			return fail(400, { error: 'Le cours, le nom et la date sont obligatoires.' });
		if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 100))
			return fail(400, { error: 'La pondération doit être entre 0 et 100.' });
		const valid = await sql<{ id: number }[]>`SELECT id FROM chapter WHERE course_id = ${courseId} AND id = ANY(${chapterIds})`;
		await sql`INSERT INTO evaluation (course_id, name, date, weight, chapter_ids)
			VALUES (${courseId}, ${name}, ${date}, ${weight}, ${valid.map((v) => v.id)})`;
		return { ok: 'Examen ajouté. Le plan du jour en tient compte dès maintenant.' };
	},
	note: async ({ request }) => {
		const form = await request.formData();
		const raw = String(form.get('grade') ?? '').replace(',', '.').trim();
		const grade = raw ? Number(raw) : null;
		if (grade !== null && (!Number.isFinite(grade) || grade < 0 || grade > 100))
			return fail(400, { error: 'La note doit être entre 0 et 100.' });
		await sql`UPDATE evaluation SET actual_grade = ${grade} WHERE id = ${Number(form.get('id'))}`;
		return { ok: 'Note enregistrée.' };
	},
	supprimer: async ({ request }) => {
		const form = await request.formData();
		await sql`DELETE FROM evaluation WHERE id = ${Number(form.get('id'))}`;
		return { ok: 'Examen supprimé.' };
	}
};
