// Standings.tsx
// The conference table: the only standing that decides anything. The top
// eight play the conference tournament, and the four who come through it go
// on to the regionals.
//
// The header says that once, the dashed line in the table shows where the cut
// is, and the caption names what each column means. The national ranking sits
// under it as one row that says what the number measures.

import { leagueName } from '../../engine/leagueNames.js';
import { useConferenceTable, useDynasty, useUserTeam } from '../../state/store.js';
import { useOpenTeam } from './TeamCard.js';
import { nationalRank, pollIsProjected, regularRecord } from '../../engine/season.js';
import { GodBolt } from '../god/GodBolt.js';
// The cut is the engine's, not a number typed into a sentence.
import { CONF_ADVANCE, CONF_FIELD } from '../../engine/postseason.js';
import { Card, Marquee, Plaque, Table, TeamCell, TileGrid } from '../components/ui/index.js';
import { Crest } from '../Crest.js';
import { ordinal, recordText } from '../words.js';

export function Standings() {
  const table = useConferenceTable();
  const team = useUserTeam();
  const season = useDynasty((s) => s.season);
  const overlay = useDynasty((s) => s.overlay);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const go = useDynasty((s) => s.go);
  const version = useDynasty((s) => s.version);
  const openTeam = useOpenTeam();
  void version;
  if (!team || !season) return null;

  // Games back on the conference race, the race this table is.
  const leader = table[0];
  const gamesBack = (t: typeof table[number]): string => {
    if (!leader || t.index === leader.index) return '—';
    const gb = ((leader.cw - t.cw) + (t.cl - leader.cl)) / 2;
    return gb <= 0 ? '—' : gb % 1 === 0 ? String(gb) : gb.toFixed(1);
  };
  const rank = nationalRank(season, team.index);
  const projected = pollIsProjected(season);
  const mineAt = table.findIndex((t) => t.index === team.index) + 1;
  const toNational = (): void => {
    if (overlay !== null) openOverlay('rankings');
    else go('season', 'rankings');
  };

  return (
    <main className="pb-page">
      <Marquee
        mark={<Crest abbr={team.def.abbr} size={44} />}
        eyebrow="Conference race"
        title={leagueName(team.conference)}
        trailing={<GodBolt target={{ kind: 'leagues' }} label="Edit the leagues in god mode" />}
        numbers={[
          {
            label: 'You sit',
            value: mineAt > 0 ? ordinal(mineAt) : '—',
            note: mineAt > 0 && mineAt <= CONF_FIELD ? 'In the field' : mineAt > 0 ? 'Outside the cut' : 'No games yet',
            tone: mineAt > 0 ? (mineAt <= CONF_ADVANCE ? 'positive' : mineAt <= CONF_FIELD ? 'info' : 'warning') : undefined,
          },
          { label: 'Conference', value: recordText(team.cw, team.cl) },
          { label: 'Games back', value: gamesBack(team) },
        ]}
      />

      <Card flush>
        <Table
          label="Conference standings"
          columns={[
            { label: '#', width: '24px', align: 'right' },
            { label: 'Team', grow: true },
            { label: 'Conf', title: 'Conference record', width: '52px', align: 'right', strong: true },
            { label: 'GB', title: 'Games back of first place', width: '36px', align: 'right' },
          ]}
          rows={table.map((t, i) => {
            const reg = regularRecord(t);
            const diff = t.rs - t.ra;
            const you = t.index === team.index;
            return {
              key: t.def.abbr,
              you,
              divider: i === CONF_FIELD,
              onClick: () => openTeam(t.index),
              cells: [
                <b key="r" className="pb-rank">{i + 1}</b>,
                <TeamCell
                  key="t"
                  abbr={t.def.abbr}
                  name={t.def.school}
                  you={you}
                  sub={`${recordText(reg.w, reg.l)} overall · ${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)} run difference`}
                />,
                recordText(t.cw, t.cl),
                gamesBack(t),
              ],
            };
          })}
          caption={`The dashed line is the tournament cut: the top ${CONF_FIELD} make it. Conf is the conference record; GB is games back of first place.`}
        />
      </Card>

      <TileGrid cols={2} label="Elsewhere">
        <Plaque
          icon="globe"
          label={projected ? 'Preseason' : 'National'}
          value={rank > 0 ? `#${rank}` : '—'}
          note={`of ${season.teams.length}${projected ? ' · projected' : ' · RPI'}`}
          onClick={toNational}
        />
        <Plaque
          icon="target"
          label="Tournament cut"
          value={CONF_FIELD}
          note={`${CONF_ADVANCE} go on to the regionals`}
        />
      </TileGrid>
    </main>
  );
}
