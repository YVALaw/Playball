# Avatar kit

The profile-avatar reference sheet, cut into its parts for Aseprite.

`reference-sheet.png` is the artwork — 1536×1024, transparent background. Nothing
here is redrawn: `parts/` is that sheet sliced into 83 transparent PNGs, one per
component, and `slices.json` records where each one came from.

`slice-check.png` is the proof: the sheet with every slice outlined and named.

## What's in it

| Folder | Parts |
| --- | --- |
| `parts/skin` | 10 skin-tone swatches |
| `parts/eyes` | 5 eye-colour swatches, 4 eye styles (`style-1..4`) |
| `parts/facial-hair` | 6 — round beard, handlebar, mustache, full beard, open beard, long beard |
| `parts/hair` | 12 heads with hair, no hat |
| `parts/hair-hat` | the same 12 heads under a white cap |
| `parts/hats` | 12 caps, including the side view and the snapback from behind |
| `parts/jerseys` | 12 — eleven jerseys and the catcher's chest protector |
| `parts/avatars` | the 10 finished busts |

Parts keep their natural size from the sheet (heads ~100×115, busts ~155×250).
They are **not** registered on a shared canvas: the sheet draws each row as its
own artwork, so a hair part and a hat part are not layers of one head. They are
cut-outs of a reference, which is what they are for.

## Known rough edge

The busts overlap at the shoulders and the jerseys touch at the sleeves, so
those two rows are cut at the sparsest column between neighbours. Each bust
therefore carries a sliver of the next one's shoulder at its edge. That is a
two-minute eraser job in Aseprite and not something a slicer should guess at.

## Regenerating

```bash
node scripts/slice-reference.mjs
```

It reads `reference-sheet.png`, floors the generator's near-invisible alpha
noise, strips the row-title glyphs, and re-cuts everything. Positions live in
the script's `ROWS` table.

## Aseprite

`build-aseprite.lua` builds one layered `avatar-kit.aseprite`: every part on its
own named layer at its sheet position, grouped by folder, and registered as a
named slice so *File → Export Sprite Sheet* can emit parts by name.

```bash
Aseprite.exe -b --script-param dir=<abs path to design/avatar-kit> --script design/avatar-kit/build-aseprite.lua
```

**This needs a licensed Aseprite.** The trial disables `--script` and refuses
every save. Until then the PNGs in `parts/` open in the trial as-is.

## In the game

The sheet's parts are pictures of parts, not parts that fit together — the heads
carry one skin tone and no neck, the jerseys have nothing to sit under, there is
no mouth. `scripts/avatar-compose.mjs` derives a set that does fit and writes it
to `public/avatars/`:

```bash
node scripts/avatar-compose.mjs
```

- every layer on one 144×216 canvas, anchored on the chin, so the app stacks
  PNGs at 0,0;
- each head split into a **skin mask** and the rest; each capped head into skin,
  **crown** and **brim** masks and the rest — skin tone and the program's cap
  colours are CSS backgrounds behind those masks, so 97 PNGs serve every tone
  and all 96 programs;
- a neck and a mouth drawn in the sheet's own style;
- eyes and facial hair scaled to the heads; jerseys seated under the neck.

`compose-check.png` is the proof: 24 portraits composed from those layers.
`src/ui/Avatar.tsx` renders them; `src/ui/avatar-atlas.ts` (generated) carries
the geometry and part names. Change the artwork → re-run both scripts.

Not used yet: the `hats/` row (the capped heads carry their own cap) and the
`avatars/` busts (they were the layout reference).
