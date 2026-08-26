// CoachPoints.tsx
// What you got better at this year.
//
// Called "Coach" and not "Your staff": there is no staff in this game, there is
// you, and naming a screen after people who do not exist is the sort of thing
// that makes a player go looking for them.
//
// Four attributes, and every one of them is wired to something the engine
// already does — a skill tree whose branches do not change the simulation is a
// menu, not a decision. The screen says what each point actually buys, in the
// same terms the rest of the game uses, so the choice can be made on evidence
// rather than on which word sounds strongest.

import { useDynasty } from '../../state/store.js';
import { FixedHeader, FloatingAction } from '../Sticky.js';
import { SKILLS, SKILL_LABEL, SKILL_BLURB } from '../../engine/program.js';

export function CoachPoints() {
  const coach = useDynasty((s) => s.coach);
  const spend = useDynasty((s) => s.spendSkill);
  const refund = useDynasty((s) => s.refundSkill);
  const spentThisStep = useDynasty((s) => s.spentThisStep);
  const next = useDynasty((s) => s.nextPhase);
  const version = useDynasty((s) => s.version);
  void version;

  const left = coach.skillPoints;
  const back = SKILLS.reduce((n, k) => n + (spentThisStep[k] ?? 0), 0);

  return (
    <FixedHeader
      header={
        <div style={{ padding: '16px 14px 10px' }}>
          <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 8 }}>
            <div className="label">{coach.name} · YEAR {coach.tenure}</div>
            <div style={{
              font: "800 30px/0.95 var(--display)", marginTop: 5, textTransform: 'uppercase',
            }}>Coach</div>
          </div>
        </div>
      }
    >
    <div style={{ padding: '12px 14px 24px' }}>
      <div style={{
        padding: '12px', background: 'var(--paper)',
        border: `1px solid ${left > 0 ? 'var(--clay)' : 'var(--faint)'}`,
        borderLeft: `3px solid ${left > 0 ? 'var(--clay)' : 'var(--faint)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            font: "800 30px/1 var(--display)",
            color: left > 0 ? 'var(--clay)' : 'var(--dim)',
          }}>{left}</span>
          <span style={{ font: "400 12px/1.4 var(--body)", color: 'var(--dim)' }}>
            {left > 0
              ? 'points to spend. They do not carry over well — a coach who never improves gets left behind.'
              : 'Nothing left to spend this year.'}
          </span>
        </div>
        {/* The undo, stated before it is needed rather than discovered after.
            Three points into the wrong skill is a thumb, not a decision, and
            the only moment that can be true is while the step is still open. */}
        {back > 0 && (
          <div style={{
            marginTop: 8, font: "400 11px/1.45 var(--body)", color: 'var(--dim)',
          }}>
            {back} point{back === 1 ? '' : 's'} put on this year can still come
            off. Once you continue, they are his.
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        {SKILLS.map((k) => {
          const value = coach.skills[k];
          const maxed = value >= 99;
          return (
            <div
              key={k}
              style={{
                marginBottom: 8, padding: '12px',
                border: '1px solid var(--faint)', background: 'var(--paper)',
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <span style={{
                  font: "700 12px var(--mono)", letterSpacing: '.1em',
                }}>{SKILL_LABEL[k]}</span>
                <span style={{ font: "700 20px/1 var(--display)" }}>{value}</span>
              </div>

              <div style={{ height: 6, background: 'rgba(28,36,48,.09)', marginTop: 6 }}>
                <div style={{
                  width: `${value}%`, height: '100%', background: 'var(--clay)',
                  transition: 'width 240ms ease',
                }} />
              </div>

              <div style={{
                marginTop: 7, font: "400 11.5px/1.45 var(--body)", color: 'var(--dim)',
              }}>{SKILL_BLURB[k]}</div>

              <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                {/* The undo sits beside the spend rather than at the bottom of
                    the screen, because the mistake it answers is made here, on
                    this card, and a control that fixes a specific thing belongs
                    next to the thing. Absent entirely until there is something
                    to take back. */}
                {(spentThisStep[k] ?? 0) > 0 && (
                  <button
                    onClick={() => refund(k)}
                    className="tap"
                    aria-label={`Take a point back off ${SKILL_LABEL[k]}`}
                    style={{
                      flex: 'none', padding: '10px 14px',
                      background: 'transparent',
                      border: '1px solid rgba(28,36,48,.42)',
                      color: 'var(--ink)',
                      font: "700 10px var(--mono)", letterSpacing: '.12em',
                    }}
                  >−1</button>
                )}
                <button
                  disabled={left <= 0 || maxed}
                  onClick={() => spend(k)}
                  style={{
                    flex: 1, padding: '10px 0',
                    background: left > 0 && !maxed ? 'var(--field)' : 'transparent',
                    border: `1px solid ${left > 0 && !maxed ? 'rgba(28,36,48,.42)' : 'rgba(28,36,48,.15)'}`,
                    color: left > 0 && !maxed ? 'var(--ink)' : 'rgba(28,36,48,.25)',
                    font: "700 10px var(--mono)", letterSpacing: '.12em',
                  }}
                >{maxed ? 'MAXED' : '+1 POINT'}</button>
              </div>
            </div>
          );
        })}
      </div>

      <FloatingAction
        label={left > 0 ? `CONTINUE · ${left} UNSPENT` : 'TO THE DRAFT'}
        onClick={() => void next('coach')}
      />
    </div>
    </FixedHeader>
  );
}
