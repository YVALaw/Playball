// SigningDay.tsx
// Where the whole class went, and what they actually were.
//
// Three views, because a signing day report answers three different questions:
// how everyone finished nationally, what you actually got, and where every
// individual recruit ended up. The third is the one that makes recruiting feel
// like a competition rather than a slot machine — losing a player to a program
// you can name and click on is a rivalry, losing him into a void is a number
// going down.
//
// This is also the screen where the guessing stops. All winter the board showed
// bands and impressions; here the real overall and the real ceiling are printed
// next to the report you were working from. That contrast is the payoff for the
// whole system — a steal and a bust look identical while you are bidding, and
// only ever become visible here.

import { useMemo, useState } from 'react';
import { useDynasty, useUserTeam } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { withStaff } from '../../engine/economy.js';
import { FieldNote, Metric, MetricStrip, ModuleIntro, Segmented } from '../components/Kit.js';
import {
  PRIORITY_LABEL, PRIORITIES, byRank, reportedOverall, reportedPotential,
  type Prospect, type Priority,
} from '../../engine/recruiting.js';
import { highSchoolLine, potentialGrade, GRADE_LADDER } from '../../engine/scouting.js';
import { enrolling, takenByPros, walkOnClass, walkOnSeed } from '../../engine/progression.js';
import { overallOf } from '../../engine/ratings.js';
import { isTwoWay } from '../../engine/types.js';
import type { Pitcher, Player } from '../../engine/types.js';
import { Avatar } from '../Avatar.js';
import { FirstVisit } from '../Tutorial.js';
import { InFrame } from '../Overlay.js';

type View = 'rankings' | 'mine' | 'all';

/** Whichever man's card is open — a recruit you bid on, or one who just turned up. */
type Open = { kind: 'recruit'; id: string } | { kind: 'walkOn'; id: string } | null;

/**
 * Class strength, weighted so quality beats quantity.
 *
 * Stars squared: four two-star signings is not a better class than one five
 * star, and a straight count would say it was.
 */
const classPoints = (list: readonly Prospect[]): number =>
  list.reduce((a, p) => a + p.stars * p.stars, 0);

const slotOf = (p: Prospect): string =>
  isTwoWay(p.player) ? 'TWO-WAY'
    : p.player.type === 'pitcher' ? (p.player as Pitcher).role : p.player.pos;

const topPriority = (p: Prospect): Priority =>
  [...PRIORITIES].sort((a, b) => p.priorities[b] - p.priorities[a])[0] as Priority;

/**
 * How the truth landed against the report you were working from.
 *
 * The band always contained him — that is how it was built — so the question is
 * never whether you were wrong, it is *where inside your own report* he came
 * out. The top of the band is the steal and the bottom is the one you paid over
 * the odds for, and both are invisible until this screen.
 *
 * Deliberately silent in the middle. A verdict on every single signing turns
 * into wallpaper, and then the two that mattered do not stand out.
 */
function verdict(
  prospect: Prospect, recruitingSkill: number,
): { short: string; long: string; tone: string } | null {
  const truth = GRADE_LADDER.indexOf(potentialGrade(prospect.player.potential));
  const band = reportedPotential(prospect, recruitingSkill);
  if (band.low === band.high) return null;
  if (truth === GRADE_LADDER.indexOf(band.high)) {
    return { short: 'HIGH END', long: 'TOP OF YOUR REPORT', tone: 'var(--win)' };
  }
  if (truth === GRADE_LADDER.indexOf(band.low)) {
    return { short: 'LOW END', long: 'BOTTOM OF YOUR REPORT', tone: 'var(--clay)' };
  }
  return null;
}

export function SigningDay() {
  const season = useDynasty((s) => s.season);
  const userTeam = useDynasty((s) => s.userTeam);
  const coach = useDynasty((s) => s.coach);
  const next = useDynasty((s) => s.nextPhase);
  const team = useUserTeam();
  // The coach phase runs before recruiting, so this is the same skill the board
  // drew its bands with — the report shown here is the one you were reading.
  const economy = useDynasty((s) => s.economy);
  // The verdict re-reads the band the winter's reports were cut at, so it has
  // to include the coordinator who cut them.
  const recruitingSkill = withStaff(coach.skills, economy.staff).recruiting;

  const [view, setView] = useState<View>('mine');
  const [openId, setOpenId] = useState<Open>(null);

  const { rankings, mine, signed, myRank, walkOns } = useMemo(() => {
    const prospects = season?.recruiting.prospects ?? [];
    const byTeam = new Map<number, Prospect[]>();
    for (const p of prospects) {
      if (p.signedBy === null) continue;
      const list = byTeam.get(p.signedBy) ?? [];
      list.push(p);
      byTeam.set(p.signedBy, list);
    }

    /*
      Who turns up because the class did not cover it.

      The roster is standing here half empty — the draft step emptied it and
      nothing refills it until the year turns over — so the men who are on it
      plus the men just signed are exactly the two inputs the year roll will
      use. Read in board order rather than from `mine`, which is sorted for the
      screen: the engine takes the class in the order the board holds it, and a
      projection that disagreed on a tie would be a projection worth nothing.

      These are men, not a count of spots. They do not exist yet — nothing
      manufactures them until three taps from here — and they are still exactly
      the men who arrive, because `fillRosters` draws its walk-ons from this
      same call on this same seed. See `walkOnClass`.
    */
    const me = season?.teams[userTeam]?.team;
    const roster: Player[] = me
      ? [...me.lineup, ...me.bench, ...me.rotation, ...me.bullpen] : [];
    // Less the men the pros took in July: the walk-on projection has to see
    // the class the year roll will actually receive, or the men on this
    // screen and the men in June disagree — the one thing they must not do.
    const classPlayers = enrolling(
      prospects
        .filter((p) => p.signedBy === userTeam)
        .map((p) => p.player),
      season?.recruiting.year ?? 0,
    );

    const table = [...byTeam.entries()]
      .map(([t, list]) => ({ team: t, list, points: classPoints(list) }))
      .sort((a, b) => b.points - a.points);

    // Both lists read in national ranking order, which is the number printed
    // beside every name on this screen. Sorted on stars they came out in an
    // order nothing on the row explained — five players all showing ★★★★, the
    // 9th best in the country under the 140th — and the class review is the one
    // screen whose whole job is to say what you got.
    return {
      rankings: table,
      mine: (byTeam.get(userTeam) ?? []).slice().sort(byRank),
      signed: prospects.filter((p) => p.signedBy !== null).sort(byRank),
      myRank: table.findIndex((r) => r.team === userTeam) + 1,
      walkOns: me && season
        ? walkOnClass(
          roster, classPlayers, me.quality,
          walkOnSeed(season.recruiting.year, userTeam),
        )
        : [],
    };
  }, [season, userTeam]);

  if (!season || !team) return null;

  const openRecruit = openId?.kind === 'recruit'
    ? season.recruiting.prospects.find((p) => p.id === openId.id) ?? null
    : null;
  const openWalkOn = openId?.kind === 'walkOn'
    ? walkOns.find((p) => p.id === openId.id) ?? null
    : null;

  return (
    // The class totals and the three views hold still; the names scroll.
    <FixedHeader header={
      <div style={{ padding: '14px 14px 10px' }}>
      <ModuleIntro kicker="SIGNING DAY" title="The class" />

      <MetricStrip>
        <Metric label="SIGNED" value={String(mine.length)} note="YOUR CLASS" />
        <Metric label="CLASS POINTS" value={String(classPoints(mine))} note="NATIONAL" />
        <Metric label="NATIONALLY" value={myRank > 0 ? `#${myRank}` : '—'} note="OF 96" />
      </MetricStrip>

      <Segmented
        label="Signing day section"
        value={view}
        onChange={setView}
        options={[
          { value: 'mine' as const, label: 'Your class' },
          { value: 'rankings' as const, label: 'Rankings' },
          { value: 'all' as const, label: 'Top signings' },
        ]}
      />
      </div>
    }
      action={<FloatingAction label="START NEXT SEASON" onClick={() => void next('signing')} />}
    >
    <FirstVisit id="signing" />
    <div style={{ padding: '10px 14px 22px' }}>
      {view === 'mine' && (
        <>
          {/* The class as one number and one sentence, which is what a signing
              day is actually about. */}
          <section className="signing-class">
            <strong>{mine.length}</strong>
            <div>
              <small>THE CLASS · {classPoints(mine)} POINTS</small>
              <h2>{myRank > 0 ? `#${myRank} in the country` : 'Signed and sealed'}</h2>
              <p>
                {mine.length === 0
                  ? 'Nobody signed. Every hole gets a walk-on, and a walk-on is a long way below the men you were bidding on.'
                  : `${mine.filter((m) => m.stars >= 4).length} of them at four stars or better.`}
              </p>
            </div>
          </section>

          {mine.length === 0 ? (
            <section className="empty-state">
              <h2>An empty class</h2>
              <p>
                Every hole on the roster gets filled by a walk-on, and a walk-on
                is a long way below the players you were bidding on.
              </p>
            </section>
          ) : (
            <section className="prospect-list">
              {mine.map((p) => (
                <RecruitRow
                  key={p.id} p={p} onOpen={() => setOpenId({ kind: 'recruit', id: p.id })}
                  recruitingSkill={recruitingSkill}
                  poached={takenByPros(p.player, season?.recruiting.year ?? 0)}
                />
              ))}
            </section>
          )}
        </>
      )}

      {/*
        The men you did not sign, kept apart from the men you did.

        Deliberately not rows in the class list above, and deliberately not
        sorted in among them. A walk-on is what a program gets because it
        missed; folding him into the class would let a coach who covered four
        holes out of nine read a nine man class off this screen, which is the
        opposite of what it is for.

        Reported from testing: "they arrive as names on a list with none of the
        information every other player has." They were positions and counts,
        because the men were not manufactured until the year rolled and there
        was nothing honest to print. They are drawn on their own seed now — see
        `walkOnClass` — so the face and the rating on this card belong to the
        man who reports in June, and the only thing separating him from the
        class above is that nobody went and got him.
      */}
      {view === 'mine' && (
        <WalkOnGroup
          men={walkOns}
          abbr={team.def.abbr}
          onOpen={(id) => setOpenId({ kind: 'walkOn', id })}
        />
      )}

      {view === 'rankings' && (
        <div style={{
          marginTop: 10, border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          {rankings.slice(0, 25).map((row, i) => {
            const t = season.teams[row.team];
            const isMine = row.team === userTeam;
            return (
              <div key={row.team} style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
                gap: 10, alignItems: 'baseline',
                padding: '9px 11px', borderBottom: '1px solid var(--hairline)',
                background: isMine ? 'rgba(var(--clay-rgb), .10)' : 'transparent',
              }}>
                <span style={{
                  font: "600 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)',
                  minWidth: 20, textAlign: 'right',
                }}>{i + 1}</span>
                <span style={{
                  font: `${isMine ? 700 : 400} calc(12.5px * var(--ts)) var(--body)`,
                  color: isMine ? 'var(--clay)' : 'var(--ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{t?.def.school ?? '?'}</span>
                <span style={{ font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                  {row.list.length} signed
                </span>
                <span style={{ font: "600 calc(12px * var(--ts)) var(--mono)" }}>{row.points}</span>
              </div>
            );
          })}
          {myRank > 25 && (
            <div style={{
              padding: '9px 11px', background: 'rgba(var(--clay-rgb), .10)',
              font: "600 calc(12px * var(--ts)) var(--mono)", color: 'var(--clay)',
            }}>#{myRank} &nbsp; {team.def.school}</div>
          )}
        </div>
      )}

      {view === 'all' && (
        <div style={{
          marginTop: 10, border: '1px solid var(--faint)', background: 'var(--paper)',
        }}>
          {signed.slice(0, 60).map((p) => (
            <RecruitRow
              key={p.id}
              p={p}
              onOpen={() => setOpenId({ kind: 'recruit', id: p.id })}
              recruitingSkill={recruitingSkill}
              destination={season.teams[p.signedBy as number]?.def.abbr}
              mine={p.signedBy === userTeam}
            />
          ))}
        </div>
      )}

      {openRecruit && (
        <RecruitSheet
          prospect={openRecruit}
          userTeam={userTeam}
          recruitingSkill={recruitingSkill}
          onClose={() => setOpenId(null)}
        />
      )}

      {openWalkOn && (
        <WalkOnSheet
          man={openWalkOn}
          school={team.def.school}
          abbr={team.def.abbr}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
    </FixedHeader>
  );
}

const slotFor = (p: Player): string =>
  p.type === 'pitcher' ? (p as Pitcher).role : p.pos;

/**
 * The men who turn up, as a block of its own under the class.
 *
 * Muted rather than clay: every accent on this screen means "yours", and a
 * walk-on is the opposite of that — he is what the program gets because nobody
 * went and got anybody. Same row as a signing, same face, same numbers, one
 * grade of colour quieter and under a heading that says what he is. A class
 * that covered everything says so in one line, because the good outcome is
 * worth printing and a group that only ever appears when you failed teaches the
 * player to dread the heading.
 */
function WalkOnGroup(
  { men, abbr, onOpen }:
  { men: readonly Player[]; abbr: string; onOpen: (id: string) => void },
) {
  if (men.length === 0) {
    return (
      <FieldNote
        title="Every hole is covered"
        text="Nobody walks on this year. The whole roster is men you went and got."
      />
    );
  }

  return (
    <>
      <div className="flow-section-title" style={{ marginTop: 16 }}>
        <span className="label">WALK-ONS REPORTING</span>
        <b>{men.length}</b>
      </div>
      <section className="retention-list">
        {men.map((p) => (
          <button className="tap" type="button" key={p.id} onClick={() => onOpen(p.id)}>
            <span className="portrait"><Avatar id={p.id} team={abbr} size={34} /></span>
            <span>
              <strong>{p.name}</strong>
              <small>{slotFor(p)} · age {p.age} · {overallOf(p)} OVR · {potentialGrade(p.potential)} POT</small>
            </span>
            <b style={{ color: 'var(--dim)' }}>WALK-ON</b>
            <ChevronRightIcon />
          </button>
        ))}
      </section>
    </>
  );
}

function RecruitRow({
  p, onOpen, recruitingSkill, destination, mine, poached,
}: {
  p: Prospect; onOpen: () => void; recruitingSkill: number;
  destination?: string; mine?: boolean; poached?: boolean;
}) {
  const call = verdict(p, recruitingSkill);
  return (
    <div className={`recruit-row${mine ? ' mine' : ''}`}>
      <button className="tap" type="button" onClick={onOpen}>
        <span className="recruit-face">
          <Avatar id={p.id} team={destination} size={34} />
          <span>
            <strong>{p.player.name}</strong>
            <small>
              #{p.rank} · {slotOf(p)} · {p.state}
              {destination ? ` · → ${destination}` : ''}
              {p.committedWeek !== null ? ` · wk ${p.committedWeek}` : ''}
              {poached ? ' · DRAFTED BY THE PROS — never arrives' : ''}
            </small>
          </span>
        </span>
        {/*
          The truth, both halves of it. The board printed a band here all
          winter and a class review that printed the same band would have
          nothing to review — the whole point of this row is that the guessing
          is over.
        */}
        <span className="recruit-state">
          {overallOf(p.player)} · {potentialGrade(p.player.potential)}
          {call && <em style={{ color: call.tone }}>{call.short}</em>}
        </span>
        <b>{'★'.repeat(p.stars)}</b>
      </button>
    </div>
  );
}

function RecruitSheet({
  prospect, userTeam, recruitingSkill, onClose,
}: {
  prospect: Prospect; userTeam: number; recruitingSkill: number; onClose: () => void;
}) {
  const season = useDynasty((s) => s.season);
  const p = prospect.player;
  const to = season?.teams[prospect.signedBy as number];
  const mine = prospect.signedBy === userTeam;

  const chased = Object.entries(prospect.points)
    .map(([t, pts]) => ({ team: Number(t), pts }))
    .filter((r) => r.pts > 0)
    .sort((a, b) => b.pts - a.pts);

  const band = reportedOverall(prospect, recruitingSkill);
  const ceiling = reportedPotential(prospect, recruitingSkill);
  const call = verdict(prospect, recruitingSkill);

  return (
    <InFrame>
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(var(--scrim-rgb), .6)',
        display: 'flex', alignItems: 'flex-end', zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          // Fixed, for the same reason the recruiting sheet is: a panel that
          // resizes to its contents jumps under the thumb.
          width: '100%', height: '72%',
          display: 'flex', flexDirection: 'column',
          background: 'var(--paper)', borderTop: '3px solid var(--clay)',
        }}
      >
        <div style={{
          flex: 'none', padding: '7px 12px', background: 'var(--clay)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
          }}>{'★'.repeat(prospect.stars)} · {prospect.state}</span>
          <button onClick={onClose} style={{
            font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'rgba(var(--cream-rgb), .8)',
          }}>CLOSE</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '13px 12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar id={p.id} team={to?.def.abbr} size={54} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "800 calc(22px * var(--ts))/1 var(--display)", textTransform: 'uppercase' }}>
                {p.name}
              </div>
              <div style={{ marginTop: 3, font: "400 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                {/* Age, because a class is not all one age. A freshman who
                    arrives at twenty is draft eligible after one season, and
                    the day you sign him is the day to know it. */}
                {slotOf(prospect)} &middot; age {p.age} &middot; bats {p.bats}
                {' '}&middot; throws {p.throws}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 12, padding: '11px 12px',
            background: mine ? 'rgba(var(--clay-rgb), .10)' : 'var(--field)',
            borderLeft: `3px solid ${mine ? 'var(--clay)' : 'var(--faint)'}`,
          }}>
            <div className="label">SIGNED WITH</div>
            <div style={{
              font: "700 calc(17px * var(--ts))/1.1 var(--display)", marginTop: 3, textTransform: 'uppercase',
              color: mine ? 'var(--clay)' : 'var(--ink)',
            }}>{to?.def.school ?? 'nobody'}{mine ? ' · you' : ''}</div>
            {prospect.committedWeek !== null && (
              <div style={{
                marginTop: 3, font: "400 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)',
              }}>committed in week {prospect.committedWeek}</div>
            )}
          </div>

          <MetricStrip>
            <Metric label="OVERALL" value={String(overallOf(p))} note="TODAY" />
            <Metric label="CEILING" value={potentialGrade(p.potential)} note="POTENTIAL" />
            <Metric label="WANTED" value={PRIORITY_LABEL[topPriority(prospect)]} note="HIS PRIORITY" />
          </MetricStrip>

          {/*
            What you had him at, printed under what he is.

            The band always contained him, so this is never a gotcha about being
            wrong — it is the width of your own ignorance, made visible at the
            one moment it can be checked. A coach who keeps signing players who
            come out at the bottom of his reports is being read by the rest of
            the country, and a coach whose reports are eight points wide can see
            what the coach points bought him.
          */}
          <div style={{
            marginTop: 10, padding: '9px 11px', background: 'var(--field)',
            borderLeft: `3px solid ${call ? call.tone : 'var(--faint)'}`,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <span className="label">YOUR REPORT HAD HIM</span>
              {call && (
                <span style={{
                  font: "700 calc(8px * var(--ts)) var(--mono)", letterSpacing: '.1em', color: call.tone,
                }}>{call.long}</span>
              )}
            </div>
            <div style={{
              marginTop: 4, font: "600 calc(12.5px * var(--ts)) var(--mono)", color: 'var(--ink)',
            }}>
              {band.low}&ndash;{band.high}
              <span style={{ color: 'var(--dim)' }}> overall &middot; </span>
              {ceiling.low} &ndash; {ceiling.high}
              <span style={{ color: 'var(--dim)' }}> ceiling</span>
            </div>
          </div>

          <div className="flow-section-title" style={{ marginTop: 14 }}>
            <span className="label">LAST SPRING</span>
            <b>HIGH SCHOOL</b>
          </div>
          <section className="prospect-stats">
            {highSchoolLine(p).map((row) => (
              <div key={row.label}>
                <small>{row.label}</small>
                <strong>{row.value}</strong>
              </div>
            ))}
          </section>

          {chased.length > 1 && (
            <>
              <div className="label" style={{ marginTop: 14, marginBottom: 5 }}>
                WHO WAS IN ON HIM
              </div>
              {chased.map((r) => {
                const t = season?.teams[r.team];
                const isMine = r.team === userTeam;
                const won = r.team === prospect.signedBy;
                return (
                  <div key={r.team} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '5px 0', borderBottom: '1px solid var(--hairline)',
                    font: `${isMine ? 700 : 400} calc(12px * var(--ts)) var(--body)`,
                    color: won ? 'var(--win)' : isMine ? 'var(--clay)' : 'var(--dim)',
                  }}>
                    <span>{t?.def.school ?? '?'}{isMine ? ' (you)' : ''}</span>
                    <span style={{ font: "600 calc(10px * var(--ts)) var(--mono)" }}>
                      {Math.round(r.pts)}{won ? ' · SIGNED' : ''}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
    </InFrame>
  );
}

/**
 * A walk-on's card, which is a recruit's card with the recruiting taken out.
 *
 * Everything a signed man gets — the face, the real overall, the real ceiling,
 * last spring's line — because he is a player on your roster and a player on
 * your roster is knowable. What is missing is missing for a reason: there is no
 * "your report had him" block, because you never had him at anything, and no
 * list of who else was in on him, because nobody was. That absence is the whole
 * difference between this card and the one next to it, and it says more about
 * what a walk-on is than a label would.
 */
function WalkOnSheet(
  { man, school, abbr, onClose }:
  { man: Player; school: string; abbr: string; onClose: () => void },
) {
  return (
    <InFrame>
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(var(--scrim-rgb), .6)',
        display: 'flex', alignItems: 'flex-end', zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', height: '72%',
          display: 'flex', flexDirection: 'column',
          background: 'var(--paper)', borderTop: '3px solid var(--dim)',
        }}
      >
        <div style={{
          flex: 'none', padding: '7px 12px', background: 'var(--band)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em', color: 'var(--cream)',
          }}>WALK-ON &middot; ONE YEAR</span>
          <button onClick={onClose} style={{
            font: "600 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.14em', color: 'rgba(var(--cream-rgb), .8)',
          }}>CLOSE</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '13px 12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar id={man.id} team={abbr} size={54} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "800 calc(22px * var(--ts))/1 var(--display)", textTransform: 'uppercase' }}>
                {man.name}
              </div>
              <div style={{ marginTop: 3, font: "400 calc(11px * var(--ts)) var(--mono)", color: 'var(--dim)' }}>
                {slotFor(man)} &middot; age {man.age} &middot; bats {man.bats}
                {' '}&middot; throws {man.throws}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 12, padding: '11px 12px', background: 'var(--field)',
            borderLeft: '3px solid var(--dim)',
          }}>
            <div className="label">TURNED UP AT</div>
            <div style={{
              font: "700 calc(17px * var(--ts))/1.1 var(--display)", marginTop: 3, textTransform: 'uppercase',
            }}>{school}</div>
            <div style={{
              marginTop: 5, font: "400 calc(11px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
            }}>
              Nobody offered him anything and nobody had to. He fills a spot your
              class left open, and he is off the roster again next June whatever
              he does with it.
            </div>
          </div>

          <MetricStrip>
            <Metric label="OVERALL" value={String(overallOf(man))} note="TODAY" />
            <Metric label="CEILING" value={potentialGrade(man.potential)} note="POTENTIAL" />
            <Metric label="CLASS" value={man.classYear} note="YEAR" />
          </MetricStrip>

          <div className="flow-section-title" style={{ marginTop: 14 }}>
            <span className="label">LAST SPRING</span>
            <b>HIGH SCHOOL</b>
          </div>
          <section className="prospect-stats">
            {highSchoolLine(man).map((row) => (
              <div key={row.label}>
                <small>{row.label}</small>
                <strong>{row.value}</strong>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
    </InFrame>
  );
}


