import { fail } from '@sveltejs/kit';
import { getSetting, setSetting, sql } from '$lib/server/db';
import { activeSessionId } from '$lib/server/importer';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const sessionId = await activeSessionId();
	const [session] = await sql<{ name: string }[]>`SELECT name FROM study_session WHERE id = ${sessionId}`;
	return {
		sessionName: session.name,
		askConfidence: await getSetting('askConfidence', true),
		retention: await getSetting('retention', 0.9),
		newPerSeries: await getSetting('newPerSeries', 10),
		reviewSize: await getSetting('reviewSize', 30),
		dailyMinutes: await getSetting('dailyMinutes', 30)
	};
};

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('sessionName') ?? '').trim();
		if (!name) return fail(400, { error: 'Le nom de la session est obligatoire.' });
		const sessionId = await activeSessionId();
		await sql`UPDATE study_session SET name = ${name} WHERE id = ${sessionId}`;
		await setSetting('askConfidence', form.get('askConfidence') === 'on');
		await setSetting('retention', clamp(Number(form.get('retention')) / 100 || 0.9, 0.8, 0.97));
		await setSetting('newPerSeries', clamp(Math.round(Number(form.get('newPerSeries')) || 10), 0, 100));
		await setSetting('reviewSize', clamp(Math.round(Number(form.get('reviewSize')) || 30), 5, 200));
		await setSetting('dailyMinutes', clamp(Math.round(Number(form.get('dailyMinutes')) || 30), 5, 240));
		return { ok: true };
	}
};
