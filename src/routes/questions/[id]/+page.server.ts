import { error, fail, redirect } from '@sveltejs/kit';
import { dedupKey, parseQuestion, toV2 } from '$lib/import-format';
import type { Payload, QuestionType } from '$lib/types';
import { sql } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const [q] = await sql<
		{
			id: number;
			course_id: number;
			course_name: string;
			chapter_id: number;
			ext_id: string | null;
			type: QuestionType;
			concept: string;
			prompt: string;
			explanation: string;
			slide: number | null;
			difficulty: number | null;
			tags: string[];
			payload: Payload;
			flagged: boolean;
			flag_note: string | null;
		}[]
	>`
		SELECT q.*, co.name AS course_name FROM question q JOIN course co ON co.id = q.course_id WHERE q.id = ${id}`;
	if (!q) error(404, 'Question introuvable.');
	const [chapters, attempts] = await Promise.all([
		sql<{ id: number; name: string }[]>`SELECT id, name FROM chapter WHERE course_id = ${q.course_id} ORDER BY position, id`,
		sql<{ at: Date; correct: boolean; first_try: boolean; confidence: string | null; overridden: boolean }[]>`
			SELECT at, correct, first_try, confidence, overridden FROM attempt WHERE question_id = ${id} ORDER BY at DESC LIMIT 15`
	]);
	const json = JSON.stringify(
		toV2({ ...q, extId: q.ext_id, payload: q.payload }),
		null,
		2
	);
	return {
		question: { id: q.id, courseId: q.course_id, courseName: q.course_name, chapterId: q.chapter_id, flagged: q.flagged, flagNote: q.flag_note },
		json,
		chapters,
		attempts
	};
};

export const actions: Actions = {
	enregistrer: async ({ request, params }) => {
		const id = Number(params.id);
		const form = await request.formData();
		const text = String(form.get('json') ?? '');
		let parsed;
		try {
			parsed = parseQuestion(JSON.parse(text));
		} catch (e) {
			return fail(400, { error: `Question invalide : ${(e as Error).message}`, json: text });
		}
		const chapterId = Number(form.get('chapterId'));
		const reset = form.get('reset') === 'on';
		const unflag = form.get('unflag') === 'on';
		const [cur] = await sql<{ course_id: number }[]>`SELECT course_id FROM question WHERE id = ${id}`;
		if (!cur) return fail(404, { error: 'Question introuvable.', json: text });
		try {
			await sql.begin(async (tx) => {
				await tx`UPDATE question SET type = ${parsed.type}, concept = ${parsed.concept}, prompt = ${parsed.prompt},
					explanation = ${parsed.explanation}, payload = ${tx.json(parsed.payload as never)}, slide = ${parsed.slide},
					difficulty = ${parsed.difficulty}, tags = ${parsed.tags}, dedup_key = ${dedupKey(parsed)},
					chapter_id = (SELECT id FROM chapter WHERE id = ${chapterId} AND course_id = ${cur.course_id}
						UNION ALL SELECT chapter_id FROM question WHERE id = ${id} LIMIT 1),
					flagged = CASE WHEN ${unflag} THEN false ELSE flagged END,
					updated_at = now()
					WHERE id = ${id}`;
				if (reset) await tx`DELETE FROM card WHERE question_id = ${id}`;
			});
		} catch (e) {
			if ((e as { code?: string }).code === '23505')
				return fail(400, { error: 'Une autre question de ce cours a déjà exactement cet énoncé.', json: text });
			throw e;
		}
		return { ok: reset ? 'Question enregistrée et progression remise à zéro.' : 'Question enregistrée.' };
	},
	supprimer: async ({ params }) => {
		const [q] = await sql<{ course_id: number; chapter_id: number }[]>`
			DELETE FROM question WHERE id = ${Number(params.id)} RETURNING course_id, chapter_id`;
		redirect(303, q ? `/cours/${q.course_id}/chapitres/${q.chapter_id}` : '/cours');
	}
};
