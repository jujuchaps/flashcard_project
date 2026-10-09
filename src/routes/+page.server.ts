import { fail, redirect } from '@sveltejs/kit';
import { getSetting } from '$lib/server/db';
import { counts, courseStats, streak, todayActivity, weakQuestions } from '$lib/server/stats';
import { currentSeriesId, startSeries, type SeriesMode } from '$lib/server/study';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [c, courses, s, today, weak, current, reviewSize, newPerSeries] = await Promise.all([
		counts(),
		courseStats(),
		streak(),
		todayActivity(),
		weakQuestions(),
		currentSeriesId(),
		getSetting('reviewSize', 30),
		getSetting('newPerSeries', 10)
	]);
	return { counts: c, courses, streak: s, today, weak, current, reviewSize, newPerSeries };
};

export const actions: Actions = {
	start: async ({ request }) => {
		const form = await request.formData();
		const mode = String(form.get('mode') ?? 'cible') as SeriesMode;
		if (!['revision', 'cible', 'erreurs'].includes(mode)) return fail(400, { error: 'Mode inconnu.' });
		const count = Number(form.get('count') ?? 10) || 10;
		const courseIds = form.getAll('course').map(Number).filter(Boolean);
		const chapterIds = form.getAll('chapter').map(Number).filter(Boolean);
		const id = await startSeries({ mode, count, courseIds, chapterIds });
		if (!id)
			return fail(400, {
				error:
					mode === 'revision'
						? 'Rien à réviser pour l’instant. Lance un quiz ciblé pour apprendre de nouvelles questions.'
						: mode === 'erreurs'
							? 'Aucune erreur à retravailler. Bravo!'
							: 'Aucune question dans cette sélection.'
			});
		redirect(303, `/serie/${id}`);
	}
};
