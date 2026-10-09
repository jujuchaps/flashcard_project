// Répétition espacée adaptative (FSRS) et niveaux de maîtrise (docs/PLAN.md, 7.2 à 7.4).

import {
	createEmptyCard,
	fsrs,
	generatorParameters,
	Rating,
	State,
	type Card,
	type Grade
} from 'ts-fsrs';
import type { Confidence, Mastery } from '$lib/types';

const DAY = 86_400_000;

export function scheduler(retention = 0.9) {
	return fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true }));
}

/**
 * Note FSRS à partir du résultat et de la confiance (tableau 7.3) :
 * une bonne réponse devinée est traitée comme un échec, une hésitation comme « difficile ».
 */
export function ratingFor(correct: boolean, confidence: Confidence): Grade {
	if (!correct || confidence === 'devine') return Rating.Again;
	if (confidence === 'hesitant') return Rating.Hard;
	return Rating.Good;
}

/** Réussite au sens de la boucle de maîtrise : bonne réponse et pas devinée. */
export function countsAsSuccess(correct: boolean, confidence: Confidence): boolean {
	return correct && confidence !== 'devine';
}

export function review(card: Card | null, grade: Grade, now: Date, retention = 0.9): Card {
	return scheduler(retention).next(card ?? createEmptyCard(now), now, grade).card;
}

export function retrievability(card: Card, now: Date): number {
	if (card.state === State.New) return 0;
	return scheduler().get_retrievability(card, now, false);
}

export interface CardSummary {
	stability: number;
	lastOk: boolean;
	misconception: boolean;
}

/** Niveau affiché : Nouvelle → À retravailler / En apprentissage → Maîtrisée → Ancrée. */
export function masteryOf(c: CardSummary | null): Mastery {
	if (!c) return 'nouvelle';
	if (!c.lastOk || c.misconception) return 'fragile';
	if (c.stability >= 30) return 'ancree';
	if (c.stability >= 7) return 'maitrisee';
	return 'apprentissage';
}

/** Convertit une progression de l'artefact (boîte 0 à 4) en carte FSRS approximative. */
export function cardFromLegacy(
	p: { box: number; due: number; right?: number; wrong?: number },
	now: Date
): { card: Card; lastOk: boolean } {
	const intervals = [0, 1, 3, 7, 14];
	const box = Math.max(0, Math.min(4, Math.round(p.box || 0)));
	const right = Math.max(0, p.right ?? 0);
	const wrong = Math.max(0, p.wrong ?? 0);
	const interval = intervals[box];
	const due = new Date(Number.isFinite(p.due) && p.due > 0 ? p.due : now.getTime());
	const lastReview = new Date(due.getTime() - interval * DAY);
	const card: Card = {
		...createEmptyCard(lastReview),
		due,
		stability: box === 0 ? 0.5 : interval,
		difficulty: Math.min(10, Math.max(1, 5 + (wrong - right) * 0.5)),
		scheduled_days: interval,
		reps: right + wrong,
		lapses: wrong,
		state: box === 0 ? State.Relearning : State.Review,
		last_review: lastReview
	};
	return { card, lastOk: box > 0 };
}

export function cardToJson(card: Card) {
	return {
		...card,
		due: card.due.toISOString(),
		last_review: card.last_review ? card.last_review.toISOString() : null
	};
}

export function cardFromJson(j: Record<string, unknown>): Card {
	return {
		...(j as unknown as Card),
		due: new Date(j.due as string),
		last_review: j.last_review ? new Date(j.last_review as string) : undefined
	};
}
