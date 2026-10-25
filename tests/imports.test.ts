import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { grade, trouAnswers } from '../src/lib/grading';
import { parseImport } from '../src/lib/import-format';
import type { Answer, Payload } from '../src/lib/types';

// Fichiers importés automatiquement au démarrage : aucune question ne doit être rejetée,
// et la bonne réponse de chaque question doit être acceptée par la correction automatique.
const dir = new URL('../data/imports/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

function goodAnswer(p: Payload): Answer {
	switch (p.type) {
		case 'qcm':
			return { type: 'qcm', choix: p.reponse };
		case 'qcm_multi':
			return { type: 'qcm_multi', choix: p.reponses };
		case 'vrai_faux':
			return { type: 'vrai_faux', valeur: p.reponse };
		case 'courte':
			return { type: 'courte', texte: p.reponses[0] };
		case 'trous':
			return { type: 'trous', textes: trouAnswers(p.texte).map((a) => a[0]) };
		case 'numerique':
			return { type: 'numerique', texte: String(p.reponse) };
		case 'association':
			return { type: 'association', droite: p.paires.map((_, i) => i) };
		case 'ordre':
			return { type: 'ordre', ordre: p.elements.map((_, i) => i) };
		case 'developpement':
			return { type: 'developpement', texte: p.reponse_modele };
	}
}

describe('data/imports', () => {
	it.each(files)('%s est valide', (file) => {
		const { lots, error } = parseImport(readFileSync(new URL(file, dir), 'utf8'));
		expect(error).toBeNull();
		expect(lots).toHaveLength(1);
		expect(lots[0].errors).toEqual([]);
		expect(lots[0].questions.length).toBeGreaterThan(0);
		for (const q of lots[0].questions) expect(grade(q.payload, goodAnswer(q.payload)), q.prompt).toMatchObject({ score: 1 });
	});
});
