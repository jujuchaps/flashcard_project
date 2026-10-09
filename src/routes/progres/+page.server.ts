import { alerts, dailyPlan, evaluationsWithReadiness, forecast } from '$lib/server/planning';
import { activity, masteryHistory, weeklyReport } from '$lib/server/progress';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [days, history, plan, evs] = await Promise.all([
		activity(126),
		masteryHistory(90),
		dailyPlan(),
		evaluationsWithReadiness({ upcoming: true })
	]);
	const fc = await forecast(plan);
	const capacity = Math.round((plan.targetMinutes * 60) / 25);
	const report = await weeklyReport(evs, null);
	return {
		days,
		history,
		forecast: fc,
		capacity,
		targetMinutes: plan.targetMinutes,
		alerts: await alerts(evs),
		week: {
			daysStudied: report.daysStudied,
			answers: report.answers,
			minutes: report.minutes,
			firstTryRate: report.firstTryRate,
			previous: report.previous,
			masteredGain: report.masteredGain
		}
	};
};
