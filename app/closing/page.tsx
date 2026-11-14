import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CLOSING_OPENS, CLOSING_SPEED, closingInstant, closingStateAt } from '@/lib/closing';
import { ClosingStage } from '@/components/ClosingStage';
import { liveClosingState } from '@/lib/closing-live';
import { getDataSource } from '@/lib/data';

export const metadata: Metadata = { title: 'The Closing' };
export const dynamic = 'force-dynamic';

export default async function ClosingPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const live = await liveClosingState(await getDataSource(), (await searchParams).city);
  if (live) return <ClosingStage initial={live} speed={1} />;
  const started = Number((await cookies()).get('bkp_closing_start')?.value);
  const now = Date.now();
  const running = Number.isFinite(started) && started > 0 && started <= now;
  const state = running ? closingStateAt(closingInstant(started, now)) : { ...closingStateAt(CLOSING_OPENS), phase: 'idle' as const };
  return <ClosingStage initial={state} speed={CLOSING_SPEED} />;
}
