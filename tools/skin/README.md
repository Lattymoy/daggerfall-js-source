# The skin pipeline

Produces `public/skin/` from an eight-direction character turnaround. Runs only
when the reference art changes; the game reads the baked files.

## Why this exists

The neutral rig had no texture at all - `buildNeutralBody` bakes one intensity
byte per face into `D.Ib`, and `setBodyRamp` snaps it onto a per-race ramp. On a
2,136-face body that is the entire skin. This pipeline replaces the per-FACE
intensity with a per-TEXEL one without changing the race mechanism:
`skin-intensity.png` carries detail, and `snapRamp(ramp, i)` still supplies the
race.

## Doctrine

**Nothing here touches ARENA2.** The source is our own generated turnaround, so
the output ships in the repo like `public/logo.png` and needs no data door. This
is the first character texture in the project that is free of that constraint -
see `01-Overview/Port-Doctrine.md`.

## Current body bake: THE MESH OWNS THE UVS

The old body atlas treated each limb group as an approximate cylinder. It
invented a surface with `pz = sin(theta) * radius * 0.7`, baked into that
surface, then `head_cell.py` independently rebuilt the body's UVs with the same
approximation.

That was backwards. `neutral.json` already contains the exact quad that the
viewer renders. The torso changes superellipse power and depth by row, shoulders
and hands are not cylinders, and one group can contain multiple authored forms.
An approximate group cylinder can only make those surfaces agree by accident.

`bake_atlas.py` now gives every non-head quad its own small padded tile. Every
texel is evaluated on the same two triangles the viewer renders
(`0,1,2` / `0,2,3`) and sampled from the multi-view correspondence there. The
four UV corners are therefore the four rendered corners. There is no inverse
projection to solve and no geometry approximation between the bake and viewer.

The gutters are duplicated edge texels, not body area. `skin_ramps.py` excludes
them from its histogram and `beast_skin.py` smooths each face tile independently
so unrelated packed faces can never bleed into one another.

`head_cell.py` owns only the head. When it grows the atlas it preserves every
body UV in pixel space and renormalizes for the new texture dimensions. It must
never rebuild body UVs.

## Regeneration stages

1. `seg9.py` - cut the turnaround into eight views and segment each into limb
   regions per row (torso / two arms / two legs).
2. `mvB2.py` - reference-view correspondence: every surface point takes the
   view that sees it most face-on, blended across neighbours by surface normal.
3. `bake_atlas.py` - sample that correspondence ON THE ACTUAL BODY QUADS. It
   writes `skin-intensity.png`, the RGB diagnostic `skin-atlas.png`,
   `skin-layout.json`, `skin-uv.json`, and a preview.
4. `head_cell.py` - append the geometry-shaded head cell and preserve/renormalize
   the body UVs.
5. `head_bake*.py` + `skin_ramps.py` - bake the race head turnarounds and derive
   the head-authoritative body ramps.
6. `beast_skin.py` - optional beast body map: remove human fine anatomy per quad
   while keeping the face-to-face form shading.

`clean2.py` belongs to the retired group-cylinder body atlas. It repaired holes
and horizontal streaks caused by that projection. The face atlas resolves each
quad directly and does not use that repair stage.

`skin-uv.json` carries per-corner UVs in `buildNeutralBody`'s own face order, so
the viewer applies them index-for-index and no projection logic is duplicated in
the browser.

## The head (head_cell.py, head_bake.py)

The head cell is baked from an eight-direction head turnaround, then the face is
layered per race at runtime from `FACE*.CIF`. The head still uses an arc because
its source art and runtime face overlay are intentionally cylindrical around the
skull; this is separate from the body face-atlas decision.

## Skin tone (skin_ramps.py)

The HEAD is the authority on skin tone - it carries the artist's actual colour -
so each face derives the body ramp its own head implies, and the body's
intensity map runs through that. Mean |head jaw - body chest| falls from 8.9 on
one shared Breton ramp to 5.8, and six of the ten land within 1.5.

The ramp is HISTOGRAM-MATCHED to the body atlas, not evenly sampled across the
face's tonal range: the body averages ~192 of 255, so an even ramp puts the
whole torso on its bright end and the body comes out pale against the face.
`ramp[i]` is the face's skin at the percentile body-intensity `i` occupies.
Face-atlas gutters are excluded from this distribution.

## Laws learned building it (do not relearn these)

- **THE MESH OWNS THE UVS.** If the rendered quad already exists, sample the
  reference on that quad and map that same quad to the atlas. Do not reconstruct
  the body as an ellipse/cylinder and then try to invert that approximation.
  The old `0.7 * radius` depth assumption was not the torso, shoulder, hand, or
  foot geometry.
- **One packed face may not contaminate another.** Per-face gutters are
  duplicated edge texels. Any filter or histogram that treats gutters as new
  body area or crosses tile boundaries is wrong.
- **Bin count must not exceed the data.** The head is 168 faces built from SEVEN
  loft rings, so its vertices sit at seven heights. Binning its profile into 140
  gave 133 EMPTY bins, nearest-copied into a staircase, and interpolating across
  that staircase swung the sampled column 27px between adjacent rows. Build
  profiles from the rings that exist.
- **A median filter is edge-preserving.** It is built to KEEP steps, so it is the
  wrong tool for smoothing a ragged silhouette profile. Gaussian.
- **Never map outside the silhouette.** A smoothed centre or half-width can put
  the sampled column past the outline, where it reads background and then clamps
  onto the dark hair edge - a grey wash over the sides of the head. 1252 rows of
  2402 were doing this. Contain the mapped range inside the row's real run.
- **CHORD UNPROJECTION IS NOT RECOVERABLE HERE, USE ARC.** Unprojecting needs the
  head's rotation axis and its scale in each view and the reference supplies
  neither: the silhouette is hair, so its width barely moves across views
  (275/255/258/247) while the skull's projection must change 1.00->1.30; its
  centre is hair-biased (147, inside the skin run 122..270); the neck centre is
  unreliable (204.8 at view 135). A view sees exactly 180 degrees of arc, so map
  its image linearly across that arc - two silhouette edges, no axis, no scale,
  and every view's content lands in its own sector BY CONSTRUCTION. Chord
  mapping put the moustache on the EAR.
- **The cardinal views must own their whole subject.** A face spans roughly arc
  45..135, so equal 45-degree sectors give the FRONT view only 67.5..112.5 and
  the 3/4 views paint the rest - putting their faces at their own sector centres
  (u 0.375 and 0.625) instead of on top of the front view's at 0.5. That is a
  literal second face, and no amount of sharpening the blend fixes it because
  the 3/4 views are placing correct content in the wrong place. Cardinals
  (0/90/180/270) own 52 degrees each; the 3/4 views fill only the joins.
- **Prefer a REGION that is the thing to a RULE that describes it.** Body skin
  tone is derived from the head, and the sample was chosen by colour. Blonde
  hair leaked in, so the mask gained a G/R gate - which then inverted on Dunmer,
  passing 5624 of 6164 HAIR texels and rejecting grey skin. On two Dunmer both
  skin and hair are grey and no colour rule separates them at all. A box at the
  centre of the front sector at nose-bridge height is skin by construction for
  every race and needs no tuning.
- **Check which way each turnaround ROTATES.** Nine of the ten Breton sheets
  turn one way and one turns the other - and the odd one out was the head this
  pipeline was tuned on, so every other head had its side views mirrored, which
  shows as a doubled brow and mouth at 45 degrees. Detect it (which side the skin
  sits on at "90") and reflect the labels about 0/180 rather than trusting the
  grid order.
- **Take a landmark from a face's OWN eight views, not from one view and not
  from the set.** One view can be fooled by hair flare (0.66 where that same
  face's other seven agree on 0.86); eight cannot. Forcing the set's median on
  everyone was up to 0.080 out, an 8% vertical scale error on that head, which
  reads as stretch. Median across the face's own views is robust AND keeps
  genuine per-face differences.
- **Judge a head on the RIG, never on a narrow crop of the cell.** A 20%-wide
  slice of the cell is 72 degrees of arc through a cylindrical wrap: it looks
  like horizontal stripes for every face, working or broken, and cost four
  sweeps chasing a fault it could not have shown. The cell is for finding a
  cause; the render is for confirming a fix.
- **A metric that improves while the picture degrades is the wrong metric.** An
  axis correction took mean centring offset from 0.0146 to 0.0055 and made every
  one of the ten faces visibly worse - shifting the mapping centre per row
  without moving the scale with it SHEARS the image, and a centroid cannot see
  shear. Instrument to FIND a cause; look at the render to CONFIRM a fix.
- **Instrument the loop, do not reason about the picture.** Every one of the
  above took one dump of actual sampled rows and columns to find, and several
  rounds of theorising before that dump to get around to.
- **A front view does not contain a body.** Half of a closed surface is
  unreachable from one projection; that is why the reference is a turnaround.
- **Normalise in the frame you sampled in.** Rotating a point into a view and
  then dividing by an unrotated extent divides a depth by a width. This produced
  84px disagreements between views and a checkerboard across the whole torso.
- **Per limb, never whole figure.** Fitting the chest into the FULL figure's
  extent makes chest sampling depend on arm placement, which differs between rig
  and reference. This was the single largest source of error in correspondence.
- **The arms hang past the hip.** Below the crotch the reference still reads
  arm | legs | arm for ~56 rows. Taking the outermost runs as legs steals the
  arms and leaves the hands with no region at all.
- **A fist over a thigh is not resolvable from run topology.** Do not add
  heuristics; mark those rows unreadable and interpolate, because legs taper
  smoothly and the clean rows bracket them.
- **Landmarks must have unambiguous geometric definitions.** `waist`, `shoulder`
  and `neck` were fitted to a width profile that includes the arms and is dead
  flat, so they picked arbitrary rows and squashed the hips to 100 rows/unit
  against 379 in the shins. Floor, knee, crotch and torso-top only: spread 1.48x.
- **The reference is cropped at the neck.** Anchoring the rig's torso top at row
  0 aims the whole upper-trap band at a 17px sliver and stretches it across the
  shoulders. Anchor past the stump, which ends where torso width steps up.

## Note on language

These Python scripts are a deliberate deviation from the Node-ESM convention:
they are a one-shot asset pipeline that never runs at build or at runtime, and
they lean on PIL and numpy. Porting them to Node buys nothing unless the pipeline
starts running in CI. Recorded here rather than left to be discovered.

## Regenerating

Needs the turnaround cut into `view_000.png` .. `view_315.png` alongside the
scripts, plus `neutral.json` (dump `buildNeutralBody` faces with their `g`
stamps). Run the current stages above in order, inspect the actual rig render,
then copy the outputs into `public/skin/`.
