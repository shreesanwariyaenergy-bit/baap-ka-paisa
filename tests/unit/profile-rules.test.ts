import { describe, expect, it } from 'vitest';
import { ageOn, checkFlexLine, checkUsername, placeLockedUntil, validateProfile } from '@/lib/profile-rules';

const TODAY = new Date('2026-11-10T12:00:00+05:30');

describe('onboarding rules', () => {
  it('18+ only, measured in IST', () => {
    expect(ageOn('2008-11-10', TODAY)).toBe(18);
    expect(ageOn('2008-11-11', TODAY)).toBe(17);
    expect(validateProfile({ username: 'riya.v', displayName: 'Riya', dateOfBirth: '2008-11-11', cityId: 'surat', locality: 'Vesu' }, 'join', TODAY).dateOfBirth).toMatch(/18/);
  });
  it('accepts a complete, valid profile', () => {
    expect(validateProfile({ username: 'riya.v', displayName: 'Riya Shah', dateOfBirth: '1995-01-20', cityId: 'surat', locality: 'Vesu', title: 'Founder', flexLine: 'Vesu forever' }, 'join', TODAY)).toEqual({});
  });
  it('requires a launch city and a locality from its fixed list', () => {
    const e = validateProfile({ username: 'riya.v', displayName: 'Riya', dateOfBirth: '1995-01-20', cityId: 'bengaluru', locality: 'Indiranagar' }, 'join', TODAY);
    expect(e.cityId).toBeDefined();
    expect(validateProfile({ username: 'riya.v', displayName: 'Riya', dateOfBirth: '1995-01-20', cityId: 'pune', locality: 'Vesu' }, 'join', TODAY).locality).toBeDefined();
  });
  it('username rules', () => {
    expect(checkUsername('ok.name_1')).toBeNull();
    expect(checkUsername('No')).not.toBeNull();
    expect(checkUsername('admin')).not.toBeNull();
    expect(checkUsername('anon-07')).not.toBeNull();
    expect(checkUsername('.dot')).not.toBeNull();
  });
  it('flex line: 40 characters, no phone numbers, links or abuse', () => {
    expect(checkFlexLine('Ring road to the top')).toBeNull();
    expect(checkFlexLine('x'.repeat(41))).toMatch(/40/);
    expect(checkFlexLine('call 98765 43210')).toMatch(/Phone/);
    expect(checkFlexLine('see insta.com/me')).toMatch(/Links/);
    expect(checkFlexLine('you are a gandu')).toMatch(/friendly/);
  });
  it('city and locality lock for 90 days', () => {
    expect(placeLockedUntil(new Date('2026-08-01T00:00:00Z')).toISOString()).toBe('2026-10-30T00:00:00.000Z');
  });
});
