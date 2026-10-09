import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dedupKey, parseImport } from '../src/lib/import-format';

const v2 = {
	format: 'quiz-etude/v2',
	cours: { code: 'philo', nom: 'Philosophie' },
	chapitre: { nom: 'Présocratiques', source: 'cours3.pptx' },
	questions: [
		{ type: 'qcm', concept: 'Maïeutique', q: 'Méthode de Socrate?', choix: ['A', 'B', 'C', 'D'], reponse: 1, explication: 'x', diapo: 7 },
		{ type: 'courte', concept: 'Héra', q: 'Nom romain d’Héra?', reponses: ['Junon'], explication: '' },
		{ type: 'trous', concept: 'T', texte: 'Le traité de [[Tordesillas]].', explication: '' },
		{ type: 'numerique', concept: 'F', q: '15/60 en %?', reponse: '25', tolerance: 0.5, unite: '%' },
		{ type: 'vrai_faux', concept: 'M', q: 'La médiane…', reponse: 'faux' },
		{ type: 'qcm', q: 'Mauvais index', choix: ['A', 'B'], reponse: 2 },
		{ type: 'inconnu', q: 'x' },
		{ type: 'association', q: 'Associe', paires: [['A', '1'], ['B', '1']] },
		{ type: 'developpement', q: 'Explique', elements: [{ idee: 'i', mots: ['m'] }], reponse_modele: 'r' }
	]
};

describe('parseImport', () => {
	it('lit le format v2 et signale les questions invalides', () => {
		const { lots, error } = parseImport(JSON.stringify(v2));
		expect(error).toBeNull();
		expect(lots).toHaveLength(1);
		const [lot] = lots;
		expect(lot.courseCode).toBe('philo');
		expect(lot.chapterName).toBe('Présocratiques');
		expect(lot.questions.map((q) => q.type)).toEqual(['qcm', 'courte', 'trous', 'numerique', 'vrai_faux', 'developpement']);
		expect(lot.errors.map((e) => e.index)).toEqual([5, 6, 7]);
		expect(lot.questions[0].slide).toBe(7);
		expect(lot.questions[2].prompt).toBe('Le traité de _____.');
		expect(lot.questions[3].payload).toEqual({ type: 'numerique', reponse: 25, tolerance: 0.5, unite: '%' });
		expect(lot.questions[4].payload).toEqual({ type: 'vrai_faux', reponse: false });
		expect(lot.questions[5].payload).toMatchObject({ elements: [{ points: 1 }] });
	});
	it('tolère un bloc de code Markdown autour du JSON', () => {
		const { lots, error } = parseImport('Voici :\n```json\n' + JSON.stringify(v2) + '\n```');
		expect(error).toBeNull();
		expect(lots[0].questions.length).toBe(6);
	});
	it("lit l'ancien format de l'artefact", () => {
		const legacy = [
			{ c: 'hist', q: 'Q1?', o: ['a', 'b'], a: 1, e: 'exp', id: 'h1' },
			{ c: 'stat', q: 'Q2?', o: ['a', 'b'], a: 0 }
		];
		const { lots } = parseImport(JSON.stringify(legacy), { hist: 'Histoire' });
		expect(lots.map((l) => l.courseName)).toEqual(['Histoire', 'stat']);
		expect(lots[0].questions[0]).toMatchObject({ extId: 'h1', type: 'qcm', explanation: 'exp' });
	});
	it('signale un JSON invalide ou une structure inconnue', () => {
		expect(parseImport('{').error).toMatch(/JSON invalide/);
		expect(parseImport('{"a":1}').error).toMatch(/Structure non reconnue/);
		expect(parseImport('').error).toMatch(/vide/);
	});
	it('exige un cours', () => {
		const { lots } = parseImport(JSON.stringify({ questions: [] }));
		expect(lots[0].errors[0].message).toMatch(/cours/);
	});
	it('déduplique sans tenir compte de la casse ni des accents', () => {
		expect(dedupKey({ type: 'qcm', prompt: 'Élève?' })).toBe(dedupKey({ type: 'qcm', prompt: 'eleve' }));
	});
	it("le fichier de départ de l'artefact est entièrement valide", () => {
		const text = readFileSync(new URL('../data/seed/artefact-cegep.json', import.meta.url), 'utf8');
		const { lots, error } = parseImport(text);
		expect(error).toBeNull();
		expect(lots).toHaveLength(20);
		expect(lots.flatMap((l) => l.errors)).toEqual([]);
		expect(lots.reduce((s, l) => s + l.questions.length, 0)).toBe(609);
	});
});
