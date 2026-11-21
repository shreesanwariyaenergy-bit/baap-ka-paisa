import { describe, expect, it } from 'vitest';
import { LEGAL_DOCS } from '@/lib/legal';
import { ANTI_SNIPE_MAX, ANTI_SNIPE_STEP, ANTI_SNIPE_WINDOW, ENTRY_MINIMUM, HOUR, MINUTE, STEP } from '@/lib/engine/engine';
import { checkFlexLine } from '@/lib/profile-rules';

const text = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug)!.sections.flatMap((s) => s.paragraphs).join(' ');
const all = LEGAL_DOCS.map((d) => text(d.slug)).join(' ');

describe('policy pages', () => {
  it('keeps the five footer destinations', () => {
    expect(LEGAL_DOCS.map((d) => [d.slug, d.title])).toEqual([
      ['terms', 'Terms'], ['privacy', 'Privacy'], ['refunds', 'Refunds'], ['community', 'Guidelines'], ['grievance', 'Grievance'],
    ]);
  });

  it('states the same ranking and season figures as the engine', () => {
    const t = text('terms');
    expect(t).toContain(`₹${ENTRY_MINIMUM.toLocaleString('en-IN')}`);
    expect(t).toContain(`multiple of ₹${STEP}`);
    expect(t).toContain(`at least ₹${STEP} above`);
    expect(t).toContain(`final ${ANTI_SNIPE_WINDOW / MINUTE} minutes`);
    expect(t).toContain(`extends the season by ${ANTI_SNIPE_STEP / MINUTE} minutes, up to ${ANTI_SNIPE_MAX / HOUR} hours`);
    expect(t).toContain('00:00 IST on the 1st to 23:59 IST on the last day');
  });

  it('describes only data the product collects', () => {
    expect(text('privacy')).toContain('We do not collect your mobile number');
    expect(text('community')).toContain('limited to 40 characters');
    expect(checkFlexLine('x'.repeat(40))).toBeNull();
    expect(checkFlexLine('x'.repeat(41))).not.toBeNull();
  });

  it('shows no internal review notes, placeholders or retired phrases', () => {
    expect(all).not.toMatch(/draft|legal review|to be published|status register|TODO/i);
    expect(text('grievance')).toContain('operated by VEXOR LABS');
  });
});
