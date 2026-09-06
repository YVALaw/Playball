// god/RecruitEditor.tsx — a recruit rewritten, and the class added to.
//
// `RecruitEditor` opens from the bolt on a recruiting file; `RecruitsEditor`
// from the bolt on the board's header and the Home tab's bolt, and it is a
// list of doors into the first.

import { useDynasty } from '../../state/store.js';
import { SectionHeading } from '../components/Kit.js';
import { RECRUIT_FACTOR_KEYS } from '../../engine/godMode.js';
import { RECRUITING_FACTOR_LABEL, recruitingPrioritiesOf, type Prospect } from '../../engine/recruiting.js';
import type { Hitter, Pitcher, PlayerId } from '../../engine/types.js';
import { Slider } from './controls.js';

const recruitSlot = (p: Prospect): string =>
  p.player.type === 'pitcher' ? (p.player as Pitcher).role : (p.player as Hitter).pos;

export function RecruitEditor({ id }: { id: PlayerId }) {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const userTeam = useDynasty((s) => s.userTeam);
  const setRecruitStars = useDynasty((s) => s.godSetRecruitStars);
  const setRecruitWants = useDynasty((s) => s.godSetRecruitWants);
  const commitRecruit = useDynasty((s) => s.godCommitRecruit);
  const closeGod = useDynasty((s) => s.closeGod);
  void version;
  const recruit = season?.recruiting.prospects.find((p) => p.id === id);
  const me = season?.teams[userTeam];
  if (!season || !recruit || !me) return <p className="god-note">He is not in this year's class.</p>;
  const wants = recruitingPrioritiesOf(recruit);
  const signed = recruit.signedBy !== null;

  return (
    <main className="module-workspace god-desk">
      <section className="god-card god-editor">
        <header>
          <small>#{recruit.rank} NATIONALLY · {recruitSlot(recruit)} · {recruit.state}</small>
          <strong>{recruit.player.name}</strong>
          <span className="god-ovr">{'★'.repeat(recruit.stars)}</span>
        </header>
        <Slider label="STARS" value={recruit.stars} min={1} max={5} onCommit={(v) => setRecruitStars(recruit.id, v)} />
        <div className="god-actions">
          <button
            type="button"
            className="tap"
            disabled={signed}
            onClick={() => { commitRecruit(recruit.id); closeGod(); }}
          >{signed ? (recruit.signedBy === userTeam ? 'COMMITTED TO YOU' : 'SIGNED ELSEWHERE') : `COMMIT TO ${me.def.school.toUpperCase()}`}</button>
        </div>
        <p className="god-note">The star gate is open in a sandbox: the board lets you chase anyone. Edit the man himself once he arrives in the fall.</p>
      </section>

      <SectionHeading kicker="THE RECRUIT" title="What he wants" />
      <section className="god-card">
        <p className="god-note">Shares of a hundred. Move one and the rest give way; what he wants is what the board sells against.</p>
        {RECRUIT_FACTOR_KEYS.map((f) => (
          <Slider
            key={f}
            label={RECRUITING_FACTOR_LABEL[f]}
            value={Math.round(wants[f] * 100)}
            min={0}
            max={100}
            onCommit={(v) => setRecruitWants(recruit.id, { [f]: v / 100 })}
          />
        ))}
      </section>
    </main>
  );
}

export function RecruitsEditor() {
  const season = useDynasty((s) => s.season);
  const version = useDynasty((s) => s.version);
  const addRecruit = useDynasty((s) => s.godAddRecruit);
  const openGod = useDynasty((s) => s.openGod);
  void version;
  if (!season) return null;
  const unsigned = season.recruiting.prospects
    .filter((p) => p.signedBy === null)
    .sort((a, b) => a.rank - b.rank);

  return (
    <main className="module-workspace god-desk">
      <section className="god-card">
        <div className="god-actions">
          <button type="button" className="tap" onClick={() => { const id = addRecruit('hitter'); if (id) openGod({ kind: 'recruit', id }); }}>ADD A BAT</button>
          <button type="button" className="tap" onClick={() => { const id = addRecruit('pitcher'); if (id) openGod({ kind: 'recruit', id }); }}>ADD AN ARM</button>
        </div>
        <label className="god-field">
          <small>RECRUIT · {unsigned.length} UNSIGNED</small>
          <select value="" onChange={(e) => { if (e.target.value) openGod({ kind: 'recruit', id: e.target.value as PlayerId }); }}>
            <option value="">Choose a recruit to edit</option>
            {unsigned.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.rank} {p.player.name} · {recruitSlot(p)} · {'★'.repeat(p.stars)} · {p.state}
              </option>
            ))}
          </select>
        </label>
        <p className="god-note">A new recruit arrives as a freshman with a home and a state, unsigned, at the bottom of the rankings. Every file on the board carries a bolt of its own.</p>
      </section>
    </main>
  );
}
