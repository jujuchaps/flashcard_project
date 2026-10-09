import { courseStats } from '$lib/server/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ courses: await courseStats() });
