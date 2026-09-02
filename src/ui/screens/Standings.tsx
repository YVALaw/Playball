// Standings.tsx
// The conference table, which is the only standing that decides anything: the
// top six here play the tournament that decides who goes to a regional.
//
// The proposal's standings table — a dark head row, a rank in red, the program,
// its record and the games back — with the two columns this game needs that a
// four-team mockup did not: the conference record beside the overall, and the
// run differential, which is what tells you whether a record is real.

import { useConferenceTable, useDynasty, useUserTeam } from '../../state/store.js';
import { useOpenTeam } from './TeamCard.js';
import { regularRecord } from '../../engine/season.js';
import { FieldNote, ModuleIntro } from '../components/Kit.js';
// The cut is the engine's, not a number typed into a sentence. See below.
import { CONF_ADVANCE, CONF_FIELD } from '../../engine/postseason.js';
import { ChevronRightIcon } from '@radix-ui/react-icons';

export function Standings() {
  const table = useConferenceTable();
  const team = useUserTeam();
  const season = useDynasty((s) => s.season);
  const openTeam = useOpenTeam();
  if (!team || !season) return null;

  /*
    Games back, which the old table did not print and every standings table in
    baseball does.

    It is the number that answers the only question a table is asked in May —
    how far behind am I — and it is not derivable at a glance from two records.
    Measured on the conference race, because that is the race this table is.
  */
  const leader = table[0];
  const gamesBack = (t: typeof table[number]): string => {
    if (!leader || t.index === leader.index) return '—';
    const gb = ((leader.cw - t.cw) + (t.cl - leader.cl)) / 2;
    return gb === 0 ? '—' : gb.toFixed(1);
  };

  return (
    <main className="module-workspace">
      <ModuleIntro
        kicker="CONFERENCE"
        title={`${team.conference} race`}
        text={`The standings reduced to what changes your next decision. The top ${CONF_FIELD} here play the tournament.`}
      />

      <section className="standings-table">
        <div className="table-head">
          <span>TEAM</span>
          <span>CONF</span>
          <span>GB</span>
        </div>
        {table.map((t, i) => {
          const reg = regularRecord(t);
          const diff = t.rs - t.ra;
          return (
            <button
              className={t.index === team.index ? 'is-yours' : ''}
              key={t.def.abbr}
              type="button"
              onClick={() => openTeam(t.index)}
            >
              <b>{i + 1}</b>
              <strong>
                {t.def.school}
                <em>
                  {reg.w}-{reg.l} overall · {diff > 0 ? '+' : ''}{diff} run diff
                </em>
              </strong>
              <span>{t.cw}-{t.cl}</span>
              <span>{gamesBack(t)}</span>
              <ChevronRightIcon />
            </button>
          );
        })}
      </section>

      <FieldNote
        title={`The line that matters is ${CONF_FIELD}th`}
        text={`${season.teams.length} programs across ${new Set(season.teams.map((t) => t.conference)).size} conferences. ${CONF_FIELD} from this table play the conference tournament, and the ${CONF_ADVANCE} who come through it go to a regional. Tap a program to read its page.`}
      />
    </main>
  );
}
