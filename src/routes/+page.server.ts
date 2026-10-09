import { fail, redirect } from '@sveltejs/kit';
import { getSetting } from '$lib/server/db';
import { alerts, dailyPlan, evaluationsWithReadiness, takeSnapshot } from '$lib/server/planning';
import { counts, courseStats, streak, todayActivity, weakQuestions } from '$lib/server/stats';
import { activeSessionId } from '$lib/server/importer';
import { activeSlots, getSession } from '$lib/server/structure';
import { classesSoon } from '$lib/schedule';
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
	const [evs, plan] = await Promise.all([evaluationsWithReadiness({ upcoming: true }), dailyPlan()]);
	await takeSnapshot(courses);
	const { examNew: _, ...planView } = plan;
	const sessionId = await activeSessionId();
	const session = await getSession(sessionId);
	// Accueil : la session en cours et les cours hors session.
	const visible = courses.filter((co) => co.sessionId === sessionId || co.sessionId === null);
	const soon = classesSoon(await activeSlots());
	return {
		counts: c,
		courses: visible,
		otherSessionsCourses: courses.length - visible.length,
		session,
		classes: soon,
		streak: s,
		today,
		weak,
		current,
		reviewSize,
		newPerSeries,
		evaluations: evs.slice(0, 4),
		plan: planView,
		alerts: await alerts(evs)
	};
};

export const actions: Actions = {
	start: async ({ request }) => {
		const form = await request.formData();
		const mode = String(form.get('mode') ?? 'cible') as SeriesMode;
		if (!['revision', 'cible', 'erreurs', 'sprint', 'examen'].includes(mode)) return fail(400, { error: 'Mode inconnu.' });
		const count = Number(form.get('count') ?? 10) || 10;
		const courseIds = form.getAll('course').map(Number).filter(Boolean);
		const chapterIds = form.getAll('chapter').map(Number).filter(Boolean);
		const evaluationId = Number(form.get('evaluationId')) || undefined;
		const durationMin = Math.max(0, Math.min(300, Number(form.get('durationMin')) || 0));
		const id = await startSeries({ mode, count, courseIds, chapterIds, evaluationId, durationMin });
		if (!id)
			return fail(400, {
				error:
					mode === 'revision'
						? 'Rien à réviser pour l’instant. Lance un quiz ciblé pour apprendre de nouvelles questions.'
						: mode === 'erreurs'
							? 'Aucune erreur à retravailler. Bravo!'
							: mode === 'sprint'
								? 'Tout le contenu de cet examen est déjà solide. Fais un examen blanc pour vérifier!'
								: 'Aucune question dans cette sélection.'
			});
		redirect(303, `/serie/${id}`);
	}
};
