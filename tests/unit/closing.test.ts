import { describe, expect, it } from 'vitest';
import { CLOSING_OPENS, CLOSING_SEASON, CLOSING_SPEED, closingInstant, closingStateAt } from '@/lib/closing';
import { ANTI_SNIPE_MAX, MINUTE } from '@/lib/engine/engine';

const END = CLOSING_SEASON.scheduledEnd;
const at = (min: number) => closingStateAt(END + min * MINUTE);

describe('The Closing (practice season)', () => {
  it('opens with the holder, a price one step past them, and three standing declarations', () => {
    const s = closingStateAt(CLOSING_OPENS);
    expect(s).toMatchObject({ phase: 'live', extensions: 0, holder: { name: 'Riya Kapadia', score: 42000 }, price: 42500, thronesChanged: 0 });
    expect(s.declarations.map((d) => d.status)).toEqual(['standing', 'standing', 'standing']);
    expect(s.board.find((r) => r.name === 'Aman Shroff')!.toTake).toBe(4000);
  });
  it('an overtake inside the last 15 minutes extends the close by 15 minutes; one outside it does not', () => {
    expect(at(-16.5)).toMatchObject({ extensions: 0 });                      // Kabir climbed at -16: no extension
    expect(at(-11)).toMatchObject({ phase: 'extended', extensions: 1, extendedBy: 15, holder: { name: 'Aman Shroff', score: 42500 } });
    expect(at(-1)).toMatchObject({ extensions: 1, holder: { name: 'Zoya Mistry' } }); // took it before the new window opened
  });
  it('a declaration is made good only by the board, and the others are spent when the throne moves', () => {
    const s = at(-11);
    expect(s.declarations.map((d) => [d.challenger, d.status])).toEqual([['Aman Shroff', 'won'], ['Kabir Jariwala', 'throne-moved'], ['Zoya Mistry', 'throne-moved']]);
  });
  it('the price always equals the holder plus one step', () => {
    for (const mnt of [-20, -12, -7, -2, 4, 21, 38, 52, 70]) { const s = at(mnt); expect(s.price).toBe(s.holder!.score + 500); }
  });
  it('a tie does not take the throne and does not extend the season', () => {
    const before = at(67), after = at(69);
    expect(after.holder!.name).toBe('Riya Kapadia'); expect(after.extensions).toBe(before.extensions);
    expect(after.ticker[0]).toMatchObject({ kind: 'entry', extended: false });
    expect(after.board[1]).toMatchObject({ name: 'Zoya Mistry', score: 45500, toTake: 500 });
  });
  it('closes at the extended time, refuses what arrives after, and gives one final verdict', () => {
    const open = at(74), shut = at(76), late = at(81);
    expect(open.phase).toBe('extended'); expect(open.verdict).toBeNull(); expect(open.extensions).toBe(5);
    expect(shut.phase).toBe('closed'); expect(shut.remainingMs).toBe(0);
    expect(late.verdict).toMatchObject({ winner: 'Riya Kapadia', score: 45500, margin: 0, runnerUp: 'Zoya Mistry', extensions: 5, refused: 1 });
    expect(late.ticker[0]).toMatchObject({ kind: 'refused' });
    expect(late.board).toEqual(shut.board);                                 // a refused credit changes nothing
    expect(late.extendedBy * MINUTE).toBeLessThanOrEqual(ANTI_SNIPE_MAX);
  });
  it('the server clock maps real time to practice time and stops after the close', () => {
    expect(closingInstant(1000, 1000)).toBe(CLOSING_OPENS);
    expect(closingInstant(1000, 61_000)).toBe(CLOSING_OPENS + 60_000 * CLOSING_SPEED);
    expect(closingInstant(1000, 500)).toBe(CLOSING_OPENS);
    expect(closingStateAt(closingInstant(0, 3_600_000)).phase).toBe('closed');
  });
});
