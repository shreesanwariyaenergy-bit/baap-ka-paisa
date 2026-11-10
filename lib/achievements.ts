import { CITIES } from './geo';
import type { AchievementView } from './data/types';

/** Group repeat achievements (e.g. several Season Crowns) for compact display; newest label wins for streaks. */
export function groupAchievements(list: AchievementView[]): { id: string; label: string; count: number; latest: AchievementView }[] {
  const out = new Map<string, { id: string; label: string; count: number; latest: AchievementView }>();
  for (const a of list) {
    const key = a.id === 'pioneer' ? a.label : a.id;
    const g = out.get(key);
    if (!g) out.set(key, { id: a.id, label: a.label, count: 1, latest: a });
    else { g.count++; if (a.at > g.latest.at) { g.latest = a; if (a.id === 'streak') g.label = a.label; } }
  }
  return [...out.values()].map((g) => ({ ...g, label: g.id === 'streak' ? g.latest.label : g.label }));
}

/** Replace city ids (e.g. "surat") in engine/database achievement text with city names. */
export function humanizeDetail(text: string): string {
  return CITIES.reduce((t, c) => t.replace(new RegExp(`\\b${c.id}\\b`, 'g'), c.name), text);
}
