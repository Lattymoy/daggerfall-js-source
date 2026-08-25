# The skin pipeline

Produces `public/skin/` from an eight-direction character turnaround. Runs only
when the reference art changes; the game reads the baked files.

## Why this exists

The neutral rig had no texture at all - `buildNeutralBody` bakes one intensity
byte per face into `D.Ib`, and `setBodyRamp` snaps it onto a per-race ramp. On a
2,136-face body that is the entire skin. This pipeline replaces the per-FACE
intensity with a per-TEXEL one without changing the race mechanism: the atlas is
reduced to `skin-intensity.png`, and `snapRamp(ramp, i)` still supplies the race.

## Doctrine

**Nothing here touches ARENA2.** The source is our own generated turnaround, so
the output ships in the repo like `public/logo.png` and needs no data door. This
is the first character texture in the project that is free of that constraint -
see `01-Overview/Port-Doctrine.md`.

## Stages

1. `seg9.py` - cut the turnaround into eight views and segment each into limb
   regions per row (torso / two arms / two legs).
2. `mvB2.py` - per-limb multi-view sampling: every surface takes the view that
   sees it most face-on, blended across neighbours by surface normal.
3. `bake_atlas.py` - bake that map into one flat atlas plus `skin-layout.json`.
4. `clean2.py` - repair the atlas: strip dark caps where the rig reaches above
   what the reference supplies, fill holes down each column, and kill horizontal
   streaks with a selective vertical median.

`skin-uv.json` carries per-corner UVs in `buildNeutralBody`'s own face order, so
the viewer applies them index-for-index and no projection logic is duplicated in
the browser.

## The head (head_cell.py, head_bake.py)

The head cell is baked from an eight-direction head turnaround the same way the
body is, then the face is layered per race at runtime from `FACE*.CIF`.

## Laws learned building it (do not relearn these)

- **Bin count must not exceed the data.** The head is 168 faces built from SEVEN
  loft rings, so its vertices sit at seven heights. Binning its profile into 140
  gave 133 EMPTY bins, nearest-copied into a staircase, and interpolating across
  that staircase swung the sampled column 27px between adjacent rows. Build
  profiles from the rings that exist. The same bug lived on in the UV generator
  after the bake was fixed - fix both.
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
  and reference. This was the single largest source of error.
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

These four scripts are the only Python in the tree, which is a deliberate
deviation from the Node-ESM convention: they are a one-shot asset pipeline that
never runs at build or at runtime, and they lean on PIL and numpy. Porting them
to Node buys nothing unless the pipeline starts running in CI. Recorded here
rather than left to be discovered.

## Regenerating

Needs the turnaround cut into `view_000.png` .. `view_315.png` alongside the
scripts, plus `neutral.json` (dump `buildNeutralBody` faces with their `g`
stamps). Run the four stages in order, then copy the outputs into `public/skin/`.
