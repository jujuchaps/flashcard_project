// Correction automatique de toutes les questions. Fonctions pures, utilisées
// côté client (rétroaction immédiate) et côté serveur (résultat enregistré).

import type { Answer, GradeResult, Payload } from './types';

/** Seuil de réussite d'une question à développement. */
export const DEVELOPPEMENT_SEUIL = 0.8;

const ARTICLES = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du']);

/** Minuscules, sans accents, sans ponctuation, espaces normalisés. */
export function normalize(text: string): string {
	return text
		.toLowerCase()
		.replace(/œ/g, 'oe')
		.replace(/æ/g, 'ae')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Normalise et retire un article en début de réponse. */
export function normalizeAnswer(text: string): string {
	const words = normalize(text).split(' ').filter(Boolean);
	if (words.length > 1 && ARTICLES.has(words[0])) words.shift();
	return words.join(' ');
}

export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;
	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
		}
		prev = cur;
	}
	return prev[b.length];
}

/** Écarts tolérés selon la longueur : aucun sous 5 lettres ni pour un nombre. */
function allowedTypos(expected: string): number {
	if (/\d/.test(expected)) return 0;
	if (expected.length >= 9) return 2;
	if (expected.length >= 5) return 1;
	return 0;
}

/** Compare une réponse écrite à une liste de réponses acceptées. */
export function matchText(given: string, accepted: string[]): boolean {
	const g = normalizeAnswer(given);
	if (!g) return false;
	return accepted.some((a) => {
		const e = normalizeAnswer(a);
		if (!e) return false;
		return g === e || levenshtein(g, e) <= allowedTypos(e);
	});
}

export type TrouSegment = string | { answers: string[] };

/** Découpe un texte à trous : « Le traité de [[Tordesillas|Tordesilla]] ». */
export function parseTrous(texte: string): TrouSegment[] {
	const out: TrouSegment[] = [];
	const re = /\[\[(.+?)\]\]/g;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(texte))) {
		if (m.index > last) out.push(texte.slice(last, m.index));
		out.push({ answers: m[1].split('|').map((s) => s.trim()).filter(Boolean) });
		last = m.index + m[0].length;
	}
	if (last < texte.length) out.push(texte.slice(last));
	return out;
}

export function trouAnswers(texte: string): string[][] {
	return parseTrous(texte)
		.filter((s): s is { answers: string[] } => typeof s !== 'string')
		.map((s) => s.answers);
}

/** Lit un nombre écrit à la française ou à l'anglaise : « 1 234,5 », « 25 % ». */
export function parseNumber(text: string): number | null {
	const cleaned = text
		.replace(/[\s  ]/g, '')
		.replace(/[%$€a-zA-Z°]+$/u, '')
		.replace(',', '.');
	if (!/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;
	const n = Number(cleaned);
	return Number.isFinite(n) ? n : null;
}

function fraction(details: boolean[]): number {
	return details.length ? details.filter(Boolean).length / details.length : 0;
}

export function grade(payload: Payload, answer: Answer): GradeResult {
	if (payload.type !== answer.type) return { correct: false, score: 0 };
	switch (payload.type) {
		case 'qcm': {
			const ok = (answer as Extract<Answer, { type: 'qcm' }>).choix === payload.reponse;
			return { correct: ok, score: ok ? 1 : 0 };
		}
		case 'qcm_multi': {
			const chosen = new Set((answer as Extract<Answer, { type: 'qcm_multi' }>).choix);
			const good = new Set(payload.reponses);
			const details = payload.choix.map((_, i) => chosen.has(i) === good.has(i));
			const ok = details.every(Boolean);
			return { correct: ok, score: fraction(details), details };
		}
		case 'vrai_faux': {
			const ok = (answer as Extract<Answer, { type: 'vrai_faux' }>).valeur === payload.reponse;
			return { correct: ok, score: ok ? 1 : 0 };
		}
		case 'courte': {
			const ok = matchText((answer as Extract<Answer, { type: 'courte' }>).texte, payload.reponses);
			return { correct: ok, score: ok ? 1 : 0 };
		}
		case 'trous': {
			const given = (answer as Extract<Answer, { type: 'trous' }>).textes;
			const details = trouAnswers(payload.texte).map((acc, i) => matchText(given[i] ?? '', acc));
			return { correct: details.every(Boolean), score: fraction(details), details };
		}
		case 'numerique': {
			const n = parseNumber((answer as Extract<Answer, { type: 'numerique' }>).texte);
			const ok = n !== null && Math.abs(n - payload.reponse) <= payload.tolerance + 1e-9;
			return { correct: ok, score: ok ? 1 : 0 };
		}
		case 'association': {
			const droite = (answer as Extract<Answer, { type: 'association' }>).droite;
			const details = payload.paires.map((_, i) => droite[i] === i);
			return { correct: details.every(Boolean), score: fraction(details), details };
		}
		case 'ordre': {
			const ordre = (answer as Extract<Answer, { type: 'ordre' }>).ordre;
			const details = payload.elements.map((_, i) => ordre[i] === i);
			return { correct: details.every(Boolean), score: fraction(details), details };
		}
		case 'developpement': {
			const text = ` ${normalize((answer as Extract<Answer, { type: 'developpement' }>).texte)} `;
			const details = payload.elements.map((el) =>
				el.mots.some((m) => {
					const n = normalize(m);
					return n.length > 0 && text.includes(n);
				})
			);
			const total = payload.elements.reduce((s, el) => s + el.points, 0) || 1;
			const got = payload.elements.reduce((s, el, i) => s + (details[i] ? el.points : 0), 0);
			const score = got / total;
			return { correct: score >= DEVELOPPEMENT_SEUIL, score, details };
		}
	}
}

/** Texte lisible de la bonne réponse, pour la rétroaction et les résultats. */
export function correctAnswerText(payload: Payload): string {
	switch (payload.type) {
		case 'qcm':
			return payload.choix[payload.reponse];
		case 'qcm_multi':
			return payload.reponses.map((i) => payload.choix[i]).join(' · ');
		case 'vrai_faux':
			return payload.reponse ? 'Vrai' : 'Faux';
		case 'courte':
			return payload.reponses[0];
		case 'trous':
			return parseTrous(payload.texte)
				.map((s) => (typeof s === 'string' ? s : s.answers[0]))
				.join('');
		case 'numerique':
			return `${String(payload.reponse).replace('.', ',')}${payload.unite ? ' ' + payload.unite : ''}`;
		case 'association':
			return payload.paires.map(([a, b]) => `${a} → ${b}`).join(' · ');
		case 'ordre':
			return payload.elements.join(' → ');
		case 'developpement':
			return payload.reponse_modele;
	}
}
