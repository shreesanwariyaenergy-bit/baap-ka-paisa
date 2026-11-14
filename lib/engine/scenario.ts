// A short, fixed simulation used by /simulator. Simulated members and payments only.
import { HOUR, MINUTE, type EngineEvent, type EngineMember, type SeasonDef } from './engine';

export const SCENARIO_START = new Date('2026-12-01T00:00:00+05:30').getTime();
export const SCENARIO_SEASON: SeasonDef = { id: 99, startsAt: SCENARIO_START, scheduledEnd: SCENARIO_START + 3 * 24 * HOUR };
const END = SCENARIO_SEASON.scheduledEnd;

export const SCENARIO_MEMBERS: (EngineMember & { name: string })[] = [
  { id: 'sim.riya', name: 'Riya (simulated)', cityId: 'surat', state: 'GJ', locality: 'Vesu' },
  { id: 'sim.aman', name: 'Aman (simulated)', cityId: 'surat', state: 'GJ', locality: 'Adajan' },
  { id: 'sim.zoya', name: 'Zoya (simulated)', cityId: 'surat', state: 'GJ', locality: 'Vesu' },
];

export interface ScenarioStep { event: EngineEvent; title: string; expect: string; }
const c = (id: string, memberId: string, amount: number, at: number): EngineEvent => ({ type: 'credit', id, memberId, amount, at });

export const SCENARIO_STEPS: ScenarioStep[] = [
  { event: c('s1', 'sim.riya', 5000, SCENARIO_START + 2 * HOUR), title: 'Riya enters with ₹5,000', expect: 'First #01 on the Surat board: Crown Moment.' },
  { event: c('s2', 'sim.aman', 3000, SCENARIO_START + 5 * HOUR), title: 'Aman enters with ₹3,000', expect: 'Aman is #02. No change at the top.' },
  { event: c('s3', 'sim.aman', 700, SCENARIO_START + 6 * HOUR), title: 'Aman tries ₹700', expect: 'Rejected on the server: amounts go in steps of ₹500.' },
  { event: c('s4', 'sim.aman', 2500, SCENARIO_START + 20 * HOUR), title: 'Aman adds ₹2,500 (₹5,500 total)', expect: 'Passes Riya by ₹500: new #01, Crown Moment.' },
  { event: c('s5', 'sim.riya', 1000, SCENARIO_START + 30 * HOUR), title: 'Riya adds ₹1,000 (₹6,000 total)', expect: 'Retakes #01 within 24 hours: Revenge Taken.' },
  { event: c('s6', 'sim.zoya', 1000, END - 10 * MINUTE), title: 'Zoya enters with ₹1,000, 10 minutes before the close', expect: 'Takes no #01 on any board (Riya holds Vesu), so the season is not extended.' },
  { event: c('s7', 'sim.zoya', 6000, END - 8 * MINUTE), title: 'Zoya adds ₹6,000 (₹7,000 total), 8 minutes before the close', expect: 'Takes #01 in the last 15 minutes: Crown Moment and the season is extended by 15 minutes.' },
  { event: c('s8', 'sim.aman', 2000, END + 3 * MINUTE), title: 'Aman adds ₹2,000 (₹7,500 total) in the extension', expect: 'Accepted because the season was extended; taking #01 again extends it again.' },
  { event: c('s9', 'sim.riya', 1000, END + 40 * MINUTE), title: 'Riya tries ₹1,000 after the final whistle', expect: 'Rejected: the season has closed.' },
];

/** Engine "now" after a step: the step's time, or after the close for the final view. */
export const stepTime = (n: number) => (n === 0 ? SCENARIO_START : n >= SCENARIO_STEPS.length ? END + 3 * HOUR : SCENARIO_STEPS[n - 1].event.at);
