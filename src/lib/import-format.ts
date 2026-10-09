// Lecture et validation des fichiers d'import : format « quiz-etude/v2 »
// (voir docs/GENERATEUR_QUESTIONS.md) et ancien format de l'artefact.

import { normalize, parseTrous, trouAnswers } from './grading';
import type { Payload, QuestionType } from './types';

export const FORMAT_V2 = 'quiz-etude/v2';

export interface ImportQuestion {
	extId: string | null;
	type: QuestionType;
	concept: string;
	prompt: string;
	explanation: string;
	slide: number | null;
	difficulty: number | null;
	tags: string[];
	payload: Payload;
}

export interface ImportLot {
	courseCode: string;
	courseName: string;
	/** Cours hors session (intérêts personnels) : « cours.hors_session »: true. */
	outsideSession: boolean;
	chapterName: string;
	source: string | null;
	slideCount: number | null;
	questions: ImportQuestion[];
	errors: { index: number; message: string }[];
}

export interface ParseResult {
	lots: ImportLot[];
	/** Erreur bloquante (JSON invalide, structure inconnue). */
	error: string | null;
}

const TYPES: QuestionType[] = [
	'qcm',
	'qcm_multi',
	'vrai_faux',
	'courte',
	'trous',
	'numerique',
	'association',
	'ordre',
	'developpement'
];

class InvalidQuestion extends Error {}

function fail(message: string): never {
	throw new InvalidQuestion(message);
}

function str(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

function strList(v: unknown, field: string, min: number): string[] {
	if (!Array.isArray(v)) fail(`« ${field} » doit être une liste.`);
	const list = v.map((x) => (typeof x === 'number' ? String(x) : str(x)));
	if (list.some((x) => !x)) fail(`« ${field} » contient un élément vide ou invalide.`);
	if (list.length < min) fail(`« ${field} » doit contenir au moins ${min} éléments.`);
	return list;
}

function index(v: unknown, length: number, field: string): number {
	if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= length)
		fail(`« ${field} » doit être un index entre 0 et ${length - 1}.`);
	return v;
}

function num(v: unknown, field: string): number {
	const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
	if (typeof n !== 'number' || !Number.isFinite(n)) fail(`« ${field} » doit être un nombre.`);
	return n;
}

function bool(v: unknown, field: string): boolean {
	if (typeof v === 'boolean') return v;
	const s = str(v).toLowerCase();
	if (s === 'vrai' || s === 'true') return true;
	if (s === 'faux' || s === 'false') return false;
	fail(`« ${field} » doit être true ou false.`);
}

function unique(list: string[], field: string) {
	const seen = new Set(list.map(normalize));
	if (seen.size !== list.length) fail(`« ${field} » contient des doublons.`);
}

function parsePayload(type: QuestionType, raw: Record<string, unknown>): Payload {
	switch (type) {
		case 'qcm': {
			const choix = strList(raw.choix, 'choix', 2);
			return { type, choix, reponse: index(raw.reponse, choix.length, 'reponse') };
		}
		case 'qcm_multi': {
			const choix = strList(raw.choix, 'choix', 2);
			if (!Array.isArray(raw.reponses) || !raw.reponses.length)
				fail('« reponses » doit être une liste non vide d’index.');
			const reponses = [...new Set(raw.reponses.map((r) => index(r, choix.length, 'reponses')))];
			return { type, choix, reponses: reponses.sort((a, b) => a - b) };
		}
		case 'vrai_faux':
			return { type, reponse: bool(raw.reponse, 'reponse') };
		case 'courte': {
			const reponses =
				raw.reponses === undefined && raw.reponse !== undefined
					? strList([raw.reponse], 'reponse', 1)
					: strList(raw.reponses, 'reponses', 1);
			return { type, reponses };
		}
		case 'trous': {
			const texte = str(raw.texte);
			if (!texte) fail('« texte » est obligatoire pour un texte à trous.');
			const trous = trouAnswers(texte);
			if (!trous.length) fail('« texte » doit contenir au moins un trou [[réponse]].');
			if (trous.some((t) => !t.length)) fail('Un trou [[ ]] est vide.');
			return { type, texte };
		}
		case 'numerique': {
			const tolerance = raw.tolerance === undefined ? 0 : num(raw.tolerance, 'tolerance');
			if (tolerance < 0) fail('« tolerance » doit être positive.');
			const unite = str(raw.unite);
			return {
				type,
				reponse: num(raw.reponse, 'reponse'),
				tolerance,
				...(unite ? { unite } : {})
			};
		}
		case 'association': {
			if (!Array.isArray(raw.paires) || raw.paires.length < 2)
				fail('« paires » doit contenir au moins 2 paires.');
			const paires = raw.paires.map((p) => {
				const pair = strList(p, 'paires', 2);
				if (pair.length !== 2) fail('Chaque paire doit avoir exactement 2 éléments.');
				return [pair[0], pair[1]] as [string, string];
			});
			unique(
				paires.map((p) => p[0]),
				'paires (gauche)'
			);
			unique(
				paires.map((p) => p[1]),
				'paires (droite)'
			);
			return { type, paires };
		}
		case 'ordre': {
			const elements = strList(raw.elements, 'elements', 2);
			unique(elements, 'elements');
			return { type, elements };
		}
		case 'developpement': {
			if (!Array.isArray(raw.elements) || !raw.elements.length)
				fail('« elements » doit contenir au moins un élément clé.');
			const elements = raw.elements.map((e) => {
				const el = (e ?? {}) as Record<string, unknown>;
				const idee = str(el.idee);
				if (!idee) fail('Chaque élément clé doit avoir une « idee ».');
				const mots = strList(el.mots, 'mots', 1);
				const points = el.points === undefined ? 1 : num(el.points, 'points');
				if (points <= 0) fail('« points » doit être positif.');
				return { idee, mots, points };
			});
			return { type, elements, reponse_modele: str(raw.reponse_modele) };
		}
	}
}

export function parseQuestion(raw: unknown): ImportQuestion {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('La question doit être un objet.');
	const q = raw as Record<string, unknown>;
	const type = str(q.type) as QuestionType;
	if (!TYPES.includes(type)) fail(`Type inconnu « ${str(q.type) || '(vide)'} ».`);
	const payload = parsePayload(type, q);
	let prompt = str(q.q);
	if (type === 'trous') {
		const p = payload as Extract<Payload, { type: 'trous' }>;
		const blanks = parseTrous(p.texte)
			.map((s) => (typeof s === 'string' ? s : '_____'))
			.join('');
		prompt = prompt ? `${prompt}\n${blanks}` : blanks;
	} else if (!prompt) fail('L’énoncé « q » est obligatoire.');
	let slide: number | null = null;
	if (q.diapo !== undefined && q.diapo !== null && q.diapo !== '') {
		const n = Number(q.diapo);
		if (Number.isInteger(n) && n > 0) slide = n;
	}
	let difficulty: number | null = null;
	if (q.difficulte !== undefined) {
		const n = Number(q.difficulte);
		if ([1, 2, 3].includes(n)) difficulty = n;
	}
	const tags = Array.isArray(q.tags) ? q.tags.map(str).filter(Boolean) : [];
	const extId = q.id === undefined || q.id === null ? null : String(q.id).trim() || null;
	return {
		extId,
		type,
		concept: str(q.concept),
		prompt,
		explanation: str(q.explication),
		slide,
		difficulty,
		tags,
		payload
	};
}

function parseLot(raw: Record<string, unknown>): ImportLot {
	const cours = (raw.cours ?? {}) as Record<string, unknown>;
	const chapitre = (raw.chapitre ?? {}) as Record<string, unknown>;
	const courseName = str(cours.nom) || str(cours.code);
	const courseCode = (str(cours.code) || normalize(courseName).replace(/ /g, '-')).toLowerCase();
	const lot: ImportLot = {
		courseCode,
		courseName,
		outsideSession: cours.hors_session === true,
		chapterName: str(chapitre.nom) || 'Général',
		source: str(chapitre.source) || null,
		slideCount: Number.isInteger(Number(chapitre.diapos)) && Number(chapitre.diapos) > 0 ? Number(chapitre.diapos) : null,
		questions: [],
		errors: []
	};
	if (!courseName) {
		lot.errors.push({ index: -1, message: 'Le cours (« cours.nom » ou « cours.code ») est obligatoire.' });
		return lot;
	}
	if (!Array.isArray(raw.questions)) {
		lot.errors.push({ index: -1, message: 'Le champ « questions » doit être une liste.' });
		return lot;
	}
	raw.questions.forEach((q, i) => {
		try {
			lot.questions.push(parseQuestion(q));
		} catch (e) {
			if (!(e instanceof InvalidQuestion)) throw e;
			lot.errors.push({ index: i, message: e.message });
		}
	});
	return lot;
}

/** Ancien format : [{ c, q, o, a, e }] — un lot par cours. */
function parseLegacy(list: Record<string, unknown>[], courseNames: Record<string, string>): ImportLot[] {
	const byCourse = new Map<string, ImportLot>();
	list.forEach((raw, i) => {
		const code = str(raw.c) || 'divers';
		let lot = byCourse.get(code);
		if (!lot) {
			lot = {
				courseCode: code,
				courseName: courseNames[code] ?? code,
				outsideSession: false,
				chapterName: 'Général',
				source: null,
				slideCount: null,
				questions: [],
				errors: []
			};
			byCourse.set(code, lot);
		}
		try {
			lot.questions.push(
				parseQuestion({
					id: raw.id,
					type: 'qcm',
					q: raw.q,
					choix: raw.o,
					reponse: raw.a,
					explication: raw.e
				})
			);
		} catch (e) {
			if (!(e instanceof InvalidQuestion)) throw e;
			lot.errors.push({ index: i, message: e.message });
		}
	});
	return [...byCourse.values()];
}

function isLegacyItem(x: unknown): boolean {
	return !!x && typeof x === 'object' && 'q' in x && 'o' in x && !('type' in x);
}

/**
 * Accepte un objet v2, une liste d'objets v2 ou l'ancien format.
 * Tolère un bloc de code Markdown autour du JSON (copier-coller depuis Claude).
 */
export function parseImport(text: string, courseNames: Record<string, string> = {}): ParseResult {
	let cleaned = text.trim();
	const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fence) cleaned = fence[1].trim();
	if (!cleaned) return { lots: [], error: 'Le texte est vide.' };
	let data: unknown;
	try {
		data = JSON.parse(cleaned);
	} catch (e) {
		return { lots: [], error: `JSON invalide : ${(e as Error).message}` };
	}
	if (Array.isArray(data)) {
		if (!data.length) return { lots: [], error: 'La liste est vide.' };
		if (data.every(isLegacyItem))
			return { lots: parseLegacy(data as Record<string, unknown>[], courseNames), error: null };
		if (data.every((x) => x && typeof x === 'object' && 'questions' in x))
			return { lots: data.map((x) => parseLot(x as Record<string, unknown>)), error: null };
		return { lots: [], error: 'Structure non reconnue : attendu le format quiz-etude/v2.' };
	}
	if (data && typeof data === 'object' && 'questions' in data) {
		return { lots: [parseLot(data as Record<string, unknown>)], error: null };
	}
	return { lots: [], error: 'Structure non reconnue : attendu le format quiz-etude/v2.' };
}

/** Clé de déduplication d'une question à l'intérieur d'un cours. */
export function dedupKey(q: Pick<ImportQuestion, 'type' | 'prompt'>): string {
	return `${q.type}:${normalize(q.prompt)}`;
}

/** Inverse de parseQuestion : question enregistrée → objet au format v2 (pour l'édition). */
export function toV2(q: {
	extId?: string | null;
	type: string;
	concept: string;
	prompt: string;
	explanation: string;
	slide: number | null;
	difficulty: number | null;
	tags: string[];
	payload: Payload;
}): Record<string, unknown> {
	const { type: _, ...fields } = q.payload as Payload & Record<string, unknown>;
	let prompt: string | undefined = q.prompt;
	if (q.payload.type === 'trous') {
		const i = q.prompt.lastIndexOf('\n');
		prompt = i > 0 ? q.prompt.slice(0, i) : undefined;
	}
	return {
		...(q.extId ? { id: q.extId } : {}),
		type: q.payload.type,
		concept: q.concept,
		...(prompt !== undefined ? { q: prompt } : {}),
		...fields,
		explication: q.explanation,
		...(q.slide ? { diapo: q.slide } : {}),
		...(q.difficulty ? { difficulte: q.difficulty } : {}),
		...(q.tags.length ? { tags: q.tags } : {})
	};
}
