import { CITIES } from '@/lib/geo';
export const CITY_NAMES: Record<string, string> = Object.fromEntries(CITIES.map((c) => [c.id, c.name]));
