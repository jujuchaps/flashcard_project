// Historique d'étude et bilan hebdomadaire (docs/PLAN.md, 11.2 et 11.4).

import { sql } from './db';
import { localDay, type EvaluationStatus } from './planning';
import { counts } from './stats';

export interface DayActivity {
	day: string;
	answers: number;
	first: number;
	ok: number;
	minutes: number;
}

/** Activité par jour sur les `days` derniers jours (jours sans activité inclus). */
export async function activity(days: number): Promise<DayActivity[]> {
	const rows = await sql<{ d: string; answers: number; first: number; ok: number; ms: number }[]>`
		SELECT to_char(at AT TIME ZONE current_setting('TimeZone'), 'YYYY-MM-DD') AS d,
			count(*)::int AS answers,
			count(*) FILTER (WHERE first_try)::int AS first,
			count(*) FILTER (WHERE first_try AND correct)::int AS ok,
			coalesce(sum(least(duration_ms, 300000)), 0)::int AS ms
		FROM attempt WHERE at >= date_trunc('day', now()) - make_interval(days => ${days - 1})
		GROUP BY 1`;
	const byDay = new Map(rows.map((r) => [r.d, r]));
	const out: DayActivity[] = [];
	const cursor = new Date();
	cursor.setDate(cursor.getDate() - (days - 1));
	for (let i = 0; i < days; i++) {
		const day = localDay(cursor);
		const r = byDay.get(day);
		out.push({
			day,
			answers: r?.answers ?? 0,
			first: r?.first ?? 0,
			ok: r?.ok ?? 0,
			minutes: Math.round((r?.ms ?? 0) / 60000)
		});
		cursor.setDate(cursor.getDate() + 1);
	}
	return out;
}

export interface MasteryPoint {
	day: string;
	mastered: number;
	total: number;
}

/** Questions maîtrisées ou ancrées, jour par jour (instantanés quotidiens). */
export async function masteryHistory(days = 90): Promise<MasteryPoint[]> {
	return sql<MasteryPoint[]>`
		SELECT to_char(s.day, 'YYYY-MM-DD') AS day,
			sum((s.counts->>'maitrisee')::int + (s.counts->>'ancree')::int)::int AS mastered,
			sum(s.total)::int AS total
		FROM daily_snapshot s JOIN course co ON co.id = s.course_id
		WHERE NOT co.archived AND s.day > current_date - ${days}::int
		GROUP BY s.day ORDER BY s.day`;
}

export interface CourseWeek {
	course: string;
	answers: number;
	first: number;
	ok: number;
}

async function courseWeek(fromDays: number, toDays: number): Promise<CourseWeek[]> {
	return sql<CourseWeek[]>`
		SELECT co.name AS course, count(*)::int AS answers,
			count(*) FILTER (WHERE a.first_try)::int AS first,
			count(*) FILTER (WHERE a.first_try AND a.correct)::int AS ok
		FROM attempt a JOIN question q ON q.id = a.question_id JOIN course co ON co.id = q.course_id
		WHERE a.at >= date_trunc('day', now()) - make_interval(days => ${fromDays})
			AND a.at < date_trunc('day', now()) - make_interval(days => ${toDays})
		GROUP BY co.name ORDER BY count(*) DESC`;
}

export interface WeakConcept {
	course: string;
	concept: string;
	wrong: number;
	right: number;
}

async function weakConcepts(): Promise<WeakConcept[]> {
	return sql<WeakConcept[]>`
		SELECT co.name AS course, q.concept,
			count(*) FILTER (WHERE NOT a.correct)::int AS wrong,
			count(*) FILTER (WHERE a.correct)::int AS right
		FROM attempt a JOIN question q ON q.id = a.question_id JOIN course co ON co.id = q.course_id
		WHERE a.first_try AND q.concept <> '' AND a.at >= now() - interval '14 days'
		GROUP BY co.name, q.concept
		HAVING count(*) FILTER (WHERE NOT a.correct) > 0
		ORDER BY count(*) FILTER (WHERE NOT a.correct)::float / count(*) DESC, count(*) DESC
		LIMIT 5`;
}

export interface WeeklyReport {
	from: string;
	to: string;
	daysStudied: number;
	answers: number;
	minutes: number;
	firstTryRate: number | null;
	previous: { answers: number; minutes: number; firstTryRate: number | null; daysStudied: number };
	masteredGain: number | null;
	mastered: number;
	total: number;
	courses: (CourseWeek & { rate: number | null })[];
	weakConcepts: WeakConcept[];
	misconceptions: number;
	evaluations: EvaluationStatus[];
	recommendations: string[];
}

function summarize(days: DayActivity[]) {
	const first = days.reduce((s, d) => s + d.first, 0);
	const ok = days.reduce((s, d) => s + d.ok, 0);
	return {
		answers: days.reduce((s, d) => s + d.answers, 0),
		minutes: days.reduce((s, d) => s + d.minutes, 0),
		firstTryRate: first ? ok / first : null,
		daysStudied: days.filter((d) => d.answers > 0).length
	};
}

export async function weeklyReport(evs: EvaluationStatus[], forecastHeavy: string | null): Promise<WeeklyReport> {
	const days = await activity(14);
	const prevDays = days.slice(0, 7);
	const thisWeek = days.slice(7);
	const cur = summarize(thisWeek);
	const history = await masteryHistory(14);
	const last = history.at(-1);
	const weekAgo = history.find((h) => h.day >= prevDays[prevDays.length - 1].day) ?? null;
	const courses = (await courseWeek(6, -1)).map((c) => ({ ...c, rate: c.first ? c.ok / c.first : null }));
	const weak = await weakConcepts();
	const c = await counts();
	const upcoming = evs.filter((e) => e.daysLeft >= 0);

	const rec: string[] = [];
	for (const ev of upcoming.filter((e) => e.daysLeft <= 14 && e.readiness.index < 0.85).slice(0, 2))
		rec.push(
			`Priorité : « ${ev.name} » (${ev.courseName}) dans ${ev.daysLeft} jour${ev.daysLeft > 1 ? 's' : ''}, préparation ${Math.round(ev.readiness.index * 100)} %. ${ev.readiness.fresh ? `Il reste ${ev.readiness.fresh} questions jamais vues : suis le plan du jour.` : 'Fais un sprint, puis un examen blanc 2 ou 3 jours avant.'}`
		);
	if (c.misconceptions)
		rec.push(`Retravaille tes ${c.misconceptions} fausse${c.misconceptions > 1 ? 's' : ''} croyance${c.misconceptions > 1 ? 's' : ''} (bouton « Retravailler mes erreurs ») : ce sont les erreurs qui coûtent le plus cher à l’examen.`);
	const hard = courses.filter((x) => x.first >= 10 && x.rate !== null && x.rate < 0.7).sort((a, b) => a.rate! - b.rate!)[0];
	if (hard)
		rec.push(`En ${hard.course}, seulement ${Math.round(hard.rate! * 100)} % de réussite du premier coup : relis la source des questions ratées avant ta prochaine série, ou demande une autre explication à Claude.`);
	if (weak[0])
		rec.push(`Concept le plus fragile : « ${weak[0].concept} » (${weak[0].course}), raté ${weak[0].wrong} fois sur ${weak[0].wrong + weak[0].right}. Fais un quiz ciblé sur ce chapitre.`);
	if (cur.daysStudied < 5)
		rec.push(`Tu as étudié ${cur.daysStudied} jour${cur.daysStudied > 1 ? 's' : ''} sur 7. Vise au moins 5 jours : de courtes séances régulières retiennent mieux qu’une longue séance.`);
	if (forecastHeavy) rec.push(forecastHeavy);
	if (!evs.length) rec.push('Ajoute tes dates d’examen (page Examens) pour obtenir un plan quotidien et une prédiction de préparation.');
	if (!rec.length) rec.push('Continue comme ça : fais ta révision du jour chaque jour, elle suffit à garder tout ce que tu as appris.');

	return {
		from: thisWeek[0].day,
		to: thisWeek[6].day,
		...cur,
		previous: summarize(prevDays),
		masteredGain: last && weekAgo && weekAgo !== last ? last.mastered - weekAgo.mastered : null,
		mastered: last?.mastered ?? 0,
		total: last?.total ?? 0,
		courses,
		weakConcepts: weak,
		misconceptions: c.misconceptions,
		evaluations: upcoming,
		recommendations: rec.slice(0, 5)
	};
}

/** Bilan en Markdown, à coller dans une conversation avec Claude pour faire le point. */
export function reportMarkdown(r: WeeklyReport): string {
	const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`);
	const lines = [
		`# Mon bilan d'étude (${r.from} au ${r.to})`,
		'',
		`- Jours d'étude : ${r.daysStudied}/7 (semaine précédente : ${r.previous.daysStudied}/7)`,
		`- Réponses : ${r.answers} (précédente : ${r.previous.answers}), environ ${r.minutes} min`,
		`- Réussite du premier coup : ${pct(r.firstTryRate)} (précédente : ${pct(r.previous.firstTryRate)})`,
		`- Questions maîtrisées ou ancrées : ${r.mastered}/${r.total}${r.masteredGain !== null ? ` (${r.masteredGain >= 0 ? '+' : ''}${r.masteredGain} cette semaine)` : ''}`,
		`- Fausses croyances en cours : ${r.misconceptions}`,
		'',
		'## Par cours (cette semaine)',
		...(r.courses.length ? r.courses.map((c) => `- ${c.course} : ${c.answers} réponses, ${pct(c.rate)} du premier coup`) : ['- Aucune activité']),
		'',
		'## Examens à venir',
		...(r.evaluations.length
			? r.evaluations.map((e) => `- ${e.name} (${e.courseName}), le ${e.date} (dans ${e.daysLeft} j) : préparation ${pct(e.readiness.index)}, ${e.readiness.seen}/${e.readiness.total} questions vues`)
			: ['- Aucun examen entré']),
		'',
		'## Concepts fragiles (14 derniers jours)',
		...(r.weakConcepts.length ? r.weakConcepts.map((w) => `- ${w.concept} (${w.course}) : raté ${w.wrong} fois sur ${w.wrong + w.right}`) : ['- Aucun']),
		'',
		'## Recommandations de l’app',
		...r.recommendations.map((x) => `- ${x}`),
		'',
		'Peux-tu m’aider à faire le point et à organiser ma semaine qui vient?'
	];
	return lines.join('\n');
}
