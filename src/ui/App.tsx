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
import { Saves } from './screens/Saves.js';
import { OpenTeam, TeamCard } from './screens/TeamCard.js';

/**
 * The app, and the one piece of navigation state that is not in the store.
 *
 * A rival's page is opened from the conference table and the national rankings,
 * both of which render in two places apiece, so the way in is a context rather
 * than a callback threaded through four call sites. It lives here rather than
 * beside `selectedPlayer` in the store because the store is not this screen's to
 * change; the trade is that the card cannot be deep-linked or saved, which is
 * exactly as much as a card you opened to check somebody's record deserves.
 */
export function App() {
  const [teamCard, setTeamCard] = useState<number | null>(null);
  return (
    <OpenTeam.Provider value={setTeamCard}>
      <AppBody teamCard={teamCard} setTeamCard={setTeamCard} />
    </OpenTeam.Provider>
  );
}

function AppBody(
  { teamCard, setTeamCard }:
  { teamCard: number | null; setTeamCard: (index: number | null) => void },
) {
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
  const furthestPhase = useDynasty((s) => s.furthestPhase);
  const goPhase = useDynasty((s) => s.goPhase);
  const lastPostseason = useDynasty((s) => s.lastPostseason);
  const jobSearch = useDynasty((s) => s.jobSearch);
  const loadSlot = useDynasty((s) => s.loadSlot);
  const loadError = useDynasty((s) => s.loadError);
  const newDynasty = useDynasty((s) => s.newDynasty);
  const openOverlay = useDynasty((s) => s.openOverlay);
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

  /**
   * Going somewhere closes the rival's page, exactly as `go()` clears the
   * selected player. An overlay that survives a tab change is a screen you did
   * not ask for sitting over the one you did.
   */
  useEffect(() => { setTeamCard(null); }, [phase, tab, screen, setTeamCard]);


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
              written by a different version of the game. Start a new one to get
              in — then look under PROGRAM · SAVES, where every other dynasty on
              this device is still listed, and this one will open again in the
              build that wrote it.
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
        <SaveAlert topmost />
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
              onClick={newDynasty}
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
        <SaveAlert topmost />
        <main ref={mainRef} key={phase ?? screen} className="screen-in" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
        }}>
          {/* A bracket game you took yourself is managed on the same screen a
              regular season game is, so nothing about June feels like a
              different game than the one you played in April. */}
          {live ? <Manage /> : <Postseason />}
        </main>
        <Overlays teamCard={teamCard} onCloseTeam={() => setTeamCard(null)} />
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
            The way to the saves menu for the whole of the offseason.

            The bottom nav is gone from here by design — the offseason is a
            sequence, not a place to browse — and it takes PROGRAM · SAVES with
            it, for the six steps that contain most of what somebody would want
            a copy of the dynasty before doing. Recruiting above all: three weeks
            of decisions you cannot take back.

            Deliberately not offered during the postseason, which is the other
            frame with no nav. Saving mid-bracket is restricted to stage
            boundaries on purpose (see `endManagedGame`), so a button promising a
            copy of a half-played tournament would be promising something the
            store does not actually support.
          */}
          <button
            onClick={() => openOverlay('saves')}
            className="tap"
            style={{
              flex: 'none', padding: '8px 9px',
              background: 'rgba(246,241,230,.12)',
              border: '1px solid rgba(246,241,230,.28)',
              color: 'var(--cream)',
              font: "700 8.5px var(--mono)", letterSpacing: '.12em',
            }}
          >SAVES</button>
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
        <SaveAlert />
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
        <Overlays teamCard={teamCard} onCloseTeam={() => setTeamCard(null)} />
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

      <SaveAlert />

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
      <Overlays teamCard={teamCard} onCloseTeam={() => setTeamCard(null)} />
    </div>
  );
}

/**
 * A save that did not go through, said out loud, on every frame the game has.
 *
 * `saveState` has been in the store since saving existed and nothing has ever
 * rendered it, so a write that failed — storage refused, a second tab holding
 * the database, a quota — was completely silent. The player carried on for an
 * hour and lost the hour. The persistence file's own comment calls that the
 * worst outcome available to this app, and a strip of clay across the top is a
 * small price for never doing it.
 *
 * A row of the frame rather than something floating over it: it must not cover
 * the nav, and it must not be dismissable, because the condition it reports does
 * not go away when you stop looking at it. Tapping retries, which is worth
 * offering — a failed open is not cached, so a blocking tab that has since been
 * closed will simply work on the next attempt.
 */
function SaveAlert({ topmost }: { topmost?: boolean }) {
  const saveState = useDynasty((s) => s.saveState);
  const lastSaveError = useDynasty((s) => s.lastSaveError);
  const saveNow = useDynasty((s) => s.saveNow);
  if (saveState !== 'error') return null;
  return (
    <button
      onClick={() => { void saveNow(); }}
      className="tap"
      style={{
        flex: 'none', width: '100%', textAlign: 'left',
        padding: '7px 14px 8px',
        paddingTop: topmost ? 'calc(env(safe-area-inset-top) + 7px)' : 7,
        background: 'var(--clay)', color: 'var(--cream)',
      }}
    >
      <div style={{ font: "700 9px var(--mono)", letterSpacing: '.16em' }}>
        NOT SAVED · TAP TO TRY AGAIN
      </div>
      <div style={{
        marginTop: 2, font: "400 10px/1.35 var(--body)",
        color: 'rgba(246,241,230,.82)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {lastSaveError ?? 'The last write to this device did not complete.'}
      </div>
    </button>
  );
}

/**
 * The three things that can cover a frame, stacked in the order you meet them.
 *
 * A table sits over the screen, a program's page sits over the table you tapped
 * it from, and a player's card sits over whichever of those named him — so
 * closing each one puts you back exactly where you were rather than at the top
 * of somewhere else. Gathered into one component because all three frames the
 * app can be in need the identical set, and three copies of it is three places
 * to forget one.
 */
function Overlays(
  { teamCard, onCloseTeam }: { teamCard: number | null; onCloseTeam: () => void },
) {
  const overlay = useDynasty((s) => s.overlay);
  const selectedPlayer = useDynasty((s) => s.selectedPlayer);
  return (
    <>
      {overlay !== null && <TableOverlay />}
      {teamCard !== null && <TeamOverlay index={teamCard} onBack={onCloseTeam} />}
      {selectedPlayer !== null && <PlayerOverlay />}
    </>
  );
}

/**
 * A rival's program, over the table you tapped it in.
 *
 * The player card's twin in every respect that shows: the same navy bar, the
 * same absolute frame, the same rule that nothing underneath unmounts. Keyed on
 * the program so opening a second one is a second page rather than the first
 * one with new numbers on whatever tab you left it on.
 */
function TeamOverlay({ index, onBack }: { index: number; onBack: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 28,
      background: 'var(--field)',
      display: 'flex', flexDirection: 'column',
    }}>
      <BackBar onBack={onBack} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <TeamCard key={index} index={index} />
      </div>
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
      <BackBar onBack={close} />
      {/* Hidden, not auto. All three of these pin their own header and scroll
          their own body, so a scroller here would be a scroller around a
          scroller — and the outer one is the one that drags the header. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {overlay === 'schedule' && <Schedule />}
        {overlay === 'standings' && <Standings />}
        {overlay === 'rankings' && <Rankings />}
        {/* Not a table, but the same shape of thing: a screen laid over the one
            you were on, with the screen underneath still mounted when you close
            it. During the offseason it is the only way in — the nav is gone. */}
        {overlay === 'saves' && <Saves />}
      </div>
    </div>
  );
}

/**
 * The way out of anything that covers the whole frame.
 *
 * One definition, because the two overlays are the same object to the player
 * and looked like two different apps when each drew its own: the tables came
 * back on a navy bar with a bordered ← BACK, the player card on a bare chevron
 * tucked into its own header. The navy bar is the one the rest of the game
 * uses, and it earns its height by being outside the scroller — a control you
 * can lose by reading too far is the complaint the whole of Sticky.tsx exists
 * to answer.
 *
 * Bottom sheets dismiss with CLOSE on their clay bar instead, and that is a
 * different pattern for a different thing: a sheet sits on top of a screen you
 * can still see, while these replace it.
 */
function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      flex: 'none', padding: '10px 14px',
      paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
      background: 'var(--navy)', borderBottom: '3px solid var(--clay)',
    }}>
      <button
        onClick={onBack}
        className="tap"
        style={{
          padding: '11px 18px', background: 'rgba(246,241,230,.14)',
          border: '1px solid rgba(246,241,230,.32)',
          color: 'var(--cream)', font: "700 12px var(--mono)", letterSpacing: '.14em',
        }}
      >← BACK</button>
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
 * The back bar belongs to the overlay rather than to the card, and it is the
 * same bar the table overlay uses. A chevron drawn inside the card's own header
 * was tried and is what prompted "the back button does not follow the other
 * designs": it saved forty pixels and cost the player the one control in the
 * app that always looks the same wherever it appears.
 */
function PlayerOverlay() {
  const selectedPlayer = useDynasty((s) => s.selectedPlayer);
  const close = useDynasty((s) => s.closePlayer);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      background: 'var(--field)',
      display: 'flex', flexDirection: 'column',
    }}>
      <BackBar onBack={close} />
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
    case 'saves': return <Saves />;
    default: return <Placeholder id={id} />;
  }
}
