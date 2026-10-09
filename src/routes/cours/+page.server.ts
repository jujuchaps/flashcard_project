import { redirect } from '@sveltejs/kit';
import { activeSessionId } from '$lib/server/importer';
import type { PageServerLoad } from './$types';

/** « Cours » ouvre la session en cours. */
export const load: PageServerLoad = async () => {
	redirect(307, `/sessions/${await activeSessionId()}`);
};
