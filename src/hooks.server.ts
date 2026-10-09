import { error, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { migrate } from '$lib/server/db';
import { seedIfEmpty } from '$lib/server/importer';
import { AUTH_COOKIE, authToken, isCrossSite, isPublicPath, safeEqual } from '$lib/server/security';

export const init: ServerInit = async () => {
	await migrate();
	await seedIfEmpty();
};

export const handle: Handle = async ({ event, resolve }) => {
	const { request, url, cookies } = event;
	if (isCrossSite(request.method, request.headers.get('origin'), request.headers.get('host')))
		error(403, 'Requête refusée : elle ne vient pas de cette application.');

	// Mot de passe optionnel (variable APP_PASSWORD), utile si l'app est accessible hors de chez toi.
	const password = env.APP_PASSWORD;
	if (password && !isPublicPath(url.pathname)) {
		const token = cookies.get(AUTH_COOKIE);
		if (!token || !safeEqual(token, authToken(password))) {
			if (url.pathname.startsWith('/api/')) error(401, 'Connexion requise.');
			redirect(303, `/connexion?suite=${encodeURIComponent(url.pathname + url.search)}`);
		}
	}
	return resolve(event);
};
