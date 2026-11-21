import { describe, expect, it } from 'vitest';
import { LEGAL_DOCS } from '@/lib/legal';
import { ANTI_SNIPE_MAX, ANTI_SNIPE_STEP, ANTI_SNIPE_WINDOW, ENTRY_MINIMUM, HOUR, MINUTE, STEP } from '@/lib/engine/engine';
import { checkFlexLine } from '@/lib/profile-rules';

const text = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug)!.sections.flatMap((s) => s.paragraphs).join(' ');

describe('policy pages', () => {
  it('keeps the five footer routes', () => {
    expect(LEGAL_DOCS.map((d) => d.slug).sort()).toEqual(['community', 'grievance', 'privacy', 'refunds', 'terms']);
  });

  it('states the same ranking and season figures as the engine', () => {
    const t = text('terms');
    expect(t).toContain(`₹${ENTRY_MINIMUM.toLocaleString('en-IN')}`);
    expect(t).toContain(`multiples of ₹${STEP}`);
    expect(t).toContain(`at least ₹${STEP} above`);
    expect(t).toContain(`last ${ANTI_SNIPE_WINDOW / MINUTE} minutes`);
    expect(t).toContain(`extended by ${ANTI_SNIPE_STEP / MINUTE} minutes`);
    expect(t).toContain(`maximum of ${ANTI_SNIPE_MAX / HOUR} hours`);
    expect(t).toContain('00:00 on the 1st to 23:59 on the last day');
  });

  it('describes only data the product collects', () => {
    const p = text('privacy');
    expect(p).toContain('We do not collect your mobile number');
    expect(p).not.toMatch(/registered mobile number/i);
    expect(text('community')).toContain('limited to 40 characters');
    expect(checkFlexLine('x'.repeat(40))).toBeNull();
    expect(checkFlexLine('x'.repeat(41))).not.toBeNull();
    expect(checkFlexLine('call 9876543210')).not.toBeNull();
  });

  it('never invents grievance contact details', () => {
    const g = LEGAL_DOCS.find((d) => d.slug === 'grievance')!;
    expect(g.contact?.find((c) => c.label === 'Business')?.value).toBe('VEXOR LABS');
    expect(g.contact?.filter((c) => c.value === null).map((c) => c.label)).toEqual(['Grievance Officer', 'Email', 'Address']);
    expect(LEGAL_DOCS.every((d) => d.effective === null)).toBe(true);
  });
});
