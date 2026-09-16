// BigMoment.tsx
// The full screen, for the nights that earn it — stage 14.
//
// Walk-offs, clinchers, and titles. Everything else in this game reports; the
// takeover celebrates, once, and hands the screen back on a tap. The loss
// tones are deliberately in here too: being walked off, and losing a final,
// are the two results a season is actually remembered by, and a game that
// only ever congratulates its player is a slot machine.

import { useEffect, useRef } from 'react';
import { useDynasty } from '../state/store.js';
import { InFrame } from './Overlay.js';
import { Crest, shade } from './Crest.js';
import { teamColour } from './Avatar.js';
import { burstConfetti } from './celebrate.js';
import { sfx, buzz, crowdSwell } from './sound.js';
import { useDialogFocus } from './dialogFocus.js';

const KICKER: Record<string, string> = {
  walkoff: 'WALK-OFF',
  'walkoff-against': 'WALKED OFF',
  cup: 'CONFERENCE CHAMPIONS',
  regional: 'REGIONAL CHAMPIONS',
  final4: 'THE SHOWDOWN IS YOURS',
  title: 'NATIONAL CHAMPIONS',
  'runner-up': 'RUNNER-UP',
};

const SENTENCE: Record<string, string> = {
  walkoff: 'wins it in the last at-bat.',
  'walkoff-against': 'ends it. There was no next at-bat.',
  cup: 'The banner goes up in your building.',
  regional: 'A ticket to the national twenty, punched on the field.',
  final4: 'Two teams left in the country. Yours is one.',
  title: 'Everything the program is for, and it happened this June.',
  'runner-up': 'The last series of the year went the other way.',
};

const BUTTON: Record<string, string> = {
  title: 'TAKE THE TROPHY',
  'walkoff-against': 'WALK IT OFF',
  'runner-up': 'CARRY IT HOME',
};

export function BigMomentCard() {
  const moment = useDynasty((s) => s.bigMoment);
  const clear = useDynasty((s) => s.clearBigMoment);
  const nudge = useDynasty((s) => s.cardNudge);
  const season = useDynasty((s) => s.season);
  const host = useRef<HTMLDivElement>(null);

  const loss = moment?.kind === 'walkoff-against' || moment?.kind === 'runner-up';
  const abbr = moment ? season?.teams[moment.team]?.def.abbr ?? '' : '';
  const school = moment ? season?.teams[moment.team]?.def.school ?? '' : '';
  // A blocking card is a dialog: focus lands on its one button, Escape
  // dismisses it, and nothing behind it can be tabbed to (05 §62.6).
  useDialogFocus(host, clear, { active: moment !== null, layer: false });

  /*
    The refused back press, made visible — the same contract `Modal` carries,
    written out here because this card has its own markup rather than using it.
    See `cardNudge` in the store for why the press is refused at all.
  */
  const nudgedAt = useRef(nudge);
  useEffect(() => {
    if (nudge === nudgedAt.current) return;
    nudgedAt.current = nudge;
    const el = host.current;
    if (!el) return;
    el.classList.remove('is-nudged');
    void el.offsetWidth;
    el.classList.add('is-nudged');
  }, [nudge]);

  /*
    The celebration happens exactly once, on mount. Confetti in the school's
    own colours, the clap track, and the only long buzz the app sends — all
    three skipped for the loss tones, which get silence and a dark room.
  */
  useEffect(() => {
    if (!moment || loss) return;
    const colour = teamColour(abbr);
    if (host.current) burstConfetti(host.current, [colour, '#f5efe0', shade(colour, 0.7)]);
    sfx('clap', { gain: 0.85 });
    buzz([40, 60, 140]);
    /*
      A national title is the biggest thing the game can hand over, and it
      read like a conference cup (2026-09-16: "right now it feels the same
      winning the conference, regionals or nationals"). Gold in the confetti,
      a second wave of it, the crowd up, the second clap, the longest buzz
      the app sends -- and the card itself wears gold (05 §91.4).
    */
    if (moment.kind === 'title') {
      const gold = ['#f2cf6b', '#d9b44a', colour, '#f5efe0'];
      const again = setTimeout(() => { if (host.current) burstConfetti(host.current, gold); }, 900);
      const more = setTimeout(() => { if (host.current) burstConfetti(host.current, gold); sfx('clap', { gain: 1 }); }, 1900);
      crowdSwell(1);
      buzz([60, 80, 200, 80, 320]);
      return () => { clearTimeout(again); clearTimeout(more); };
    }
    return undefined;
  }, [moment?.kind]);

  if (!moment) return null;
  const colour = teamColour(abbr);

  return (
    <InFrame>
      <div
        ref={host}
        role="dialog"
        aria-modal="true"
        aria-label={KICKER[moment.kind] ?? 'A big moment'}
        className={`big-moment${loss ? ' loss' : ''}${moment.kind === 'title' ? ' title' : ''}`}
        style={loss ? undefined : moment.kind === 'title' ? {
          background: `radial-gradient(ellipse at 50% 30%, ${shade(colour, 0.55)} 0%, #2a2210 55%, #0f0e08 100%)`,
        } : {
          background: `linear-gradient(168deg, ${shade(colour, 0.52)} 0%, #14160f 78%)`,
        }}
      >
        <div className="big-moment-card">
          {moment.kind === 'title' && (
            <svg className="title-trophy" viewBox="0 0 64 64" aria-hidden="true">
              <path fill="currentColor" d="M18 6h28v6h8v8c0 7-5 12-11 13-2 4-6 7-9 8v7h8v6H22v-6h8v-7c-3-1-7-4-9-8C15 32 10 27 10 20v-8h8V6zm-2 12h-2v2c0 4 3 7 6 8-2-3-3-6-4-10zm32 0c-1 4-2 7-4 10 3-1 6-4 6-8v-2h-2z" />
            </svg>
          )}
          <Crest abbr={abbr} size={92} />
          <small>{KICKER[moment.kind]}</small>
          <h1>{moment.name ?? school}</h1>
          <p>{SENTENCE[moment.kind]}</p>
          {moment.kind === 'title' && <em className="title-year">{moment.year}</em>}
          <b>{moment.line}{moment.kind === 'title' ? '' : ` · ${moment.year}`}</b>
        </div>
        <button type="button" onClick={clear}>
          {BUTTON[moment.kind] ?? 'CARRY ON'}
        </button>
      </div>
    </InFrame>
  );
}
