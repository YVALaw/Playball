# Playball: Project Roadmap v3

**Last updated:** August 19, 2026
**Supersedes:** v2
**Companion doc:** `02-sim-engine-spec.md` for engine internals

---

## The pitch

You are the head coach of a college baseball program. Recruit high schoolers, develop them, survive the MLB draft stealing your best arms every June, work the transfer portal, and chase a national title in Omaha. Games resolve at bat by at bat with text play by play, visualized on a 3D diamond. Ships to Android.

## Where the project actually is

**Phase 0 is mostly done, and unverified.** The simulation engine exists and runs headless. It is currently plain JavaScript and needs converting to TypeScript before anything gets built on top of it.

**The calibration claim checks out.** As of August 19, 2026 the harness has actually been run. Runs per team per game land at 6.84 against a 6.79 target, home runs and pitches per plate appearance are exact, and nothing is off by more than 7%. The platoon model produces the right split sizes in the right direction. Full output in `tests/fixtures/calibration-baseline.txt`.

**But it has real defects.** Three bugs and four gaps against its own spec:

- A walk-off bug — the bottom half plays to three outs regardless of score
- Pitch-level D1 constants that are documented in `ratings.js` and wired to nothing
- No home field advantage at all. Measured: the better team wins at the same rate home and away
- No individual fielders, no catcher in the engine, no pitch types, no AI decision layer

Walks run 7% high and plate appearances 5% high — the two numbers worth chasing, and they are related.

Performance is not a concern: roughly 2,500 full games per second.

See the defect register in `04-implementation-plan.md`. Phases 0.4 and 0.6 close the gap.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Language | **TypeScript 5.x**, strict mode |
| Build | **Vite 5** |
| UI | **React 18** |
| 3D | **Three.js** via **React Three Fiber** and **drei** |
| State | **Zustand** |
| Storage | **IndexedDB** via **idb** |
| Heavy sim | **Web Worker** with **Comlink** |
| Styling | **CSS Modules** with custom properties |
| Testing | **Vitest** |
| Mobile | **Capacitor 6**, Android target |

### TypeScript

Strict from day one. `strict: true`, `noUncheckedIndexedAccess: true`. Turning strict on later means fixing hundreds of errors at once, and you will not do it.

The domain model is where TypeScript pays for itself immediately. A baseball sim is dozens of interlocking record types, and one mistyped field ruins a season silently.

```ts
export type Hand = 'R' | 'L';
export type Bats = Hand | 'S';
export type ClassYear = 'FR' | 'SO' | 'JR' | 'SR';
export type Position = 'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF'|'DH'|'P';

export type PAEvent =
  | 'single' | 'double' | 'triple' | 'homerun'
  | 'walk' | 'hbp' | 'out';

export type PitchResult =
  | 'ball' | 'called' | 'swinging' | 'foul' | 'inplay' | 'hbp';

export type BattedBall = 'ground' | 'line' | 'fly' | 'popup';

export interface Ratings {
  contact: number; power: number; eye: number;
  speed: number; fielding: number; arm: number;
  /** Strat-O-Matic style, lower is better. 1 is a defensive star. */
  range: number; errorRate: number;
}

export interface PitcherRatings {
  stuff: number; movement: number; control: number;
  stamina: number; groundBall: number; holdRunners: number;
  velocity: number;
}

export interface Player {
  readonly id: PlayerId;
  name: string;
  pos: Position;
  classYear: ClassYear;
  bats: Bats;
  throws: Hand;
  /** Hidden. Full platoon split size as a share of production. */
  platoonSkill: number;
  ratings: Ratings;
  pitching?: PitcherRatings;
}
```

Use branded IDs so you cannot pass a `TeamId` where a `PlayerId` belongs:

```ts
type Brand<T, B> = T & { readonly __brand: B };
export type PlayerId = Brand<string, 'PlayerId'>;
export type TeamId   = Brand<string, 'TeamId'>;
```

Keep every event union exhaustive and let the compiler catch the missing case when you add one:

```ts
function assertNever(x: never): never {
  throw new Error(`Unhandled: ${JSON.stringify(x)}`);
}
```

### Three.js, scoped

This is the decision that determines whether the project ships. Three.js can absorb unlimited effort, and 3D is not where a dynasty sim's value lives. So the scope is fixed up front.

**In scope: a stylized diamond diorama.**

- Low poly field: dirt infield, grass, foul lines, base pads, mound. No stadium, no stands, no crowd
- Fielders and runners as simple markers, not humanoid models. Colored capsules or discs with jersey numbers
- Ball flight animation on contact, driven by the batted ball type the engine already produces
- One camera easing between three fixed positions: behind the plate, high third base, and a bird's eye for baserunning
- Everything readable on a 6 inch screen held one handed

**Out of scope, permanently:** player models, animation rigs, swing and pitch mechanics, stadium geometry, crowds, weather particles, free camera replays.

**The engine never learns about Three.js.** The sim emits a `PlayEvent` describing what happened. The 3D layer reads it and animates. That boundary is the whole reason this stays shippable.

```ts
export interface PlayEvent {
  kind: 'pitch' | 'contact' | 'advance' | 'out' | 'score';
  battedBall?: BattedBall;
  /** Normalized field coordinates. The engine emits geometry, never visuals. */
  landing?: { x: number; y: number };
  runners?: Array<{ id: PlayerId; from: 0|1|2|3; to: 0|1|2|3|4 }>;
}
```

**Mobile 3D rules, non negotiable:**

| Rule | Why |
|------|-----|
| Cap device pixel ratio at 2 | Phones report 3 or 4 and you render four times the pixels for no visible gain |
| `frameloop="demand"` in R3F | Render only when something moved. A static field between pitches should cost zero frames |
| Instanced meshes for repeated geometry | One draw call for all nine fielders |
| Bake lighting into materials | No real time shadows. They are the single biggest mobile GPU cost |
| Lazy load the 3D bundle | Three.js is roughly 600 KB gzipped. Code split it so menus load instantly |
| Ship a 2D fallback | A CSS diamond view. Some players will prefer it for speed and battery, and you need it while the 3D is unfinished |

That last one matters more than it sounds. Build the 2D view first and treat 3D as an enhancement layer. If Three.js turns into a swamp, you still have a complete game.

### Capacitor and Android

Capacitor wraps the built web app in an Android WebView. Same codebase, real APK.

```
npm i @capacitor/core @capacitor/android
npx cap init Playball com.yva.playball
npm run build && npx cap add android && npx cap sync
npx cap open android          opens Android Studio for the APK or AAB
```

Android specifics that will bite you if you leave them for the end:

- **Hardware back button.** Android users expect it to navigate back, not close the app. Wire `App.addListener('backButton')` to your nav stack in Phase 2, not Phase 7
- **Safe areas and gesture nav.** Use `env(safe-area-inset-*)` on the bottom navigation or the gesture bar sits on top of your buttons
- **WebGL in a WebView** works, but runs slower than the same device's Chrome. Test on a real mid range phone early, not just the emulator and not just your own device
- **Storage.** IndexedDB persists fine in the Android WebView. Do not use Capacitor Preferences for saves, it is a key value store meant for settings
- **Orientation.** Lock to portrait unless the 3D view earns landscape
- **Signing.** Generate the keystore before your first release build and back it up somewhere permanent. Lose it and you can never update the app on Play

### Repo layout

```
Playball/
  package.json
  tsconfig.json                strict: true
  vite.config.ts
  capacitor.config.ts
  index.html
  /src
    /engine                    pure TS. No React, no Three, no DOM
      types.ts                 the domain model
      ratings.ts               every baseball number lives here
      players.ts
      pitchModel.ts
      engines.ts
      game.ts
      season.ts                Phase 1
      progression.ts           Phase 3
      recruiting.ts            Phase 4
      rng.ts                   seeded xorshift
    /state
      store.ts                 Zustand
      persistence.ts           IndexedDB, schema migrations
      simWorker.ts             Web Worker
      simClient.ts             Comlink wrapper
    /ui
      /screens
      /components
      tokens.css
    /field
      Field2D.tsx              the CSS fallback, built first
      FieldScene.tsx           R3F canvas, lazy loaded
      Diamond.tsx
      Fielders.tsx
      BallFlight.tsx
    /data
      schools.json
      conferences.json
      names.json
  /tests
    engine.test.ts
    calibration.test.ts        the regression test that actually matters
  /docs
  sim.ts                       headless CLI, kept forever
```

**The one architectural rule:** nothing in `/engine` may import from `/ui`, `/state`, or `/field`. Enforce it with an ESLint boundary rule so it cannot rot. That separation is what keeps the engine testable headless and lets you sim ten thousand games from the command line.

### Determinism and saves

The engine uses a seeded xorshift RNG and that is worth protecting. Store the seed in the save. Same seed plus same inputs reproduces the season exactly, which buys you reproducible bug reports, replays without storing every play, and small save files.

```ts
interface SaveFile {
  schemaVersion: 4;
  seed: number;
  year: number;
  dynasty: DynastyState;
}
```

Write a migration per version bump before you have users, not after.

### Performance targets

| Operation | Budget |
|-----------|--------|
| Single game, headless | under 5 ms |
| Full 33 game season, one team | under 200 ms |
| Full league season | under 3 s in a Worker, with progress |
| Screen transition | under 100 ms |
| 3D field, mid range Android | 30 fps sustained during ball flight |
| Initial bundle, 3D excluded | under 250 KB gzipped |

Guard these with benchmark tests. A performance regression found six months later is a rewrite.

---

## Design direction — **STALE, DO NOT BUILD FROM THIS**

> This section was not updated for v3 and does not describe the app's design.
>
> **The design is `design/Dynasty Mobile.dc.html`.** The mockup is the source of truth
> for palette, typography, layout, and interaction. Port it as-is. Where this section
> and the mockup disagree, the mockup wins — including on color, where this section's
> scorebook palette was never adopted.
>
> Kept below only as an idea file. The one piece still worth stealing is the live
> scorebook cell described at the end, which the mockup does not have.

The identity comes from the sport's own paperwork, not from generic sports app conventions. College baseball's real artifact is the **scorebook**: ruled grid paper, a small diamond in every cell, notation like 6-4-3 and a backwards K, and the scorekeeper's convention of marking plays in blue or black and runs in red.

The 3D field lives inside that world rather than fighting it. Think a scorekeeper's diagram rendered in three dimensions: flat matte colors, visible construction, no photorealism. Chasing a realistic ballpark on a phone GPU produces something that looks cheap. A deliberately diagrammatic field looks designed.

| Token | Value | Use |
|-------|-------|-----|
| `--paper` | `#F2F0EB` | Background, the ruled page |
| `--rule` | `#D6D2C6` | Grid lines, dividers |
| `--graphite` | `#232326` | Primary text |
| `--ink` | `#1F3F8F` | Ballpoint blue. Actions, active states |
| `--scored` | `#B02B2B` | Red pencil. Runs scored, nothing else |
| `--turf` | `#5E7A4F` | Field green, muted |
| `--clay` | `#A8735A` | Infield dirt |
| `--dugout` | `#14161A` | Night mode ground |

The red is the discipline test. Scorekeepers use red for exactly one thing. If it starts appearing on errors, injuries, and losses, it stops meaning "a run scored" and becomes decoration.

**Type**

- Display: a compressed grotesque for team names and scores, tight and large
- Body: a neutral sans, nothing below 15px on a phone
- Data: a monospace for the play log and every stat table. Column alignment is the entire readability of a box score

**Signature element:** the live scorebook cell. As an at bat resolves, a real scorekeeping cell fills in beside the field: diamond, count, notation. It ties the 3D view back to the paper world and it is the one place to spend animation budget.

---

## Build phases

### Phase 0: The engine — **PROTOTYPE (in JavaScript)**
- [x] Player and team structures with handedness and platoon skill
- [x] Generalized log5 plate appearance model
- [x] Free pitch model as a comparison engine
- [~] Pitch level count model — built, but the D1 constants in `ratings.js` are wired to nothing
- [~] Baserunning, steals, errors, double plays, sacrifice flies — steals are first-to-second only and ignore the catcher, who does not exist in the engine
- [x] Fatigue, times through the order, pitching change AI
- [x] Text play by play and box score
- [~] Calibration harness, platoon test, parity test — written, never run
- [ ] Walk-off handling — the bottom half plays to three outs regardless of score
- [ ] Individual fielders with range and error ratings
- [ ] AI decision layer on a run expectancy matrix

### Phase 0.4: Stabilize the JavaScript engine — **START HERE**
Install Node, capture a measured baseline, fix the known bugs, recalibrate. See
`04-implementation-plan.md`. This must land before the TypeScript port, so that a
post-port calibration difference can only mean the port broke something.

### Phase 0.5: TypeScript conversion
- [ ] `tsconfig.json` with strict mode on
- [ ] `types.ts`: full domain model, branded IDs, exhaustive unions
- [ ] Port the five engine files, fixing what strict mode surfaces
- [ ] Port the CLI to `sim.ts`, run with `tsx`
- [ ] Move the calibration harness into Vitest so it runs as a real test
- [ ] Add the `PlayEvent` type and emit it from `game.ts`, ready for the 3D layer

**Done when:** `npm test` passes, calibration still hits the D1 targets, and the engine compiles clean under strict.

### Phase 1: The season
Still headless. Do not open the UI yet.

- [ ] Schedule generator: conference weekend series plus midweek games
- [ ] Day by day season loop
- [ ] Standings, team stats, stat leaders
- [ ] Rankings and an RPI approximation
- [ ] Conference tournament bracket
- [ ] NCAA tournament: regionals, supers, Omaha
- [ ] Season awards
- [ ] `sim.ts season` prints a full year

**Done when:** the stat leaders from a simmed season look like real college baseball.

### Phase 2: The app shell
- [ ] Vite React TS scaffold, folder structure, ESLint boundary rule
- [ ] Zustand store typed against the engine model
- [ ] IndexedDB persistence with schema versioning
- [ ] Web Worker plus Comlink for season simming, with a progress bar
- [ ] Bottom navigation and the five core screens
- [ ] Design tokens in CSS
- [ ] **`Field2D.tsx`**: CSS diamond, play log, and the live scorebook cell
- [ ] Android back button handling and safe area insets
- [ ] First Capacitor build, APK running on a real phone

**Done when:** you can play a full season on an Android device with no laptop involved.

### Phase 3: Roster management
- [ ] Lineup and rotation editor
- [ ] Depth chart with position eligibility
- [ ] Injuries and season long fatigue
- [ ] Progression and regression at season end
- [ ] Eligibility, redshirts, graduation
- [ ] MLB draft: who leaves, who returns

### Phase 4: Recruiting
- [ ] Recruit class generation by state and region
- [ ] Interest and pitch system: playing time, development, winning, proximity, academics
- [ ] Weekly recruiting budget
- [ ] Rival schools competing for the same players
- [ ] Signing day
- [ ] Recruits drafted out of high school who never arrive
- [ ] Transfer portal, both directions

### Phase 5: The 3D field
Deliberately late. The game is complete and playable before this starts.

- [ ] R3F canvas, lazy loaded and code split
- [ ] Low poly diamond geometry with baked materials
- [ ] Instanced fielder and runner markers
- [ ] Ball flight driven by `PlayEvent`
- [ ] Camera easing between three fixed positions
- [ ] `frameloop="demand"` and DPR capping
- [ ] 2D and 3D toggle in settings, 2D stays default until 3D beats it
- [ ] Profile on a real mid range Android phone, hold 30 fps

### Phase 6: The dynasty layer
- [ ] Program prestige tied to results
- [ ] Coach attributes and a skill tree
- [ ] Job offers and the coaching carousel
- [ ] Facilities and budget upgrades
- [ ] AD expectations and getting fired
- [ ] Records book and program history

### Phase 7: Ship
- [ ] Onboarding for the first ten minutes
- [ ] Multiple save slots
- [ ] News feed and headlines
- [ ] Keystore generated and backed up
- [ ] Play Store listing, signed AAB
- [ ] Accessibility: focus states, reduced motion, text scaling

---

## Decisions locked

| Decision | Choice |
|----------|--------|
| Core fantasy | Head coach dynasty |
| Sim depth | At bat by at bat, text play by play |
| Platform | Mobile first, Android via Capacitor |
| Language | TypeScript, strict |
| UI | React 18 on Vite |
| 3D | Three.js via React Three Fiber, stylized diamond only |
| Engine | Generalized log5 with constrained pitch sequencing |
| Rating visibility | All visible in v1 |
| Two way players | Skipped in v1, added later |
| Schools | Fictional |
| World size | 12 teams, one conference. Schedule generator parameterized by team count so the world can grow |
| Season length | 33 games — a single round robin, every opponent three times |
| Individual fielders | **In v1.** Range and error ratings per player, spray direction, a real catcher |
| Pitch arsenals | Deferred past v1 |
| Defensive shifts | Coach decision, per the mockup: Straight / Situational / Full shift |
| Re-entry | Once a player is substituted out he cannot return. Hitters and pitchers alike |
| The mockup | `design/Dynasty Mobile.dc.html` is the app's layout. Port it to the stack, keeping the screens and interaction model exactly |

---

## Still open

- [ ] NIL and revenue sharing as a mechanic, or skip it?
- [ ] Park effects, and do they get 3D geometry or stay numeric?
- [ ] iOS later, or Android only? Capacitor supports both, but iOS needs a Mac and a paid developer account

---

## Next action

Phase 0.4. Install Node, run the calibration harness for the first time, and commit its output as a measured baseline. Then fix the walk-off bug and wire up the dead pitch constants, and recalibrate.

Phase 0.5 follows immediately: convert the engine to TypeScript with strict mode on and get the harness running under Vitest as a regression test against that baseline. It is a contained, mechanical job, and doing it while the engine is still under a thousand lines means every phase after it is typed from the start instead of retrofitted.
