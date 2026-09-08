# Avatar kit

A profile-avatar component kit — skin tones, eyes, facial hair, twelve haircuts,
twelve caps, twelve uniforms — reproduced from the reference sheet at 128×128 per
part.

`avatar-kit-sheet.png` is the contact sheet. Look at that first.

## Regenerating

```bash
node scripts/avatar-kit.mjs
```

Everything is authored as SVG in `scripts/avatar-kit.mjs` and rasterised with
`sharp`, which is already in the tree for the Capacitor icon pipeline. Edit the
shape data there and re-run; nothing here is hand-painted, so the sheet and the
individual parts can never drift apart.

## Layout contract

Every part is drawn on the same 128×128 canvas against one shared head: the top
half is a true ellipse (`HEAD_CY`, `RX`, `RY` in the generator) so hairlines can
be computed against it, the bottom half is a jaw. That is what lets any hair
stack onto any skin tone onto any jersey by drawing them at 0,0 in this order:

    jersey → hair-back → head → eyes → mouth → facial hair → hair-front → hat

Hair is two layers: `back` goes behind the head (volume, strands, the ponytail),
`front` goes over it (the hairline and anything framing the face). A cap simply
draws on top of both; whatever it does not cover is what shows. Like the
reference, the faces are dots and a mouth — no brows.

## Parts

| Folder | Contents |
| --- | --- |
| `parts/skin` | 10 tone swatches |
| `parts/heads` | the bare head in each of the 10 tones |
| `parts/eyes` | 5 iris colours, 6 `style-*` eye shapes |
| `parts/facial-hair` | 6 |
| `parts/hair` | 12 on a head, plus `-back` and `-front` layers of each |
| `parts/hair-hat` | the 12 cuts `-capped`, as the reference's second hair row |
| `parts/hats` | 12 |
| `parts/jerseys` | 12 garments, plus `-shoulders` for portraits |
| `parts/examples` | 12 composed portraits |

`manifest.json` lists every part with its colours, for anything that wants to
drive the kit programmatically.

## Aseprite

`build-aseprite.lua` assembles the PNGs into one layered `.aseprite` document,
grouped by part with one of each visible so it opens on a composed face.

```bash
Aseprite.exe -b --script-param dir=<abs path to design/avatar-kit> --script design/avatar-kit/build-aseprite.lua
```

**This needs a licensed Aseprite.** The trial build disables `--script` outright
and refuses every save, so neither this script nor hand-editing-and-saving works
there. Until then the PNGs can still be opened and viewed in the trial.

## Relationship to `src/ui/Avatar.tsx`

None, deliberately. The app's avatars are still the id-derived SVG renderer in
`src/ui/Avatar.tsx`, which ships no bytes and needs no assets. This kit reuses
that file's skin and hair palettes so the two read as the same game, but swapping
the app over to composited PNGs is a separate call to make after seeing the art.
