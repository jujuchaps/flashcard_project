import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dedupKey, parseImport, type ImportLot } from '$lib/import-format';
import { getSetting, setSetting, sql } from './db';
import { cardFromLegacy, cardToJson } from './srs';

export interface ImportSummary {
	added: number;
	updated: number;
	unchanged: number;
	duplicates: number;
	courses: string[];
}

export interface ImportTarget {
	/** Force le cours cible (quand le fichier ne contient qu'un lot). */
	courseId?: number | null;
	/** Force le nom du chapitre. */
	chapterName?: string | null;
}

export async function activeSessionId(): Promise<number> {
	const [row] = await sql<{ id: number }[]>`SELECT id FROM study_session WHERE active ORDER BY id LIMIT 1`;
	if (row) return row.id;
	const [created] = await sql<{ id: number }[]>`INSERT INTO study_session (name) VALUES ('Session 1') RETURNING id`;
	return created.id;
}

export async function courseNamesByCode(): Promise<Record<string, string>> {
	const rows = await sql<{ code: string; name: string }[]>`SELECT code, name FROM course`;
	return Object.fromEntries(rows.map((r) => [r.code, r.name]));
}

export async function importLots(lots: ImportLot[], target: ImportTarget = {}): Promise<ImportSummary> {
	const summary: ImportSummary = { added: 0, updated: 0, unchanged: 0, duplicates: 0, courses: [] };
	const sessionId = await activeSessionId();
	await sql.begin(async (tx) => {
		for (const lot of lots) {
			if (!lot.questions.length) continue;
			let courseId: number;
			let courseName: string;
			if (target.courseId && lots.length === 1) {
				const [c] = await tx<{ id: number; name: string }[]>`SELECT id, name FROM course WHERE id = ${target.courseId}`;
				if (!c) throw new Error('Cours cible introuvable.');
				courseId = c.id;
				courseName = c.name;
			} else {
				// Un code désigne le même cours, qu'il soit dans la session en cours ou hors session.
				const [found] = await tx<{ id: number; name: string }[]>`
					SELECT id, name FROM course
					WHERE code = ${lot.courseCode} AND (session_id = ${sessionId} OR session_id IS NULL)
					ORDER BY (session_id IS NULL) LIMIT 1`;
				const [c] = found
					? [found]
					: await tx<{ id: number; name: string }[]>`
						INSERT INTO course (session_id, code, name)
						VALUES (${lot.outsideSession ? null : sessionId}, ${lot.courseCode}, ${lot.courseName})
						RETURNING id, name`;
				courseId = c.id;
				courseName = c.name;
			}
			if (!summary.courses.includes(courseName)) summary.courses.push(courseName);

			const chapterName = (lots.length === 1 && target.chapterName?.trim()) || lot.chapterName;
			const [ch] = await tx<{ id: number }[]>`
				INSERT INTO chapter (course_id, name, source, slide_count, position)
				VALUES (${courseId}, ${chapterName}, ${lot.source}, ${lot.slideCount},
					(SELECT coalesce(max(position), 0) + 1 FROM chapter WHERE course_id = ${courseId}))
				ON CONFLICT (course_id, name) DO UPDATE SET source = coalesce(EXCLUDED.source, chapter.source),
					slide_count = coalesce(EXCLUDED.slide_count, chapter.slide_count)
				RETURNING id`;

			let [{ pos }] = await tx<{ pos: number }[]>`
				SELECT coalesce(max(position), 0)::int AS pos FROM question WHERE chapter_id = ${ch.id}`;
			const seen = new Set<string>();
			for (const q of lot.questions) {
				const key = dedupKey(q);
				if (seen.has(key)) {
					summary.duplicates++;
					continue;
				}
				seen.add(key);
				const [existing] = await tx<{ id: number; payload: unknown; explanation: string; concept: string }[]>`
					SELECT id, payload, explanation, concept FROM question
					WHERE course_id = ${courseId}
						AND (dedup_key = ${key} OR (${q.extId}::text IS NOT NULL AND ext_id = ${q.extId}))
					ORDER BY (dedup_key = ${key}) DESC LIMIT 1`;
				if (existing) {
					const same =
						JSON.stringify(existing.payload) === JSON.stringify(q.payload) &&
						existing.explanation === q.explanation &&
						existing.concept === q.concept;
					if (same) {
						summary.unchanged++;
						continue;
					}
					await tx`UPDATE question SET type = ${q.type}, concept = ${q.concept}, prompt = ${q.prompt},
						explanation = ${q.explanation}, payload = ${tx.json(q.payload as never)}, slide = ${q.slide},
						difficulty = ${q.difficulty}, tags = ${q.tags}, dedup_key = ${key}, updated_at = now()
						WHERE id = ${existing.id}`;
					summary.updated++;
					continue;
				}
				pos++;
				await tx`INSERT INTO question (chapter_id, course_id, ext_id, type, concept, prompt, explanation,
						payload, slide, difficulty, tags, dedup_key, position)
					VALUES (${ch.id}, ${courseId}, ${q.extId}, ${q.type}, ${q.concept}, ${q.prompt}, ${q.explanation},
						${tx.json(q.payload as never)}, ${q.slide}, ${q.difficulty}, ${q.tags}, ${key}, ${pos})`;
				summary.added++;
			}
		}
	});
	return summary;
}

/** Importe les questions de l'artefact au premier démarrage. */
export async function seedIfEmpty() {
	if (await getSetting('seeded', false)) return;
	const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM question`;
	if (n === 0) {
		const text = await readFile(join(process.cwd(), 'data/seed/artefact-cegep.json'), 'utf8');
		const { lots, error } = parseImport(text);
		if (error) throw new Error(`Fichier de départ invalide : ${error}`);
		const s = await importLots(lots);
		console.log(`[seed] ${s.added} questions importées depuis l'artefact.`);
	}
	await setSetting('seeded', true);
}

export interface LegacyRestoreSummary {
	restored: number;
	alreadyTracked: number;
	unknown: number;
	customAdded: number;
}

type LegacyData = {
	prog?: Record<string, { box: number; due: number; right?: number; wrong?: number }>;
	custom?: unknown[];
};

/** Restaure la progression d'un code « QC1:… » généré par l'artefact. */
export async function restoreLegacyCode(code: string): Promise<LegacyRestoreSummary> {
	const raw = code.trim().replace(/\s+/g, '');
	if (!raw.startsWith('QC1:')) throw new Error('Le code doit commencer par « QC1: ».');
	let data: LegacyData;
	try {
		data = JSON.parse(Buffer.from(raw.slice(4), 'base64').toString('utf8'));
	} catch {
		throw new Error('Code illisible : vérifie qu’il est complet.');
	}
	return restoreLegacyData(data);
}

export async function restoreLegacyData(data: LegacyData): Promise<LegacyRestoreSummary> {
	if (!data || typeof data.prog !== 'object' || Array.isArray(data.prog))
		throw new Error('Code incomplet : aucune progression trouvée.');

	const summary: LegacyRestoreSummary = { restored: 0, alreadyTracked: 0, unknown: 0, customAdded: 0 };
	if (Array.isArray(data.custom) && data.custom.length) {
		const { lots } = parseImport(JSON.stringify(data.custom), await courseNamesByCode());
		summary.customAdded = (await importLots(lots)).added;
	}
	const now = new Date();
	await sql.begin(async (tx) => {
		for (const [extId, p] of Object.entries(data.prog!)) {
			if (!p || typeof p !== 'object') continue;
			const [q] = await tx<{ id: number; has_card: boolean }[]>`
				SELECT q.id, (c.question_id IS NOT NULL) AS has_card
				FROM question q LEFT JOIN card c ON c.question_id = q.id
				WHERE q.ext_id = ${extId} ORDER BY q.id LIMIT 1`;
			if (!q) {
				summary.unknown++;
				continue;
			}
			if (q.has_card) {
				summary.alreadyTracked++;
				continue;
			}
			const { card, lastOk } = cardFromLegacy(p, now);
			await tx`INSERT INTO card (question_id, fsrs, due, stability, last_ok, right_count, wrong_count, last_reviewed_at)
				VALUES (${q.id}, ${tx.json(cardToJson(card) as never)}, ${card.due}, ${card.stability}, ${lastOk},
					${Math.max(0, p.right ?? 0)}, ${Math.max(0, p.wrong ?? 0)}, ${card.last_review ?? now})`;
			summary.restored++;
		}
	});
	return summary;
}

/**
 * Applique une seule fois, au démarrage, la progression récupérée de l'artefact
 * (data/seed/progression-artefact.json). Les questions déjà suivies dans l'app ne sont pas touchées.
 */
export async function applyLegacyProgressOnce(file = join(process.cwd(), 'data/seed/progression-artefact.json')) {
	if (await getSetting('legacyProgressApplied', false)) return;
	let data: LegacyData;
	try {
		data = JSON.parse(await readFile(file, 'utf8'));
	} catch {
		return; // Pas de fichier : rien à appliquer.
	}
	const s = await restoreLegacyData(data);
	await setSetting('legacyProgressApplied', true);
	console.log(
		`[progression] ${s.restored} questions restaurées depuis l'artefact (${s.alreadyTracked} déjà suivies, ${s.unknown} introuvables).`
	);
}
