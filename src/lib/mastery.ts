// Boucle de maîtrise à l'intérieur d'une série (docs/PLAN.md, section 7.1).
// Fonctions pures : l'état est sérialisé en JSON dans la base entre deux réponses.

export interface PoolEntry {
	id: number;
	chapterId: number;
	concept: string;
}

export interface SeriesItem extends PoolEntry {
	attempts: number;
	fails: number;
	/** Réussites consécutives depuis le dernier échec. */
	streak: number;
	/** Réussites consécutives nécessaires pour régler la question. */
	needed: number;
	done: boolean;
	firstOk: boolean | null;
	origin: 'initiale' | 'renfort' | 'concept';
}

export type SeriesEvent =
	| { kind: 'renfort'; chapterId: number; count: number }
	| { kind: 'concept'; concept: string }
	| { kind: 'double' }
	| { kind: 'plafond' };

export interface SeriesState {
	initialSize: number;
	maxSize: number;
	items: SeriesItem[];
	/** Ids des questions à venir ; queue[0] est la question en cours. */
	queue: number[];
	/** Réserve pour les renforcements, par ordre de priorité. */
	pool: PoolEntry[];
	reinforced: number[];
	capNotified: boolean;
	events: SeriesEvent[];
}

export const RULES = {
	/** Une question ratée revient après 3 à 5 autres questions. */
	gapMin: 3,
	gapMax: 5,
	/** Renforcement : au moins 3 échecs au premier essai, ou 40 % sur au moins 3 questions. */
	reinforceFails: 3,
	reinforceRatio: 0.4,
	reinforceMinSeen: 3,
	reinforceCount: 5,
	/** Une série ne peut pas dépasser 2 fois sa taille de départ (au moins +3). */
	growthFactor: 2,
	growthMin: 3
};

export type Rng = () => number;

function newItem(e: PoolEntry, origin: SeriesItem['origin']): SeriesItem {
	return { ...e, attempts: 0, fails: 0, streak: 0, needed: 1, done: false, firstOk: null, origin };
}

export function createSeries(initial: PoolEntry[], pool: PoolEntry[]): SeriesState {
	const ids = new Set(initial.map((e) => e.id));
	return {
		initialSize: initial.length,
		maxSize: Math.max(initial.length * RULES.growthFactor, initial.length + RULES.growthMin),
		items: initial.map((e) => newItem(e, 'initiale')),
		queue: initial.map((e) => e.id),
		pool: pool.filter((e) => !ids.has(e.id)),
		reinforced: [],
		capNotified: false,
		events: []
	};
}

function gap(rng: Rng): number {
	return RULES.gapMin + Math.floor(rng() * (RULES.gapMax - RULES.gapMin + 1));
}

function insertAt(queue: number[], id: number, pos: number) {
	queue.splice(Math.min(pos, queue.length), 0, id);
}

function canGrow(s: SeriesState): boolean {
	return s.items.length < s.maxSize;
}

function takeFromPool(s: SeriesState, filter: (e: PoolEntry) => boolean, n: number): PoolEntry[] {
	const out: PoolEntry[] = [];
	for (let i = 0; i < s.pool.length && out.length < n; ) {
		if (filter(s.pool[i])) out.push(s.pool.splice(i, 1)[0]);
		else i++;
	}
	return out;
}

function maybeReinforce(s: SeriesState, chapterId: number, rng: Rng) {
	if (s.reinforced.includes(chapterId)) return;
	const firsts = s.items.filter((i) => i.chapterId === chapterId && i.firstOk !== null);
	const fails = firsts.filter((i) => i.firstOk === false).length;
	const triggered =
		fails >= RULES.reinforceFails ||
		(firsts.length >= RULES.reinforceMinSeen && fails / firsts.length >= RULES.reinforceRatio);
	if (!triggered) return;
	s.reinforced.push(chapterId);
	const room = Math.min(RULES.reinforceCount, s.maxSize - s.items.length);
	if (room <= 0) return;
	const added = takeFromPool(s, (e) => e.chapterId === chapterId, room);
	if (!added.length) return;
	for (const e of added) {
		s.items.push(newItem(e, 'renfort'));
		// Réparties dans la suite de la série, jamais en position immédiate.
		const pos = 1 + Math.floor(rng() * Math.max(1, s.queue.length));
		insertAt(s.queue, e.id, pos);
	}
	s.events.push({ kind: 'renfort', chapterId, count: added.length });
}

/**
 * Applique la réponse à la question en cours (queue[0]).
 * `correct` est le résultat final (après la confiance : une réponse devinée compte comme ratée).
 */
export function applyAnswer(
	state: SeriesState,
	questionId: number,
	correct: boolean,
	rng: Rng = Math.random
): SeriesState {
	const s: SeriesState = structuredClone(state);
	s.events = [];
	if (s.queue[0] !== questionId) throw new Error('Cette question n’est pas la question en cours.');
	const item = s.items.find((i) => i.id === questionId);
	if (!item) throw new Error('Question absente de la série.');
	s.queue.shift();
	const first = item.attempts === 0;
	item.attempts++;
	if (first) item.firstOk = correct;

	if (correct) {
		item.streak++;
		if (item.streak >= item.needed) item.done = true;
		else insertAt(s.queue, item.id, gap(rng));
	} else {
		item.fails++;
		item.streak = 0;
		if (item.fails === 2) {
			item.needed = 2;
			s.events.push({ kind: 'double' });
			if (item.concept && canGrow(s)) {
				const inSeries = new Set(s.items.map((i) => i.id));
				const [sib] = takeFromPool(
					s,
					(e) => e.concept === item.concept && e.chapterId === item.chapterId && !inSeries.has(e.id),
					1
				);
				if (sib) {
					s.items.push(newItem(sib, 'concept'));
					insertAt(s.queue, sib.id, gap(rng) + 1);
					s.events.push({ kind: 'concept', concept: item.concept });
				}
			}
		}
		insertAt(s.queue, item.id, gap(rng));
	}

	if (first && !correct) maybeReinforce(s, item.chapterId, rng);
	if (!canGrow(s) && !s.capNotified && s.items.length > s.initialSize) {
		s.capNotified = true;
		s.events.push({ kind: 'plafond' });
	}
	return s;
}

export function progress(s: SeriesState) {
	const done = s.items.filter((i) => i.done).length;
	const firsts = s.items.filter((i) => i.firstOk !== null);
	return {
		total: s.items.length,
		done,
		remaining: s.items.length - done,
		firstTryCount: firsts.length,
		firstTryOk: firsts.filter((i) => i.firstOk).length,
		finished: s.queue.length === 0
	};
}
