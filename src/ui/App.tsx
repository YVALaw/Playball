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
import { PressRoom } from './screens/PressRoom.js';
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
import { Inbox } from './screens/Inbox.js';
import { RecordBook } from './screens/RecordBook.js';
import { unreadCount } from '../engine/inbox.js';
import { Saves } from './screens/Saves.js';
import { OpenTeam, TeamCard } from './screens/TeamCard.js';
import { Colleges } from './screens/Colleges.js';
import { CoachPortrait } from './CoachPortrait.js';
import { Settings } from './screens/Settings.js';
import { seasonDate } from './format.js';
import { prestigeStars } from '../engine/program.js';

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
  const year = useDynasty((s) => s.year);
  // The chrome prints live numbers now — the record, the date, the roster —
  // and the engine mutates in place, so the version counter is what tells this
  // component a day has been played.
  const version = useDynasty((s) => s.version);
  void version;
  const team = useUserTeam();
  // Selected as a number rather than as the list, so a card being marked read
  // does not re-render the whole chrome.
  const unread = useDynasty((s) => unreadCount(s.inbox));

  const needsTeam = useDynasty((s) => s.needsTeam);
  const pendingPress = useDynasty((s) => s.pendingPress);
  const phase = useDynasty((s) => s.phase);
  const bracket = useDynasty((s) => s.bracket);
  const live = useDynasty((s) => s.live);
  const selectedPlayer = useDynasty((s) => s.selectedPlayer);
  const furthestPhase = useDynasty((s) => s.furthestPhase);
  const goPhase = useDynasty((s) => s.goPhase);
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
              font: "400 calc(12px * var(--ts))/1.55 var(--body)",
            }}>
              <strong>Your saved dynasty could not be opened.</strong> It was
              written by a different version of the game. Start a new one to get
              in — then look under PROGRAM · SAVES, where every other dynasty on
              this device is still listed, and this one will open again in the
              build that wrote it.
              <div style={{
                marginTop: 6, font: "400 calc(10px * var(--ts)) var(--mono)", color: 'var(--dim)',
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
        {/*
          The one frame that can genuinely dead-end — an older save carried
          `jobSearch` without the offers, and the screen below rendered
          "NOBODY IS CALLING" with no nav and no way anywhere else. The offers
          are persisted (and regenerated) now, but a way out stays here on
          principle: a terminal frame always offers the saves menu, the same
          escape the unreadable-save and stalled-storage screens give.
        */}
        <header style={{
          flex: 'none', height: 44, padding: '0 14px',
          paddingTop: 'env(safe-area-inset-top)',
          boxSizing: 'content-box',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--navy)',
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,.09) 0 1px, transparent 1px 7px)',
          borderBottom: '3px solid var(--clay)',
        }}>
          <div style={{
            flex: 1, minWidth: 0,
            font: "800 calc(18px * var(--ts))/0.95 var(--display)", letterSpacing: '.02em',
            color: 'var(--cream)', textTransform: 'uppercase',
          }}>THE MARKET</div>
          <button
            onClick={() => openOverlay('saves')}
            className="tap"
            style={{
              flex: 'none', padding: '8px 9px',
              background: 'rgba(246,241,230,.12)',
              border: '1px solid rgba(246,241,230,.28)',
              color: 'var(--cream)',
              font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.12em',
            }}
          >SAVES</button>
        </header>
        <SaveAlert topmost />
        <main ref={mainRef} key={phase ?? screen} className="screen-in" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
        }}>
          <JobSearch />
        </main>
        <Overlays teamCard={teamCard} onCloseTeam={() => setTeamCard(null)} />
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
              font: "800 calc(24px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
            }}>Save is unreadable</div>
            <div style={{
              marginTop: 10, font: "400 calc(12.5px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
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
                color: 'var(--cream)', font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.14em',
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
              font: "800 calc(24px * var(--ts))/1 var(--display)", textTransform: 'uppercase',
            }}>Cannot reach your saves</div>
            <div style={{
              marginTop: 10, font: "400 calc(12.5px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
            }}>
              This browser is not letting the game open its local storage. That
              usually means another tab has the game open, or site data is
              blocked for this address.
            </div>
            <div style={{
              marginTop: 8, font: "400 calc(12.5px * var(--ts))/1.6 var(--body)", color: 'var(--dim)',
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
                color: 'var(--cream)', font: "700 calc(11px * var(--ts)) var(--mono)", letterSpacing: '.14em',
              }}
            >PLAY WITHOUT SAVING</button>
          </div>
        </div>
      );
    }

    return (
      <div className="app-frame" style={{
        display: 'grid', placeItems: 'center',
        font: "700 calc(20px * var(--ts)) var(--display)", letterSpacing: '.08em',
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
        {/*
          A slim top bar, for the one piece of furniture June cannot do
          without: the inbox. The frame used to render no header at all, which
          made the notification centre unreachable for the whole postseason —
          the stretch of the year with the most to report. SAVES stays off
          this bar on purpose: mid-bracket saving is restricted to stage
          boundaries (see `endManagedGame`), so a button promising a copy of a
          half-played tournament would promise something the store does not do.
        */}
        {/* The bar steps aside while a game is being managed — the dugout owns
            the whole screen, the same rule the regular season follows. */}
        {!live && (
          <header style={{
            flex: 'none', height: 44, padding: '0 14px',
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
                font: "800 calc(18px * var(--ts))/0.95 var(--display)", letterSpacing: '.02em',
                color: 'var(--cream)', textTransform: 'uppercase',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{team.def.school}</div>
              <div style={{
                font: "500 calc(9px * var(--ts))/1.4 var(--mono)", letterSpacing: '.18em',
                color: 'var(--cream-dim)', textTransform: 'uppercase',
              }}>POSTSEASON</div>
            </div>
            <InboxButton unread={unread} onOpen={() => openOverlay('inbox')} />
            {/*
              The way to your own settings, in the month you are most likely to
              want them.

              June is a frame of its own and it was built without this, so for
              the whole postseason there was no route to the coach profile, the
              saves screen, or any setting -- text size and the tutorials switch
              included. Found while trying to reach the tutorials toggle from
              the bracket, which is exactly the moment somebody would go looking
              for it.
            */}
            <CoachMenuButton />
          </header>
        )}
        <SaveAlert topmost />
        {/*
          The sub-nav, which restoring the bottom nav forgot.

          Bringing the four tabs back to June without this put you on a tab's
          first screen with no way to reach its others — TEAM landed on the
          roster and STATS could not be opened at all, which is exactly where
          the postseason leaderboard lives. Reported as the stats not being
          there; they were, behind a control that had not been rendered.

          Only away from the bracket: JUNE is the postseason screen and has its
          own stage rail, so a second row of tabs above it would be two
          navigations arguing about the same space.
        */}
        {!live && tab !== 'home' && (
          <nav style={{
            flex: 'none', height: 38, display: 'flex',
            background: '#e7dfd0', borderBottom: '1px solid rgba(28,36,48,.16)',
          }}>
            {(TABS.find((t) => t.id === tab) ?? TABS[0]!).screens.map((sc) => {
              const on = screen === sc.id;
              const count = (TABS.find((t) => t.id === tab) ?? TABS[0]!).screens.length;
              return (
                <button
                  key={sc.id}
                  onClick={() => setScreen(sc.id)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: on ? 'var(--field)' : 'transparent',
                    borderRight: '1px solid rgba(28,36,48,.1)',
                    boxShadow: on ? 'inset 0 -3px 0 var(--clay)' : 'none',
                    font: `600 calc(${count >= 5 ? 8.5 : 10}px * var(--ts)) var(--mono)`,
                    letterSpacing: count >= 5 ? '.08em' : '.14em',
                    color: on ? 'var(--clay)' : 'var(--dim)',
                  }}
                >{sc.label}</button>
              );
            })}
          </nav>
        )}
        <main ref={mainRef} key={phase ?? screen} className="screen-in" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
        }}>
          {/* A bracket game you took yourself is managed on the same screen a
              regular season game is, so nothing about June feels like a
              different game than the one you played in April. */}
          {live ? <Manage /> : (tab === 'home' ? <Postseason /> : <Screen id={screen} />)}
        </main>
        {/*
          The nav comes back to June.

          It was taken away on the argument that the postseason is a sequence
          with an order and deserves the whole screen, and that argument was
          half right: the *bracket* deserves the screen, and it still has it.
          What the rule cost was everything else — reported plainly as wanting
          to see the roster during the postseason, and it applies just as much
          to who is hitting and where the year stands.

          So the bar returns with JUNE in the home slot instead of TODAY: the
          bracket is what the home tab means for as long as the bracket exists,
          and the other three are the screens they have always been. It stays
          away while a game is being managed, which is the one place the
          original argument holds completely.
        */}
        {!live && (
          <nav style={{
            flex: 'none', display: 'flex',
            background: 'var(--ink)', borderTop: '3px solid var(--clay)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
            {TABS.map((t) => {
              const on = tab === t.id;
              const label = t.id === 'home' ? 'JUNE' : t.label;
              return (
                <button
                  key={t.id}
                  onClick={() => go(t.id as Tab)}
                  style={{
                    flex: 1, padding: '8px 0 9px', textAlign: 'center',
                    background: on ? 'rgba(168,68,42,.85)' : 'transparent',
                  }}
                >
                  <div style={{
                    font: "700 calc(12px * var(--ts))/1 var(--display)", letterSpacing: '.12em',
                    color: on ? 'var(--cream)' : 'rgba(246,241,230,.5)',
                    position: 'relative', display: 'inline-block',
                  }}>
                    {label}
                    {t.id === 'home' && unread > 0 && (
                      <span style={{
                        position: 'absolute', top: -3, right: -8,
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--clay)',
                      }} />
                    )}
                  </div>
                  <div style={{
                    marginTop: 3,
                    font: "400 calc(8px * var(--ts))/1 var(--mono)", letterSpacing: '.1em',
                    color: on ? 'rgba(246,241,230,.75)' : 'rgba(246,241,230,.38)',
                  }}>{t.id === 'home' ? 'THE BRACKET' : ''}</div>
                </button>
              );
            })}
          </nav>
        )}
        <Overlays teamCard={teamCard} onCloseTeam={() => setTeamCard(null)} />
      </div>
    );
  }

  /*
    The room, before anything else on the screen.

    Ahead of the offseason rail and the season frame both, because a press
    conference is raised by something that has just happened and the screen
    behind it has already moved on -- put it inside a tab and it becomes a
    thing you can walk away from, which is the one shape it must not have.

    It is still not a trap: SAY NOTHING is a real answer, costs nothing, and
    spends the question.
  */
  if (pendingPress) return <PressRoom />;

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
              font: "800 calc(21px * var(--ts))/0.95 var(--display)", letterSpacing: '.02em',
              color: 'var(--cream)', textTransform: 'uppercase',
            }}>{team.def.school}</div>
            <div style={{
              font: "500 calc(9px * var(--ts))/1.4 var(--mono)", letterSpacing: '.18em',
              color: 'var(--cream-dim)', textTransform: 'uppercase',
            }}>OFFSEASON</div>
          </div>
          {/* The bottom nav is gone from here by design, and it took HOME ·
              INBOX with it — during the six steps that have most to report.
              The portrait menu carries PROFILE and SAVES, exactly the pair the
              missing nav owes this frame; the season badge that used to fill
              the corner is gone, because the review screen already says what
              the year came to and a header is not a trophy shelf. */}
          <InboxButton unread={unread} onOpen={() => openOverlay('inbox')} />
          <CoachMenuButton />
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

  /*
    A game in progress owns the screen. No school masthead, no portrait, no
    record, no nav — reported from testing: "when we are playing we dont need
    to see the team name, the coach pic, inbox and record up there." The
    scoreboard is the header; BACK TO THE DESK inside the dugout is the way
    out, and the game keeps until it is finished or simmed.
  */
  if (live && screen === 'box') {
    return (
      <div className="app-frame" style={{
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <SaveAlert topmost />
        <main ref={mainRef} style={{
          flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative',
          background: 'var(--field)',
        }}>
          <Manage />
        </main>
        <Overlays teamCard={teamCard} onCloseTeam={() => setTeamCard(null)} />
      </div>
    );
  }

  const tabDef = TABS.find((t) => t.id === tab) ?? TABS[0]!;

  /*
    One live number under each bottom-nav label — the date, the roster count,
    the record, the program's stars. The menu reports rather than just labels,
    which saves a trip for exactly the questions a player asks most often.
  */
  const today = season.schedule[season.dayIndex];
  const menCount = team.team.lineup.length + team.team.bench.length
    + team.team.rotation.length + team.team.bullpen.length;
  const navMeta: Record<string, string> = {
    home: today ? seasonDate(year, today.day).split(' ').slice(1).join(' ').toUpperCase() : 'FINAL',
    team: `${menCount} MEN`,
    season: `${team.w}-${team.l}`,
    program: '★'.repeat(prestigeStars(team.prestige)),
  };

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
            font: "800 calc(21px * var(--ts))/0.95 var(--display)", letterSpacing: '.02em',
            color: 'var(--cream)', textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{team.def.school}</div>
          <div style={{
            font: "500 calc(9px * var(--ts))/1.4 var(--mono)", letterSpacing: '.14em',
            color: 'var(--cream-dim)', textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {team.def.nickname} &middot; {team.conference}
          </div>
        </div>
        {/*
          The record, out of the small print.

          It rode the identity line at nine point beside the nickname and the
          conference, and it was reported as hard to see and easy to lose —
          which it was: the one number that changes every day was set in the
          same weight as two that never change. It gets its own block, at the
          top of the screen where the eye already goes, and nothing else moved
          to make room. Overall only; the conference record is a tap away on
          the standings and the header is meant to be getting lighter, not
          heavier.
        */}
        <div style={{ flex: 'none', textAlign: 'right', lineHeight: 1 }}>
          <div style={{
            font: "500 calc(7.5px * var(--ts)) var(--mono)", letterSpacing: '.16em',
            color: 'rgba(246,241,230,.5)', textTransform: 'uppercase',
          }}>RECORD</div>
          <div style={{
            marginTop: 2,
            font: "800 calc(17px * var(--ts))/1 var(--display)",
            color: 'var(--cream)', fontVariantNumeric: 'tabular-nums',
          }}>{team.w}-{team.l}</div>
        </div>
        <InboxButton unread={unread} onOpen={() => openOverlay('inbox')} />
        <CoachMenuButton />
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
                gap: 4,
                background: on ? 'var(--field)' : 'transparent',
                borderRight: '1px solid rgba(28,36,48,.1)',
                boxShadow: on ? 'inset 0 -3px 0 var(--clay)' : 'none',
                // Five labels have to share the same 360 pixels four used to.
                font: `600 calc(${tabDef.screens.length >= 5 ? 8.5 : 10}px * var(--ts)) var(--mono)`,
                letterSpacing: tabDef.screens.length >= 5 ? '.08em' : '.14em',
                color: on ? 'var(--clay)' : 'var(--dim)',
              }}
            >
              {s.label}
            </button>
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
                flex: 1, padding: '8px 0 9px', textAlign: 'center',
                background: on ? 'rgba(168,68,42,.85)' : 'transparent',
              }}
            >
              <div style={{
                font: "700 calc(12px * var(--ts))/1 var(--display)", letterSpacing: '.12em',
                color: on ? 'var(--cream)' : 'rgba(246,241,230,.5)',
                position: 'relative', display: 'inline-block',
              }}>
                {t.label}
                {/* Unread has to be visible from wherever the player normally
                    is, and where he normally is is not the home tab. A dot on
                    the bottom bar is the only mark that survives being three
                    screens away — the count itself is on the top-bar bell, one
                    tap away, where there is room to print it. */}
                {t.id === 'home' && unread > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -8,
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--clay)',
                  }} />
                )}
              </div>
              <div style={{
                marginTop: 3,
                font: "400 calc(8px * var(--ts))/1 var(--mono)", letterSpacing: '.1em',
                color: on ? 'rgba(246,241,230,.75)' : 'rgba(246,241,230,.38)',
              }}>{navMeta[t.id] ?? ''}</div>
            </button>
          );
        })}
      </nav>
      <Overlays teamCard={teamCard} onCloseTeam={() => setTeamCard(null)} />
    </div>
  );
}

/**
 * The way into the inbox from anywhere, with the count on it.
 *
 * Reported: the inbox is unreachable outside the regular season. It was a HOME
 * sub-screen, and HOME does not exist during the offseason or the postseason —
 * so the one stretch of the year when it has the most to say, the verdict, the
 * offers, the draft, the hall and every coaching change in the country, was the
 * stretch you could not open it in.
 *
 * The top bar is the one piece of furniture both of those frames have, so the
 * button lives there and opens the inbox as an overlay, which works over all
 * three. The sub-nav count and the dot on HOME stay as they were: they are how
 * you notice it while the season is on, and this is how you get to it when it
 * is not.
 */
function InboxButton({ unread, onOpen }: { unread: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="tap"
      aria-label={`Inbox${unread > 0 ? `, ${unread} unread` : ''}`}
      style={{
        flex: 'none', position: 'relative', padding: '8px 9px',
        background: unread > 0 ? 'var(--clay)' : 'rgba(246,241,230,.12)',
        border: `1px solid ${unread > 0 ? 'var(--clay)' : 'rgba(246,241,230,.28)'}`,
        color: 'var(--cream)',
        font: "700 calc(8.5px * var(--ts)) var(--mono)", letterSpacing: '.12em',
      }}
    >
      INBOX{unread > 0 ? ` ${unread > 9 ? '9+' : unread}` : ''}
    </button>
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
      <div style={{ font: "700 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em' }}>
        NOT SAVED · TAP TO TRY AGAIN
      </div>
      <div style={{
        marginTop: 2, font: "400 calc(10px * var(--ts))/1.35 var(--body)",
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
  /*
    Back means one step, not all the way out.

    Settings is the only screen in here with pages of its own, and it has two
    back controls: its own, and the overlay's, which is the bigger and more
    obvious of the two. Reported as pressing back on a settings page and being
    returned to whatever screen preceded settings entirely. So the outer one
    defers to the inner one while there is an inner one to defer to.
  */
  const settingsPage = useDynasty((s) => s.settingsPage);
  const setSettingsPage = useDynasty((s) => s.setSettingsPage);
  const back = (): void => {
    if (overlay === 'settings' && settingsPage !== 'index') setSettingsPage('index');
    else close();
  };
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 25,
      background: 'var(--field)',
      display: 'flex', flexDirection: 'column',
    }}>
      <BackBar onBack={back} />
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
        {overlay === 'settings' && <Settings />}
        {/* And the same argument again, for the three the inbox needs. The
            inbox itself, because it is a HOME tab and HOME does not exist
            during the offseason — which is precisely when it has the most to
            say. The program page and the record book, because they are where
            its cards point, and a card that is only tappable in one of the
            three frames is not tappable. */}
        {overlay === 'inbox' && <Inbox />}
        {overlay === 'program' && <Program />}
        {/* The one of these that does not pin its own header — it is normally
            the second sheet of HISTORY, which does the pinning for it — so it
            gets the scroller the container above deliberately does not have. */}
        {overlay === 'book' && (
          <div style={{ height: '100%', overflowY: 'auto' }}><RecordBook /></div>
        )}
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
          color: 'var(--cream)', font: "700 calc(12px * var(--ts)) var(--mono)", letterSpacing: '.14em',
        }}
      >← BACK</button>
    </div>
  );
}

/**
 * You, in the corner, and the little menu behind your face.
 *
 * The face used to be a straight door to the coach profile; it is a menu now
 * because the header could not afford a button per destination and the two
 * things a player reaches for from anywhere — who am I, and my saves — belong
 * behind the one control that is always there. Tapping the scrim or picking an
 * item puts the header back exactly as it was.
 */
function CoachMenuButton() {
  const coach = useDynasty((s) => s.coach);
  const setProgramSheet = useDynasty((s) => s.setProgramSheet);
  const openOverlay = useDynasty((s) => s.openOverlay);
  const [open, setOpen] = useState(false);

  const item = (label: string, run: () => void, last?: boolean) => (
    <button
      role="menuitem"
      onClick={() => { setOpen(false); run(); }}
      className="tap"
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '12px 16px', minHeight: 40,
        background: 'transparent',
        borderBottom: last ? 'none' : '1px solid rgba(246,241,230,.14)',
        color: 'var(--cream)', font: "700 calc(9.5px * var(--ts)) var(--mono)", letterSpacing: '.14em',
      }}
    >{label}</button>
  );

  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Coach menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="tap"
        style={{
          width: 40, height: 40, minWidth: 40, padding: 0,
          borderRadius: '50%', overflow: 'hidden',
          border: `2px solid ${open ? 'var(--cream)' : 'rgba(246,241,230,.4)'}`,
          background: 'var(--paper)',
          display: 'grid', placeItems: 'center',
        }}
      >
        <CoachPortrait look={coach.look} size={36} />
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 44 }}
          />
          <div
            role="menu"
            className="card-in"
            style={{
              position: 'absolute', top: 46, right: 0, zIndex: 45,
              minWidth: 168,
              background: 'var(--navy)',
              border: '1px solid rgba(246,241,230,.28)',
              boxShadow: '0 12px 34px rgba(0,0,0,.4)',
            }}
          >
            {item('COACH PROFILE', () => { setProgramSheet('coach'); openOverlay('program'); })}
            {/* Saves used to sit here as a peer. It moved inside settings: one
                place for everything about you and the app, which also stops the
                menu growing a row every time a preference is added. */}
            {item('SETTINGS', () => openOverlay('settings'), true)}
          </div>
        </>
      )}
    </div>
  );
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
    case 'colleges': return <Colleges />;
    case 'strategy': return <StrategyScreen />;
    // 'board' and 'draft' are deliberately absent: both are offseason phases
    // now, rendered by the phase frame. Routed here they would mount outside
    // the window they live in — the Board with no pinned action and no way
    // forward at all. An unknown id falls through to the placeholder instead.
    case 'wire': return <Wire />;
    case 'inbox': return <Inbox />;
    case 'saves': return <Saves />;
    default: return <Placeholder id={id} />;
  }
}
