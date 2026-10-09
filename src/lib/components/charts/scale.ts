/** Graduations « rondes » de 0 à au moins `max` (3 ou 4 valeurs). */
export function niceTicks(max: number): number[] {
	if (max <= 0) return [0, 1];
	const raw = max / 3;
	const pow = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
	const ticks: number[] = [];
	for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v * 100) / 100);
	return ticks;
}

export function fmtNumber(n: number): string {
	return n.toLocaleString('fr-CA');
}

/** « 9 oct. » à partir de « 2026-10-09 ». */
export function shortDay(day: string): string {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

export function longDay(day: string): string {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(y, m - 1, d).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
}
