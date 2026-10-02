// SeasonTerms.tsx
// The board's terms, signed before the first pitch.
//
// From the UI clarity review (design/UI Clarity Review/Season Start.dc.html,
// variant A, 2026-09-25). The top of a season used to be a modal, "Before the
// first pitch", whose one button ("Read the board's terms") sent the coach to
// the Office's board to find the card that actually took them. Two screens for
// one decision, and the second was a page of everything else the board knows.
// The review's reading: one step over the whole frame, three parts, and the
// signature pinned under them.
//
//   1 · Your winter   how last season landed, in the board's words, and what
//                     it did to both names
//   2 · The targets   the number, what must be hit, what only builds trust
//   3 · The stakes    where confidence stands and what the season can do to it
//
// Signing stays locked until the page has been read to its end, or fits
// without scrolling: "Read all three parts, then sign or push back." Push back
// is `argueTerms`, once a season as it always was, and the board's answer
// lands in part 2 beside the number it moved.
//
// It covers the frame for exactly as long as `openerShowing` says so, the one
// predicate the back gesture also asks: a swipe here is refused, and the bar
// shakes to say so, rather than walking out from under a season nobody has
// agreed to. The opener is in the save (05 §90.10), so a phone that reloads on
// this page comes back to it.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { openerShowing, useDynasty, useUserTeam, type DynastyStore } from '../../state/store.js';
import { seasonLength } from '../../engine/season.js';
import { Crest } from '../Crest.js';
import { wantsMotion } from '../celebrate.js';
import { useDialogFocus } from '../dialogFocus.js';
import { plural } from '../words.js';
import {
  ActionBar, AppHeader, Button, Callout, Card, Delta, Icon, Meter, StatusBadge, cx,
} from '../components/ui/index.js';
import { noteTermsSigned, securityWord, SECURITY_REVIEW, SECURITY_SECURE } from './Program.js';

type Opener = NonNullable<DynastyStore['seasonOpener']>;

/** The rail's three parts, in the order the page reads them. */
const PARTS = ['Your winter', 'The targets', 'The stakes'] as const;

/** The step, while there are terms to sign and nothing else owns the screen. */
export function SeasonTerms() {
  const showing = useDynasty(openerShowing);
  const opener = useDynasty((s) => s.seasonOpener);
  if (!showing || !opener) return null;
  // Keyed on the year, so a new season's terms are read from the top.
  return <TermsStep key={opener.year} opener={opener} />;
}

function TermsStep({ opener }: { opener: Opener }) {
  const season = useDynasty((s) => s.season);
  const team = useUserTeam();
  const ask = useDynasty((s) => s.boardAsk);
  const coach = useDynasty((s) => s.coach);
  const arguedTerms = useDynasty((s) => s.arguedTerms);
  const argueTerms = useDynasty((s) => s.argueTerms);
  const dismiss = useDynasty((s) => s.dismissSeasonOpener);
  const nudge = useDynasty((s) => s.cardNudge);
  const nudgeCard = useDynasty((s) => s.nudgeCard);

  const root = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const answer = useRef<HTMLDivElement | null>(null);
  const parts = useRef<Array<HTMLElement | null>>([]);
  const frame = useRef(0);
  const titleId = useId();

  /** Read to the end once; it does not lock again for scrolling back up. */
  const [read, setRead] = useState(false);
  /** The part the reader is in, for the rail. */
  const [at, setAt] = useState(0);
  /** What the board said to a push back: the wins it gave, or 0 for none. */
  const [argued, setArgued] = useState<number | null>(null);

  // A dialog to a keyboard as well: focus starts on the title and stays in
  // the step, and Escape is refused the way the back press is.
  useDialogFocus(root, nudgeCard, { initial: heading, layer: false });

  const check = useCallback((): void => {
    const el = scroller.current;
    if (!el) return;
    const y = el.scrollTop;
    const end = y >= el.scrollHeight - el.clientHeight - 24;
    let now = 0;
    parts.current.forEach((p, i) => { if (p && p.offsetTop - 120 <= y) now = i; });
    setAt(end ? PARTS.length - 1 : now);
    if (end) setRead(true);
  }, []);

  // On arrival, and whenever the page or the phone changes size: a page that
  // fits without scrolling has been read, and a font arriving late can make
  // one that fitted need scrolling after all.
  useLayoutEffect(() => {
    check();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(() => check());
    if (scroller.current) ro.observe(scroller.current);
    if (body.current) ro.observe(body.current);
    return () => ro.disconnect();
  }, [check]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const onScroll = (): void => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => { frame.current = 0; check(); });
  };

  const glide = (top: number): void => {
    scroller.current?.scrollTo({ top: Math.max(0, top), behavior: wantsMotion() ? 'smooth' : 'auto' });
  };

  /*
    The refused back press, made visible: the same contract `Modal` and the
    big moment carry (see `cardNudge` in the store). The bar shakes because
    the bar is the way on. Driven off the DOM so a second press shakes too.
  */
  const nudgedAt = useRef(nudge);
  useEffect(() => {
    if (nudge === nudgedAt.current) return;
    nudgedAt.current = nudge;
    const bar = root.current?.querySelector<HTMLElement>('.pb-terms__bar');
    if (!bar) return;
    bar.classList.remove('is-nudged');
    void bar.offsetWidth;
    bar.classList.add('is-nudged');
  }, [nudge]);

  /*
    The board's answer is printed in part 2, beside the number it is about,
    and the reader pressed for it in the bar at the foot of part 3. So the
    page goes to the answer rather than leaving it to be found.
  */
  useEffect(() => {
    const el = scroller.current;
    if (argued === null || !answer.current || !el) return;
    glide(answer.current.offsetTop - el.clientHeight / 3);
  }, [argued]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!season || !team) return null;

  const games = seasonLength(season.config);
  // The live ask first: it is the one the board judges, and the one a push
  // back moves. The opener's own copy of the number (kept equal to it by
  // `argueTerms`) stands in only for a board with no stamp.
  const target = ask?.targetWins ?? opener.targetWins;
  const objectives = ask?.objectives ?? [];
  const required = objectives.filter((o) => o.required);
  const bonus = objectives.filter((o) => !o.required);
  // Last season as the school's own book has it: the regular season, which
  // is what the target counts, and only said as "you" when it was you.
  const last = team.annals?.find((a) => a.year === opener.year - 1);
  const wonLast = last && last.coach === coach.name ? last.w : null;
  const confidence = securityWord(coach.security);
  const canArgue = !arguedTerms;

  const goTo = (i: number): void => {
    const part = parts.current[i];
    if (part) glide(part.offsetTop - 12);
  };
  const pushBack = (): void => {
    // Asked of the store at the press, not of the render: a quick second tap
    // would otherwise hear "they held firm" over what the first one won.
    if (!read || useDynasty.getState().arguedTerms) return;
    setArgued(argueTerms());
  };
  const signNow = (): void => {
    if (!read) return;
    noteTermsSigned(season);
    dismiss();
  };

  return (
    <div ref={root} className="pb-terms" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <AppHeader
        mark={<Crest abbr={team.def.abbr} size={30} />}
        kicker={`${opener.year} · Before the first pitch`}
        title={team.def.school}
        trailing={<StatusBadge tone="warning" icon={false}>Waiting on you</StatusBadge>}
      />
      <nav className="pb-terms__rail" aria-label="The three parts">
        {PARTS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={i <= at ? 'is-on' : undefined}
            aria-current={i === at ? 'step' : undefined}
            onClick={() => goTo(i)}
          >
            <i aria-hidden />
            <span>{i + 1} · {label}</span>
          </button>
        ))}
      </nav>

      <div ref={scroller} className="pb-terms__scroll" onScroll={onScroll}>
        <div ref={body} className="pb-terms__body">
          <header className="pb-terms__title">
            <h1 id={titleId} ref={heading} tabIndex={-1}>The board’s terms for {opener.year}</h1>
            <p>Before the first pitch, the board wants your signature on this season’s targets. Read all three parts, then sign or push back.</p>
          </header>

          <section className="pb-terms__part" ref={(el) => { parts.current[0] = el; }}>
            <PartHead n={1} title="How the winter went" />
            <Card>
              <p className="pb-terms__line">{[opener.headline, opener.message].filter(Boolean).join('. ')}</p>
              <PrestigeMoves
                rows={[
                  { label: 'Your school', before: opener.schoolBefore, after: opener.schoolAfter },
                  { label: 'You', before: opener.coachBefore, after: opener.coachAfter },
                ]}
              />
              {opener.stings.length > 0 && (
                <Callout tone="warning" className="pb-terms__sting">{opener.stings.join(' ')}</Callout>
              )}
            </Card>
          </section>

          <section className="pb-terms__part" ref={(el) => { parts.current[1] = el; }}>
            <PartHead n={2} title="What they expect" />
            <div className="pb-terms__panel">
              <div className="pb-terms__target">
                <b>{target}</b>
                <small>wins of {games}</small>
              </div>
              <div className="pb-terms__ask">
                <b>{ask?.summary ?? opener.askSummary}</b>
                <span>Based on your roster and prestige.{wonLast !== null ? ` You won ${wonLast} last season.` : ''}</span>
              </div>
            </div>
            {argued !== null && (
              <div ref={answer}>
                <Callout
                  tone={argued > 0 ? 'positive' : 'neutral'}
                  icon="info"
                  title={argued > 0 ? 'They lowered the target' : 'They held firm'}
                >
                  {argued > 0
                    ? `Down ${plural(argued, 'win')}, to ${target}. You cannot push back again this season.`
                    : 'The target stands.'}
                </Callout>
              </div>
            )}
            {required.length > 0 && (
              <div className="pb-terms__group">
                <div className="pb-terms__subhead">
                  <span>Must hit · judged at your review</span>
                  <small>{plural(required.length, 'goal')}</small>
                </div>
                <div className="pb-terms__must" role="list" aria-label="Must hit">
                  {required.map((o) => (
                    <div key={o.key} role="listitem" className="pb-terms__mustrow">
                      <span className="pb-terms__musticon" aria-hidden><Icon name="target" size={16} /></span>
                      <span className="pb-terms__label">{o.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bonus.length > 0 && (
              <div className="pb-terms__group">
                <div className="pb-terms__subhead">
                  <span>Extra credit · each one builds trust</span>
                  <small>{plural(bonus.length, 'goal')}</small>
                </div>
                <div className="pb-terms__extra" role="list" aria-label="Extra credit">
                  {bonus.map((o) => (
                    <div key={o.key} role="listitem" className="pb-terms__extracard">
                      <Icon name="star-filled" size={15} />
                      <span className="pb-terms__label">{o.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="pb-terms__part" ref={(el) => { parts.current[2] = el; }}>
            <PartHead n={3} title="What is at stake" />
            <Card>
              <Meter
                size="lg"
                label="Board confidence"
                valueText={<>{coach.security}<small>/100 · {confidence.word}</small></>}
                value={coach.security}
                max={100}
                tone={confidence.tone}
                ariaValueText={`${coach.security} of 100, ${confidence.word}`}
                markers={[
                  { at: SECURITY_REVIEW, text: <><b>{SECURITY_REVIEW}</b> Review</> },
                  // Nudged right of centre, as drawn: two captions centred
                  // twenty points apart meet on a 360px phone.
                  { at: SECURITY_SECURE, text: <span className="pb-terms__tickright"><b>{SECURITY_SECURE}</b> Secure</span> },
                ]}
              />
              <div className="pb-terms__stakes">
                <div><small>Hit every required target</small><b className="pb-tone--positive">Confidence goes up</b></div>
                <div><small>Miss any of them</small><b className="pb-tone--warning">Confidence drops</b></div>
              </div>
              <p className="pb-terms__fine">
                Fall below {SECURITY_REVIEW} and your job is under review at season’s end. {contractLine(coach.contractYears)}
              </p>
            </Card>
          </section>
        </div>
      </div>

      {/*
        One height in every state (the stable-layout rule): the note keeps its
        line whether it says "read all three parts" or "all terms read", and
        Push back leaving takes a column, not a row. Its two halves sit on one
        line where the bar is wide enough for both and stack where it is not,
        which the width decides and never the state (see terms.css).
      */}
      <ActionBar
        className={cx('pb-terms__bar', canArgue && 'has-two')}
        note={(
          <span className="pb-terms__note">
            <span>{target} wins · {required.length} must-hit · {bonus.length} extra credit</span>
            <span className={cx('pb-terms__status', read && 'is-read')} aria-live="polite">
              {read ? 'All terms read' : 'Read all three parts to sign'}
            </span>
          </span>
        )}
      >
        {canArgue && <Button variant="secondary" disabled={!read} onClick={pushBack}>Push back</Button>}
        <Button variant="primary" disabled={!read} onClick={signNow}>
          {read ? 'Sign and open the season' : 'Keep reading to sign'}
        </Button>
      </ActionBar>
    </div>
  );
}

function PartHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="pb-terms__parthead">
      <span className="pb-terms__num" aria-hidden>{n}</span>
      <h2>{title}</h2>
    </div>
  );
}

/**
 * Both names' prestige, last year against now. The kit's compare table, less
 * its "Change" heading: the pill says the change, and the review's table
 * leaves that column unheaded.
 */
function PrestigeMoves({ rows }: { rows: Array<{ label: string; before: number; after: number }> }) {
  return (
    <div className="pb-compare pb-terms__moves" role="table" aria-label="Prestige">
      <div className="pb-compare__row pb-compare__head" role="row">
        <span role="columnheader">Prestige, of 100</span>
        <span role="columnheader">Last year</span>
        <span role="columnheader">Now</span>
        <span role="columnheader"><span className="pb-sr">Change</span></span>
      </div>
      {rows.map((r) => {
        const d = r.after - r.before;
        return (
          <div key={r.label} className="pb-compare__row" role="row">
            <span className="pb-compare__label" role="rowheader">{r.label}</span>
            <span className="pb-compare__now" role="cell">{r.before}</span>
            <span className="pb-compare__next" role="cell">{r.after}</span>
            <span className="pb-compare__delta" role="cell">
              <Delta value={d} icon={false} text={d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0'} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The years left, counting this one. */
function contractLine(years: number): string {
  if (years < 1) return 'This is the last year of your contract.';
  return `${plural(years, 'year')} remain${years === 1 ? 's' : ''} on your contract.`;
}
