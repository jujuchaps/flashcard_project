import { dailyPlan, evaluationsWithReadiness, forecast } from '$lib/server/planning';
import { reportMarkdown, weeklyReport } from '$lib/server/progress';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [evs, plan] = await Promise.all([evaluationsWithReadiness({ upcoming: true }), dailyPlan()]);
	const fc = await forecast(plan, 7);
	const capacity = Math.round((plan.targetMinutes * 60) / 25);
	const heavy = fc.slice(1).find((d) => d.reviews + d.fresh > capacity);
	const report = await weeklyReport(
		evs,
		heavy
			? `Le ${heavy.day} s’annonce chargé (${heavy.reviews + heavy.fresh} questions) : prends un peu d’avance les jours d’avant.`
			: null
	);
	const { evaluations, ...rest } = report;
	return {
		report: { ...rest, evaluations: evaluations.map(({ readiness, ...e }) => ({ ...e, index: readiness.index, seen: readiness.seen, total: readiness.total })) },
		markdown: reportMarkdown(report)
	};
};
