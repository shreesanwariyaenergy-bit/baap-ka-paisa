// Shared by server and client components.
import type { Movement } from '@/lib/data/types';
export function movementLabel(m: Movement | null): { text: string; cls: string; sr: string } {
  if (!m) return { text: '', cls: 'neutral', sr: 'No change data' };
  switch (m.kind) {
    case 'up': return { text: `▲ ${m.by}`, cls: '', sr: `Up ${m.by} in the last 24 hours` };
    case 'down': return { text: `▼ ${m.by}`, cls: 'down', sr: `Down ${m.by} in the last 24 hours` };
    case 'new': return { text: 'NEW', cls: 'neutral', sr: 'New entry in the last 24 hours' };
    case 'took': return { text: 'TOOK #01', cls: '', sr: 'Took number one in the last 24 hours' };
    case 'defending': return { text: 'HOLDING', cls: 'neutral', sr: 'Holding number one' };
    default: return { text: '●', cls: 'neutral', sr: 'No change in the last 24 hours' };
  }
}
