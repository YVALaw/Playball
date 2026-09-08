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

Every part is drawn on the same 128×128 canvas against one shared head geometry
(`HEAD`, `EYE_Y`, `EAR_Y` in the generator). That is what lets any hair stack
onto any skin tone onto any jersey by simply drawing them at 0,0 in this order:

    jersey → hair-back → head → eyes → brows → mouth → facial hair → hat

Two rules the geometry enforces, both learned the hard way:

- the cap assembly stays entirely above `EYE_Y`, or the bill reads as a welding mask;
- hair is authored twice — `free` for a bare head, `under` for the sides and back
  that still show once a cap is on.

## Parts

| Folder | Contents |
| --- | --- |
| `parts/skin` | 10 tone swatches |
| `parts/eyes` | 5 iris colours, 6 `style-*` eye shapes |
| `parts/facial-hair` | 6 |
| `parts/hair` | 12 on a head, plus `-alone` layers |
| `parts/hair-hat` | 12 `-under` layers for wear with a cap |
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
