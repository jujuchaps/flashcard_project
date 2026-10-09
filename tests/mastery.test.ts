import { describe, expect, it } from 'vitest';
import { applyAnswer, createSeries, progress, RULES, type PoolEntry, type SeriesState } from '../src/lib/mastery';

const entry = (id: number, chapterId = 1, concept = ''): PoolEntry => ({ id, chapterId, concept });
const fixed = () => 0; // écart minimal (3)

function answer(s: SeriesState, ok: boolean) {
	return applyAnswer(s, s.queue[0], ok, fixed);
}

describe('boucle de maîtrise', () => {
	it('une question réussie du premier coup est réglée', () => {
		let s = createSeries([entry(1), entry(2)], []);
		s = answer(s, true);
		expect(s.queue).toEqual([2]);
		expect(progress(s).done).toBe(1);
	});

	it('une question ratée revient après 3 autres questions, pas immédiatement', () => {
		let s = createSeries([1, 2, 3, 4, 5].map((i) => entry(i)), []);
		s = answer(s, false);
		expect(s.queue).toEqual([2, 3, 4, 1, 5]);
	});

	it('la série ne se termine pas tant que la question ratée n’est pas réussie', () => {
		let s = createSeries([entry(1)], []);
		s = answer(s, false);
		expect(progress(s).finished).toBe(false);
		expect(s.queue).toEqual([1]);
		s = answer(s, true);
		expect(progress(s).finished).toBe(true);
		expect(progress(s).firstTryOk).toBe(0);
	});

	it('ratée 2 fois : doit être réussie 2 fois de suite et une question du même concept est ajoutée', () => {
		let s = createSeries([entry(1, 1, 'Médiane'), entry(2, 1, 'Mode')], [entry(10, 1, 'Médiane'), entry(11, 1, 'Mode')]);
		s = answer(s, false); // 1 raté
		expect(s.queue[0]).toBe(2);
		s = answer(s, true); // 2 ok
		s = answer(s, false); // 1 raté 2e fois
		const item = s.items.find((i) => i.id === 1)!;
		expect(item.needed).toBe(2);
		expect(s.items.some((i) => i.id === 10 && i.origin === 'concept')).toBe(true);
		expect(s.events.map((e) => e.kind)).toContain('concept');
		while (s.queue[0] !== 1) s = answer(s, true);
		s = answer(s, true);
		expect(s.items.find((i) => i.id === 1)!.done).toBe(false);
		while (s.queue[0] !== 1) s = answer(s, true);
		s = answer(s, true);
		expect(s.items.find((i) => i.id === 1)!.done).toBe(true);
	});

	it('renforcement : 3 échecs au premier essai dans un chapitre ajoutent des questions de ce chapitre', () => {
		const initial = [1, 2, 3, 4, 5, 6].map((i) => entry(i, i <= 3 ? 1 : 2));
		const pool = [20, 21, 22, 23, 24, 25, 26].map((i) => entry(i, 1)).concat([entry(30, 2)]);
		let s = createSeries(initial, pool);
		s = answer(s, false);
		s = answer(s, false);
		expect(s.items.length).toBe(6);
		s = answer(s, false);
		const added = s.items.filter((i) => i.origin === 'renfort');
		expect(added).toHaveLength(RULES.reinforceCount);
		expect(added.every((i) => i.chapterId === 1)).toBe(true);
		expect(s.events).toContainEqual({ kind: 'renfort', chapterId: 1, count: 5 });
		// Une seule fois par chapitre.
		const before = s.items.length;
		while (s.queue.length && s.items.find((i) => i.id === s.queue[0])!.attempts === 0) s = answer(s, false);
		expect(s.items.filter((i) => i.origin === 'renfort' && i.chapterId === 1)).toHaveLength(5);
		expect(s.items.length).toBeGreaterThanOrEqual(before);
	});

	it('la série ne dépasse jamais 2 fois sa taille de départ', () => {
		const initial = [1, 2, 3].map((i) => entry(i, 1, 'c'));
		const pool = Array.from({ length: 30 }, (_, i) => entry(100 + i, 1, 'c'));
		let s = createSeries(initial, pool);
		for (let n = 0; n < 200 && s.queue.length; n++) s = answer(s, n % 3 !== 0 ? false : true);
		expect(s.items.length).toBeLessThanOrEqual(s.maxSize);
		expect(s.maxSize).toBe(6);
	});

	it('refuse une réponse à une question qui n’est pas en cours', () => {
		const s = createSeries([entry(1), entry(2)], []);
		expect(() => applyAnswer(s, 2, true)).toThrow();
	});

	it('ne modifie pas l’état reçu', () => {
		const s = createSeries([entry(1), entry(2)], []);
		const copy = structuredClone(s);
		applyAnswer(s, 1, false, fixed);
		expect(s).toEqual(copy);
	});
});

describe('examen blanc', () => {
	it('une seule tentative par question, sans reprise ni renforcement', () => {
		const initial = [1, 2, 3, 4].map((i) => entry(i, 1));
		let s = createSeries(initial, [entry(9, 1), entry(10, 1)], { exam: true });
		for (let k = 0; k < 4; k++) s = answer(s, false);
		expect(progress(s).finished).toBe(true);
		expect(s.items).toHaveLength(4);
		expect(progress(s).firstTryOk).toBe(0);
	});
	it('temps écoulé : les questions restantes sont non répondues', async () => {
		const { finishNow } = await import('../src/lib/mastery');
		let s = createSeries([1, 2, 3].map((i) => entry(i)), [], { exam: true });
		s = answer(s, true);
		s = finishNow(s);
		const p = progress(s);
		expect(p.finished).toBe(true);
		expect(p.unanswered).toBe(2);
		expect(p.firstTryOk).toBe(1);
	});
});
