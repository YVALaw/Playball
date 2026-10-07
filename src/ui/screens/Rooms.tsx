// Rooms.tsx
// Every room by name, for the two places a room can be shown: as a screen of
// its own tab (Office · Staff, Program · Hall of Fame) and as an overlay laid
// over whatever frame the game is in (the coach profile from the portrait, the
// board from a letter, the staff room in the offseason). One component, so the
// two can never drift apart, and neither is a sheet inside another page.

import { useDynasty, useUserTeam, type Room } from '../../state/store.js';
import { BoardRoom, CoachProfile, HallRoom, WatchlistRoom } from './Program.js';
import { BudgetRoom, FacilitiesRoom, NetworkRoom, StaffRoom } from './ProgramRooms.js';

export function RoomScreen({ room }: { room: Room }) {
  // The engine mutates in place; with Screen memoised this is what redraws it (M50).
  useDynasty((s) => s.version);
  const season = useDynasty((s) => s.season);
  const team = useUserTeam();
  if (!season || !team) return null;
  switch (room) {
    case 'staff': return <StaffRoom team={team} />;
    case 'facilities': return <FacilitiesRoom team={team} />;
    case 'budget': return <BudgetRoom team={team} />;
    case 'network': return <NetworkRoom team={team} />;
    case 'board': return <BoardRoom team={team} />;
    case 'watchlist': return <WatchlistRoom />;
    case 'hall': return <HallRoom />;
    case 'coach': return <CoachProfile team={team} />;
  }
}
