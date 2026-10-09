// Horaire hebdomadaire des cours (fonctions sans accès au serveur).

export interface Slot {
	id: number;
	courseId: number;
	weekday: number; // 1 = lundi … 7 = dimanche
	starts: string; // « HH:MM »
	ends: string;
	room: string | null;
	kind: string | null; // T = théorie, L = laboratoire
}

export const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export function hhmm(t: string): string {
	return t.slice(0, 5).replace(':', ' h ').replace(/ h 00$/, ' h');
}

export function kindLabel(kind: string | null): string {
	return kind === 'L' ? 'Labo' : kind === 'T' ? 'Théorie' : '';
}

export function slotText(s: Slot): string {
	return `${JOURS[s.weekday]} ${hhmm(s.starts)} à ${hhmm(s.ends)}${s.room ? ` · ${s.room}` : ''}${s.kind ? ` · ${kindLabel(s.kind)}` : ''}`;
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(d: Date): number {
	return ((d.getDay() + 6) % 7) + 1;
}

/** Cours ayant lieu aujourd'hui et demain (pour l'accueil et la priorité des révisions). */
export function classesSoon<T extends Slot>(slots: T[], now = new Date()) {
	const today = isoWeekday(now);
	const tomorrow = (today % 7) + 1;
	const sort = (a: T, b: T) => a.starts.localeCompare(b.starts);
	return {
		today: slots.filter((s) => s.weekday === today).sort(sort),
		tomorrow: slots.filter((s) => s.weekday === tomorrow).sort(sort)
	};
}
