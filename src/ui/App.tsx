// App.tsx
// The four frames the game can be in — the regular season, the offseason, the
// postseason and the job search — and the furniture each of them wears.
//
// The furniture itself moved to Chrome.tsx during the Roster Tabletop port. It
// was written inline here four times over, once per frame, out of the same
// handful of ideas, and two of the four had already drifted. What is left in
// this file is which frame you are in and what goes in each of its slots, which
// is the only part that was ever different between them.
//
// design/Roster Tabletop/ is the design of record.

import { useEffect, useRef, useState } from 'react';
import { applyTeamAccent } from './accent.js';
import { audioReady, preloadSfx, unlockAudio } from './sound.js';
import { BigMomentCard } from './BigMoment.js';
import { teamColour } from './Avatar.js';
import {
  ArchiveIcon, ArrowLeftIcon, CalendarIcon, ChevronRightIcon, EnvelopeClosedIcon, GearIcon,
  HomeIcon, IdCardIcon, StarIcon,
} from '@radix-ui/react-icons';
import {
  PHASES, PHASE_LABEL, TABS, useDynasty, useUserTeam, type Tab,
} from '../state/store.js';
import { StepRail } from './StepRail.js';
import { Overlay } from './Overlay.js';
import {
  ClubSwitcher, CoachAvatar, ContextNav, PrimaryNav, RecordChip,
} from './Chrome.js';
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
import { DepthChart } from './screens/DepthChart.js';
import { Captain } from './screens/Captain.js';
import { JobMarket } from './screens/JobMarket.js';
import { Portal } from './screens/Portal.js';
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
 * A face for each of the four areas.
 *
 * The bottom bar was four words in a condensed face and nothing else, which is
 * legible but slow: you read the bar rather than recognising it. A house, a
 * card, a calendar and a star are the shapes the proposal picked and they are
 * the obvious four — the only one worth arguing about is TEAM, where a roster
 * really is a stack of cards.
 *
 * Sized here rather than in Chrome.tsx so the nav stays honest about taking
 * whatever node it is handed; nothing stops a future tab carrying a portrait.
 */
const TAB_ICON: Record<string, React.ReactNode> = {
  home: <HomeIcon width={19} height={19} />,
  team: <IdCardIcon width={19} height={19} />,
  season: <CalendarIcon width={19} height={19} />,
  program: <StarIcon width={19} height={19} />,
};

/**
 * HOME to Home.
 *
 * `TABS` stores its labels shouted, because the old bar set them in a condensed
 * face at twelve point where upper case is the only thing that holds a line
 * together. The new bar sets them at eleven in the body face, where shouting
 * reads as shouting. The store is not the place to fix that — those strings are
 * also what the sub-nav and a couple of screens print — so the bar quietens them
 * on the way out.
 */
function titleCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

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

  /*
    Your school's colours, worn by the whole app.

    Proposed from play: 'instead of white and green, the green accent is
    changed to the team's colors they select.' The accent hooks are filled
    from the team the save says you coach and cleared when there is none --
    creation and the menu keep the house green. See accent.ts for why the
    lightness is clamped per theme rather than the hex applied raw.
  */
  const accentAbbr = useDynasty((s) => {
    const i = s.userTeam;
    return s.season?.teams[i]?.def.abbr ?? null;
  });
  useEffect(() => {
    applyTeamAccent(accentAbbr ? teamColour(accentAbbr) : null);
  }, [accentAbbr]);

  /*
    The broadcast's ears — stage 14. Mobile browsers refuse audio until a user
    gesture, so the first touch anywhere unlocks the context and warms the
    sample cache. Once is enough; the listener removes itself.
  */
  useEffect(() => {
    /*
      WebKit only counts touch-RELEASE events as the gesture that may unlock
      audio — pointerdown is not one, which is why the phone stayed silent
      while desktop testing heard everything. Listen on the releases, keep
      listening until the context genuinely runs (resume() is async, so the
      ready check often passes one tap late), and let pointerdown stay only
      to warm the sample cache early.
    */
    const events = ['pointerup', 'touchend', 'click', 'keydown'] as const;
    const off = (): void => {
      for (const e of events) window.removeEventListener(e, wake);
      window.removeEventListener('pointerdown', warm);
    };
    const wake = (): void => {
      unlockAudio();
      preloadSfx();
      if (audioReady()) off();
    };
    const warm = (): void => preloadSfx();
    for (const e of events) window.addEventListener(e, wake, { passive: true });
    window.addEventListener('pointerdown', warm, { passive: true });
    return off;
  }, []);

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
              background: 'var(--paper)', borderLeft: '3px solid var(--alert)',
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
        {/* No club mark and no record: there is no club yet, which is the whole
            situation this frame describes. */}
        <header className="global-header" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
          <ClubSwitcher abbr="—" kicker="Between jobs" name="The Market" />
          <button className="header-icon tap" type="button" aria-label="Saves"
            onClick={() => openOverlay('saves')}
          ><ArchiveIcon /></button>
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
          <header className="global-header" style={{ gridTemplateColumns: 'minmax(0,1fr) 40px' }}>
            <ClubSwitcher abbr={team.def.abbr} kicker="Postseason" name={team.def.school} />
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
          <ContextNav
            label={`${(TABS.find((t) => t.id === tab) ?? TABS[0]!).label} sections`}
            items={(TABS.find((t) => t.id === tab) ?? TABS[0]!).screens}
            active={screen}
            onSelect={setScreen}
          />
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
          <PrimaryNav
            tabs={TABS.map((t) => ({
              id: t.id,
              label: t.id === 'home' ? 'June' : titleCase(t.label),
              meta: t.id === 'home' ? 'THE BRACKET' : '',
              icon: TAB_ICON[t.id],
              alert: t.id === 'home' && unread > 0,
            }))}
            active={tab}
            onSelect={(id) => go(id as Tab)}
          />
        )}
        <Overlays teamCard={teamCard} onCloseTeam={() => setTeamCard(null)} />
      </div>
    );
  }

  /*
    The room used to be here, ahead of everything else on the screen, and it is
    now an overlay you open from NEEDS YOU instead. Two separate reports, and
    they landed on the same line of code.

    The first was a layout bug: it "expanded the screen out of its regular
    mobile size", which is exactly what it did. `.app-frame` is the phone — it
    caps the width at 430, clips its overflow, and, the part that bit, carries
    `position: relative`. `FixedHeader` lays itself out `absolute; inset: 0`, so
    with no frame around it the nearest positioned ancestor was the window and
    the room stretched across a desktop. Every other return in this function
    wraps; this one was written as a guard clause, and guard clauses do not look
    like they are missing a wrapper.

    The second was the design: it "shouldn't simply appear all of a sudden".
    The original comment here argued the opposite — put it in a tab and it
    becomes a thing you can walk away from, which is the one shape it must not
    have — and that argument was wrong in a way worth keeping a note of. It
    bought attention by taking the screen away from a player in the middle of
    doing something else, and it is the only thing in the game that does. What
    replaces it is how the rest of this game already works: the question is
    written down, it sits at the top of the home screen in red, and you go to
    it. See `Needs.tsx`.
  */

  if (phase !== null) {
    return (
      <div className="app-frame" style={{
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <header className="global-header" style={{ gridTemplateColumns: 'minmax(0,1fr) 40px' }}>
          <ClubSwitcher abbr={team.def.abbr} kicker={`${year} Offseason`} name={team.def.school} />
          {/* The bottom nav is gone from here by design, and it took HOME ·
              INBOX with it — during the seven steps that have most to report.
              The portrait menu carries PROFILE and SAVES, exactly the pair the
              missing nav owes this frame; the season badge that used to fill
              the corner is gone, because the review screen already says what
              the year came to and a header is not a trophy shelf. */}
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
          {phase === 'portal' && <Portal />}
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
    <div className="app-frame playball-app">
      {/*
        The top bar, on paper.

        It was navy with a pinstripe through it and a clay rule underneath, and
        it read as a masthead — the app announcing itself above the thing you
        came to look at. The same five pieces of information are here; they are
        simply on the same ground as the screen, separated by a hairline. What
        the change buys is the club mark, which is the only fixed shape in a
        header whose every other slot changes daily.

        The record keeps its own block. It rode the identity line at nine point
        beside the nickname and the conference, and it was reported as hard to
        see and easy to lose — which it was: the one number that changes every
        day was set in the same weight as two that never change. Overall only;
        the conference record is a tap away on the standings.
      */}
      <header className="global-header">
        <ClubSwitcher
          abbr={team.def.abbr}
          kicker={`${team.def.nickname} · ${team.conference}`}
          name={team.def.school}
        />
        <RecordChip label={team.conference} value={`${team.w}-${team.l}`} />
        <CoachMenuButton />
      </header>

      <SaveAlert />

      <ContextNav
        label={`${tabDef.label} sections`}
        items={tabDef.screens}
        active={screen}
        onSelect={setScreen}
      />

      <main ref={mainRef} style={{
        flex: 1, minHeight: 0, overflow: 'auto', position: 'relative',
        WebkitOverflowScrolling: 'touch', background: 'var(--field)',
      }}>
        <Screen id={screen} />
        <div style={{ height: 10 }} />
      </main>

      {/* The dot on HOME is how unread survives being three screens away; the
          count itself is on the top-bar envelope, one tap from here, where
          there is room to print it. */}
      <PrimaryNav
        tabs={TABS.map((t) => ({
          id: t.id,
          label: titleCase(t.label),
          meta: navMeta[t.id] ?? '',
          icon: TAB_ICON[t.id],
          alert: t.id === 'home' && unread > 0,
        }))}
        active={tab}
        onSelect={(id) => go(id as Tab)}
      />
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
        background: 'var(--alert)', color: 'var(--cream)',
      }}
    >
      <div style={{ font: "700 calc(9px * var(--ts)) var(--mono)", letterSpacing: '.16em' }}>
        NOT SAVED · TAP TO TRY AGAIN
      </div>
      <div style={{
        marginTop: 2, font: "400 calc(10px * var(--ts))/1.35 var(--body)",
        color: 'rgba(var(--cream-rgb), .82)',
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
      {/* Above everything, because it IS the screen while it lasts. */}
      <BigMomentCard />
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
  const season = useDynasty((s) => s.season);
  const rival = season?.teams[index];
  return (
    <Overlay
      eyebrow="COLLEGE PROFILE"
      title={rival?.def.school ?? 'Program'}
      onClose={onBack}
    >
      <TeamCard key={index} index={index} />
    </Overlay>
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
  const programSheet = useDynasty((s) => s.programSheet);
  const setProgramSheet = useDynasty((s) => s.setProgramSheet);
  const back = (): void => {
    if (overlay === 'settings' && settingsPage !== 'index') setSettingsPage('index');
    /*
      Back from the coach sheet closes it. It used to step to the program
      board first, borrowing the settings pages' deference — but a settings
      page's home really is the settings index, while the coach sheet is
      opened from the portrait on whatever screen you happened to be on.
      Reported exactly as that felt: "it takes me to the program board
      instead of the last place I was at" — the detour was a screen the
      player never visited, inserted on the way out of one they did.

      The sheet still resets on the way past, because leaving `programSheet`
      on 'coach' is the old one-way door: the PROGRAM tab would open straight
      onto the coach page with no way back. Reset-and-close does both jobs in
      the one press.
    */
    else if (overlay === 'program' && programSheet === 'coach') {
      setProgramSheet('board');
      close();
    }
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
        {/* No pinned header of its own either — every sheet on it (the board,
            the money, the hall, the coach) is a plain column, so it takes the
            same scroller the jobs screen does. Reported as the coach profile
            refusing to scroll; it was the whole tab, and the coach sheet was
            simply the first one tall enough to prove it. */}
        {overlay === 'program' && (
          <div className="screen-scroll" style={{ height: '100%' }}><Program /></div>
        )}
        {overlay === 'depth' && <DepthChart />}
        {/* Who wears the C, with every eligible man and a reason to prefer one.
            It used to be a line at the top of the depth chart, which made the
            room's own pick the only name anybody ever saw. */}
        {/* No pinned header of its own, so it gets the scroller the container
            above deliberately does not have -- without it the list of eligible
            men was simply cut off at the fold. */}
        {/* The job market — a university calling about a job gets a screen,
            not a list buried on the program board. Same scroller story as the
            captain below. */}
        {overlay === 'jobs' && (
          <div className="screen-scroll" style={{ height: '100%' }}><JobMarket /></div>
        )}
        {overlay === 'captain' && (
          <div className="screen-scroll" style={{ height: '100%' }}><Captain /></div>
        )}
        {/* The press room, which stopped being an interruption and became an
            errand. Here rather than in the screen switch because the overlays
            are the one layer present in every frame the offseason included, and
            a question raised by the last game of a regional must still be
            answerable once the regular season's nav has gone. */}
        {overlay === 'press' && <PressRoom />}
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
 * back on a bar with a bordered ← BACK, the player card on a bare chevron
 * tucked into its own header. Whichever it is, it earns its height by being
 * outside the scroller — a control you can lose by reading too far is the
 * complaint the whole of Sticky.tsx exists to answer.
 *
 * An arrow in a square rather than the word, which is the proposal's overlay
 * header and is safe here for a reason worth stating: the bar carries exactly
 * one control, so there is nothing for a bare glyph to be confused with. It
 * carries an `aria-label` because a screen reader has no such luxury.
 *
 * No title on it yet. The proposal's version prints an eyebrow and the name of
 * whatever you opened, and every screen behind this bar already prints its own
 * through `FixedHeader` — so adding one here today buys a duplicate. It belongs
 * with the overlay rework in phase five, where the screen's own header is the
 * thing that goes.
 *
 * Bottom sheets dismiss with CLOSE on their own bar instead, and that is a
 * different pattern for a different thing: a sheet sits on top of a screen you
 * can still see, while these replace it.
 */
function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      flex: 'none', padding: '10px 14px',
      paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
      background: 'var(--paper)', borderBottom: '1px solid var(--line)',
    }}>
      <button
        onClick={onBack}
        aria-label="Back"
        className="tap"
        style={{
          width: 42, height: 42, display: 'grid', placeItems: 'center',
          border: '1px solid var(--line)', background: 'var(--paper)',
          color: 'var(--clay)',
        }}
      ><ArrowLeftIcon width={17} height={17} /></button>
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
  const team = useUserTeam();
  const setProgramSheet = useDynasty((s) => s.setProgramSheet);
  const openOverlay = useDynasty((s) => s.openOverlay);
  // Read here rather than passed down: the menu is rendered from three
  // different frames and none of them should have to know the inbox exists.
  const unread = useDynasty((s) => unreadCount(s.inbox));
  const [open, setOpen] = useState(false);

  const go = (run: () => void) => { setOpen(false); run(); };

  return (
    <>
      <CoachAvatar look={coach.look} badge={unread} onClick={() => setOpen((v) => !v)} />
      {open && (
        <>
          <button
            className="popover-scrim"
            type="button"
            aria-label="Close coach menu"
            onClick={() => setOpen(false)}
          />
          <section className="account-menu card-in" role="menu">
            <div>
              <span className="initial-avatar"><CoachPortrait look={coach.look} size={40} /></span>
              <span>
                <strong>{coach.name}</strong>
                <small>{team ? `Head Coach · ${team.def.school}` : "Between jobs"}</small>
              </span>
            </div>
            {/* The inbox, moved in off the bar.

                It was a 40px square in every header in the game, and a header
                is the most expensive real estate the app has — it is on screen
                on every screen. In here it is one tap further away and carries
                its count in words rather than on a badge, which is more room
                than the shoulder of an envelope ever had.

                What pays for the extra tap is the dot on HOME in the bottom
                nav: that is how unread survives being three screens away, and
                with the envelope gone it is now the only thing doing that job,
                so it stays. */}
            <button
              className={unread > 0 ? 'has-count' : undefined}
              type="button"
              role="menuitem"
              onClick={() => go(() => openOverlay("inbox"))}
            >
              <EnvelopeClosedIcon />
              Inbox
              {unread > 0 && <span className="menu-count">{unread}</span>}
              <ChevronRightIcon />
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => go(() => { setProgramSheet("coach"); openOverlay("program"); })}
            ><IdCardIcon />Coach profile<ChevronRightIcon /></button>
            {/* Saves used to sit here as a peer. It moved inside settings: one
                place for everything about you and the app, which also stops the
                menu growing a row every time a preference is added. */}
            <button
              type="button"
              role="menuitem"
              onClick={() => go(() => openOverlay("settings"))}
            ><GearIcon />Settings<ChevronRightIcon /></button>
          </section>
        </>
      )}
    </>
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
  const name = usePlayerName(selectedPlayer);
  return (
    <Overlay eyebrow="PLAYER CARD" title={name} onClose={close}>
      {/*
        Keyed on the man, so opening a second card is a fresh card.
        The scroll reset in the frame resets the screen *underneath* the
        overlay, which it must — but it leaves the card itself on whatever tab
        and scroll position the last player was read at. Tapping a name in a box
        score and landing halfway down someone else's game log is the same bug
        the reset exists to prevent, one layer up.
      */}
      <Player key={selectedPlayer ?? ''} />
    </Overlay>
  );
}

/**
 * The name for the bar over the card.
 *
 * The card itself finds the man by searching every roster in the world, which
 * is the right thing for a screen that opens leaderboard strangers and drafted
 * alumni alike. The bar above it only needs the name, so it does the cheap half
 * of the same search and falls back to a title rather than to nothing — a card
 * for a man the world no longer contains still has a header.
 */
function usePlayerName(id: string | null): string {
  const season = useDynasty((s) => s.season);
  const report = useDynasty((s) => s.lastOffseason);
  if (!id || !season) return 'Player card';
  for (const t of season.teams) {
    for (const p of [...t.team.lineup, ...t.team.bench, ...t.team.rotation, ...t.team.bullpen]) {
      if (p.id === id) return p.name;
    }
  }
  const gone = [...(report?.graduated ?? []), ...(report?.drafted ?? [])]
    .find((d) => d.id === id);
  return gone?.name ?? 'Player card';
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
