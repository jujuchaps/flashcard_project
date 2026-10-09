import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { AUTH_COOKIE, authToken, safeEqual } from '$lib/server/security';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!env.APP_PASSWORD) redirect(303, '/');
	return {};
};

function safeNext(raw: string | null): string {
	return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const password = env.APP_PASSWORD;
		if (!password) redirect(303, '/');
		const form = await request.formData();
		const given = String(form.get('password') ?? '');
		if (!safeEqual(authToken(given), authToken(password))) {
			await new Promise((r) => setTimeout(r, 600));
			return fail(400, { error: 'Mot de passe incorrect.' });
		}
		cookies.set(AUTH_COOKIE, authToken(password), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 365
		});
		redirect(303, safeNext(url.searchParams.get('suite')));
	}
};
