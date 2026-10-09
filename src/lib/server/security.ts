import { createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE = 'etude_auth';

/** Jeton dérivé du mot de passe : changer le mot de passe déconnecte tous les appareils. */
export function authToken(password: string): string {
	return createHmac('sha256', password).update('etude-session-v1').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Protection CSRF : une requête qui modifie des données doit venir du même hôte.
 * Le protocole est ignoré pour permettre l'accès en http sur le réseau local.
 */
export function isCrossSite(method: string, origin: string | null, host: string | null): boolean {
	if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return false;
	if (!origin) return false;
	if (origin === 'null') return true;
	try {
		return new URL(origin).host !== host;
	} catch {
		return true;
	}
}

/** Pages accessibles sans être connecté. */
export function isPublicPath(path: string): boolean {
	return (
		path === '/connexion' ||
		path === '/manifest.webmanifest' ||
		path === '/service-worker.js' ||
		path.startsWith('/icons/') ||
		path === '/favicon.svg' ||
		path.startsWith('/_app/')
	);
}
