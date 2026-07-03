# Characters-Arc (ACTIVE)

People and enemies: the classic DATA layer verbatim first (positions,
factions, flags, spawn tables), classic billboards as the baseline
visual, then the voxel rig system replaces them piece by piece (the
doctrine's design win - see Port-Doctrine 2). Inputs COMPLETE: Readers
(people/NPC records parsed since the BLOCKS reader), World (interiors,
RDB layout), Player (activation reach for talk), Rendering (billboard
batches, point lights).

## Direction pivot (Mac, 2026-07-03)

Townsfolk STAY classic billboards - they already read right, and
band-recolored mannequins proved that unauthored voxel bodies
undersell the game. The rig craft goes where the 1:1 payoff is: the
PLAYER paperdoll. ?voxelfolk survives only as the render-path test
harness for drawCharacter until C7 exists (not a product direction;
C4c's milestone note stands as history). Every C6 piece is AUTHORED
at Voxlight enemy craft against the real paperdoll art - no
band-recolor shortcuts ship, ever.

## Slice plan

- **C1 (SHIPPED) - interior people (AddPeople verbatim)**: BlockPeopleRecords ->
  billboards at (XPos, -YPos, ZPos) * GlobalScale, base at the raw
  position (DFU pivots at centre then shifts +size.y/2 - our batches
  take base positions, so the raw position IS the base). Every person
  carries StaticNPC layout data (factionID, flags, archive/record,
  position hash inputs). Visibility gates (shop hours, house
  ownership, guild membership, TG/DB house rule - DaggerfallInterior
  AddPeople tail) are RECORDED as data and routed to Systems; C1
  spawns everyone. Corpus test over all interiors; in-engine proof in
  a populated tavern.
- **C2 (SHIPPED) - exterior NPCs + name banks**: RMB exterior people flats with
  faction metadata (StaticNPC), GetNameBankOfRegion verbatim over the
  ported REGION_RACES table.
- **C3 (SHIPPED) - dungeon enemies (data)**: RDBLayout AddFixedEnemies /
  AddRandomEnemies verbatim (fixed ids, the random encounter tables +
  classic seed math), spawned as classic enemy billboards, no AI.
- **C4 - voxel rig foundation**: C4a vendored (SHIPPED, below).
  C4b: dagger's renderer grows a vertex-color character path (faces ->
  fan-triangulated interleaved buffer, lit by dagger's pipeline - no
  Voxlight pixel-lock ref hack). C4c: the bare humanoid replaces one
  townsfolk billboard behind ?voxelfolk, classic billboard height at
  the same base. DECIDE-C1 goes live at C4c.
- **C5 - the paperdoll SYSTEM, verbatim (data)**: the 1:1 core. Equip
  slots (~27), the strict layer/occlusion order (cloak interior behind
  body, exterior in front, armor over clothes...), wearable item
  templates with race/gender variants, and the dye/material tint
  tables. Ported + corpus-tested exactly like C1-C3 - this data DRIVES
  every visual slice after it.
- **C6 - outfit pieces on the rig (upstream-first)**: extend the
  Rewrite rig's socket set to cover the paperdoll slots (head, chest,
  pauldrons, forearms, hands, legs, feet, cloak - cape exists) IN
  project-final first, re-vendor + re-capture the parity fixture. One
  voxel builder per item TYPE; template x variant combos resolve
  through the verbatim dye/palette tables (the classic tint mechanism,
  which is what keeps hundreds of combos tractable). Authored through
  a paperdoll-lab page (rig + piece + sliders -> lock), the Voxlight
  lab workflow.
- **C7 - the live paperdoll (DECIDE-C2 resolved: live rotating
  viewport)**: the equipped rig rendered low-res in a UI viewport,
  mouse-drag rotate - the inventory paperdoll IS the character. The
  same equipped rig walks the world on NPCs (the design win the 2D
  paperdoll never had).
- **C8 - enemy rigs + spectral emission**: rigged enemies replace the
  C3 billboards; the Rendering arc's blocked spectral-emission row
  unblocks here.

## Milestones

C1-C3 audit: gates green (148/26), extraction validated - ENEMY_BASICS
re-derived from comment-stripped source is IDENTICAL (62 records), and
interior people/flat basing confirmed verbatim (DFU bases BOTH at the
raw position via the +size.y/2 shift; our batches take bases). Three
fixes at root in dungeonEnemies.js: a dead `rand` import, a dead
GLOBAL_SCALE import + re-export (the P4-P6 audit's re-export class),
and the table-fill guard reshaped to DFU's exact form - the fill
indexes EncounterTables[dungeonType] UNGUARDED (out of range throws
before any flat, same as C#) with the dead-in-practice per-flat range
check mirrored in the random branch. Privateer's pin unchanged.

### C3 - dungeon enemies, data + classic billboards (SHIPPED)

The classic selection path verbatim in `dungeonEnemies.js`: fixed
enemies from editor record 16 (factionOrMobileId & 0xff, the garbage-
MSB rule, typeValue 99 skipped) and random enemies from record 15 -
DFRandom.srand(LocationId), 256 non-water picks from
EncounterTables[dungeonType] + 256 water picks from table 19 through
ChooseRandomEnemyType's level banding, water routing on
waterLevel < raw classic Y, slot = flags with the slot-0 reroll, the
Slaughterfish/Dreugh/Lamia water veto, Passive on action byte 99, and
gender flags for types > 43. Three generated data modules (extraction-
scripted, never hand-copied): MOBILE_TYPES, ENCOUNTER_TABLES (45x20;
the source's dead commented Cemetery block stripped - Ledger B), and
ENEMY_BASICS (per-type texture archives + behaviour). RDB markers now
carry the flat resource (rawY/flags/factionOrMobileId/soundIndex/
action byte). dungeonContext spawns classic billboards (gender picks
the archive, record 0 standing frame, RDB raw-pivot rule) and returns
`enemies`; both dungeon pins gain the count; `__enemies` joins the
probes. DFU seeds the slot-0 Unity stream with DateTime ticks (an
upstream TODO) - we seed a xorshift with the LocationId for
determinism (Ledger A). Pins: Privateer's Hold 42 enemies / 25 fixed /
types [0,1,3,4,7,15,136,138,141]; in-engine the Daggerfall city crawl
reads `128 enemies` and the first (type 130, fixed) is framed on
camera. No AI - C5 rigs replace the billboards.

### C2 - exterior NPCs + name banks (SHIPPED)

Exterior: RMBLayout's verbatim rule - a flat record with NON-ZERO
factionID is an exterior NPC (editor flats skipped first, DFU order).
collectBlockFlats passes factionID/flags/recordPosition through on
every flat; `collectExteriorNpcs` filters the registry. Corpus pinned:
76 NPCs across 16 RMB blocks, archives [179,181,210] - the 210 is
SENT7.RMB's faction-tagged lamp, a classic quirk (Ledger B). Names:
NameHelper verbatim over DFRandom - FirstName 0+1/2+3, Surname 4+5,
Nord 0+1+"sen", Redguard 0+1+2+(75% male set 3 / female set 4, the C#
short-circuit preserved so females never consume the roll - the
stream-parity test pins it). Bank data is DFU's NameGen.txt committed
as nameGen.json, lenient-JSON normalized (Ledger B).
getNameBankOfRegion casts REGION_RACES verbatim. MonsterName routed to
Systems (UnityEngine.Random stream, quest-facing).

### C1 - interior people (SHIPPED)

`src/characters/interiorPeople.js`: AddPeople's data layer verbatim -
(XPos, -YPos, ZPos) * GlobalScale with the raw position as the BASE
(DFU centre-pivots then shifts +size.y/2; our batches take bases), and
the StaticNPC inputs (archive/record, factionID, flags, raw triple) on
every person. interiorContext batches people through the flat billboard
path and returns the `people` list parent-framed; both interior pins
gain the people count, `__people` joins the probe set. Visibility
gates (ownership / shop hours / open rules / GuildHall anytime / TG-DB
member) ride as data; evaluation routes to Systems. Corpus pinned:
14174 people across 6724/6832 interiors, 0 in empty records, archives
[176,177,181,182,183,184]. In-engine proof: TVRNAL06.RMB:0 in ?world -
pin `64 draws, 3 doors, 11 lights, 2 people`, patrons visible in the
captured frame.

### C6k - THE RESCULPT (SHIPPED): the model itself

Mac, after three corrections landed everywhere except the model:
"Its the entire voxel model proportions and design." Owned - C6j's
shading and DAGGER_SPEC's four landmarks left ~85% of the body's
geometry (torso widths, shoulders, neck, head, arms, hands, feet)
Voxlight-shaped, with the rest written off as "deferred" - the
forbidden word. The resculpt derives EVERY dimension from BODY00I0.
tools/body-measure.mjs is the foundation (shipped this rung): full
pose-corrected measurement - torso width per row about the DRIFTING
centreline (merged-arm rows subtract the split side's arm thickness;
crotch = the torso SPLIT: two similar-width runs over the prior span,
prior centre between them - the gap-straddle rule died on row 71's
hand+legs), head crown + width-jump bottom (no separable neck on
BODY00 - hair-merged, recorded not invented), shoulder span, arm
thickness + wrist row, thigh/knee/calf/ankle from the leg-width
series truncated at the last width minimum (foot flare creeps under
any centre-jump threshold). Numbers: head 0.24 wide topping 1.92
(bottom 1.86 - SMALL and HIGH vs the rig's literal head), shoulders
0.351 half-span at 1.49, torso 0.172/0.159/0.219, arms 0.141 to
wrist 0.99, legs thigh 0.239 / knee 0.159@0.709 / calf 0.199.
SHIPPED across the block: SPEC v2 upstream (3ede53e + torsoProfile-
reads-rows + the paperdoll arm-override plumb; pose tables carved to
poseTables.js on the ceiling breach) - the FULL body is optional-
field data with parity untouched. gen-dagger-spec.mjs emits DAGGER_
SPEC v2: 40-row measured torso loft (depth = rx * 0.7, the one
front-view assumption), head scale/lift SOLVED from the crown (1.115
/ -0.0168 - the head moved and shrank; the 'collision' was never
structural), measured arm/leg radius ratios, knee sanity-clamped
(window-edge minimum rejected). THE GATE: silhouette.test.js - front
IoU vs the sprite mask. First honest number 0.5172 FAILED the floor
and exposed the mirrored stance guess; fit-pose.mjs coordinate-
descends the paperdoll pose against the metric itself -> 0.6649
(weightSide -1, the fit is generated into paperdollPose.js). Floor
0.64, ratchets up only. Remaining gap is named, not deferred: hair
mass (the rig models none), stylized hands, elbow flare - each a
measurable IoU delta when addressed.

### C6j - THE ARCHITECTURE (Mac): rig geometry + sprite shading (SHIPPED)

Mac reset the direction after the relief thrash: "go back to the old
voxel rig and shade it to be 1 to 1 with the sprite, and then we
develop our own textures utilizing the data." Executed exactly: the
VOXLIGHT RIG is the geometry again (real 3D body, real back and
sides; paperdoll stance on DAGGER_SPEC - C6d/e were not wasted), and
BODY00I0 is the SHADING: every rig face samples the sprite by front
projection (centroid -> feet-anchored, centreline-aligned pixel;
off-silhouette faces clamp to the row's nearest opaque pixel so ramps
stay continuous). The front reads 1:1 with the sprite; faces the
sprite cannot see take the projected-through sample FOR NOW - the
next step develops OUR OWN textures from the classic data (the C6i
ramp machinery: unification, geometric relight, procedural detail -
now applied to the rig's real back/side faces instead of invented
shells). The relief construction (C6f-i) retires from the body path;
spriteRelief.js + its proofs remain as the texture-step toolkit.
Pieces re-seat on the rig with the texture step; &piece is inert
until then.

### C6i-v2 - distinguishability model (SHIPPED)

Mac: "back reads as the front" - v1's structural causes, each fixed:
(1) the material map WAS the front's ramp map, so cross-ramp painted
accents (0x2D nipple/shadow pixels on the 0x40 skin) survived relight
-> skin-hue ramps now UNIFY to the region's dominant ramp before
relight (front forms cannot survive); (2) the hair fill read as a
blank skin blob (classic's own truth: body skin AND hair share the
0x40 browns) -> textured two-tone dither over the front's observed
hair levels, extended through the neck pinch + a darkest hairline
edge; (3) features were sub-pixel -> spine is a real groove
(highlight + 2px shadow, easing to the waist), scapulae are two-tone
plates scaled to torso width, lower-back dip band; (4) global
BACK_BIAS 0.14 (the back turns from the key); (5) the cuirass lames
ECHOED the front's design rows - deleted; a backplate now carries
leather X-straps + buckles anchored on the two shoulder runs (the
gorget top splits around the neck gap - the first anchor pass grabbed
the left run twice) converging to the waist. Material-honest: straps
stay leather under every metal dye; back metal fraction 84.8%.

### C6i - in-house backs (SHIPPED; supersedes C6h)

Mac rejected the RD art ("doesn't read right") and set PROJECT POLICY:
no AI generation - backs derive in-house. tools/derive-back.mjs
replaces the RD tool wholesale; everything comes from data we own:
MATERIAL from the mirrored front's palette RAMP per pixel (ART_PAL
decomposed into shading ramps by luminance/hue continuity), SHADING
recomputed from OUR back-shell geometry (distance-field gradient
normals under one fixed key, quantized back into the same ramp - so
front-baked forms like the face and breastplate design vanish
structurally), DETAIL procedural off landmarks in the front's own
pixels: hair fill (the front's own hair ramp) above the neck pinch,
spine line + scapula highlights across the torso runs (torso run =
the run holding the centreline; crotch = first 2-run row whose gap
straddles it - the mirror shifts margins, so margin tests were wrong
twice: arm-gap side flip, then a centre off-by-one at midX 35 vs 34),
and for armor a centre ridge + lame lines at the rows where the
FRONT's real design changes level ([2,9,14,24]). Deterministic,
classic-palette, dye-band safe by construction (relighting never
leaves the source ramp): final cuirass 100.0% in 0x70-0x7F.
Provenance in the data: derivation 'inhouse-v1' + params.

### C6h - invented backs (SHIPPED)

Mac's mandate: the back receives its OWN detail - invented, not
mirrored. tools/gen-back.mjs: Retro Diffusion img2img conditioned on
the mirrored front (pose + silhouette hold), CLIPPED to the front's
opaque mask (front/back z-fields share the front mask's distance
field, so identical silhouettes make the seam watertight by
construction), holes fill from the mirrored front, colors quantize to
ART_PAL with armor FORCED into 0x70-0x7F so every metal still
resolves on the invented backplate. Committed grids
(src/characters/backs/): body 82.5% newly generated pixels, cuirass
87.3% new at 100% band compliance. Provenance is honest in the data:
rearViewSpace + mirrorFillFraction (the tool's unconditional
mirroredOfFront flag was a defect - fixed). Harness draws front +
back shells per person under the same matrix.

RECONCILIATION NOTE: commit 2ba6413 is a mislabeled sweep - a
parallel session in the same container had already shipped C6g
(1003f16) and staged this C6h work; a tree-wide `git add -A` from the
other session committed the WIP under a duplicate C6g message,
including a throwaway probe (removed here). Lesson reinforced: commit
EXPLICIT paths, reconcile to main before building, and grep the tree
before assuming state.

### C6g - distance-field inflation + the back-shell mechanism (SHIPPED)

The touch-up, at the root: per-row run ellipses bulged independently
(row ridging, paper-thin 1px runs). Depth now comes from ONE 2D
distance field over the whole image (two-pass 3-4 chamfer to the
nearest transparent pixel; z = sign * depth * sqrt(field), corner z =
mean of the 4 touching pixels' field values - shared corners stay
watertight, and the x/y construction is untouched so the identity
witness holds as-is). DEPTH_RATIO 0.9 on the sqrt profile. Normals
come from the quad diagonals (real surface slope). reliefFromSprite
grew the back mechanism for C6h: back:true negates z + flips normals;
field: lets front and back share the FRONT mask's field so both meet
at zero on the same silhouette (watertight seam by construction);
colorBmp: palette indices from a DIFFERENT image over the same mask -
the invented back detail rides the front's geometry. Test pins the
corner arithmetic exactly and the back shell's mirrored z.

### C6f - THE REDESIGN: the body IS the classic body (SHIPPED)

Mac's correction, taken at the root: C6c-e were increments on the
Voxlight soldier (spec numbers, a pose knob) - not the redesign. The
redesign: the SAME 1:1 method that builds pieces builds the BODY.
`spriteRelief.js` - every classic paperdoll image becomes a front
relief in the SHARED 320x200 canvas space it was authored for (DFU
blits body and items each at their own screen offset into one target):
exact-x construction (each opaque pixel's quad IS its canvas pixel, so
the front witness is arithmetic identity), per-run half-ellipse depth
(corners shared -> watertight; DEPTH_RATIO is the one documented
front-view assumption), raw palette indices. Proofs: the whole
BODY00I0 round-trips (face count == opaque pixels, projection ==
sprite) and the offsets pin (body 222,41 / cuirass 237,44 - the piece
lands inside the body span with ZERO fitting; seating is arithmetic on
the classic art's own offsets). The harness now draws the relief body
+ relief piece under ONE uniform canvas->world matrix; the Voxlight
rig exits dagger's paperdoll path (it remains vendored for enemy work,
C8). Render captured; frame verification pending on my side - Mac has
the shot.

### C6e - the paperdoll contrapposto stance (SHIPPED)

Fork step 2 landed upstream (project-final 64a706a): s.paperdoll
{ weightSide, weightIn, freeOut, freeFwd, hipShift } lists the pelvis
over the weight leg and plants the free foot out + forward - the
classic BODY pose the item art seats on; state-gated, 78-case parity
untouched. Arms hang via the EXISTING weapon:'none' armsDown path (a
discovery, not new code - and it kills the C6c forearm-clip artifact).
Re-vendored; the harness body now builds { weapon:'none',
paperdoll:{} } on DAGGER_SPEC with the profile-inheriting shell.
Remaining on the fork: tune the stance cfg against the BODY overlay,
then the posed-width extraction (step 2's payoff) + spec v2 (head).

### C6d - DAGGER_SPEC v1 + profile-inheriting shells (SHIPPED)

Fork step 1 landed: tools/paperdoll-spec.mjs detects the pose-
invariant landmarks (crotch = first 2-run row INSIDE the torso band -
arm-gap rows start far left; armpit = first arm separation; both
genders share the template rows, hashes differ). Adopted into the
GENERATED daggerBodySpec.js: pelvisY 0.961, chest.y1 1.478 (classic
armpit rides high), hipX 0.1392, classic leg length 0.961 split by the
engine thigh/calf ratio. NOT adopted, documented: torso widths (posed
arms overlap - step 2) and shoulder/neck verticals (classic shoulders
~1.75 with an 11px head COLLIDE with the rig's literal head prisms at
1.62 - the spec-v2 driver: head enters the seam). The shell now
INHERITS the body: shellFromSprite/projectFront gained profile mode
(per-row torsoProfile(DAGGER_SPEC) + one 0.03 stand-off, sprite rows
in absolute rig space) - the fixed-radius constants and centre shift
are gone from the piece path; the geometric witness round-trips in
profile mode. Harness body builds on DAGGER_SPEC.

DAGGER_SPEC finding (checkpoint): the BODY images are the classic
CONTRAPPOSTO POSE - weight on one leg, asymmetric arms, one foot
forward (run profile: right arm-gap rows 33-45, left arm 51-69, legs
from ~70, single forward foot 138+). Every item sprite is painted to
seat on THAT POSE, so a symmetric spec from naive silhouette widths
would repeat the pose-measurement bug at extraction scale.
tools/paperdoll-spec.mjs checkpoints as the run-profile + overlay
instrument. The fork (next): (1) pose-invariant landmark spec (heights
+ limb thickness - valid regardless), then (2) a pose-matched
'paperdoll' stance upstream so pieces seat row-for-row - the full
1:1-no-exceptions answer. Both, in that order.

### C6 RESTRUCTURE - the rig redesigned around the outfits (Mac)

The seating-bug class dies at the root: instead of fitting shells onto
Voxlight proportions, the rig's proportions become DATA and dagger's
spec derives from the CLASSIC BODY ITSELF - PAPERDOL.CIF, the canonical
body every item sprite was authored to seat on. Landed upstream-first
as rewrite/rig/bodySpec.js (c893a54): trunk prisms, deltoid caps, hip
anchors + pelvis frames (20 sites), stance width, and leg bone spans as
a spec object on buildBody(s, plugs, spec); VOXLIGHT_SPEC is the old
literals verbatim (their 78-case parity byte-identical, gates 582
green); torsoProfile(spec, y) exposes per-row half-extents so pieces
inherit the body's own profile + one stand-off - no per-piece fit
constants ever again. Head stays literal in v1 (not outfit-seated).
Re-vendored; dagger's 16-hash parity unchanged. NEXT: extract
DAGGER_SPEC from PAPERDOL.CIF per gender/morphology (the same archive
families as the pieces), then one locomotion sanity pass on the new
proportions.

### C6c - the piece on the rig, in-engine (SHIPPED)

`&piece=<template>` (default 102) on the ?voxelfolk harness hangs the
1:1 sprite-shell on the rig: the plate cuirass (human male 251, plate
row 1). FIT LESSON (Mac: "doesn't properly seat"): the first pass
reverse-measured a POSE - the idle forearm crossing the chest
inflated depth to 0.454 (2.2x) and the deltoid caps inflated width;
poses are not bodies. Fit now comes from the rig's AUTHORED chest
prism (y 0.92-1.4, tapering to 0.25 x 0.1903 halves) + 0.03
stand-off: shell radius 0.28 x 0.22, height 0.52, centred at 1.16,
shifted in rig space so the BODY matrix draws both. Known pose
interaction: the idle crossing forearm clips the shell front -
C7's viewport pose is neutral and does not cross. Steel resolve for
the review shot; dye is a parameter. dataPipeline exposes the
palette. In-engine proof: TVRNAL06 patron, pin unchanged.

### C6b - the 1:1 piece method (SHIPPED)

Mac's mandate: 1 to 1, no exceptions - so the sprite's pixels ARE the
piece. `pieceFromSprite.js`: every opaque paperdoll pixel becomes one
face on a shell wrapped around the torso ellipse (column -> front-arc
angle, row -> height), carrying its RAW PALETTE INDEX so materials
resolve per-face through the C5b band swap + ART_PAL exactly as
classic does. Nothing invented: no back faces, no redrawn detail, no
palette guesses. The witness is GEOMETRIC, not bookkeeping -
projectFront recovers each face's source pixel from its midpoint
angle/height and rebuilds the index grid; on the real plate cuirass
(251, plate row 1) the round-trip reproduces the sprite EXACTLY with
face count == opaque pixel count, and Steel/Iron resolve to their
table colors per face. Next: C6c renders the piece on the rig
in-engine - the DECIDE-C1 review shot.

### C6a - paperdoll art addressing + the reference extractor (SHIPPED)

`paperdollArt.js`: variant record resolution verbatim (record = base +
variant, cloaks +1 past their interior image - real template indices
154/155/191/192), and the FULL armor addressing chain that the first
extractor pass missed: gender picks the archive family (F 245 / M 249),
race adds the body-morphology offset (Argonian 0 / Elf 1 / Human 2 /
Khajiit 3 - human male = 251), and the MATERIAL FAMILY selects the
variant row via the SetVariant clamp tables (Cuirass leather 0 / chain
4 / plate 1-3; Greaves, Pauldrons, Gauntlets, Boots each their own).
Leather + chain rows are Unchanged-dyed; plate rows author in the
0x70 band and take the C5b metal tables. tools/paperdoll-ref.mjs dumps
material-correct sheets (rows x metals, 3x). The FLAWED first pass -
flat variants x metals dyeing brown leather art with tables that
touch nothing - was caught by the band-coverage pin before anything
shipped or was presented; the pin now asserts BOTH directions (plate
> 0.5 in-band, leather < 0.1). pngjs promoted to a real devDep.

C4-C5 audit: import scan clean across every slice file; 288 template
indices unique; Wand (140) is the one unruled jewellery template -
DFU's default None, verbatim. The requested joint verification went
past hash parity to MATH invariants (rigmath.test.js: bone lengths
exact by construction, reach + both clamps, pole half-plane, finite
degenerates) and caught one real defect: a target exactly AT the root
left solveTwoBone's direction vector zero, collapsing both bone
lengths. Fixed UPSTREAM-FIRST in project-final (reach defaults down,
fold clamp takes it; Voxlight's 78-case parity hashes identical since
no fixture case is degenerate; their gates green), then re-vendored -
dagger's 16-hash parity unchanged. Rig redesign verdict: the solver is
sound and now hardened; body PROPORTIONS stay untouched by design -
retuning is a C6 art decision against the classic paperdoll reference,
made upstream behind the parity gate, not an audit unilateral.

### C5c - equip-slot assignment rules (SHIPPED)

`equipRules.js` (extraction-generated: 94 per-template slot rules
across Armor/Jewellery/Mens/Womens with full enum coverage, 18 weapon
hands, the 4 shield indices) + `equipTable.js` verbatim:
GetFirstSlot's first-open-else-first pairing, the group router,
weapons by hands with the 2H right-hand replacement rule, shields
LeftOnly, gems to the Crystal pair. Bows carry DFU's
BowLeftHandWithSwitching setting - its default (false) IS the
classic Both, which we port (the setting itself is a DFU enhancement,
not classic). Corpus test proves every clothing/armor/jewellery
template resolves to a real slot. C5 COMPLETE - the paperdoll system
is fully data-live. Next: C6, the first authored piece.

### C5b - dye + material tint tables (SHIPPED)

`dyes.js`: the classic tint mechanism verbatim from ImageProcessing -
ChangeDye's 16-index band swap (clothing sprites author in 0x60-0x6F,
weapons/armor in 0x70-0x7F), the ten clothing dyes as pure range
shifts (Blue identity at 0x60, Red at 0xEF), and the eleven metal
tables EXTRACTION-GENERATED from GetMetalColorTable. DYE_COLORS
carries the compatibility aliases at 18 (Chain/Unchanged/Silver).
C6 pieces author their colors as band indices and resolve through
applyDyeToIndex + ART_PAL - the variant system IS the classic one.
Next: C5c GetEquipSlot assignment rules.

### C5a - paperdoll data spine (SHIPPED)

`paperdoll.js`: the 27-slot EquipSlots table verbatim (ItemEnums), and
DFU's ItemTemplates.txt committed whole as itemTemplates.json - 288
classic templates, each wearable carrying its OWN paperdoll layer
(drawOrderOrEffect -> item.drawOrder, straight assignment) and variant
count; paperdollOrder mirrors BlitItems (ascending drawOrder). Next:
C5b dye/material tint tables, C5c GetEquipSlot assignment rules.

### C4b + C4c - character render path + ?voxelfolk (SHIPPED)

C4b: dagger's renderer grows the character path - CHAR_VS/CHAR_FS are
the mesh program's lighting + fog verbatim over a vertex color (no
texture, no emission, no cutout), fed by the pure packer in
render/characterMesh.js (rig faces fan-triangulated into interleaved
pos/color/normal, REAL normals - dagger lights in-shader, no Voxlight
cel bake or pixel-lock ref slot). drawCharacter owns its program
binding (the R9 rule) AND the cull state: rig winding is inconsistent
by upstream design, so GL back-face culling is disabled per draw and
restored. C4c: ?voxelfolk swaps interior people billboards for ONE
packed bare humanoid drawn per person - uniform scale to 1.8, feet on
the billboard base (ty = y - minY * s), static facing until the
animation slice; flag off is C1 untouched. __peopleList joins the
probes. In-engine: TVRNAL06 patrons stand as the 710-face body under
interior ambient + point lights, framed on camera; pin unchanged
(`2 people`). DECIDE-C1 is now LIVE.

### C4a - Rewrite rig vendored (SHIPPED)

project-final's Rewrite Engine core + rig (math/geometry/palette,
limb/body/muzzleFlash - 6 modules, flat-pathed under
src/characters/rewrite/) with a vendor-time parity gate: 16
bare-humanoid cases (loco x hold + plug-free specials) hashed exactly
like Voxlight's 78-case fixture, captured from the canonical
rewrite/rig - the vendored copy is byte-identical (710 bare faces).
render/ stays Voxlight-side; dagger's renderer grows its own
vertex-color character path next (C4b), then one townsfolk archetype
behind ?voxelfolk (C4c) - DECIDE-C1 goes live there.

## DECIDEs (Mac)

- **DECIDE-C1 (RESCOPED at the pivot)** - equipment-piece art review
  cadence: per piece as authored, or batch a slot set then review.
- **DECIDE-C2 (RESOLVED)** - inventory paperdoll presentation: live
  rotating 3D viewport (not a baked sprite). Mac, 2026-07-03.

See: 01-Overview/Port-Ledger.md section C rows routed here.
