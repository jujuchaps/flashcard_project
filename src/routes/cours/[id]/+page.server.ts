import { error, fail } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { masteryOf } from '$lib/server/srs';
import { courseStats } from '$lib/server/stats';
import type { Mastery, QuestionType } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const [course] = await sql<{ id: number; name: string; code: string; archived: boolean }[]>`
		SELECT id, name, code, archived FROM course WHERE id = ${id}`;
	if (!course) error(404, 'Cours introuvable.');
	const stats = (await courseStats()).find((c) => c.id === id) ?? null;
	const rows = await sql<
		{
			id: number;
			chapter_id: number;
			type: QuestionType;
			concept: string;
			prompt: string;
			slide: number | null;
			flagged: boolean;
			flag_note: string | null;
			stability: number | null;
			last_ok: boolean | null;
			misconception: boolean | null;
			right_count: number | null;
			wrong_count: number | null;
		}[]
	>`
		SELECT q.id, q.chapter_id, q.type, q.concept, q.prompt, q.slide, q.flagged, q.flag_note,
			c.stability, c.last_ok, c.misconception, c.right_count, c.wrong_count
		FROM question q LEFT JOIN card c ON c.question_id = q.id
		WHERE q.course_id = ${id} ORDER BY q.chapter_id, q.position, q.id`;
	const chapters = await sql<{ id: number; name: string; source: string | null }[]>`
		SELECT id, name, source FROM chapter WHERE course_id = ${id} ORDER BY position, id`;
	const questions = rows.map((r) => ({
		id: r.id,
		chapterId: r.chapter_id,
		type: r.type,
		concept: r.concept,
		prompt: r.prompt,
		slide: r.slide,
		flagged: r.flagged,
		flagNote: r.flag_note,
		right: r.right_count ?? 0,
		wrong: r.wrong_count ?? 0,
		mastery: masteryOf(
			r.stability === null ? null : { stability: r.stability, lastOk: r.last_ok!, misconception: r.misconception! }
		) as Mastery
	}));
	return { course, stats, chapters, questions };
};

export const actions: Actions = {
	renommer: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Le nom est obligatoire.' });
		await sql`UPDATE course SET name = ${name} WHERE id = ${Number(params.id)}`;
		return { ok: 'Cours renommé.' };
	},
	renommerChapitre: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const chapterId = Number(form.get('chapterId'));
		if (!name) return fail(400, { error: 'Le nom est obligatoire.' });
		try {
			await sql`UPDATE chapter SET name = ${name} WHERE id = ${chapterId} AND course_id = ${Number(params.id)}`;
		} catch {
			return fail(400, { error: 'Un chapitre porte déjà ce nom.' });
		}
		return { ok: 'Chapitre renommé.' };
	},
	archiver: async ({ params }) => {
		await sql`UPDATE course SET archived = NOT archived WHERE id = ${Number(params.id)}`;
		return { ok: 'C’est noté.' };
	},
	retablir: async ({ request }) => {
		const form = await request.formData();
		await sql`UPDATE question SET flagged = false, flag_note = NULL WHERE id = ${Number(form.get('questionId'))}`;
		return { ok: 'Question remise dans les quiz.' };
	},
	supprimer: async ({ request, params }) => {
		const form = await request.formData();
		await sql`DELETE FROM question WHERE id = ${Number(form.get('questionId'))} AND course_id = ${Number(params.id)}`;
		return { ok: 'Question supprimée.' };
	}
};
