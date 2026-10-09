// Migrations de données, exécutées une seule fois au démarrage (table data_migration).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TransactionSql } from 'postgres';
import { sql } from './db';
import { activeSessionId } from './importer';

type Tx = TransactionSql<Record<string, never>>;

/**
 * Les 20 catégories de l'artefact étaient des sujets, pas des cours :
 * ancien code → [code du vrai cours, nom du chapitre].
 */
export const REGROUPEMENT: Record<string, [string, string]> = {
	philo: ['philo', 'Général'],
	jo: ['philo', 'JO et mythes'],
	phm: ['philo', 'Méthode et argumentation'],
	pps: ['philo', 'Présocratiques'],
	phi: ['philo', 'Grandes idées'],
	fr: ['fr', 'Figures de style'],
	frs: ['fr', 'Phrase et grammaire'],
	frl: ['fr', 'Énonciation et lexique'],
	frc: ['fr', 'Le cours et les lectures'],
	hist: ['hist', 'Général'],
	hm: ['hist', 'Moyen Âge et empires'],
	qc: ['hist', 'Histoire du Québec'],
	gest: ['gest', 'Général'],
	fin: ['gest', 'Finances et investissement'],
	en: ['gest', 'Entrepreneuriat et affaires'],
	stat: ['stat', 'Général'],
	edu: ['edu', 'Théorie'],
	sp: ['edu', 'Course et entraînement'],
	au: ['perso', 'Mécanique auto'],
	cg: ['perso', 'Culture générale']
};

const OLD_CHAPTER = 'Questions de l’artefact';

/** Base créée avant la réorganisation : chaque ancien cours devient un chapitre de son vrai cours. */
async function regrouperCours(tx: Tx) {
	const sessionId = await activeSessionId();
	const olds = await tx<{ id: number; code: string; session_id: number | null }[]>`
		SELECT id, code, session_id FROM course WHERE code = ANY(${Object.keys(REGROUPEMENT)}) ORDER BY id`;
	if (!olds.length) return;
	// Seules les bases issues de l'artefact ont le chapitre « Questions de l’artefact ».
	const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM chapter WHERE name = ${OLD_CHAPTER}`;
	if (!n) return;
	const order = Object.keys(REGROUPEMENT);
	olds.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
	let position = 0;
	for (const old of olds) {
		const [code, chapterName] = REGROUPEMENT[old.code];
		const [target] = await tx<{ id: number }[]>`
			SELECT id FROM course WHERE code = ${code} AND (session_id IS NOT DISTINCT FROM ${code === 'perso' ? null : sessionId})`;
		let targetId: number;
		if (old.code === code) targetId = old.id;
		else if (target) targetId = target.id;
		else {
			const [created] = await tx<{ id: number }[]>`
				INSERT INTO course (session_id, code, name) VALUES (${code === 'perso' ? null : sessionId}, ${code}, ${code}) RETURNING id`;
			targetId = created.id;
		}
		position++;
		await tx`UPDATE chapter SET course_id = ${targetId}, name = ${chapterName}, position = ${position}
			WHERE course_id = ${old.id} AND name = ${OLD_CHAPTER}`;
		if (targetId !== old.id) {
			await tx`UPDATE chapter SET course_id = ${targetId} WHERE course_id = ${old.id}`;
			await tx`UPDATE question SET course_id = ${targetId} WHERE course_id = ${old.id}`;
			await tx`UPDATE evaluation SET course_id = ${targetId} WHERE course_id = ${old.id}`;
			await tx`DELETE FROM course WHERE id = ${old.id}`;
		}
	}
	await tx`DELETE FROM daily_snapshot`;
}

interface SessionSeed {
	session: string;
	cours: {
		code: string;
		nom: string;
		numero?: string;
		enseignant?: string;
		horaire?: { jour: number; debut: string; fin: string; local?: string; type?: string }[];
	}[];
	hors_session?: { code: string; nom: string }[];
}

/** Session Automne 2026 : noms officiels, numéros, enseignants et horaire (data/seed). */
async function configurerSession(tx: Tx) {
	const seed: SessionSeed = JSON.parse(
		await readFile(join(process.cwd(), 'data/seed/session-automne-2026.json'), 'utf8')
	);
	const sessionId = await activeSessionId();
	await tx`UPDATE study_session SET name = ${seed.session} WHERE id = ${sessionId} AND name = 'Session 1'`;
	let position = 0;
	for (const c of seed.cours) {
		position++;
		const [row] = await tx<{ id: number }[]>`
			SELECT id FROM course WHERE code = ${c.code} AND session_id = ${sessionId}`;
		const id = row
			? row.id
			: (
					await tx<{ id: number }[]>`
						INSERT INTO course (session_id, code, name) VALUES (${sessionId}, ${c.code}, ${c.nom}) RETURNING id`
				)[0].id;
		await tx`UPDATE course SET name = ${c.nom}, number = ${c.numero ?? null}, teacher = ${c.enseignant ?? null},
			position = ${position} WHERE id = ${id}`;
		await tx`DELETE FROM course_slot WHERE course_id = ${id}`;
		for (const s of c.horaire ?? [])
			await tx`INSERT INTO course_slot (course_id, weekday, starts, ends, room, kind)
				VALUES (${id}, ${s.jour}, ${s.debut}, ${s.fin}, ${s.local ?? null}, ${s.type ?? null})`;
	}
	for (const c of seed.hors_session ?? []) {
		const [row] = await tx<{ id: number }[]>`SELECT id FROM course WHERE code = ${c.code} ORDER BY id LIMIT 1`;
		if (row) await tx`UPDATE course SET name = ${c.nom}, session_id = NULL WHERE id = ${row.id}`;
		else await tx`INSERT INTO course (session_id, code, name) VALUES (NULL, ${c.code}, ${c.nom})`;
	}
}

const MIGRATIONS: { name: string; run: (tx: Tx) => Promise<void> }[] = [
	{ name: '2026-10-regroupement-cours', run: regrouperCours },
	{ name: '2026-10-session-automne-2026', run: configurerSession }
];

export async function runDataMigrations() {
	const done = new Set((await sql<{ name: string }[]>`SELECT name FROM data_migration`).map((r) => r.name));
	for (const m of MIGRATIONS) {
		if (done.has(m.name)) continue;
		await sql.begin(async (tx) => {
			await m.run(tx);
			await tx`INSERT INTO data_migration (name) VALUES (${m.name})`;
		});
		console.log(`[données] migration appliquée : ${m.name}`);
	}
}
