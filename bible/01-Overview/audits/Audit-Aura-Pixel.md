# AUDIT AURA-PIXEL - AURA-PIXEL, GLYPHS-MOUNTED, DRAGON-KEEP-SIZE, ARM-BEHIND and CHEST-CENTRE read cold, 2026-10-31

The owner: *"Audit this"*, of the branch at `fe1287a59` - the auras in Daggerfall's pixels, no cards over a rider, the
tamed dragon at its ridden size, a sprite's arm piece at the body's edge and its chest piece on the painted chest
(`../../04-Characters/Aura-Armory.md` sections 6, 7 and 13, `../../11-Multiplayer/Dwarven-Dragon.md` section 10). Four
cold lanes read a frozen worktree of that commit, each given the files and one brief, never a conclusion. Each finding
was proven on the real code - a node test, a frame in Chromium, or quoted lines - and proven again here before its fix.
Fixes carry an `AUDIT AURA-PIXEL <id>` comment; the pins are `test/render/auditaurapixel.test.js` and the moved pins in
`aurapixel`, `armbehind` and `shadowcloak`; the mutants `tools/mutants/auditaurapixel.json` (18, all dead).

| Lane | Read | Found |
|---|---|---|
| A | the pixel law: its GLSL, every look and piece through it, the renderer, the cost | 7 |
| B | GLYPHS-MOUNTED and DRAGON-KEEP-SIZE: every way to be mounted, every host, the dragon's size everywhere | 5 |
| C | ARM-BEHIND and CHEST-CENTRE: every camera, every sprite view and frame | 4 |
| D | the evidence: the pins, the mutants, the records, and the frames beside the base | 8 (two the others') |

## The pixel law (A, D3-D5)

**A1 (HIGH). The wings lost the bright core of every strand.** A strand two texels or more across never sampled its
core, under one texel it was all core, and the strand narrows along its length - a ninefold step. A strand is snapped
along its length now, 64 texels, and never across.

**A2, D3 (MEDIUM). Lines and strokes narrower than a texel were point-sampled away** - the Golden Radiance's fine rings
dark on half their bearings, the Ward's floating runes and the cloak's clasp blocks. The looks' own line widths take the
texel as their least (`auraPx`); a card is at least 32 texels a side and the cloth 256 each way.

**A3, A4, D3 (MEDIUM). The armory's detail was noise.** The Crystal Spurs' six facets fell between eight texels, the
Ashbound links and the Ember Heart's veins were noise at 2.6 m, and its derivatives were taken after the ARM-BEHIND
discard. A piece takes the levels alone now: no snap, no derivative.

**A5 (LOW). A growing card jumped a texel size mid-flight, and the cloak's triangles measured apart.** The card's least
and the cloth's own count. A big soft glow's card is still measured (the Sage's puffs cross a size as they swell).

**D3 (MEDIUM). Weighed by the root, the levels lit a faint glow's whole card** - the heart's glow a dotted square on the
chest. The dither now chooses between the two levels by light, so the mean holds and a faint edge stays dark.

**A6, D5 (LOW). The probes never read a design with the law on, and the texel check passed on the levels alone.**
`PIXEL=1 node tools/auraProbe.mjs` reads every design with the law on: 149 of 156, the seven left single-pixel reads
between texels and wrap reads the levels amplify, each look whole by eye. A probe's `pixel = 'levels'` draws the levels
without the snap, and the texel check reads against it.

**D4 (MEDIUM). Three laws had no pin that could kill them:** one axis under the pixel, the Resonance's own squares, the
armlet's cover. Each is run now. **A7 (LOW):** the weapon slot's pieces are the weapon glow's; section 13 says so.

## Riders and the dragon (B)

**B1, D1 (MEDIUM). A peer driving a wagon's bench floated their cards** - the bench's glue sets `rd` 0. `peerMounted`
reads the bench too, pinned through the real glue. **B2 (LOW).** An Admin on /dragon in first person was afoot to the
pass; `ridingDragon()` makes them a rider.

**B3 (MEDIUM, the owner's call).** The tree's own word "glyph" is most often a name badge. GLYPHS-MOUNTED read it as the
aura's floating cards; the name plate's badge glyphs over a rider still show. Asked of the owner.

**B4 (LOW, left open).** Under the Overworld a peer's ridden dragon is grown and a waiting one is not - true before this
branch too, never seen in a browser, and its fix is a wire through the world host. **B5 (LOW).** The four hosts are
named in both records now.

## The arm and the chest (C, D2, D6)

**C1 (MEDIUM). The cut needed a band, and 39% of far arms in a three-quarter view had none** - every frame of the female
plate. Every arm piece on a card is cut now, and a far arm never read clear wears none (`armWornSide`).

**C2 (MEDIUM). The cut stood upright at the band's row** and trimmed a slanting arm's own outline at the shoulder. It
runs along the arm now, half its width in from shoulder to elbow. **C3 (LOW).** Its side was judged off the chest lifted
before the card; the chest on the card now.

**C4 (LOW). Seen edge on, a card's chest decal was a streak mid-torso.** A card's decal edge on is gone.

**D2 (MEDIUM). From behind and to a side the Sigil's back stood on the near arm** - the chest mark takes in the arm
there, and the probe read against that same mark. It stands between the back's far edge and the arm's inner edge, and
the probe reads it against where the Eternal Armlets draw on that arm.

**D6 (LOW).** The between-the-arms read found nothing to cut on the armlets; the check now follows each arm along its
own edge, band or not, on idle and walking frames (`ANIM=Move:2`). **D7 (LOW).** The records' slips: the Sigil's back
stood 0.14 m behind the card, not 0.24; the bodies' pixel is 1.9 cm; "every piece" read "every look"; corrected.

## What was run

- `tools/auraProbe.mjs` 156 of 156, and `PIXEL=1` 149 of 156 (above). `tools/armoryProbe.mjs` 58 of 58.
- `tools/armorySpriteProbe.mjs` `SETS=1`, idle and `ANIM=Move:2`, on male leather, female chain, female plate and male
  cloak: every read passes. With a fix taken out: the Sigil's back fails its "clear of the near arm" reads in views 3
  and 5; the cut's between-the-arms read finds 1 px on female chain and none on male leather - the cut along the arm
  trims a pixel or two past the arm's own edge, so its law is the node pins'. A far arm never read clear has no measure
  in the picture but its own trace, so the probe cannot judge it: its rule is pinned in node and was read by eye on the
  walking frame (the bracer and armlet off the vest's edge).
- Every mutant record these slices touch: dead (the audit's 18, and the 28 re-aimed or moved).
