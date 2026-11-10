// Launch geography, taken from the Product Blueprint (section 2, "Launch cities").
// This is product configuration, not demo data. Locality names are the blueprint's fixed lists.
// Gurugram and Noida are deliberately not part of the Delhi board in v1 (blueprint open decision).

export type StateCode = 'GJ' | 'MH' | 'DL';
export type Region = 'West' | 'North';

export interface City {
  id: string;
  name: string;
  state: StateCode;
  region: Region;
  /** Short mark used in the city-index watermark, as in the prototype. */
  mark: string;
  /** Vehicle registration series, used as the city-index reference (e.g. GJ-05 for Surat). */
  indexRef: string;
  nickname: string;
  localities: readonly string[];
}

export const STATES: Record<StateCode, string> = { GJ: 'Gujarat', MH: 'Maharashtra', DL: 'Delhi' };

export const CITIES: readonly City[] = [
  { id: 'surat', name: 'Surat', state: 'GJ', region: 'West', mark: 'ST', indexRef: 'GJ-05', nickname: 'The Diamond City',
    localities: ['Vesu', 'Adajan', 'Pal', 'Piplod', 'Athwa', 'Ghod Dod Road', 'City Light', 'Althan', 'Bhatar', 'Dumas', 'Rander', 'Varachha', 'Katargam', 'Udhna', 'Other'] },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'GJ', region: 'West', mark: 'AMD', indexRef: 'GJ-01', nickname: 'The Heritage City',
    localities: ['SG Highway', 'Bodakdev', 'Prahlad Nagar', 'Satellite', 'Thaltej', 'Vastrapur', 'Bopal', 'Navrangpura', 'Science City', 'Maninagar', 'Gota', 'Chandkheda', 'Other'] },
  { id: 'mumbai', name: 'Mumbai', state: 'MH', region: 'West', mark: 'MB', indexRef: 'MH-01', nickname: 'The Maximum City',
    localities: ['Bandra', 'Khar', 'Juhu', 'Andheri', 'Santacruz', 'Worli', 'Lower Parel', 'BKC', 'Colaba', 'Malabar Hill', 'Powai', 'Goregaon', 'Borivali', 'Chembur', 'Other'] },
  { id: 'pune', name: 'Pune', state: 'MH', region: 'West', mark: 'PUN', indexRef: 'MH-12', nickname: 'The Oxford of the East',
    localities: ['Koregaon Park', 'Kalyani Nagar', 'Viman Nagar', 'Baner', 'Aundh', 'Wakad', 'Hinjewadi', 'Kothrud', 'Magarpatta', 'Camp', 'Deccan', 'Shivaji Nagar', 'Other'] },
  { id: 'delhi', name: 'Delhi', state: 'DL', region: 'North', mark: 'DEL', indexRef: 'DL', nickname: 'The Capital',
    localities: ['South Delhi', 'Vasant Vihar', 'Defence Colony', 'Chanakyapuri', 'Connaught Place', 'Rajouri Garden', 'Punjabi Bagh', 'Dwarka', 'Pitampura', 'Lajpat Nagar', 'Other'] },
];

export const DEFAULT_CITY_ID = 'surat';

export function cityById(id: string | undefined | null): City | undefined {
  return CITIES.find((c) => c.id === id);
}

export type Level = 'locality' | 'city' | 'state' | 'india';
export const LEVELS: readonly Level[] = ['locality', 'city', 'state', 'india'];
export const LEVEL_LABEL: Record<Level, string> = { locality: 'Locality', city: 'City', state: 'State', india: 'India' };

export interface Scope { level: Level; cityId: string; locality: string; }

/** Normalise untrusted query input into a valid scope. Unknown values fall back to defaults. */
export function parseScope(input: { level?: string; city?: string; locality?: string }, fallbackCity = DEFAULT_CITY_ID, fallbackLocality?: string): Scope {
  const level = (LEVELS as readonly string[]).includes(input.level ?? '') ? (input.level as Level) : 'city';
  const city = cityById(input.city) ?? cityById(fallbackCity) ?? CITIES[0];
  const locality = city.localities.includes(input.locality ?? '')
    ? (input.locality as string)
    : fallbackLocality && city.localities.includes(fallbackLocality) ? fallbackLocality : city.localities[0];
  return { level, cityId: city.id, locality };
}

export function scopeName(scope: Scope): string {
  const city = cityById(scope.cityId)!;
  if (scope.level === 'india') return 'India';
  if (scope.level === 'state') return STATES[city.state];
  if (scope.level === 'city') return city.name;
  return scope.locality;
}
