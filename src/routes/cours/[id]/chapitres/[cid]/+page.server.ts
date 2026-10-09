import { error, fail, redirect } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { masteryOf } from '$lib/server/srs';
import { courseStats } from '$lib/server/stats';
import { allCourses, getCourse, moveChapter, MoveError } from '$lib/server/structure';
import type { Mastery, QuestionType } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const courseId = Number(params.id);
	const chapterId = Number(params.cid);
	const course = await getCourse(courseId);
	const [chapter] = await sql<{ id: number; name: string; source: string | null; slide_count: number | null }[]>`
		SELECT id, name, source, slide_count FROM chapter WHERE id = ${chapterId} AND course_id = ${courseId}`;
	if (!course || !chapter) error(404, 'Chapitre introuvable.');
	const rows = await sql<
		{
			id: number;
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
		SELECT q.id, q.type, q.concept, q.prompt, q.slide, q.flagged, q.flag_note,
			c.stability, c.last_ok, c.misconception, c.right_count, c.wrong_count
		FROM question q LEFT JOIN card c ON c.question_id = q.id
		WHERE q.chapter_id = ${chapterId} ORDER BY q.position, q.id`;
	const questions = rows.map((r) => ({
		id: r.id,
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
	const [stats] = await courseStats(new Date(), { courseId });
	return {
		course,
		chapter,
		chapterStats: stats?.chapters.find((c) => c.id === chapterId) ?? null,
		questions,
		otherCourses: (await allCourses()).filter((c) => c.id !== courseId)
	};
};

export const actions: Actions = {
	modifier: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const slides = Number(form.get('slideCount'));
		const slideCount = Number.isInteger(slides) && slides > 0 && slides <= 1000 ? slides : null;
		if (!name) return fail(400, { error: 'Le nom est obligatoire.' });
		try {
			await sql`UPDATE chapter SET name = ${name}, slide_count = ${slideCount}
				WHERE id = ${Number(params.cid)} AND course_id = ${Number(params.id)}`;
		} catch {
			return fail(400, { error: 'Un autre chapitre de ce cours porte déjà ce nom.' });
		}
		return { ok: 'Chapitre mis à jour.' };
	},
	deplacer: async ({ request, params }) => {
		const target = Number((await request.formData()).get('targetId'));
		try {
			await moveChapter(Number(params.cid), target);
		} catch (e) {
			if (e instanceof MoveError) return fail(400, { error: e.message });
			throw e;
		}
		redirect(303, `/cours/${target}/chapitres/${params.cid}`);
	},
	supprimerChapitre: async ({ params }) => {
		await sql`DELETE FROM chapter WHERE id = ${Number(params.cid)} AND course_id = ${Number(params.id)}`;
		redirect(303, `/cours/${params.id}`);
	},
	retablir: async ({ request, params }) => {
		const form = await request.formData();
		await sql`UPDATE question SET flagged = false, flag_note = NULL
			WHERE id = ${Number(form.get('questionId'))} AND chapter_id = ${Number(params.cid)}`;
		return { ok: 'Question remise dans les quiz.' };
	},
	supprimer: async ({ request, params }) => {
		const form = await request.formData();
		await sql`DELETE FROM question WHERE id = ${Number(form.get('questionId'))} AND chapter_id = ${Number(params.cid)}`;
		return { ok: 'Question supprimée.' };
	}
};
