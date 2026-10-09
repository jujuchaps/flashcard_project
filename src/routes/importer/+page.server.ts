import { fail } from '@sveltejs/kit';
import { parseImport, type ImportLot } from '$lib/import-format';
import { TYPE_LABELS, type QuestionType } from '$lib/types';
import { sql } from '$lib/server/db';
import { courseNamesByCode, importLots, restoreLegacyCode } from '$lib/server/importer';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const courses = await sql<{ id: number; name: string; code: string }[]>`
		SELECT id, name, code FROM course WHERE NOT archived ORDER BY name`;
	return { courses };
};

async function readInput(form: FormData): Promise<string> {
	const file = form.get('file');
	if (file instanceof File && file.size > 0) return await file.text();
	return String(form.get('text') ?? '');
}

function preview(lots: ImportLot[]) {
	return lots.map((l) => {
		const byType: Record<string, number> = {};
		for (const q of l.questions) byType[TYPE_LABELS[q.type as QuestionType]] = (byType[TYPE_LABELS[q.type as QuestionType]] ?? 0) + 1;
		return {
			course: l.courseName,
			code: l.courseCode,
			chapter: l.chapterName,
			source: l.source,
			count: l.questions.length,
			byType,
			concepts: new Set(l.questions.map((q) => q.concept).filter(Boolean)).size,
			errors: l.errors.slice(0, 20),
			errorCount: l.errors.length
		};
	});
}

export const actions: Actions = {
	analyser: async ({ request }) => {
		const form = await request.formData();
		const text = await readInput(form);
		const { lots, error } = parseImport(text, await courseNamesByCode());
		if (error) return fail(400, { step: 'analyse', error, text });
		return { step: 'analyse', text, lots: preview(lots) };
	},
	importer: async ({ request }) => {
		const form = await request.formData();
		const text = String(form.get('text') ?? '');
		const { lots, error } = parseImport(text, await courseNamesByCode());
		if (error) return fail(400, { step: 'analyse', error, text });
		const courseId = Number(form.get('courseId')) || null;
		const chapterName = String(form.get('chapterName') ?? '').trim() || null;
		try {
			const summary = await importLots(lots, { courseId, chapterName });
			return { step: 'done', summary };
		} catch (e) {
			return fail(500, { step: 'analyse', error: (e as Error).message, text });
		}
	},
	restaurer: async ({ request }) => {
		const form = await request.formData();
		try {
			const restore = await restoreLegacyCode(String(form.get('code') ?? ''));
			return { step: 'restore', restore };
		} catch (e) {
			return fail(400, { step: 'restore', restoreError: (e as Error).message });
		}
	}
};
