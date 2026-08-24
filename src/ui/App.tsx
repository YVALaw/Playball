// App.tsx
// The chrome: top bar, sub-nav, screen, bottom nav. Ported from
// design/Dynasty Mobile.dc.html, which is the design of record.

import { useEffect, useRef, useState } from 'react';
import {
  PHASES, PHASE_LABEL, TABS, useDynasty, useUserTeam, type Tab,
} from '../state/store.js';
import { StepRail } from './StepRail.js';
import { Today } from './screens/Today.js';
import { Standings } from './screens/Standings.js';
import { Roster } from './screens/Roster.js';
import { Schedule } from './screens/Schedule.js';
import { Stats } from './screens/Stats.js';
import { Lineup } from './screens/Lineup.js';
import { Awards } from './screens/Awards.js';
import { Manage } from './screens/Manage.js';
import { History } from './screens/History.js';
import { Player } from './screens/Player.js';
import { Program } from './screens/Program.js';
import { NewGame } from './screens/NewGame.js';
import { StrategyScreen } from './screens/StrategyScreen.js';
import { Placeholder } from './screens/Placeholder.js';
import { Board } from './screens/Board.js';
import { SeasonReview } from './screens/SeasonReview.js';
import { CoachPoints } from './screens/CoachPoints.js';
import { SigningDay } from './screens/SigningDay.js';
import { Postseason } from './screens/Postseason.js';
import { Rankings } from './screens/Rankings.js';
import { JobSearch } from './screens/JobSearch.js';
import { Draft } from './screens/Draft.js';
import { Wire } from './screens/Wire.js';

export function App() {
  const start = useDynasty((s) => s.start);
  const season = useDynasty((s) => s.season);
  const tab = useDynasty((s) => s.tab);
  const screen = useDynasty((s) => s.screen);
  const go = useDynasty((s) => s.go);
  const setScreen = useDynasty((s) => s.setScreen);
  const team = useUserTeam();

  const needsTeam = useDynasty((s) => s.needsTeam);
  const phase = useDynasty((s) => s.phase);
  const bracket = useDynasty((s) => s.bracket);
  const live = useDynasty((s) => s.live);
  const selectedPlayer = useDynasty((s) => s.selectedPlayer);
  const overlay = useDynasty((s) => s.overlay);
  const furthestPhase = useDynasty((s) => s.furthestPhase);
  const goPhase = useDynasty((s) => s.goPhase);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const jobSearch = useDynasty((s) => s.jobSearch);
  const loadSlot = useDynasty((s) => s.loadSlot);
  const loadError = useDynasty((s) => s.loadError);
  const [checked, setChecked] = useState(false);

  /**
   * The loading screen is not allowed to be the last thing that happens.
   *
   * Reported twice, the second time browser-specific: "still stuck at building
   * the league in Chrome, Safari works". Opening IndexedDB has failure modes
   * that never resolve and never reject — a blocked upgrade, restricted site
   * data — so no `catch` can reach them. Whatever the cause, after eight
   * seconds the screen stops claiming to be loading and offers a way past.
   */
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (checked) return undefined;
    const t = setTimeout(() => setStalled(true), 8000);
    return () => clearTimeout(t);
  }, [checked]);

  /**
   * A new screen starts at the top.
   *
   * The same <main> element is reused across the offseason steps, so it keeps
   * whatever scroll position the previous step left behind — which is how
   * pressing CONTINUE at the bottom of the season review opened recruiting
   * already scrolled past its own header.
   */
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [phase, tab, screen, bracket?.stage, live !== null, selectedPlayer !== null]);


  useEffect(() => {
    if (season || checked) return;
    // Resume where the player left off. With nothing to come back to, ask which
    // job to take rather than assigning one — that choice is the first real
    // decision the game makes you make.
    // Always finish, however it goes. Without the catch a rejected load leaves
    // `checked` false and the app on its loading screen permanently.
    void loadSlot()
      .catch(() => false)
      .finally(() => setChecked(true));
  }, [season, checked, loadSlot]);

  if (!season && needsTeam && checked) {
    return (
      <div className="app-frame" style={{
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <main ref={mainRef} key={phase ?? screen} className="screen-in" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
        }}>
          {loadError && (
            <div style={{
              margin: '12px 14px 0', padding: '11px 12px',
              background: 'var(--paper)', borderLeft: '3px solid var(--clay)',
              font: "400 12px/1.55 var(--body)",
            }}>
              <strong>Your saved dynasty could not be opened.</strong> It was
              written by a different version of the game. Starting a new one is
              the only way forward from here.
              <div style={{
                marginTop: 6, font: "400 10px var(--mono)", color: 'var(--dim)',
              }}>{loadError}</div>
            </div>
          )}
          <NewGame />
        </main>
      </div>
    );
  }

  // No job, no team screen. Everything else waits until you take one.
  if (season && jobSearch) {
    return (
      <div className="app-frame" style={{
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <main ref={mainRef} key={phase ?? screen} className="screen-in" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
        }}>
          <JobSearch />
        </main>
      </div>
    );
  }

  if (!season || !team) {
    /*
      Two different states wear the same face, and only one of them is loading.

      A save that opens but points at a team the world does not contain leaves
      `season` set and `team` undefined, and this screen then sat there for
      ever with nothing behind it. It is a broken save, not a slow one, and the
      way out is a new dynasty rather than more waiting.
    */
    if (checked && season) {
      return (
        <div className="app-frame" style={{
          display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center',
        }}>
          <div>
            <div style={{
              font: "800 24px/1 var(--display)", textTransform: 'uppercase',
            }}>Save is unreadable</div>
            <div style={{
              marginTop: 10, font: "400 12.5px/1.6 var(--body)", color: 'var(--dim)',
            }}>
              The dynasty on this device points at a program that is not in the
              world any more. Start a new one to carry on.
            </div>
            <button
              onClick={() => useDynasty.setState({ season: null, needsTeam: true })}
              className="tap"
              style={{
                marginTop: 16, padding: '13px 22px',
                background: 'var(--clay)', border: '1px solid var(--clay)',
                color: 'var(--cream)', font: "700 11px var(--mono)", letterSpacing: '.14em',
              }}
            >NEW DYNASTY</button>
          </div>
        </div>
      );
    }
    if (stalled) {
      return (
        <div className="app-frame" style={{
          display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center',
        }}>
          <div>
            <div style={{
              font: "800 24px/1 var(--display)", textTransform: 'uppercase',
            }}>Cannot reach your saves</div>
            <div style={{
              marginTop: 10, font: "400 12.5px/1.6 var(--body)", color: 'var(--dim)',
            }}>
              This browser is not letting the game open its local storage. That
              usually means another tab has the game open, or site data is
              blocked for this address.
            </div>
            <div style={{
              marginTop: 8, font: "400 12.5px/1.6 var(--body)", color: 'var(--dim)',
            }}>
              You can play anyway — nothing will be saved between sessions.
            </div>
            <button
              onClick={() => {
                useDynasty.setState({ needsTeam: true });
                setChecked(true);
              }}
              className="tap"
              style={{
                marginTop: 16, padding: '13px 22px',
                background: 'var(--clay)', border: '1px solid var(--clay)',
                color: 'var(--cream)', font: "700 11px var(--mono)", letterSpacing: '.14em',
              }}
            >PLAY WITHOUT SAVING</button>
          </div>
        </div>
      );
    }

    return (
      <div className="app-frame" style={{
        display: 'grid', placeItems: 'center',
        font: "700 20px var(--display)", letterSpacing: '.08em',
      }}>
        BUILDING THE LEAGUE…
      </div>
    );
  }

  // The offseason takes the whole screen.
  //
  // It is a sequence with an order, not a place to browse: recruiting means
  // something because it happens once, on a deadline, and letting the player
  // wander off to the standings mid-window would make the clock decorative.
  // The nav comes back when the year does.
  // The postseason takes the whole screen for the same reason the offseason does:
  // it is a sequence with an order, and it is the part of the year the season was
  // played for.
  if (bracket !== null) {
    return (
      <div className="app-frame" style={{
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <main ref={mainRef} key={phase ?? screen} className="screen-in" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
        }}>
          {/* A bracket game you took yourself is managed on the same screen a
              regular season game is, so nothing about June feels like a
              different game than the one you played in April. */}
          {live ? <Manage /> : <Postseason />}
        </main>
        {overlay !== null && <TableOverlay />}
        {selectedPlayer !== null && <PlayerOverlay />}
      </div>
    );
  }

  if (phase !== null) {
    return (
      <div className="app-frame" style={{
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <header style={{
          flex: 'none', height: 56, padding: '0 14px',
          paddingTop: 'env(safe-area-inset-top)',
          boxSizing: 'content-box',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--navy)',
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,.09) 0 1px, transparent 1px 7px)',
          borderBottom: '3px solid var(--clay)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              font: "800 21px/0.95 var(--display)", letterSpacing: '.02em',
              color: 'var(--cream)', textTransform: 'uppercase',
            }}>{team.def.school}</div>
            <div style={{
              font: "500 9px/1.4 var(--mono)", letterSpacing: '.18em',
              color: 'var(--cream-dim)', textTransform: 'uppercase',
            }}>OFFSEASON</div>
          </div>
          {/*
            What the year came to, in the corner of every offseason screen.
            The season's own header carries the record here; once the season is
            over the record is history and the title is the headline.
          */}
          {(() => {
            const badge = seasonBadge(lastPostseason, team);
            if (!badge) return null;
            return (
              <div style={{ flex: 'none', textAlign: 'right', maxWidth: 150 }}>
                <div style={{
                  font: "800 18px/0.9 var(--display)", color: 'var(--cream)',
                  textTransform: 'uppercase',
                }}>{badge.big}</div>
                <div style={{
                  font: "400 8px/1.4 var(--mono)", letterSpacing: '.1em',
                  color: 'rgba(246,241,230,.55)', textTransform: 'uppercase',
                }}>{badge.small}</div>
              </div>
            );
          })()}
        </header>
        <StepRail
          steps={PHASES.map((p) => ({ key: p, label: PHASE_LABEL[p] }))}
          at={PHASES.indexOf(phase)}
          furthest={furthestPhase}
          onGo={(k) => goPhase(k as Exclude<typeof phase, null>)}
        />
        <main ref={mainRef} key={phase ?? screen} className="screen-in" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
        }}>
          {phase === 'awards' && <Awards />}
          {phase === 'review' && <SeasonReview />}
          {phase === 'coach' && <CoachPoints />}
          {phase === 'recruiting' && <Board />}
          {phase === 'signing' && <SigningDay />}
          {phase === 'draft' && <Draft />}
        </main>
        {overlay !== null && <TableOverlay />}
        {selectedPlayer !== null && <PlayerOverlay />}
      </div>
    );
  }

  const tabDef = TABS.find((t) => t.id === tab) ?? TABS[0]!;

  return (
    <div className="app-frame" style={{ color: 'var(--ink)' }}>
      {/* Top bar. The pinstripe is a uniform, and the clay rule under it is the
          same one that separates every section in the app. */}
      <header style={{
        flex: 'none', height: 58, padding: '0 14px',
        paddingTop: 'env(safe-area-inset-top)',
        boxSizing: 'content-box',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--navy)',
        backgroundImage:
          'repeating-linear-gradient(90deg, rgba(255,255,255,.09) 0 1px, transparent 1px 7px)',
        borderBottom: '3px solid var(--clay)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            font: "800 21px/0.95 var(--display)", letterSpacing: '.02em',
            color: 'var(--cream)', textTransform: 'uppercase',
          }}>{team.def.school}</div>
          <div style={{
            font: "500 9px/1.4 var(--mono)", letterSpacing: '.18em',
            color: 'var(--cream-dim)', textTransform: 'uppercase',
          }}>{team.def.nickname} &middot; {team.conference}</div>
        </div>
        <div style={{ flex: 'none', textAlign: 'right' }}>
          <div style={{ font: "800 22px/0.9 var(--display)", color: 'var(--cream)' }}>
            {team.w}-{team.l}
          </div>
          <div style={{
            font: "400 8.5px/1.4 var(--mono)", letterSpacing: '.12em',
            color: 'rgba(246,241,230,.55)',
          }}>{team.cw}-{team.cl} {team.conference}</div>
        </div>
      </header>

      {/* Sub-nav */}
      <nav style={{
        flex: 'none', height: 38, display: 'flex',
        background: '#e7dfd0', borderBottom: '1px solid rgba(28,36,48,.16)',
      }}>
        {tabDef.screens.map((s) => {
          const on = screen === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setScreen(s.id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on ? 'var(--field)' : 'transparent',
                borderRight: '1px solid rgba(28,36,48,.1)',
                boxShadow: on ? 'inset 0 -3px 0 var(--clay)' : 'none',
                font: "600 10px var(--mono)", letterSpacing: '.14em',
                color: on ? 'var(--clay)' : 'var(--dim)',
              }}
            >{s.label}</button>
          );
        })}
      </nav>

      <main ref={mainRef} style={{
        flex: 1, minHeight: 0, overflow: 'auto', position: 'relative',
        WebkitOverflowScrolling: 'touch', background: 'var(--field)',
      }}>
        <Screen id={screen} />
        <div style={{ height: 10 }} />
      </main>

      {/* Bottom nav */}
      <nav style={{
        flex: 'none', display: 'flex',
        background: 'var(--ink)', borderTop: '3px solid var(--clay)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => go(t.id as Tab)}
              style={{
                flex: 1, padding: '9px 0 11px', textAlign: 'center',
                background: on ? 'rgba(168,68,42,.85)' : 'transparent',
              }}
            >
              <div style={{
                font: "700 12px/1 var(--display)", letterSpacing: '.12em',
                color: on ? 'var(--cream)' : 'rgba(246,241,230,.5)',
              }}>{t.label}</div>
            </button>
          );
        })}
      </nav>
      {overlay !== null && <TableOverlay />}
      {selectedPlayer !== null && <PlayerOverlay />}
    </div>
  );
}

/**
 * A table over the top of anything: schedule, conference, country.
 *
 * Same shape as the player card and for the same reason — the screen
 * underneath, which during the offseason is a step in a sequence, must still be
 * there when you close it.
 */
function TableOverlay() {
  const overlay = useDynasty((s) => s.overlay);
  const close = useDynasty((s) => s.closeOverlay);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 25,
      background: 'var(--field)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flex: 'none', padding: '10px 14px',
        paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
        background: 'var(--navy)', borderBottom: '3px solid var(--clay)',
      }}>
        <button
          onClick={close}
          style={{
            padding: '11px 18px', background: 'rgba(246,241,230,.14)',
            border: '1px solid rgba(246,241,230,.32)',
            color: 'var(--cream)', font: "700 12px var(--mono)", letterSpacing: '.14em',
          }}
        >← BACK</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        {overlay === 'schedule' && <Schedule />}
        {overlay === 'standings' && <Standings />}
        {overlay === 'rankings' && <Rankings />}
      </div>
    </div>
  );
}

/**
 * What the season came to, in three words.
 *
 * Null when there is nothing to say, because a banner reading "MISSED THE
 * TOURNAMENT" every June is a banner nobody reads. Silence is the honest
 * treatment of a year that did not go anywhere.
 */
function seasonBadge(
  post: { champion: number; finish: Record<number, string> } | null,
  team: { index: number; conference: string },
): { big: string; small: string } | null {
  if (!post) return null;
  const finish = post.finish[team.index];
  if (post.champion === team.index) {
    return { big: 'CHAMPS', small: 'National title' };
  }
  if (finish === 'runner-up') return { big: 'RUNNERS UP', small: 'Omaha final' };
  if (finish === 'omaha') return { big: 'OMAHA', small: 'College World Series' };
  if (finish === 'regional') return { big: 'REGIONAL', small: 'National tournament' };
  return null;
}

/**
 * The player card, over whatever is underneath it.
 *
 * An overlay rather than a route, and that is the fix for a whole class of
 * complaint at once: navigating to a card unmounted the screen you came from, so
 * the roster forgot you were on the pitchers tab, a long list forgot where you
 * had scrolled, and "back" dropped you at the top of something else. Nothing
 * underneath unmounts now, so closing the card puts you exactly where you were.
 *
 * The bar that used to carry the back button lived here rather than in the card,
 * so it could not scroll away. The card now pins its own header instead and puts
 * the chevron in it, which is one control rather than two stacked ones — so all
 * this has to provide is a positioned box of a known size for that header to
 * anchor to.
 */
function PlayerOverlay() {
  const selectedPlayer = useDynasty((s) => s.selectedPlayer);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: 'var(--field)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/*
        Keyed on the man, so opening a second card is a fresh card.
        The scroll reset above resets the screen *underneath* the overlay, which
        it must — but it leaves the card itself on whatever tab and scroll
        position the last player was read at. Tapping a name in a box score and
        landing halfway down someone else's game log is the same bug the reset
        exists to prevent, one layer up.
      */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Player key={selectedPlayer ?? ''} />
      </div>
    </div>
  );
}

function Screen({ id }: { id: string }) {
  switch (id) {
    case 'today': return <Today />;
    case 'stand': return <Standings />;
    case 'roster': return <Roster />;
    case 'sched': return <Schedule />;
    case 'stats': return <Stats />;
    case 'lineup': return <Lineup />;
    case 'rankings': return <Rankings />;
    case 'box': return <Manage />;
    case 'history': return <History />;
    case 'records': return <Program />;
    case 'strategy': return <StrategyScreen />;
    case 'board': return <Board />;
    case 'draft': return <Draft />;
    case 'wire': return <Wire />;
    default: return <Placeholder id={id} />;
  }
}
