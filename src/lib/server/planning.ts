// Évaluations, préparation, plan quotidien, prévision de charge et alertes (docs/PLAN.md, 11.1 à 11.3).

import { getSetting, sql } from './db';
import { cardFromJson, scheduler } from './srs';

const SECONDS_PER_QUESTION = 25;

/** Jour local « AAAA-MM-JJ ». */
export function localDay(d = new Date()): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Nombre de jours de calendrier entre aujourd'hui et une date « AAAA-MM-JJ » (négatif si passée). */
export function daysUntil(day: string, now = new Date()): number {
	const [y, m, d] = day.split('-').map(Number);
	return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}

/** Moment de l'examen : 9 h le jour J, heure locale. */
export function examMoment(day: string): Date {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(y, m - 1, d, 9, 0, 0);
}

export function minutesFor(questions: number): number {
	return Math.round((questions * SECONDS_PER_QUESTION) / 60);
}

export interface Evaluation {
	id: number;
	courseId: number;
	courseName: string;
	name: string;
	date: string;
	weight: number | null;
	chapterIds: number[];
	chapterNames: string[];
	predictedGrade: number | null;
	predictedAt: Date | null;
	actualGrade: number | null;
	daysLeft: number;
}

export async function listEvaluations(filter: { courseId?: number; upcoming?: boolean } = {}): Promise<Evaluation[]> {
	const rows = await sql<
		{
			id: number;
			course_id: number;
			course_name: string;
			name: string;
			date: string;
			weight: number | null;
			chapter_ids: number[];
			chapter_names: string[] | null;
			predicted_grade: number | null;
			predicted_at: Date | null;
			actual_grade: number | null;
		}[]
	>`
		SELECT e.id, e.course_id, co.name AS course_name, e.name, to_char(e.date, 'YYYY-MM-DD') AS date, e.weight,
			e.chapter_ids, e.predicted_grade, e.predicted_at, e.actual_grade,
			(SELECT array_agg(ch.name ORDER BY ch.position) FROM chapter ch WHERE ch.id = ANY(e.chapter_ids)) AS chapter_names
		FROM evaluation e JOIN course co ON co.id = e.course_id
		WHERE (${filter.courseId ?? null}::int IS NULL OR e.course_id = ${filter.courseId ?? null})
			AND (${!!filter.upcoming} = false OR e.date >= current_date)
		ORDER BY e.date, e.id`;
	return rows.map((r) => ({
		id: r.id,
		courseId: r.course_id,
		courseName: r.course_name,
		name: r.name,
		date: r.date,
		weight: r.weight,
		chapterIds: r.chapter_ids,
		chapterNames: r.chapter_names ?? [],
		predictedGrade: r.predicted_grade,
		predictedAt: r.predicted_at,
		actualGrade: r.actual_grade,
		daysLeft: daysUntil(r.date)
	}));
}

interface ScopeRow {
	id: number;
	chapter_id: number;
	fsrs: Record<string, unknown> | null;
	last_ok: boolean | null;
	misconception: boolean | null;
}

export async function evaluationScope(ev: Pick<Evaluation, 'courseId' | 'chapterIds'>): Promise<ScopeRow[]> {
	return sql<ScopeRow[]>`
		SELECT q.id, q.chapter_id, c.fsrs, c.last_ok, c.misconception
		FROM question q LEFT JOIN card c ON c.question_id = q.id
		WHERE q.course_id = ${ev.courseId} AND NOT q.flagged
			AND (cardinality(${ev.chapterIds}::int[]) = 0 OR q.chapter_id = ANY(${ev.chapterIds}::int[]))`;
}

export interface Readiness {
	/** Moyenne des probabilités de réussite le jour J, si tu arrêtais d'étudier maintenant (0 à 1). */
	index: number;
	total: number;
	seen: number;
	fresh: number;
	fragile: number;
	/** Probabilité de réussite le jour J, par question (pour le sprint). */
	byQuestion: Map<number, number>;
}

export function readinessOf(rows: ScopeRow[], at: Date): Readiness {
	const f = scheduler();
	const byQuestion = new Map<number, number>();
	let sum = 0;
	let seen = 0;
	let fragile = 0;
	for (const r of rows) {
		let p = 0;
		if (r.fsrs) {
			seen++;
			if (!r.last_ok || r.misconception) fragile++;
			const card = cardFromJson(r.fsrs);
			p = card.last_review && card.last_review > at ? 1 : f.get_retrievability(card, at, false);
			// Une question ratée la dernière fois n'est pas considérée comme sue.
			if (!r.last_ok) p *= 0.5;
		}
		byQuestion.set(r.id, p);
		sum += p;
	}
	return {
		index: rows.length ? sum / rows.length : 0,
		total: rows.length,
		seen,
		fresh: rows.length - seen,
		fragile,
		byQuestion
	};
}

export interface EvaluationStatus extends Evaluation {
	readiness: Omit<Readiness, 'byQuestion'>;
}

/** Calcule la préparation de chaque évaluation et mémorise la prédiction tant que l'examen n'est pas passé. */
export async function evaluationsWithReadiness(filter: { courseId?: number; upcoming?: boolean } = {}) {
	const evs = await listEvaluations(filter);
	const out: EvaluationStatus[] = [];
	for (const ev of evs) {
		const { byQuestion: _, ...readiness } = readinessOf(await evaluationScope(ev), examMoment(ev.date));
		if (ev.daysLeft >= 0) {
			const grade = Math.round(readiness.index * 1000) / 10;
			await sql`UPDATE evaluation SET predicted_grade = ${grade}, predicted_at = now() WHERE id = ${ev.id}`;
			ev.predictedGrade = grade;
		}
		out.push({ ...ev, readiness });
	}
	return out;
}

async function introducedToday(): Promise<Map<number, number>> {
	const rows = await sql<{ course_id: number; n: number }[]>`
		SELECT q.course_id, count(DISTINCT a.question_id)::int AS n
		FROM attempt a JOIN question q ON q.id = a.question_id
		WHERE a.at >= date_trunc('day', now()) AND a.first_try
			AND NOT EXISTS (SELECT 1 FROM attempt b WHERE b.question_id = a.question_id AND b.at < date_trunc('day', now()))
		GROUP BY q.course_id`;
	return new Map(rows.map((r) => [r.course_id, r.n]));
}

export interface PlanItem {
	courseId: number;
	courseName: string;
	evaluation: string;
	daysLeft: number;
	fresh: number;
	perDay: number;
	remainingToday: number;
}

export interface DailyPlan {
	items: PlanItem[];
	reviews: number;
	newToday: number;
	minutes: number;
	targetMinutes: number;
	overloaded: boolean;
	/** Questions jamais vues des évaluations à venir, avec le nombre de jours restants (pour prioriser). */
	examNew: Map<number, number>;
}

/**
 * Plan du jour : pour chaque évaluation à venir, répartit les questions jamais vues
 * sur les jours restants, en visant d'avoir tout vu 2 jours avant l'examen.
 */
export async function dailyPlan(now = new Date()): Promise<DailyPlan> {
	const evs = await listEvaluations({ upcoming: true });
	const targetMinutes = await getSetting('dailyMinutes', 30);
	const today = await introducedToday();
	const byCourse = new Map<number, PlanItem>();
	const examNew = new Map<number, number>();
	for (const ev of evs) {
		const rows = await evaluationScope(ev);
		const fresh = rows.filter((r) => !r.fsrs);
		for (const r of fresh) examNew.set(r.id, Math.min(examNew.get(r.id) ?? Infinity, ev.daysLeft));
		if (!fresh.length) continue;
		const days = Math.max(1, ev.daysLeft - 2);
		const perDay = Math.ceil(fresh.length / days);
		const prev = byCourse.get(ev.courseId);
		if (!prev || perDay > prev.perDay)
			byCourse.set(ev.courseId, {
				courseId: ev.courseId,
				courseName: ev.courseName,
				evaluation: ev.name,
				daysLeft: ev.daysLeft,
				fresh: fresh.length,
				perDay,
				remainingToday: 0
			});
	}
	const items = [...byCourse.values()].map((it) => ({
		...it,
		remainingToday: Math.max(0, it.perDay - (today.get(it.courseId) ?? 0))
	}));
	const [{ due }] = await sql<{ due: number }[]>`
		SELECT count(*)::int AS due FROM card c JOIN question q ON q.id = c.question_id JOIN course co ON co.id = q.course_id
		WHERE c.due <= ${now} AND NOT q.flagged AND NOT co.archived`;
	const newToday = items.reduce((s, i) => s + i.remainingToday, 0);
	const minutes = minutesFor(due + newToday);
	return { items, reviews: due, newToday, minutes, targetMinutes, overloaded: minutes > targetMinutes, examNew };
}

export interface ForecastDay {
	day: string;
	reviews: number;
	fresh: number;
}

/** Charge prévue pour les 14 prochains jours : révisions dues (selon FSRS) et nouvelles questions du plan. */
export async function forecast(plan: DailyPlan, days = 14): Promise<ForecastDay[]> {
	const rows = await sql<{ d: string; n: number }[]>`
		SELECT to_char(greatest(c.due, now()) AT TIME ZONE current_setting('TimeZone'), 'YYYY-MM-DD') AS d, count(*)::int AS n
		FROM card c JOIN question q ON q.id = c.question_id JOIN course co ON co.id = q.course_id
		WHERE NOT q.flagged AND NOT co.archived AND c.due < now() + make_interval(days => ${days})
		GROUP BY 1`;
	const byDay = new Map(rows.map((r) => [r.d, r.n]));
	const out: ForecastDay[] = [];
	const cursor = new Date();
	for (let i = 0; i < days; i++) {
		const day = localDay(cursor);
		const fresh = plan.items
			.filter((it) => i < Math.max(1, it.daysLeft - 2))
			.reduce((s, it) => s + (i === 0 ? it.remainingToday : it.perDay), 0);
		out.push({ day, reviews: byDay.get(day) ?? 0, fresh });
		cursor.setDate(cursor.getDate() + 1);
	}
	return out;
}

export interface Alert {
	level: 'info' | 'warn' | 'bad';
	text: string;
	href?: string;
}

export async function alerts(evs: EvaluationStatus[], now = new Date()): Promise<Alert[]> {
	const out: Alert[] = [];
	for (const ev of evs) {
		if (ev.daysLeft >= 0 && ev.daysLeft <= 7 && ev.readiness.index < 0.7)
			out.push({
				level: 'bad',
				text: `${ev.name} (${ev.courseName}) ${ev.daysLeft === 0 ? 'aujourd’hui' : `dans ${ev.daysLeft} jour${ev.daysLeft > 1 ? 's' : ''}`} : préparation ${Math.round(ev.readiness.index * 100)} %. Lance un sprint.`,
				href: '/examens'
			});
	}
	const rows = await sql<{ chapter_id: number; chapter: string; course: string; fsrs: Record<string, unknown>; last_ok: boolean }[]>`
		SELECT q.chapter_id, ch.name AS chapter, co.name AS course, c.fsrs, c.last_ok
		FROM card c JOIN question q ON q.id = c.question_id JOIN chapter ch ON ch.id = q.chapter_id JOIN course co ON co.id = q.course_id
		WHERE NOT q.flagged AND NOT co.archived`;
	const f = scheduler();
	const chapters = new Map<number, { name: string; sum: number; n: number }>();
	for (const r of rows) {
		const p = f.get_retrievability(cardFromJson(r.fsrs), now, false) * (r.last_ok ? 1 : 0.5);
		const name = ['Questions de l’artefact', 'Général'].includes(r.chapter) ? r.course : `${r.course} : ${r.chapter}`;
		const c = chapters.get(r.chapter_id) ?? { name, sum: 0, n: 0 };
		c.sum += p;
		c.n++;
		chapters.set(r.chapter_id, c);
	}
	const fading = [...chapters.values()]
		.filter((c) => c.n >= 3 && c.sum / c.n < 0.8)
		.sort((a, b) => a.sum / a.n - b.sum / b.n)
		.slice(0, 3);
	for (const c of fading)
		out.push({ level: 'warn', text: `« ${c.name} » s’efface : rétention estimée ${Math.round((c.sum / c.n) * 100)} %.` });
	const [{ leeches }] = await sql<{ leeches: number }[]>`
		SELECT count(*)::int AS leeches FROM card c JOIN question q ON q.id = c.question_id
		WHERE c.wrong_count >= 5 AND NOT q.flagged`;
	if (leeches)
		out.push({
			level: 'info',
			text: `${leeches} question${leeches > 1 ? 's' : ''} « sangsue${leeches > 1 ? 's' : ''} » (ratée${leeches > 1 ? 's' : ''} 5 fois ou plus) : reformule-les ou demande une autre explication à Claude.`
		});
	return out;
}

/** Enregistre l'état de maîtrise du jour, par cours (pour la courbe de progression). */
export async function takeSnapshot(courses: { id: number; total: number; counts: Record<string, number> }[]) {
	if (!courses.length) return;
	await sql.begin(async (tx) => {
		for (const c of courses)
			await tx`INSERT INTO daily_snapshot (day, course_id, counts, total)
				VALUES (current_date, ${c.id}, ${tx.json(c.counts)}, ${c.total})
				ON CONFLICT (day, course_id) DO UPDATE SET counts = EXCLUDED.counts, total = EXCLUDED.total`;
	});
}
