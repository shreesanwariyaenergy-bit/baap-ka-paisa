// Geography: 45 cities in 19 states and union territories, grouped into six regions.
// This is product configuration, not demo data. The first five cities are the original launch cities (Product
// Blueprint, section 2) and are unchanged; the other 40 were added in the national expansion (November 2026).
// The database holds the same records (tables states, cities, localities); tests/unit/geo-sync.test.ts fails if
// this file and the migrations ever disagree.
// Gurugram and Faridabad are Haryana, Noida and Ghaziabad are Uttar Pradesh: separate boards, not part of Delhi.
// Delhi NCR is a region, not a state or a city, and has no board.
// Localities are major, recognisable areas only. Every city ends with 'Other', a real locality board for residents
// whose area is not listed; it is shown as "Other areas of <city>" wherever a board is named.

export type StateCode = 'GJ' | 'MH' | 'DL' | 'RJ' | 'PB' | 'HR' | 'UP' | 'CH' | 'KA' | 'TG' | 'TN' | 'KL' | 'WB' | 'BR' | 'JH' | 'OD' | 'MP' | 'CG' | 'AS';
export type Region = 'West' | 'North' | 'South' | 'East' | 'Central' | 'North-East';
export const REGIONS: readonly Region[] = ['West', 'North', 'South', 'East', 'Central', 'North-East'];

export interface City {
  id: string;
  name: string;
  state: StateCode;
  region: Region;
  /** Short mark used in the city-index watermark, as in the prototype. */
  mark: string;
  /** Vehicle registration series, used as the city-index reference (e.g. GJ-05 for Surat). */
  indexRef: string;
  /** Optional editorial nickname, shown under the city name. Null shows the state name. Edit here once approved. */
  nickname: string | null;
  localities: readonly string[];
}

// Display names. 'Delhi (NCT)' is a display label only: the database row for DL keeps its original name 'Delhi'
// (no database function reads state names).
export const STATES: Record<StateCode, string> = {
  GJ: 'Gujarat', MH: 'Maharashtra', RJ: 'Rajasthan',
  DL: 'Delhi (NCT)', PB: 'Punjab', HR: 'Haryana', UP: 'Uttar Pradesh', CH: 'Chandigarh',
  KA: 'Karnataka', TG: 'Telangana', TN: 'Tamil Nadu', KL: 'Kerala',
  WB: 'West Bengal', BR: 'Bihar', JH: 'Jharkhand', OD: 'Odisha',
  MP: 'Madhya Pradesh', CG: 'Chhattisgarh',
  AS: 'Assam',
};
/** Region of each state/UT, and the order states are listed in (region order, then this order). */
export const STATE_REGION: Record<StateCode, Region> = {
  GJ: 'West', MH: 'West', RJ: 'West',
  DL: 'North', PB: 'North', HR: 'North', UP: 'North', CH: 'North',
  KA: 'South', TG: 'South', TN: 'South', KL: 'South',
  WB: 'East', BR: 'East', JH: 'East', OD: 'East',
  MP: 'Central', CG: 'Central',
  AS: 'North-East',
};
export const STATE_ORDER = Object.keys(STATE_REGION) as StateCode[];
/** Union territories, for labelling ("States and UTs"). */
export const UNION_TERRITORIES: readonly StateCode[] = ['DL', 'CH'];

export const CITIES: readonly City[] = [
  { id: 'surat', name: 'Surat', state: 'GJ', region: 'West', mark: 'ST', indexRef: 'GJ-05', nickname: null,
    localities: ['Vesu', 'Adajan', 'Pal', 'Piplod', 'Athwa', 'Ghod Dod Road', 'City Light', 'Althan', 'Bhatar', 'Dumas', 'Rander', 'Varachha', 'Katargam', 'Udhna', 'Other'] },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'GJ', region: 'West', mark: 'AMD', indexRef: 'GJ-01', nickname: null,
    localities: ['SG Highway', 'Bodakdev', 'Prahlad Nagar', 'Satellite', 'Thaltej', 'Vastrapur', 'Bopal', 'Navrangpura', 'Science City', 'Maninagar', 'Gota', 'Chandkheda', 'Other'] },
  { id: 'mumbai', name: 'Mumbai', state: 'MH', region: 'West', mark: 'MB', indexRef: 'MH-01', nickname: null,
    localities: ['Bandra', 'Khar', 'Juhu', 'Andheri', 'Santacruz', 'Worli', 'Lower Parel', 'BKC', 'Colaba', 'Malabar Hill', 'Powai', 'Goregaon', 'Borivali', 'Chembur', 'Other'] },
  { id: 'pune', name: 'Pune', state: 'MH', region: 'West', mark: 'PUN', indexRef: 'MH-12', nickname: null,
    localities: ['Koregaon Park', 'Kalyani Nagar', 'Viman Nagar', 'Baner', 'Aundh', 'Wakad', 'Hinjewadi', 'Kothrud', 'Magarpatta', 'Camp', 'Deccan', 'Shivaji Nagar', 'Other'] },
  { id: 'delhi', name: 'Delhi', state: 'DL', region: 'North', mark: 'DEL', indexRef: 'DL', nickname: null,
    localities: ['South Delhi', 'Vasant Vihar', 'Defence Colony', 'Chanakyapuri', 'Connaught Place', 'Rajouri Garden', 'Punjabi Bagh', 'Dwarka', 'Pitampura', 'Lajpat Nagar', 'Other'] },
  // ---- National expansion (November 2026): 40 cities. Major areas only, plus 'Other'. ----
  { id: 'vadodara', name: 'Vadodara', state: 'GJ', region: 'West', mark: 'VAD', indexRef: 'GJ-06', nickname: null,
    localities: ['Alkapuri', 'Akota', 'Gotri', 'Manjalpur', 'Karelibaug', 'Sama', 'Other'] },
  { id: 'gandhinagar', name: 'Gandhinagar', state: 'GJ', region: 'West', mark: 'GNR', indexRef: 'GJ-18', nickname: null,
    localities: ['Sectors 1–10', 'Sectors 11–20', 'Sectors 21–30', 'Kudasan', 'Sargasan', 'Other'] },
  { id: 'rajkot', name: 'Rajkot', state: 'GJ', region: 'West', mark: 'RJK', indexRef: 'GJ-03', nickname: null,
    localities: ['Kalawad Road', 'Raiya Road', 'University Road', 'Mavdi', 'Bhaktinagar', 'Other'] },
  { id: 'nagpur', name: 'Nagpur', state: 'MH', region: 'West', mark: 'NGP', indexRef: 'MH-31', nickname: null,
    localities: ['Dharampeth', 'Civil Lines', 'Sadar', 'Itwari', 'Manish Nagar', 'Pratap Nagar', 'Other'] },
  { id: 'nashik', name: 'Nashik', state: 'MH', region: 'West', mark: 'NSK', indexRef: 'MH-15', nickname: null,
    localities: ['College Road', 'Gangapur Road', 'Indira Nagar', 'Nashik Road', 'Panchavati', 'CIDCO', 'Other'] },
  { id: 'thane', name: 'Thane', state: 'MH', region: 'West', mark: 'THN', indexRef: 'MH-04', nickname: null,
    localities: ['Ghodbunder Road', 'Vasant Vihar', 'Naupada', 'Majiwada', 'Kalwa', 'Other'] },
  { id: 'jaipur', name: 'Jaipur', state: 'RJ', region: 'West', mark: 'JPR', indexRef: 'RJ-14', nickname: null,
    localities: ['C-Scheme', 'Malviya Nagar', 'Vaishali Nagar', 'Mansarovar', 'Raja Park', 'Walled City', 'Other'] },
  { id: 'jodhpur', name: 'Jodhpur', state: 'RJ', region: 'West', mark: 'JDH', indexRef: 'RJ-19', nickname: null,
    localities: ['Sardarpura', 'Ratanada', 'Shastri Nagar', 'Paota', 'Basni', 'Other'] },
  { id: 'udaipur', name: 'Udaipur', state: 'RJ', region: 'West', mark: 'UDR', indexRef: 'RJ-27', nickname: null,
    localities: ['Fatehpura', 'Hiran Magri', 'Shobhagpura', 'Bhupalpura', 'Old City', 'Other'] },
  { id: 'kota', name: 'Kota', state: 'RJ', region: 'West', mark: 'KOT', indexRef: 'RJ-20', nickname: null,
    localities: ['Talwandi', 'Vigyan Nagar', 'Mahaveer Nagar', 'Dadabari', 'Kunhadi', 'Other'] },
  { id: 'ludhiana', name: 'Ludhiana', state: 'PB', region: 'North', mark: 'LDH', indexRef: 'PB-10', nickname: null,
    localities: ['Sarabha Nagar', 'Model Town', 'Civil Lines', 'BRS Nagar', 'Dugri', 'Haibowal', 'Other'] },
  { id: 'amritsar', name: 'Amritsar', state: 'PB', region: 'North', mark: 'ASR', indexRef: 'PB-02', nickname: null,
    localities: ['Ranjit Avenue', 'Lawrence Road', 'Green Avenue', 'Majitha Road', 'Walled City', 'Other'] },
  { id: 'gurugram', name: 'Gurugram', state: 'HR', region: 'North', mark: 'GGN', indexRef: 'HR-26', nickname: null,
    localities: ['DLF City', 'Golf Course Road', 'Golf Course Extension Road', 'Sohna Road', 'Sushant Lok', 'Palam Vihar', 'Dwarka Expressway', 'Old Gurugram', 'Other'] },
  { id: 'faridabad', name: 'Faridabad', state: 'HR', region: 'North', mark: 'FBD', indexRef: 'HR-51', nickname: null,
    localities: ['NIT', 'Old Faridabad', 'Sector 15', 'Sector 21', 'Greater Faridabad', 'Ballabgarh', 'Other'] },
  { id: 'hisar', name: 'Hisar', state: 'HR', region: 'North', mark: 'HSR', indexRef: 'HR-20', nickname: null,
    localities: ['Model Town', 'Urban Estate', 'HUDA Sectors', 'Old City', 'Other'] },
  { id: 'panipat', name: 'Panipat', state: 'HR', region: 'North', mark: 'PNP', indexRef: 'HR-06', nickname: null,
    localities: ['Model Town', 'HUDA Sectors', 'Tehsil Camp', 'Old City', 'Other'] },
  { id: 'lucknow', name: 'Lucknow', state: 'UP', region: 'North', mark: 'LKO', indexRef: 'UP-32', nickname: null,
    localities: ['Gomti Nagar', 'Hazratganj', 'Indira Nagar', 'Aliganj', 'Alambagh', 'Aminabad', 'Chowk', 'Jankipuram', 'Other'] },
  { id: 'kanpur', name: 'Kanpur', state: 'UP', region: 'North', mark: 'KNP', indexRef: 'UP-78', nickname: null,
    localities: ['Civil Lines', 'Swaroop Nagar', 'Kakadeo', 'Kidwai Nagar', 'Kalyanpur', 'Govind Nagar', 'Other'] },
  { id: 'noida', name: 'Noida', state: 'UP', region: 'North', mark: 'NOI', indexRef: 'UP-16', nickname: null,
    localities: ['Sectors 1–39', 'Sectors 40–79', 'Sectors 80–119', 'Sectors 120–168', 'Other'] },
  { id: 'varanasi', name: 'Varanasi', state: 'UP', region: 'North', mark: 'VNS', indexRef: 'UP-65', nickname: null,
    localities: ['Assi', 'Lanka', 'Sigra', 'Bhelupur', 'Cantonment', 'Other'] },
  { id: 'agra', name: 'Agra', state: 'UP', region: 'North', mark: 'AGR', indexRef: 'UP-80', nickname: null,
    localities: ['Kamla Nagar', 'Dayal Bagh', 'Sikandra', 'Tajganj', 'Shahganj', 'Agra Cantt', 'Other'] },
  { id: 'ghaziabad', name: 'Ghaziabad', state: 'UP', region: 'North', mark: 'GZB', indexRef: 'UP-14', nickname: null,
    localities: ['Indirapuram', 'Vaishali', 'Vasundhara', 'Raj Nagar', 'Raj Nagar Extension', 'Kavi Nagar', 'Other'] },
  { id: 'chandigarh', name: 'Chandigarh', state: 'CH', region: 'North', mark: 'CHD', indexRef: 'CH-01', nickname: null,
    localities: ['Sectors 1–12', 'Sectors 14–24', 'Sectors 25–35', 'Sectors 36–47', 'Sectors 48–63', 'Manimajra', 'Other'] },
  { id: 'bengaluru', name: 'Bengaluru', state: 'KA', region: 'South', mark: 'BLR', indexRef: 'KA-01', nickname: null,
    localities: ['Indiranagar', 'Koramangala', 'Whitefield', 'Jayanagar', 'JP Nagar', 'Malleshwaram', 'Hebbal', 'Electronic City', 'Other'] },
  { id: 'hyderabad', name: 'Hyderabad', state: 'TG', region: 'South', mark: 'HYD', indexRef: 'TG-09', nickname: null,
    localities: ['Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'Madhapur', 'Kukatpally', 'Begumpet', 'Secunderabad', 'Dilsukhnagar', 'Other'] },
  { id: 'chennai', name: 'Chennai', state: 'TN', region: 'South', mark: 'CHN', indexRef: 'TN-01', nickname: null,
    localities: ['Adyar', 'Anna Nagar', 'T. Nagar', 'Mylapore', 'Velachery', 'Nungambakkam', 'Porur', 'Other'] },
  { id: 'kochi', name: 'Kochi', state: 'KL', region: 'South', mark: 'KOC', indexRef: 'KL-07', nickname: null,
    localities: ['Edappally', 'Kakkanad', 'Kadavanthra', 'Vyttila', 'Palarivattom', 'Fort Kochi', 'Other'] },
  { id: 'kolkata', name: 'Kolkata', state: 'WB', region: 'East', mark: 'KOL', indexRef: 'WB-01', nickname: null,
    localities: ['Ballygunge', 'Alipore', 'Park Street', 'Salt Lake', 'New Town', 'Behala', 'Tollygunge', 'Shyambazar', 'Other'] },
  { id: 'siliguri', name: 'Siliguri', state: 'WB', region: 'East', mark: 'SLG', indexRef: 'WB-74', nickname: null,
    localities: ['Pradhan Nagar', 'Hakim Para', 'Ashrampara', 'Sevoke Road', 'Other'] },
  { id: 'patna', name: 'Patna', state: 'BR', region: 'East', mark: 'PAT', indexRef: 'BR-01', nickname: null,
    localities: ['Boring Road', 'Kankarbagh', 'Patliputra Colony', 'Rajendra Nagar', 'Bailey Road', 'Patna City', 'Other'] },
  { id: 'ranchi', name: 'Ranchi', state: 'JH', region: 'East', mark: 'RNC', indexRef: 'JH-01', nickname: null,
    localities: ['Lalpur', 'Doranda', 'Harmu', 'Bariatu', 'Morabadi', 'Other'] },
  { id: 'bhubaneswar', name: 'Bhubaneswar', state: 'OD', region: 'East', mark: 'BBS', indexRef: 'OD-02', nickname: null,
    localities: ['Saheed Nagar', 'Jaydev Vihar', 'Nayapalli', 'Patia', 'Chandrasekharpur', 'Old Town', 'Other'] },
  { id: 'cuttack', name: 'Cuttack', state: 'OD', region: 'East', mark: 'CTC', indexRef: 'OD-05', nickname: null,
    localities: ['Buxi Bazaar', 'Badambadi', 'College Square', 'Link Road', 'Tulsipur', 'Other'] },
  { id: 'indore', name: 'Indore', state: 'MP', region: 'Central', mark: 'IDR', indexRef: 'MP-09', nickname: null,
    localities: ['Vijay Nagar', 'Palasia', 'Rajwada', 'Bhawarkua', 'Sudama Nagar', 'Nipania', 'Other'] },
  { id: 'bhopal', name: 'Bhopal', state: 'MP', region: 'Central', mark: 'BPL', indexRef: 'MP-04', nickname: null,
    localities: ['Arera Colony', 'MP Nagar', 'Kolar Road', 'TT Nagar', 'Bairagarh', 'Old City', 'Other'] },
  { id: 'jabalpur', name: 'Jabalpur', state: 'MP', region: 'Central', mark: 'JBP', indexRef: 'MP-20', nickname: null,
    localities: ['Napier Town', 'Wright Town', 'Civil Lines', 'Vijay Nagar', 'Adhartal', 'Other'] },
  { id: 'gwalior', name: 'Gwalior', state: 'MP', region: 'Central', mark: 'GWL', indexRef: 'MP-07', nickname: null,
    localities: ['City Centre', 'Lashkar', 'Morar', 'Thatipur', 'Gola Ka Mandir', 'Other'] },
  { id: 'raipur', name: 'Raipur', state: 'CG', region: 'Central', mark: 'RPR', indexRef: 'CG-04', nickname: null,
    localities: ['Shankar Nagar', 'Civil Lines', 'Telibandha', 'Pandri', 'Devendra Nagar', 'Other'] },
  { id: 'bhilai', name: 'Bhilai', state: 'CG', region: 'Central', mark: 'BHL', indexRef: 'CG-07', nickname: null,
    localities: ['BSP Township', 'Nehru Nagar', 'Supela', 'Smriti Nagar', 'Other'] },
  { id: 'guwahati', name: 'Guwahati', state: 'AS', region: 'North-East', mark: 'GHY', indexRef: 'AS-01', nickname: null,
    localities: ['Dispur', 'Ganeshguri', 'Beltola', 'Chandmari', 'Paltan Bazaar', 'Maligaon', 'Other'] },
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
  return localityLabel(city, scope.locality);
}

/** The fallback locality every city has. Its board is named "Other areas of <city>", never as a neighbourhood. */
export const OTHER_LOCALITY = 'Other';
export function localityLabel(city: Pick<City, 'name'>, locality: string): string {
  return locality === OTHER_LOCALITY ? `Other areas of ${city.name}` : locality;
}
/** Before there is member data, the homepage features the five launch cities and Bengaluru. */
export const DEFAULT_FEATURED: readonly string[] = ['surat', 'ahmedabad', 'mumbai', 'pune', 'delhi', 'bengaluru'];
/**
 * The cities featured on the homepage, in order: the signed-in member's own city, the city being shown, then cities
 * with members ranked by members and season total (real data only, nothing estimated), then the defaults.
 */
export function featuredCities(input: { viewerCityId?: string | null; currentCityId?: string | null; summaries: readonly { cityId: string; members: number; seasonTotal: number }[] }, count = 6): City[] {
  const byData = input.summaries.filter((s) => s.members > 0).sort((a, b) => b.members - a.members || b.seasonTotal - a.seasonTotal || a.cityId.localeCompare(b.cityId)).map((s) => s.cityId);
  const ids = [input.viewerCityId, input.currentCityId, ...byData, ...DEFAULT_FEATURED, ...CITIES.map((c) => c.id)];
  const out: City[] = [];
  for (const id of ids) { const c = cityById(id); if (c && !out.includes(c)) out.push(c); if (out.length === count) break; }
  return out;
}
/** City options grouped by state/UT, in display order, for native <optgroup> pickers. */
export function cityOptionGroups(): { label: string; cities: { id: string; name: string }[] }[] {
  return citiesByState().map((g) => ({ label: g.name, cities: g.cities.map((c) => ({ id: c.id, name: c.name })) }));
}
/** States in display order with their cities (cities in list order). For grouped pickers and the city index. */
export function citiesByState(): { code: StateCode; name: string; region: Region; cities: City[] }[] {
  return STATE_ORDER.map((code) => ({ code, name: STATES[code], region: STATE_REGION[code], cities: CITIES.filter((c) => c.state === code) }))
    .filter((g) => g.cities.length > 0);
}
