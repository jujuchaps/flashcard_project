import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RequestHandler } from './$types';

/** Télécharge le fichier d'instructions à donner à Claude avec un PowerPoint. */
export const GET: RequestHandler = async () => {
	const text = await readFile(join(process.cwd(), 'docs/GENERATEUR_QUESTIONS.md'), 'utf8');
	return new Response(text, {
		headers: {
			'content-type': 'text/markdown; charset=utf-8',
			'content-disposition': 'attachment; filename="GENERATEUR_QUESTIONS.md"'
		}
	});
};
