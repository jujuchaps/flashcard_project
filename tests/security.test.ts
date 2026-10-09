import { describe, expect, it } from 'vitest';
import { authToken, isCrossSite, isPublicPath, safeEqual } from '../src/lib/server/security';

describe('protection CSRF', () => {
	it('accepte le même hôte, en http comme en https', () => {
		expect(isCrossSite('POST', 'http://192.168.1.20:3000', '192.168.1.20:3000')).toBe(false);
		expect(isCrossSite('POST', 'https://etude.exemple.ca', 'etude.exemple.ca')).toBe(false);
	});
	it('refuse un autre site', () => {
		expect(isCrossSite('POST', 'https://malveillant.com', 'localhost:3000')).toBe(true);
		expect(isCrossSite('POST', 'null', 'localhost:3000')).toBe(true);
	});
	it('ignore les lectures et les requêtes sans en-tête Origin', () => {
		expect(isCrossSite('GET', 'https://malveillant.com', 'localhost:3000')).toBe(false);
		expect(isCrossSite('POST', null, 'localhost:3000')).toBe(false);
	});
});

describe('mot de passe', () => {
	it('jeton stable et comparaison sûre', () => {
		expect(authToken('abc')).toBe(authToken('abc'));
		expect(safeEqual(authToken('abc'), authToken('abd'))).toBe(false);
		expect(safeEqual('a', 'ab')).toBe(false);
	});
	it('pages publiques', () => {
		expect(isPublicPath('/connexion')).toBe(true);
		expect(isPublicPath('/manifest.webmanifest')).toBe(true);
		expect(isPublicPath('/')).toBe(false);
		expect(isPublicPath('/api/export')).toBe(false);
	});
});
