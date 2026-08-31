# Roster Tabletop

The design of record from v0.7.4 onward, and what `src/ui/tokens.css` means when
it says "the Roster Tabletop proposal (Option 2)". It replaces
`design/Dynasty Mobile.dc.html`, which is kept in the folder beside this one
because it is the design every comment in the app written before this point was
arguing with.

Three files, lifted out of the proposal prototype unchanged:

| File | What it is |
|---|---|
| `prototype.css` | The whole system. 969 lines, ~230 classes, and the only place the geometry is written down |
| `Prototype.tsx` | Every surface, rendered. Long lines; read it beside the CSS rather than on its own |
| `Ballpark.tsx` | The flat 2D field the proposal draws for a live game |

## What this is not

The prototype shipped inside a simulated phone — a bezel, a status bar, a
software keyboard, a device picker, an iPhone/Pixel toggle. None of that is
design; it is the harness the proposal was previewed in, and the proposal's own
guide marks it protected for exactly that reason. It is not in this folder and
it is not being ported.

## What it agrees with us about

The information architecture, entirely. Four regular-season tabs with the same
names and the same sub-screens as `TABS` in `state/store.ts`, the same seven
offseason steps as `PHASES`, and the same set of things that are overlays rather
than destinations. Nothing in the port moves a screen; the store was never
touched.

## What it is wrong about, and where we went our own way

The prototype is a prototype. It has no save state, no text-size setting, no
tutorials and no failure surfaces, because it never needed them — so its silence
on those is not a decision to remove them.

| It shows | We kept | Why |
|---|---|---|
| Drag handles and a tap-through on lineup rows | Tap-one-then-tap-another, no tap-through | Both came from playtest reports. See the comment at the top of `screens/Lineup.tsx` |
| A flat 2D ballpark | `Diamond3D.tsx` | Recoloured rather than replaced |
| A static photograph, reused for every player | `Avatar.tsx` | A face generated from the player's own id, stable across his whole career |
| Playoffs as step 1 of an eight-step rail | The bracket as its own frame, with the bottom nav | Taking the nav away from June was reported once already |
| Labels at 7–8px | A 9px floor, still on `calc(Npx * var(--ts))` | A default nobody can read is not a default |
| No mono anywhere | `--mono` for box scores and play-by-play | Column alignment is the entire readability of a box score |
