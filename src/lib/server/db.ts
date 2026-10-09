import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';

const url = env.DATABASE_URL || 'postgres://etude:etude@localhost:5432/etude';

export const sql = postgres(url, { onnotice: () => {} });

/** Applique les fichiers migrations/*.sql pas encore exécutés, dans l'ordre. */
export async function migrate(dir = join(process.cwd(), 'migrations')) {
	await sql`CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
	const done = new Set((await sql<{ name: string }[]>`SELECT name FROM schema_migration`).map((r) => r.name));
	const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
	for (const file of files) {
		if (done.has(file)) continue;
		const content = await readFile(join(dir, file), 'utf8');
		await sql.begin(async (tx) => {
			await tx.unsafe(content);
			await tx`INSERT INTO schema_migration (name) VALUES (${file})`;
		});
		console.log(`[db] migration appliquée : ${file}`);
	}
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
	const [row] = await sql<{ value: T }[]>`SELECT value FROM setting WHERE key = ${key}`;
	return row ? row.value : fallback;
}

export async function setSetting(key: string, value: unknown) {
	await sql`INSERT INTO setting (key, value) VALUES (${key}, ${sql.json(value as never)})
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
