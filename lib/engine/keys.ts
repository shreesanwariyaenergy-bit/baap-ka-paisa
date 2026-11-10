// Mapping between website scopes and engine board keys.
import { CITIES, cityById, scopeName, type Level, type Scope } from '../geo';
import type { BoardKey } from './engine';

export function scopeToKey(s: Scope): BoardKey {
  const c = cityById(s.cityId)!;
  if (s.level === 'india') return 'india';
  if (s.level === 'state') return `state:${c.state}`;
  if (s.level === 'city') return `city:${c.id}`;
  return `locality:${c.id}:${s.locality}`;
}

export function keyToScope(k: BoardKey): Scope {
  if (k === 'india') return { level: 'india', cityId: CITIES[0].id, locality: CITIES[0].localities[0] };
  const [lvl, a, b] = k.split(':');
  if (lvl === 'state') { const c = CITIES.find((x) => x.state === a)!; return { level: 'state', cityId: c.id, locality: c.localities[0] }; }
  if (lvl === 'city') return { level: 'city', cityId: a, locality: cityById(a)!.localities[0] };
  return { level: lvl as Level, cityId: a, locality: b };
}

export const keyName = (k: BoardKey) => scopeName(keyToScope(k));
