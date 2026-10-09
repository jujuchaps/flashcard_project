import { DEVELOPPEMENT_SEUIL, grade } from '$lib/grading';
import { applyAnswer, createSeries, finishNow, progress, type PoolEntry, type SeriesState } from '$lib/mastery';
import type { Answer, Confidence, Payload, QuizQuestion } from '$lib/types';
import { getSetting, sql } from './db';
import { dailyPlan, evaluationScope, examMoment, listEvaluations, readinessOf } from './planning';
import { cardFromJson, cardToJson, countsAsSuccess, ratingFor, retrievability, review } from './srs';

export type SeriesMode = 'revision' | 'cible' | 'erreurs' | 'sprint' | 'examen';

export interface SeriesParams {
	mode: SeriesMode;
	count: number;
	courseIds?: number[];
	chapterIds?: number[];
	/** Sprint et examen blanc : l'évaluation visée. */
	evaluationId?: number;
	/** Examen blanc : durée en minutes (0 = sans limite). */
	durationMin?: number;
}

interface Candidate extends PoolEntry {
	courseId: number;
	position: number;
	chapterPosition: number;
	card: {
		fsrs: Record<string, unknown>;
		due: Date;
		last_ok: boolean;
		misconception: boolean;
		wrong_count: number;
		stability: number;
	} | null;
}

async function loadCandidates(p: SeriesParams): Promise<Candidate[]> {
	const courseFilter = p.courseIds?.length ? sql`AND q.course_id = ANY(${p.courseIds})` : sql``;
	const chapterFilter = p.chapterIds?.length ? sql`AND q.chapter_id = ANY(${p.chapterIds})` : sql``;
	const rows = await sql<
		{
			id: number;
			chapter_id: number;
			course_id: number;
			concept: string;
			position: number;
			chapter_position: number;
			fsrs: Record<string, unknown> | null;
			due: Date | null;
			last_ok: boolean | null;
			misconception: boolean | null;
			wrong_count: number | null;
			stability: number | null;
		}[]
	>`
		SELECT q.id, q.chapter_id, q.course_id, q.concept, q.position, ch.position AS chapter_position,
			c.fsrs, c.due, c.last_ok, c.misconception, c.wrong_count, c.stability
		FROM question q
		JOIN chapter ch ON ch.id = q.chapter_id
		JOIN course co ON co.id = q.course_id
		LEFT JOIN card c ON c.question_id = q.id
		WHERE NOT q.flagged AND NOT co.archived ${courseFilter} ${chapterFilter}`;
	return rows.map((r) => ({
		id: r.id,
		chapterId: r.chapter_id,
		courseId: r.course_id,
		concept: r.concept,
		position: r.position,
		chapterPosition: r.chapter_position,
		card: r.fsrs
			? {
					fsrs: r.fsrs,
					due: r.due!,
					last_ok: r.last_ok!,
					misconception: r.misconception!,
					wrong_count: r.wrong_count!,
					stability: r.stability!
				}
			: null
	}));
}

function shuffle<T>(a: T[]): T[] {
	const b = a.slice();
	for (let i = b.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[b[i], b[j]] = [b[j], b[i]];
	}
	return b;
}

/** Mélange en évitant deux questions du même concept côte à côte (entrelacement). */
function interleave(list: Candidate[]): Candidate[] {
	const out = shuffle(list);
	for (let i = 1; i < out.length; i++) {
		if (out[i].concept && out[i].concept === out[i - 1].concept) {
			const j = out.findIndex((x, k) => k > i && x.concept !== out[i].concept);
			if (j > 0) [out[i], out[j]] = [out[j], out[i]];
		}
	}
	return out;
}

/** Nouvelles questions dans l'ordre du cours, en alternant les cours. */
function orderNew(list: Candidate[]): Candidate[] {
	const byCourse = new Map<number, Candidate[]>();
	for (const c of list.sort(
		(a, b) => a.chapterPosition - b.chapterPosition || a.position - b.position
	)) {
		if (!byCourse.has(c.courseId)) byCourse.set(c.courseId, []);
		byCourse.get(c.courseId)!.push(c);
	}
	const queues = shuffle([...byCourse.values()]);
	const out: Candidate[] = [];
	while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!);
	return out;
}

function urgency(c: Candidate, now: Date): number {
	if (!c.card) return 0;
	return 1 - retrievability(cardFromJson(c.card.fsrs), now);
}

async function evaluationOf(p: SeriesParams) {
	if (!p.evaluationId) throw new Error('Évaluation manquante.');
	const [ev] = (await listEvaluations()).filter((e) => e.id === p.evaluationId);
	if (!ev) throw new Error('Évaluation introuvable.');
	return ev;
}

export async function selectQuestions(p: SeriesParams, now = new Date()) {
	if (p.mode === 'sprint' || p.mode === 'examen') {
		const ev = await evaluationOf(p);
		p = { ...p, courseIds: [ev.courseId], chapterIds: ev.chapterIds };
	}
	const all = await loadCandidates(p);
	const count = Math.max(1, Math.min(200, p.count));
	const seen = all.filter((c) => c.card);
	const fresh = orderNew(all.filter((c) => !c.card));
	const fragile = seen
		.filter((c) => c.card!.misconception || !c.card!.last_ok)
		.sort((a, b) => Number(b.card!.misconception) - Number(a.card!.misconception) || urgency(b, now) - urgency(a, now));
	const due = seen
		.filter((c) => c.card!.last_ok && !c.card!.misconception && c.card!.due <= now)
		.sort((a, b) => urgency(b, now) - urgency(a, now));
	const notDue = seen
		.filter((c) => c.card!.last_ok && !c.card!.misconception && c.card!.due > now)
		.sort((a, b) => urgency(b, now) - urgency(a, now));

	let chosen: Candidate[];
	if (p.mode === 'revision') {
		// Les nouvelles questions des examens les plus proches passent en premier, selon le plan du jour.
		const plan = await dailyPlan(now);
		const newQuota = Math.max(await getSetting('newPerSeries', 10), plan.newToday);
		const freshByExam = [...fresh].sort(
			(a, b) => (plan.examNew.get(a.id) ?? Infinity) - (plan.examNew.get(b.id) ?? Infinity)
		);
		const reviews = [...fragile.filter((c) => c.card!.due <= now || c.card!.misconception), ...due].slice(0, count);
		chosen = [...reviews, ...freshByExam.slice(0, Math.max(0, Math.min(newQuota, count - reviews.length)))];
	} else if (p.mode === 'sprint') {
		// Ce qui risque le plus d'être oublié le jour de l'examen, puis le jamais vu.
		const ev = await evaluationOf(p);
		const r = readinessOf(await evaluationScope(ev), examMoment(ev.date)).byQuestion;
		const risk = seen.sort((a, b) => (r.get(a.id) ?? 0) - (r.get(b.id) ?? 0)).filter((c) => (r.get(c.id) ?? 0) < 0.95);
		chosen = [...risk, ...fresh].slice(0, count);
	} else if (p.mode === 'examen') {
		chosen = shuffle(all).slice(0, count);
	} else if (p.mode === 'erreurs') {
		const leeches = notDue.filter((c) => c.card!.wrong_count >= 3 && c.card!.stability < 7);
		chosen = [...fragile, ...leeches].slice(0, count);
	} else {
		chosen = [...fragile, ...due, ...fresh, ...notDue].slice(0, count);
	}
	if (p.mode === 'examen') return { initial: chosen.map((c) => ({ id: c.id, chapterId: c.chapterId, concept: c.concept })), pool: [] };
	const ids = new Set(chosen.map((c) => c.id));
	const pool = [...fresh, ...fragile, ...due, ...notDue].filter((c) => !ids.has(c.id));
	const strip = (c: Candidate): PoolEntry => ({ id: c.id, chapterId: c.chapterId, concept: c.concept });
	return { initial: interleave(chosen).map(strip), pool: pool.map(strip) };
}

export async function startSeries(p: SeriesParams): Promise<number | null> {
	const { initial, pool } = await selectQuestions(p);
	if (!initial.length) return null;
	await sql`UPDATE series SET abandoned = true WHERE finished_at IS NULL AND NOT abandoned`;
	const state = createSeries(initial, pool, { exam: p.mode === 'examen' });
	const [row] = await sql<{ id: number }[]>`
		INSERT INTO series (mode, params, state) VALUES (${p.mode}, ${sql.json(p as never)}, ${sql.json(state as never)})
		RETURNING id`;
	return row.id;
}

export async function loadQuestion(id: number): Promise<QuizQuestion | null> {
	const [r] = await sql<
		{
			id: number;
			course_name: string;
			chapter_name: string;
			source: string | null;
			concept: string;
			prompt: string;
			explanation: string;
			slide: number | null;
			payload: Payload;
		}[]
	>`
		SELECT q.id, co.name AS course_name, ch.name AS chapter_name, ch.source, q.concept, q.prompt,
			q.explanation, q.slide, q.payload
		FROM question q JOIN chapter ch ON ch.id = q.chapter_id JOIN course co ON co.id = q.course_id
		WHERE q.id = ${id}`;
	if (!r) return null;
	return {
		id: r.id,
		courseName: r.course_name,
		chapterName: r.chapter_name,
		source: r.source,
		concept: r.concept,
		prompt: r.prompt,
		explanation: r.explanation,
		slide: r.slide,
		payload: r.payload
	};
}

async function chapterNames(ids: number[]): Promise<Record<number, string>> {
	if (!ids.length) return {};
	const rows = await sql<{ id: number; name: string; course: string }[]>`
		SELECT ch.id, ch.name, co.name AS course FROM chapter ch JOIN course co ON co.id = ch.course_id
		WHERE ch.id = ANY(${ids})`;
	return Object.fromEntries(
		rows.map((r) => [r.id, r.name === 'Questions de l’artefact' || r.name === 'Général' ? r.course : `${r.course} : ${r.name}`])
	);
}

export interface SeriesView {
	id: number;
	mode: SeriesMode;
	progress: ReturnType<typeof progress>;
	current: (QuizQuestion & { attempts: number; needed: number; streak: number; origin: string }) | null;
	notices: string[];
	missed: { prompt: string; course: string; payload: Payload; explanation: string }[] | null;
	/** Examen blanc terminé : toutes les questions avec le résultat. */
	review: { prompt: string; course: string; payload: Payload; explanation: string; ok: boolean | null }[] | null;
	askConfidence: boolean;
	exam: { title: string; endsAt: string | null } | null;
}

async function examInfo(params: SeriesParams, createdAt: Date): Promise<SeriesView['exam']> {
	const ev = params.evaluationId ? (await listEvaluations()).find((e) => e.id === params.evaluationId) : null;
	const ends = params.durationMin ? new Date(createdAt.getTime() + params.durationMin * 60_000).toISOString() : null;
	return { title: ev ? `Examen blanc : ${ev.name}` : 'Examen blanc', endsAt: ends };
}

async function buildView(
	id: number,
	mode: SeriesMode,
	state: SeriesState,
	meta: { params: SeriesParams; createdAt: Date }
): Promise<SeriesView> {
	const prog = progress(state);
	const names = await chapterNames([
		...new Set(state.events.filter((e) => e.kind === 'renfort').map((e) => (e as { chapterId: number }).chapterId))
	]);
	const notices = state.events.map((e) => {
		switch (e.kind) {
			case 'renfort':
				return `Renforcement : +${e.count} question${e.count > 1 ? 's' : ''} sur « ${names[e.chapterId] ?? 'ce chapitre'} ».`;
			case 'concept':
				return `Une autre question sur « ${e.concept} » a été ajoutée.`;
			case 'double':
				return 'Ratée 2 fois : il faudra la réussir 2 fois de suite.';
			case 'plafond':
				return 'La série a atteint sa taille maximale : plus aucun ajout. Tu peux arrêter quand tu veux, les questions non réglées reviendront en premier.';
		}
	});
	let current: SeriesView['current'] = null;
	if (state.queue.length) {
		const q = await loadQuestion(state.queue[0]);
		const item = state.items.find((i) => i.id === state.queue[0])!;
		if (q) current = { ...q, attempts: item.attempts, needed: item.needed, streak: item.streak, origin: item.origin };
	}
	let missed: SeriesView['missed'] = null;
	let review: SeriesView['review'] = null;
	if (prog.finished && state.exam) {
		review = [];
		for (const item of state.items) {
			const q = await loadQuestion(item.id);
			if (q) review.push({ prompt: q.prompt, course: q.courseName, payload: q.payload, explanation: q.explanation, ok: item.firstOk });
		}
	} else if (prog.finished) {
		const ids = state.items.filter((i) => i.firstOk === false).map((i) => i.id);
		missed = [];
		for (const qid of ids) {
			const q = await loadQuestion(qid);
			if (q) missed.push({ prompt: q.prompt, course: q.courseName, payload: q.payload, explanation: q.explanation });
		}
	}
	return {
		id,
		mode,
		progress: prog,
		current,
		notices,
		missed,
		review,
		askConfidence: !state.exam && (await getSetting('askConfidence', true)),
		exam: state.exam ? await examInfo(meta.params, meta.createdAt) : null
	};
}

export async function getSeries(id: number): Promise<SeriesView | null> {
	const [row] = await sql<{ id: number; mode: SeriesMode; state: SeriesState; params: SeriesParams; created_at: Date }[]>`
		SELECT id, mode, state, params, created_at FROM series WHERE id = ${id}`;
	if (!row) return null;
	return buildView(row.id, row.mode, { ...row.state, events: [] }, { params: row.params, createdAt: row.created_at });
}

export interface AnswerInput {
	questionId: number;
	answer: Answer;
	confidence: Confidence;
	override?: boolean;
	/** Développement : éléments clés corrigés à la main par l'étudiant. */
	adjusted?: boolean[];
	durationMs?: number;
}

export async function answerSeries(id: number, input: AnswerInput): Promise<SeriesView> {
	const now = new Date();
	const view = await sql.begin(async (tx) => {
		const [row] = await tx<
			{ id: number; mode: SeriesMode; state: SeriesState; finished_at: Date | null; params: SeriesParams; created_at: Date }[]
		>`SELECT id, mode, state, finished_at, params, created_at FROM series WHERE id = ${id} FOR UPDATE`;
		if (!row) throw new Error('Série introuvable.');
		const state = row.state;
		if (state.queue[0] !== input.questionId) throw new Error('Cette question n’est plus la question en cours.');
		const item = state.items.find((i) => i.id === input.questionId)!;
		const [q] = await tx<{ payload: Payload; type: string }[]>`SELECT payload, type FROM question WHERE id = ${input.questionId}`;
		const result = grade(q.payload, input.answer);
		let manual = !!input.override;
		if (q.payload.type === 'developpement' && Array.isArray(input.adjusted) && input.adjusted.length === q.payload.elements.length) {
			const total = q.payload.elements.reduce((s, e) => s + e.points, 0) || 1;
			result.score = q.payload.elements.reduce((s, e, i) => s + (input.adjusted![i] ? e.points : 0), 0) / total;
			result.correct = result.score >= DEVELOPPEMENT_SEUIL;
			manual = true;
		}
		const correct = result.correct || !!input.override;
		const confidence: Confidence = ['sur', 'hesitant', 'devine'].includes(input.confidence) ? input.confidence : 'sur';
		const success = countsAsSuccess(correct, confidence);
		const firstTry = item.attempts === 0;

		if (firstTry) {
			const [c] = await tx<{ fsrs: Record<string, unknown>; misconception: boolean }[]>`
				SELECT fsrs, misconception FROM card WHERE question_id = ${input.questionId}`;
			const retention = await getSetting('retention', 0.9);
			const card = review(c ? cardFromJson(c.fsrs) : null, ratingFor(correct, confidence), now, retention);
			const misconception = !correct && confidence === 'sur' ? true : correct && confidence === 'sur' ? false : (c?.misconception ?? false);
			await tx`INSERT INTO card (question_id, fsrs, due, stability, last_ok, misconception, right_count, wrong_count, last_reviewed_at)
				VALUES (${input.questionId}, ${tx.json(cardToJson(card) as never)}, ${card.due}, ${card.stability}, ${success},
					${misconception}, ${correct ? 1 : 0}, ${correct ? 0 : 1}, ${now})
				ON CONFLICT (question_id) DO UPDATE SET fsrs = EXCLUDED.fsrs, due = EXCLUDED.due, stability = EXCLUDED.stability,
					last_ok = EXCLUDED.last_ok, misconception = EXCLUDED.misconception,
					right_count = card.right_count + EXCLUDED.right_count, wrong_count = card.wrong_count + EXCLUDED.wrong_count,
					last_reviewed_at = EXCLUDED.last_reviewed_at`;
		}

		// « J'avais raison » sur une réponse courte : la formulation devient une variante acceptée.
		if (input.override && !result.correct && q.payload.type === 'courte' && input.answer.type === 'courte') {
			const variant = input.answer.texte.trim();
			if (variant) {
				const payload = { ...q.payload, reponses: [...q.payload.reponses, variant] };
				await tx`UPDATE question SET payload = ${tx.json(payload as never)}, updated_at = now() WHERE id = ${input.questionId}`;
			}
		}

		await tx`INSERT INTO attempt (question_id, series_id, at, first_try, correct, score, confidence, overridden, answer, duration_ms)
			VALUES (${input.questionId}, ${id}, ${now}, ${firstTry}, ${correct}, ${input.override ? 1 : result.score}, ${confidence},
				${manual}, ${tx.json(input.answer as never)}, ${input.durationMs ?? null})`;

		const next = applyAnswer(state, input.questionId, success);
		const finished = next.queue.length === 0;
		await tx`UPDATE series SET state = ${tx.json(next as never)}, finished_at = ${finished ? now : null} WHERE id = ${id}`;
		return { mode: row.mode, state: next, params: row.params, createdAt: row.created_at };
	});
	return buildView(id, view.mode, view.state, view);
}

/** Retire la question en cours de la série (après un signalement). */
export async function skipCurrent(id: number, questionId: number) {
	await sql.begin(async (tx) => {
		const [row] = await tx<{ state: SeriesState }[]>`SELECT state FROM series WHERE id = ${id} FOR UPDATE`;
		if (!row || row.state.queue[0] !== questionId) return;
		const state = row.state;
		state.queue = state.queue.filter((q) => q !== questionId);
		const item = state.items.find((i) => i.id === questionId);
		if (item) {
			item.done = true;
			if (item.firstOk === null) state.items = state.items.filter((i) => i.id !== questionId);
		}
		state.events = [];
		await tx`UPDATE series SET state = ${tx.json(state as never)}, finished_at = ${state.queue.length ? null : new Date()} WHERE id = ${id}`;
	});
}

/** Termine la série maintenant (fin du temps d'un examen blanc). */
export async function finishSeries(id: number): Promise<SeriesView | null> {
	await sql.begin(async (tx) => {
		const [row] = await tx<{ state: SeriesState }[]>`SELECT state FROM series WHERE id = ${id} FOR UPDATE`;
		if (!row) return;
		await tx`UPDATE series SET state = ${tx.json(finishNow(row.state) as never)}, finished_at = coalesce(finished_at, now()) WHERE id = ${id}`;
	});
	return getSeries(id);
}

export async function currentSeriesId(): Promise<number | null> {
	const [row] = await sql<{ id: number }[]>`
		SELECT id FROM series WHERE finished_at IS NULL AND NOT abandoned ORDER BY id DESC LIMIT 1`;
	return row?.id ?? null;
}
