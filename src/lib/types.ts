// Types partagés entre le client et le serveur.

export type QuestionType =
	| 'qcm'
	| 'qcm_multi'
	| 'vrai_faux'
	| 'courte'
	| 'trous'
	| 'numerique'
	| 'association'
	| 'ordre'
	| 'developpement';

export const TYPE_LABELS: Record<QuestionType, string> = {
	qcm: 'Choix multiple',
	qcm_multi: 'Plusieurs réponses',
	vrai_faux: 'Vrai ou faux',
	courte: 'Réponse courte',
	trous: 'Texte à trous',
	numerique: 'Numérique',
	association: 'Association',
	ordre: 'Mise en ordre',
	developpement: 'Développement'
};

/** Contenu propre à chaque type (stocké en JSON). */
export type Payload =
	| { type: 'qcm'; choix: string[]; reponse: number }
	| { type: 'qcm_multi'; choix: string[]; reponses: number[] }
	| { type: 'vrai_faux'; reponse: boolean }
	| { type: 'courte'; reponses: string[] }
	| { type: 'trous'; texte: string }
	| { type: 'numerique'; reponse: number; tolerance: number; unite?: string }
	| { type: 'association'; paires: [string, string][] }
	| { type: 'ordre'; elements: string[] }
	| {
			type: 'developpement';
			elements: { idee: string; mots: string[]; points: number }[];
			reponse_modele: string;
	  };

/** Question telle qu'envoyée à l'écran de quiz. */
export interface QuizQuestion {
	id: number;
	courseName: string;
	chapterName: string;
	concept: string;
	prompt: string;
	explanation: string;
	slide: number | null;
	source: string | null;
	payload: Payload;
}

/** Réponse donnée par l'étudiant, selon le type. */
export type Answer =
	| { type: 'qcm'; choix: number }
	| { type: 'qcm_multi'; choix: number[] }
	| { type: 'vrai_faux'; valeur: boolean }
	| { type: 'courte'; texte: string }
	| { type: 'trous'; textes: string[] }
	| { type: 'numerique'; texte: string }
	/** droite[i] = index (dans paires) de l'élément de droite associé à la gauche i */
	| { type: 'association'; droite: number[] }
	/** ordre proposé, en index dans elements */
	| { type: 'ordre'; ordre: number[] }
	| { type: 'developpement'; texte: string };

export interface GradeResult {
	/** Réussie au sens de la répétition espacée. */
	correct: boolean;
	/** Score entre 0 et 1 (points partiels). */
	score: number;
	/** Détail par élément (trous, paires, éléments clés, choix), true = bon. */
	details?: boolean[];
}

/** « non » : la certitude n'a pas été demandée (réglage désactivé, examen blanc). */
export type Confidence = 'sur' | 'hesitant' | 'devine' | 'non';

export type Mastery = 'nouvelle' | 'fragile' | 'apprentissage' | 'maitrisee' | 'ancree';

export const MASTERY_LABELS: Record<Mastery, string> = {
	nouvelle: 'Nouvelle',
	fragile: 'À retravailler',
	apprentissage: 'En apprentissage',
	maitrisee: 'Maîtrisée',
	ancree: 'Ancrée'
};
