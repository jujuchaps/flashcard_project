import { describe, expect, it } from 'vitest';
import { correctAnswerText, grade, matchText, normalizeAnswer, parseNumber, parseTrous } from '../src/lib/grading';

describe('matchText', () => {
	it('ignore majuscules, accents, ponctuation et article initial', () => {
		expect(matchText('  la Maïeutique! ', ['maïeutique'])).toBe(true);
		expect(matchText("L'Académie", ['Académie'])).toBe(true);
		expect(matchText('Junon', ['Junon'])).toBe(true);
	});
	it('tolère une petite faute dans les mots de 5 lettres et plus', () => {
		expect(matchText('Promethee', ['Prométhée'])).toBe(true);
		expect(matchText('Prometé', ['Prométhée'])).toBe(true); // 2 écarts, 9 lettres
		expect(matchText('Mars', ['Mard'])).toBe(false); // < 5 lettres : exact
	});
	it('exige une année exacte', () => {
		expect(matchText('1517', ['1517'])).toBe(true);
		expect(matchText('1518', ['1517'])).toBe(false);
	});
	it('accepte toutes les variantes listées', () => {
		expect(matchText('Sobieski', ['Jean III Sobieski', 'Sobieski'])).toBe(true);
	});
	it('refuse une réponse vide', () => {
		expect(matchText('   ', ['x'])).toBe(false);
	});
	it("ne retire pas l'article si c'est le seul mot", () => {
		expect(normalizeAnswer('la')).toBe('la');
	});
});

describe('parseNumber', () => {
	it('lit les formats français et anglais', () => {
		expect(parseNumber('25')).toBe(25);
		expect(parseNumber('25,5')).toBe(25.5);
		expect(parseNumber('1 234,5')).toBe(1234.5);
		expect(parseNumber('25 %')).toBe(25);
		expect(parseNumber('-0.5')).toBe(-0.5);
		expect(parseNumber('abc')).toBeNull();
	});
});

describe('grade', () => {
	it('qcm', () => {
		const p = { type: 'qcm' as const, choix: ['a', 'b'], reponse: 1 };
		expect(grade(p, { type: 'qcm', choix: 1 }).correct).toBe(true);
		expect(grade(p, { type: 'qcm', choix: 0 }).correct).toBe(false);
	});
	it('qcm_multi : tout ou rien avec score partiel', () => {
		const p = { type: 'qcm_multi' as const, choix: ['a', 'b', 'c', 'd'], reponses: [0, 2] };
		expect(grade(p, { type: 'qcm_multi', choix: [2, 0] }).correct).toBe(true);
		const partial = grade(p, { type: 'qcm_multi', choix: [0] });
		expect(partial.correct).toBe(false);
		expect(partial.score).toBe(0.75);
	});
	it('trous : trou par trou', () => {
		const p = { type: 'trous' as const, texte: 'Le traité de [[Tordesillas]] partage entre l’Espagne et le [[Portugal|Royaume du Portugal]].' };
		const r = grade(p, { type: 'trous', textes: ['tordesilla', 'France'] });
		expect(r.details).toEqual([true, false]);
		expect(r.score).toBe(0.5);
		expect(grade(p, { type: 'trous', textes: ['Tordesillas', 'royaume du portugal'] }).correct).toBe(true);
	});
	it('numérique avec tolérance', () => {
		const p = { type: 'numerique' as const, reponse: 25, tolerance: 0.5, unite: '%' };
		expect(grade(p, { type: 'numerique', texte: '25,4' }).correct).toBe(true);
		expect(grade(p, { type: 'numerique', texte: '26' }).correct).toBe(false);
		expect(grade(p, { type: 'numerique', texte: '' }).correct).toBe(false);
	});
	it('association et ordre', () => {
		const a = { type: 'association' as const, paires: [['A', '1'], ['B', '2'], ['C', '3']] as [string, string][] };
		expect(grade(a, { type: 'association', droite: [0, 1, 2] }).correct).toBe(true);
		expect(grade(a, { type: 'association', droite: [1, 0, 2] }).score).toBeCloseTo(1 / 3);
		const o = { type: 'ordre' as const, elements: ['x', 'y', 'z'] };
		expect(grade(o, { type: 'ordre', ordre: [0, 1, 2] }).correct).toBe(true);
		expect(grade(o, { type: 'ordre', ordre: [1, 0, 2] }).correct).toBe(false);
	});
	it('développement : points par élément clé, seuil de 80 %', () => {
		const p = {
			type: 'developpement' as const,
			reponse_modele: '…',
			elements: [
				{ idee: 'mesure', mots: ['mesure de toutes choses'], points: 2 },
				{ idee: 'relatif', mots: ['relatif', 'relativisme', 'relative'], points: 2 },
				{ idee: 'contradiction', mots: ['contradiction', 'se contredit'], points: 1 }
			]
		};
		const r = grade(p, { type: 'developpement', texte: "Pour Protagoras, l'homme est la MESURE de toutes choses : la vérité est relative." });
		expect(r.details).toEqual([true, true, false]);
		expect(r.score).toBe(0.8);
		expect(r.correct).toBe(true);
		expect(grade(p, { type: 'developpement', texte: 'Le relativisme.' }).correct).toBe(false);
	});
	it('refuse une réponse du mauvais type', () => {
		expect(grade({ type: 'vrai_faux', reponse: true }, { type: 'qcm', choix: 0 }).correct).toBe(false);
	});
});

describe('affichage', () => {
	it('parseTrous et correctAnswerText', () => {
		expect(parseTrous('a [[b|c]] d')).toEqual(['a ', { answers: ['b', 'c'] }, ' d']);
		expect(correctAnswerText({ type: 'trous', texte: 'a [[b|c]] d' })).toBe('a b d');
		expect(correctAnswerText({ type: 'numerique', reponse: 2.5, tolerance: 0, unite: '%' })).toBe('2,5 %');
	});
});
