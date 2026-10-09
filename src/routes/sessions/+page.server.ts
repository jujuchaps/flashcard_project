import { fail } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { courseStats } from '$lib/server/stats';
import { listSessions } from '$lib/server/structure';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [sessions, courses] = await Promise.all([listSessions(), courseStats()]);
	return { sessions, courses };
};

export const actions: Actions = {
	creer: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Donne un nom à la session (ex. Hiver 2027).' });
		const activate = form.get('activate') === 'on';
		await sql.begin(async (tx) => {
			if (activate) await tx`UPDATE study_session SET active = false`;
			await tx`INSERT INTO study_session (name, active) VALUES (${name}, ${activate})`;
		});
		return { ok: `Session « ${name} » créée.` };
	},
	activer: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		await sql.begin(async (tx) => {
			await tx`UPDATE study_session SET active = false`;
			await tx`UPDATE study_session SET active = true WHERE id = ${id}`;
		});
		return { ok: 'Session en cours changée.' };
	}
};
