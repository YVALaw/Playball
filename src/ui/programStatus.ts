import { SEATS } from '../engine/economy.js';
import type { useDynasty } from '../state/store.js';

type AttentionState = Pick<ReturnType<typeof useDynasty.getState>,
  'lastReview' | 'offers' | 'economy' | 'year' | 'unseenTrophies' | 'unseenRecords'>;

/** One priority order for the Program prompt and both navigation bars. */
export function programAttention(s: AttentionState): 'board' | 'staff' | 'coach' | 'history' | null {
  if (s.lastReview !== null || s.offers.length > 0) return 'board';
  if (SEATS.some(seat => {
    const coach = s.economy.staff[seat];
    return coach?.until !== undefined && coach.until <= s.year;
  })) return 'staff';
  if (s.unseenTrophies.length > 0) return 'coach';
  if (s.unseenRecords.length > 0) return 'history';
  return null;
}
