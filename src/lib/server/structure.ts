// Sessions, cours, chapitres et horaire : lecture et réorganisation.

import type { Slot } from '$lib/schedule';
import { sql } from './db';

export interface SessionInfo {
	id: number;
	name: string;
	active: boolean;
	courses: number;
	questions: number;
}

export async function listSessions(): Promise<SessionInfo[]> {
	return sql<SessionInfo[]>`
		SELECT s.id, s.name, s.active,
			(SELECT count(*)::int FROM course co WHERE co.session_id = s.id AND NOT co.archived) AS courses,
			(SELECT count(*)::int FROM question q JOIN course co ON co.id = q.course_id WHERE co.session_id = s.id) AS questions
		FROM study_session s ORDER BY s.active DESC, s.id DESC`;
}

export async function getSession(id: number) {
	const [s] = await sql<{ id: number; name: string; active: boolean }[]>`
		SELECT id, name, active FROM study_session WHERE id = ${id}`;
	return s ?? null;
}

export async function slotsFor(courseIds: number[]): Promise<Slot[]> {
	if (!courseIds.length) return [];
	return sql<Slot[]>`
		SELECT id, course_id AS "courseId", weekday, to_char(starts, 'HH24:MI') AS starts, to_char(ends, 'HH24:MI') AS ends, room, kind
		FROM course_slot WHERE course_id = ANY(${courseIds}) ORDER BY weekday, starts`;
}

/** Créneaux des cours de la session en cours. */
export async function activeSlots(): Promise<(Slot & { courseName: string })[]> {
	return sql<(Slot & { courseName: string })[]>`
		SELECT sl.id, sl.course_id AS "courseId", sl.weekday, to_char(sl.starts, 'HH24:MI') AS starts,
			to_char(sl.ends, 'HH24:MI') AS ends, sl.room, sl.kind, co.name AS "courseName"
		FROM course_slot sl JOIN course co ON co.id = sl.course_id
		JOIN study_session s ON s.id = co.session_id
		WHERE s.active AND NOT co.archived ORDER BY sl.weekday, sl.starts`;
}

export interface CourseInfo {
	id: number;
	code: string;
	name: string;
	number: string | null;
	teacher: string | null;
	archived: boolean;
	sessionId: number | null;
	sessionName: string | null;
}

export async function getCourse(id: number): Promise<CourseInfo | null> {
	const [c] = await sql<CourseInfo[]>`
		SELECT co.id, co.code, co.name, co.number, co.teacher, co.archived, co.session_id AS "sessionId", s.name AS "sessionName"
		FROM course co LEFT JOIN study_session s ON s.id = co.session_id WHERE co.id = ${id}`;
	return c ?? null;
}

export async function allCourses() {
	return sql<{ id: number; name: string; sessionName: string | null }[]>`
		SELECT co.id, co.name, s.name AS "sessionName" FROM course co LEFT JOIN study_session s ON s.id = co.session_id
		WHERE NOT co.archived ORDER BY co.session_id NULLS LAST, co.position, co.name`;
}

/** Nom libre pour un chapitre dans un cours (ajoute « (2) », « (3) »… au besoin). */
async function freeChapterName(tx: typeof sql, courseId: number, name: string): Promise<string> {
	const rows = await tx<{ name: string }[]>`SELECT name FROM chapter WHERE course_id = ${courseId}`;
	const taken = new Set(rows.map((r) => r.name));
	if (!taken.has(name)) return name;
	for (let i = 2; ; i++) if (!taken.has(`${name} (${i})`)) return `${name} (${i})`;
}

export class MoveError extends Error {}

/** Déplace un chapitre (et ses questions) vers un autre cours. */
export async function moveChapter(chapterId: number, targetCourseId: number) {
	await sql.begin(async (tx) => {
		const [ch] = await tx<{ course_id: number; name: string }[]>`SELECT course_id, name FROM chapter WHERE id = ${chapterId}`;
		if (!ch) throw new MoveError('Chapitre introuvable.');
		if (ch.course_id === targetCourseId) return;
		const [{ n }] = await tx<{ n: number }[]>`
			SELECT count(*)::int AS n FROM question a JOIN question b ON b.dedup_key = a.dedup_key
			WHERE a.chapter_id = ${chapterId} AND b.course_id = ${targetCourseId}`;
		if (n) throw new MoveError(`${n} question(s) de ce chapitre existent déjà dans le cours visé. Supprime les doublons d’abord.`);
		const name = await freeChapterName(tx as unknown as typeof sql, targetCourseId, ch.name);
		await tx`UPDATE chapter SET course_id = ${targetCourseId}, name = ${name},
			position = (SELECT coalesce(max(position), 0) + 1 FROM chapter WHERE course_id = ${targetCourseId})
			WHERE id = ${chapterId}`;
		await tx`UPDATE question SET course_id = ${targetCourseId} WHERE chapter_id = ${chapterId}`;
		// Une évaluation qui ne visait que ce chapitre suit le chapitre.
		await tx`UPDATE evaluation SET course_id = ${targetCourseId}
			WHERE course_id = ${ch.course_id} AND chapter_ids = ARRAY[${chapterId}]::int[]`;
		await tx`UPDATE evaluation SET chapter_ids = array_remove(chapter_ids, ${chapterId})
			WHERE course_id = ${ch.course_id} AND ${chapterId} = ANY(chapter_ids)`;
	});
}

/** Fusionne un cours dans un autre : ses chapitres, questions et examens y sont déplacés. */
export async function mergeCourse(sourceId: number, targetId: number) {
	if (sourceId === targetId) throw new MoveError('Choisis un autre cours.');
	const chapters = await sql<{ id: number }[]>`SELECT id FROM chapter WHERE course_id = ${sourceId} ORDER BY position, id`;
	const [{ n }] = await sql<{ n: number }[]>`
		SELECT count(*)::int AS n FROM question a JOIN question b ON b.dedup_key = a.dedup_key
		WHERE a.course_id = ${sourceId} AND b.course_id = ${targetId}`;
	if (n) throw new MoveError(`${n} question(s) existent déjà dans le cours visé. Supprime les doublons d’abord.`);
	for (const ch of chapters) await moveChapter(ch.id, targetId);
	await sql.begin(async (tx) => {
		await tx`UPDATE evaluation SET course_id = ${targetId} WHERE course_id = ${sourceId}`;
		await tx`DELETE FROM course WHERE id = ${sourceId}`;
	});
}

export function codeFrom(name: string): string {
	return (
		name
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 20) || 'cours'
	);
}
