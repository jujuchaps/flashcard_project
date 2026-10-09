import type { Mastery } from '$lib/types';
import { sql } from './db';
import { masteryOf } from './srs';

export type MasteryCounts = Record<Mastery, number>;

function emptyCounts(): MasteryCounts {
	return { nouvelle: 0, fragile: 0, apprentissage: 0, maitrisee: 0, ancree: 0 };
}

export interface ChapterStats {
	id: number;
	name: string;
	source: string | null;
	total: number;
	counts: MasteryCounts;
}

export interface CourseStats {
	id: number;
	code: string;
	name: string;
	total: number;
	due: number;
	counts: MasteryCounts;
	chapters: ChapterStats[];
	firstTryRate: number | null;
}

export async function courseStats(now = new Date()): Promise<CourseStats[]> {
	const rows = await sql<
		{
			course_id: number;
			code: string;
			course_name: string;
			chapter_id: number;
			chapter_name: string;
			source: string | null;
			stability: number | null;
			last_ok: boolean | null;
			misconception: boolean | null;
			due: Date | null;
		}[]
	>`
		SELECT co.id AS course_id, co.code, co.name AS course_name, ch.id AS chapter_id, ch.name AS chapter_name,
			ch.source, c.stability, c.last_ok, c.misconception, c.due
		FROM question q
		JOIN chapter ch ON ch.id = q.chapter_id
		JOIN course co ON co.id = q.course_id
		LEFT JOIN card c ON c.question_id = q.id
		WHERE NOT q.flagged AND NOT co.archived
		ORDER BY co.name, ch.position, ch.id`;
	const rates = await sql<{ course_id: number; n: number; ok: number }[]>`
		SELECT q.course_id, count(*)::int AS n, count(*) FILTER (WHERE a.correct)::int AS ok
		FROM attempt a JOIN question q ON q.id = a.question_id
		WHERE a.first_try GROUP BY q.course_id`;
	const rateBy = new Map(rates.map((r) => [r.course_id, r.n ? r.ok / r.n : null]));
	const courses = new Map<number, CourseStats>();
	for (const r of rows) {
		let c = courses.get(r.course_id);
		if (!c) {
			c = {
				id: r.course_id,
				code: r.code,
				name: r.course_name,
				total: 0,
				due: 0,
				counts: emptyCounts(),
				chapters: [],
				firstTryRate: rateBy.get(r.course_id) ?? null
			};
			courses.set(r.course_id, c);
		}
		let ch = c.chapters.find((x) => x.id === r.chapter_id);
		if (!ch) {
			ch = { id: r.chapter_id, name: r.chapter_name, source: r.source, total: 0, counts: emptyCounts() };
			c.chapters.push(ch);
		}
		const m = masteryOf(
			r.stability === null ? null : { stability: r.stability, lastOk: r.last_ok!, misconception: r.misconception! }
		);
		c.total++;
		ch.total++;
		c.counts[m]++;
		ch.counts[m]++;
		if (r.due && r.due <= now) c.due++;
	}
	return [...courses.values()];
}

/** Jours d'étude consécutifs jusqu'à aujourd'hui (ou hier si rien encore aujourd'hui). */
export async function streak(): Promise<{ days: number; today: boolean }> {
	const rows = await sql<{ d: string }[]>`
		SELECT DISTINCT to_char(at AT TIME ZONE current_setting('TimeZone'), 'YYYY-MM-DD') AS d
		FROM attempt WHERE at > now() - interval '400 days' ORDER BY d DESC`;
	const days = new Set(rows.map((r) => r.d));
	const fmt = (d: Date) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	const cursor = new Date();
	const today = days.has(fmt(cursor));
	if (!today) cursor.setDate(cursor.getDate() - 1);
	let n = 0;
	while (days.has(fmt(cursor))) {
		n++;
		cursor.setDate(cursor.getDate() - 1);
	}
	return { days: n, today };
}

export async function todayActivity() {
	const [r] = await sql<{ answers: number; first: number; ok: number; ms: number }[]>`
		SELECT count(*)::int AS answers, count(*) FILTER (WHERE first_try)::int AS first,
			count(*) FILTER (WHERE first_try AND correct)::int AS ok,
			coalesce(sum(least(duration_ms, 300000)), 0)::int AS ms
		FROM attempt WHERE at >= date_trunc('day', now())`;
	return r;
}

export interface WeakQuestion {
	id: number;
	prompt: string;
	course: string;
	wrong: number;
	misconception: boolean;
}

export async function weakQuestions(limit = 6): Promise<WeakQuestion[]> {
	return sql<WeakQuestion[]>`
		SELECT q.id, q.prompt, co.name AS course, c.wrong_count AS wrong, c.misconception
		FROM card c JOIN question q ON q.id = c.question_id JOIN course co ON co.id = q.course_id
		WHERE NOT q.flagged AND NOT co.archived AND (c.wrong_count > 0 OR c.misconception)
		ORDER BY c.misconception DESC, (NOT c.last_ok) DESC, c.wrong_count DESC, c.stability ASC
		LIMIT ${limit}`;
}

export async function counts() {
	const [r] = await sql<{ due: number; fresh: number; misconceptions: number; leeches: number; flagged: number }[]>`
		SELECT
			count(*) FILTER (WHERE c.question_id IS NOT NULL AND c.due <= now() AND NOT q.flagged)::int AS due,
			count(*) FILTER (WHERE c.question_id IS NULL AND NOT q.flagged)::int AS fresh,
			count(*) FILTER (WHERE c.misconception AND NOT q.flagged)::int AS misconceptions,
			count(*) FILTER (WHERE c.wrong_count >= 5 AND NOT q.flagged)::int AS leeches,
			count(*) FILTER (WHERE q.flagged)::int AS flagged
		FROM question q JOIN course co ON co.id = q.course_id LEFT JOIN card c ON c.question_id = q.id
		WHERE NOT co.archived`;
	return r;
}
