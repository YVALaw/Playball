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
import { sfx, buzz } from './sound.js';

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
  const season = useDynasty((s) => s.season);
  const host = useRef<HTMLDivElement>(null);

  const loss = moment?.kind === 'walkoff-against' || moment?.kind === 'runner-up';
  const abbr = moment ? season?.teams[moment.team]?.def.abbr ?? '' : '';
  const school = moment ? season?.teams[moment.team]?.def.school ?? '' : '';

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
  }, [moment?.kind]);

  if (!moment) return null;
  const colour = teamColour(abbr);

  return (
    <InFrame>
      <div
        ref={host}
        className={`big-moment${loss ? ' loss' : ''}`}
        style={loss ? undefined : {
          background: `linear-gradient(168deg, ${shade(colour, 0.52)} 0%, #14160f 78%)`,
        }}
      >
        <div className="big-moment-card">
          <Crest abbr={abbr} size={92} />
          <small>{KICKER[moment.kind]}</small>
          <h1>{moment.name ?? school}</h1>
          <p>{SENTENCE[moment.kind]}</p>
          <b>{moment.line} · {moment.year}</b>
        </div>
        <button type="button" onClick={clear}>
          {BUTTON[moment.kind] ?? 'CARRY ON'}
        </button>
      </div>
    </InFrame>
  );
}
