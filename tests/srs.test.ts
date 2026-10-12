import { Rating, State } from 'ts-fsrs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/types', () => ({}));
const { cardFromJson, cardFromLegacy, cardToJson, countsAsSuccess, masteryOf, ratingFor, review } = await import(
	'../src/lib/server/srs'
);

describe('confiance', () => {
	it('une bonne réponse devinée compte comme un échec', () => {
		expect(ratingFor(true, 'devine')).toBe(Rating.Again);
		expect(countsAsSuccess(true, 'devine')).toBe(false);
	});
	it('hésitant = difficile, sûr = bien, raté = à revoir', () => {
		expect(ratingFor(true, 'hesitant')).toBe(Rating.Hard);
		expect(ratingFor(true, 'sur')).toBe(Rating.Good);
		expect(ratingFor(false, 'sur')).toBe(Rating.Again);
	});
});

describe('planification', () => {
	it('les intervalles s’allongent avec les réussites', () => {
		let now = new Date('2026-10-01T12:00:00Z');
		let card = review(null, Rating.Good, now);
		const intervals: number[] = [];
		for (let i = 0; i < 5; i++) {
			now = card.due;
			const next = review(card, Rating.Good, now);
			intervals.push((next.due.getTime() - now.getTime()) / 86_400_000);
			card = next;
		}
		for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
		expect(intervals.at(-1)!).toBeGreaterThan(14);
	});
	it('la carte survit à un aller-retour JSON', () => {
		const card = review(null, Rating.Good, new Date());
		const back = cardFromJson(JSON.parse(JSON.stringify(cardToJson(card))));
		expect(back.due.getTime()).toBe(card.due.getTime());
		expect(back.stability).toBe(card.stability);
	});
});

describe('niveaux de maîtrise', () => {
	it('suit les seuils de stabilité', () => {
		expect(masteryOf(null)).toBe('nouvelle');
		expect(masteryOf({ stability: 50, lastOk: false, misconception: false })).toBe('fragile');
		expect(masteryOf({ stability: 50, lastOk: true, misconception: true })).toBe('fragile');
		expect(masteryOf({ stability: 2, lastOk: true, misconception: false })).toBe('apprentissage');
		expect(masteryOf({ stability: 10, lastOk: true, misconception: false })).toBe('maitrisee');
		expect(masteryOf({ stability: 40, lastOk: true, misconception: false })).toBe('ancree');
	});
});

describe('progression de l’artefact', () => {
	it('convertit les boîtes en cartes', () => {
		const now = new Date('2026-10-09T12:00:00Z');
		const due = now.getTime() + 3 * 86_400_000;
		const { card, lastOk } = cardFromLegacy({ box: 3, due, right: 3, wrong: 1 }, now);
		expect(lastOk).toBe(true);
		expect(card.state).toBe(State.Review);
		expect(card.stability).toBe(7);
		expect(card.due.getTime()).toBe(due);
		const weak = cardFromLegacy({ box: 0, due: now.getTime(), wrong: 2 }, now);
		expect(weak.lastOk).toBe(false);
		expect(masteryOf({ stability: weak.card.stability, lastOk: weak.lastOk, misconception: false })).toBe('fragile');
	});
});

describe('certitude non demandée', () => {
	it('une bonne réponse compte normalement, une mauvaise est à revoir', () => {
		expect(ratingFor(true, 'non')).toBe(Rating.Good);
		expect(ratingFor(false, 'non')).toBe(Rating.Again);
		expect(countsAsSuccess(true, 'non')).toBe(true);
	});
});
