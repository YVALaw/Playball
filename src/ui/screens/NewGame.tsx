// NewGame.tsx
// Starting a career: who you are, how much you handle, what you did before,
// how your teams play, and where you work.
//
// Two ideas drive the last step.
//
// The first is that a star count tells you almost nothing. Two three-star
// programs can be completely different jobs, and what decides which is which is
// the gap between what the school *is* and what its roster can *do* this year.
// So an offer says all of it: reputation, current talent, the board's mandate in
// its own words, and how long they are giving you.
//
// The second is that you cannot have any job you like. A contender does not
// hand its program to someone who has never run one, so the last step is the
// handful of programs that would call a first-time head coach, picked by
// `startingOffers` with at least one guaranteed, rather than a directory of
// ninety-six schools you page through finding out which would take the call.
//
// The first step arrives filled in and is one press for anyone who came to
// coach rather than fill in a form. The second is not a difficulty setting and
// says so: the engine plays out all ninety-six programs the same either way,
// and the answer only moves how much lands on your desk. The fourth picks a
// coach's approach rather than five strategy settings: the strategy screen is
// where those are argued one at a time, and all of them stay editable there.

import { useMemo, useState, type ReactNode } from 'react';
import {
  CONFERENCES, STATES_BY_REGION, type SchoolDef,
} from '../../data/schools.js';
import {
  prestigeStars, contractFor, leagueShape, playerBoard, requiredCoachPrestige,
  canBeHired, hireGateNote, ROOKIE_PRESTIGE, rosterStrength, startingOffers, offerPitch,
  randomProfile, clampAge, DEFAULT_LOOK, MIN_COACH_AGE, MAX_COACH_AGE, SKILLS,
  type CoachProfile, type CoachLook, type Mandate,
} from '../../engine/program.js';
import {
  PHILOSOPHIES, philosophyOf, DEFAULT_PHILOSOPHY, strategyForPhilosophy,
  type PhilosophyId,
} from '../../engine/strategy.js';
import { useDynasty, careerSeed } from '../../state/store.js';
import { SYSTEMS, type DepthMode } from '../../state/depth.js';
import { readPrefs } from '../../state/devicePrefs.js';
import {
  CoachPortrait, COACH_SKIN, COACH_HAIR, CUT_LABEL, BEARD_LABEL,
} from '../CoachPortrait.js';
import {
  createSeason, seasonLength, DEFAULT_RULES, SEASON_SPANS, type SeasonRules,
} from '../../engine/season.js';
import { makeRng } from '../../engine/rng.js';
import { cultureOf, CULTURE_LABEL } from '../../data/cultures.js';
import { BACKGROUNDS, type BackgroundId } from '../../data/backgrounds.js';
import { badgeOf } from '../../data/badges.js';
import { Crest } from '../Crest.js';
import { StepRail } from '../StepRail.js';
import { StepScreen } from './OffseasonStep.js';
import { policyWords } from './StrategyScreen.js';
import {
  ActionBar, Button, Callout, Card, Chip, Chips, DescriptionList, List, ListRow, OptionCard, OptionGroup,
  ScreenHeader, SectionHeader, SegmentedControl, Sheet, StatGroup, StatusBadge, Stars, Stepper, Switch, Tag, TextField,
} from '../components/ui/index.js';
import { capsWords, conferenceName, plural, stateName } from '../words.js';

const MANDATE_WORDS: Record<Mandate, string> = {
  develop: 'Develop players',
  build: 'Rebuild',
  compete: 'Compete',
  contend: 'Contend',
  championship: 'Win it all',
};

const SKILL_WORDS: Record<string, string> = {
  offense: 'Offense', defense: 'Defense', training: 'Training', recruiting: 'Recruiting',
};

/** The coach's look, in words a person uses. */
const CUT_WORDS: Record<string, string> = { BALD: 'Bald', SHORT: 'Short', PART: 'Parted', CURLS: 'Curls', LONG: 'Long' };
const BEARD_WORDS: Record<string, string> = { CLEAN: 'Clean shaven', STUBBLE: 'Stubble', TASH: 'Mustache', FULL: 'Full beard' };

/**
 * What kind of program this is, read off the gap between name and roster: the
 * difference between a job that is hard because it is good and a job that is
 * hard because it is not.
 */
function archetype(prestige: number, quality: number): string | null {
  const gap = prestige - quality;
  // A giant has to actually be sleeping. The gap alone is not enough, because a
  // 78 prestige school sits so far above the scale that a good roster still
  // trails its name by a dozen points — which briefly had the best team in the
  // Gulf labelled a rebuild.
  if (gap >= 12 && prestige >= 50) return 'Sleeping giant';
  if (gap <= -12) return 'On the rise';
  if (prestige >= 60) return 'Perennial power';
  if (prestige <= 34) return 'Rebuild';
  return null;
}

/** The steps, named, so the rail can say where you are. */
const STEP_NAMES = ['Coach', 'Control', 'Background', 'Approach', 'Offers'] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4;

export function NewGame({ onExit }: { onExit?: () => void } = {}) {
  const start = useDynasty((s) => s.start);
  const [picked, setPicked] = useState<SchoolDef | null>(null);

  /**
   * This career's seed, drawn once when the screen opens.
   *
   * The same number previews the world and starts it, and that is the whole
   * point: the rosters on this screen have to be the rosters you get.
   */
  const [seed] = useState(careerSeed);

  // Drawn off the career seed rather than the clock, so the suggestion is the
  // same man every render of the same career.
  const suggestion = useMemo(() => randomProfile(makeRng(seed ^ 0x5eed)), [seed]);
  const [coach, setCoach] = useState<CoachProfile>(suggestion);
  const [step, setStepState] = useState<StepIndex>(0);
  const [furthest, setFurthest] = useState<number>(0);
  const setStep = (n: StepIndex): void => {
    setStepState(n);
    setFurthest((f) => Math.max(f, n));
  };
  // How deep a game this career is. Held here rather than written to the store
  // because no career exists yet; it is handed to `start` with the rest.
  const [mode, setMode] = useState<DepthMode>('full');
  // God mode, for this career. Offered only on a device that owns it.
  const godOwned = readPrefs().godMode;
  const [godMode, setGodMode] = useState(false);
  const [backgroundId, setBackgroundId] = useState<BackgroundId>('player');
  // The rules of the world: defaults, behind a fold, handed to `start` and never
  // written again (see `SeasonRules`).
  const [rules, setRules] = useState<SeasonRules>(DEFAULT_RULES);

  // Build the actual world, not an estimate of it. Generation is deterministic
  // from the seed and cheap, so the screen reads the rosters the player gets:
  // an estimate once advertised a job as Compete that signed as Contend.
  const world = useMemo(() => createSeason(makeRng(seed), undefined, CONFERENCES), [seed]);

  const rosters = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of world.teams) map.set(t.def.abbr, rosterStrength(t.team));
    return map;
  }, [world]);

  const indexOf = (school: SchoolDef): number =>
    Math.max(0, world.teams.findIndex((t) => t.def.abbr === school.abbr));

  const rosterOf = (school: SchoolDef): number =>
    rosters.get(school.abbr) ?? school.quality;

  const preview = (school: SchoolDef) => {
    const roster = rosterOf(school);
    // The same call the board stamps on day one (playerBoard with the league
    // shape and the school's patience), so the offer and the board agree on
    // how many wins they want.
    const record = world.teams[indexOf(school)];
    return {
      roster,
      stars: prestigeStars(school.prestige),
      contract: contractFor(school.prestige),
      expectation: playerBoard(
        school.prestige, roster, seasonLength(world.config),
        record?.culture?.patience, leagueShape(world.teams),
      ).expectation,
      open: canBeHired(ROOKIE_PRESTIGE, school.prestige, roster),
      needs: requiredCoachPrestige(school.prestige, roster),
      gate: hireGateNote(ROOKIE_PRESTIGE, school.prestige, roster),
      tag: archetype(school.prestige, roster),
    };
  };

  const rivalOf = (school: SchoolDef): SchoolDef | undefined =>
    CONFERENCES.flatMap((c) => c.schools).find((s) => s.abbr === school.rival);

  const confNameOf = (school: SchoolDef): string => {
    const conf = CONFERENCES.find((c) => c.schools.some((s) => s.abbr === school.abbr));
    return conf ? conferenceName(conf.id) : '';
  };

  /** The programs that actually rang, shaped by the background you chose. */
  const background = BACKGROUNDS.find((b) => b.id === backgroundId) ?? BACKGROUNDS[0]!;
  const outcome = useMemo(() => ({
    skills: background.skills, leans: background.leans, ambition: background.ambition,
    badges: background.badges, grants: [] as string[],
  }), [background]);

  const offers = useMemo(
    () => {
      const picks = startingOffers(world.teams, 5, {
        leans: outcome.leans,
        ambition: outcome.ambition,
        // Seeded off the career and the answers together, so the wobble is
        // fixed for a given man rather than reshuffling every render.
        rng: makeRng(seed ^ 0x0ffe4 ^ BACKGROUNDS.findIndex((b) => b.id === backgroundId)),
      });
      return picks.map((i) => world.teams[i]!.def);
    },
    [world, outcome, seed, backgroundId],
  );

  const rail = (
    <StepRail
      label="New career steps"
      steps={STEP_NAMES.map((label) => ({ key: label, label }))}
      at={step}
      furthest={furthest}
      onGo={(key) => setStep(STEP_NAMES.indexOf(key as typeof STEP_NAMES[number]) as StepIndex)}
    />
  );
  const bar = (label: string, onClick: () => void, note?: string) => (
    <ActionBar note={note}>
      <Button variant="primary" iconAfter="arrow-right" onClick={onClick}>{label}</Button>
    </ActionBar>
  );

  if (step === 0) {
    return (
      <Identity
        rail={rail}
        profile={coach}
        onChange={setCoach}
        onExit={onExit}
        bar={bar('Continue', () => {
          // A blank name is not a name: the suggested one comes back.
          const name = coach.name.trim();
          if (name !== coach.name || name.length === 0) {
            setCoach({ ...coach, name: name.length > 0 ? name : suggestion.name });
          }
          setStep(1);
        })}
      />
    );
  }

  if (step === 1) {
    return (
      <DepthStep
        rail={rail}
        chosen={mode}
        onChoose={setMode}
        godOwned={godOwned}
        god={godMode}
        onGod={setGodMode}
        rules={rules}
        onRules={setRules}
        onBack={() => setStep(0)}
        bar={bar('Continue', () => setStep(2))}
      />
    );
  }

  if (step === 2) {
    return (
      <BackgroundStep
        rail={rail}
        chosen={backgroundId}
        onChoose={setBackgroundId}
        onBack={() => setStep(1)}
        bar={bar('Continue', () => setStep(3))}
      />
    );
  }

  if (step === 3) {
    return (
      <PlayStyle
        rail={rail}
        chosen={coach.philosophy ?? DEFAULT_PHILOSOPHY}
        onChoose={(philosophy) => setCoach({ ...coach, philosophy })}
        onBack={() => setStep(2)}
        bar={bar('See who is hiring', () => setStep(4))}
      />
    );
  }

  const detail = picked ? preview(picked) : null;
  const rival = picked ? rivalOf(picked) : undefined;
  const culture = picked ? cultureOf(picked.abbr) : undefined;
  const record = picked ? world.teams.find((t) => t.def.abbr === picked.abbr) : undefined;

  return (
    <StepScreen top={rail}>
      <main className="pb-page">
        <ScreenHeader
          back={{ label: 'Back', onClick: () => setStep(3) }}
          eyebrow="New career"
          title="Take a job"
        />

        {/*
          Who you are, above the offers. The steps behind this one are otherwise
          invisible from here, and coach prestige is the number that decided
          which of these doors opened at all.
        */}
        <Card
          eyebrow="Your coach"
          title={coach.name}
          trailing={<Button size="sm" variant="quiet" icon="pencil" onClick={() => setStep(0)}>Edit</Button>}
        >
          <p className="pb-text-muted">
            Age {coach.age} · from {stateName(coach.homeState)} · {capsWords(philosophyOf(coach.philosophy ?? DEFAULT_PHILOSOPHY).name)} · {background.title.toLowerCase()}
          </p>
          <StatGroup
            size="sm"
            items={[
              { label: 'Coach prestige', value: ROOKIE_PRESTIGE, unit: '/100', note: 'A first-time head coach' },
              { label: 'Control', value: mode === 'full' ? 'Full career' : 'Casual' },
            ]}
          />
          {background.badges.length > 0 && (
            <div className="pb-cluster">
              {background.badges.map((id) => badgeOf(id)).map((b) => b && <Tag key={b.id} tone="positive">{b.name}</Tag>)}
            </div>
          )}
        </Card>

        <section>
          <SectionHeader title="Offers" count={offers.length} />
          <List label="Offers">
            {offers.map((school) => {
              const o = preview(school);
              return (
                <ListRow
                  key={school.abbr}
                  lead={<Crest abbr={school.abbr} size={40} />}
                  title={school.school}
                  subtitle={`${confNameOf(school)} · ${o.contract}-year contract · roster ${o.roster} of 100`}
                  status={o.open
                    ? <span className="pb-cluster"><Stars value={o.stars} label="Program prestige" /><StatusBadge tone="info" icon={false}>Goal: {MANDATE_WORDS[o.expectation.mandate].toLowerCase()}</StatusBadge></span>
                    : <span className="pb-cluster"><Stars value={o.stars} label="Program prestige" /><StatusBadge tone="neutral" icon="lock">Not open to you yet</StatusBadge></span>}
                  onClick={() => setPicked(school)}
                />
              );
            })}
          </List>
        </section>
      </main>

      {picked && detail && (
        <Sheet
          eyebrow={`${confNameOf(picked)}${detail.tag ? ` · ${detail.tag}` : ''}`}
          title={picked.school}
          subtitle={picked.nickname}
          lead={<Crest abbr={picked.abbr} size={48} />}
          onClose={() => setPicked(null)}
          tall
          footer={detail.open ? (
            <Button
              variant="primary"
              block
              iconAfter="arrow-right"
              onClick={() => start(seed, indexOf(picked), coach, mode, {
                skills: outcome.skills,
                badges: outcome.badges,
                leans: outcome.leans,
              }, godMode, rules)}
            >Take the {picked.school} job</Button>
          ) : (
            <Button variant="secondary" block onClick={() => setPicked(null)}>Back to the offers</Button>
          )}
        >
          <StatGroup
            size="sm"
            items={[
              { label: 'Prestige', value: <Stars value={detail.stars} label="Program prestige" />, note: `${picked.prestige} of 100` },
              { label: 'Roster', value: detail.roster, unit: '/100', note: 'Average starter rating' },
              { label: 'Contract', value: plural(detail.contract, 'year') },
              { label: 'Board wants', value: plural(detail.expectation.targetWins, 'win'), note: 'In year one' },
            ]}
          />
          {!detail.open && (
            <Callout tone="neutral" icon="lock" title="Not open to you yet">
              They want a coach with prestige {detail.needs}; yours is {ROOKIE_PRESTIGE}. {detail.gate}
            </Callout>
          )}
          <Card eyebrow="Year one" title={MANDATE_WORDS[detail.expectation.mandate]}>
            <p className="pb-text">{detail.expectation.summary}</p>
            {rival && <p className="pb-text-muted">Rivalry: {rival.school}, three times a year.</p>}
          </Card>
          <Card eyebrow="The job" title={detail.tag ?? 'The program'}>
            <p className="pb-text">
              {picked.prestige - picked.quality >= 12
                ? 'The name is ahead of the roster. Expectations arrive before the depth does.'
                : picked.quality - picked.prestige >= 12
                  ? 'The roster is ahead of the name. There is a window here right now.'
                  : picked.prestige >= 60
                    ? 'A strong program that expects to stay strong.'
                    : 'A blank canvas. Whatever this becomes, you build it.'}
            </p>
          </Card>
          {culture && (
            <Card eyebrow="The place" title={`Known for ${capsWords(CULTURE_LABEL[culture.edge]).toLowerCase()}`}>
              <p className="pb-text">{culture.creed}</p>
              {record && <p className="pb-text-muted">&ldquo;{offerPitch(record, { leans: outcome.leans, ambition: outcome.ambition })}&rdquo;</p>}
            </Card>
          )}
        </Sheet>
      )}
    </StepScreen>
  );
}

/**
 * Step one: who the career belongs to, and what he looks like.
 *
 * The fields arrive filled in with a plausible coach, so the whole step is one
 * press for anybody who came to coach rather than fill in a form: nothing is
 * required, nothing is validated, and the button is always live. The age
 * bounds are the only rule here, and they are about the fiction.
 */
/** Exported for the successor screen, which asks the same two questions. */
export function Identity(
  { rail, profile, onChange, onExit, bar }: {
    rail: ReactNode;
    profile: CoachProfile;
    onChange: (p: CoachProfile) => void;
    onExit?: () => void;
    bar: ReactNode;
  },
) {
  const set = <K extends keyof CoachProfile>(key: K, value: CoachProfile[K]): void =>
    onChange({ ...profile, [key]: value });
  const look = profile.look ?? DEFAULT_LOOK;
  const setLook = (part: Partial<CoachLook>): void => set('look', { ...look, ...part });

  return (
    <StepScreen top={rail} bar={bar}>
      <main className="pb-page">
        <ScreenHeader
          back={onExit ? { label: 'Main menu', onClick: onExit } : undefined}
          eyebrow="New career"
          title="Your coach"
        />

        <Card>
          <div className="pb-coachbuild">
            <span className="pb-coachbuild__portrait"><CoachPortrait look={look} size={112} /></span>
            <div className="pb-coachbuild__fields">
              <TextField
                label="Name"
                value={profile.name}
                maxLength={26}
                onChange={(e) => set('name', e.target.value)}
              />
              <Stepper
                label="Age"
                value={profile.age}
                min={MIN_COACH_AGE}
                max={MAX_COACH_AGE}
                onChange={(v) => set('age', clampAge(v))}
              />
            </div>
          </div>
          <label className="pb-field">
            <span className="pb-field__label">Home state</span>
            <select
              className="pb-field__input pb-select"
              value={profile.homeState}
              onChange={(e) => set('homeState', e.target.value)}
            >
              {Object.entries(STATES_BY_REGION).map(([region, states]) => (
                <optgroup key={region} label={region}>
                  {states.map((st) => <option key={st} value={st}>{stateName(st)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </Card>

        <Card title="Appearance">
          <div className="pb-lookrow">
            <span className="pb-lookrow__label">Skin tone</span>
            <div className="pb-swatches" role="radiogroup" aria-label="Skin tone">
              {COACH_SKIN.map((c, i) => (
                <Swatch key={c} colour={c} on={look.skin === i}
                  label={`Skin tone ${i + 1} of ${COACH_SKIN.length}`} onClick={() => setLook({ skin: i })} />
              ))}
            </div>
          </div>
          <div className="pb-lookrow">
            <span className="pb-lookrow__label">Hair color</span>
            <div className="pb-swatches" role="radiogroup" aria-label="Hair color">
              {COACH_HAIR.map((c, i) => (
                <Swatch key={c} colour={c} on={look.hair === i}
                  label={`Hair color ${i + 1} of ${COACH_HAIR.length}`} onClick={() => setLook({ hair: i })} />
              ))}
            </div>
          </div>
          <div className="pb-lookrow">
            <span className="pb-lookrow__label">Hair</span>
            <Chips label="Hair" className="pb-chips--wrap">
              {CUT_LABEL.map((word, i) => (
                <Chip key={word} selected={look.cut === i} onClick={() => setLook({ cut: i })}>{CUT_WORDS[word] ?? capsWords(word)}</Chip>
              ))}
            </Chips>
          </div>
          <div className="pb-lookrow">
            <span className="pb-lookrow__label">Facial hair</span>
            <Chips label="Facial hair" className="pb-chips--wrap">
              {BEARD_LABEL.map((word, i) => (
                <Chip key={word} selected={look.beard === i} onClick={() => setLook({ beard: i })}>{BEARD_WORDS[word] ?? capsWords(word)}</Chip>
              ))}
            </Chips>
          </div>
        </Card>
      </main>
    </StepScreen>
  );
}

/**
 * The systems the control step previews. The built ones only: a chip for a
 * system that ships later would promise a control the settings screen greys.
 */
const DESK_KEYS: readonly string[] = [
  'lineups', 'bullpen', 'moundVisits', 'depthChart', 'redshirts',
  'captains', 'recruiting', 'draftTalk', 'skillPoints',
];

/**
 * One rule of the world, and the answers it takes. The game counts come from
 * `seasonLength` over the schedules themselves, so this screen and a season
 * cannot disagree about how long a season is.
 */
interface RuleRow {
  key: string;
  label: string;
  options: readonly { value: string; label: string; note: string }[];
  at: (r: SeasonRules) => string;
  set: (r: SeasonRules, v: string) => SeasonRules;
}

const RULE_ROWS: readonly RuleRow[] = [
  {
    key: 'injuries',
    label: 'Injuries',
    options: [
      { value: 'on', label: 'Full', note: 'The normal rate. A bad one can cost a player a season.' },
      { value: 'reduced', label: 'Half', note: 'The same injuries, half as often.' },
      { value: 'off', label: 'None', note: 'Nobody misses a game.' },
    ],
    at: (r) => r.injuries,
    set: (r, v) => ({ ...r, injuries: v as SeasonRules['injuries'] }),
  },
  {
    key: 'portal',
    label: 'Transfer portal',
    options: [
      { value: 'on', label: 'On', note: 'Players leave for other programs, and others arrive.' },
      { value: 'off', label: 'Off', note: 'Nobody transfers, and the portal step is gone.' },
    ],
    at: (r) => (r.portal ? 'on' : 'off'),
    set: (r, v) => ({ ...r, portal: v === 'on' }),
  },
  {
    key: 'realignment',
    label: 'Conference realignment',
    options: [
      { value: 'on', label: 'On', note: 'Conferences trade programs each winter.' },
      { value: 'off', label: 'Off', note: 'The conferences you start with stay as they are.' },
    ],
    at: (r) => (r.realignment ? 'on' : 'off'),
    set: (r, v) => ({ ...r, realignment: v === 'on' }),
  },
  {
    key: 'poaching',
    label: 'Assistants hired away',
    options: [
      { value: 'on', label: 'On', note: 'A good assistant can be hired to run his own program.' },
      { value: 'off', label: 'Off', note: 'Staffs stay where they are.' },
    ],
    at: (r) => (r.poaching ? 'on' : 'off'),
    set: (r, v) => ({ ...r, poaching: v === 'on' }),
  },
  {
    key: 'length',
    label: 'Season length',
    options: [
      {
        value: 'short',
        label: `${seasonLength(SEASON_SPANS.short)} games`,
        // Three men start in a week, but the staff is still four: the fourth
        // is depth, as the lineup screen labels him.
        note: 'Two-game weekends, three starters and a spare.',
      },
      {
        value: 'standard',
        label: `${seasonLength(SEASON_SPANS.standard)} games`,
        note: 'Three-game weekends and a four-man rotation.',
      },
      {
        value: 'long',
        label: `${seasonLength(SEASON_SPANS.long)} games`,
        note: 'Four-game weekends and a five-man rotation.',
      },
    ],
    at: (r) => r.length,
    set: (r, v) => ({ ...r, length: v as SeasonRules['length'] }),
  },
  // Last, and apart: the rules above are the world's, this one is your job's.
  // See `SeasonRules.firing` for why it is a rule of the world at all.
  {
    key: 'firing',
    label: 'Getting fired',
    options: [
      { value: 'on', label: 'On', note: 'Miss the board’s goals for long enough and you lose the job.' },
      { value: 'off', label: 'Off', note: 'The board grades you but can never fire you.' },
    ],
    at: (r) => (r.firing ? 'on' : 'off'),
    set: (r, v) => ({ ...r, firing: v === 'on' }),
  },
];

/**
 * The rules of the world, folded away: the defaults are the game, and almost
 * nobody wants to argue with them on the way to a first job. The heading says
 * how many were changed, so a career started on anything else says so.
 */
function WorldRules(
  { rules, onRules }: { rules: SeasonRules; onRules: (r: SeasonRules) => void },
) {
  const [open, setOpen] = useState(false);
  const changed = RULE_ROWS.filter((row) => row.at(rules) !== row.at(DEFAULT_RULES)).length;
  return (
    <Card
      eyebrow="The rules of the world"
      title={changed === 0 ? 'Standard rules' : `${plural(changed, 'rule')} changed`}
      trailing={(
        <Button size="sm" variant="quiet" iconAfter="chevron-down" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Change'}
        </Button>
      )}
    >
      <p className="pb-text-muted">
        These cannot be changed later.
      </p>
      {open && RULE_ROWS.map((row) => {
        const at = row.at(rules);
        const note = row.options.find((o) => o.value === at)?.note ?? '';
        return (
          <div className="pb-rulerow" key={row.key}>
            <span className="pb-rulerow__label">{row.label}</span>
            <SegmentedControl<string>
              kind="radio"
              label={row.label}
              value={at}
              onChange={(v) => onRules(row.set(rules, v))}
              options={row.options.map((o) => ({ value: o.value, label: o.label }))}
            />
            <span className="pb-text-muted">{note}</span>
          </div>
        );
      })}
    </Card>
  );
}

/**
 * Step two: how much of the game you want to be asked about. It frames the
 * rest, so it comes early, and it is not a difficulty menu: nothing here makes
 * the game easier or the world smaller.
 */
function DepthStep(
  { rail, chosen, onChoose, godOwned, god, onGod, rules, onRules, onBack, bar }: {
    rail: ReactNode;
    chosen: DepthMode;
    onChoose: (m: DepthMode) => void;
    /** The device owns god mode, so the sandbox switch is offered. */
    godOwned: boolean;
    god: boolean;
    onGod: (on: boolean) => void;
    rules: SeasonRules;
    onRules: (r: SeasonRules) => void;
    onBack: () => void;
    bar: ReactNode;
  },
) {
  const cards: { id: DepthMode; title: string; line: string }[] = [
    {
      id: 'full', title: 'Full career',
      line: 'Every decision is yours: you write the lineup, work the bullpen inning by inning, and get asked about everything.',
    },
    {
      id: 'casual', title: 'Casual',
      line: 'Your staff handles the routine and you handle the season. Recruiting, the draft and the big calls stay yours.',
    },
  ];
  // What the chosen style moves, read off the same SYSTEMS table the settings
  // screen enforces, so this preview and the career it starts cannot disagree.
  const shown = SYSTEMS.filter((sys) => DESK_KEYS.includes(sys.key));
  const desk = chosen === 'full' ? shown : shown.filter((sys) => sys.casual);
  const staff = chosen === 'full' ? [] : shown.filter((sys) => !sys.casual);

  return (
    <StepScreen top={rail} bar={bar}>
      <main className="pb-page">
        <ScreenHeader
          back={{ label: 'Back', onClick: onBack }}
          eyebrow="New career"
          title="How much you handle"
        />

        <OptionGroup label="How much you handle">
          {cards.map((c) => (
            <OptionCard key={c.id} title={c.title} hint={c.line} selected={c.id === chosen} onSelect={() => onChoose(c.id)} />
          ))}
        </OptionGroup>

        <Card title="You handle" eyebrow={chosen === 'full' ? 'Everything' : 'The big calls'}>
          <div className="pb-cluster">
            {desk.map((sys) => <Tag key={sys.key}>{sys.label}</Tag>)}
          </div>
          {staff.length > 0 && (
            <>
              <span className="pb-eyebrow">Your staff handles</span>
              <div className="pb-cluster">
                {staff.map((sys) => <Tag key={sys.key}>{sys.label}</Tag>)}
              </div>
            </>
          )}
        </Card>

        {/* The sandbox, for a device that bought it. Per career, never cleared. */}
        {godOwned && (
          <List label="God mode">
            <Switch
              label="God mode in this career"
              description="Edit anything. Records still count."
              checked={god}
              onChange={() => onGod(!god)}
            />
          </List>
        )}

        <WorldRules rules={rules} onRules={onRules} />
      </main>
    </StepScreen>
  );
}

/**
 * A colour, shown as itself. The chosen one is marked with a ring drawn inside
 * the swatch, so selecting does not change its size under your thumb.
 */
function Swatch(
  { colour, on, onClick, label }:
  { colour: string; on: boolean; onClick: () => void;
    /** What a screen reader says. A hex code spoken aloud is not a colour. */
    label: string },
) {
  return (
    <button
      className={`pb-swatch-btn${on ? ' is-selected' : ''}`}
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      aria-label={label}
      style={{ background: colour }}
    />
  );
}

/** Exported for the successor screen. See `screens/Legacy.tsx`. */
export function BackgroundStep(
  { rail, chosen, onChoose, onBack, bar }: {
    rail: ReactNode;
    chosen: BackgroundId;
    onChoose: (id: BackgroundId) => void;
    onBack: () => void;
    bar: ReactNode;
  },
) {
  const picked = BACKGROUNDS.find((b) => b.id === chosen) ?? BACKGROUNDS[0]!;
  const top = Math.max(...SKILLS.map((k) => picked.skills[k]));
  return (
    <StepScreen top={rail} bar={bar}>
      <main className="pb-page">
        <ScreenHeader
          back={{ label: 'Back', onClick: onBack }}
          eyebrow="New career"
          title="Before the dugout"
        />
        <OptionGroup label="Your background">
          {BACKGROUNDS.map((b) => (
            <OptionCard key={b.id} title={b.title} hint={b.blurb} selected={chosen === b.id} onSelect={() => onChoose(b.id)} />
          ))}
        </OptionGroup>

        <Card eyebrow="Your first-year strengths" title={picked.title}>
          <DescriptionList
            items={SKILLS.map((k) => ({
              label: SKILL_WORDS[k] ?? capsWords(k),
              value: `${picked.skills[k]} of 99`,
              tone: picked.skills[k] === top ? 'positive' : undefined,
              note: picked.skills[k] === top ? 'Your edge' : undefined,
            }))}
          />
          <p className="pb-note">You improve these every offseason.</p>
        </Card>
      </main>
    </StepScreen>
  );
}

/**
 * Step four: how his teams play. A named approach rather than five settings;
 * the strategy screen is where each one is argued, and all stay editable there.
 */
function PlayStyle(
  { rail, chosen, onChoose, onBack, bar }: {
    rail: ReactNode;
    chosen: PhilosophyId;
    onChoose: (id: PhilosophyId) => void;
    onBack: () => void;
    bar: ReactNode;
  },
) {
  const s = strategyForPhilosophy(chosen);
  const keys = ['running', 'steals', 'bunt', 'hook', 'alignment'] as const;
  return (
    <StepScreen top={rail} bar={bar}>
      <main className="pb-page">
        <ScreenHeader
          back={{ label: 'Back', onClick: onBack }}
          eyebrow="New career"
          title="Your approach"
        />
        <OptionGroup label="Your approach">
          {PHILOSOPHIES.map((p) => (
            <OptionCard key={p.id} title={capsWords(p.name)} hint={p.blurb} selected={p.id === chosen} onSelect={() => onChoose(p.id)} />
          ))}
        </OptionGroup>
        <Card eyebrow="What it sets" title={capsWords(philosophyOf(chosen).name)}>
          <DescriptionList
            items={keys.map((k) => {
              const w = policyWords(k, s[k]);
              return { label: w.title, value: w.label };
            })}
          />
        </Card>
      </main>
    </StepScreen>
  );
}
