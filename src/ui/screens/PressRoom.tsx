// PressRoom.tsx
// The five minutes afterwards.
//
// Stage 7 piece 8, and the last screen the coach was missing. It borrows the
// interview's shape on purpose -- a dark block with the situation and the
// question in it, four answers under it -- because it is the same act two years
// later and a player who has done creation already knows how to read this.
//
// What it deliberately does *not* borrow is the badge preview. Creation shows
// what each answer moves because you are building a man out of them and the
// numbers are the point. Here the numbers are the consequence of saying a
// thing, and printing "+1 PRESTIGE" next to a sentence turns a press conference
// into a menu -- the player stops reading what he would say and starts reading
// the column. Which is also the note the project already holds about cards: a
// card is a visual telling of where you are, it does not explain.

import { useDynasty } from '../../state/store.js';
import { FixedHeader } from '../Sticky.js';
import type { PressAnswer, PressTrigger } from '../../data/pressers.js';

/** Why the room is here, in the room's words rather than the engine's. */
const WHY: Record<PressTrigger, string> = {
  bigWin: 'AFTER THE UPSET',
  badLoss: 'AFTER THE LOSS',
  losingStreak: 'DURING A BAD RUN',
  winningStreak: 'DURING A GOOD RUN',
  knockedOut: 'THE SEASON IS OVER',
  trophy: 'THE TROPHY',
  signingDay: 'SIGNING DAY',
  caughtLooking: 'THE LETTER',
  draftLoss: 'HE SIGNED',
};

export function PressRoom() {
  const pending = useDynasty((s) => s.pendingPress);
  const answer = useDynasty((s) => s.answerPress);
  const duck = useDynasty((s) => s.duckPress);
  const badges = useDynasty((s) => s.coach.badges);
  const year = useDynasty((s) => s.year);

  if (!pending) return null;
  const { presser, trigger } = pending;

  const say = (a: PressAnswer): void => { answer(a); };

  return (
    <FixedHeader
      header={
        <div style={{ padding: '12px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
            <div className="label">{WHY[trigger]} · {year}</div>
            <div style={{
              font: "800 calc(21px * var(--ts))/0.95 var(--display)",
              marginTop: 3, textTransform: 'uppercase',
            }}>The press room</div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '10px 14px 20px' }}>
        <div style={{
          padding: '12px 13px 13px',
          background: 'var(--navy)',
          borderLeft: '4px solid var(--clay)',
        }}>
          <div style={{
            font: "400 calc(12.5px * var(--ts))/1.55 var(--body)",
            color: 'var(--cream)',
          }}>{presser.setup}</div>
          <div style={{
            marginTop: 9,
            font: "800 calc(16px * var(--ts))/1.15 var(--display)",
            textTransform: 'uppercase', color: 'var(--cream)',
          }}>{presser.ask}</div>
        </div>

        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {presser.answers.map((a) => {
            /*
              The one mark on an answer, and it is about him rather than about
              points: this is a thing he is known for saying.

              It earns its place where a number would not. A coach wearing the
              badge is being told "this is you", which is exactly the payoff
              the personality badges were built for -- and it says nothing
              about whether the answer is *good*, so it guides without turning
              the four of them into a ranking.
            */
            const known = a.badge !== undefined && (badges ?? []).includes(a.badge);
            return (
              <button
                key={a.text}
                className="tap"
                onClick={() => say(a)}
                style={{
                  textAlign: 'left', padding: '11px 12px', minHeight: 48,
                  background: 'var(--paper)',
                  border: known ? '1px solid var(--you)' : '1px solid rgba(var(--ink-rgb), .3)',
                  boxShadow: '0 1px 0 rgba(var(--ink-rgb), .14)',
                }}
              >
                <div style={{
                  font: "400 calc(12.5px * var(--ts))/1.45 var(--body)", color: 'var(--ink)',
                }}>{a.text}</div>
                {known && (
                  <div style={{
                    marginTop: 5,
                    font: "600 calc(8px * var(--ts)) var(--mono)",
                    letterSpacing: '.12em', color: 'var(--you)',
                  }}>SOUNDS LIKE YOU</div>
                )}
              </button>
            );
          })}
        </div>

        <button
          className="tap"
          onClick={duck}
          style={{
            marginTop: 12, width: '100%', padding: '10px 12px', minHeight: 40,
            background: 'transparent',
            border: '1px solid rgba(var(--ink-rgb), .28)',
            font: "700 calc(9.5px * var(--ts)) var(--mono)",
            letterSpacing: '.12em', color: 'var(--dim)',
          }}
        >SAY NOTHING</button>

        <div style={{
          marginTop: 10,
          font: "400 calc(10.5px * var(--ts))/1.5 var(--body)", color: 'var(--dim)',
        }}>
          No answer here is wrong. What you say moves your name, and your name
          is what recruits and other programs hear before they hear anything else.
        </div>
      </div>
    </FixedHeader>
  );
}
