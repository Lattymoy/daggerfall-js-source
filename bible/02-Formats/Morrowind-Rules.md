# Morrowind first-person: the rules, from the reference implementation

STATUS (2026-08-30, PAUSED MID-REBUILD - read this first).

WHERE THIS STANDS. The first import arc was reverted whole on 2026-08-28
after four failed fixes. The rebuild since is deliberately staged, and
each stage is provable on the player's own data before the next begins:

  MW-1  the format layer RESTORED (BSA, NIF, DDS, skeleton, anim, ESM,
        character, NPC + the mesh viewer). It was never what failed.
        MW7's .1st-filename helpers were STRIPPED on the way in - that
        rule is disproven; see Part VI.
  MW-2  the data plumbing and attach door. NO 3D toggle: there is no rig,
        and a switch for one would be the screen lying about the build.
  MW-D  the inspector at mw-inspect.html - what is genuinely IN the
        player's archives. MW-D2 skinned-vs-rigid, MW-D3 real parse +
        wireframe, MW-D4 the bones the rules name, MW-D5 assembly at
        rest pose, MW-D6 the assembled arm DRAWN - and the defect that
        drawing found (below), MW-D7 an idle CLIP played through that
        assembly.
  MW-D8 THE ARM IS IN THE GAME. Untextured, idling. See below -
        including the two defects that only DRAWING IT found.
  MW-D9 AND THE WEAPON IS IN THE HAND. Rule 8's whole attach-bone
        column, and the Daggerfall->Morrowind mapping DECLARED.
  MW-D9e THE REGISTRY IS NO LONGER THE BOTTLENECK. A 4.0.0.2 record has
        no size field, so ONE unimplemented type ends the whole file -
        that is what a NiCamera did to a first-person skeleton (MW-D9d),
        and what the next particle emitter or light would have done to a
        mesh. The reader went from 27 record types to 59: every type a
        Morrowind-era file can hold, each layout nif.xml-gated to
        4.0.0.2, each pinned against a fixture. Two are knowingly out
        (NiSkinPartition's struct is ver1 4.2.1.0; three types OpenMW
        registers have no nif.xml layout at all) and the reader's header
        names them, so a refusal is now a real gap rather than a queue.

MW-D11 PUT THE TEXTURES ON (rules 36/61). The arm was flat skin tone
because the port had no texture path at all; it has the reference's now,
whole. Rule 36 is not "prepend textures/": Bethesda converted the BSA
textures from TGA to DDS and left every NIF reference saying .tga, so
correctResourcePath re-roots at the first WHOLE `textures`/`bookart`
component that is not the last one - discarding everything before it,
which is how `D:\Bethesda\Data Files\Textures\tx_hand.tga` resolves -
swaps the extension, and probes four candidates. When all four miss it
returns the .DDS candidate rather than the authored name, so the open
fails and the caller gets ImageManager's 8x8 MAGENTA warning image. That
is the rule: a missing texture is neither a refusal nor a silent skip, it
is a texture that says it is missing. The port's own skin-tone fallback
is retired with it - the reference's fragment starts at opaque white with
no diffuse map and overrides the NIF material defaults to white.

ONE HOME: the mesh viewer carried its own two-line version of the path
(a prefix and an extension swap) which got three of the rules wrong; it
imports formats/mwTexture.js now.

MW-D12 GAVE THE ARM SOMETHING TO DO (rules 8, 9, 10, 11). What MW-D11
shipped was an arm holding a longsword and playing a BARE-HANDED idle for
ever - one hardcoded group name, no draw, no swing, no sheathe. The
groups are composed now, off the reference's own two tables, and the
sequence is character.hpp's own UpperBodyState:

  None -> Equipping -> WeaponEquipped -> AttackWindUp -> AttackRelease
       -> AttackEnd -> WeaponEquipped, and Unequipping -> None.

TWO COLUMNS THE PORT HAD NEVER READ. weapontype.cpp gives every type a
CLASS (Melee, Ranged, Thrown, Ammo) and FLAGS (TwoHanded, HasHealth), and
both fallback ladders are gated on `isRealWeapon` - which is a
THREE-NAME test, `!= HandToHand && != Spell && != None`, and PickProbe
IS a real weapon by it. Without that gate:

  - a bare-handed player whose .kf has no `idlehh` idles in `idle1h`,
    the one-handed SWORD stance, fist raised as if holding a blade;
  - a missing `handtohand` becomes `weapononehand`, so empty hands MIME
    a sword swing.

Both are now the reference's answers instead: the bare `idle`, and no
weapon animation at all. The two-handed test is likewise TWO tests -
`mFlags & TwoHanded && mWeaponClass == Melee` - because Spell and
HandToHand carry the flag and a bow is TwoHanded AND Ranged, so a port
testing the flag alone sends three types down the wrong ladder.

RULE 10's DICE ARE OFF BY ONE FROM ITS OWN COMMENT, and both readings are
in the file: `numLoops = 1 + rollDice(4)` is 1..4 WRAPS, which is the
comment's "2 to 5" PLAYS. A port that takes the comment's number as the
loop count idles half again as long as Morrowind does, and no screenshot
would say so. The roll is also CONDITIONAL: numLoops starts at uint32 max
and only becomes the dice when the stance HAS a weapon short group, so a
sheathed arm idles without end and a drawn one runs to its stop key every
few seconds. The loop needs loopFallback, without which the idle plays
once and freezes - which is what MW-D11's arm actually did.

RULE 11's ATTACK TYPE IS A KEY PREFIX, never part of the group: one
`weapononehand` group holds chop, slash and thrust, each as
`<type> start` -> `<type> max attack` -> `<type> hit` (`shoot release`
for a bow, which also has no strength word in its follow keys).
calculateWindUp is a ratio with a -1 SENTINEL rather than a zero, because
prepareHit replaces -1 with a random blow and would replace 0 with
nothing; the release's skip-ahead is ordering-tested throughout and never
sentinel-tested, which is rule 46's recorded caveat applied rather than
quoted.

THE SHEATHE IS NOT THE DRAW BACKWARDS. Drawing sets the weapon type as
the equip animation STARTS (character.cpp:1495), so the stance becomes
`idle1h` at once; sheathing holds the old type until the unequip
animation ENDS (:1857). Flip it early and the unequip section is looked
for in the bare-handed group, so the weapon blinks out instead of being
put away.

AND `showWeapons` HIDES RATHER THAN REMOVES, which is rule 57's own
distinction: the weapon is a per-range flag the draw loop skips, not a
shorter vertex stream. Repacking without it would change the buffer's
length every time you drew or sheathed, orphaning the ranges the textures
hang on.

THE DIVERGENCE, RESTATED WHERE THE CODE IS. Daggerfall picks its attack
by GESTURE and Morrowind by MOVEMENT or by the weapon record's damage
spread; the port maps the six strikes onto the three types BY THE SHAPE
OF THE MOTION and says so at the table. A second divergence falls out of
it: a Daggerfall swing has no charge, so the wind-up is never held at max
attack and the blow releases at full strength - the reference's own
behaviour for a button released at the top of the window. The HELD
wind-up the bow would need is wired to the port's machine (state
StrikeUp) rather than to "is it a bow", because the in-game bow is DFU's
BowDrawback-OFF instant shot; it becomes live the moment that path does,
with nothing in the arm to change.

AND THE RENDERER LEARNED A TRAP. A sampler is "used" whether or not the
branch that reads it runs, so texture unit 0 must always hold a complete
texture: with nothing bound, the driver drops the whole draw. Measured
the moment the UV channel landed - the arm's offscreen target went from
203 lit texels to 0, with no error, no warning, and a program that links
clean.

AND THE ARMS WERE IN THE WRONG PLACE EVEN ONCE THEY DREW (MW-D10). The
port mapper is retired for rule 54 and the Z-up rig now turns into the
renderer's Y-up basis - see below. The measurement that could have
caught either is new too: tools/mwRigProbe.mjs asks WHERE on the screen
the ink landed, not just whether there is any. Every earlier layer asked
"are there lit pixels" or "is the model x-symmetric", and a mis-framed
arm answers yes to both.

WHY A BUILT ARM DID NOT APPEAR, TWICE (MW-D9f, MW-D9g). Both causes sat
in the SEAM between the arm and the game, and neither was reachable by
anything that existed: the node pins call fpArm.update() directly and
mwArmProbe drives its own loop, so both ran the ENGINE and neither ran
the CALLER. (1) MW-D9f: active() requires a GPU mesh, update() is the
only thing that creates one, and the rig gated update() on active() - a
deadlock, so a built arm never ran a frame. (2) MW-D9g: _mwCount started
at -1, so the FIRST registerMorrowindData() always saw a "change" (an
empty store went -1 to 0) and bumped the data generation; shared.js
starts that call at host boot without waiting, while createWeaponRig
latches the generation synchronously in the same setup, so the rig's
first frame unloaded whatever the player had built. Building from the
main menu could not survive to frame one.

THE MEASUREMENT THAT WAS MISSING is now tools/mwRigProbe.mjs: the REAL
createWeaponRig, a REAL WebGL2 renderer, the host's own frame()/draw()
order, reading the DEFAULT framebuffer and comparing against the same
frames with the arm unloaded. Its first version counted lit pixels and
answered 691200 of 691200 - the whole screen, because the canvas is
opaque - which is the same trap MW-D6 recorded and is why the pin is a
DIFFERENCE, not a count.

WHERE THE AUTHORITIES DISAGREE (MW-D9e), and what the port reads. The
fixtures are pyffi-authored on purpose - an independent implementation -
but pyffi's nif.xml is old, and three records caught it out. (1) It omits
NiExtraData's `Num Bytes` from five subclasses; nif.xml gates that field
ver1 4.0.0.0 / ver2 4.2.2.0 and OpenMW's Extra::read reads it for every
extra record at 4.2.2.0 and below, so the port reads it and those
fixtures are hand-written. (2) It splits NiParticleSystemController's ten
spawn bytes uint/uint/ushort where nif.xml and OpenMW read ushort + two
floats; the port takes the second reading. (3) It writes 256 palette
entries whatever the count says, and nif.xml says the array is 16 long
when the count reads 16 and 256 otherwise - OpenMW just reads the count,
and so does the port, because the count is what the retail files hold.
Rule for the next disagreement: nif.xml gives the LAYOUT, OpenMW settles
what the retail bytes actually mean, and pyffi is a witness, not a judge.

CONFIRMED ON RETAIL DATA (Mac, 2026-08-29): the archives parse, the arm
meshes parse, and the wireframes DRAW. Part VI has the rest.

MW-D6 FOUND A DEFECT BY DRAWING, WHICH IS THE POINT OF DRAWING.
assembleFirstPersonArm latched after the FIRST bone that yielded skinned
geometry. Every arm slot is two-boned - `PART_BONES.hand = ['left hand',
'right hand']` - so it emitted the LEFT hand and never asked for the
right, and rule 15's filter, which exists solely to pick a side, ran once
and was then skipped. On retail data that is a ONE-HANDED ARM.

Rule 4 is what the latch contradicted: sPartList is a MULTIMAP,
`{ MP_Hand, PRT_RHand }, { MP_Hand, PRT_LHand }` - one mesh part, two
slots, each side its own reference at its own bone. This document already
warned that the first attempt "treated a part as one mesh attached at two
bones in one pass"; the latch was that same error wearing the other face,
and it was written by the slice that quoted the warning.

A latch is still needed, but only for the port's own EXTENSION to rule 15
(a nameless shape matches every bone, where OpenMW's
`ciStartsWith("", filter)` is false and the engine drops it) - that one
binds once per part or it stacks duplicates in the same place.

WHY MW-D5's TESTS COULD NOT SEE IT: every fixture spoke
SkinRoot/Bone0/Bone1 and named its shapes "Skinned"/"PartSkin", so
assembly never ran with two bones at all. MW-D6 authored four fixtures in
Morrowind's OWN vocabulary through the same independent writer
(armskel/armhand/armcuff/armnameless, generate.py), which also CLOSES the
two gaps MW-D5 recorded as unreachable: rule 15's ACCEPT path and rule
13's mirror DERIVATION now run end to end with no test-only override.

AND THE PROBE'S OWN LESSON, measured: with the latch reinstated the page
still lights 1116 pixels. A lit-pixel count - the obvious measurement,
and the one MW-D3 uses - PASSES a one-handed arm. It took two more
layers to catch: x-symmetry off the downsampled canvas (0.63 against
0.99) and a signed per-piece readback (3 pieces, `left hand` only). THE
MEASUREMENT HAS TO BE ABLE TO FAIL THE WAY THE CODE ACTUALLY FAILS.

MW-D7 PLAYED THE CLIP. The blocker the last status line named is closed:
`assembleFirstPersonArm` now SPLITS bind from pose. Each piece keeps what
a re-pose needs (a skinned one its batch, a rigid one its authored
positions and attach ref, both their own output buffer), the assembly
carries the skeleton, the root ref and its resolved readers, and the one
home for per-frame math is `poseAssembly`. The rest pose became "pose at
t=0 with no tracks" - the same arithmetic, called once instead of inlined
- so all 26 MW-D5/D6 pins keep seeing byte-identical numbers.

The clip law itself is four OpenMW members that had no JS home, ported
into mwAnim.js beside the text keys they read: `TextKeyMap::emplace`
(rules 44/45/21), `Animation::reset` (22/23/49), `AnimState::shouldLoop`
(49) and `Animation::runAnimation`'s stepping (50). NOT a modulo of the
group range.

WHAT MW-D7 HAD TO BE ABLE TO SEE, and could not have with MW-D6's
measurements. `poseSkeleton` answers a bone with no matching track by
handing back `node.rest` - correct, and the deadliest silent failure in
this stage. A .kf keyed to bones the skeleton does not have poses NOTHING
and draws a clean, static, entirely plausible arm: no error, no empty box,
a perfect symmetry score and a full pixel count. Three things exist to
catch it: `trackBinding` in mwSkin.js (the poser's OWN comparison, so the
report cannot agree with the page while disagreeing with the pose), the
page saying "an unmatched track poses nothing - the bone holds its rest
pose, which looks exactly like a working idle", and a probe layer that
hashes the canvas at six clip times and demands five distinct pictures.
A seventh layer watches the LIVE canvas across real frames, because every
other layer drives the pose itself and passes a page frozen on frame one.

AND THE LOOP LAW IS THE PART THAT SEPARATES CORRECT FROM PLAUSIBLE. A
`% span` player moves, stays symmetric, and draws - and replays the
clip's INTRO on every wrap instead of the authored loop segment. Only a
trace can tell them apart, so the probe runs the page's own advanceClip
and asserts, in time-space AND in pose-space, that after the first
`loop stop` crossing the playhead never re-enters [1.0, 1.5) and the
right hand never returns below x=1.4.

MEASURED FINDINGS FROM MW-D7:

  F1  A TRACK ON THE SKELETON ROOT REACHES NO GEOMETRY, BY CONSTRUCTION.
      `bindPart` sets `skeletonRoot === rootBone`; `skeletonSpaceMatrices`
      makes the skeleton root identity; `skinToSkelMatrix` returns
      identity when the two are equal. So keying `Bip01` moves nothing,
      skinned or rigid. MW-D7 therefore pins accum-root extraction AT THE
      POSE (`pose.get(bip01).translation` is [0,0,0] with `accumRoot` and
      [1,0,0] without) and states in the test that the pixel version
      cannot fail on this rig. The geometric pin stays where it is real,
      on the SkinRoot/Bone0 fixture, where the tracked bone is BELOW the
      skin root.
  F2  `Infinity` does not survive `page.evaluate` - rule 49's default
      `loopStopTime` JSON-serialises to `null`. `clipReport` carries
      `loopStopFinite` beside the number so a probe never asserts on a
      null it cannot read.
  F3  `parseAnimGroups` produces a NONSENSE BUT NON-NULL group for data
      that exercises the rules: on armidle.kf it reads `Idle [1.00 ->
      0.50]`, a range that runs backwards, and is not deleted (the guard
      only drops nulls). `mwViewer`'s `span = max(stop - start, 1e-6)`
      would freeze on it. The page now shows both answers side by side.

BOOKED, NOT DONE - each named here so it is not inherited silently:

  * `mwViewer.js:342-348` is now a SECOND HOME for clip time, and the
    worse one: `% span` with no loop window, a case-SENSITIVE
    `groups.get` that bypasses findAnimGroup's own MWAUDIT fix, and
    `accumRootRef` recomputed every frame. MW-D8's first task: replace
    it with advanceClip or delete it.
  * `parseAnimGroups` diverges from rules 21/22/44/45 in four ways
    (splits on `\r\n` as a pair, accepts `Group:Marker`, compares the
    stop marker exactly, takes file order rather than rule 22's reverse
    scan). Deliberately NOT re-based here: three MWAUDIT pins assert its
    present behaviour, and mixing that into the first slice that animates
    anything would make a failure ambiguous. Its own audit slice.
  * `KEY_TYPE.constant` is sampled by holding the previous key; the
    reference flips at the segment midpoint with a strict `>`. Different
    member, no fixture drives it. `clipReport` names the interpolation
    type PER CHANNEL so a player can see how much of their own file rides
    it, which is the most this slice can honestly offer.
  * `track.frequency` / `phase` are read from every controller and used
    nowhere. Unchanged, and now printed.

AND THE HONEST SENTENCE ABOUT armidle.kf: no observation of a retail
`xbase_anim.1st.kf` exists anywhere in this repository. Part VI records
four skeletons and 1,125 body records and says nothing about the KF. So
the fixture's SHAPE is read off OpenMW; its CONTENT is an assumption
about retail idle data, and generate.py says so at the maker.

MW-D8: THE ARM REACHES THE SCREEN, and "nothing MW touches the game" is
no longer true. It is opt-in, off by default, and behind a button on the
Enhanced pane's Morrowind card.

NO RENDERER CHANGE WAS NEEDED, which was the surprise. The port had
ALREADY shipped a first-person pass: renderCharacterSprite
(render/renderer.js:751) binds an offscreen target with its own depth
renderbuffer, clears colour and depth, SWAPS the frame's proj/view for
ones the caller hands it, draws, and restores; drawScreenOverlayQuad
(:987) composites it fullscreen with an alpha cut and no depth test. It
was written for a voxel viewmodel that was put on ice in August and has
had no consumer since. Two recorded rules fall out of it for free:

  rule 29 - the first-person subtree renders with its OWN field of view.
    We hand the pass `perspective(Math.PI/3, ...)`, which IS the 60-degree
    default, and the proj/view swap is exactly the mechanism for it.
  rule 52 - first person gets a bin whose draw CLEARS DEPTH first, so the
    arms are never clipped by the world. Here that is STRUCTURAL, not
    emulated: no world geometry is ever drawn into that framebuffer, so
    there is nothing to be clipped by.

THE TWO DEFECTS DRAWING FOUND, both invisible to every node test:

  D1  THE ARM RENDERED NOTHING - 0 lit texels - with a build that
      otherwise reported four pieces bound and five clip tracks matched.
      The placement was copied from the voxel viewmodel, which pushes its
      rig BACKWARD from the eye and says why: that rig is the player's
      whole BODY, the camera rides its head, and without the push you
      render the inside of your own torso (Mac's "stuck in a hole"). This
      assembly is arms ONLY. There is no head to hide, so the same push
      put every triangle behind the lens. Arms go IN FRONT of the eye and
      BELOW the view axis.
  D2  THE ARM SWUNG AROUND THE PLAYER AS HE TURNED. The model matrix
      spins the mesh about its own origin, so the centre offset has to be
      ROTATED before it is backed out of the translation. Subtracting it
      unrotated left the arm yaw-dependent: 60 lit texels facing one way
      and 20 facing another with the pose held still. A still screenshot
      cannot show this. Only a yaw sweep can, and the probe only got one
      because the MUTATION CAMPAIGN pointed out that at yaw 0 the sine
      term vanishes and an x-axis error is invisible.

WHAT IT DRAWS, so nobody mistakes a scope boundary for a bug: UNTEXTURED
grey flat-shaded arms, no weapon in them, playing bare `Idle` forever.
Rules 36 and 61 (the texture path search, the positional slots) are
deferred WHOLE, so there is no texture lookup and therefore no magenta
miss-signal either. Flat shading comes from a face normal computed per
triangle at pack time - and for a MIRRORED piece that normal is NEGATED,
because rule 13's X negation reverses the winding and without it the left
arm lights inside-out. That is rule 13's rendering consequence, which MW8
also lacked.

THE PORT MAPPER IS RETIRED (MW-D10), AND RULE 54 IS THE PLACEMENT. The
mapper solved a uniform scale from the arm's clip bounds, pushed it a
constant distance in front of the eye and dropped it a constant below -
recorded at the time as "a PORT DECISION, not a claim of parity", and
deferred because the actor-scale rules it seemed to need are tier C. It
needed none of them. Rule 54 puts the camera INSIDE the rig
(camera.cpp:346-357: `getNode("Camera")` then `getNode("Head")`, and in
first person no height term at all), so the arms are wherever Morrowind
authored them relative to that node, at whatever scale the file uses,
and there is nothing to convert or fit. The neck takes 0.75 of the look
(npcanimation.cpp:719) so the arms lag it, and the lens is
settings-default.cfg's 60 degrees.

WHAT IT LOOKED LIKE UNTIL THEN, from Mac's screenshot: two forearms
adrift at the horizon, detached, end-on. Two faults, and the second hid
inside the first. A Morrowind NIF is Z-UP with +Y forward and this
renderer is Y-UP with -Z forward, and NOTHING in the chain converted
between them - not the reader, the flattener, the assembly or the pass -
so the rig was drawn lying on its side; the fit-to-span framing then
scaled whatever bounds that produced and landed it "plausibly". A
90-degree frame error survived three probes and a mutation campaign
because every assertion was in MODEL space, and model space cannot see
the frame it is drawn in.

A rig with neither node is REFUSED by name (stage `camera`). There is no
third fallback in the reference and there is none here.

MEASURED, and by what. tools/mwArmProbe.mjs drives the REAL fpArm through
its deps seam in a real browser against a real WebGL2 context, and reads
the offscreen target back: no-data refuses without a broken screen; the
build takes rule 6's skeleton; four pieces bind; the target has ink; the
arm is in front of the player at EVERY heading; both hands bind and each
sits on its own side of x=0 at rest; the picture changes across the clip
in 7 distinct frames and opens to 67% of the frame width while staying
x-symmetric at 0.86; the loop window is discovered by crossing; a .kf
keyed to foreign bones REFUSES at the clip stage rather than drawing a
static plausible arm; and Unload returns the classic sprite.

WHAT THE PROBE CANNOT SEE, stated rather than implied: it does not boot
the game, because that needs ARENA2 and the player's own Daggerfall data.
weaponRig's branch, the four hosts' camera dep and the card are pinned in
node (test/fparm.test.js, test/mwattach.test.js, test/enhancedMenu.test.js)
and proven by Mac in play. Three mutation campaigns back them: 12/12 on
the wiring pins, 6/8 on the probe layers, 24/24 inherited from MW-D7.

TWO PROBE MUTANTS SURVIVED AND ARE RECORDED RATHER THAN PAPERED OVER. A
mapper recomputed per frame still changes the picture, so no pixel layer
can separate it from a correct one - it is pinned on the SOURCE instead
(the draw reads built.framing and never arm.bounds). And an active() that
drops its clip-state term is neutralised by the mesh term, which is
deliberate defence in depth, not a hole.

TWO SHIPPED PINS WERE STRENGTHENED, NEITHER LOOSENED. MWFIX's "the
classic sprite path is the ONLY path" named its own successor in its
comment - "when the rig returns this reverts to the else-of-an-active-view
form" - and that is what it now is, asserting the ORDER and the RETURN
where it used to grep one literal it could not condition on. MWFIX 3,
absent on purpose since the revert because no code had the mechanism, is
RESTORED: the rig polls morrowindDataGeneration() and drops a stale arm,
so attaching data mid-game is never silently ignored again.

MW-D9: THE WEAPON, AND IT NEEDED NO NEW ATTACH PATH.

A Morrowind weapon is a RIGID part at a bone - rule 12's rigid half, the
same path armcuff has proved since MW-D6 - so it rides into the assembly
as one more part with an explicit `bones` override instead of the
PART_BONES table. Rule 17 IS that override: the generic "Weapon Bone" is
replaced by the equipped type's own attach bone when the actor has that
node.

RULE 8's WHOLE COLUMN, not four classes. The reverted arc had four
weapon classes where the reference has fourteen types, so every
one-hander was forced onto one group and every weapon onto one bone.
MW_WEAPON_TYPE carries all eighteen enumerators including the four
NEGATIVE pseudo-types, read off components/esm3/loadweap.hpp - explicit
values, every one. WEAPON_ATTACH_BONE carries the three rows that differ
from the default: MarksmanBow -> "Weapon Bone Left", Arrow -> "Bip01
Arrow", Bolt -> "ArrowBone". A crossbow is NOT a bow for this purpose,
which is exactly the row a four-class taxonomy gets wrong by
construction.

AND THE BOW COMES OUT MIRRORED, which is faithful, surprising, and
written down here so nobody later "fixes" it. Rule 13's mirror is a
SUBSTRING TEST on the attach bone's name, and the function it lives in -
SceneUtil::attach, components/sceneutil/attach.cpp - is the GENERIC
attach path for every part, not a body-part-only one (checked at source,
not recalled). "Weapon Bone Left" contains "Left", so the bow is drawn
with X negated by the very same rule that mirrors the left hand. Nothing
in this port special-cases it, and the probe pins it: the bow is the
sword's own mesh with X negated, exactly, to within 1e-3.

WPDT IS CITED, NOT GUESSED. components/esm3/loadweap.hpp:71 - float
mWeight; int32 mValue; int16 mType; uint16 mHealth; float mSpeed,
mReach; uint16 mEnchant; uchar mChop[2], mSlash[2], mThrust[2]; int32
mFlags. mType is therefore at byte 10, and a record shorter than 32
bytes is REFUSED rather than read past: a wrong type is not a visible
failure, it is a sword drawn on the bow's bone in the wrong hand looking
entirely deliberate. That branch is unreachable by any fixture and is
pinned in node with a hand-built short record.

THE DIVERGENCE IS DECLARED, WHICH THIS DOCUMENT ALREADY DEMANDED. Its
own words: any mapping from Daggerfall's weapon taxonomy onto the short
groups "is a PORT DECISION, not a ported rule, and belongs in the
recorded divergences with its reasoning visible - not inferred inside a
lookup table where the last attempt hid it twice." So DF_TO_MW_WEAPON is
exported, pinned row by row, and keyed by the port's own WEAPONS
TEMPLATE INDEX rather than by the sprite layer's WEAPON_TYPES - which
folds a Claymore and a Longsword into one class and therefore cannot
tell a one-hander from a two-hander. The rows that are judgement rather
than translation: FLAIL (Morrowind has none; BluntOneHand is the nearest
thing that exists, and nothing here is right), STAFF -> BluntTwoWide,
and CLAYMORE / DAI-KATANA -> LongBladeTwoHand, which costs them
Daggerfall's own one-handed animation and is a behavioural change rather
than a mesh swap.

REFUSALS, because a substitute is worse than an empty hand: a type your
archives do not carry draws NOTHING and says so on the card; an
enchanted record is never taken (it carries a glow this slice does not
draw); a missing attach bone is NAMED; and none of these fail the arms -
you get the arms, empty-handed, with the reason next to the button.

AND ONE MORE DEFECT THAT ONLY RENDERING IT FOUND - THE HANDEDNESS.

mat4's own law (src/world/mat4.js:90-115): a right-handed lookAt puts
world +x on screen-LEFT, and the port shipped exactly that mirror image
until M1 - every town flipped east-west, every sign reading backwards,
and the input layer tuned against the mirror so it PLAYED correctly and
only text could tell. The fix is ONE mirror at the projection, and EVERY
world pass rides it.

The viewmodel pass this technique was borrowed from does NOT, and the
note beside it gives the reason as "its pass never culls" - which is why
it was SAFE to leave unmirrored, not a claim that it was right. MW-D8
inherited that, and for an arm it is not a nicety: MEASURED, a point one
metre to the player's right lands at NDC x -1.96 through the unmirrored
lens and +1.96 through a world pass. The arm was a mirror image of the
world composited under it - the sword hand on the wrong side of the
screen, every left hand a right one, and NOTHING in the picture saying
so, because an arm looks like an arm either way.

Fixed at MW-D9: the arm's projection takes mirrorProjectionX like every
other pass. It costs nothing, for the same reason the original note
gives - drawCharacter disables back-face culling for its draw, so the
winding flip a negative-x scale causes has no consequence.

WHY NO EXISTING LAYER CAUGHT IT, which is the lesson rather than the
bug: every left/right assertion in the probe and the pins is in MODEL
space (piece bounds), and x-symmetry is symmetric under a mirror by
definition. Nothing measured which side of the SCREEN a hand landed on.
The pin is now analytic - the arm's lens and a world lens must agree on
the sign of +x - with a probe layer that reads the framebuffer at a clip
time where the arms are UNCROSSED, since at the clip's start they swing
across each other and either answer looks right.

NEXT, IN ORDER: (1) the texture - rules 36 and 61, which needs a dynamic
vertex door on the textured program and a DDS upload, and is now the
single biggest visible gap; (2) attack clips - rules 10 and 11, whose
keys are namespaced by the LONG group; (3) rule 54's camera bone, now
that the build reports whether the data has one, which retires the port
mapper. Also booked from MW-D7 and NOT done: mwViewer.js:342-348 is
still a second home for clip time.

THE STANDING RULE FOR THIS WORK: no stage is "done" until it is visible
on the player's own files. Four fixes shipped green and broken because
nothing could see them.

Original status line: reference only. No code in this tree implements this yet - the
first import arc was reverted whole on 2026-08-28 (see the R7 guard in
test/enhancedMenu.test.js). This file exists so a second attempt starts
from what the engine ACTUALLY does instead of from what seemed
reasonable.

WHY THIS FILE EXISTS. The first attempt shipped three "fixes" for one
bug report and none of them worked. Every one was built on a guess
about Morrowind's conventions, verified against a fixture I had
authored from the same guess, and reported green. The port cites
Daggerfall Unity's C# line by line for everything else in this
repository; the Morrowind layer cited nothing, and that is the whole
difference.

SOURCE: OpenMW, the reference implementation, at master. Citations are
`file:line` and were read directly, not recalled.

---

## 1. A first-person body part is a RECORD, not a filename

```cpp
bool isFirstPersonBodyPart(const BodyPart& value)
{
    return value.mId.endsWith("1st");
}
```
- `components/esm3/loadbody.cpp:85-88`

The discriminator is the **BODY record's ID**. The engine never
transforms a mesh path. It looks up a DIFFERENT RECORD whose id ends
in `1st` and uses that record's own MODL, whatever it happens to be.

In the equipment path the lookup is literally id + ".1st":
```cpp
const char* ext = (mViewMode == VM_FirstPerson) ? ".1st" : "";
bodypart = partStore.search(ESM::RefId::stringRefId(part.mMale.getRefIdString() + ext));
```
- `apps/openmw/mwrender/npcanimation.cpp:879, 901`

FIRST ATTEMPT GOT THIS WRONG IN KIND. It inserted `.1st` before the
file extension of the MODL path (`b\B_N_Nord_M_Hand.nif` ->
`b\B_N_Nord_M_Hand.1st.nif`) and asked the archive for that file. The
engine does not do this, and there is no reason a mesh must be named
that way.

## 2. The naked body table: how parts are chosen

`NpcAnimation::getBodyParts(race, female, firstPerson, werewolf)` -
`npcanimation.cpp:1167-1265`. Over every BODY record:

| Test | Rule | Line |
|---|---|---|
| playable | skip `BPF_NotPlayable` | :1206 |
| type | require `MT_Skin` (not Clothing, not Armor) | :1208 |
| race | must match | :1211 |
| view | `isFirstPersonBodyPart(part) != firstPerson` -> skip | :1256 |
| sex | male parts stand in for missing female ones | :1259+ |

`flagFirstPerson = 1 << 1` at `:1170` is NOT a record flag - it is part
of the memoisation KEY for the race/flags cache. The ESM record's own
flags are only `BPF_Female = 1` and `BPF_NotPlayable = 2`
(`loadbody.hpp`). I misread this once already; the record-id suffix in
rule 1 is the real discriminator.

## 3. The arms are the exception, and it is a FALLBACK rule

```cpp
/* A fallback for the arms if 1st person is missing:
   1. Try to use 3d person skin for same gender
   2. Try to use 1st person skin for male, if female == true
   3. Try to use 3d person skin for male, if female == true */
if (firstPerson && isHand && !partFirstPerson)
```
where `isHand` is `MP_Hand || MP_Wrist || MP_Forearm || MP_Upperarm`.
- `npcanimation.cpp:1217-1253`

So hand/wrist/forearm/upperarm DO get special treatment - but as the
list of parts allowed to fall back to a THIRD-PERSON mesh when the
first-person record is missing. It is not the list of what gets shown.

FIRST ATTEMPT INVERTED THIS: it used those four slots as the selection
rule and never rendered anything else.

## 4. Left and right are SEPARATE parts

```cpp
{ MP_Hand, PRT_RHand }, { MP_Hand, PRT_LHand },
{ MP_Wrist, PRT_RWrist }, { MP_Wrist, PRT_LWrist },
...
```
- `npcanimation.cpp:1197-1207` (a multimap: one mesh part, two slots)

Each side is its own part reference at its own bone.

FIRST ATTEMPT treated a part as one mesh attached at two bones in one
pass, which is a different thing and produced a different transform.

## 5. The bones, verbatim

`NpcAnimation::sPartList`, `npcanimation.cpp:200-260`:

| Part | Bone |
|---|---|
| PRT_RHand / PRT_LHand | `Right Hand` / `Left Hand` |
| PRT_RWrist / PRT_LWrist | `Right Wrist` / `Left Wrist` |
| PRT_RForearm / PRT_LForearm | `Right Forearm` / `Left Forearm` |
| PRT_RUpperarm / PRT_LUpperarm | `Right Upper Arm` / `Left Upper Arm` |
| PRT_Neck | `Neck` |
| PRT_Cuirass | `Chest` |
| PRT_Groin / PRT_Skirt | `Groin` |
| PRT_Head / PRT_Hair | `Head` (hair filters on `Hair`) |
| PRT_Weapon | `Weapon Bone` (fallback; real node depends on weapon type) |
| PRT_Shield | `Shield Bone` |

## 6. The skeleton is chosen by SEX and BEAST - it is not one file

`getActorSkeleton`, `apps/openmw/mwrender/actorutil.cpp:8-32`, with the
names from `files/settings-default.cfg [Models]`:

| Actor | First-person skeleton |
|---|---|
| male, non-beast | `meshes/xbase_anim.1st.nif` |
| female | `meshes/base_anim_female.1st.nif` |
| beast (Khajiit, Argonian) | `meshes/base_animkna.1st.nif` |
| werewolf | `meshes/wolf/skin.1st.nif` |

The animation SOURCE is added separately (`npcanimation.cpp:503-536`):
`xbaseanim1st = meshes/xbase_anim.1st.nif`, with the KF at
`xbaseanim1stkf = meshes/xbase_anim.1st.kf`.

FIRST ATTEMPT hardcoded `meshes\base_anim.1st.nif` - a name that does
not appear anywhere in this table. `base_anim.nif` (no `x`) is the
THIRD-person skeleton; `xbase_anim.nif` is the third-person animation
carrier. This alone would have failed the load on retail data.

## 7. In first person, only head and hair are suppressed

```cpp
if (mViewMode != VM_FirstPerson) { ...add Head... ...add Hair... }
```
- `npcanimation.cpp:650-658`

Everything else in the race's table is present; you do not see the
chest because of where the CAMERA is, not because a filter removed it.

FIRST ATTEMPT excluded the chest deliberately, reasoning it "would clip
the camera". That reasoning described something the engine does not do.

---

# The animation layer

## 8. There are ELEVEN weapon short groups, not four

`apps/openmw/mwmechanics/weapontype.cpp:21-345`, one template
specialisation per type. Read out in full:

| ESM type | short | long group | attach bone |
|---|---|---|---|
| ShortBladeOneHand | `1s` | `shortbladeonehand` | Weapon Bone |
| LongBladeOneHand | `1h` | `weapononehand` | Weapon Bone |
| BluntOneHand | `1b` | `bluntonehand` | Weapon Bone |
| AxeOneHand | `1b` | `bluntonehand` | Weapon Bone |
| LongBladeTwoHand | `2c` | `weapontwohand` | Weapon Bone |
| AxeTwoHand | `2b` | `blunttwohand` | Weapon Bone |
| BluntTwoClose | `2b` | `blunttwohand` | Weapon Bone |
| BluntTwoWide | `2w` | `weapontwowide` | Weapon Bone |
| SpearTwoWide | `2w` | `weapontwowide` | Weapon Bone |
| MarksmanBow | `bow` | `bowandarrow` | **Weapon Bone Left** |
| MarksmanCrossbow | `crossbow` | `crossbow` | Weapon Bone |
| MarksmanThrown | `1t` | `throwweapon` | Weapon Bone |
| HandToHand | `hh` | `handtohand` | - |
| Spell | `spell` | `spellcast` | - |
| PickProbe | `1h` | `pickprobe` | - |
| Arrow | - | - | `Bip01 Arrow` |
| Bolt | - | - | `ArrowBone` |

THE REVERTED ARC HAD FOUR CLASSES: onehand, twohand, twowide, bow. So
`shortbladeonehand`, `bluntonehand`, `blunttwohand`, `throwweapon`,
`crossbow` and `spellcast` did not exist in it at all - every
one-hander was forced onto `weapononehand`, and every two-hander onto
one of two groups.

The `blunttwohand` / `2b` group is the one that matters most for
Daggerfall: two-handed AXES and two-handed close BLUNT live there.
MWAUDIT reasoned that Daggerfall's Staff, Warhammer and Battleaxe were
all "wide" and moved all three to `weapontwowide`. By this table a
two-handed axe is `2b`, not `2w`. The original mapping was wrong and
the correction was wrong in a different direction; neither was read
off anything.

A BOW ATTACHES AT A DIFFERENT BONE - `Weapon Bone Left`. The reverted
code had one `MW_WEAPON_BONE = 'weapon bone'` for every type.

## 9. Group names are composed, and the fallback is a real function

Idle is `"idle" + shortGroup` - `idle1h`, `idle2b`, `idlebow`
(`character.cpp:799-803`). Movement and jump compose the same way
(`:509`, `:674-686`).

The fallback, `CharacterController::fallbackShortWeaponGroup`
(`character.cpp:602-637`):

1. not a real weapon -> the BARE base group, blend mask
   **lower body only**
2. two-handed melee -> base + `2c` (LongBladeTwoHand's short group)
3. otherwise -> base + `1h` (LongBladeOneHand's short group)
4. crossbow -> lower-body mask even when the fallback exists
5. still missing -> bare base group, lower-body mask

The long group falls back the same way (`:573-580`).

MWAUDIT INVENTED A DIFFERENT CHAIN - "the asked-for group, the class
idle, any idle, then whatever the file carries". The real chain has a
fixed two-step ladder and terminates at the bare group. Its tail, "any
idle / the first group in the file", exists nowhere in the engine.

THE BLEND MASK IS THE PART WE HAVE NO CONCEPT OF. When the engine
falls back it plays the animation on the LOWER BODY ONLY. For a
first-person arms rig that is the whole difference between a wrong
animation and no animation on the arms.

## 10. First-person Idle loops 2-5 times

```cpp
// play until the Loop Stop key 2 to 5 times, then play until the Stop key
// this replicates original engine behavior for the "Idle1h" 1st-person animation
numLoops = 1 + Misc::Rng::rollDice(4, prng);
```
- `character.cpp:806-810`

A first-person-specific behaviour, engine-PRNG driven, that the
reverted arc did not have.

## 11. Attack keys are namespaced by the LONG group

```cpp
mAnimation->getTextKeyTime(mCurrentWeapon + ": " + mAttackType + " min attack");
```
- `character.cpp:1241-1242`, where `mCurrentWeapon` is the long group

So the text keys read `weapononehand: chop min attack`, and start/stop
are `<attackType> start` / `<attackType> stop` (`:1635-1636`). A bow's
attack type is the literal `"shoot"` (`:1677`).

`getBestAttack` (`character.cpp:65-78`) picks the type from the WEAPON
RECORD's own damage spread - slash/chop/thrust summed over their min
and max, ties going to slash. That is a data-driven choice the port
would have to make from Daggerfall's own item data instead.

---

# The divergence this port must record, LOUDLY

Daggerfall's weapon taxonomy is not Morrowind's. Any mapping from
Daggerfall's `WEAPON_TYPES` onto the eleven short groups above is a
PORT DECISION, not a ported rule, and belongs in the recorded
divergences with its reasoning visible - not inferred inside a lookup
table where the last attempt hid it twice.

---

# The attachment layer

## 12. Skinned and rigid parts take COMPLETELY different paths

`SceneUtil::attach`, `components/sceneutil/attach.cpp:114-198`, branches
on whether the loaded part is itself a Skeleton:

**Skinned** (`:117-142`) - the part's rig geometry is COPIED onto the
actor's master skeleton and re-bound by bone name. The part's own
skeleton is discarded. It is never parented to a bone.

**Rigid** (`:143-197`) - cloned and parented UNDER the bone, with two
transforms the reverted arc knew nothing about. See 13 and 14.

## 13. The mirror: left-side rigid parts are the mesh with X NEGATED

```cpp
if (attachNode->getName().find("Left") != std::string::npos)
{
    trans->setScale(osg::Vec3f(-1.f, 1.f, 1.f));
    // Need to invert culling because of the negative scale
    trans->setStateSet(frontFaceStateSet);
}
```
- `attach.cpp:166-181`

A substring test for `Left` on the ATTACH BONE's name. One mesh serves
both sides; the left is the right, mirrored, with the front face
flipped so backface culling still works.

MW8 ATTACHED THE SAME MESH AT BOTH BONES WITH NO MIRROR. The left hand
would have been a second right hand, inside-out under culling.

## 14. `BoneOffset` - a named node inside the part mesh

```cpp
FindByNameVisitor findBoneOffset("BoneOffset");
...
trans->setPosition(boneOffset->getMatrix().getTrans());
// Now that we used it, get rid of the redundant node.
```
- `attach.cpp:147-164`

A part may carry a node literally named `BoneOffset` whose matrix
TRANSLATION becomes the attachment offset; the node is then dropped
from the scene. Must be a MatrixTransform or it is a hard error.

Absent from the reverted arc entirely.

## 15. The bone name is also a GEOMETRY FILTER

```cpp
const std::string_view bonefilter = (type == ESM::PRT_Hair) ? "hair" : bonename;
mObjectParts[type] = insertBoundedPart(mesh, bonename, bonefilter, ...);
```
- `npcanimation.cpp:799-802` (hair is the documented sole exception)

and the filter test, `attach.cpp:159-166` of CopyRigVisitor:

```cpp
if (ciStartsWith(name, mFilter)) return true;
constexpr std::string_view prefix = "tri ";
if (ciStartsWith(name, prefix)) return ciStartsWith(name.substr(4), mFilter);
```

Case-insensitive PREFIX match on the drawable's name, with Morrowind's
`Tri ` naming convention stripped first. So a skinned part file
containing both `Tri Left Hand` and `Tri Right Hand` yields the correct
side BY NAME - the filter is how a skinned part picks its side, where a
rigid part uses the mirror in 13.

THIS IS THE DISTINCTION THE REVERTED ARC FUMBLED IN BOTH DIRECTIONS:
it bound skinned parts once with no filter, and attached rigid parts at
both bones with no mirror.

## 16. Bone lookup IS case-insensitive, and duplicates go to the FIRST

```cpp
BoneCache::iterator found = mBoneCache.find(Misc::StringUtils::lowerCase(name));
```
- `components/sceneutil/skeleton.cpp:55-66`, cache built at
  `:23-29` with `mCache.emplace(lowerCase(node.getName()), mPath)`

Lowercased on both sides - so the reverted arc's lowercasing was
CORRECT, and is recorded here as parity confirmed rather than a
correction. `emplace` does not overwrite, so where a skeleton repeats a
bone name the FIRST in depth-first order wins. The cached value is the
whole root-to-node transform path.

## 17. The weapon bone is overridden PER WEAPON TYPE at attach time

`npcanimation.cpp:780-796`: for `PRT_Weapon` the generic `Weapon Bone`
from the part table is replaced by the equipped weapon type's own
`mAttachBone` when that node exists in the actor - which is how a bow
reaches `Weapon Bone Left` (rule 8). The part table's entry is only the
fallback, exactly as its own comment says.

## 18. The `x` prefix on actor models is CONDITIONAL

`Misc::ResourceHelpers::correctActorModelPath`,
`components/misc/resourcehelpers.cpp:180-199`: insert `x` before the
FILENAME, swap `.nif` for `.kf`, and **use the x-form only if that KF
exists in the VFS** - otherwise keep the original path.

This refines rule 6 above, which read as though the names were fixed.
They are not: `base_anim_female.1st.nif` is promoted to
`xbase_anim_female.1st.nif` only when `xbase_anim_female.1st.kf` is
present. The male first-person entry is already x-form in the settings,
so the insert yields a non-existent `xx` name and the original stands.

(`correctMeshPath` is just the `meshes` prefix, `:206-211` - the one
path rule the reverted arc had right.)

---

## What is still unknown

Superseded by Part III below, which is specific. The general statement
stands: none of this has been run against retail Morrowind data, because
there is none in this environment. Rules read off the reference
implementation are not the same as behaviour observed on a player's own
archives, and the difference is exactly what the first arc got wrong.

---

# Part II - the fan-out, and how much of it survived

MW-R4 (2026-08-29). Six readers over the OpenMW subsystems the first three
passes had not reached, then EVERY extracted rule put through three
independent verifiers told to refute by default: one re-fetches the cited
file and checks the quote is really there, one checks the rule follows from
the code rather than overreaching, one hunts for callers or special cases
elsewhere that override it. 151 agents.

    48 rules extracted
    19 unanimous  - all three lenses confirmed
    29 disputed   - the mechanism confirmed, a caveat recorded
     0 refuted    - nothing was found to be simply false

THE DISPUTE RATE IS THE POINT. Almost every objection is of one shape:
"the mechanism is right, but you stated a conditional as unconditional."
That is precisely the error that sank the first arc - a rule that is true
in the case you looked at, written down as though it were true always. A
disputed rule below is NOT unreliable; it is a rule whose caveat is now
written next to it instead of being discovered in production.

ONE VERIFIER WAS ITSELF WRONG and it is recorded here rather than quietly
dropped: the objection to "skeleton space is the MatrixTransform product"
argues the cited code does not exist, having searched THIS repository - a
JavaScript Daggerfall port - for OpenMW's C++. The rule stands; the
objection was looking in the wrong tree. Verification catches errors in
both directions and neither direction is automatically right.

# Unanimous - confirmed by all three lenses

## 19. The inverse bind matrix is the per-bone NiSkinData transform, TRANSPOSED into row-vector form
- `components/nif/niftypes.hpp:68-84` - NIF skinning, importance **critical**

There is no matrix inversion anywhere at load: NiSkinData::BoneInfo::mTransform IS the inverse bind matrix (skin space -> bone space) and is used as read (nifloader.cpp:1708). The only conversion is NiTransform::toMatrix: transform(j, i) = mRotation.mValues[i][j] * mScale, with the translation placed in the LAST ROW via setTrans. That is OSG's row-vector convention: a point is transformed as v' = v * M (osg::Matrixf::preMult(vec) computes exactly Sum_i v_i*M[i][j] + M[3][j] - OpenSceneGraph include/osg/Matrixf:725-731), and a product A*B means 'apply A, then B'. So the port's matrix is [transpose(NIF 3x3) * uniform scale ; translation in row 3]; the NIF 3x3 itself may already contain non-uniform or negative scale (comment at niftypes.hpp:70), so it must be transposed wholesale rather than decomposed. The same conversion is applied to NiSkinData's own overall transform (nifloader.cpp:1715) and to every node transform. A port that stores column-vector matrices must transpose the 4x4 AND reverse every product order given in the following rules.

```cpp
    struct NiTransform
    {
        Matrix3 mRotation; // this can contain scale components too, including negative and nonuniform scales
        osg::Vec3f mTranslation;
        float mScale;

        osg::Matrixf toMatrix() const
        {
            osg::Matrixf transform;
            transform.setTrans(mTranslation);

            for (int i = 0; i < 3; ++i)
                for (int j = 0; j < 3; ++j)
                    transform(j, i) = mRotation.mValues[i][j] * mScale; // NB column/row major difference

            return transform;
        }
```

## 20. The per-frame vertex formula: v' = v * (Sum w_i * invBind_i * boneSkelMat_i) * skinToSkel * skinTransform
- `components/sceneutil/riggeometry.cpp:172-210` - NIF skinning, importance **critical**

For each distinct influence set the engine builds one matrix and reuses it for every vertex carrying that set. Steps, in order: (1) per bone, boneMat_i = invBind_i * boneMatrixInSkeletonSpace_i (apply inverse bind first, then the bone's current skeleton-space matrix); bones that did not resolve to a skeleton node are left as the default-constructed identity but are skipped at blend time. (2) resultMat starts as all zeros except m[15] = 1 and accumulates Sum_i (boneMat_i * w_i) ELEMENT-WISE, skipping every index where i % 4 == 3 - i.e. the projective last column is not blended and stays [0,0,0,1]; a bone whose node is null contributes nothing and its weight is NOT redistributed. (3) resultMat = resultMat * transform, where transform = skinToSkelMatrix * NiSkinData's overall mTransform when a skin-to-skeleton matrix exists, otherwise just that overall transform. (4) positions: dst[v] = resultMat.preMult(src[v]), i.e. v * resultMat. (5) normals and tangents use the SAME matrix's upper 3x3 via transform3x3(v, resultMat) - no inverse-transpose, no renormalisation, tangent.w carried through unchanged. Skinning always reads from the untouched source arrays, so every frame starts from bind-pose coordinates; the destination is a double-buffered deep copy (riggeometry.cpp:58-92).

```cpp
        std::vector<osg::Matrixf> boneMatrices(mNodes.size());
        std::vector<Bone*>::const_iterator bone = mNodes.begin();
        std::vector<BoneInfo>::const_iterator boneInfo = mData->mBones.begin();
        for (osg::Matrixf& boneMat : boneMatrices)
        {
            if (*bone != nullptr)
                boneMat = boneInfo->mInvBindMatrix * (*bone)->mMatrixInSkeletonSpace;
            ++bone;
            ++boneInfo;
        }

        osg::Matrixf transform;
        if (mSkinToSkelMatrix)
            transform = (*mSkinToSkelMatrix) * mData->mTransform;
        else
            transform = mData->mTransform;

        for (const auto& [influences, vertices] : mData->mInfluences)
        {
            osg::Matrixf resultMat(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1);

            for (const auto& [index, weight] : influences)
            {
                if (mNodes[index] == nullptr)
                    continue;
                const float* boneMatPtr = boneMatrices[index].ptr();
                float* resultMatPtr = resultMat.ptr();
                for (int i = 0; i < 16; ++i, ++resultMatPtr, ++boneMatPtr)
                    if (i % 4 != 3)
                        *resultMatPtr += *boneMatPtr * weight;
            }

            resultMat *= transform;

            for (unsigned short vertex : vertices)
            {
                (*positionDst)[vertex] = resultMat.preMult((*positionSrc)[vertex]);
                if (normalDst)
                    (*normalDst)[vertex] = osg::Matrixf::transform3x3((*normalSrc)[vertex], resultMat);
```

## 21. The group name is everything before the FIRST ": " — colon plus one space, and nothing else is a separator
- `components/sceneutil/textkeymap.hpp:29-47` - Text keys and .kf, importance **critical**

SceneUtil::TextKeyMap::emplace derives the group by find(": ") — colon followed by exactly one space — and takes substr(0, separator). A key with no ": " registers NO group (it is still stored in the time multimap, it just never appears in mGroups). mGroups is a std::set<std::string,std::less<>>, i.e. sorted and deduplicated, and it IS the engine's list of available animations: Animation::addSingleAnimSource copies it into mSupportedAnimations (apps/openmw/mwrender/animation.cpp:705-707) and Animation::hasAnimation is nothing but a lookup in that set (animation.cpp:787-790). So "does this KF have group X" means literally "does some text key in it begin with 'x: '", and the group is the prefix, never a suffix or a whole-string match. Note find() is the FIRST occurrence, so "weapononehand: chop min attack" has group "weapononehand", and a hypothetical "a: b: c" has group "a".

```cpp
        void emplace(float time, std::string&& textKey)
        {
            const auto separator = textKey.find(": ");
            if (separator != std::string::npos)
                mGroups.emplace(textKey.substr(0, separator));

            mTextKeyByTime.emplace(time, std::move(textKey));
        }

        bool empty() const noexcept { return mTextKeyByTime.empty(); }

        auto findGroupStart(std::string_view groupName) const
        {
            return std::find_if(mTextKeyByTime.begin(), mTextKeyByTime.end(), IsGroupStart{ groupName });
        }

        bool hasGroupStart(std::string_view groupName) const { return mGroups.count(groupName) > 0; }

        const std::set<std::string, std::less<>>& getGroups() const { return mGroups; }
```

## 22. A group's time range: search BACKWARDS from the group's last key; stop-key match is length-truncated; "loop start" falls back to "start"
- `apps/openmw/mwrender/animation.cpp:971-1022` - Text keys and .kf, importance **critical**

Animation::reset derives [mStartTime, mStopTime] for a play request, given a group and the caller's start/stop key names (usually "start"/"stop"). Algorithm, exactly: (1) scan the whole time-ordered multimap in REVERSE to find `groupend`, the LAST key in time whose text is `<group>` + ": " — the comment says this exists because undeadwolf_2.nif has two separate walkforward key blocks and the later one wins. (2) From groupend, continue backwards for the start key, matched as EXACTLY `<group>` + ": " + `<start>`. (3) If that fails AND the requested start was literally "loop start", retry from groupend for `<group>: start`. (4) From groupend, backwards again for the stop key — but the candidate is first TRUNCATED to groupname.size()+2+stop.size() before comparison, deliberately tolerating trailing garbage (the Scrib's "Idle3: Stop."). This tolerance applies to the STOP key only; the start key must match exactly. (5) If either key is missing, or startkey time > stopkey time, reset returns false and Animation::play moves on to the NEXT anim source (animation.cpp:919-965, iterating mAnimSources in reverse — last-added source has priority). mStartTime/mStopTime are those two key times, and the initial playhead is start + (stop-start)*startpoint.

```cpp
        // Look for text keys in reverse. This normally wouldn't matter, but for some reason undeadwolf_2.nif has two
        // separate walkforward keys, and the last one is supposed to be used.
        auto groupend = keys.rbegin();
        for (; groupend != keys.rend(); ++groupend)
        {
            if (groupend->second.starts_with(groupname) && groupend->second.compare(groupname.size(), 2, ": ") == 0)
                break;
        }

        auto startkey = groupend;
        while (startkey != keys.rend() && !equalsParts(startkey->second, groupname, ": ", start))
            ++startkey;
        if (startkey == keys.rend() && start == "loop start")
        {
            startkey = groupend;
            while (startkey != keys.rend() && !equalsParts(startkey->second, groupname, ": start"))
                ++startkey;
        }
        if (startkey == keys.rend())
            return false;

        auto stopkey = groupend;
        std::size_t checkLength = groupname.size() + 2 + stop.size();
        while (stopkey != keys.rend()
            // We have to ignore extra garbage at the end.
            // The Scrib's idle3 animation has "Idle3: Stop." instead of "Idle3: Stop".
            // Why, just why? :(
            && !equalsParts(std::string_view{ stopkey->second }.substr(0, checkLength), groupname, ": ", stop))
            ++stopkey;
        if (stopkey == keys.rend())
            return false;

        if (startkey->first > stopkey->first)
            return false;
```

## 23. "loop start"/"loop stop" are assigned WHILE PLAYING, and mLoopStopTime starts at FLT_MAX
- `apps/openmw/mwrender/animation.cpp:1009-1040` - Text keys and .kf, importance **high**
- REFINES OR CORRECTS RECORDED RULE 10

The loop window is not read out of the file up front. In reset, mLoopStartTime is seeded to the start-key time and mLoopStopTime to std::numeric_limits<float>::max() (unless the caller passed loopfallback, in which case the loop window is just the whole start..stop range). Only two things narrow it: (a) Animation::handleTextKey, called for every key the playhead crosses, sets mLoopStartTime/mLoopStopTime when it crosses `<playing group>: loop start` / `: loop stop` (animation.cpp:861-868); (b) reset's back-fill loop, which walks backwards from groupend and applies any loop start/stop key at or before the initial playhead, for the case where startpoint already skipped past them. Looping itself is `getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0` (animation.hpp:177), so with mLoopStopTime = FLT_MAX a group with no "loop stop" key never wraps early — it simply plays to mStopTime. This is the mechanism under recorded rule 10 (first-person Idle plays to Loop Stop 2-5 times): the loop is driven by the KEYS crossed at runtime, not by a range computed at load.

```cpp
        state.mStartTime = startkey->first;
        if (loopfallback)
        {
            state.mLoopStartTime = startkey->first;
            state.mLoopStopTime = stopkey->first;
        }
        else
        {
            state.mLoopStartTime = startkey->first;
            state.mLoopStopTime = std::numeric_limits<float>::max();
        }
        state.mStopTime = stopkey->first;

        state.setTime(state.mStartTime + ((state.mStopTime - state.mStartTime) * startpoint));

        // mLoopStartTime and mLoopStopTime normally get assigned when encountering these keys while playing the
        // animation (see handleTextKey). But if startpoint is already past these keys, or start time is == stop time,
        // we need to assign them now.

        auto key = groupend;
        for (; key != startkey && key != keys.rend(); ++key)
        {
            if (key->first > state.getTime())
                continue;

            if (equalsParts(key->second, groupname, ": loop start"))
                state.mLoopStartTime = key->first;
            else if (equalsParts(key->second, groupname, ": loop stop"))
                state.mLoopStopTime = key->first;
        }
```

## 24. The action vocabulary after "<group>: " is a closed if/else chain, and "hit" has a start-key fallback
- `apps/openmw/mwmechanics/character.cpp:1074-1146` - Text keys and .kf, importance **high**
- REFINES OR CORRECTS RECORDED RULE 11

Once the group prefix is stripped, `action` is matched against exact strings, first match wins, no default branch: "equip attach", "unequip detach", "chop hit"/"slash hit"/"thrust hit"/"hit", "start" (only when the group is one of attack1/2/3 or swimattack1/2/3), "shoot attach", "shoot release", "shoot follow attach", `<mAttackType> release` (only when group == "spellcast"), "loot" (only when group == "containeropen"). Anything else falls off the end and does nothing. Two details a port will get wrong otherwise: (a) the bare "hit" action carries no attack type of its own — the type comes from the GROUP NAME, attack1/swimattack1 -> Chop, attack2 -> Slash, attack3 -> Thrust; (b) for those same random-attack groups, on the "start" key the engine scans FORWARD through the map for `<group>: hit`, stopping early at `<group>: stop`, and if no hit key exists in that window the hit is delivered on the START key instead. Also note "min attack"/"max attack"/"min hit" are NOT in this dispatch chain at all — they are never handled as events; they are only ever polled by time via getTextKeyTime (character.cpp:1241-1242, 1767-1780, 1879-1880), which is why recorded rule 11's `<longgroup>: <attacktype> min attack` form is a QUERY string, not a handled action.

```cpp
        else if (action == "chop hit" || action == "slash hit" || action == "thrust hit" || action == "hit")
        {
            int attackType = -1;
            if (action == "hit")
            {
                if (groupname == "attack1" || groupname == "swimattack1")
                    attackType = ESM::Weapon::AT_Chop;
                else if (groupname == "attack2" || groupname == "swimattack2")
                    attackType = ESM::Weapon::AT_Slash;
                else if (groupname == "attack3" || groupname == "swimattack3")
                    attackType = ESM::Weapon::AT_Thrust;
            }
...
        else if (isRandomAttackAnimation(groupname) && action == "start")
        {
            std::multimap<float, std::string>::const_iterator hitKey = key;

            // Not all animations have a hit key defined. If there is none, the hit happens with the start key.
            bool hasHitKey = false;
            while (hitKey != map.end())
            {
                if (hitKey->second.starts_with(groupname))
                {
                    std::string_view suffix = std::string_view(hitKey->second).substr(groupname.size());
                    if (suffix == ": hit")
                    {
                        hasHitKey = true;
                        break;
                    }
                    if (suffix == ": stop")
                        break;
                }
                ++hitKey;
            }
```

## 25. BlendMask is a 4-bit set, and a bone's bit is decided by walking ancestors for three literal names
- `apps/openmw/mwrender/animation.cpp:592-616` - Animation playback, importance **critical**
- REFINES OR CORRECTS RECORDED RULE 9

There are exactly four discrete blend masks, held as a bitfield: LowerBody = 1<<0, Torso = 1<<1, LeftArm = 1<<2, RightArm = 1<<3; UpperBody = Torso|LeftArm|RightArm; All = LowerBody|UpperBody (apps/openmw/mwrender/blendmask.hpp:8-20). Which mask a given animated bone belongs to is NOT stored per animation and is NOT a list of bone names. It is computed once per bone, at animation-source load time, by Animation::detectBlendMask: starting at the bone's node, walk up parents until mObjectRoot, and at each ancestor compare that ancestor's node name (exact, case-SENSITIVE ==, no lowercasing) against exactly three strings - "Bip01 Spine1" (index 1 = Torso), "Bip01 L Clavicle" (index 2 = LeftArm), "Bip01 R Clavicle" (index 3 = RightArm). Index 0 (the empty string, lower body / character root) is deliberately skipped by the loop (`for (size_t i = 1; ...)`) and is the fallback returned when no ancestor matches. So: everything under Bip01 Spine1 but not under a clavicle is Torso; everything under a clavicle is that arm (the arm test wins because the clavicle is encountered before the spine on the way up); everything else - pelvis, legs, tail, the root - is LowerBody. The Collada path also accepts a match on the KeyframeController's own name. The returned value is a mask INDEX 0..3 (== the BoneGroup enum, bonegroup.hpp:8-12), and membership is later tested as `mBlendMask & (1 << index)` (animation.hpp:176). Result: the per-bone controllers are bucketed into animsrc->mControllerMap[blendMask] at addAnimSource time (animation.cpp:693-700), so a JS port must do this partition once per (skeleton, kf) pair, not per play() call.

```cpp
    // controllerName is used for Collada animated deforming models
    size_t Animation::detectBlendMask(const osg::Node* node, const std::string& controllerName) const
    {
        static const std::string_view sBlendMaskRoots[sNumBlendMasks] = {
            "", /* Lower body / character root */
            "Bip01 Spine1", /* Torso */
            "Bip01 L Clavicle", /* Left arm */
            "Bip01 R Clavicle", /* Right arm */
        };

        while (node != mObjectRoot)
        {
            const std::string& name = node->getName();
            for (size_t i = 1; i < sNumBlendMasks; i++)
            {
                if (name == sBlendMaskRoots[i] || controllerName == sBlendMaskRoots[i])
                    return i;
            }

            assert(node->getNumParents() > 0);

            node = node->getParent(0);
        }

        return 0;
    }

// apps/openmw/mwrender/blendmask.hpp:8-20
    enum BlendMask
    {
        BlendMask_LowerBody = 1 << 0,
        BlendMask_Torso = 1 << 1,
        BlendMask_LeftArm = 1 << 2,
        BlendMask_RightArm = 1 << 3,

        BlendMask_UpperBody = BlendMask_Torso | BlendMask_LeftArm | BlendMask_RightArm,

        BlendMask_All = BlendMask_LowerBody | BlendMask_UpperBody
    };
    /* This is the number of *discrete* blend masks. */
    static constexpr size_t sNumBlendMasks = 4;

// apps/openmw/mwrender/animation.cpp:691-700 (where it is applied, once, per bone)
            size_t blendMask = detectBlendMask(node, it->second->getName());

            // clone the controller, because each Animation needs its own ControllerSource
            osg::ref_ptr<SceneUtil::KeyframeController> cloned
                = osg::clone(it->second.get(), osg::CopyOp::SHALLOW_COPY);
            cloned->setSource(mAnimationTimePtr[blendM
...(truncated; see the cited lines)
```

## 26. Priority is a four-element vector, one per bone group, and is resolved winner-takes-all PER bone group
- `apps/openmw/mwrender/animation.cpp:1126-1142` - Animation playback, importance **critical**

AnimPriority is not a scalar: it holds one int per BoneGroup (animationpriority.hpp:10-40); the int constructor merely fills all four slots with the same value, and operator== compares all four. Resolution happens in Animation::resetActiveGroups(), which runs once after every play/disable and loops over the four blend masks independently. For each mask it scans mStates - a std::map<std::string, AnimState, std::less<>>, i.e. iterated in LEXICOGRAPHIC ORDER OF GROUP NAME (animation.hpp:180) - skipping states whose mBlendMask lacks that bit, and keeps the state with the strictly greatest mPriority[thatBoneGroup]. The comparison is `<`, so a TIE keeps the FIRST state found, i.e. the alphabetically-first group name. Exactly one state wins each bone group; the losers contribute NOTHING to those bones (their controllers are simply not attached). Consequently two animations on the same bone never blend by weight - the higher priority replaces the lower outright on that bone group, and one animation can own the legs while a different one owns an arm. The winner's shared time pointer is installed as mAnimationTimePtr[mask], so every bone in a mask reads the winner's clock. The accumulation root is only tracked when blendMask == 0 (animation.cpp:1177), so only the LOWER-BODY winner drives movement. Priority values are the enum in apps/openmw/mwmechanics/character.hpp:28-45, in ascending order: Default=0, WeaponLowerBody, SneakIdleLowerBody, SwimIdle, Jump, Movement, Hit, Weapon, Block, Knockdown, Torch, Storm, Death, Scripted=13.

```cpp
        for (size_t blendMask = 0; blendMask < sNumBlendMasks; blendMask++)
        {
            AnimStateMap::const_iterator active = mStates.end();

            AnimStateMap::const_iterator state = mStates.begin();
            for (; state != mStates.end(); ++state)
            {
                if (!state->second.blendMaskContains(blendMask))
                    continue;

                if (active == mStates.end()
                    || active->second.mPriority[(BoneGroup)blendMask] < state->second.mPriority[(BoneGroup)blendMask])
                    active = state;
            }

            mAnimationTimePtr[blendMask]->setTimePtr(
                active == mStates.end() ? std::shared_ptr<float>() : active->second.mTime);

// apps/openmw/mwrender/animationpriority.hpp:10-39
    struct AnimPriority
    {
        /// Convenience constructor, initialises all priorities to the same value.
        AnimPriority(int priority)
        {
            for (unsigned int i = 0; i < sNumBlendMasks; ++i)
                mPriority[i] = priority;
        }

        bool operator==(const AnimPriority& other) const
        {
            for (unsigned int i = 0; i < sNumBlendMasks; ++i)
                if (other.mPriority[i] != mPriority[i])
                    return false;
            return true;
        }

        int& operator[](BoneGroup n) { return mPriority[n]; }

// apps/openmw/mwrender/animation.hpp:176
            bool blendMaskContains(size_t blendMask) const { return (mBlendMask & (1 << blendMask)); }
```

## 27. reset(): start/stop keys are matched in reverse by time, with a 'loop start'->'start' fallback and a truncated stop compare
- `apps/openmw/mwrender/animation.cpp:971-1040` - Animation playback, importance **high**

Animation::reset resolves the start and stop key names against one animation source's text-key multimap (ordered by TIME) and is the sole gate on whether a group exists in that source. The search is REVERSE, i.e. from the latest key backwards, and the comment gives the reason (undeadwolf_2.nif has two walkforward key sets; the LAST one wins). Steps: find `groupend` = the last key whose text starts with `"<group>"` followed by `": "`; from there search backwards for an exact `"<group>: <start>"`; if that fails AND the requested start was literally "loop start", retry the same backwards search for `"<group>: start"` (this is the only start-key fallback that exists). For the stop key the comparison is made on only the first groupname.size()+2+stop.size() characters, deliberately tolerating trailing garbage - the cited case is the Scrib's "Idle3: Stop." with a trailing period. Missing start key, missing stop key, or startkey time > stopkey time each return false and the caller moves to the next (older) animation source. On success mStartTime/mStopTime are the two key times and the playhead is set to `mStartTime + (mStopTime - mStartTime) * startpoint`, so startPoint is a 0..1 fraction of the START->STOP span (not of the loop span). Finally it re-scans keys between groupend and startkey whose time is <= the computed playhead to pick up any "loop start"/"loop stop" that startPoint has already skipped past. All comparisons are plain case-sensitive string equality via equalsParts (animation.cpp:169-178), which is safe only because both the text keys and the group names are lowercased at load.

```cpp
        // Look for text keys in reverse. This normally wouldn't matter, but for some reason undeadwolf_2.nif has two
        // separate walkforward keys, and the last one is supposed to be used.
        auto groupend = keys.rbegin();
        for (; groupend != keys.rend(); ++groupend)
        {
            if (groupend->second.starts_with(groupname) && groupend->second.compare(groupname.size(), 2, ": ") == 0)
                break;
        }

        auto startkey = groupend;
        while (startkey != keys.rend() && !equalsParts(startkey->second, groupname, ": ", start))
            ++startkey;
        if (startkey == keys.rend() && start == "loop start")
        {
            startkey = groupend;
            while (startkey != keys.rend() && !equalsParts(startkey->second, groupname, ": start"))
                ++startkey;
        }
        if (startkey == keys.rend())
            return false;

        auto stopkey = groupend;
        std::size_t checkLength = groupname.size() + 2 + stop.size();
        while (stopkey != keys.rend()
            // We have to ignore extra garbage at the end.
            // The Scrib's idle3 animation has "Idle3: Stop." instead of "Idle3: Stop".
            // Why, just why? :(
            && !equalsParts(std::string_view{ stopkey->second }.substr(0, checkLength), groupname, ": ", stop))
            ++stopkey;
        if (stopkey == keys.rend())
            return false;

        if (startkey->first > stopkey->first)
            return false;

        state.mStartTime = startkey->first;
        ...
        state.mStopTime = stopkey->first;

        state.setTime(state.mStartTime + ((state.mStopTime - state.mStartTime) * startpoint));

        // mLoopStartTime and mLoopStopTime normally get assigned when encountering these keys while 
...(truncated; see the cited lines)
```

## 28. playBlendedAnimation is only a router - it does no blending and has the identical signature to play()
- `apps/openmw/mwmechanics/character.cpp:2610-2620` - Animation playback, importance **medium**

CharacterController::playBlendedAnimation is NOT a second, blending-aware playback path. It takes exactly the arguments of Animation::play and either forwards them verbatim to Animation::play, or, when Lua animations are active for this actor (mLuaAnimations), hands the same arguments to the Lua manager so scripts can intercept. Any port must not invent blend semantics from the name: the only 'blending' in this layer is the per-bone-group winner-takes-all selection of rule (B). The corresponding Lua entry point anim.playBlended (apps/openmw/mwlua/animationbindings.cpp:215-231) fixes the DEFAULTS that the rest of the engine implicitly assumes: loops = 0, priority = Priority_Default, blendMask = BlendMask_All, autoDisable = true, speed = 1.0, startKey = "start", stopKey = "stop", startPoint = 0.0, and loopFallback = forceLoop || isLoopingAnimation(group). It also LOWERCASES the group name before calling play, which is what makes reset()'s case-sensitive comparisons work against the lowercased text keys. (Separately, note the smooth cross-fade in resetActiveGroups is an OPTIONAL non-vanilla feature gated on Settings::game().mSmoothAnimTransitions, animation.cpp:1155-1170 - vanilla behaviour is a hard cut.)

```cpp
    void CharacterController::playBlendedAnimation(const std::string& groupname, const MWRender::AnimPriority& priority,
        int blendMask, bool autodisable, float speedmult, std::string_view start, std::string_view stop,
        float startpoint, uint32_t loops, bool loopfallback) const
    {
        if (mLuaAnimations)
            MWBase::Environment::get().getLuaManager()->playAnimation(mPtr, groupname, priority, blendMask, autodisable,
                speedmult, start, stop, startpoint, loops, loopfallback);
        else
            mAnimation->play(
                groupname, priority, blendMask, autodisable, speedmult, start, stop, startpoint, loops, loopfallback);
    }

// apps/openmw/mwlua/animationbindings.cpp:215-231
        api["playBlended"] = [](const SelfObject& object, std::string_view groupName, const sol::table& options) {
            uint32_t loops = options.get_or("loops", 0u);
            MWRender::Animation::AnimPriority priority = getPriorityArgument(options);
            BlendMask blendMask = options.get_or("blendMask", BlendMask::BlendMask_All);
            bool autoDisable = options.get_or("autoDisable", true);
            float speed = options.get_or("speed", 1.0f);
            std::string start = options.get_or<std::string>("startKey", "start");
            std::string stop = options.get_or<std::string>("stopKey", "stop");
            float startPoint = options.get_or("startPoint", 0.0f);
            bool forceLoop = options.get_or("forceLoop", false);

            const std::string lowerGroup = Misc::StringUtils::lowerCase(groupName);

            auto animation = getMutableAnimationOrThrow(object);
            animation->play(lowerGroup, priority, blendMask, autoDisable, speed, start, stop, startPoint, loops,
                forceLoop |
...(truncated; see the cited lines)
```

## 29. First-person meshes are rendered with their OWN field of view (default 60.0 deg), injected by a cull callback
- `apps/openmw/mwrender/npcanimation.cpp:373-414, 542-547` - First-person specifics, importance **critical**

The first-person object root carries an OverrideFieldOfViewCallback as a CULL callback (added in updateNpcBase, only when is1stPerson). During cull it reads the current projection's perspective params; if |currentFov - mFov| > 0.001 it rebuilds a perspective matrix with fov = mFov and the SAME aspect/zNear/zFar, post-multiplies the RenderingManager's projection offset (offsetX = offset.x/viewport.width*2, offsetY likewise), then pushes modelView' = modelView * newProj * inverse(oldProj) as an ABSOLUTE_RF modelview for the subtree and pops it after traversal. If the FOVs already match it just traverses. The value comes from Settings::camera().mFirstPersonFieldOfView = [Camera] "first person field of view", default 60.0, clamped to [1,179] (components/settings/categories/camera.hpp:27-28), a SEPARATE setting from [Camera] "field of view" (also 60.0) whose own comment says it "Does not affect the player's hands in the first person camera". It is read once into RenderingManager::mFirstPersonFieldOfView at construction (renderingmanager.cpp:209) and passed to the NpcAnimation ctor (renderingmanager.cpp:1161-1162); processChangedSettings only live-updates "field of view", never the first-person one (renderingmanager.cpp:1364-1367). Separately, the Morrowind fallback General_Werewolf_FOV overrides the MAIN camera FOV only while in first person (mwworld/player.cpp:470-482) - it does not touch the hands' FOV.

```cpp
// npcanimation.cpp:373-403
    /// Overrides Field of View to given value for rendering the subgraph.
    /// Must be added as cull callback.
    class OverrideFieldOfViewCallback : public osg::NodeCallback
    {
    public:
        OverrideFieldOfViewCallback(float fov, RenderingManager* renderingManager)
            : mFov(fov)
            , mRenderingManager(renderingManager)
        {
        }

        void operator()(osg::Node* node, osg::NodeVisitor* nv) override
        {
            osgUtil::CullVisitor* cv = static_cast<osgUtil::CullVisitor*>(nv);
            float fov, aspect, zNear, zFar;
            if (cv->getProjectionMatrix()->getPerspective(fov, aspect, zNear, zFar) && std::abs(fov - mFov) > 0.001)
            {
                fov = mFov;
                osg::ref_ptr<osg::RefMatrix> newProjectionMatrix = new osg::RefMatrix();
                newProjectionMatrix->makePerspective(fov, aspect, zNear, zFar);

                osg::Vec2f offset = mRenderingManager->getProjectionOffset();

                double offsetX = (offset.x() / cv->getViewport()->width()) * 2.0;
                double offsetY = (offset.y() / cv->getViewport()->height()) * 2.0;

                const osg::Matrix translation = osg::Matrix::translate(offsetX, offsetY, 0.0);
                newProjectionMatrix->postMult(translation);

                osg::ref_ptr<osg::RefMatrix> invertedOldMatrix = cv->getProjectionMatrix();
                invertedOldMatrix = new osg::RefMatrix(osg::RefMatrix::inverse(*invertedOldMatrix));
                osg::ref_ptr<osg::RefMatrix> viewMatrix = new osg::RefMatrix(*cv->getModelViewMatrix());
                viewMatrix->postMult(*newProjectionMatrix);
                viewMatrix->postMult(*invertedOldMatrix);
                cv->pushModelViewMatrix(viewM
...(truncated; see the cited lines)
```

## 30. The first-person neck controller: "bip01 neck", rotated by camera PITCH times 0.75-1.00 about -X
- `apps/openmw/mwrender/npcanimation.cpp:712-724, 931-946` - First-person specifics, importance **critical**

Only in VM_FirstPerson, and only while at least one animation state is playing (mStates.size() > 0 - the comment says that otherwise the node is not reset each frame and the controller would ACCUMULATE rotation), addControllers() looks up "bip01 neck" in the node map (an unordered_map with Misc::StringUtils::CiHash/CiEqual, so the lookup is case-insensitive and the FIRST matching MatrixTransform in traversal order wins - animation.hpp:124-127, sceneutil/visitor.cpp:60-64) and attaches a RotateController(mObjectRoot) as an UPDATE callback on it. mFirstPersonNeckController is set to nullptr at the top of every addControllers() call, so it is destroyed and rebuilt on every rebuild/view change. Each frame in runAnimation the rotation is set to Quat(rot[0] * rotateFactor, Vec3f(-1,0,0)) where rot[0] is the actor's PITCH in radians from RefData position (not yaw, not the camera object) and rotateFactor = 0.75 + 0.25 * mAimingFactor, i.e. the neck follows only 75% of the look pitch normally and 100% while aiming accurately. mAimingFactor snaps to 1.0 when setAccurateAiming(true) and otherwise decays LINEARLY at 0.5 per second toward 0 (max(0, f - dt*0.5)), so a full release takes 2 seconds. Accurate aiming is on exactly while mUpperBodyState > UpperBodyState::WeaponEquipped, i.e. AttackWindUp, AttackRelease, AttackEnd or Casting (mwmechanics/character.cpp:1895, enum at character.hpp:107-117). The controller's offset is set from mFirstPersonOffset in the same block.

```cpp
// npcanimation.cpp:712-724 (NpcAnimation::runAnimation)
        if (mFirstPersonNeckController)
        {
            if (mAccurateAiming)
                mAimingFactor = 1.f;
            else
                mAimingFactor = std::max(0.f, mAimingFactor - timepassed * 0.5f);

            float rotateFactor = 0.75f + 0.25f * mAimingFactor;

            mFirstPersonNeckController->setRotate(
                osg::Quat(mPtr.getRefData().getPosition().rot[0] * rotateFactor, osg::Vec3f(-1, 0, 0)));
            mFirstPersonNeckController->setOffset(mFirstPersonOffset);
        }

// npcanimation.cpp:928-946 (NpcAnimation::addControllers)
        mFirstPersonNeckController = nullptr;
        WeaponAnimation::deleteControllers();

        if (mViewMode == VM_FirstPerson)
        {
            // If there is no active animation, then the bip01 neck node will not be updated each frame, and the
            // RotateController will accumulate rotations.
            if (mStates.size() > 0)
            {
                NodeMap::iterator found = mNodeMap.find("bip01 neck");
                if (found != mNodeMap.end())
                {
                    osg::MatrixTransform* node = found->second.get();
                    mFirstPersonNeckController = new RotateController(mObjectRoot.get());
                    node->addUpdateCallback(mFirstPersonNeckController);
                    mActiveControllers.emplace_back(node, mFirstPersonNeckController);
                }
            }
        }

// apps/openmw/mwmechanics/character.cpp:1895
        mAnimation->setAccurateAiming(mUpperBodyState > UpperBodyState::WeaponEquipped);
```

## 31. RotateController applies the rotation in the OBJECT ROOT's space, on top of the animated matrix
- `apps/openmw/mwrender/rotatecontroller.cpp:30-68` - First-person specifics, importance **critical**

RotateController is a node callback on a MatrixTransform that runs AFTER the animation has written that node's matrix for the frame (its header states the assumption: "Assumes that the node being rotated has its original orientation set every frame by a different controller. The rotation is then applied on top of that orientation."). Each update it takes worldOrient = rotation part of computeLocalToWorld(first parental node path up to mRelativeTo, which for the neck controller is mObjectRoot), and computes orient = worldOrient * mRotate * worldOrientInverse * matrix.getRotate() - i.e. the pitch quaternion is conjugated into the node's local frame so that it is a rotation in the ACTOR ROOT's space, then pre-applied to the animated local rotation. The translation is matrix.getTrans() + worldOrientInverse * mOffset, so the first-person offset is likewise a vector in root space rotated into the bone's local frame. If the node is an osgAnimation::Bone it additionally writes setMatrixInSkeletonSpace(matrix * parent->getMatrixInSkeletonSpace()). If !mEnabled it just traverses, changing nothing.

```cpp
    void RotateController::operator()(osg::MatrixTransform* node, osg::NodeVisitor* nv)
    {
        if (!mEnabled)
        {
            traverse(node, nv);
            return;
        }
        osg::Matrix matrix = node->getMatrix();

        osg::Quat worldOrient;
        osg::NodePathList nodepaths = node->getParentalNodePaths(mRelativeTo);

        if (!nodepaths.empty())
        {
            osg::Matrixf worldMat = osg::computeLocalToWorld(nodepaths[0]);
            worldOrient = worldMat.getRotate();
        }

        osg::Quat worldOrientInverse = worldOrient.inverse();

        osg::Quat orient = worldOrient * mRotate * worldOrientInverse * matrix.getRotate();
        matrix.setRotate(orient);
        matrix.setTrans(matrix.getTrans() + worldOrientInverse * mOffset);

        node->setMatrix(matrix);

        // If we are linked to a bone we must call setMatrixInSkeletonSpace
        osgAnimation::Bone* b = dynamic_cast<osgAnimation::Bone*>(node);
        if (b)
        {
            osgAnimation::Bone* parent = b->getBoneParent();
            if (parent)
                matrix *= parent->getMatrixInSkeletonSpace();

            b->setMatrixInSkeletonSpace(matrix);
        }
```

## 32. There are TWO first-person offsets: the neck/body one (sneak only) and the camera one (Lua only)
- `apps/openmw/mwrender/camera.cpp:149-157, 310-313` - First-person specifics, importance **high**

(a) NpcAnimation::mFirstPersonOffset, pushed into the neck RotateController every frame, is written ONLY by Camera::setSneakOffset, as osg::Vec3f(0, 0, -offset). Its source is MWWorld::Player::update: while the player has the Sneak stance and is neither swimming nor flying, offset = the GMST i1stPersonSneakDelta (read once, statically); otherwise 0.f. So the whole first-person body is sunk by i1stPersonSneakDelta units in -Z while sneaking, via the neck bone, and there is no smoothing - it is a step change. Default is Vec3f(0,0,0) (npcanimation.hpp:71, default-constructed). (b) Camera::mFirstPersonOffset is a DIFFERENT member, default {0,0,0} (camera.hpp:148), settable only from Lua (camera bindings get/setFirstPersonOffset, mwlua/camerabindings.cpp:79-80); it is added to the camera position with its X/Y rotated by the camera yaw and Z applied straight. Do not conflate them: the sneak sink moves the MESH (and therefore the Camera bone with it), the Lua offset moves only the camera.

```cpp
// camera.cpp:149-157
    osg::Vec3d Camera::calculateFirstPersonPosition(const osg::Vec3d& trackedPosition) const
    {
        osg::Vec3d res = trackedPosition;
        osg::Vec2f horizontalOffset
            = Misc::rotateVec2f(osg::Vec2f(mFirstPersonOffset.x(), mFirstPersonOffset.y()), mYaw);
        res.x() += horizontalOffset.x();
        res.y() += horizontalOffset.y();
        res.z() += mFirstPersonOffset.z();
        return res;
    }

// camera.cpp:310-313
    void Camera::setSneakOffset(float offset)
    {
        mAnimation->setFirstPersonOffset(osg::Vec3f(0, 0, -offset));
    }

// apps/openmw/mwworld/player.cpp:485-494
        // Sink the camera while sneaking
        bool sneaking = playerClass.getCreatureStats(player).getStance(MWMechanics::CreatureStats::Stance_Sneak);
        bool swimming = world->isSwimming(player);
        bool flying = world->isFlying(player);

        static const float i1stPersonSneakDelta
            = store.get<ESM::GameSetting>().find("i1stPersonSneakDelta")->mValue.getFloat();
        if (sneaking && !swimming && !flying)
            rendering->getCamera()->setSneakOffset(i1stPersonSneakDelta);
        else
            rendering->getCamera()->setSneakOffset(0.f);
```

## 33. Equipped parts: if the ".1st" record is missing, ONLY arm parts fall back to the third-person record - everything else is dropped
- `apps/openmw/mwrender/npcanimation.cpp:879-914` - First-person specifics, importance **high**
- REFINES OR CORRECTS RECORDED RULE 1

REFINES RULE 1. In addPartGroup (the EQUIPMENT path, both the female and the male branch) the engine searches id + ".1st" in first person. If that search fails it does NOT simply give up and it does NOT simply use the plain record: it re-searches the plain (third-person) record and then keeps it only if that record's mData.mPart is MP_Hand, MP_Wrist, MP_Forearm or MP_Upperarm; for any other part it sets bodypart = nullptr, i.e. the equipped part is silently NOT SHOWN in first person and no warning is logged (the warning branch is the else of the first-person test). This is the equipment-path twin of the naked-body arm fallback already recorded as rule 3, and it means a port must not render a cuirass/helmet/greaves/boots in first person from its third-person mesh just because the .1st record is absent - the engine renders nothing there. Note also the search is over BODY RECORD IDs (rule 1 stands): partStore.search(RefId::stringRefId(part.mMale.getRefIdString() + ext)).

```cpp
        const char* ext = (mViewMode == VM_FirstPerson) ? ".1st" : "";
        for (const ESM::PartReference& part : parts)
        {
            const ESM::BodyPart* bodypart = nullptr;
            if (!mNpc->isMale() && !part.mFemale.empty())
            {
                bodypart = partStore.search(ESM::RefId::stringRefId(part.mFemale.getRefIdString() + ext));
                if (!bodypart && mViewMode == VM_FirstPerson)
                {
                    bodypart = partStore.search(part.mFemale);
                    if (bodypart
                        && !(bodypart->mData.mPart == ESM::BodyPart::MP_Hand
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Wrist
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Forearm
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Upperarm))
                        bodypart = nullptr;
                }
                else if (!bodypart)
                    Log(Debug::Warning) << "Warning: Failed to find body part '" << part.mFemale << "'";
            }
            if (!bodypart && !part.mMale.empty())
            {
                bodypart = partStore.search(ESM::RefId::stringRefId(part.mMale.getRefIdString() + ext));
                if (!bodypart && mViewMode == VM_FirstPerson)
                {
                    bodypart = partStore.search(part.mMale);
                    if (bodypart
                        && !(bodypart->mData.mPart == ESM::BodyPart::MP_Hand
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Wrist
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Forearm
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Upperarm))
                        bodypart = nullptr;
      
...(truncated; see the cited lines)
```

## 34. The root NiNode's transform is DISCARDED at parse time unless the node is named "bip01"
- `components/nif/node.cpp:170-192` - NIF nodes and transforms, importance **critical**

In NiNode::read, if the record index is 0 and the node's name is not case-insensitively equal to "bip01", the node's whole NiTransform is REPLACED with identity before anything else ever sees it. This happens in the parser, not the renderer, so every consumer (render loader, collision loader, animation) sees identity. It applies to Morrowind-version files: the early-out above it only skips versions strictly greater than VER_MW and strictly less than VER_BGS. It applies only to NiNode records - a NiTriShape at record index 0 keeps its transform. A JS port that faithfully applies the root node's stored translation/rotation/scale will mis-orient meshes exactly as the comment describes, and a port that unconditionally zeroes the root will break every skeleton whose root node is named Bip01. This is also the reason a Bip01 root survives as a real transform node and can therefore be found by name later (see the accum-root rule).

```cpp
    void NiNode::read(NIFStream* nif)
    {
        NiAVObject::read(nif);

        readRecordList(nif, mChildren);
        if (nif->getBethVersion() < NIFFile::BethVersion::BETHVER_FO4)
            readRecordList(nif, mEffects);

        // FIXME: stopgap solution until we figure out what Oblivion does if it does anything
        if (nif->getVersion() > NIFFile::NIFVersion::VER_MW && nif->getVersion() < NIFFile::NIFVersion::VER_BGS)
            return;

        // Discard transformations for the root node, otherwise some meshes
        // occasionally get wrong orientation. Only for NiNode-s for now, but
        // can be expanded if needed.
        // FIXME: if node 0 is *not* the only root node, this must not happen.
        // FIXME: doing this here is awful.
        // We want to do this on world scene graph level rather than local scene graph level.
        if (mRecordIndex == 0 && !Misc::StringUtils::ciEqual(mName, "bip01"))
        {
            mTransform = Nif::NiTransform::getIdentity();
        }
    }
```

## 35. NiTextKeyExtraData: any node in a NIF, first-extra-only in a KF, split/trim/lowercase into a multimap
- `components/nifosg/nifloader.cpp:213-227` - NIF nodes and transforms, importance **high**

Two completely different attachment rules depending on the file. In a MESH (.nif), the loader reads NiTextKeyExtraData off ANY node it walks, at any depth, and flattens every one it finds into a single shared TextKeyMap for the whole file (nifloader.cpp:737-741; the map is created once in load() at :446 and hung on the root's UserDataContainer at :483, only if non-empty). In a KEYFRAME file (.kf), the rule is rigid: the root must be a NiSequenceStreamHelper, and the text keys must be the FIRST entry of its extra list - `extraList[0]->mRecordType != Nif::RC_NiTextKeyExtraData` is a warning and abort, not a search (nifloader.cpp:359-376). The remaining extras of that helper are NiStringExtraData naming the target node for each NiKeyframeController in the parallel controller chain (nifloader.cpp:384-412). Key normalisation is the load-bearing part: each key's text is split on the character set "\r\n" (so ONE key at ONE time can produce SEVERAL entries), each piece is trimmed, lowercased in place, and dropped if empty; survivors go into a MULTIMAP keyed by time, so duplicate times are all retained. Group names are derived from these lowercased strings, which is why every group/text-key comparison elsewhere in the engine is against lowercase.

```cpp
components/nifosg/nifloader.cpp:213-227
    void extractTextKeys(const Nif::NiTextKeyExtraData* tk, SceneUtil::TextKeyMap& textkeys)
    {
        for (const Nif::NiTextKeyExtraData::TextKey& key : tk->mList)
        {
            std::vector<std::string> results;
            Misc::StringUtils::split(key.mText, results, "\r\n");
            for (std::string& result : results)
            {
                Misc::StringUtils::trim(result);
                Misc::StringUtils::lowerCaseInPlace(result);
                if (!result.empty())
                    textkeys.emplace(key.mTime, std::move(result));
            }
        }
    }

components/nifosg/nifloader.cpp:737-741 (mesh: any node)
                if (e->mRecordType == Nif::RC_NiTextKeyExtraData && args.mTextKeys)
                {
                    const Nif::NiTextKeyExtraData* tk = static_cast<const Nif::NiTextKeyExtraData*>(e.getPtr());
                    extractTextKeys(tk, *args.mTextKeys);
                }

components/nifosg/nifloader.cpp:367-374 (kf: first extra only)
            if (extraList[0]->mRecordType != Nif::RC_NiTextKeyExtraData)
            {
                Log(Debug::Warning) << "NIFFile Warning: First extra data was not a NiTextKeyExtraData, but a "
                                    << extraList[0]->mRecordName << ". File: " << nif.getFilename();
                return;
            }

            auto textKeyExtraData = static_cast<const Nif::NiTextKeyExtraData*>(extraList[0].getPtr());
```

## 36. The tga->dds swap is one step of a five-step, existence-checked path search
- `components/misc/resourcehelpers.cpp:80-141` - Materials and textures, importance **critical**
- REFINES OR CORRECTS RECORDED RULE 18

correctTexturePath(resPath, vfs) = correctResourcePath({"textures","bookart"}, resPath, vfs, "dds") (resourcehelpers.cpp:137-141). The input is already normalized: backslashes become '/' and EVERY character is lowercased (components/vfs/pathutil.hpp:18-21, `c == '\\' ? separator : toLower(c)`). The algorithm is: (1) scan the path for a whole path COMPONENT equal to "textures" or "bookart" - findDirectory (:37-62) requires the match to be preceded by start-of-string or '/' AND followed by '/', so "mytextures/x.tga" does not match - and if found, truncate the path to begin at that component; otherwise prefix "textures/". (2) Keep a copy `origExt`, then replace the extension with "dds" - unconditionally, not only for .tga: Normalized::changeExtension replaces everything after the last '.' and returns true even when the text is unchanged (pathutil.hpp:289-297). (3) Then try, IN ORDER, returning the first that vfs.exists(): the .dds path; the ORIGINAL-extension path; "textures/" + basename-of-the-dds-path; "textures/" + basename-of-the-original-extension path. (4) If none exist, return the .dds path anyway. Steps 3c/3d are the 'flatten to the top-level directory' fallback that lets `textures/foo/bar.tga` resolve to `textures/bar.dds`. Note the top-level list is ordered and only the FIRST entry ("textures") is ever used as a prefix; "bookart" is only ever recognised, never synthesised. When the final path does not exist, ImageManager::getImage logs "Failed to open image" and returns mWarningImage - an 8x8 SOLID MAGENTA RGB image (components/resource/imagemanager.cpp:28-43, :96-101) - so a missing texture renders as flat magenta, it does not render untextured. One further Morrowind quirk in the same function: for a .tga with 16bpp and 1 alpha bit the alpha channel is discarded, "Morrowind ignores the alpha channel of 16bpp TGA files even when the header says not to" (imagemanager.cpp:118-139).

```cpp
// If `ext` is not empty we first search file with extension `ext`, then if not found fallback to original extension.
VFS::Path::Normalized Misc::ResourceHelpers::correctResourcePath(
    std::span<const VFS::Path::NormalizedView> topLevelDirectories, VFS::Path::NormalizedView resPath,
    const VFS::Manager& vfs, VFS::Path::ExtensionView ext)
{
    VFS::Path::Normalized correctedPath;

    // Handle top level directory
    bool needsPrefix = true;

    for (const VFS::Path::NormalizedView potentialTopLevelDirectory : topLevelDirectories)
    {
        if (const std::size_t topLevelPos = findDirectory(resPath, potentialTopLevelDirectory);
            topLevelPos != std::string::npos)
        {
            correctedPath = VFS::Path::Normalized(resPath.value().substr(topLevelPos));
            needsPrefix = false;
            break;
        }
    }

    if (needsPrefix)
        correctedPath = topLevelDirectories.front() / resPath;

    const VFS::Path::Normalized origExt = correctedPath;

    // replace extension if `ext` is specified (used for .tga -> .dds, .wav -> .mp3)
    const bool isExtChanged = !ext.empty() && correctedPath.changeExtension(ext);

    if (vfs.exists(correctedPath))
        return correctedPath;

    // fall back to original extension
    if (isExtChanged && vfs.exists(origExt))
        return origExt;

    // fall back to a resource in the top level directory if it exists
    {
        const VFS::Path::Normalized fallback = topLevelDirectories.front() / correctedPath.filename();
        if (vfs.exists(fallback))
            return fallback;
    }

    if (isExtChanged)
    {
        const VFS::Path::Normalized fallback = topLevelDirectories.front() / origExt.filename();
        if (vfs.exists(fallback))
            return fallback;
    }

    retur
...(truncated; see the cited lines)
```

## 37. Material, vertex-colour, specular and alpha properties are gathered from the WHOLE ancestor chain, root-first, and the last one wins
- `components/nifosg/nifloader.cpp:187-211` - Materials and textures, importance **high**

Unlike NiTexturingProperty and NiStencilProperty, which are applied at the node they sit on, exactly four record types are deferred to the drawable: NiMaterialProperty, NiVertexColorProperty, NiSpecularProperty and NiAlphaProperty. collectDrawableProperties recurses to the ROOT FIRST and then appends the current node's own properties, producing a root-to-leaf ordered list; applyDrawableProperties then walks that list mutating ONE material object, so a nearer property overwrites a farther one field by field (a child NiMaterialProperty replaces diffuse/ambient/emissive/specular/gloss/alpha wholesale; a child NiAlphaProperty with blending off actively strips the ancestor's blend state, per the removal branches in handleAlphaBlending/handleAlphaTesting). The geometry's own mShaderProperty and mAlphaProperty pointers are appended LAST, after the inherited chain (:1671-1674 for NiGeometry, :1889-1892 for BSTriShape). At node level these four types are explicit no-ops with the reasons stated in comments: material/vertexcolor/specular 'Handled on drawable level so we know whether vertex colors are available' (:2552-2558), alpha 'Handled on drawable level to prevent RenderBin nesting issues' (:2559-2563). A port that reads these properties only off the shape's own NiTriShape will silently drop every material set on a parent NiNode - which is the common authoring pattern in Morrowind meshes.

```cpp
    // Collect all properties affecting the given drawable that should be handled on drawable basis rather than on the
    // node hierarchy above it.
    void collectDrawableProperties(
        const Nif::NiAVObject* nifNode, const Nif::Parent* parent, std::vector<const Nif::NiProperty*>& out)
    {
        if (parent != nullptr)
            collectDrawableProperties(&parent->mNiNode, parent->mParent, out);
        for (const auto& property : nifNode->mProperties)
        {
            if (!property.empty())
            {
                switch (property->mRecordType)
                {
                    case Nif::RC_NiMaterialProperty:
                    case Nif::RC_NiVertexColorProperty:
                    case Nif::RC_NiSpecularProperty:
                    case Nif::RC_NiAlphaProperty:
                        out.push_back(property.getPtr());
                        break;
                    default:
                        break;
                }
            }
        }
    }
```

---

# Verified with a recorded caveat

Each of these had its mechanism confirmed and one or more overreaching
claims flagged. Read the rule, then the caveat, and implement the
intersection.

## 38. Skin weights are stored PER BONE and inverted into per-vertex lists at load
- `components/nifosg/nifloader.cpp:1698-1717` - NIF skinning, importance **n/a**

NiSkinInstance is read as [NiSkinData ref; NiSkinPartition ref ONLY if version >= 10.1.0.101 (so absent in Morrowind's 4.0.0.2); skeleton-root NiAVObject ref; bone list = u32 count + that many NiAVObject refs] (components/nif/data.cpp:330-337). NiSkinData is [NiTransform (3x3 rotation read as 9 floats row-major, Vec3 translation, float scale); u32 bone count; a NiSkinPartition ref when 4.0.0.2 <= version <= 10.1.0.0, so Morrowind files DO carry this link; a bool hasVertexWeights only when version >= 4.2.1.0, so Morrowind (VER_MW = 0x04000002, niffile.hpp:28) never stores it and it is implicitly true; then per bone: NiTransform, bounding sphere (Vec3 centre + float radius, nifstream.cpp:140-144), u16 vertex count, then that many (u16 vertexIndex, float weight) pairs] (data.cpp:411-428, 35-51, 13-18). Bones pair POSITIONALLY: NiSkinInstance::mBones[i] is the scene node for NiSkinData::mBones[i]. NiSkinInstance::post (data.cpp:339-358) throws on: missing data or missing root, a bone-count mismatch between the two records, or any null bone ref. The loader then inverts the bone->vertices layout into vertex->list of (boneIndex, weight), appending in ascending bone index order, and uses the stored weight values verbatim. Where a NiSkinPartition is present it supplies ONLY triangle/strip topology, replacing the NiTriShapeData primitives (nifloader.cpp:1572-1595); the weights used for skinning always come from NiSkinData, never from the partition.

```cpp
                const Nif::NiSkinInstance* skin = niGeometry->mSkin.getPtr();
                const Nif::NiSkinData* data = skin->mData.getPtr();
                const Nif::NiAVObjectList& bones = skin->mBones;

                // Assign bone weights
                std::vector<SceneUtil::RigGeometry::BoneInfo> boneInfo(bones.size());
                std::vector<SceneUtil::RigGeometry::BoneWeights> influences(geom->getVertexArray()->getNumElements());
                for (std::size_t i = 0; i < bones.size(); ++i)
                {
                    boneInfo[i].mName = Misc::StringUtils::lowerCase(bones[i].getPtr()->mName);
                    boneInfo[i].mInvBindMatrix = data->mBones[i].mTransform.toMatrix();
                    boneInfo[i].mBoundSphere = data->mBones[i].mBoundSphere;
                    for (const auto& [vertex, weight] : data->mBones[i].mWeights)
                        influences.at(vertex).emplace_back(i, weight);
                }
                rig->setBoneInfo(std::move(boneInfo));
                rig->setInfluences(influences);
                rig->setTransform(data->mTransform.toMatrix());
                if (const Nif::NiAVObject* rootBone = skin->mRoot.getPtr())
                    rig->setRootBone(rootBone->mName);

// and the record layout it reads, components/nif/data.cpp:411-428:
    void NiSkinData::read(NIFStream* nif)
    {
        nif->read(mTransform);

        const uint32_t numBones = nif->get<uint32_t>();
        bool hasVertexWeights = true;
        if (nif->getVersion() >= NIFFile::NIFVersion::VER_MW)
        {
            if (nif->getVersion() <= NIFStream::generateVersion(10, 1, 0, 0))
                mPartitions.read(nif);

            if (nif->getVersion() >= NIFStream::generateVersion(4, 2, 1, 0))
                nif->re
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Nearly all of the rule verifies, but the per-bone layout omits a guard. In ReadNiSkinDataBoneInfo (components/nif/data.cpp:35-51) the read is: NiTransform, bounding sphere, u16 numVertices, then `if (!mHasVertexWeights) return;` BEFORE `stream.readVectorOfRecords(numVertices, readNiSkinDataVertWeight, value.mWeights)`. The rule states the (u16 vertexIndex, float weight) pairs as an unconditional tail of every bone record, having introduced hasVertexWeights only to note Morrowind lacks it. Since the rule explicitly generalises across versions (it spells out the 10.1.0.0 and 4.2.1.0 bounds), that is a conditional stated as always-true: for any file with version >= 4.2.1.0 whose hasVertexWeights byte is false, the bone record ends right after the u16 count, and following the rule's layout over-reads numVertices*6 bytes. It also makes the closing claim misleading — because nifloader.cpp:1571-1597 uses only the partition's mTrueTriangles/mTrueStrips and never Partition::mWeights or mBoneIndices, a hasVertexWeights==false NiSkinData leaves mWeights empty and those vertices receive no influences at all, rather than NiSkinData reliably supplying the weights. Everything else confirmed against /tmp/fpv/openmw: NiSkinInstance::read partition guard >= 10.1.0.101 (data.cpp:330-337); readRecordList is readVectorOfRecords<uint32_t>, i.e. u32 count + refs (recordptr.hpp:161, nifstream.hpp:188-203); post throws on empty data/root, bone-count mismatch, null bone (data.cpp:339-358); VER_MW = 0x04000002 at niffile.hpp:28 and the NiSkinData partition ref IS read for Morrowind (>= VER_MW && <= 10.1.0.0), matching getPartitions()'s fallback to mData->mPartitions (data.cpp:360-369); bounding sphere = Vec3 centre + float radius (nifstream.cpp:140-144); Matrix3 is float[3][3] read as 9 contiguous floats; positional bone pairing, ascending-index append, and verbatim weights (RigGeometry::setInfluences only groups identical BoneWeights, never renormalises).

**Corrected form offered:** Same as stated, except for the NiSkinData per-bone record: it is [NiTransform; bounding sphere (Vec3 centre + float radius); u16 vertex count; and THEN, only if hasVertexWeights is true, that many (u16 vertexIndex, float weight) pairs — when the flag is false the count is still consumed but the pair array is absent entirely (components/nif/data.cpp:35-51)]. hasVertexWeights is read only for version >= 4.2.1.0 and defaults to true, so Morrowind (VER_MW = 0x04000002) bone records always do carry the pairs; the conditional only bites on later files. Correspondingly, the last sentence should read: OpenMW's nifosg loader takes skinning weights exclusively from NiSkinData and never reads NiSkinPartition::Partition::mWeights or mBoneIndices, so a NiSkinData with hasVertexWeights false yields empty mWeights and vertices with no influences at all rather than weights sourced from the partition.


## 39. Weights are never normalised, clamped, sorted or limited; unweighted vertices are never written
- `components/sceneutil/riggeometry.cpp:334-346` - NIF skinning, importance **n/a**

Grep of components/sceneutil/riggeometry.cpp and components/nifosg/nifloader.cpp finds no normalisation and no clamping in the NIF skinning path. Concretely: there is no 4-bones-per-vertex limit (a vertex keeps every weight the file gives it, in ascending bone-index order), no epsilon culling of small weights, no sorting by weight, no rescaling so weights sum to 1 - a file whose weights sum to != 1 produces a correspondingly shrunk/expanded/offset vertex, and dropping a missing bone (rule on skeleton binding) does NOT trigger renormalisation of the remaining weights. Vertices are bucketed by EXACT equality of their whole (boneIndex, weight) vector using std::map ordering, so one blend matrix is built per distinct influence set. The empty influence set is explicitly erased, so a vertex with no weights at all is never written to the destination array and keeps the bind-pose coordinates deep-copied at setSourceGeometry - it does not collapse to the origin. Note also nifloader.cpp:1711 uses influences.at(vertex): a weight naming a vertex index >= the vertex count throws rather than being ignored.

```cpp
    void RigGeometry::setInfluences(const std::vector<BoneWeights>& influences)
    {
        if (!mData)
            mData = new InfluenceData;

        std::map<BoneWeights, VertexList> influencesToVertices;
        for (size_t i = 0; i < influences.size(); i++)
            influencesToVertices[influences[i]].emplace_back(static_cast<VertexList::value_type>(i));
        influencesToVertices.erase(BoneWeights());

        mData->mInfluences.reserve(influencesToVertices.size());
        mData->mInfluences.assign(influencesToVertices.begin(), influencesToVertices.end());
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule's non-normalisation core is correct, but it states as unconditional properties of "the NIF skinning path" two things that hold only in one of the two paths that call setInfluences. (1) "No 4-bones-per-vertex limit, in ascending bone-index order" is true only of handleNiGeometry (nifloader.cpp:1704-1714), where the outer loop walks bones i ascending and appends every NiSkinData weight. handleBSTriShape (nifloader.cpp:1863-1880) does `for (int j = 0; j < 4; j++) influences[i].emplace_back(vertData.mBoneIndices[j], halfToFloat(vertData.mBoneWeights[j]))` over `std::array<Misc::float16_t,4> mBoneWeights` / `std::array<char,4> mBoneIndices` (components/nif/node.hpp:383-384) — exactly four influences per vertex, in the file's slot order, not sorted by bone index. (2) The "no weights -> keeps bind-pose, does not collapse to the origin" claim is inverted for that path: a BSTriShape vertex with all four weights zero is not BoneWeights(), it is four (index, 0.0f) pairs, so `influencesToVertices.erase(BoneWeights())` does not remove it; it is written with resultMat left as the all-zero linear part with m[3][3]=1, and since handleBSTriShape never calls setTransform (mTransform is identity), the vertex does collapse to the origin. The erase only protects vertices whose influence vector is literally empty, which in practice means the NiSkinData path. Verified: no normalisation/clamping/epsilon/sorting exists in either file; the missing-bone skip in cull() (riggeometry.cpp:391) does not renormalise; std::map bucketing is exact-equality; and nifloader.cpp:1711 is indeed `influences.at(vertex)`, which throws on an out-of-range vertex index.

> The rule cannot be confirmed because it describes a codebase that is not present. /home/user/project-dagger is "project-dagger", a JavaScript port of Daggerfall (logic from Daggerfall Unity, presentation on hand-rolled WebGL2), not OpenMW. There are no .cpp/.hpp files anywhere in the tree, no components/ directory, and `grep -rli openmw` across the entire checkout and all 2505 commits returns zero hits. The claimed source components/sceneutil/riggeometry.cpp:334-346 and the corroborating components/nifosg/nifloader.cpp:1711 do not exist, so nothing about NIF skin-weight handling, std::map bucketing of (boneIndex, weight) vectors, or influences.at(vertex) can be verified here. More substantively, there is no vertex skinning mechanism at all for any override to contradict. Character geometry is procedural and forward-kinematic: src/characters/rewrite/body.js poses a rig via mkFrame/solveTwoBone and lofts pieces into flat faces, and src/render/characterMesh.js packCharacterFaces packs them into an interleaved [pos.xyz, color.rgb, normal.xyz] stream (9 floats/vertex, fan-triangulated) with no bone indices, no weights, and no blend matrices. A grep over all of src/ for boneWeight|vertexWeight|weightsPerVertex|MAX_BONES|bindPose|inverseBind|skinMatri|blendMatri|jointIndex|normalize-weight returns zero matches (skinRamp in rewrite/limb.js is a skin-tone color ramp, not skinning). On the specific case the lens asks me to confirm - the first-person player body - the rule is doubly inapplicable. The only FP body-geometry path, drawFirstPersonViewmodel at src/render/characterSprite.js:54, is explicitly parked: its header comment reads "ON ICE (2026-08-17, Mac): the voxel FP viewmodel is parked in favor of the TRUE classic method (combat/fpsWeapon.js, WEAPON*.CIF per FPSWeapon). No consumer". Live first person renders src/combat/fpsWeapon.js, the classic Daggerfall 2D CIF sprite method, so there is no first-person body mesh whose vertices any weight rule could govern. Werewolves and beast races are handled by procedural piece swaps (src/characters/pieces/beastBody.js, beastHead.js, tail.js, bodyScales.js) and paperdoll art, not by bone-weight remapping.

**Corrected form offered:** Neither riggeometry.cpp nor nifloader.cpp normalises, rescales, epsilon-culls, or sorts skinning weights: resultMat in RigGeometry::cull accumulates boneMatrices[index] * weight into columns 0-2 with m[3][3] pinned to 1, so a file whose weights sum to != 1 yields a correspondingly shrunk/expanded/offset vertex, and the `if (mNodes[index] == nullptr) continue;` skip for a bone missing from the skeleton does not renormalise the remaining weights. setInfluences buckets vertices by exact std::map equality of the whole (boneIndex, weight) vector, one blend matrix per distinct influence set, and erases the empty set. However, the per-vertex influence list differs by path. In handleNiGeometry (NiSkinData, nifloader.cpp:1704-1714) there is no bone-count limit — a vertex keeps every weight the file names for it, appended in ascending bone-index order because the outer loop iterates bones — and `influences.at(vertex)` at line 1711 throws if a weight names a vertex index >= the vertex count. Only on this path does a vertex named by no weight end up with an empty influence set, get erased, and so keep the bind-pose coordinates deep-copied at setSourceGeometry instead of collapsing to the origi


## 40. 'Skeleton space' is the MatrixTransform product below the Skeleton node; a missing bone is not fatal
- `components/sceneutil/skeleton.cpp:161-175` - NIF skinning, importance **n/a**

The bone matrix fed to the blend is mMatrixInSkeletonSpace = the bone node's own matrix multiplied by its parent's skeleton-space matrix (row-vector: own transform first, then ancestors), with the chain STARTING at the first osg::MatrixTransform below the SceneUtil::Skeleton node - the Skeleton itself and everything above it contribute nothing, so posing happens in skeleton space. Only MatrixTransform nodes are collected into the path (InitBoneCacheVisitor, skeleton.cpp:23-33); plain groups between bones contribute nothing. Matrices are recomputed at most once per traversal number (Skeleton::updateBoneMatrices, skeleton.cpp:95-108). Binding is by NAME only and is resolved lazily on the first update/cull traversal by walking up the node path for the nearest Skeleton ancestor (RigGeometry::initFromParentSkeleton, riggeometry.cpp:100-136). This refines recorded rule 16: the skin's bone names are lowercased once at load (nifloader.cpp:1707) and lowercased again inside Skeleton::getBone, and - critically - a bone the skeleton does not have is NOT an error that aborts anything: it logs 'RigGeometry did not find bone', stores nullptr, and every influence naming it is silently skipped in the blend, so a vertex weighted only to missing bones renders at its bind-pose position rather than disappearing.

```cpp
    void Bone::update(const osg::Matrixf* parentMatrixInSkeletonSpace)
    {
        if (!mNode)
        {
            Log(Debug::Error) << "Error: Bone without node";
            return;
        }
        if (parentMatrixInSkeletonSpace)
            mMatrixInSkeletonSpace = mNode->getMatrix() * (*parentMatrixInSkeletonSpace);
        else
            mMatrixInSkeletonSpace = mNode->getMatrix();

        for (const auto& child : mChildren)
            child->update(&mMatrixInSkeletonSpace);
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule cannot be derived from this codebase, because none of the code it cites exists here. /home/user/project-dagger is a JavaScript/C# Daggerfall-style game project (census: 1077 .js, 856 .cs, 180 .mjs, 0 C++ files). There is no components/ directory, no sceneutil/, no skeleton.cpp, riggeometry.cpp, or nifloader.cpp — not in the working tree, not in vendor/ (which holds only dfu-books, dfu-quests, dfu-settings), not in dist/ or node_modules/, and not at any point in git history (`git log --all --diff-filter=A --name-only` surfaces no such paths). There are no submodules (.gitmodules absent), and grep for "openmw", "osg::MatrixTransform", "SceneUtil", "mMatrixInSkeletonSpace", "InitBoneCacheVisitor", "initFromParentSkeleton", and "updateBoneMatrices" returns zero hits repo-wide. The only name-adjacent file, /home/user/project-dagger/src/characters/pieces/skeletonBones.js, is unrelated: it procedurally builds a ribcage mesh for an undead character model, with no bone hierarchy, no skinning matrices, and no name-based bone binding. Every line reference in the rule is therefore unverifiable against this repo: skeleton.cpp:23-33 (MatrixTransform-only collection), skeleton.cpp:95-108 (once-per-traversal-number caching), riggeometry.cpp:100-136 (lazy name-only binding by walking up for the nearest Skeleton ancestor), and nifloader.cpp:1707 (load-time lowercasing). The only fragment with any support is the snippet pasted into the prompt itself, which does show `mMatrixInSkeletonSpace = mNode->getMatrix() * (*parentMatrixInSkeletonSpace)` and recursion into children — but that text was supplied by the prompt, not fetched from this codebase, so it corroborates nothing about project-dagger. The rule's most load-bearing claims are exactly the unfalsifiable-here absolutes the check warns about: that the Skeleton node and everything above it "contribute nothing," that "only MatrixTransform nodes are collected" so plain groups contribute nothing, that matrices are recomputed "at most once per traversal number," that binding is "by NAME only," and — stated as certain — that a missing bone "is NOT an error that aborts anything," is "silently skipped in the blend," and leaves such a vertex "at its bind-pose position rather than disappearing." That last chain in particular asserts a specific rendering outcome (bind-pose fallback vs. collapse to origin) that depends on how the accumulated weight and result vertex are initialized in the skin loop — code not present here to confirm or deny. Per the instruction to default to refuted when unable to verify, the rule is refut ...

> The structural half of the rule survives the wider search, but its final clause is wrong, and wrong exactly where a first-person player body is concerned. WHAT HOLDS. SceneUtil::Bone::update (/tmp/fpv/openmw/components/sceneutil/skeleton.cpp:169) really does compose mMatrixInSkeletonSpace = own matrix * parent's skeleton-space matrix, row-vector. InitBoneCacheVisitor (skeleton.cpp:23-29) really does collect only osg::MatrixTransform nodes on a path rooted at the Skeleton's children, and nifloader.cpp:472 makes the Skeleton a plain osg::Group that adopts the NIF root's children, so the first bone genuinely is the first MatrixTransform below it. grep shows mMatrixInSkeletonSpace has exactly two readers, both in riggeometry.cpp; there is no Skeleton subclass, no override, and no other writer anywhere in the tree. The first-person and werewolf paths do not change this. SceneUtil::attach (components/sceneutil/attach.cpp:117-142) discards a skinned bodypart's own Skeleton and re-parents its rig subtree directly under the actor's Skeleton, ignoring the requested attach bone - which is precisely what makes name-only binding work for FP hands. MWRender::RotateController (apps/openmw/mwrender/rotatecontroller.cpp:30-54), the one first-person-only bone manipulation, writes the neck node's OWN matrix and lets Bone::update compose it, confirming the rule rather than overriding it. WHAT REFUTES IT. The clause "a vertex weighted only to missing bones renders at its bind-pose position rather than disappearing" is false. RigGeometry::cull seeds the blend accumulator as the ZERO matrix, not identity - riggeometry.cpp:191, osg::Matrixf resultMat(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1) - and riggeometry.cpp:195-196 skips any influence whose bone is nullptr. If every influence on a vertex names a missing bone, nothing accumulates, so rows 0-2 stay zero. Line 204's resultMat *= transform leaves rows 0-2 zero and sets row 3 to transform's row 3. Line 208's resultMat.preMult(v) is the row-vector product v*M, so it evaluates to the translation component of transform for EVERY such vertex, independent of the source position; line 210's transform3x3 yields a zero normal. All such vertices collapse onto one point (the origin of mSkinToSkelMatrix * mData->mTransform): zero-area triangles where a whole face is affected, long spikes to that point where a face mixes present and missing bones. That is the opposite of a bind-pose render, and closer to disappearing than to surviving. riggeometry.cpp:259-268 compounds it - updateBounds skips missing bones outright, so the bounding box does not ...

**Corrected form offered:** Scoped to what can actually be checked: this repository contains no OpenMW C++ source, so no rule about Bone::update, Skeleton::updateBoneMatrices, RigGeometry::initFromParentSkeleton, or NIF-loader bone-name lowercasing can be attributed to it. The only statement supported by the material at hand is the one visible in the supplied snippet: Bone::update composes mMatrixInSkeletonSpace as the node's own matrix times the parent's skeleton-space matrix when a parent is passed (row-vector order: own transform first), falls back to the node's own matrix at the root of the recursion, and then recurses into children passing its own result. The traversal-caching behavior, the MatrixTransform-only path collection, the chain's starting point relative to the Skeleton node, the name-only lazy binding, and the missing-bone handling (including the claim that affected vertices render at bind pose rather than disappearing) are all unverified here and must be confirmed against the actual OpenMW tree before being recorded as fact. Recorded rule 16 should likewise not be treated as refined by this rule on the basis of this codebase.


## 41. The skin's 'skeleton root' is a NAME, and it decides which ancestor transforms get cancelled
- `components/sceneutil/riggeometry.cpp:289-324` - NIF skinning, importance **n/a**

NiSkinInstance::mRoot is stored by name only (nifloader.cpp:1716-1717, rig->setRootBone(rootBone->mName)). Each UPDATE traversal recomputes mSkinToSkelMatrix from the drawable's current node path: start just BELOW the SceneUtil::Skeleton; search forward for the first node whose name matches the skin root case-insensitively; if found, the cancelled range ends just AFTER it (skinRoot++ makes it inclusive); if the skin declares no root or the name is not on this path, fall back to the RigGeometry's parent - EXCLUDED when that parent's name equals the drawable's own name (both come from the NIF node name, nifloader.cpp:715 and :1757, i.e. it is the trishape's own MatrixTransform), INCLUDED when the names differ ('but maybe it can get optimized out'). Over that range every osg::Transform contributes its world-to-local matrix, accumulated by post-multiplication (product of inverses, top-down), and MatrixTransforms whose matrix is identity are skipped. The purpose is to cancel scene-graph transforms that will be re-applied above the drawable, which is why the header says 'the RigGeometry ignores any transforms below the Skeleton, so the attachment point is not that important' (riggeometry.hpp:22-24). This refines recorded rule 12: a copied skinned part is indeed never parented to a bone, but attach.cpp:48-55 copies the topmost filter-matching ANCESTOR of the rig, not the bare drawable, and that surviving chain is exactly what this function walks. VERSION WARNING - this skin-root logic and the NiSkinData overall transform of rule C are master-only: openmw-0.49.0's riggeometry.cpp:200-201 and :283-310 cancel every transform between the Skeleton and the rig's parent inclusive, and never apply NiSkinData's overall transform at all. A port must pick one reference version and say which.

```cpp
    void RigGeometry::updateSkinToSkelMatrix(const osg::NodePath& nodePath)
    {
        if (mSkinToSkelMatrix)
            mSkinToSkelMatrix->makeIdentity();
        auto skeletonRoot = std::find(nodePath.begin(), nodePath.end(), mSkeleton);
        if (skeletonRoot == nodePath.end())
            return;
        skeletonRoot++;
        auto skinRoot = nodePath.end();
        if (!mData->mRootBone.empty())
            skinRoot = std::find_if(skeletonRoot, nodePath.end(),
                [&](const osg::Node* node) { return Misc::StringUtils::ciEqual(node->getName(), mData->mRootBone); });
        if (skinRoot == nodePath.end())
        {
            // Failed to find skin root, cancel out everything up till the trishape.
            // Our parent node is the trishape's transform
            skinRoot = nodePath.end() - 2;
            if ((*skinRoot)->getName() != getName()) // but maybe it can get optimized out
                skinRoot++;
        }
        else
            skinRoot++;
        for (auto it = skeletonRoot; it != skinRoot; ++it)
        {
            const osg::Node* node = *it;
            if (const osg::Transform* trans = node->asTransform())
            {
                const osg::MatrixTransform* matrixTrans = trans->asMatrixTransform();
                if (matrixTrans && matrixTrans->getMatrix().isIdentity())
                    continue;
                if (!mSkinToSkelMatrix)
                    mSkinToSkelMatrix = new osg::RefMatrix;
                trans->computeWorldToLocalMatrix(*mSkinToSkelMatrix, nullptr);
            }
        }
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The mechanism half of the rule is accurate in every detail I could check against master, but the opening cadence claim — "Each UPDATE traversal recomputes mSkinToSkelMatrix from the drawable's current node path" — states as unconditional something the code gates twice, and omits the guard that gives it teeth. updateSkinToSkelMatrix has exactly one caller: updateBounds (riggeometry.cpp:249), which is reached on UPDATE_VISITOR (accept, :382) only after (1) `if (!mSkeleton) { if (!initFromParentSkeleton(nv)) return; }` — riggeometry.cpp:238-241, and (2) `if (!mSkeleton->getActive() && !mBoundsFirstFrame) return; mBoundsFirstFrame = false;` — riggeometry.cpp:243-245, with `bool mBoundsFirstFrame{ true }` (riggeometry.hpp:108). So an inactive skeleton (Skeleton::setActive/ActiveType Inactive, skeleton.hpp:46-57 — the documented "bones are not currently moving" case) recomputes the matrix on the FIRST update traversal and never again. The rule's "each UPDATE traversal" is true only while the skeleton is active. This is load-bearing, not pedantic: cull() — the path that actually skins vertices — consumes the matrix at riggeometry.cpp:184-185 (`transform = (*mSkinToSkelMatrix) * mData->mTransform`) and never recomputes it. So for an inactive skeleton the skinning transform is whatever node path was current at the last passing update, not the drawable's current one. A reader porting from this rule would believe the matrix self-heals per frame after a reparent; it does not unless the skeleton is active. Secondary omission: the function's own early exit `if (skeletonRoot == nodePath.end()) return;` (:294-295) — if the Skeleton is not on the path, nothing is cancelled at all and any previously accumulated matrix is left identity. For the record, the parts I tried hardest to break and could not: nodePath does end with the RigGeometry (accept does nv.pushOntoNodePath(this) at :365), so end()-2 is genuinely the parent; the fallback polarity is NOT inverted (loop is half-open `it != skinRoot`, so name-equal leaves skinRoot at the parent = EXCLUDED, name-differs increments = INCLUDED, exactly as stated); skinRoot++ on a found root does make it inclusive; the identity-skip and post-multiplied computeWorldToLocalMatrix are right; nifloader.cpp:1716-1717, :715, :1757, attach.cpp:48-55 and riggeometry.hpp:22-24 all land on precisely the cited code; and the 0.49.0 warning holds (updateGeomToSkelMatrix spans :283-310, walks begin()→end()-1 cancelling Skeleton-exclusive through parent-inclusive, has no root-bone concept, and the class has no mTransform member — though the overa ...

**Corrected form offered:** NiSkinInstance::mRoot is stored by name only (nifloader.cpp:1716-1717, rig->setRootBone(rootBone->mName)). mSkinToSkelMatrix is recomputed from the drawable's current node path in updateSkinToSkelMatrix, called only from updateBounds (riggeometry.cpp:249) on an UPDATE traversal AND only when that call gets past two guards: the skeleton must be resolvable (initFromParentSkeleton, :238-241) and, after the very first update, the skeleton must be active — `if (!mSkeleton->getActive() && !mBoundsFirstFrame) return;` (:243-245, mBoundsFirstFrame starts true). For an inactive skeleton the matrix is therefore computed once and then frozen, and cull() — which does the actual skinning — only consumes it (:184-185, transform = (*mSkinToSkelMatrix) * mData->mTransform) and never recomputes it, so skinning can run on a matrix derived from a stale node path. When it does run: if the Skeleton is not on the node path the function returns immediately and cancels nothing (:294-295). Otherwise start just BELOW the Skeleton; search forward for the first node whose name matches the skin root case-insensitively (only if the skin declares a root); if found, the cancelled range ends just AFTER it (skinRoo


## 42. A skinned mesh's bounds come from the bones' bounding spheres, never from posed vertices
- `components/sceneutil/riggeometry.cpp:251-268` - NIF skinning, importance **n/a**

The bounding box is the union of every resolved bone's NiSkinData BoneInfo bounding sphere (read at data.cpp:41-42, carried at nifloader.cpp:1709), each transformed by bone->mMatrixInSkeletonSpace * transform - the same 'transform' as rule C (skinToSkel then NiSkinData's overall transform), so the bone's current pose then the skin-to-skeleton correction. Bones that did not resolve are skipped. transformBoundingSphere (components/sceneutil/util.hpp:59-90) moves the centre and takes the LARGEST of three axis-probe lengths as the new radius: a conservative approximation, not a tight bound. This runs in the UPDATE traversal only, and after the first frame it is skipped entirely while the skeleton is inactive. When the box changes, both double-buffered geometries receive it through CopyBoundingBoxCallback / CopyBoundingSphereCallback and all parents are dirtied; the internal geometries have setCullingActive(false) (riggeometry.cpp:54), so ALL culling of a skinned mesh uses this bone-sphere box and nothing else.

```cpp
        osg::BoundingBox box;
        osg::Matrixf transform;
        if (mSkinToSkelMatrix)
            transform = (*mSkinToSkelMatrix) * mData->mTransform;
        else
            transform = mData->mTransform;

        size_t index = 0;
        for (const BoneInfo& info : mData->mBones)
        {
            const Bone* bone = mNodes[index++];
            if (bone == nullptr)
                continue;

            osg::BoundingSpheref bs = info.mBoundSphere;
            transformBoundingSphere(bone->mMatrixInSkeletonSpace * transform, bs);
            box.expandBy(bs);
        }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The mechanical core is right (union of resolved bones' spheres in /tmp/fpv/openmw/components/sceneutil/riggeometry.cpp:251-268, transform = skinToSkel * mData->mTransform, null bones skipped, UPDATE-only dispatch at riggeometry.cpp:382, the !getActive() && !mBoundsFirstFrame skip at 243-245, double-buffered copy + parent dirtying), but three claims overreach or invert what the code does. (1) "conservative approximation" is backwards. transformBoundingSphere (/tmp/fpv/openmw/components/sceneutil/util.hpp:59-90) probes the three axis offsets and takes the largest resulting length. Each probe length is a row norm of the matrix's linear part, and every row norm is <= the largest singular value, so the computed radius is never larger than the true transformed-sphere radius. It is exact for rotation/uniform-scale (the usual bone case) and an UNDER-estimate under shear or non-uniform scale - i.e. potentially non-conservative, the opposite of what the rule asserts. (The subsequent box.expandBy(sphere) is what adds slack, not the radius rule.) (2) "ALL culling of a skinned mesh uses this bone-sphere box and nothing else" over-generalises in two ways. First, RigGeometry::accept (riggeometry.cpp:378-386) never calls nv.apply(*this) for a CULL_VISITOR - it calls cull() directly - so the CullVisitor's drawable frustum test is never applied to this box either. The box reaches culling only indirectly, by feeding ancestors' bounds via the dirtyBound() loop; the actual isCulled test runs on a parent's combined bound, which also covers siblings. Consequently the per-vertex skinning loop in cull() runs whenever the parent is not culled, regardless of this box. Second, not every skinned mesh is a SceneUtil::RigGeometry: COLLADA/glTF skins are converted to SceneUtil::RigGeometryHolder (/tmp/fpv/openmw/components/sceneutil/riggeometryosgaextension.cpp:93-94, 114), whose _boundingBox comes from the osgAnimation source geometry's compute-bound callback and has nothing to do with NiSkinData bone spheres. (3) The sphere source is stated as NiSkinData only. nifloader.cpp:1709 is one of two sites; nifloader.cpp:1870 fills the same BoneInfo::mBoundSphere from Nif::BSSkinBoneData for Fallout 4 BSTriShape skins (struct at components/nif/data.hpp:263-275). data.cpp:41-42 covers only the NiSkinData path.

**Corrected form offered:** In RigGeometry::updateBounds (/tmp/fpv/openmw/components/sceneutil/riggeometry.cpp:235-268) the box is the union of the bounding spheres of every bone that resolved to a non-null Bone; each sphere is carried from the NIF loader - NiSkinData::BoneInfo::mBoundSphere at nifloader.cpp:1709 (read at nif/data.cpp:41-42) for NiSkinInstance meshes, and BSSkinBoneData::BoneInfo::mBoundSphere at nifloader.cpp:1870 for Fallout 4 BSTriShape skins - and is transformed by bone->mMatrixInSkeletonSpace * transform, where transform is (skinToSkel * mData->mTransform), the same composition the vertex path uses (the bound path just omits the per-bone inverse bind matrix). Unresolved bones are skipped, as are invalid spheres (BoundingBox::expandBy ignores them). transformBoundingSphere (components/sceneutil/util.hpp:59-90) moves the centre and takes the largest of three axis-probe lengths as the radius. Those lengths are row norms of the matrix's linear part, so the result is always <= the true (max-singular-value) radius: exact for rotation and uniform scale, an under-estimate under shear or non-uniform scale. It is therefore not a conservative bound; the slack in the final box comes from wrapping ea


## 43. Skinning runs once per frame in the CULL traversal, into a frame%2 double buffer
- `components/sceneutil/riggeometry.cpp:149-161` - NIF skinning, importance **n/a**

Ordering and frequency are part of the contract. Bounds and the skin-to-skeleton matrix are computed in the UPDATE traversal (accept -> updateBounds, riggeometry.cpp:382-383); the vertex skinning itself happens in the CULL traversal (accept -> cull, :369-381). cull() re-poses at most once per traversal number: if this frame's number was already handled (a second camera or render pass) or the skeleton is inactive after the first frame, the previously written geometry is re-submitted unchanged and no vertex is recomputed. The output alternates between two geometries selected by frame % 2 (getGeometry, :395-398), so the buffer being written is not the one drawn last frame. mSkeleton->updateBoneMatrices(traversalNumber) is called at the top of both cull and updateBounds, and is itself idempotent per frame. Consequences for a port: the skinToSkel matrix used by a frame's skinning is the one computed in that frame's preceding update pass, and the drawable itself is never culled - only its precomputed bone-sphere box is (see the bounds rule). This is the only skinning path for NIF content: SceneUtil::RigGeometryHolder / OsgaRigGeometry (components/sceneutil/riggeometryosgaextension.hpp:13-30) exist solely for osgAnimation/COLLADA models.

```cpp
        unsigned int traversalNumber = nv->getTraversalNumber();
        if (mLastFrameNumber == traversalNumber || (mLastFrameNumber != 0 && !mSkeleton->getActive()))
        {
            osg::Geometry& geom = *getGeometry(mLastFrameNumber);
            nv->pushOntoNodePath(&geom);
            nv->apply(geom);
            nv->popFromNodePath();
            return;
        }
        mLastFrameNumber = traversalNumber;
        osg::Geometry& geom = *getGeometry(mLastFrameNumber);

        mSkeleton->updateBoneMatrices(traversalNumber);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The mechanism sketch is right (update computes bounds + skinToSkel, cull skins, once per traversal number, frame%2 double buffer) and every line citation checks out, but two consequences are asserted unconditionally when the code makes them conditional. (a) "the buffer being written is not the one drawn last frame" fails because the early-out at riggeometry.cpp:150-157 re-submits the old geometry WITHOUT advancing mLastFrameNumber; after one inactive frame the next re-pose lands on traversalNumber = mLastFrameNumber+2, so getGeometry() returns the very buffer drawn last frame. The parity is tied to the absolute traversal number, not to an alternation counter, so any skipped cull collides the same way. (b) "the skinToSkel matrix used by a frame's skinning is the one computed in that frame's preceding update pass" omits two guards: updateBounds early-returns at :243 (!getActive() && !mBoundsFirstFrame), and Skeleton::traverse (skeleton.cpp:131-138) skips the update traversal entirely for Inactive skeletons after frame 1 and for SemiActive skeletons whose mLastCullFrameNumber+3 <= traversalNumber. Since getActive() is mActive != Inactive (skeleton.cpp:119-122), a SemiActive rig passes cull's guard and re-skins while its update pass was skipped, using a stale mSkinToSkelMatrix and stale bounding box.

**Corrected form offered:** Ordering and frequency are part of the contract. Bounds and the skin-to-skeleton matrix are computed in the UPDATE traversal (accept -> updateBounds, riggeometry.cpp:382-383); the vertex skinning happens in the CULL traversal (accept -> cull, :369-381). cull() re-poses at most once per traversal number: if this frame's number was already handled (a second camera or render pass) or the skeleton is inactive after the first cull, the previously written geometry is re-submitted unchanged, no vertex is recomputed, and crucially mLastFrameNumber is NOT advanced. Output geometry is chosen by mLastFrameNumber % 2 (getGeometry, :395-398), so the write targets a different buffer than the previous draw only when re-posing happens on consecutive traversal numbers; after a skipped or re-submitted frame the next re-pose (traversal n+2) writes into the same buffer that was just drawn, so a port cannot rely on the double buffer as an unconditional write/read separation. mSkeleton->updateBoneMatrices(traversalNumber) is called in both cull and updateBounds and is idempotent per frame (skeleton.cpp:95-111). The skinToSkel matrix is recomputed only inside updateBounds, which itself returns early when


## 44. A text key record is (time, blob); the blob is split on \r and \n, trimmed, lowercased, and every surviving line becomes its own key AT THE SAME TIME
- `components/nifosg/nifloader.cpp:213-227` - Text keys and .kf, importance **n/a**

NiTextKeyExtraData holds a vector of {float mTime; std::string mText} (components/nif/extra.hpp:74-86, read at extra.cpp:19-30). Loading does NOT treat mText as one key. It is split with Misc::StringUtils::split(mText, results, "\r\n"), and that split uses find_first_of over the delimiter STRING AS A CHARACTER SET (components/misc/strings/algorithm.hpp:173-184), so it breaks on '\r' OR '\n' individually — a CRLF-separated blob yields an empty string between each pair. Each piece is then trimmed (algorithm.hpp:160-171, std::isspace: space \t \n \v \f \r), ASCII-lowercased, and dropped if empty. Every non-empty piece is emplaced into a std::multimap<float,std::string> under THE SAME mTime. So one NIF text-key record carrying "Idle: Stop\r\nIdle2: Start" produces TWO independent keys at one identical time, and the multimap is what preserves them. JS port: `text.split(/[\r\n]/).map(trim).map(asciiLower).filter(s => s.length)`, all pushed at the one time, into a structure that allows duplicate times.

```cpp
    void extractTextKeys(const Nif::NiTextKeyExtraData* tk, SceneUtil::TextKeyMap& textkeys)
    {
        for (const Nif::NiTextKeyExtraData::TextKey& key : tk->mList)
        {
            std::vector<std::string> results;
            Misc::StringUtils::split(key.mText, results, "\r\n");
            for (std::string& result : results)
            {
                Misc::StringUtils::trim(result);
                Misc::StringUtils::lowerCaseInPlace(result);
                if (!result.empty())
                    textkeys.emplace(key.mTime, std::move(result));
            }
        }
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule's parsing pipeline is entirely correct and I confirmed every step against the source: the record layout (extra.hpp:74-86, extra.cpp:19-30); split's find_first_of over the delimiter as a CHARACTER SET (algorithm.hpp:173-184), so CRLF really does yield an empty piece between each pair (verified by compiling and running the split: 3 pieces, ["Idle: Stop", "", "Idle2: Start"]); trim via std::isspace (algorithm.hpp:160-171); ASCII-only lowercasing via the 256-entry tolowermap that touches only A-Z (lower.hpp:26-40); the empty-drop guard in the correct direction; and both surviving pieces emplaced under the identical key.mTime. So "one NIF text-key record can yield two keys at one time" is right. It overreaches on the destination. `textkeys` is a SceneUtil::TextKeyMap (components/sceneutil/textkeymap.hpp), NOT a std::multimap<float,std::string>. TextKeyMap is a class wrapping that multimap PLUS a std::set<std::string, std::less<>> mGroups, and its emplace() runs a conditional the rule elides entirely: it does textKey.find(": ") and, when found, inserts substr(0, separator) into mGroups before inserting into the multimap. That group set is what backs hasGroupStart(), findGroupStart() and getGroups() — the animation layer's group discovery. The rule converts its mischaracterization into the port spec ("into a structure that allows duplicate times"), so a JS port built to it would faithfully reproduce split/trim/lower/filter and silently lose group registration. The rule's own example is exactly the case that fires the elided branch twice, registering "idle" and "idle2".

**Corrected form offered:** NiTextKeyExtraData holds a vector of {float mTime; std::string mText} (components/nif/extra.hpp:74-86, read at extra.cpp:19-30). Loading does NOT treat mText as one key. It is split with Misc::StringUtils::split(mText, results, "\r\n"), and that split uses find_first_of over the delimiter STRING AS A CHARACTER SET (components/misc/strings/algorithm.hpp:173-184), so it breaks on '\r' OR '\n' individually — a CRLF-separated blob yields an empty string between each pair. Each piece is then trimmed (algorithm.hpp:160-171, std::isspace: space \t \n \v \f \r), ASCII-lowercased (lower.hpp:26-40, a tolowermap that maps only A-Z and leaves multibyte bytes unchanged), and dropped if empty. Every non-empty piece is then emplaced under THE SAME mTime into a SceneUtil::TextKeyMap (components/sceneutil/textkeymap.hpp) — NOT a raw std::multimap. TextKeyMap wraps a std::multimap<float,std::string> (which is what preserves duplicate times) alongside a std::set<std::string, std::less<>> mGroups, and its emplace() does two things: if the key contains ": " it inserts the prefix before that separator into mGroups, then it inserts into the multimap. mGroups backs hasGroupStart(), findGroupStart() and ge


## 45. Case is normalised ONCE at load, ASCII-only; every consumer then does EXACT byte comparison
- `components/misc/strings/lower.hpp:23-40` - Text keys and .kf, importance **n/a**

lowerCaseInPlace is applied in extractTextKeys (nifloader.cpp:222). It uses a 256-entry table that maps only 'A'-'Z' (65-90) to 'a'-'z'; every other byte, including all multibyte/UTF-8 continuation bytes, is returned unchanged. After that point NOTHING in the animation layer is case-insensitive: Animation::handleTextKey compares with `==` and starts_with (animation.cpp:861-867), Animation::reset via equalsParts uses `==` (animation.cpp:169-178), CharacterController::handleTextKey compares evt.substr(...) against lowercase literals with `!=`/`==` (character.cpp:1016, 1024, 1067, 1074+). Groups passed in from code ("weapononehand", "idle1h", "spellcast") are already lowercase literals. JS port: lowercase with an ASCII-only map at parse time (NOT String.prototype.toLowerCase, which is Unicode-aware and would fold e.g. 'İ' or 'K'), then compare exactly. This also means the payload of a `sound:` key is lowercased too — the sound ID is looked up in lowercase.

```cpp
    /// Plain and simple locale-unaware toLower. Anything from A to Z is lower-cased, multibyte characters are
    /// unchanged. Don't use std::tolower(char, locale&) because that is abysmally slow. Don't use tolower(int) because
    /// that depends on global locale.
    inline constexpr char toLower(char c)
    {
        return tolowermap[static_cast<unsigned char>(c)];
    }

    /// Transforms input string to lower case w/o copy
    inline void lowerCaseInPlace(std::string& str)
    {
        for (auto& ch : str)
            ch = toLower(ch);
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The comparison half of the rule is exactly right and every line number checks out against OpenMW master: lower.hpp's 256-entry table maps only 65-90 to 97-122 and leaves every other byte (including UTF-8 continuation bytes) untouched; nifloader.cpp:213-227 splits on "\r\n", trims, lowerCaseInPlace's each line and skips empties; equalsParts at animation.cpp:169-178 is starts_with + ==; Animation::handleTextKey at 861-867 is starts_with + ==; character.cpp:1016/1024/1067/1074 are ==/!= against lowercase literals. But the absolute "after that point NOTHING in the animation layer is case-insensitive" is contradicted by the very branch the rule ends on. character.cpp:1019 passes the lowercased payload to ESM::RefId::stringRefId, and RefIds are interned in a std::unordered_set keyed by Misc::StringUtils::CiHash/CiEqual (components/esm/stringrefid.cpp:17), with StringRefId::operator==(string_view) = ciEqual and operator< = ciLess (:59-66). The soundgen branch is the same: Creature::getSoundIdFromSndGen matches `ourId == sound->mCreature` (creature.cpp:605) by case-insensitive RefId compare. So sound resolution downstream of the text key is case-insensitive, and that is precisely why the lowercased payload resolves at all: Morrowind sound records retain their ESM casing ("WolfHowl", "Item Weapon Longblade Up"). The rule's porting instruction, "lowercase at parse time, then compare exactly", is correct for text-key matching but wrong for the sound path it explicitly calls out: an exact-match lookup of a lowercased sound ID against a store keyed by original-case ESM IDs finds nothing. A lesser gap: lowercasing at parse time is not universal even upstream, since the osgAnimation/collada path builds text keys from a .txt sidecar via parseTextKey (components/resource/keyframemanager.cpp:28-33, 172) with no case folding.

**Corrected form offered:** lowerCaseInPlace is applied in extractTextKeys (nifloader.cpp:222), after the line is split on "\r\n" and trimmed, with empty results dropped (nifloader.cpp:217-224). It uses a 256-entry table that maps only 'A'-'Z' (65-90) to 'a'-'z'; every other byte, including all multibyte/UTF-8 continuation bytes, is returned unchanged. Every text-key STRING COMPARISON after that point is case-sensitive against lowercase literals: Animation::handleTextKey uses == and starts_with (animation.cpp:861-867), Animation::reset via equalsParts uses starts_with/== (animation.cpp:169-178), CharacterController::handleTextKey compares evt.substr(...) with !=/== (character.cpp:1016, 1024, 1067, 1074+). Groups passed in from code ("weapononehand", "idle1h", "spellcast") are already lowercase literals. The payloads the handler then extracts leave that world, however: `sound:` hands evt.substr(7) to ESM::RefId::stringRefId, and RefIds are interned in a CiHash/CiEqual set with operator==(string_view)=ciEqual and operator<=ciLess (components/esm/stringrefid.cpp:17, 59-66), so the sound-store lookup is case-INsensitive; the `soundgen:` path likewise resolves through case-insensitive RefId compares (creature.cpp:


## 46. getStartTime is the group's FIRST key, not its "start" key; getTextKeyTime is a PREFIX match returning -1 when absent
- `apps/openmw/mwrender/animation.cpp:827-854` - Text keys and .kf, importance **n/a**

Two different lookups, easy to conflate. getStartTime(group) uses findGroupStart, whose predicate is only `starts_with(group) && compare(group.size(), 2, ": ") == 0` — ANY key of that group — over the map in FORWARD time order, so it returns the time of the group's earliest key whatever its action is; the header comment says so verbatim: "Get the absolute position in the animation track of the first text key with the given group" (animation.hpp:427-428). getTextKeyTime(textKey) is a PREFIX test (`iterKey->second.starts_with(textKey)`), forward in time, and returns the first match; it does NOT require an exact key. Both iterate mAnimSources in REVERSE (last-added source wins) and both return -1.f when nothing matches — which is the sentinel every caller tests (e.g. character.cpp:1243 `if (minAttackTime == -1.f ...)`, animation.cpp:807 `if (getTextKeyTime(group + ": loop start") >= 0) return true`). JS port: -1 is the not-found value, not null/undefined, and the callers compare against it numerically.

```cpp
    float Animation::getStartTime(const std::string& groupname) const
    {
        for (AnimSourceList::const_reverse_iterator iter(mAnimSources.rbegin()); iter != mAnimSources.rend(); ++iter)
        {
            const SceneUtil::TextKeyMap& keys = (*iter)->getTextKeys();

            const auto found = keys.findGroupStart(groupname);
            if (found != keys.end())
                return found->first;
        }
        return -1.f;
    }

    float Animation::getTextKeyTime(std::string_view textKey) const
    {
        for (AnimSourceList::const_reverse_iterator iter(mAnimSources.rbegin()); iter != mAnimSources.rend(); ++iter)
        {
            const SceneUtil::TextKeyMap& keys = (*iter)->getTextKeys();

            for (auto iterKey = keys.begin(); iterKey != keys.end(); ++iterKey)
            {
                if (iterKey->second.starts_with(textKey))
                    return iterKey->first;
            }
        }

        return -1.f;
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Every mechanical claim verifies exactly, but one universal quantifier overreaches. VERIFIED (all confirmed against source): - findGroupStart's predicate is verbatim `value.second.starts_with(mGroupName) && value.second.compare(mGroupName.size(), 2, ": ") == 0` (components/sceneutil/textkeymap.hpp, struct IsGroupStart) — note this lives in textkeymap.hpp, NOT animation.hpp as the rule's phrasing loosely implies. - It is a std::find_if over `std::multimap<float, std::string> mTextKeyByTime` from begin() to end(), i.e. forward time order, so it does return the group's earliest key regardless of action suffix. The ": " check correctly prevents "idle" matching "idle2: start". - The header comment is verbatim and the line cite is exact: animation.hpp:427 is the comment "/// Get the absolute position in the animation track of the first text key with the given group.", :428 the declaration. - getTextKeyTime is indeed a pure prefix test (`iterKey->second.starts_with(textKey)`), forward, first match, no exact-key requirement. - Both loop mAnimSources via rbegin/rend (animation.cpp:829, :842) and mAnimSources.push_back(animsrc) is at animation.cpp:703, so "last-added source wins" is right. - Both return -1.f. Both cited examples are verbatim correct: character.cpp:1243 is `if (minAttackTime == -1.f || minAttackTime >= maxAttackTime)`, and animation.cpp:807 is `if (getTextKeyTime(std::string(group) + ": loop start") >= 0)` / :808 `return true`. THE OVERREACH: "-1.f ... which is the sentinel every caller tests" is false. Two of the nine call sites never test the sentinel and instead consume the value arithmetically: - character.cpp:2597-2600 — `float start = getTextKeyTime(mGroup + ": start"); float stop = getTextKeyTime(mGroup + ": stop"); float time = std::clamp(animation.mTime, start, stop); entry.mTime = (time - start) / (stop - start);` No -1 check at all. If the keys are missing this clamps against -1/-1 and divides by zero, and if start > stop std::clamp is undefined behavior. - character.cpp:1879-1882 — minAttackTime and startTime feed straight into `if (startTime <= currentTime && currentTime < minAttackTime)` and then into `(currentTime - startTime) / (minAttackTime - startTime)`; the ordering comparison happens to filter the -1 case, but nothing tests the sentinel. (character.cpp:1767-1780 is likewise mixed: :1776 does test `minAttackTime != -1.f`, but the minHitTime/hitTime pair at :1779-1780 is only ordering-compared.) This matters for the JS port, and it cuts the opposite way from the rule's framing: because some callers do raw arithmetic on the result, ...

**Corrected form offered:** Two different lookups, easy to conflate. getStartTime(group) uses SceneUtil::TextKeyMap::findGroupStart (defined in components/sceneutil/textkeymap.hpp, not animation.hpp), whose predicate is only `starts_with(group) && compare(group.size(), 2, ": ") == 0` — ANY key of that group — applied by std::find_if over the multimap in FORWARD time order, so it returns the time of the group's earliest key whatever its action is; the header comment says so verbatim: "Get the absolute position in the animation track of the first text key with the given group" (animation.hpp:427-428). getTextKeyTime(textKey) is a PREFIX test (`iterKey->second.starts_with(textKey)`), forward in time, returning the first match; it does NOT require an exact key. Both iterate mAnimSources in REVERSE (last-added source wins, since addAnimSource push_backs at animation.cpp:703) and both return -1.f when nothing matches. JS port: -1 is the not-found value, not null/undefined. Most callers test it numerically (character.cpp:1243 `if (minAttackTime == -1.f || minAttackTime >= maxAttackTime)`, character.cpp:1413 and :1471 `< 0`, character.cpp:1643 `startTime == -1.f`, character.cpp:2643 `endOfLoop < 0`, animation.cpp:807


## 47. A key whose group is not the playing group is SILENTLY DROPPED — except "sound: " and "soundgen: ", which are group-independent
- `apps/openmw/mwmechanics/character.cpp:1012-1073` - Text keys and .kf, importance **n/a**

Every key the playhead crosses is dispatched (Animation::runAnimation -> Animation::handleTextKey -> mTextKeyListener->handleTextKey, animation.cpp:1372-1390, 870-873), so the listener sees keys of OTHER groups too. CharacterController::handleTextKey filters them, and the order of the checks is the rule: (1) the whole key is forwarded to Lua unconditionally; (2) if it starts with the 7 bytes "sound: ", the remainder is a sound ID and it plays at volume 1.0 / pitch 1.0, then RETURNS — no group check at all; (3) if it starts with the 10 bytes "soundgen: ", the remainder is `<sndgen name> [volume] [pitch]`, whitespace-split (default delimiter " "), volume and pitch parsed as floats defaulting to 1.0, then RETURNS — again no group check; (4) only then is the group tested, and any key not beginning with exactly `<currently playing group>` + ": " is discarded with the comment "Not ours, skip it". There is no error, no fallback, no warning — an unknown or foreign group's key simply does nothing. Note the test is against the group the STATE is playing, not against the set of known groups: an unknown group's keys are never even reached, because a group with no keys can never be played (rule on mSupportedAnimations above).

```cpp
        std::string_view evt = key->second;

        MWBase::Environment::get().getLuaManager()->animationTextKey(mPtr, key->second);

        if (evt.substr(0, 7) == "sound: ")
        {
            MWBase::SoundManager* sndMgr = MWBase::Environment::get().getSoundManager();
            sndMgr->playSound3D(mPtr, ESM::RefId::stringRefId(evt.substr(7)), 1.0f, 1.0f);
            return;
        }

        auto& charClass = mPtr.getClass();
        if (evt.substr(0, 10) == "soundgen: ")
        {
            std::string_view soundgen = evt.substr(10);

            // The event can optionally contain volume and pitch modifiers
            float volume = 1.0f;
            float pitch = 1.0f;

            if (soundgen.find(' ') != std::string::npos)
            {
                std::vector<std::string_view> tokens;
                Misc::StringUtils::split(soundgen, tokens);
                soundgen = tokens[0];

                if (tokens.size() >= 2)
                {
                    volume = Misc::StringUtils::toNumeric<float>(tokens[1], volume);
                }

                if (tokens.size() >= 3)
                {
                    pitch = Misc::StringUtils::toNumeric<float>(tokens[2], pitch);
                }
            }

            const ESM::RefId sound = charClass.getSoundIdFromSndGen(mPtr, soundgen);
...
        if (evt.substr(0, groupname.size()) != groupname || evt.substr(groupname.size(), 2) != ": ")
        {
            // Not ours, skip it
            return;
        }

        std::string_view action = evt.substr(groupname.size() + 2);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The ordering claim is right, but step (1) is stated as unconditional when it is not, and the excerpt was cut one line below the guard that makes it conditional. CharacterController::handleTextKey opens at character.cpp:1009-1011 with `if (!mAnimation) return;` — two lines ABOVE where the quoted span starts (line 1012, `std::string_view evt = key->second;`). That early return aborts the entire handler, the Lua dispatch included, so it is false that "the whole key is forwarded to Lua unconditionally"; when mAnimation is null nothing at all happens, not Lua, not sound, not the group test. (The guard is defensive — detachAnimation at 998-1004 nulls mAnimation and calls setTextKeyListener(nullptr) in the same block — but it is a real guard on the very step the rule calls unconditional.) Secondarily, the rule flattens the soundgen branch: after parsing, playback is gated twice — `charClass.getSoundIdFromSndGen(mPtr, soundgen)` may return an empty RefId, in which case nothing plays at all, and for soundgen "left"/"right" the sound plays only `if (!sndMgr->getSoundPlaying(mPtr, wolfRun))`, with MWSound::Type::Foot and PlayMode::NoPlayerLocal rather than a plain playSound3D. The rule's own "no error, no fallback, no warning" phrasing also sits next to an error path it does not mention: Animation::handleTextKey wraps the listener call in try/catch and logs `Log(Debug::Error) << "Error handling text key ..."` (animation.cpp:870-878) — that fires on exceptions, not on foreign-group keys, so it does not contradict the discard claim but does contradict the flat "there is no error" framing of the dispatch path. Everything else checks out: dispatch is Animation::runAnimation -> handleTextKey (animation.cpp:1375, 1388) -> mTextKeyListener->handleTextKey (872-873); groupname is `stateiter->first`, the state's own playing group, so the listener genuinely sees other groups' keys from the same text-key map; the `sound: ` branch does play at 1.0f/1.0f and returns with no group check; split's default delimiter really is " "; the group test `evt.substr(0, groupname.size()) != groupname || evt.substr(groupname.size(), 2) != ": "` discards silently; and Animation::reset (animation.cpp:968-1040) does return false unless both a start and a stop key exist for the group, so a keyless group can never become an AnimState and can never be the groupname argument. Note one addition the rule misses: keys are also dispatched from Animation::play (animation.cpp:940-960) at and below the start time, so the listener sees keys the playhead never "crossed" during runAnimation.

> The dispatch chain and the order of checks are correct and nothing overrides them: CharacterController is the sole TextKeyListener implementer (character.hpp:128), setTextKeyListener has exactly one caller (character.cpp:918), handleTextKey has no subclass override, and NpcAnimation::setViewMode/rebuild (npcanimation.cpp:296-321, 435-442) keeps the same animation object so a first-person switch never drops the listener. But the rule truncates the soundgen branch exactly where the player / first-person / werewolf special cases live (character.cpp:1049-1063), and those matter for a first-person player body. (1) The branch does not merely parse and return: charClass.getSoundIdFromSndGen(mPtr, soundgen) resolves the name and an empty result plays nothing — Npc::getSoundIdFromSndGen (mwclass/npc.cpp:1149-1197) returns empty when flying, returns empty for "land", "moan", "roar", "scream", and otherwise selects swim/footwater/bare/light/medium/heavy from the Boots slot (beast races, unable to wear boots, always take the bare branch). (2) soundgen "left"/"right" is special-cased twice: it plays only if !sndMgr->getSoundPlaying(mPtr, wolfRun) — a werewolf suppression, wolfRun at character.cpp:63, looped at :2530-2540 — and it passes MWSound::Type::Foot with PlayMode::NoPlayerLocal, deliberately opting out of the player branch in SoundManager::playSound3D (mwsound/soundmanagerimp.cpp:549). Every other key sound (sound: at :1019, non-footstep soundgen at :1061) takes that player branch and becomes a 2D local sound for the player, so the FP player's footsteps are the one positional sound here. (3) "There is no error, no fallback, no warning" is false on this path: Npc::getSoundIdFromSndGen throws "Unexpected soundgen type: <name>" (npc.cpp:1196) and Class::getSoundIdFromSndGen throws "class does not support soundgen look up" (mwworld/class.cpp:274); the throw escapes into Animation::handleTextKey's try/catch (mwrender/animation.cpp:866-878) and is logged at Debug::Error, and Creature/Activator carry explicit fallbacksounds lists (creature.cpp:588+, activator.cpp:132+). Smaller corrections: if (!mAnimation) return; precedes the Lua forward (:1010-1011); LuaManager::animationTextKey (mwlua/luamanagerimp.cpp:598-604) drops keys containing no ": " and splits the rest into group+key rather than forwarding the whole key; Animation::runAnimation skips non-scripted states entirely when mPlayScriptedOnly is set (animation.cpp:1342, set from character.cpp:1915/1952/2776); Animation::play also fires keys at the start point (animation.cpp:938-960); non-actors route through the  ...

**Corrected form offered:** Every key a playing state's playhead crosses is dispatched (Animation::runAnimation -> Animation::handleTextKey -> mTextKeyListener->handleTextKey, animation.cpp:1375/1388 and 870-878; Animation::play, animation.cpp:940-960, additionally fires keys at and below the start time), with groupname = the group that state is playing, so the listener sees keys of OTHER groups in the same text-key map too. CharacterController::handleTextKey (character.cpp:1007-1177) filters them, and the order of the checks is the rule: (0) if mAnimation is null it returns immediately and NOTHING below happens — not even the Lua dispatch; (1) otherwise the whole key is forwarded to Lua via LuaManager::animationTextKey; (2) if it starts with the 7 bytes "sound: ", the remainder is a sound ID played at volume 1.0 / pitch 1.0, then RETURNS — no group check; (3) if it starts with the 10 bytes "soundgen: ", the remainder is `<sndgen name> [volume] [pitch]`, whitespace-split (Misc::StringUtils::split, default delimiter " ") only when it contains a space, volume and pitch parsed as floats defaulting to 1.0; the name is resolved through charClass.getSoundIdFromSndGen and plays only if that returns a non-empty RefId


## 48. play() evicts every equal-priority animation, and re-playing a live group does NOT restart it
- `apps/openmw/mwrender/animation.cpp:881-968` - Animation playback, importance **n/a**

Animation::play does four things in a fixed order. (1) An empty groupname is a no-op that only calls resetActiveGroups() and returns. (2) If a state for this group already exists, its mPriority is OVERWRITTEN with the new priority - and nothing else is. (3) It then erases every OTHER state whose priority vector is exactly equal (all four slots) to the new one, calling animationEnded on each; this is the eviction rule - same priority means mutually exclusive, regardless of blend mask. (4) If the group already existed, it calls resetActiveGroups() and RETURNS EARLY: the animation is not restarted, its time is not reset, and speedmult, blendMask, loops, autodisable, start and stop key are all silently IGNORED on that call. Only when the group was not already playing does it build a new AnimState, searching mAnimSources IN REVERSE - `/* Look in reverse; last-inserted source has priority. */` - and taking the FIRST source for which reset() finds usable start/stop keys. If no source has them, no state is created and nothing plays (no error, no fallback). Note the state is inserted into mStates BEFORE the initial text keys are handled, and the immediately-following block can consume one loop iteration at time zero when startPoint already lands at or past the loop-stop key.

```cpp
    void Animation::play(std::string_view groupname, const AnimPriority& priority, int blendMask, bool autodisable,
        float speedmult, std::string_view start, std::string_view stop, float startpoint, uint32_t loops,
        bool loopfallback)
    {
        if (!mObjectRoot || mAnimSources.empty())
            return;

        if (groupname.empty())
        {
            resetActiveGroups();
            return;
        }

        AnimStateMap::iterator foundstateiter = mStates.find(groupname);
        if (foundstateiter != mStates.end())
        {
            foundstateiter->second.mPriority = priority;
        }

        AnimStateMap::iterator stateiter = mStates.begin();
        while (stateiter != mStates.end())
        {
            if (stateiter->second.mPriority == priority && stateiter->first != groupname)
            {
                animationEnded(stateiter->second);
                stateiter = mStates.erase(stateiter);
            }
            else
                ++stateiter;
        }

        if (foundstateiter != mStates.end())
        {
            resetActiveGroups();
            return;
        }

        /* Look in reverse; last-inserted source has priority. */
        AnimState state;
        AnimSourceList::reverse_iterator iter(mAnimSources.rbegin());
        for (; iter != mAnimSources.rend(); ++iter)
        {
            const SceneUtil::TextKeyMap& textkeys = (*iter)->getTextKeys();
            if (reset(state, textkeys, groupname, start, stop, startpoint, loopfallback))
            {
                state.mSource = *iter;
                state.mSpeedMult = speedmult;
                state.mLoopCount = loops;
                state.mPlaying = (state.getTime() < state.mStopTime);
                state.mPriority = priority;
                s
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out, but it omits a guard and overreaches on its closing note. (a) OMITTED GUARD / CONDITIONAL STATED AS ALWAYS-TRUE. The rule says play "does four things in a fixed order" and makes the empty-groupname branch step (1). The function's actual first statement, one line above the quoted excerpt's step (1), is `if (!mObjectRoot || mAnimSources.empty()) return;`. So "an empty groupname is a no-op that only calls resetActiveGroups() and returns" is not always true: with a null mObjectRoot or an empty mAnimSources, play() returns immediately and resetActiveGroups() is NEVER called. That is a real behavioral difference, not a nitpick - resetActiveGroups() (animation.cpp:1110) removes every active controller from the scene graph via removeUpdateCallback, clears mActiveControllers, nulls mAccumCtrl, and recomputes the winning state per blend mask. The same unmentioned guard also gates steps (2), (3) and (4): the priority overwrite and the equal-priority eviction sweep do not run at all when mAnimSources is empty. (b) THE CLOSING NOTE OVERREACHES. `mStates[std::string{ groupname }] = state;` stores a COPY; `state` remains the local temporary and is never rebound to the map entry. AnimState (animation.hpp:150-178) holds `std::shared_ptr<float> mTime`, so setTime()/getTime() alias between copy and stored entry - but mLoopCount, mPlaying, mLoopStartTime and mLoopStopTime are plain members. Therefore `state.mLoopCount--` and `state.mPlaying = true` in the loop-fixup block, and the mLoopStartTime/mLoopStopTime writes that handleTextKey(AnimState&, ...) (animation.cpp:856) performs on the initial text keys, all land on a temporary that is discarded when play() returns. The stored state does NOT "consume one loop iteration": its time is rewound to mLoopStartTime (via the shared pointer) while its loop counter stays at the full value. The rule's own emphasis that the state is inserted BEFORE the text keys are handled implies those key effects reach the stored state; they do not. Verified as correct: the 4-slot priority comparison (sNumBlendMasks == 4 in blendmask.hpp; AnimPriority::operator== loops all four and never consults mBlendMask), the priority-only overwrite, the `stateiter->first != groupname` self-exclusion, the early return that silently ignores speedmult/blendMask/loops/autodisable/start/stop, the reverse first-match source search, and the silent no-op when no source yields usable keys.

**Corrected form offered:** The quoted range is 881-969 rather than 881-968; line 968 is the closing 'resetActiveGroups();' call and line 969 is the function's closing brace, which the quote includes. The code itself is verbatim correct.


## 49. Looping: mLoopStopTime is +infinity unless loopFallback, and each loop is one decrement plus a jump to mLoopStartTime
- `apps/openmw/mwrender/animation.cpp:1379-1395` - Animation playback, importance **n/a**

loops is a count of ADDITIONAL passes, consumed one at a time, and the loop window is [mLoopStartTime, mLoopStopTime], which is NOT the same as [mStartTime, mStopTime]. reset() initialises mLoopStartTime = start-key time in both branches, but mLoopStopTime = stop-key time ONLY when loopFallback is true; otherwise it is std::numeric_limits<float>::max(). Since shouldLoop() is `getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0` (animation.hpp:177), an animation whose text keys carry no "<group>: loop stop" NEVER loops unless the caller passed loopFallback - it just runs start->stop once and stops. When a real "<group>: loop start"/"loop stop" key is crossed during playback, handleTextKey (animation.cpp:856-868) overwrites mLoopStartTime/mLoopStopTime live, which is how the loop window narrows to the authored sub-range after the first pass. Honouring a loop is: decrement mLoopCount, setTime(mLoopStartTime), force mPlaying = true, re-fire every text key at or before the new time, and break out of the inner loop if the playhead is STILL >= mLoopStopTime (the guard against a zero-length or inverted loop window spinning forever). mLoopCount is uint32_t and 'loop forever' is expressed as std::numeric_limits<uint32_t>::max() by callers. mLoopingEnabled is a separate live switch set by Animation::setLoopingEnabled (animation.cpp:1452-1457), used to let a running looped animation finish its current pass and stop.

```cpp
                if (state.shouldLoop())
                {
                    state.mLoopCount--;
                    state.setTime(state.mLoopStartTime);
                    state.mPlaying = true;

                    textkey = textkeys.lowerBound(state.getTime());
                    while (textkey != textkeys.end() && textkey->first <= state.getTime())
                    {
                        handleTextKey(state, stateiter->first, textkey, textkeys);
                        ++textkey;
                    }

                    if (state.getTime() >= state.mLoopStopTime)
                        break;
                }

// apps/openmw/mwrender/animation.hpp:177
            bool shouldLoop() const { return getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0; }

// apps/openmw/mwrender/animation.cpp:1008-1020 (reset)
        state.mStartTime = startkey->first;
        if (loopfallback)
        {
            state.mLoopStartTime = startkey->first;
            state.mLoopStopTime = stopkey->first;
        }
        else
        {
            state.mLoopStartTime = startkey->first;
            state.mLoopStopTime = std::numeric_limits<float>::max();
        }
        state.mStopTime = stopkey->first;

// apps/openmw/mwrender/animation.cpp:856-868 (handleTextKey - the live loop-window update)
        if (evt.starts_with(groupname) && evt.substr(groupname.size()).starts_with(": "))
        {
            size_t off = groupname.size() + 2;
            if (evt.substr(off) == "loop start")
                state.mLoopStartTime = key->first;
            else if (evt.substr(off) == "loop stop")
                state.mLoopStopTime = key->first;
        }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule states as unconditional something that reset() itself conditionally overwrites. It quotes reset() as ending at animation.cpp:1020 and asserts "mLoopStopTime = stop-key time ONLY when loopFallback is true; otherwise it is std::numeric_limits<float>::max()". Those are only the INITIAL values. reset() continues to line 1038 with a third stage the rule omits entirely — a reverse scan over the group's text keys that assigns state.mLoopStartTime / state.mLoopStopTime from real ": loop start" / ": loop stop" keys whose time is <= the startpoint-adjusted playhead. The source's own comment names the carve-out: "mLoopStartTime and mLoopStopTime normally get assigned when encountering these keys while playing the animation (see handleTextKey). But if startpoint is already past these keys, or start time is == stop time, we need to assign them now." So with loopfallback == false, a real ": loop stop" key, and a startpoint at or past it, reset() returns with mLoopStopTime equal to that key's time, not FLT_MAX. This is reachable, not hypothetical: CharacterController::playAnimQueue (character.cpp:1955-1961) passes mAnimQueue.front().mTime — a saved resume fraction restored by unpersistAnimationState (character.cpp:2594-2600) and written at 1938 — as the startpoint. Two consequences follow that the rule also gets wrong. First, its causal claim that handleTextKey "is how the loop window narrows to the authored sub-range after the first pass" is incomplete: reset() can narrow the window before any frame runs. Second, the rule presents animation.cpp:1379-1395 as the single site that honours a loop; Animation::play carries a second, near-duplicate block at animation.cpp:946-958 that fires at play() time before runAnimation ever touches the state, and its ordering differs — it checks "if (state.getTime() >= state.mLoopStopTime) break;" BEFORE re-firing the text keys, whereas the quoted runAnimation block re-fires the text keys first and then breaks. Everything else verifies: shouldLoop() at animation.hpp:177, the 1379-1395 block, handleTextKey at 856-868, setLoopingEnabled at 1452-1457, mLoopCount as uint32_t with std::numeric_limits<uint32_t>::max() used by callers for "forever" (character.cpp:491, 529, 758, 786, 1211, 1344, 2588), loops as additional passes, and the loop window being distinct from [mStartTime, mStopTime]. The headline conclusion — no ": loop stop" key means the animation never loops without loopFallback — does survive, since the override requires such a key to exist; but the mechanism as stated is presented as always-true when it is conditional.

**Corrected form offered:** loops is a count of ADDITIONAL passes, consumed one at a time, and the loop window is [mLoopStartTime, mLoopStopTime], which is NOT the same as [mStartTime, mStopTime]. reset() (animation.cpp:1008-1038) sets these in two stages. First it INITIALISES mLoopStartTime = start-key time in both branches, with mLoopStopTime = stop-key time when loopFallback is true and std::numeric_limits<float>::max() otherwise. Then, after seeking the playhead to mStartTime + (mStopTime - mStartTime) * startpoint, it re-scans the group's text keys and OVERWRITES mLoopStartTime / mLoopStopTime from any real "<group>: loop start" / "<group>: loop stop" key at or before that playhead — the code comment explains this covers the case where startpoint is already past those keys, or start time == stop time. So the FLT_MAX value is the non-fallback DEFAULT, not a guarantee: a resumed animation (CharacterController::playAnimQueue passes a saved resume fraction as startpoint) can come out of reset() with a real loop-stop time even when loopFallback is false. Since shouldLoop() is `getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0` (animation.hpp:177), an animation whose text keys carry NO "<group>: 


## 50. Time advances in text-key-sized steps, and only the lower-body winner produces movement
- `apps/openmw/mwrender/animation.cpp:1341-1408` - Animation playback, importance **n/a**

Animation::runAnimation(duration) advances every AnimState independently. Per state: timepassed = duration * mSpeedMult, then an inner loop repeatedly steps the playhead to min(target, next text key time) clamped to mStopTime - the animation never jumps OVER a text key, it lands exactly on it, fires it, and continues with the remaining time. mPlaying becomes false as soon as time reaches mStopTime; timepassed is reduced by the distance actually travelled; the loop exits when timepassed <= 0. Text keys at or before the new playhead are fired in order via handleTextKey, which also forwards them to the TextKeyListener (the CharacterController). Root-motion accumulation is applied ONLY when `state.mTime == mAnimationTimePtr[0]->getTimePtr()`, i.e. only for the state that currently wins BoneGroup_LowerBody - so an upper-body-only animation can never move the actor. When the state finishes and mAutoDisable is set, the state is erased and resetActiveGroups() is called immediately (re-resolving all four bone groups mid-frame). If mPlayScriptedOnly is set, any state whose priority vector does not contain Priority_Scripted is skipped entirely - it is frozen, not stopped.

```cpp
            if (mPlayScriptedOnly && !state.mPriority.contains(MWMechanics::Priority_Scripted))
            {
                ++stateiter;
                continue;
            }

            const SceneUtil::TextKeyMap& textkeys = state.mSource->getTextKeys();
            auto textkey = textkeys.upperBound(state.getTime());

            float timepassed = duration * state.mSpeedMult;
            while (state.mPlaying)
            {
                if (!state.shouldLoop())
                {
                    float targetTime = state.getTime() + timepassed;
                    if (textkey == textkeys.end() || textkey->first > targetTime)
                    {
                        if (mAccumCtrl && state.mTime == mAnimationTimePtr[0]->getTimePtr())
                            updatePosition(state.getTime(), targetTime, movement);
                        state.setTime(std::min(targetTime, state.mStopTime));
                    }
                    else
                    {
                        if (mAccumCtrl && state.mTime == mAnimationTimePtr[0]->getTimePtr())
                            updatePosition(state.getTime(), textkey->first, movement);
                        state.setTime(textkey->first);
                    }

                    state.mPlaying = (state.getTime() < state.mStopTime);
                    timepassed = targetTime - state.getTime();

                    while (textkey != textkeys.end() && textkey->first <= state.getTime())
                    {
                        handleTextKey(state, stateiter->first, textkey, textkeys);
                        ++textkey;
                    }
                }
                ...
                if (timepassed <= 0.0f)
                    break;
            }

            if (!state.mPlaying && stat
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule describes only the non-looping half of the inner loop and states its behaviour as unconditional, while the elided "..." is precisely the branch that reverses it. Correct in the rule (verified): timepassed = duration * mSpeedMult; timepassed = targetTime - getTime() reduces it by distance travelled; text keys at or before the new playhead fire in order via handleTextKey, which forwards to mTextKeyListener (guarded by a null check); the root-motion claim checks out - mAnimationTimePtr is indexed by blend mask, sNumBlendMasks == 4, BlendMask_LowerBody == 1<<0 so index 0, resetActiveGroups() assigns mAnimationTimePtr[blendMask] the mTime of the highest-priority state whose blendMaskContains(blendMask), and mAccumCtrl is only ever set under "if (blendMask == 0 && node == mAccumRoot)", so an upper-body-only state can never satisfy the guard; mAutoDisable -> animationEnded + erase + immediate resetActiveGroups() over all four masks; mPlayScriptedOnly does "++stateiter; continue;" so the state is frozen, not stopped, and AnimPriority::contains is an exact-equality scan over the four bone-group priorities. Refuting problems: 1. Conditional stated as always-true. "state.mPlaying = (state.getTime() < state.mStopTime);" sits inside "if (!state.shouldLoop())". The elided block is a SECOND, non-else "if (state.shouldLoop())" that runs in the same iteration and executes "state.mLoopCount--; state.setTime(state.mLoopStartTime); state.mPlaying = true;". So mPlaying does not become false as soon as time reaches mStopTime - for a looping state it is re-armed to true within the same iteration and the playhead is rewound. 2. The dominant path is missing. shouldLoop() is "getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0" and mLoopingEnabled defaults to true (animation.hpp:162). Animation::reset() sets mLoopStopTime from the group's "loop stop" key, which is below mStopTime, so ordinary actor animations (idle/walk/run, played with loop counts) turn around at mLoopStopTime and never reach mStopTime until loops are exhausted. 3. Omitted guard / wrong clamp. "clamped to mStopTime" only describes the no-key branch (std::min(targetTime, state.mStopTime)); the text-key branch is a bare state.setTime(textkey->first) with no clamp. And "the loop exits when timepassed <= 0" omits the "while (state.mPlaying)" condition and the load-bearing "if (state.getTime() >= state.mLoopStopTime) break;" inside the loop branch - the only thing preventing an infinite spin on a degenerate loop where mLoopStartTime >= mLoopStopTime, since timepassed never decreases there. 4. "ad ...

**Corrected form offered:** Minor precision note only, not a refutation: the quoted text begins at line 1342 rather than 1341 (line 1341 is `AnimState& state = stateiter->second;`), so the exact span is lines 1342-1408 of apps/openmw/mwrender/animation.cpp on OpenMW master.


## 51. Text keys are lowercased, trimmed and newline-split at load; the loopFallback flag comes from a hardcoded looping-group set
- `apps/openmw/mwrender/animation.cpp:792-825` - Animation playback, importance **n/a**

Two data facts a port must reproduce before any of the key matching above works. (1) NIF text keys are not stored as authored: extractTextKeys splits each NiTextKeyExtraData entry on \r and \n - so ONE key entry at one time can yield SEVERAL keys - trims each fragment, lowercases it in place, drops empties, and emplaces it into a std::multimap<float, std::string> ordered by time (components/sceneutil/textkeymap.hpp:61). Every comparison in animation.cpp is therefore an exact lowercase compare, and duplicate times are legal. (2) Whether an animation is allowed to loop without loop keys is decided by Animation::isLoopingAnimation, which returns true immediately if `"<group>: loop start"` exists, and otherwise strips the LONGEST matching weapon short group suffix (so "crossbow" is preferred over "bow") and tests membership in a hardcoded set of vanilla looping group names: walkforward/back/left/right, the swimwalk and run and swimrun and sneak variants, turnleft/turnright, swimturnleft/right, spellturnleft/right, torch, idle and idle2..idle9, idlesneak, idlestorm, idleswim, jump, inventoryhandtohand, inventoryweapononehand, inventoryweapontwohand, inventoryweapontwowide. This set - not a heuristic - is what makes e.g. "idle1h" loop while an arbitrary group does not.

```cpp
    bool Animation::isLoopingAnimation(std::string_view group) const
    {
        // In Morrowind, a some animation groups are always considered looping, regardless
        // of loop start/stop keys.
        // To be match vanilla behavior we probably only need to check this list, but we don't
        // want to prevent modded animations with custom group names from looping either.
        static const std::unordered_set<std::string_view> loopingAnimations = { "walkforward", "walkback", "walkleft",
            "walkright", "swimwalkforward", "swimwalkback", "swimwalkleft", "swimwalkright", "runforward", "runback",
            "runleft", "runright", "swimrunforward", "swimrunback", "swimrunleft", "swimrunright", "sneakforward",
            "sneakback", "sneakleft", "sneakright", "turnleft", "turnright", "swimturnleft", "swimturnright",
            "spellturnleft", "spellturnright", "torch", "idle", "idle2", "idle3", "idle4", "idle5", "idle6", "idle7",
            "idle8", "idle9", "idlesneak", "idlestorm", "idleswim", "jump", "inventoryhandtohand",
            "inventoryweapononehand", "inventoryweapontwohand", "inventoryweapontwowide" };
        static const std::vector<std::string_view> shortGroups = MWMechanics::getAllWeaponTypeShortGroups();

        if (getTextKeyTime(std::string(group) + ": loop start") >= 0)
            return true;

        // Most looping animations have variants for each weapon type shortgroup.
        // Just remove the shortgroup instead of enumerating all of the possible animation groupnames.
        // Make sure we pick the longest shortgroup so e.g. "bow" doesn't get picked over "crossbow"
        // when the shortgroup is crossbow.
        std::size_t suffixLength = 0;
        for (std::string_view suffix : shortGroups)
        {
      
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The two halves of the rule are individually accurate, but the bridging generalisation is false and it is the load-bearing one for a port. "Every comparison in animation.cpp is therefore an exact lowercase compare" is contradicted by the file, which is deliberately prefix-based: (a) getTextKeyTime (animation.cpp:840-853) — the function isLoopingAnimation itself calls at line 807 — matches with `iterKey->second.starts_with(textKey)`, a PREFIX test, and then guards on the returned time being `>= 0` (sentinel `-1.f`), so it is not an existence-of-exact-key check as the rule states; (b) reset() (animation.cpp:979) finds the group with `starts_with(groupname) && compare(groupname.size(), 2, ": ") == 0`; (c) reset() (animation.cpp:995-1001) explicitly TRUNCATES the key to `checkLength` before comparing, with the in-source comment "We have to ignore extra garbage at the end. The Scrib's idle3 animation has 'Idle3: Stop.' instead of 'Idle3: Stop'" — an exact compare makes reset() return false and that animation never plays; (d) animation.cpp:986 contains an omitted fallback, retrying "<group>: start" when "<group>: loop start" is absent; (e) animation.cpp:726, 1293 and 1314 use Misc::StringUtils::ciEqual, i.e. case-INSENSITIVE compares. The rule also omits two details that matter for a port: reset() scans the map in REVERSE (rbegin/rend) on purpose because undeadwolf_2.nif has two walkforward keys and the last must win (this, not merely "duplicate times are legal", is the real consequence of the multimap); and TextKeyMap::emplace additionally populates an mGroups set from the substring before ": " (used by hasGroupStart), which the rule describes as a plain multimap insert. Verified against upstream OpenMW master: apps/openmw/mwrender/animation.cpp, components/nifosg/nifloader.cpp, components/sceneutil/textkeymap.hpp, components/misc/strings/algorithm.hpp, apps/openmw/mwmechanics/weapontype.cpp.

> Fact (1) is confirmed verbatim. extractTextKeys (components/nifosg/nifloader.cpp:213-227) splits each NiTextKeyExtraData entry with Misc::StringUtils::split(key.mText, results, "\r\n"), and split uses find_first_of (components/misc/strings/algorithm.hpp:174-184), i.e. a delimiter CHARACTER SET, so one entry at one time does yield several keys; each is trimmed, lowerCaseInPlace'd, dropped if empty, and emplaced into the std::multimap<float,std::string> of SceneUtil::TextKeyMap (components/sceneutil/textkeymap.hpp:61), so duplicate times are legal. The only nuance is that this is not the sole population path: components/resource/keyframemanager.cpp:172 fills the same map from a sidecar .txt for osgAnimation/Collada animations, and its parseTextKey (keyframemanager.cpp:28-34) neither splits, trims, nor lowercases. That path never applies to vanilla NIF first-person data, so it does not affect a first-person player body. Fact (2) is where the rule breaks. The DESCRIPTION of Animation::isLoopingAnimation is accurate — apps/openmw/mwrender/animation.cpp:792-825 matches word for word: early return when getTextKeyTime(group + ": loop start") >= 0, longest-matching weapon shortGroup suffix stripped (the explicit "crossbow" over "bow" comment), then membership in exactly the hardcoded unordered_set listed. It is non-virtual (animation.hpp:373), so no subclass (ActorAnimation, NpcAnimation, CreatureAnimation, ESM4NpcAnimation, ObjectAnimation) overrides it, and neither is getTextKeyTime (animation.hpp:431). But the CAUSAL claim — "Whether an animation is allowed to loop without loop keys is decided by Animation::isLoopingAnimation" — is false, and false precisely for the first-person player body. That decision is made by the loopfallback argument of Animation::play, consumed in Animation::reset (animation.cpp:1009-1019): loopfallback true sets state.mLoopStopTime to the stop key (so the group loops with no loop keys), false sets it to numeric_limits<float>::max() (so it never loops). isLoopingAnimation is only ONE of several producers of that argument, and it is consulted exclusively on the scripted/queued path: character.cpp:2589 (unpersistAnimationState), character.cpp:2631 (playGroup, the MWScript PlayGroup/LoopGroup entry), character.cpp:2708 (playGroupLua), plus the Lua bindings at mwlua/animationbindings.cpp:154 and :230. The paths that actually animate the player's first-person body bypass it entirely and hardcode loopfallback: - character.cpp:757-758, refreshMovementAnims: playBlendedAnimation(mCurrentMovement, ..., "start", "stop", startpoint, UINT32_MAX,  ...

**Corrected form offered:** Two data facts a port must reproduce before any of the key matching above works. (1) NIF text keys are not stored as authored: extractTextKeys splits each NiTextKeyExtraData entry on ANY '\r' or '\n' character (Misc::StringUtils::split uses find_first_of over the delimiter set) — so ONE key entry at one time can yield SEVERAL keys — trims each fragment, lowercases it in place, drops empties, and emplaces it into SceneUtil::TextKeyMap, which holds a std::multimap<float, std::string> ordered by time AND also records the substring before ": " in an mGroups set used by hasGroupStart. Because every stored key is already lowercased, animation.cpp never needs case folding for text keys — but its comparisons are PREFIX matches, not exact ones: getTextKeyTime uses starts_with (animation.cpp:848), reset() locates a group with starts_with + a ": " separator check (:979), and matches the stop key against only the first groupname.size()+2+stop.size() characters so trailing garbage is tolerated (:1001 — the Scrib's "idle3: stop." would otherwise fail to resolve). reset() also falls back from "<group>: loop start" to "<group>: start" (:986) and scans the map in REVERSE, because undeadwolf_2.nif h


## 52. First person gets its own render bin (12) whose draw callback CLEARS the depth buffer first
- `apps/openmw/mwrender/npcanimation.cpp:319-368, 418-433` - First-person specifics, importance **n/a**

In first person the object root's StateSet is given setRenderBinDetails(RenderBin_FirstPerson, "DepthClear", osg::StateSet::OVERRIDE_RENDERBIN_DETAILS); leaving first person calls setRenderBinToInherit() on that same stateset. RenderBin_FirstPerson = 12 (apps/openmw/mwrender/renderbin.hpp:15), i.e. AFTER RenderBin_Default=0, RenderBin_OpaqueResolve=9, RenderBin_DepthSorted=10 (transparent) and RenderBin_OcclusionQuery=11, and BEFORE RenderBin_SunGlare=13 - so the whole world is drawn first, then the depth buffer is cleared, then the hands are drawn: the hands can never be occluded by, or z-fight with, world geometry no matter how close a wall is. The "DepthClear" bin prototype is registered once, globally, and its DrawCallback does two passes: bind the FBO_FirstPerson framebuffer, glClear(GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT), draw the bin (colour pass); then rebind the primary FBO / the FBO_OpaqueDepth attachment, swap in a stateset with ColorMask(false,false,false,false) and draw the bin AGAIN (depth-only accumulation pass) so post-processing still sees a complete depth buffer. Depth writes are forced on for the pass via SceneUtil::AutoDepth with setWriteMask(true). setRenderBin() is re-run on every setViewMode (npcanimation.cpp:309).

```cpp
// npcanimation.cpp:319-333
    /// @brief A RenderBin callback to clear the depth buffer before rendering.
    /// Switches depth attachments to a proxy renderbuffer, reattaches original depth then redraws first person root.
    /// This gives a complete depth buffer which can be used for postprocessing, buffer resolves as if depth was never
    /// cleared.
    class DepthClearCallback : public osgUtil::RenderBin::DrawCallback
    {
    public:
        DepthClearCallback()
        {
            mDepth = new SceneUtil::AutoDepth;
            mDepth->setWriteMask(true);

            mStateSet = new osg::StateSet;
            mStateSet->setAttributeAndModes(new osg::ColorMask(false, false, false, false), osg::StateAttribute::ON);
        }

// npcanimation.cpp:344-361
            postProcessor->getFbo(PostProcessor::FBO_FirstPerson, frameId)->apply(*state);
            glClear(GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);
            // color accumulation pass
            bin->drawImplementation(renderInfo, previous);

            auto primaryFBO = postProcessor->getPrimaryFbo(frameId);
            primaryFBO->apply(*state);

            postProcessor->getFbo(PostProcessor::FBO_OpaqueDepth, frameId)->apply(*state);

            // depth accumulation pass
            osg::ref_ptr<osg::StateSet> restore = bin->getStateSet();
            bin->setStateSet(mStateSet);
            bin->drawImplementation(renderInfo, previous);
            bin->setStateSet(restore);

// npcanimation.cpp:418-433
    void NpcAnimation::setRenderBin()
    {
        if (mViewMode == VM_FirstPerson)
        {
            [[maybe_unused]] static const bool prototypeAdded = [&] {
                osg::ref_ptr<osgUtil::RenderBin> depthClearBin(new osgUtil::RenderBin);
                depthClearBin->setD
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The mechanism description is accurate, but the rule states as unconditional something the code only guarantees conditionally, and it misreads the coverage of setRenderBin(). WHAT CHECKS OUT (verified against fetched master): - renderbin.hpp:9-18 confirms the ordering (Sky=-1, Default=0, OpaqueResolve=9, DepthSorted=10, OcclusionQuery=11, FirstPerson=12, SunGlare=13, and also Distortion=14, which the rule omits but which does not affect the argument). The header comment literally says "The bin with the lowest number is rendered first." - npcanimation.cpp:319-368 matches: static one-time addRenderBinPrototype("DepthClear"), AutoDepth with setWriteMask(true) applied via state->applyAttribute, FBO_FirstPerson + glClear(DEPTH|STENCIL) + colour pass, then primaryFbo->apply / FBO_OpaqueDepth->apply, bin stateset swapped for the ColorMask(false,false,false,false) one, second draw, stateset restored, primary FBO reapplied. There is no null-check on postProcessor and no settings guard. WHERE IT OVERREACHES: 1. "setRenderBin() is re-run on every setViewMode" — grep for setRenderBin over the whole file yields exactly two hits: the definition at :418 and the single call site at :309. It is NOT called from the constructor (:267-293, which calls only updateNpcBase()), and setViewMode itself early-returns before reaching :309: if (mViewMode == viewMode) return; // npcanimation.cpp:298-299 So setRenderBin() runs only on an actual view-mode *transition*, never on a same-mode re-entry. 2. That matters because rebuild() destroys and recreates the node the bin was set on. rebuild() -> updateNpcBase() -> setObjectRoot(smodel, true, true, false) (:525) installs a brand-new mObjectRoot with a fresh (empty) StateSet. Two reachable paths call rebuild() *without* any following setRenderBin(): - npcanimation.cpp:579-584 — updateParts(): `if (curType != mNpcType) { mNpcType = curType; rebuild(); return; }` - renderingmanager.cpp:1167-1183 — rebuildPtr(): `anim->rebuild(); ... mCamera->attachTo(ptr); mCamera->setAnimation(anim);` setAnimation only sets mProcessViewChange = true (camera.cpp:341-344); the deferred processViewChange() (camera.cpp:346-368) then calls mAnimation->setViewMode(VM_FirstPerson) — which hits the `mViewMode == viewMode` early return, so setRenderBin() is never reached. This is a live path: NpcAnimation::setVampire (:1139-1150) calls World::reattachPlayerCamera() for the player, and worldimp.cpp:2761-2763 is `mRendering->rebuildPtr(getPlayerPtr())`. So after such a rebuild while already in first person, the new object root carries no "DepthClear" bin details, th ...

**Corrected form offered:** No correction needed to the substance. Optional precision on the line ranges: the drawImplementation excerpt is npcanimation.cpp:346-360 (not 344-361), setRenderBin's quoted body is 418-432 with the closing brace at 433, and the RenderBins enumerators are renderbin.hpp:10-16 (not 9-17). All quoted code is verbatim correct.


## 53. Mask_FirstPerson (1<<9) REPLACES the root's mask, and excludes the hands from every secondary pass by omission
- `apps/openmw/mwrender/vismask.hpp:23-60` - First-person specifics, importance **n/a**

Mask_FirstPerson = (1 << 9). It is set exactly once in the whole engine - setNodeMask(Mask_FirstPerson) on the first-person NpcAnimation's object root (npcanimation.cpp:544) - and read nowhere by name; grep over apps+components at master finds only the enum and that one assignment. Exclusion is therefore by OMISSION from allow-lists, since OSG traverses only when (nodeMask & traversalMask) != 0 and setNodeMask REPLACES the root's previous mask (so the FP subtree carries bit 9 and nothing else): the MAIN camera's cull mask is ~(Mask_UpdateVisitor | Mask_SimpleWater) (renderingmanager.cpp:398-399), which contains bit 9, so the hands render in the main view; but every secondary pass builds an explicit allow-list that never contains it - water reflection/refraction Mask_Scene|Mask_Sky|Mask_Lighting plus a detail-driven extraMask of Terrain/Static/Effect/ParticleSystem/Object/Player/Actor/Groundcover (mwrender/water.cpp:302-319), the local map Mask_Scene|Mask_SimpleWater|Mask_Terrain|Mask_Object|Mask_Static (localmap.cpp:721-723), precipitation occlusion Mask_Scene|Mask_Object|Mask_Static (precipitationocclusion.cpp:113), the sky RTT Mask_Sky (sky.cpp:224), and the shadow-casting masks Mask_Scene (+Actor/Player/Object/Static/Terrain per setting) (renderingmanager.cpp:134-152). So: the first-person body casts NO shadow, appears in NO water reflection or refraction, and on NO map, at any detail setting. Note it is NOT removed from the intersection/ray-cast mask, which is ~0u minus RenderToTexture|Sky|Debug|Effect|Water|SimpleWater|Groundcover (renderingmanager.cpp:1040-1048) - the FP subtree is gated there only by its parent "Player Root" node's Mask_Player, which is cleared when ignorePlayer is set.

```cpp
// apps/openmw/mwrender/vismask.hpp:28-40
        Mask_Effect = (1 << 1),
        Mask_Debug = (1 << 2),
        Mask_Actor = (1 << 3),
        Mask_Player = (1 << 4),
        Mask_Sky = (1 << 5),
        Mask_Water = (1 << 6), // choose Water or SimpleWater depending on detail required
        Mask_SimpleWater = (1 << 7),
        Mask_Terrain = (1 << 8),
        Mask_FirstPerson = (1 << 9),
        Mask_Object = (1 << 10),
        Mask_Static = (1 << 11),

// apps/openmw/mwrender/renderingmanager.cpp:398-399
        auto mask = ~(Mask_UpdateVisitor | Mask_SimpleWater);
        MWBase::Environment::get().getWindowManager()->setCullMask(mask);

// apps/openmw/mwrender/water.cpp:303-318 (reflection/refraction cull mask)
        unsigned int calcNodeMask()
        {
            int reflectionDetail = Settings::water().mReflectionDetail;
            reflectionDetail = std::clamp(reflectionDetail, mInterior ? 2 : 0, 5);
            unsigned int extraMask = 0;
            if (reflectionDetail >= 1)
                extraMask |= Mask_Terrain;
            if (reflectionDetail >= 2)
                extraMask |= Mask_Static;
            if (reflectionDetail >= 3)
                extraMask |= Mask_Effect | Mask_ParticleSystem | Mask_Object;
            if (reflectionDetail >= 4)
                extraMask |= Mask_Player | Mask_Actor;
            if (reflectionDetail >= 5)
                extraMask |= Mask_Groundcover;
            return Mask_Scene | Mask_Sky | Mask_Lighting | extraMask;
        }

// apps/openmw/mwrender/localmap.cpp:721
        camera->setCullMask(Mask_Scene | Mask_SimpleWater | Mask_Terrain | Mask_Object | Mask_Static);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Nearly all of the rule verifies against master (a042cd3), but it overreaches on one limb: it cites apps/openmw/mwrender/water.cpp:303-320 as the "reflection/refraction cull mask" and folds refraction into the by-omission-from-allow-lists mechanism. That calcNodeMask() is a private member of `class Reflection : public SceneUtil::RTTNode` (water.cpp:238) and feeds only camera->setCullMask(mNodeMask) at water.cpp:273. There is no refraction RTT camera and no refraction cull mask anywhere in the engine — the only occurrence of "refraction" in water.cpp is the shader define at line 594. Refraction is screen-space: files/shaders/compatibility/water.frag:205 does `refraction = sampleOpaqueColorTex(refractionCoords).rgb`, sampling the opaque color texture resolved at RenderBin_OpaqueResolve = 9 (postprocessor.cpp:165), while the first-person body draws at RenderBin_FirstPerson = 12 (renderbin.hpp:15, set in NpcAnimation::setRenderBin, npcanimation.cpp:428-429) — after the opaque resolve and after the transparent bin where water draws. So the conclusion "not in refraction" is incidentally true, but by render-bin ordering and the opaque-resolve capture point, not by an allow-list omitting bit 9. This is operationally misleading: the rule implies adding Mask_FirstPerson to water.cpp:303-320 would put the hands into both reflection and refraction; it would only affect reflection, because refraction has no mask to add it to. Everything else checks out: vismask.hpp:35 defines the bit; grep over apps+components yields only the enum and npcanimation.cpp:544 (guarded by `if (is1stPerson)`); renderingmanager.cpp:398-399 routes through WindowManager::setCullMask to mViewer->getCamera()->setCullMask (windowmanagerimp.cpp:1462-1469) and ~(0x1|0x80) does contain bit 9; the local map (localmap.cpp:721-723), precipitation occlusion (precipitationocclusion.cpp:113), sky RTT (sky.cpp:224) and shadow-casting masks (renderingmanager.cpp:135-153, wired at 246-247) all omit bit 9; and the intersection mask (renderingmanager.cpp:1040-1048) does retain it, with the player's NpcAnimation parented to the Mask_Player "Player Root" (renderingmanager.cpp:1144-1153, 1161).

**Corrected form offered:** Citations hold; only two line ranges need tightening. vismask.hpp: the Mask_Effect–Mask_Static block is at lines 27-37, not 28-40. water.cpp: calcNodeMask() spans lines 305-321, not 303-318. renderingmanager.cpp:398-399 and localmap.cpp:721 are exactly right as cited.


## 54. In first person the CAMERA is a node of the rig: it tracks "Camera" (fallback "Head"), with no height offset
- `apps/openmw/mwrender/camera.cpp:87-99, 346-368` - First-person specifics, importance **n/a**

Camera::processViewChange, on entering first person, calls mAnimation->setViewMode(VM_FirstPerson) and then sets mTrackingNode = mAnimation->getNode("Camera"), falling back to getNode("Head") if there is no Camera node, and forces mHeightScale = 1.f. (getNode goes through the case-insensitive NodeMap.) In third person the tracking node is instead the Ptr's base transform and mHeightScale is that transform's Z scale. calculateTrackedPosition takes the world translation of the tracking node and adds mHeight * mHeightScale ONLY when the mode is not FirstPerson - so the first-person eye position is literally wherever the skeleton's Camera bone ended up this frame, animation and neck rotation included, with no camera-height constant. Because the animation is evaluated during cull, updateCamera RE-computes the position at cull time rather than reusing mPosition, explicitly to avoid a one-frame lag ("It is a hack. Camera position depends on neck animation."). Switching to or from first person is deferred while mAnimation->upperBodyReady() is false (setMode queues it) because the view change stops all playing animations, and it triggers instantTransition() + mProcessViewChange (camera.cpp:225-244).

```cpp
// camera.cpp:87-99
    osg::Vec3d Camera::calculateTrackedPosition() const
    {
        if (!mTrackingNode)
            return osg::Vec3d();
        osg::NodePathList nodepaths = mTrackingNode->getParentalNodePaths();
        if (nodepaths.empty())
            return osg::Vec3d();
        osg::Matrix worldMat = osg::computeLocalToWorld(nodepaths[0]);
        osg::Vec3d res = worldMat.getTrans();
        if (mMode != Mode::FirstPerson)
            res.z() += mHeight * mHeightScale;
        return res;
    }

// camera.cpp:346-360
    void Camera::processViewChange()
    {
        if (mTrackingPtr.isEmpty())
            return;
        if (mMode == Mode::FirstPerson)
        {
            mAnimation->setViewMode(NpcAnimation::VM_FirstPerson);
            mTrackingNode = mAnimation->getNode("Camera");
            if (!mTrackingNode)
                mTrackingNode = mAnimation->getNode("Head");
            mHeightScale = 1.f;
        }

// camera.cpp:117-126 (updateCamera)
        if (mMode == Mode::FirstPerson)
        {
            // It is a hack. Camera position depends on neck animation.
            // Animations are updated in OSG cull traversal and in order to avoid 1 frame delay we
            // recalculate the position here. Note that it becomes different from mPosition that
            // is used in other parts of the code.
            // TODO: detach camera from OSG animation and get rid of this hack.
            osg::Vec3d recalculatedTrackedPosition = calculateTrackedPosition();
            pos = calculateFirstPersonPosition(recalculatedTrackedPosition);
        }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out against upstream OpenMW apps/openmw/mwrender/camera.cpp: processViewChange's first-person branch (setViewMode(VM_FirstPerson), getNode("Camera") with a "Head" fallback, mHeightScale = 1.f) is verbatim; NodeMap really is case-insensitive (animation.hpp:125-127 uses Misc::StringUtils::CiHash/CiEqual); third person really does track the Ptr's base transform; and calculateTrackedPosition really does add mHeight * mHeightScale only when mMode != FirstPerson. But two claims overreach. (1) The deferral is stated as always-true and is in fact conditional on a flag that DEFAULTS THE OTHER WAY. setMode is `void setMode(Mode mode, bool force = true)` (camera.hpp:103), and the queuing branch is `if (!force && (newMode == FirstPerson || oldMode == FirstPerson) && mAnimation && !mAnimation->upperBodyReady())`. So a plain setMode(...) does NOT defer — it switches immediately regardless of upperBodyReady(); Camera::reset() (`setMode(Mode::FirstPerson)`) and the re-dispatch of the queued mode at camera.cpp:136 (`setMode(*mQueuedMode)`) both rely on that default to avoid re-queuing. Only explicit force==false callers defer: toggleViewMode(force), toggleVanityMode (passes false), and the Lua binding (camerabindings.cpp:37-38, which defaults force to false). The rule omits both the !force guard and the mAnimation null guard. It also omits the `if (mMode == newMode) { mQueuedMode = nullopt; return; }` early return. (2) "the first-person eye position is literally wherever the skeleton's Camera bone ended up this frame ... with no camera-height constant" treats calculateFirstPersonPosition as identity. The "no camera-height constant" half is correct (mHeight * mHeightScale is genuinely skipped), but both updatePosition (line 167) and updateCamera (line 125) route the tracked position through calculateFirstPersonPosition, which ADDS Camera::mFirstPersonOffset — x/y rotated by mYaw via Misc::rotateVec2f, z added directly (camera.cpp:149-157). It defaults to {0,0,0} but is publicly settable (camera.hpp:107) and exposed to Lua as camera.setFirstPersonOffset, so the eye position equals the bone position only when that offset happens to be zero. The rule's own excerpt shows the call yet the prose asserts identity. Secondary imprecision: "updateCamera RE-computes the position at cull time" — the callback is registered with mCamera->addUpdateCallback(mUpdateCallback) (camera.cpp:78), i.e. it is an update-traversal callback that traverses children first, not a cull callback. The source comment says animations are updated in cull; it does not say updateCamera ...

**Corrected form offered:** Camera::processViewChange, on entering first person, calls mAnimation->setViewMode(VM_FirstPerson), sets mTrackingNode = mAnimation->getNode("Camera") falling back to getNode("Head"), and forces mHeightScale = 1.f (getNode goes through the case-insensitive NodeMap — CiHash/CiEqual). In third person the tracking node is the Ptr's base transform, with mHeightScale = transform->getScale().z(), or 1.f if that transform is null. calculateTrackedPosition takes the world translation of the tracking node and adds mHeight * mHeightScale only when the mode is not FirstPerson, so no camera-height constant is applied in first person. The first-person eye position is not the bone position itself, though: both updatePosition and updateCamera pass the tracked position through calculateFirstPersonPosition, which adds Camera::mFirstPersonOffset (x/y rotated by mYaw, z added directly; default {0,0,0}, settable from Lua via camera.setFirstPersonOffset), so the eye equals the Camera bone only while that offset is zero. Because animations are evaluated during cull, updateCamera recomputes the tracked position rather than reusing mPosition, explicitly to avoid a one-frame lag ("It is a hack. Camera posi


## 55. NiTransform is TRS with the scale folded into the 3x3, and a chain composes self-first
- `components/nif/niftypes.hpp:68-93` - NIF nodes and transforms, importance **n/a**

Every NiAVObject carries one NiTransform. STREAM ORDER IS translation, then the 3x3 rotation, then the float scale (node.cpp:144-146) - NOT the struct's declaration order. Matrix3 is 9 floats blitted straight into mValues[3][3] in file order (nifstream.cpp:122-126), i.e. mValues[row][col], row-major as NIF stores it. The local transform is p_parent = (mRotation * mScale) * p_local + mTranslation: the float mScale multiplies the ENTIRE 3x3, the 3x3 may itself already contain non-uniform or negative scale (see the comment on the mRotation field), and the translation is NEVER scaled. Composition to world is self first then every ancestor in order, which in OSG's row-vector convention is `transform *= parent...` walking up the Parent chain (bulletnifloader.cpp:283-285). In a column-vector engine (three.js/gl-matrix) this is local = T(mTranslation) * (mRotation * mScale) and world = parentWorld * local - i.e. ordinary hierarchical composition, no surprises, but the scale must go into the rotation block, not a separate uniform scale node. A NiTriShape's own transform applies exactly like any other node's: the loader builds a node for the geometry record too and adds the drawable under it (nifloader.cpp:1757-1758). One optimisation to be aware of when you look for a node by name later: createNode emits a plain osg::Group with NO transform when a node has no parents AND no controller AND an identity transform (nifloader.cpp:696-699).

```cpp
components/nif/niftypes.hpp:68-93
    struct NiTransform
    {
        Matrix3 mRotation; // this can contain scale components too, including negative and nonuniform scales
        osg::Vec3f mTranslation;
        float mScale;

        osg::Matrixf toMatrix() const
        {
            osg::Matrixf transform;
            transform.setTrans(mTranslation);

            for (int i = 0; i < 3; ++i)
                for (int j = 0; j < 3; ++j)
                    transform(j, i) = mRotation.mValues[i][j] * mScale; // NB column/row major difference

            return transform;
        }

        bool isIdentity() const { return mRotation.isIdentity() && mTranslation == osg::Vec3f() && mScale == 1.f; }

        static const NiTransform& getIdentity()
        {
            static const NiTransform identity = { Matrix3(), osg::Vec3f(), 1.0f };
            return identity;
        }
    };

components/nif/node.cpp:144-146 (stream order)
        nif->read(mTransform.mTranslation);
        nif->read(mTransform.mRotation);
        nif->read(mTransform.mScale);

components/nifbullet/bulletnifloader.cpp:283-285 (composition, self-first)
        osg::Matrixf transform = niGeometry.mTransform.toMatrix();
        for (const Nif::Parent* parent = nodeParent; parent != nullptr; parent = parent->mParent)
            transform *= parent->mNiNode.mTransform.toMatrix();
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule verifies exactly against upstream OpenMW, but one clause is stated as unconditional when the code makes it conditional. CONFIRMED, line-for-line: - node.cpp:144-146 in NiAVObject::read is indeed nif->read(mTransform.mTranslation); mRotation; mScale — translation first, not declaration order. This is a genuine catch, and correctly scoped: the generic NIFStream::read<NiTransform> (nifstream.cpp:145-151) reads rotation FIRST (declaration order), used by records such as NiSkinData where the file layout really is rotation-first. The rule attributing the translation-first order specifically to node.cpp/NiAVObject is right. - nifstream.cpp:122-126 is readBufferOfType<9>(mStream, reinterpret_cast<float*>(&mat.mValues)) — a straight 9-float blit, as claimed. - toMatrix() writes transform(j,i) = mRotation.mValues[i][j] * mScale for all i,j in 0..2, so mScale does multiply the entire 3x3, and the loop never touches row 3, so setTrans(mTranslation) survives unscaled. The stated p_parent = (mRotation*mScale)*p_local + mTranslation is algebraically correct for OSG's row-vector convention, and the column-vector transcription (local = T * (R*S), world = parentWorld * local) follows correctly. - The mRotation comment about negative/nonuniform scale is present verbatim. - bulletnifloader.cpp:283-285 is self-first then `transform *= parent->mNiNode.mTransform.toMatrix()` up the mParent chain, exactly as described. - nifloader.cpp:696 is exactly `if (nifNode->mParents.empty() && nifNode->mController.empty() && nifNode->mTransform.isIdentity()) node = new osg::Group;` — the guard is reproduced accurately, including the three-way AND. REFUTED — "A NiTriShape's own transform applies exactly like any other node's" is true only for UNSKINNED geometry: handleNiGeometry (nifloader.cpp:1694) branches on `if (!niGeometry->mSkin.empty())`, replacing the plain osg::Geometry with a SceneUtil::RigGeometry that gets rig->setTransform(data->mTransform.toMatrix()) — the NiSkinData transform — plus per-bone mInvBindMatrix values. At render time RigGeometry::updateSkinToSkelMatrix (riggeometry.cpp:289-323) walks the node path from the skeleton root down to the trishape and calls trans->computeWorldToLocalMatrix() on every osg::Transform it finds, accumulating the INVERSE of that whole chain into mSkinToSkelMatrix. The source comment is explicit: "Failed to find skin root, cancel out everything up till the trishape. Our parent node is the trishape's transform." The vertex update (riggeometry.cpp:183-187) then uses transform = (*mSkinToSkelMatrix) * mData->mTransform over bone ...

> The decode half of the rule is verified exactly (node.cpp:144-146 stream order; nifstream.cpp:122-126 row-major Matrix3; niftypes.hpp:74-84 scale-times-whole-3x3 with unscaled translation; skeleton.cpp:168-171 composition order; nifloader.cpp:696-699 Group shortcut; nifloader.cpp:869-872 + 1757-1758 geometry gets its own node). What is refuted is the closing claim -- "world = parentWorld * local ... ordinary hierarchical composition, no surprises" and "a NiTriShape's own transform applies exactly like any other node's" -- for exactly the case the rule was asked to hold for. (1) THE LEFT ARM IS MIRRORED BY A TRANSFORM THAT IS IN NO NIF. Morrowind stores ONE body-part record per limb and maps it to both sides: sBodyPartMap in apps/openmw/mwrender/npcanimation.cpp:1189-1191 binds MP_Hand -> {PRT_RHand, PRT_LHand}, MP_Wrist -> {R,L}, MP_Forearm -> {R,L}, MP_Upperarm -> {R,L}. sPartList (npcanimation.cpp:249-252) attaches those to bones literally named "Left Hand"/"Left Wrist"/"Left Forearm"/"Left Upper Arm". components/sceneutil/attach.cpp:166-178 then does `if (attachNode->getName().find("Left") != std::string::npos)` -> inserts an extra osg::PositionAttitudeTransform with setScale(-1,1,1) plus a FrontFace CLOCKWISE StateSet to undo the winding flip. Those four parts ARE the first-person player body (getBodyParts(..., firstPerson=true) at npcanimation.cpp:681, ".1st" at 879). So for half the geometry a first-person player ever sees, world = parentWorld * MIRROR * local, and the mirror exists nowhere in the file. (2) TWO MORE ENGINE-INJECTED TRANSFORMS ON THE SAME PATH. attach.cpp:147-163: a node named "BoneOffset" has ONLY its translation honoured -- rotation and scale discarded -- lifted onto a PAT above the model, and the node is then deleted from the graph. actoranimation.cpp:97-102: a held light (the torch in the player's left hand) gets an extra -90 deg X rotation passed as `attitude`. (3) SKINNED GEOMETRY DOES NOT COMPOSE HIERARCHICALLY AT ALL. components/sceneutil/riggeometry.cpp:289-324 (updateSkinToSkelMatrix) walks the node path from the SceneUtil::Skeleton down to the skin root and calls computeWorldToLocalMatrix on every transform, i.e. it INVERTS THEM OUT -- the comment says "Failed to find skin root, cancel out everything up till the trishape. Our parent node is the trishape's transform". Vertices come from invBindMatrix * bone->mMatrixInSkeletonSpace (riggeometry.cpp:170-186) times NiSkinData::mTransform (nifloader.cpp:1715), not from the node chain. attach.cpp:35-56 (CopyRigVisitor) additionally discards the source file's node hierarchy abov ...

**Corrected form offered:** Every NiAVObject carries one NiTransform. STREAM ORDER for NiAVObject IS translation, then the 3x3 rotation, then the float scale (node.cpp:144-146) — NOT the struct's declaration order. (Beware: the generic NIFStream::read<NiTransform> at nifstream.cpp:145-151 reads rotation FIRST, and that is the one used by NiSkinData and friends, where the file layout genuinely is rotation-first.) Matrix3 is 9 floats blitted straight into mValues[3][3] in file order (nifstream.cpp:122-126), i.e. mValues[row][col]. The local transform is p_parent = (mRotation * mScale) * p_local + mTranslation: the float mScale multiplies the ENTIRE 3x3, the 3x3 may itself already contain non-uniform or negative scale, and the translation is NEVER scaled by mScale. Composition to world is self first then every ancestor in order, which in OSG's row-vector convention is `transform *= parent...` walking up the Parent chain (bulletnifloader.cpp:283-285). In a column-vector engine (three.js/gl-matrix) this is local = T(mTranslation) * (mRotation * mScale) and world = parentWorld * local, with the scale folded into the rotation block rather than a separate uniform scale node. Three exceptions where a node's own mTrans


## 56. The accum root is chosen from a two-name table AND must be driven by the KF
- `apps/openmw/mwrender/animation.cpp:712-734` - NIF nodes and transforms, importance **n/a**

Root motion comes from ONE node, picked by Animation::addAnimSource. The candidate names are exactly {"bip01", "root bone"}, tried in that order ("Priority matters! bip01 is preferred"). A candidate is accepted only if BOTH (a) the name resolves in the node map and (b) the loaded KF's controller map contains a keyframe controller under that same name (case-insensitive). Once chosen, mAccumRoot is sticky for the life of the Animation - later anim sources do not re-pick it. Two further facts: mAccumulate defaults to (1, 1, 0) (animation.cpp:548), so X and Y accumulate into world position and Z does NOT; and a ResetAccumRootCallback is installed on the accum root that, every frame, ZEROES exactly the accumulating components of that node's local translation (animation.cpp:515-539, wired at :1177-1189), so the mesh stays at the origin while the actor moves. The controller is only bound as mAccumCtrl when its blendMask == 0. REFINES RULE 16: the map used here is not the Skeleton bone cache - it is SceneUtil::NodeMap, an unordered_map with Misc::StringUtils::CiHash/CiEqual (visitor.hpp:53-55) populated by NodeMapVisitor with `mMap.emplace(trans.getName(), &trans)` over osg::MatrixTransform nodes ONLY (visitor.cpp:60-65). Same case-insensitive, first-in-depth-first-order-wins semantics as rule 16 - but a node the loader emitted as a plain osg::Group (see the transform rule) is absent from this map entirely and can never be the accum root.

```cpp
        // Determine the movement accumulation bone if necessary
        if (!mAccumRoot)
        {
            // Priority matters! bip01 is preferred.
            static const std::initializer_list<std::string_view> accumRootNames = { "bip01", "root bone" };
            NodeMap::const_iterator found = nodeMap.end();
            for (const std::string_view& name : accumRootNames)
            {
                found = nodeMap.find(name);
                if (found == nodeMap.end())
                    continue;
                for (SceneUtil::KeyframeHolder::KeyframeControllerMap::const_iterator it = controllerMap.begin();
                     it != controllerMap.end(); ++it)
                {
                    if (Misc::StringUtils::ciEqual(it->first, name))
                    {
                        mAccumRoot = found->second;
                        break;
                    }
                }
                if (mAccumRoot)
                    break;
            }
        }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out against /home/user/openmw/openmw/apps/openmw/mwrender/animation.cpp — the candidate list {"bip01","root bone"} and its order, the two-part acceptance test (node-map hit AND a ciEqual-matching entry in the KF controller map), the `if (!mAccumRoot)` guard, mAccumulate(1,1,0) at :548, `blendMask == 0 && node == mAccumRoot` gating mAccumCtrl at :1177, and ResetAccumRootCallback's inverted mask (setAccumulate sets mResetAxes[i] = accumulate[i] != 0 ? 0 : 1, then componentMultiply), which does zero exactly the accumulating components. But two statements are asserted unconditionally when the code makes them conditional, and one of them is the "REFINES RULE 16" claim the rule is built around. (1) The node map is NOT always a NodeMapVisitor map. Animation::getNodeMap() (:1048-1065) branches: `if (mRequiresBoneMap) SceneUtil::NodeMapVisitorBoneOnly visitor(mNodeMap); else SceneUtil::NodeMapVisitor visitor(mNodeMap);`. mRequiresBoneMap is set at :1640 as `mSkeleton != nullptr && !Misc::StringUtils::ciEndsWith(model, ".nif")` — i.e. osgAnimation-backed skeletons (collada/gltf). NodeMapVisitorBoneOnly::apply (visitor.cpp:51-58) emplaces only `if (dynamic_cast<osgAnimation::Bone*>(&trans) != nullptr)`. So for those models the map holds Bones only, and a plain osg::MatrixTransform named "bip01" is just as absent as an osg::Group and equally cannot be the accum root. The rule's "populated by NodeMapVisitor ... over osg::MatrixTransform nodes ONLY" describes only the .nif / no-skeleton branch. (The container type, CiHash/CiEqual, and emplace-first-wins semantics are right for both branches.) (2) "mAccumRoot is sticky for the life of the Animation" is too strong. Animation::setObjectRoot (:1546) clears it: mNodeMap.clear(); mNodeMapCreated = false; mActiveControllers.clear(); mAccumRoot = nullptr; mAccumCtrl = nullptr (:1561-1565). setObjectRoot is called repeatedly on the same Animation object — npcanimation.cpp:525 (updateNpcBase, on race/sex/vampirism/werewolf rebuild), creatureanimation.cpp:28/48, animation.cpp:2084. Stickiness is scoped to the current object root, not the Animation's lifetime; the accurate part is that later anim sources on the same object root do not re-pick it. Minor: the block lives in Animation::addSingleAnimSource, not addAnimSource (addAnimSource is the caller, and loadAdditionalAnimations calls addSingleAnimSource directly too).

> The selection mechanism is verbatim correct, but the stickiness claim is false exactly where the question aims it — the first-person player body. WHAT HOLDS (all at /home/user/openmw/openmw/apps/openmw/mwrender/animation.cpp): - The pick at 713-735: candidates are exactly {"bip01", "root bone"} in that order with the "Priority matters! bip01 is preferred" comment; a candidate needs both a nodeMap hit and a ci-equal key in the loaded KF's controllerMap. - mAccumulate(1.f, 1.f, 0.f) at :548; ResetAccumRootCallback at :515-539 (setAccumulate inverts, so accumulating axes are the ones zeroed); wired at :1177-1189 under `if (blendMask == 0 && node == mAccumRoot)`. - mAccumRoot is set at exactly one place (:728) and nowhere else in the tree; no subclass overrides it (grep for mAccumRoot/mAccumCtrl/setAccumulation across apps/ and components/ returns only animation.cpp, animation.hpp, and two setAccumulation calls in character.cpp). - The "later anim sources do not re-pick it" half is right: the `if (!mAccumRoot)` guard at :713 holds across addSingleAnimSource calls, including the ones from loadAdditionalAnimations (:623-643). WHAT REFUTES IT — "sticky for the life of the Animation": Animation::setObjectRoot (:1546) nulls it at :1564-1565 (`mAccumRoot = nullptr; mAccumCtrl = nullptr;`) and also does `mNodeMap.clear(); mNodeMapCreated = false;` at :1561-1562. The accum root is sticky for the life of the *object root*, not the Animation. The very case asked about drives this: Camera::processViewChange (camera.cpp:352 / :360) -> NpcAnimation::setViewMode (npcanimation.cpp:295-308) -> rebuild() (:435-441) -> updateNpcBase() (:459) -> setObjectRoot(smodel, true, true, false) at :525 -> mAccumRoot nulled -> addAnimSource(base=xbase_anim.1st, ...) at :530-540 re-picks it against the *first-person* skeleton's freshly rebuilt node map. Same NpcAnimation instance, new accum root. Every first<->third person toggle re-runs this. Same teardown fires for the other two cases named in the question: - Werewolf/vampire: NpcAnimation::updateParts (:578-583) sees NpcType change -> rebuild(). For the player, MechanicsManager::setWerewolf (mechanicsmanagerimp.cpp:1910) and NpcAnimation::setVampire (:1146) route through World::reattachPlayerCamera -> RenderingManager::rebuildPtr (renderingmanager.cpp:1168-1177), which calls anim->rebuild() on the *existing* mPlayerAnimation — the object is not destroyed, so this is a genuine mid-life re-pick. - Werewolf also changes which KFs are loaded: `base` stays empty for werewolves (npcanimation.cpp:504-511), so only the wolfskin defaultSkeleto ...

**Corrected form offered:** Root motion comes from ONE node, picked in Animation::addSingleAnimSource (the worker behind addAnimSource; loadAdditionalAnimations also calls it directly). The candidate names are exactly {"bip01", "root bone"}, tried in that order ("Priority matters! bip01 is preferred"). A candidate is accepted only if BOTH (a) the name resolves in the node map and (b) the loaded KF's controller map contains a keyframe controller under that same name (Misc::StringUtils::ciEqual). The `if (!mAccumRoot)` guard makes the choice sticky for the life of the current object root — later anim sources do not re-pick it — but Animation::setObjectRoot clears mNodeMap, mAccumRoot and mAccumCtrl (animation.cpp:1561-1565), and it is called again on every rebuild (npcanimation.cpp:525 updateNpcBase for race/sex/vampirism/werewolf, creatureanimation.cpp:28/48, animation.cpp:2084), so the pick restarts from scratch there. Two further facts: mAccumulate defaults to (1, 1, 0) (animation.cpp:548), so X and Y accumulate into world position and Z does NOT; and a ResetAccumRootCallback is installed on the accum root that, every frame, ZEROES exactly the accumulating components of that node's local translation (animati


## 57. The hidden flag (0x0001) hides but never deletes - and a NiVisController overrides it
- `components/nifosg/nifloader.cpp:815-832` - NIF nodes and transforms, importance **n/a**

NiAVObject::Flag_Hidden is bit 0x0001 of mFlags (node.hpp:74-79, isHidden() at :95). When set, the loader ALWAYS still creates the node and its whole child hierarchy ("still create the child node hierarchy for animating collision shapes"), sets the node's cull mask to Loader::getHiddenNodeMask() (documented default 0, nifloader.hpp:45-48), and sets mSkipMeshes for the SUBTREE so no drawables are built under it - but mSkipMeshes is suppressed if this node's own controller chain contains a NiVisController, in which case the meshes ARE built and the controller flips visibility at runtime. Note the scan for the NiVisController does NOT check ctrl->isActive(), unlike every other controller loop in the file - so an inactive NiVisController still keeps the meshes alive while never making them visible. The runtime behaviour is a binary node mask swap: `node->setNodeMask(vis ? ~0 : mMask)` where mMask is the same hidden mask (controller.cpp:379-387); the value is sampled with upper_bound then step-back, i.e. a step function holding the previous key's boolean, defaulting to visible when there are no keys (controller.cpp:364-377). So: hidden means "do not draw, but keep the node, keep its transform, keep animating it" - never "prune the branch".

```cpp
            // We can skip creating meshes for hidden nodes if they don't have a VisController that
            // might make them visible later
            if (nifNode->isHidden())
            {
                bool hasVisController = false;
                for (Nif::NiTimeControllerPtr ctrl = nifNode->mController; !ctrl.empty(); ctrl = ctrl->mNext)
                {
                    hasVisController |= (ctrl->mRecordType == Nif::RC_NiVisController);
                    if (hasVisController)
                        break;
                }

                if (!hasVisController)
                    args.mSkipMeshes = true; // skip child meshes, but still create the child node hierarchy for
                                             // animating collision shapes

                node->setNodeMask(Loader::getHiddenNodeMask());
            }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule gets the overall mechanism and the isActive() observation right, but it states as unconditional something the code makes conditional. "mSkipMeshes is suppressed if this node's own controller chain contains a NiVisController, in which case the meshes ARE built" is wrong: the code never clears mSkipMeshes, it only declines to set it (nifloader.cpp:827-828 is a bare `if (!hasVisController) args.mSkipMeshes = true;` with no else). HandleNodeArgs is passed BY VALUE into handleNode (nifloader.cpp:708) and forwarded to every child at line 939, so mSkipMeshes is inherited and sticky-true. If any ancestor already set it - a hidden ancestor with no VisController, or the RootCollisionNode branch at nifloader.cpp:809-812 which sets it unconditionally - then a hidden descendant WITH a NiVisController still builds no drawables (the gate at line 852 is `isGeometry && !args.mSkipMeshes`), while handleNodeControllers still attaches the VisController, which at runtime flips the node mask to ~0 over an empty subtree. Two smaller overreaches: (a) the rule describes VisController::calculate as "sampled with upper_bound then step-back... defaulting to visible when there are no keys", but that is only the mData branch - calculate() first does `if (!mInterpolator.empty()) return mInterpolator.interpKey(time);` (controller.cpp:366-367), so with a NiBoolInterpolator neither the upper_bound walk nor the empty-keys default is ever reached; (b) the hidden mask is not always the node's final mask - nifloader.cpp:833-838, immediately after the hidden block, overwrites it with getIntersectionDisabledNodeMask() (default ~0u, i.e. visible) for a hidden NiCollisionSwitch whose collision is inactive. Verified correct: Flag_Hidden = 0x0001 and isHidden() (node.hpp:77, :98 in master - the rule's :74-79/:95 is minor version drift); hidden mask default 0 documented at nifloader.hpp; children are always recursed regardless of hidden, so "never prune the branch" holds for this loader; mMask in VisController is the same hidden mask (nifloader.cpp:1036); and the scan at line 820 is indeed the only controller-chain loop in the file lacking `if (!ctrl->isActive()) continue;` (present at 966, 993, 1088, 1193, 1464, 1724), so an inactive NiVisController does suppress the skip while never getting a callback attached.

> The loader-level half of the rule is accurate (verified nifloader.cpp:817-832, node.hpp:77/98, HandleNodeArgs passed by value so mSkipMeshes is subtree-scoped, the isActive() asymmetry between the isHidden scan at :819-825 and handleNodeControllers at :993, and controller.cpp:364-387). But the closing generalisation "never prune the branch" is false on exactly the path the question cares about. SceneUtil::CleanObjectRootVisitor::applyNode (components/sceneutil/visitor.cpp:96-105) does `if (node.getNodeMask() == 0x1 && node.getNumParents() == 1) mToRemove.emplace_back(&node, node.getParent(0)); else traverse(node);` — removing the node and its entire subtree from its parent. That hardcoded 0x1 is Mask_UpdateVisitor, which is precisely what the game sets the hidden mask to at renderingmanager.cpp:400 (NifOsg::Loader::setHiddenNodeMask(Mask_UpdateVisitor)), so the header's "default 0" is never the runtime value. The visitor runs inside getModelInstance(..., baseonly, ...) at animation.cpp:1506-1527, and NpcAnimation::updateNpcBase()'s setObjectRoot(smodel, true, true, false) at npcanimation.cpp:525 is the only baseonly=true caller in the engine — it covers every NPC and the player, with smodel coming from getActorSkeleton(is1stPerson, isFemale, isBeast, isWerewolf) (npcanimation.cpp:513-525), i.e. the first-person skeleton included. Werewolves and beast races are not special-cased here; they only select a different skeleton file that goes down the same baseonly path. The pruning also defeats the stated NiVisController carve-out: VisController is an update callback that has not run at load time, so the node mask still reads 0x1 and the whole branch (meshes and controller) is deleted before it could ever flip visible; the pruned result is then cached in a static Cache and reused as the template for every later instance. A second independent pruning site exists for statics: objectpaging.cpp:668-672 sets copyMask = ~Mask_UpdateVisitor with a comment explicitly naming Flag_Hidden. The rule does still hold for the first-person hand/wrist/forearm part meshes, which are attached via insertBoundedPart/SceneUtil::attach and never see CleanObjectRootVisitor.

**Corrected form offered:** NiAVObject::Flag_Hidden is bit 0x0001 of mFlags (node.hpp:77, isHidden() at :98). When set, the nifosg loader still creates the node and recurses into its whole child hierarchy - it never prunes the branch, "so we can still animate collision shapes" - and sets the node's node mask to Loader::getHiddenNodeMask() (documented default 0). It also sets args.mSkipMeshes, which is subtree-scoped because HandleNodeArgs is passed by value (nifloader.cpp:708) and copied to each child (line 939); this suppresses the node's OWN geometry as well as its descendants', since the gate at line 852 is `isGeometry && !args.mSkipMeshes`. Crucially, mSkipMeshes is only ever set, never cleared: finding a NiVisController on this node's controller chain merely skips the assignment, so meshes are built only if no ancestor already set the flag (a hidden ancestor without a VisController, or the RootCollisionNode branch at lines 809-812). Under such an ancestor, a hidden node with a NiVisController still gets no drawables while its VisController flips an empty subtree's mask at runtime. That scan does NOT check ctrl->isActive(), unlike every other controller loop in the file (966, 993, 1088, 1193, 1464, 1724),


## 58. Special node names: "Bounding Box" is deleted, RootCollisionNode is hidden, "AttachLight" receives lights
- `components/nifosg/nifloader.cpp:707-711` - NIF nodes and transforms, importance **n/a**

Three names/types are resolved by name and each has a DIFFERENT mechanism. (1) "Bounding Box" (case-insensitive exact match): the render loader returns nullptr for it - the node AND its entire subtree never enter the scene graph at all. The guard is `args.mRootNode && ...`, and mRootNode is null on the first call, so a NIF whose ROOT is named "Bounding Box" is not skipped. The node is not wasted: the collision loader walks the record tree for the same name and, if the node's BoundingVolume is BOX_BV with all extents > 0, takes mExtents/mCenter as the actor collision box (bulletnifloader.cpp:83-99); the first match in depth-first child order wins. (2) RootCollisionNode is a record TYPE, found by NiNode::findRootCollisionNode which scans the root's direct children IN REVERSE order (`// Yes, this search needs to be reversed`, node.cpp:209-231) and only recurses when the root carried the "RCN" string extra data. The found node is hidden exactly like a hidden node - node mask set to the hidden mask and mSkipMeshes set - but the subgraph is still built and still animated (nifloader.cpp:807-813). (3) "AttachLight" (case-insensitive, FindByNameVisitor stops at the FIRST match in depth-first order and does not descend into a matched group): when a light is attached to an object subgraph, the LightSource is added as a child of that node; if no such node exists the light is added to the subgraph's own root instead.

```cpp
components/nifosg/nifloader.cpp:707-711
        osg::ref_ptr<osg::Node> handleNode(
            const Nif::NiAVObject* nifNode, const Nif::Parent* parent, osg::Group* parentNode, HandleNodeArgs args)
        {
            if (args.mRootNode && Misc::StringUtils::ciEqual(nifNode->mName, "Bounding Box"))
                return nullptr;

components/nifbullet/bulletnifloader.cpp:85-99
        if (Misc::StringUtils::ciEqual(node.mName, "Bounding Box"))
        {
            if (node.mBounds.mType == Nif::BoundingVolume::Type::BOX_BV
                && std::ranges::all_of(node.mBounds.mBox.mExtents._v, [](float extent) { return extent > 0.f; }))
            {
                mShape->mCollisionBox.mExtents = node.mBounds.mBox.mExtents;
                mShape->mCollisionBox.mCenter = node.mBounds.mBox.mCenter;
            }

components/nifosg/nifloader.cpp:807-813
            // Hide collision shapes, but don't skip the subgraph
            // We still need to animate the hidden bones so the physics system can access them
            if (nifNode == args.mCollisionNode)
            {
                args.mSkipMeshes = true;
                node->setNodeMask(Loader::getHiddenNodeMask());
            }

components/sceneutil/lightutil.cpp:98-104
        SceneUtil::FindByNameVisitor visitor("AttachLight");
        node->accept(visitor);

        osg::Group* attachTo = visitor.mFoundNode ? visitor.mFoundNode : node;
        osg::ref_ptr<LightSource> lightSource
            = createLightSource(esmLight, lightMask, isExterior, osg::Vec4f(0, 0, 0, 1));
        attachTo->addChild(lightSource);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Mechanisms (1) "Bounding Box" and (3) "AttachLight" hold exactly as stated and have no player/first-person/werewolf special case (the only name-resolved sites are components/nifosg/nifloader.cpp:710, components/nifbullet/bulletnifloader.cpp:84-106, and components/sceneutil/lightutil.cpp:98 — the torch light on the player is attached to the PRT_Shield part in both view modes, apps/openmw/mwrender/npcanimation.cpp:670 and :1038). Mechanism (2) is contradicted by a caller precisely where the lens asks. The rule says the RootCollisionNode subgraph "is still built and still animated" — that is true of the loader in isolation (nifloader.cpp:807-813 only sets mSkipMeshes and node mask = Loader::getHiddenNodeMask()), but the hidden mask is Mask_UpdateVisitor == 0x1 (apps/openmw/mwrender/vismask.hpp:24, installed by apps/openmw/mwrender/renderingmanager.cpp:400), and SceneUtil::CleanObjectRootVisitor::applyNode (components/sceneutil/visitor.cpp:96-105) deletes any node whose mask is exactly 0x1 with a single parent, together with its whole subtree, instead of traversing it. That visitor runs in MWRender::getModelInstance (apps/openmw/mwrender/animation.cpp:1521-1523) on every baseonly=true load, and NpcAnimation::updateNpcBase calls setObjectRoot(smodel, true, true, false) unconditionally at apps/openmw/mwrender/npcanimation.cpp:525 — for the player, in first person as well as third, and for the werewolf/beast skeletons too, since smodel comes from getActorSkeleton(is1stPerson, isFemale, isBeast, isWerewolf) (apps/openmw/mwrender/actorutil.cpp:8-31). The result is cached and re-instanced, so no first-person player body (or any NPC/werewolf body, or ESM4 NPC via esm4npcanimation.cpp:25) ever contains the RootCollisionNode subgraph at all; it cannot be animated because it is not there. The loader comment's justification ("still need to animate the hidden bones so the physics system can access them") does not apply to actors, whose shapes come from the separate BulletNifLoader box/capsule. Note the same removal also strips ordinary Flag_Hidden nodes from actor bases, and ObjectPaging independently drops both kinds via copyMask = ~Mask_UpdateVisitor (apps/openmw/mwrender/objectpaging.cpp:668-672). Minor imprecision in claim (1): bulletnifloader's findBoundingBox stops at the first node *named* "Bounding Box" whether or not its bounds are valid — an invalid BOX_BV logs a warning, sets no box, and aborts the search rather than letting a later match win.

**Corrected form offered:** Mechanisms (1) and (3) are correct as stated. Mechanism (2) needs its last clause replaced: the RootCollisionNode is found by NiNode::findRootCollisionNode (reverse scan of the root's direct children, recursing only when the root carried the "RCN" string extra data, components/nif/node.cpp:209-231) and the loader hides it exactly like a hidden node — node mask set to Loader::getHiddenNodeMask() and mSkipMeshes set (nifloader.cpp:807-813) — so in a plain object the subgraph is still built and still animated. That last part does NOT hold for actors. Because the hidden mask is Mask_UpdateVisitor == 0x1, SceneUtil::CleanObjectRootVisitor (components/sceneutil/visitor.cpp:96-105) removes every node with mask 0x1 and its entire subtree from any model loaded with baseonly=true, which is the path every NPC body takes (Animation::setObjectRoot via getModelInstance, animation.cpp:1521-1523; NpcAnimation::updateNpcBase, npcanimation.cpp:525). So for the player's body — first person, third person, and the werewolf/beast skeletons alike — the RootCollisionNode subgraph is deleted outright rather than merely masked, and nothing in it is animated. Also, in claim (1), the collision loader stops at


## 59. NiStringExtraData markers are exact-match, root-scoped, and gate the geometry name skip list
- `components/nifosg/nifloader.cpp:742-768` - NIF nodes and transforms, importance **n/a**

A node's extra-data chain is read via NiObjectNET::getExtraList(), which concatenates the modern mExtraList vector with the legacy singly-linked mExtra chain (base.cpp:33-39) - both must be walked. Only four NiStringExtraData payloads mean anything, and the comparisons are EXACT and CASE-SENSITIVE (==, not ciEqual): "MRK" sets mHasMarkers, "RCN" enables recursive RootCollisionNode search, and BOTH are honoured ONLY when the node carrying them is the root (`args.mRootNode == node`); "BONE" tags the node with the description "CustomBone" (any node, no root check); and a string with the prefix "omw:data" carries an OpenMW-specific YAML payload (an OpenMW extension, not Morrowind data). What mHasMarkers actually does is gate a geometry-NAME skip list: for Morrowind-version files (<= VER_MW) a drawable is skipped when its name case-insensitively starts with "tri editormarker" (only if mHasMarkers) or, UNCONDITIONALLY, with "shadow" or "tri shadow". REFINES RULE 15: the "Tri " naming convention shows up in more places than the CopyRigVisitor bone filter - the engine also prefix-tests "tri editormarker", "tri shadow", and, in Animation::setObjectRoot for CREATURES ONLY, strips every drawable whose name starts with "tri bip" (animation.cpp:1645-1650 via SceneUtil::RemoveTriBipVisitor, visitor.cpp:143-151). That "tri bip" strip is creature-specific; it is NOT a general NIF rule and must not be applied to NPC or first-person meshes.

```cpp
components/nifosg/nifloader.cpp:742-768
                else if (e->mRecordType == Nif::RC_NiStringExtraData)
                {
                    const Nif::NiStringExtraData* sd = static_cast<const Nif::NiStringExtraData*>(e.getPtr());

                    constexpr std::string_view extraDataIdentifer = "omw:data";

                    // String markers may contain important information
                    // affecting the entire subtree of this obj
                    if (sd->mData == "MRK")
                    {
                        // Marker objects. These meshes are only visible in the editor.
                        if (!Loader::getShowMarkers() && args.mRootNode == node)
                            args.mHasMarkers = true;
                    }
                    else if (sd->mData == "BONE")
                    {
                        node->getOrCreateUserDataContainer()->addDescription("CustomBone");
                    }
                    else if (sd->mData == "RCN")
                    {
                        if (args.mRootNode == node)
                            recursiveCollision = true;
                    }
                    else if (sd->mData.rfind(extraDataIdentifer, 0) == 0)
                    {
                        extraData = sd->mData.substr(extraDataIdentifer.length());
                    }
                }

components/nifosg/nifloader.cpp:855-860
                if (args.mNifVersion <= Nif::NIFFile::NIFVersion::VER_MW)
                {
                    skip = (args.mHasMarkers && Misc::StringUtils::ciStartsWith(nifNode->mName, "tri editormarker"))
                        || Misc::StringUtils::ciStartsWith(nifNode->mName, "shadow")
                        || Misc::StringUtils::ciStartsWith(nifNode->mName, "tri shadow");
   
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule is largely accurate but states as exclusive two things the code makes conditional, so it overreaches. (1) OMITTED GUARD THAT CHANGES MEANING. The rule asserts MRK and RCN "are honoured ONLY when the node carrying them is the root (args.mRootNode == node)". The very line the rule quotes is `if (!Loader::getShowMarkers() && args.mRootNode == node)` (nifloader.cpp:753). MRK has TWO conjunctive guards, not one. `Loader::getShowMarkers()` is a global static (`sShowMarkers`, nifloader.cpp:259-269, set via `setShowMarkers`); when it is true, a root-carried MRK sets nothing at all and marker meshes render. That is the entire point of the feature and the adjacent comment says so ("These meshes are only visible in the editor"). The word "ONLY" makes this an explicit exclusivity claim the code contradicts. RCN really does have just the root check (line 762), so the rule collapses two differently-guarded cases into one wrong generalisation. (2) STATES AS THE WHOLE BEHAVIOUR SOMETHING THAT IS ONE BRANCH. "What mHasMarkers actually does is gate a geometry-NAME skip list" for `<= VER_MW` describes only the `if` arm (855-860). Lines 861-866 are an `else` arm: for post-Morrowind files `mHasMarkers` instead gates `ciStartsWith(name, "EditorMarker") || ciStartsWith(name, "VisibilityEditorMarker")`. Further, line 899 uses `mHasMarkers` for something that is not a skip list at all — `if (isAnimated || (args.mHasAnimatedParents && ((args.mSkipMeshes || args.mHasMarkers) || isGeometry))) node->setDataVariance(DYNAMIC)`. And `mHasMarkers` is settable with no NiStringExtraData involved, via BSXFlags bit 32 (lines 774-778). The whole skip block is also nested under `if (isGeometry && !args.mSkipMeshes)` (line 852). (3) SCOPE OVERREACH on the absolutes. "Only four NiStringExtraData payloads mean anything" and "the comparisons are EXACT and CASE-SENSITIVE (==, not ciEqual)" are true inside this one loop, but the rule opens by framing itself as a rule about "a node's extra-data chain" generally. bulletnifloader.cpp:141-165 walks the same `getExtraList()` and additionally honours the `"NC"`/`"NCC"` family through `Misc::StringUtils::ciStartsWith` — case-INsensitive — setting `mShape->mVisualCollisionType` to Camera or Default. VERIFIED CORRECT, for the record: base.cpp:33-39 does concatenate `mExtraList` with a walk of the legacy `mExtra`/`mNext` chain, so both must be walked. BONE adds the "CustomBone" description on any node with no root check. The `omw:data` prefix test is `rfind(id, 0) == 0` and its payload really is YAML (handleExtraData, nifloader.cpp:229-231, `YAML::L ...

> The first-person/player-relevant half of the rule is correct and survives every caller check, but the rule's absolute claims about NiStringExtraData are contradicted elsewhere in OpenMW. (1) components/nifbullet/bulletnifloader.cpp:141-165 reads a FIFTH NiStringExtraData payload using a CASE-INSENSITIVE PREFIX test, not an exact case-sensitive ==: `else if (Misc::StringUtils::ciStartsWith(sd->mData, "NC"))` sets mShape->mVisualCollisionType to Camera when the third character is an uppercase 'C' ("NCC*") and to Default (no collision) otherwise. That same loop also reads "MRK" (into mHasTriMarkers) and "RCN" at the root, and the physics skip list is a different one: ciStartsWith(name, "EditorMarker") under BSXFlags-derived mHasMarkers (line 269) and ciStartsWith(name, "Tri EditorMarker") under mHasTriMarkers (line 273). (2) The nifosg marker flag is not set by "MRK" alone: nifloader.cpp:753 gates it on `!Loader::getShowMarkers()`, and apps/opencs/editor.cpp:61 calls NifOsg::Loader::setShowMarkers(true), so in OpenCS "MRK" at the root does NOT set mHasMarkers and editor markers render. (3) mHasMarkers is additionally set by BSXFlags bit 32 (NiIntegerExtraData, nifloader.cpp:775-779), so the string is not its only source. Everything else verified as stated: base.cpp:31-39 concatenates mExtraList with the mExtra/mNext chain; nifloader.cpp:750-767 has the root gate on MRK/RCN and no root gate on BONE; nifloader.cpp:855-866 has the MW-version skip list with "tri editormarker" gated on mHasMarkers and "shadow"/"tri shadow" unconditional; and the "tri bip" strip is creature-only and cannot reach an NPC or first-person body — animation.cpp:1645-1650 runs RemoveTriBipVisitor only under `if (isCreature)`, and npcanimation.cpp:525 calls setObjectRoot(smodel, true, true, false) for every NPC including VM_FirstPerson (xbase_anim.1st), werewolves and beast races, with esm4npcanimation.cpp:25 likewise false; that NPC call additionally passes baseonly=true, which runs CleanObjectRootVisitor (animation.cpp:1506-1531) and removes every drawable from the skeleton regardless. OpenCS mirrors the same split at apps/opencs/view/render/actor.cpp:53-72 (CleanObjectRootVisitor for non-creatures, RemoveTriBipVisitor for creatures).

**Corrected form offered:** Two trivial line-range off-by-ones: nifloader.cpp:742-769 (not 742-768; the block's closing brace is on line 769) and visitor.cpp:144-152 (not 143-151; line 143 is a blank line preceding the function). The nifloader.cpp:855-860 range is exactly correct, and all three code excerpts are verbatim-accurate against current master.


## 60. NiBillboardNode keeps its translation and float scale but throws away its stored rotation every frame
- `components/nifosg/nifloader.cpp:671-690` - NIF nodes and transforms, importance **n/a**

A NiBillboardNode becomes a NifOsg::AutoTransform instead of a MatrixTransform. Its NiTransform is still read: the TRANSLATION and the float mScale are used verbatim, and the stored 3x3 is converted once into mBaseRotation. Every cull traversal the node's matrix is rebuilt from scratch as scale(mScale) then rotate(cameraDerivedRotation * mBaseRotation) then translate(storedTranslation) (autotransform.cpp:146-151) - so the file's rotation only ever acts as a fixed pre-rotation, never as the final orientation, and any non-uniform scale baked into the 3x3 is LOST for billboards. Only three of the six modes are implemented: AlwaysFaceCamera(0), RotateAboutUp(1) and BSRotateAboutUp(5) which maps onto RotateAboutUp, and RigidFaceCamera(2). AlwaysFaceCenter(3) and RigidFaceCenter(4) fall into the `else` branch: a warning is logged and the node is built with AutoTransform's DEFAULT mode, which is RigidFaceCamera (autotransform.hpp:18). Billboard nodes are also forced to DYNAMIC data variance so no optimiser flattens them away. Modes differ in kind: RotateAboutUp yaws about the node's local up using the eye position relative to the node's own translation, while the FaceCamera modes align to the cull stack's look/up vectors regardless of where the node is.

```cpp
components/nifosg/nifloader.cpp:671-690
            if (nifNode->mRecordType == Nif::RC_NiBillboardNode)
            {
                auto billboard = static_cast<const Nif::NiBillboardNode*>(nifNode);
                using Mode = Nif::NiBillboardNode::BillboardMode;

                if (billboard->mMode == Mode::AlwaysFaceCamera)
                    node = new NifOsg::AutoTransform(billboard->mTransform, AutoTransform::Mode::AlwaysFaceCamera);
                else if (billboard->mMode == Mode::RotateAboutUp || billboard->mMode == Mode::BSRotateAboutUp)
                    node = new NifOsg::AutoTransform(billboard->mTransform, AutoTransform::Mode::RotateAboutUp);
                else if (billboard->mMode == Mode::RigidFaceCamera)
                    node = new NifOsg::AutoTransform(billboard->mTransform, AutoTransform::Mode::RigidFaceCamera);
                else
                {
                    Log(Debug::Warning) << "Unhandled billboard mode " << static_cast<int>(billboard->mMode)
                                        << " in record " << nifNode->mRecordIndex;
                    node = new NifOsg::AutoTransform(billboard->mTransform);
                }

                dataVariance = osg::Object::DYNAMIC;
            }

components/nifosg/autotransform.cpp:146-151
        osg::Matrixd matrix;
        matrix.makeScale(mScale, mScale, mScale);
        matrix.postMultRotate(mat.getRotate() * mBaseRotation);
        matrix.postMultTranslate(_matrix.getTrans());

        return matrix;
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out against the source: the dispatch at components/nifosg/nifloader.cpp:671-690 is quoted correctly; Nif::NiBillboardNode::BillboardMode really has six values 0-5 (components/nif/node.hpp:294-302) with BSRotateAboutUp(5) folded onto RotateAboutUp; modes 3 and 4 do hit the `else`, log a warning, and get AutoTransform's default mode, which is Mode::RigidFaceCamera (autotransform.hpp:18-19 — the `else` branch actually calls the two-arg ctor on line 19, same default); dataVariance is unconditionally overridden to DYNAMIC at nifloader.cpp:689; translation and the float mScale are used verbatim (matrixtransform.cpp:5-10 plus autotransform.cpp:147,149); the non-uniform-scale-is-lost claim is correct and well-supported, since NiTransform::mRotation is documented as possibly carrying "negative and nonuniform scales" (niftypes.hpp:70) while AutoTransform rebuilds with makeScale(mScale,mScale,mScale) and mBaseRotation = rotMat.getRotate(); and the RotateAboutUp-vs-FaceCamera distinction is right (eye - _matrix.getTrans() at line 135 vs. look/up only at lines 99-100). The overreach is the clause "the file's rotation only ever acts as a fixed pre-rotation, never as the final orientation." Lines 146-151 are only reached from the CullStack branch, and even there `mat` is guarded. Three omitted paths make the file's rotation the whole final orientation: 1. autotransform.cpp:83-87 — computeMatrix falls through whenever nv is null or the visitor is not a CullStack (`nv ? nv->asCullStack() : nullptr`). That path builds scale · mRotation · translate, and mRotation is initialised to mBaseRotation in the ctor (line 24), so before any cull the file's rotation IS the final orientation. 2. The degenerate guards at autotransform.cpp:110 (`if (norm > 1e-6)`) and :137 (`if (norm > 1e-12)`). When they fail, `mat` is left as the default identity Matrixd, so line 148 reduces to postMultRotate(mBaseRotation) — again the file rotation alone. 3. Non-degenerate and routine: apps/openmw/mwrender/objectpaging.cpp:250-264 explicitly special-cases NifOsg::AutoTransform for the inactive grid, calls autoTransform->computeMatrix(nullptr) — deliberately hitting path 1 — bakes the result into a plain osg::MatrixTransform and sets osg::Object::STATIC. This also undercuts "forced to DYNAMIC data variance so no optimiser flattens them away": distant paged billboards are flattened into a static matrix, frozen at the cached mRotation.

**Corrected form offered:** A NiBillboardNode becomes a NifOsg::AutoTransform (a subclass of NifOsg::MatrixTransform) rather than a plain MatrixTransform. Its NiTransform is still read: the translation and the float mScale are used verbatim, and the stored 3x3 is converted at construction into mBaseRotation (autotransform.cpp:19-24). During a cull traversal — and only when the visitor resolves to an osg::CullStack (autotransform.cpp:75-81) — the matrix is rebuilt from scratch as scale(mScale), then rotate(cameraDerivedRotation * mBaseRotation), then translate(_matrix.getTrans()) (autotransform.cpp:146-151), so on that path the file's rotation is composed with a camera-derived rotation rather than standing as the final orientation, and any non-uniform or negative scale baked into the 3x3 is lost for billboards. It is not, however, "never the final orientation": when the visitor is not a CullStack, computeMatrix falls back to scale · mRotation · translate (autotransform.cpp:83-87), and mRotation starts out equal to mBaseRotation; and inside computeMatrixForFrame the degenerate guards `norm > 1e-6` (AlwaysFaceCamera, line 110) and `norm > 1e-12` (RotateAboutUp, line 137) leave `mat` at identity, collapsing line 


## 61. The seven texture slots are positional, and only the base map is a colour map
- `components/nifosg/nifloader.cpp:2158-2237` - Materials and textures, importance **n/a**

NiTexturingProperty::mTextures is an ordered vector whose INDEX is the slot: 0=BaseTexture, 1=DarkTexture, 2=DetailTexture, 3=GlossTexture, 4=GlowTexture, 5=BumpTexture, 6=DecalTexture (components/nif/property.hpp:43-52 - note the stream order is NOT base/dark/detail/glow, gloss sits at 3 and glow at 4). handleTextureProperty walks them in ASCENDING index order and, for each stage that is mEnabled (plus slot 0 also when the property has any controller), binds it to the NEXT FREE texture unit - `texUnit = boundTextures.size()` at :1154 - and tags that unit with a name: 0->"diffuseMap", 1->"darkMap", 2->"detailMap", 3->"glossMap", 4->"emissiveMap", 5->"bumpMap", 6->"decalMap". Any index >= 7 falls to `default:` and is SKIPPED with a log line. Because the loop is ascending and base is index 0, the base map is unit 0 whenever it is enabled - the comment at :2165 says the shadow-casting shader depends on that invariant. Three exceptions worth porting exactly: (a) an enabled stage with an empty mSourceTexture and no controller is `continue`d, so it consumes NO unit and shifts nothing; (b) a DISABLED base stage reachable only through a NiFlipController is bound with a null image and forced wrapS=wrapT=true, uvSet=0; (c) wrapT = mClamp & 1 and wrapS = mClamp & 2 (property.hpp:69-70) - note T is bit 0, S is bit 1, the opposite of the intuitive order. Each unit remembers the stage's mUVSet and the geometry's UV array for that unit comes from mUVList[uvSet] (:1643-1667). A NiTexturingProperty seen on a node calls clearBoundTextures FIRST (:2163), so it REPLACES the inherited texture set rather than merging with it. What the non-base slots actually do, from files/shaders/compatibility/objects.frag: darkMap multiplies the whole RGBA before the alpha test (:159-162); detailMap multiplies RGB by its RGB times 2.0 (:179-181); decalMap is mix()ed into RGB weighted by decalTex.a * diffuseColor.a (:183-186); emissiveMap is ADDED to RGB after lighting (:247-249); glossMap only multiplies the environment-map contribution and is a no-op without an env map (:208-210); bumpMap only perturbs env-map coordinates (:200-206). So for a Morrowind mesh with no env map, gloss and bump slots are inert.

```cpp
            // If this loop is changed such that the base texture isn't guaranteed to end up in texture unit 0, the
            // shadow casting shader will need to be updated accordingly.
            for (size_t i = 0; i < texprop->mTextures.size(); ++i)
            {
                const Nif::NiTexturingProperty::Texture& tex = texprop->mTextures[i];
                if (tex.mEnabled || (i == Nif::NiTexturingProperty::BaseTexture && !texprop->mController.empty()))
                {
                    std::string textureName;
                    switch (i)
                    {
                        // These are handled later on
                        case Nif::NiTexturingProperty::BaseTexture:
                            textureName = "diffuseMap";
                            break;
                        case Nif::NiTexturingProperty::GlowTexture:
                            textureName = "emissiveMap";
                            break;
                        case Nif::NiTexturingProperty::DarkTexture:
                            textureName = "darkMap";
                            break;
                        case Nif::NiTexturingProperty::BumpTexture:
                            textureName = "bumpMap";
                            break;
                        case Nif::NiTexturingProperty::DetailTexture:
                            textureName = "detailMap";
                            break;
                        case Nif::NiTexturingProperty::DecalTexture:
                            textureName = "decalMap";
                            break;
                        case Nif::NiTexturingProperty::GlossTexture:
                            textureName = "glossMap";
                            break;
                        default:
                  
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out against upstream master (enum order at components/nif/property.hpp:44-53; wrapT = mClamp & 1 / wrapS = mClamp & 2 at property.hpp:70-71; the ascending loop, the seven name tags, texUnit = boundTextures.size() at nifloader.cpp:1154, the default: skip-with-log, exception (b) verbatim, and the darkMap/detailMap/decalMap/emissiveMap/glossMap shader semantics). But four claims overreach: (1) It states the unit-0 invariant as always-true and derives it from the wrong premise: "Because the loop is ascending and base is index 0, the base map is unit 0 whenever it is enabled." Ascending order does not give that, because the rule's own exception (a) is the counterexample: base enabled with an empty mSourceTexture and an empty texprop->mController hits `continue` at nifloader.cpp:2205-2213, so nothing is bound and unit 0 is taken by the next surviving stage (darkMap, detailMap, ...). The invariant the shadow-casting shader actually relies on is "if a base texture is bound at all, it lands on unit 0." (2) The UV claim omits a guard that changes the meaning. nifloader.cpp:1651-1658 is not an unconditional mUVList[uvSet]: `if (uvSet >= uvlist.size())` logs "Out of bounds UV set", then `continue`s (that stage gets NO texcoord array at all) when uvlist is empty, otherwise clamps uvSet = 0. A port that indexes mUVList[uvSet] directly reads out of bounds on malformed NIFs. (3) clearBoundTextures (nifloader.cpp:1180-1186) accepts an osg::StateSet* and IGNORES it — the body is only `if (!boundTextures.empty()) boundTextures.clear();`. It resets the unit counter so new bindings overwrite units 0..N-1 on the node's own stateset; it removes nothing from any stateset, so higher-numbered texture attributes set on an ancestor stateset are still inherited by OSG state. "REPLACES the inherited texture set rather than merging with it" is the intent stated in the comment at :2162, not what the function does. (4) "bumpMap only perturbs env-map coordinates" is incomplete — objects.frag:203 also computes envLuma = clamp(bumpTex.b * envMapLumaBias.x + envMapLumaBias.y, 0.0, 1.0), which scales the entire env contribution; and the rule omits that the BumpTexture branch at nifloader.cpp:2227-2234 additionally uploads the bumpMapMatrix and envMapLumaBias uniforms. Relatedly, "gloss and bump slots are inert" for a no-env-map Morrowind mesh overstates: both still consume a texture unit (shifting every later slot), and a bound bumpMap suppresses OpenMW's auto-detected normal map when the filenames match (components/shader/shadervisitor.cpp:358-360). Minor: the proper ...

**Corrected form offered:** NiTexturingProperty::mTextures is an ordered vector whose INDEX is the slot: 0=BaseTexture, 1=DarkTexture, 2=DetailTexture, 3=GlossTexture, 4=GlowTexture, 5=BumpTexture, 6=DecalTexture (components/nif/property.hpp:44-53 - gloss sits at 3 and glow at 4). handleTextureProperty walks them in ASCENDING index order and, for each stage that is mEnabled (plus slot 0 also when texprop->mController is non-empty), binds it to the NEXT FREE texture unit (`texUnit = boundTextures.size()` at nifloader.cpp:1154) and tags that unit via SceneUtil::TextureType: 0->"diffuseMap", 1->"darkMap", 2->"detailMap", 3->"glossMap", 4->"emissiveMap", 5->"bumpMap", 6->"decalMap". Any index >= 7 falls to `default:` and is skipped with a log line. The correct unit-0 invariant is: IF a base texture is bound at all, it lands on unit 0 (it is the first index considered and boundTextures was just cleared). It is NOT true that an enabled base always occupies unit 0 - see (a) below, where an enabled base binds nothing and unit 0 falls to the next surviving stage. The comment at :2165 and the FlipController's hardcoded `stateset->getTextureAttribute(0, ...)` at :1209 both lean on the bound-base form of the invariant. T


## 62. Alpha blending and alpha testing are two independent bitfields, and disabling REMOVES inherited state
- `components/nifosg/nifloader.cpp:2320-2368` - Materials and textures, importance **n/a**

Everything comes out of NiAlphaProperty::mFlags (uint16) plus a separate uint8 mThreshold (components/nif/property.hpp:414-462): blending is enabled by bit 0x0001, alpha TESTING by bit 0x0200, and 0x2000 is Flag_NoSorter. Source blend factor = (mFlags >> 1) & 0xF, destination = (mFlags >> 5) & 0xF, alpha test function = (mFlags >> 10) & 0x7. The blend-factor table is 0=ONE, 1=ZERO, 2=SRC_COLOR, 3=ONE_MINUS_SRC_COLOR, 4=DST_COLOR, 5=ONE_MINUS_DST_COLOR, 6=SRC_ALPHA, 7=ONE_MINUS_SRC_ALPHA, 8=DST_ALPHA, 9=ONE_MINUS_DST_ALPHA, 10=SRC_ALPHA_SATURATE, anything else -> SRC_ALPHA with a log line (nifloader.cpp:1899-1929). The test-function table is 0=ALWAYS, 1=LESS, 2=EQUAL, 3=LEQUAL, 4=GREATER, 5=NOTEQUAL, 6=GEQUAL, 7=NEVER, anything else -> LEQUAL (:1931-1955). The alpha reference is mThreshold / 255.0. Two behaviours a naive port gets wrong: (1) when the flag is OFF the loader does not merely skip - it REMOVES the blend func / GL_BLEND and the alpha func / GL_ALPHA_TEST from the stateset, which is how a child NiAlphaProperty cancels an ancestor's; (2) a destination factor of DST_ALPHA is rewritten to ONE, because 'D3D8.1 doesn't do that' on an RGBA framebuffer. Sorting is decided separately: `sort = !alphaprop->noSorter()`, i.e. blending WITHOUT the 0x2000 bit puts the drawable in the TRANSPARENT_BIN (back-to-front); with the bit set it inherits the opaque bin. In the shader the test happens AFTER the base and dark maps and after the material/vertex alpha multiply: `gl_FragData[0].a *= diffuseColor.a * alpha * actorFade;` then optional darkMap multiply, then `gl_FragData[0].a = alphaTest(gl_FragData[0].a, alphaRef);` (files/shaders/compatibility/objects.frag:156-164).

```cpp
        static void handleAlphaTesting(
            bool enabled, osg::AlphaFunc::ComparisonFunction function, int threshold, osg::Node& node)
        {
            if (enabled)
            {
                osg::ref_ptr<osg::AlphaFunc> alphaFunc(new osg::AlphaFunc(function, threshold / 255.f));
                alphaFunc = shareAttribute(alphaFunc);
                node.getOrCreateStateSet()->setAttributeAndModes(alphaFunc, osg::StateAttribute::ON);
            }
            else if (osg::StateSet* stateset = node.getStateSet())
            {
                stateset->removeAttribute(osg::StateAttribute::ALPHAFUNC);
                stateset->removeMode(GL_ALPHA_TEST);
            }
        }

        void handleAlphaBlending(
            bool enabled, int sourceMode, int destMode, bool sort, bool& hasSortAlpha, osg::Node& node) const
        {
            if (enabled)
            {
                osg::ref_ptr<osg::StateSet> stateset = node.getOrCreateStateSet();
                osg::ref_ptr<osg::BlendFunc> blendFunc(
                    new osg::BlendFunc(getBlendMode(sourceMode), getBlendMode(destMode)));
                // on AMD hardware, alpha still seems to be stored with an RGBA framebuffer with OpenGL.
                // This might be mandated by the OpenGL 2.1 specification section 2.14.9, or might be a bug.
                // Either way, D3D8.1 doesn't do that, so adapt the destination factor.
                if (blendFunc->getDestination() == GL_DST_ALPHA)
                    blendFunc->setDestination(GL_ONE);
                blendFunc = shareAttribute(blendFunc);
                stateset->setAttributeAndModes(blendFunc, osg::StateAttribute::ON);

                if (sort)
                {
                    hasSortAlpha = true;
                    if (!mPu
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Nearly everything checks out against upstream, but the sorting claim states as unconditional what the code guards. Confirmed accurate: property.hpp:414-463 has Flag_Blending=0x0001, Flag_Testing=0x0200, Flag_NoSorter=0x2000, uint16 mFlags + uint8 mThreshold, and sourceBlendMode()=(mFlags>>1)&0xF, destinationBlendMode()=(mFlags>>5)&0xF, alphaTestMode()=(mFlags>>10)&0x7. getBlendMode (nifloader.cpp:1899-1928) and getTestMode (1930-1954) match the quoted tables including the SRC_ALPHA / LEQUAL defaults with Log(Debug::Info). handleAlphaTesting uses threshold/255.f, and both handlers really do removeAttribute + removeMode on the OFF branch; collectDrawableProperties (nifloader.cpp:189-211) recurses into the parent first and appends the node's own props last, so a child NiAlphaProperty genuinely cancels an ancestor's on the shared drawable stateset. The DST_ALPHA -> ONE rewrite and the objects.frag ordering (157 `gl_FragData[0].a *= diffuseColor.a * alpha * actorFade;`, 160-161 darkMap, 164 alphaTest) are verbatim correct. The defect: "blending WITHOUT the 0x2000 bit puts the drawable in the TRANSPARENT_BIN (back-to-front); with the bit set it inherits the opaque bin" drops the `if (!mPushedSorter)` guard that sits on BOTH bin calls in the quoted snippet. mPushedSorter is the enclosing NiSortAdjustNode (nifloader.cpp:329, pushed at :800-803). When one is in scope, handleAlphaBlending sets NO bin at all — it only sets hasSortAlpha — and the bin is decided later at nifloader.cpp:2943-2985 from the sorter's mode and subsorter type. That inverts the stated outcome in real cases: under SortingMode::Off a blending drawable with the sorter bit CLEAR gets setBinTraversal (bin 2, "TraversalOrderBin"), not back-to-front; and under a NiClusterAccumulator subsorter a drawable WITH the 0x2000 bit set still gets setBinBackToFront regardless of hasSortAlpha, rather than inheriting. A port that hardcodes the rule as written mis-sorts every mesh under a NiSortAdjustNode. Two smaller inaccuracies ride along: the back-to-front path outside handleAlphaBlending is setRenderBinDetails(0, "SORT_BACK_TO_FRONT"), not the TRANSPARENT_BIN hint (bin 10, DepthSortedBin); and setRenderBinToInherit() means inheriting whatever bin is in effect, which is not necessarily "the opaque bin".

> The rule cannot hold here because its entire subject is absent from this codebase, and the code that actually renders the first-person player body contradicts it. This repository is /home/user/project-dagger, a JavaScript port of Daggerfall (logic from Daggerfall Unity, presentation on hand-rolled WebGL2) — not OpenMW. All three cited sources are non-existent paths: there is no components/ directory, no files/shaders/ directory, no .gitmodules, and zero .cpp/.hpp/.frag/.glsl files anywhere in the tree. A full-tree grep (excluding .git and node_modules) for NiAlphaProperty, nifloader, nifosg, and openmw returns no hits; the sole filename matching *nif* is /home/user/project-dagger/test/manifest.test.js, matching on the substring inside "manifest". Daggerfall assets are ARCH3D/CIF/IMG, never NIF, so no mFlags/mThreshold decode, blend-factor table, test-function table, stateset, or sorting bin exists to be overridden. Where it matters for a first-person player body, the real behaviour is different in kind, not just in detail. Alpha is a fixed 1-bit cutout compiled into the shaders rather than a per-material reference derived from mThreshold/255.0: `if (t.a < 0.5) discard;` at /home/user/project-dagger/src/render/renderer.js:63, :794 and :895, with the one exception being spectral (ghost) flats at renderer.js:230, `if (tex.a < (uSpectral == 1 ? 0.1 : 0.5)) discard;`. The comment at renderer.js:890-895 states the governing law: classic art is a 1-bit palette cutout (index 0 transparent, everything else fully opaque), so the default discards and forces alpha 1, with a narrow `uBlendTex` opt-in for art authored outside that palette. Blending, where enabled at all, is one hard-coded pair with no factor decoding — gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) at renderer.js:950, :1438, :1512, overworldRenderer.js:369 and :385, and precipitation.js:165 — so there is no source/destination factor selection and therefore no DST_ALPHA-to-ONE rewrite. Because the renderer is immediate-mode WebGL2 with no stateset graph, the rule's two load-bearing behaviours have no mechanism to exist: nothing can REMOVE a blend func or alpha func from a parent's state to cancel it, and there is no noSorter bit or TRANSPARENT_BIN assignment. The specific special cases the task asked about confirm the same. The first-person viewmodel entry point, drawFirstPersonViewmodel at /home/user/project-dagger/src/render/characterSprite.js:54, is explicitly marked ON ICE (2026-08-17) with "No consumer"; the live first-person path is src/combat/fpsWeapon.js using WEAPON*.CIF sprites, and neith ...

**Corrected form offered:** Same as stated for the flags, the bit fields, both lookup tables (SRC_ALPHA / LEQUAL fallbacks), alphaRef = mThreshold/255.0, the remove-on-off cancellation semantics, the DST_ALPHA -> ONE destination rewrite, and the shader ordering — but the sorting rule is conditional on there being no enclosing NiSortAdjustNode. The call site passes sort = !alphaprop->noSorter() (nifloader.cpp:2829-2830), and handleAlphaBlending's blending branch always records hasSortAlpha = sort; the bin, however, is only touched when mPushedSorter == nullptr: sort -> setRenderingHint(TRANSPARENT_BIN), !sort -> setRenderBinToInherit(), and the OFF branch also calls setRenderBinToInherit(). When an ancestor NiSortAdjustNode IS in scope, handleAlphaBlending sets no bin; the end of applyDrawableProperties (nifloader.cpp:2943-2985) assigns it instead: SortingMode::Off -> setRenderBinDetails(2, "TraversalOrderBin") no matter what the alpha flags say; Inherit/Subsort with a NiAlphaAccumulator -> setRenderBinDetails(0, "SORT_BACK_TO_FRONT") if hasSortAlpha else TraversalOrderBin; with a NiClusterAccumulator -> SORT_BACK_TO_FRONT unconditionally. Also, with no pushed sorter, a non-sorting drawable that carries a sten


## 63. Vertex colour REPLACES the material colour - it never multiplies it
- `files/shaders/lib/material/vertexcolors.glsl:6-32` - Materials and textures, importance **n/a**

This is the single most likely place for a port to be silently wrong. OpenMW does not modulate the material by the vertex colour; the vertex colour SUBSTITUTES for whichever material channel the colour mode names. getDiffuseColor returns passColor (the whole vec4, RGB and A) when the mode is AmbientAndDiffuse or Diffuse, otherwise material.diffuse; getAmbientColor and getEmissionColor behave the same way for their modes. Consequences that must be reproduced: (a) with vertex colours present the material's DIFFUSE COLOUR IS DISCARDED, not tinted; (b) with vertex colours present the material's ALPHA is discarded too, because NiMaterialProperty's mAlpha is stored as diffuse.a (`mat->setDiffuse(osg::Vec4f(matprop->mDiffuse, matprop->mAlpha))`, nifloader.cpp:2599) and the fragment shader consumes it as `gl_FragData[0].a *= diffuseColor.a` (objects.frag:156-157) where diffuseColor is the vertex colour - so vertex alpha wins outright; (c) the specular channel is only ever replaced under ColorMode_Specular, which the NIF loader never selects. passColor is gl_Color, bound per-vertex from NiGeometryData::mColors as a Vec4Array (nifloader.cpp:1642-1644, objects.vert:88/:103). The numeric mode values that reach the shader are ColorMode_None=0, Emission=1, AmbientAndDiffuse=2, Ambient=3, Diffuse=4, Specular=5 (files/shaders/lib/material/colormodes.glsl:4-9), matching SceneUtil::VertexColorModes in components/sceneutil/material.hpp:18-25.

```cpp
vec4 getEmissionColor(Material material, vec4 passColor)
{
    if (material.vertexColorMode == ColorMode_Emission)
        return passColor;
    return material.emission;
}

vec4 getAmbientColor(Material material, vec4 passColor)
{
    if (material.vertexColorMode == ColorMode_AmbientAndDiffuse || material.vertexColorMode == ColorMode_Ambient)
        return passColor;
    return material.ambient;
}

vec4 getDiffuseColor(Material material, vec4 passColor)
{
    if (material.vertexColorMode == ColorMode_AmbientAndDiffuse || material.vertexColorMode == ColorMode_Diffuse)
        return passColor;
    return material.diffuse;
}

vec4 getSpecularColor(Material material, vec4 passColor)
{
    if (material.vertexColorMode == ColorMode_Specular)
        return passColor;
    return material.specular;
}
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The core mechanism is correct and verified: vertexcolors.glsl:6-32 substitutes (does not modulate) the whole vec4 passColor for the named channel; the mode constants 0-5 match SceneUtil::VertexColorModes (material.hpp:18-25); passColor = gl_Color from a per-vertex Vec4Array (objects.vert:88/:103, nifloader.cpp:1642-1644); objects.frag:156-157 is quoted exactly; and ColorMode_Specular is indeed never selected by the NIF loader (nothing in the tree selects it at all). But consequences (a) and (b) are both stated as holding "with vertex colours present", and that is not the guard the code uses. Presence of vertex colours only sets the DEFAULT mode (nifloader.cpp:2737-2738); a NiVertexColorProperty then overrides it (nifloader.cpp:2784-2822): VertMode_SrcIgnore -> None, VertMode_SrcEmissive -> Emission, VertMode_SrcAmbDif + LightMode_Emissive -> None, VertMode_SrcAmbDif + LightMode_EmiAmbDif -> AmbientAndDiffuse. In the None and Emission cases a mesh that HAS vertex colours still takes material.diffuse, so the material's diffuse colour and its alpha (matprop->mAlpha) are fully preserved and vertex alpha does NOT win. Stating the consequence as conditional on vertex-colour presence rather than on the vertex colour MODE turns a conditional into an always-true and omits the guard that a porter most needs. Secondary inaccuracies: "vertex alpha wins outright" overstates objects.frag:157, where diffuseColor.a is only one multiplicand alongside the diffuse-map alpha already in gl_FragData[0].a, the separate `alpha` uniform (objects.frag:67), and actorFade; diffuse.a is also not exclusively NiMaterialProperty's mAlpha, since Material::setAlpha (material.hpp:88-95, used for BSLightingShaderProperty at nifloader.cpp:2857) writes the same value into all four channels' alpha; and the cited line number for setDiffuse is 2768 in this checkout, not 2599.

**Corrected form offered:** OpenMW does not modulate the material by the vertex colour; the vertex colour SUBSTITUTES for whichever material channel the VERTEX COLOUR MODE names. getDiffuseColor returns the whole passColor vec4 (RGB and A) when the mode is AmbientAndDiffuse or Diffuse, otherwise material.diffuse; getAmbientColor and getEmissionColor behave the same way for their modes (files/shaders/lib/material/vertexcolors.glsl:6-32). Consequences to reproduce: (a) WHEN THE MODE IS AmbientAndDiffuse OR Diffuse the material's diffuse colour is discarded, not tinted; (b) in those same modes the material's alpha is discarded too, because NiMaterialProperty's mAlpha is stored as diffuse.a (mat->setDiffuse(osg::Vec4f(matprop->mDiffuse, matprop->mAlpha)), nifloader.cpp:2768) and the fragment shader consumes it as gl_FragData[0].a *= diffuseColor.a * alpha * actorFade (objects.frag:156-157) - so vertex alpha replaces the material alpha there, though it is still multiplied against the diffuse-map alpha, the separate `alpha` uniform and actorFade rather than winning outright. Crucially, the mode is NOT simply "does the mesh have vertex colours". Vertex colours only set the default (AmbientAndDiffuse) at nifloader.cp


## 64. With no NiMaterialProperty the default is white diffuse + white ambient, and the material is attached only if it differs from default
- `components/nifosg/nifloader.cpp:2731-2934` - Materials and textures, importance **n/a**

applyDrawableProperties starts from a fresh SceneUtil::Material whose MaterialConfig defaults are diffuse (1,1,1,1), ambient (1,1,1,1), specular (0,0,0,0), emission (0,0,0,1), shininess 0, emissiveMult 1, specularStrength 1, vertexColorMode None (components/sceneutil/material.hpp:27-36), then explicitly re-sets diffuse and ambient to white with the comment 'NIF material defaults don't match OpenGL defaults'. The ONLY thing set before the property loop that is not the default is the colour mode: it is AmbientAndDiffuse when the geometry has a colour array and None when it does not - so a shape with vertex colours and NO NiMaterialProperty still gets a material, and its vertex colours drive both ambient and diffuse. Two guards run after the loop: if the geometry turned out to have no colour array, whatever mode was selected is undone by writing the corresponding channel to white and forcing mode None (:2907-2926) - i.e. a NiVertexColorProperty on a colourless mesh yields plain white, not black; and the material is only ATTACHED TO THE STATESET AT ALL if it has a controller or differs from a default-constructed Material (:2928-2934), so an untextured, unmaterialled, colourless shape carries no material state and inherits whatever is above it. Also note NiMaterialProperty's own fields per property.cpp:505-521: ambient and diffuse are only read when bethVersion < 26, emissiveMult only when bethVersion >= 22, and mAlpha is a single float that becomes diffuse.a (ambient/emissive/specular keep alpha 1).

```cpp
            // Specular lighting is enabled by default, but there's a quirk...
            bool specEnabled = true;
            osg::ref_ptr<SceneUtil::Material> mat(new SceneUtil::Material);
            mat->setVertexColorMode(
                hasVertexColors ? SceneUtil::VertexColorModes::AmbientAndDiffuse : SceneUtil::VertexColorModes::None);

            // NIF material defaults don't match OpenGL defaults
            mat->setDiffuse(osg::Vec4f(1, 1, 1, 1));
            mat->setAmbient(osg::Vec4f(1, 1, 1, 1));
...
            // If we're told to use vertex colors but there are none to use, use a default color instead.
            if (!hasVertexColors)
            {
                switch (mat->getVertexColorMode())
                {
                    case SceneUtil::VertexColorModes::Ambient:
                        mat->setAmbient(osg::Vec4f(1, 1, 1, 1));
                        break;
                    case SceneUtil::VertexColorModes::AmbientAndDiffuse:
                        mat->setAmbient(osg::Vec4f(1, 1, 1, 1));
                        mat->setDiffuse(osg::Vec4f(1, 1, 1, 1));
                        break;
                    case SceneUtil::VertexColorModes::Emission:
                        mat->setEmission(osg::Vec4f(1, 1, 1, 1));
                        break;
                    default:
                        break;
                }
                mat->setVertexColorMode(SceneUtil::VertexColorModes::None);
            }

            static const SceneUtil::Material defaultMat{};

            if (hasMatCtrl || *mat != defaultMat)
            {
                mat = shareAttribute(mat);
                node->getOrCreateStateSet()->setAttributeAndModes(mat, osg::StateAttribute::ON);
            }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule omits a guard that inverts its central claim. It asserts only "Two guards run after the loop" and cites :2907-2926 and :2928-2934, but there are two further blocks between the loop and :2907. The decisive one is nifloader.cpp:2899-2906: `if (lightmode == LightMode_Emissive) { diffuse = (0,0,0,diffuse.a()); mat->setDiffuse(diffuse); mat->setAmbient(osg::Vec4f()); }`. Trace a NiVertexColorProperty with VertMode_SrcAmbDif + LightMode_Emissive on a mesh with no colour array: inside the loop (2808-2812) the mode is forced to None and `lightmode` is latched to LightMode_Emissive; at 2899 ambient and diffuse RGB are zeroed to black; at 2907 the !hasVertexColors switch sees mode None, hits `default:`, and writes nothing back to white; at 2930 the material now differs from defaultMat so it IS attached, carrying black ambient and black diffuse. That directly refutes "a NiVertexColorProperty on a colourless mesh yields plain white, not black" — stated as always-true when it holds only while lightmode != LightMode_Emissive — and refutes the corollary that such a shape carries no material state and inherits from above. A second omitted block at 2891-2897 (`mVersion <= VER_MW || !specEnabled`) also runs after the loop and unconditionally stomps specular to (0,0,0,0), shininess to 0 and specularStrength to 1, so on Morrowind-era NIFs a NiMaterialProperty's mSpecular/mGlossiness never reach the stateset. Everything else in the rule checks out against the fetched sources: MaterialConfig defaults at material.hpp:27-36 are exactly as stated; the redundant white re-set of diffuse/ambient is real; the colour mode is indeed the only non-default material state set before the loop; Material::operator== (material.cpp:68-75) compares mVertexColorMode, so a vertex-coloured shape with no NiMaterialProperty does get a material attached with AmbientAndDiffuse; and the property.cpp:505-521 claims hold (mAmbient/mDiffuse read only when bethVersion < 26, mEmissiveMult only when bethVersion >= 22, mAlpha a single float becoming diffuse.a while setAmbient/setEmission/setSpecular each pass 1.f as alpha).

> Refuted on its premise, not by an override. The rule describes OpenMW's C++ NIF loader, and none of it exists in the codebase under review. Working directory is /home/user/project-dagger, a JavaScript 1:1 Daggerfall port on a hand-rolled WebGL2 renderer. Verified: (1) the claimed source components/nifosg/nifloader.cpp:2731-2934 does not exist, and there is no components/, nifosg/, or sceneutil/ directory anywhere; (2) the repo contains ZERO C++ sources - find for *.cpp/*.hpp/*.cc/*.h returns nothing; (3) grep across the whole tree including vendor/ for applyDrawableProperties, NiMaterialProperty, NiVertexColorProperty, SceneUtil, emissiveMult, vertexColorMode, bethVersion and openmw returns zero hits. vendor/ holds only dfu-books, dfu-quests, dfu-settings (Daggerfall Unity text data). The only "Morrowind" matches are a province name at /home/user/project-dagger/src/ui/provinceMap.js:93 and a font remark at /home/user/project-dagger/bible/10-UI/UI-Arc.md:339. The actual rendering model is incompatible with the rule rather than a variant of it: /home/user/project-dagger/src/render/characterMesh.js packs interleaved [pos.xyz, color.rgb, normal.xyz] per vertex and /home/user/project-dagger/src/render/renderer.js lights it in-shader against a scene ambient/sun/point model - no OSG state sets, no material objects, no inheritance from parent state, no NIF property loop, so there is no "attach only if it differs from a default-constructed Material" behaviour to override. The first-person framing has no counterpart either: per /home/user/project-dagger/src/combat/fpsWeapon.js:1-22 first-person view is classic 2D CIF sprite art and the voxel FP viewmodel is explicitly "ON ICE" as of a 2026-08-17 design pivot, so there is no first-person 3D player body carrying material state. Beast/werewolf and vampire handling (/home/user/project-dagger/src/characters/beasts.js, /home/user/project-dagger/src/characters/pieces/beastHead.js, /home/user/project-dagger/src/characters/paperdollPayload.js) drives paperdoll and sprite art, never mesh materials. IMPORTANT CAVEAT: I did not find a caller, subclass, or special case that contradicts the rule as a statement about real OpenMW - I found that OpenMW is not present in this session at all, so the rule is unverifiable here and must not be recorded as confirmed. If the intent was to audit the genuine OpenMW repository, it needs to be attached first; nothing in project-dagger can confirm or refute its NIF material defaults.

**Corrected form offered:** applyDrawableProperties starts from a fresh SceneUtil::Material whose MaterialConfig defaults are diffuse (1,1,1,1), ambient (1,1,1,1), specular (0,0,0,0), emission (0,0,0,1), shininess 0, emissiveMult 1, specularStrength 1, vertexColorMode None (components/sceneutil/material.hpp:27-36), then redundantly re-sets diffuse and ambient to white. The only non-default material state set before the property loop is the colour mode: AmbientAndDiffuse when the geometry has a colour array, None when it does not — so a shape with vertex colours and no NiMaterialProperty still gets a material whose vertex colours drive ambient and diffuse. FOUR things then run after the loop, not two. (1) :2891-2897 — if mVersion <= VER_MW or specular was disabled, specular is forced to (0,0,0,0), shininess to 0 and specularStrength to 1, discarding whatever a NiMaterialProperty or BSLightingShaderProperty set. (2) :2899-2906 — if a NiVertexColorProperty selected VertMode_SrcAmbDif with LightMode_Emissive, diffuse RGB is zeroed (alpha kept) and ambient is set to (0,0,0,0), i.e. genuinely black. (3) :2907-2926 — only if the geometry has no colour array, the channel matching the currently selected mode is writte


## 65. NiStencilProperty is really the winding/two-sided property; only DrawMode 3 disables culling
- `components/nifosg/nifloader.cpp:2490-2532` - Materials and textures, importance **n/a**

NiStencilProperty carries two separate things and the loader always acts on the first even when stencilling itself is off. mDrawMode (Default=0, CounterClockwise=1, Clockwise=2, Both=3, property.hpp:539-545) sets the OSG front-face winding and culling: mode 2 (Clockwise) -> FrontFace CLOCKWISE, everything else including Default and Both -> COUNTER_CLOCKWISE; then GL_CULL_FACE is turned OFF only for mode 3 (Both) and explicitly ON for every other mode. So two-sided rendering in a Morrowind NIF means exactly `NiStencilProperty.mDrawMode == 3`, and 'Default' is a synonym for CCW-with-backface-culling, not for two-sided. The actual stencil buffer state is applied only when mEnabled: function from mTestFunction (Never=0..Always=7 mapping straight onto GL), ref = mStencilRef, mask = mStencilMask, and the three actions (fail / z-fail / pass) from Keep=0, Zero=1, Replace=2, Increment=3, Decrement=4, Invert=5. Field layout differs by version (property.cpp:539-568): for NIF <= 20.0.0.5 the fields are read individually as separate values; for later versions they are packed into mFlags as enabled=bit0, fail=(>>1)&7, zfail=(>>4)&7, pass=(>>7)&7, drawMode=(>>10)&3, testFunc=(>>12)&7 - Morrowind (4.0.0.2) uses the individual-field form. One knock-on: any enabled stencil property anywhere sets the loader-wide mHasStencilProperty, which pushes non-alpha-sorted drawables into a TraversalOrderBin instead of the default bin (:2938-2939) - stencil meshes are drawn in traversal order.

```cpp
                case Nif::RC_NiStencilProperty:
                {
                    const Nif::NiStencilProperty* stencilprop = static_cast<const Nif::NiStencilProperty*>(property);

                    osg::ref_ptr<osg::FrontFace> frontFace = new osg::FrontFace;
                    using DrawMode = Nif::NiStencilProperty::DrawMode;
                    switch (stencilprop->mDrawMode)
                    {
                        case DrawMode::Clockwise:
                            frontFace->setMode(osg::FrontFace::CLOCKWISE);
                            break;
                        case DrawMode::Default:
                        case DrawMode::CounterClockwise:
                        case DrawMode::Both:
                        default:
                            frontFace->setMode(osg::FrontFace::COUNTER_CLOCKWISE);
                            break;
                    }
                    frontFace = shareAttribute(frontFace);

                    osg::StateSet* stateset = node->getOrCreateStateSet();
                    stateset->setAttribute(frontFace, osg::StateAttribute::ON);
                    if (stencilprop->mDrawMode == DrawMode::Both)
                        stateset->setMode(GL_CULL_FACE, osg::StateAttribute::OFF);
                    else
                        stateset->setMode(GL_CULL_FACE, osg::StateAttribute::ON);

                    if (stencilprop->mEnabled)
                    {
                        mHasStencilProperty = true;
                        osg::ref_ptr<osg::Stencil> stencil = new osg::Stencil;
                        stencil->setFunction(getStencilFunction(stencilprop->mTestFunction), stencilprop->mStencilRef,
                            stencilprop->mStencilMask);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule is a faithful reading of components/nifosg/nifloader.cpp:2490-2532 and components/nif/property.{hpp,cpp} in isolation — I verified the DrawMode switch, the CULL_FACE OFF-only-for-Both logic, the mEnabled gate, the enum values at property.hpp:519-545, and the version split at property.cpp:539-568 (VER_MW=0x04000002, VER_OB=0x14000005 at niffile.hpp:28-30, so Morrowind does take the individual-field branch). But two callers change the behaviour precisely on the first-person player body, which is the case the question asks about. (1) The TraversalOrderBin knock-on does not happen on the first-person body. apps/openmw/mwrender/npcanimation.cpp:418-433 (NpcAnimation::setRenderBin, called from :309 on every view-mode change) does, for VM_FirstPerson: mObjectRoot->getOrCreateStateSet()->setRenderBinDetails(RenderBin_FirstPerson /*12*/, "DepthClear", osg::StateSet::OVERRIDE_RENDERBIN_DETAILS). OVERRIDE_RENDERBIN_DETAILS suppresses every descendant stateset's bin details unless that descendant is PROTECTED. The loader's setBinTraversal (nifloader.cpp:2748, applied at :2938-2939) uses plain setRenderBinDetails(2, "TraversalOrderBin") with the default USE_RENDERBIN_DETAILS mode, so it is suppressed — stencil meshes on the FP body are drawn in bin 12 "DepthClear" together with everything else, not in traversal order. The loader's alpha SORT_BACK_TO_FRONT (nifloader.cpp:2317, 2747) is suppressed the same way. OpenMW's own code corroborates the semantics: components/sceneutil/extradata.cpp:33 and components/sceneutil/mwshadowtechnique.cpp:3472 deliberately use OVERRIDE_PROTECTED_RENDERBIN_DETAILS specifically so their bins survive an enclosing OVERRIDE. (2) "Default is a synonym for CCW-with-backface-culling" is not the effective state on the first-person left arm. components/sceneutil/attach.cpp:103-172: any attachment whose bone name contains "Left" gets trans->setScale(-1,1,1) plus a shared stateset carrying osg::FrontFace::CLOCKWISE, so the ambient winding under the mirrored left arm is CLOCKWISE. The FP left-arm body parts attach to exactly those bones — "Left Hand"/"Left Wrist"/"Left Forearm"/"Left Upper Arm" (npcanimation.cpp:249-256, reached via ActorAnimation::attach at actoranimation.cpp:89-105), and first person keeps precisely the Hand/Wrist/Forearm/Upperarm slots (npcanimation.cpp:886-889, 902-905). Because attach's stateset is setAttributeAndModes(frontFace, ON) and NOT marked OVERRIDE, a left-side part whose NIF carries a NiStencilProperty keeps the loader's node-level COUNTER_CLOCKWISE, which cancels the mirror's compensation and renders that  ...

**Corrected form offered:** The loader half is right: in components/nifosg/nifloader.cpp:2490-2532 mDrawMode is acted on unconditionally, with Clockwise(2) -> FrontFace CLOCKWISE and Default(0)/CounterClockwise(1)/Both(3) -> COUNTER_CLOCKWISE, then GL_CULL_FACE OFF only for Both(3) and ON otherwise; the osg::Stencil (function from mTestFunction, ref mStencilRef, mask mStencilMask, ops from mFailAction/mZFailAction/mPassAction) is applied only when mEnabled; and the version split in components/nif/property.cpp:539-568 is as described, with Morrowind (4.0.0.2 <= VER_OB 20.0.0.5) reading the fields individually. Within a Morrowind NIF, mDrawMode == Both is indeed the only route to two-sided rendering, and that does survive — no ancestor stateset marks GL_CULL_FACE with OVERRIDE. Two clauses must be qualified for the first-person player body: 1. The TraversalOrderBin claim does not apply there. NpcAnimation::setRenderBin (apps/openmw/mwrender/npcanimation.cpp:418-433, called from :309) puts RenderBin_FirstPerson (12) / "DepthClear" on mObjectRoot with osg::StateSet::OVERRIDE_RENDERBIN_DETAILS. Since the loader's setRenderBinDetails(2, "TraversalOrderBin") at nifloader.cpp:2748 is unprotected, it is discarded for 


## 66. NiVertexColorProperty picks the colour mode; LightMode_Emissive blacks out diffuse and ambient; Morrowind NIFs never get specular
- `components/nifosg/nifloader.cpp:2784-2905` - Materials and textures, importance **n/a**

NiVertexColorProperty has two enums (property.hpp:558-576): VertexMode SrcIgnore=0 / SrcEmissive=1 / SrcAmbDif=2, and LightMode Emissive=0 / EmiAmbDif=1. The loader maps SrcIgnore -> VertexColorModes::None (vertex colours dropped entirely), SrcEmissive -> Emission (vertex colour replaces the emissive term), and SrcAmbDif -> AmbientAndDiffuse UNLESS its LightMode is Emissive, in which case the mode is None. Then, separately, after the whole property loop, if the last-seen lightmode was LightMode_Emissive the material's diffuse RGB is forced to (0,0,0) keeping its alpha, and ambient is forced to the zero vector - i.e. the surface is lit ONLY by its emissive term. Careful with the scoping: `lightmode` is only updated inside the SrcAmbDif branch (:2805), so a SrcEmissive or SrcIgnore property leaves the running lightmode at its EmiAmbDif default and does not trigger the blackout. On version: for any NIF at or below VER_MW (0x04000002, components/nif/niffile.hpp:28) specular is unconditionally zeroed - specular colour (0,0,0,0), shininess 0, strength 1 - with the comment 'Morrowind has its support disabled'. So for a Morrowind-era mesh NiSpecularProperty and NiMaterialProperty's specular/glossiness fields are parsed and then thrown away; a port should not implement Morrowind specular at all.

```cpp
                    case Nif::RC_NiVertexColorProperty:
                    {
                        const Nif::NiVertexColorProperty* vertprop
                            = static_cast<const Nif::NiVertexColorProperty*>(property);

                        using VertexMode = Nif::NiVertexColorProperty::VertexMode;
                        switch (vertprop->mVertexMode)
                        {
                            case VertexMode::VertMode_SrcIgnore:
                            {
                                mat->setVertexColorMode(SceneUtil::VertexColorModes::None);
                                break;
                            }
                            case VertexMode::VertMode_SrcEmissive:
                            {
                                mat->setVertexColorMode(SceneUtil::VertexColorModes::Emission);
                                break;
                            }
                            case VertexMode::VertMode_SrcAmbDif:
                            {
                                lightmode = vertprop->mLightingMode;
                                using LightMode = Nif::NiVertexColorProperty::LightMode;
                                switch (lightmode)
                                {
                                    case LightMode::LightMode_Emissive:
                                    {
                                        mat->setVertexColorMode(SceneUtil::VertexColorModes::None);
                                        break;
                                    }
                                    case LightMode::LightMode_EmiAmbDif:
                                    default:
                                    {
                                        mat->setVertexColorMode(SceneUtil::VertexColorModes::Am
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule is accurate (verified against OpenMW master: components/nif/property.hpp:558-576 for both enums, components/nif/niffile.hpp:28 for VER_MW = 0x04000002, and components/nifosg/nifloader.cpp:2784-2905 for the mapping, the blackout and the specular zeroing). The specular half is if anything understated: nifloader.cpp:1118-1120 additionally skips any NiMaterialColorController whose mTargetColor is Specular when mVersion <= VER_MW, so nothing reintroduces specular for a Morrowind-era mesh and "a port should not implement Morrowind specular at all" holds. The scoping clause is where it overreaches. The rule correctly observes that `lightmode` is assigned only inside the SrcAmbDif branch (nifloader.cpp:2804; the only writes are the initialisation at :2750 and that one line), but then states as always-true something that is only conditional: "a SrcEmissive or SrcIgnore property leaves the running lightmode at its EmiAmbDif default and does not trigger the blackout." The code does not leave lightmode at its default — it simply does not touch it, so lightmode keeps whatever a previously-processed property latched. That is reachable, not hypothetical. collectDrawableProperties (nifloader.cpp:189-210) recurses through the whole ancestor chain first (`if (parent != nullptr) collectDrawableProperties(&parent->mNiNode, parent->mParent, out);`) and appends every NiVertexColorProperty it finds, root-first, before the drawable's own. So a parent NiNode carrying SrcAmbDif + LightMode_Emissive latches lightmode = Emissive, and a child NiTriShape carrying SrcIgnore or SrcEmissive then overrides only the vertex colour mode — the `if (lightmode == LightMode_Emissive)` test at :2899 still fires and the diffuse/ambient blackout still happens. The SrcEmissive case in particular yields a combination the rule denies: vertex colour mode Emission plus blacked-out diffuse and ambient, i.e. a surface lit solely by its vertex colours. A port implementing the rule as written would diverge from OpenMW on any mesh whose ancestor node carries a SrcAmbDif + Emissive vertex-colour property.

> The rule cannot be confirmed because its subject does not exist in the repository under review. The codebase at /home/user/project-dagger is "project-dagger", a JavaScript port of Daggerfall (data/logic translated from Daggerfall Unity, presentation on hand-rolled WebGL2) — not OpenMW. Specifics: (1) All three cited files are missing — components/nifosg/nifloader.cpp, components/nif/property.hpp, components/nif/niffile.hpp; there is no components/ directory at all. (2) The repository contains zero C++ files (find for *.cpp/*.hpp outside node_modules returns nothing). (3) Grep across the whole tree for NiVertexColorProperty, NiMaterialProperty, nifosg, VertexColorMode, lightmode, SrcAmbDif, SrcEmissive, AmbientAndDiffuse, VER_MW, and glossiness returns no hits; grep for "openmw" returns no hits. (4) There is no NIF pipeline: the 3D model format layer is /home/user/project-dagger/src/formats/arch3dFile.js, Daggerfall's ARCH3D.BSA format, which has no NiProperty concept. The renderer (/home/user/project-dagger/src/render/) contains renderer.js, characterMesh.js, skyRenderer.js and similar; the only two files mentioning "specular" anywhere are src/characters/pieces/draped.js and src/tools/paperdollViewer.js, neither related to NIF materials or a version gate. (5) The requested special cases do exist as subject matter but are wholly unrelated to the rule: first-person body and werewolf/beast-race code lives in src/combat/fpsWeapon.js, src/characters/rewrite/limb.js, src/characters/beasts.js and src/characters/pieces/beastHead.js, and none of it touches vertex-colour modes, emissive lightmodes, or specular version gating, because that machinery is absent. I therefore found no caller, override, subclass or special case that changes the described behaviour — but only because the described behaviour is not present here. Since the task's bar was to confirm only if the rule holds where it matters for a first-person player body, and nothing in this repository can establish that, this is a refutation on premise grounds. Note this is NOT a claim that the rule is factually wrong about upstream OpenMW; that codebase is simply not available here to check.

**Corrected form offered:** NiVertexColorProperty has two enums (components/nif/property.hpp:558-576): VertexMode SrcIgnore=0 / SrcEmissive=1 / SrcAmbDif=2, and LightMode Emissive=0 / EmiAmbDif=1. The loader maps SrcIgnore -> VertexColorModes::None, SrcEmissive -> Emission, and SrcAmbDif -> AmbientAndDiffuse UNLESS its LightMode is Emissive, in which case the mode is None. Separately, after the whole property loop, if `lightmode` holds LightMode_Emissive the material's diffuse RGB is forced to (0,0,0) keeping its alpha and ambient is forced to the zero vector, so the surface is lit only by its emissive term. Scoping: `lightmode` is initialised to EmiAmbDif before the loop (nifloader.cpp:2750) and written in exactly one place, inside the SrcAmbDif branch (:2804). A SrcEmissive or SrcIgnore property therefore does not reset lightmode — it leaves it untouched at whatever the last SrcAmbDif property set, or at the EmiAmbDif default only if no SrcAmbDif property has been seen yet. This matters because collectDrawableProperties (:189-210) accumulates properties from the entire ancestor chain, parents first, so a parent node's SrcAmbDif + LightMode_Emissive latches lightmode = Emissive and the blackout still fires e


---

# Part III - what the port still does not know

The completeness critic's answer to "what would a port still get wrong?",
verified against OpenMW checkouts rather than recalled. This is the
worklist for the next reading pass, and the reason no code has been
written yet.

I read the doc and then verified each suspected gap against the two OpenMW checkouts already on disk (`/home/user/openmw/openmw`, `/tmp/fpv/openmw`). Gaps below are in priority order; every citation was read, not recalled.

---

**1. Nothing anywhere tells the port how to EVALUATE a keyframe track. This is the single largest hole.**

Rules 1–18 and the whole fan-out cover which KF to load, which group to play, which text keys bound it, and how a posed vertex is skinned — and then stop. The step in the middle, "given a bone track and a time t, produce a rotation/translation/scale", is unread ground. Unread files: `components/nif/nifkey.hpp` (all 240 lines), `components/nifosg/controller.hpp:42-180`, `components/nifosg/controller.cpp:94-223`.

Specifics a port will get wrong by guessing: there are six interpolation types (`nifkey.hpp:17-24`), and `InterpolationType_Constant` is **not** hold-previous — it is `fraction > 0.5f ? b.mValue : a.mValue` (`controller.hpp:136-137`), so it flips at the midpoint. Quadratic and TCB share one cubic Hermite with the basis polynomials written out at `controller.hpp:139-154`. TCB tangents are baked at LOAD time from tension/continuity/bias into four coefficients `mA..mD` (`nifkey.hpp:165-169`) and then into `mInTan`/`mOutTan` by three different formulas for first key / interior / last key, with the interior ones scaled by `(key.mTime - prev.mTime)/timeSpan` and `(next.mTime - key.mTime)/timeSpan` (`nifkey.hpp:172-205`). Quaternions **never** take the Hermite path — always slerp — and TCB-for-quat is an explicit empty stub (`controller.hpp:157-172`, `nifkey.hpp:203-206`). XYZ rotation (type 4) is not read where it appears at all: `data.cpp` eats a float and re-runs the read three times as LINEAR float subtracks (`nifkey.hpp:104-111`), and evaluation composes three per-axis quats in one of **nine** axis orders (`controller.cpp:136-170`). Edge behaviour: `time <= keys.front().first` returns the first value verbatim, past-the-end returns `keys.back()`, equal-time keys return the low one (`controller.hpp:100-125`), and the reader deliberately does not sort or dedupe — the comment says so: *"Note: NetImmerse does NOT sort keys or remove duplicates"* (`nifkey.hpp:117`).

**2. What a MISSING channel does — and it is a first-person bug the engine names out loud.**

`components/nifosg/controller.cpp:179-200`:
```cpp
if (rotation) node->setRotation(*rotation);
else
{
    // This is necessary to prevent first person animations glitching out due to RotationController
    node->setRotation(node->mRotationScale);
}
if (translation) node->setTranslation(*translation);
if (scale) node->setScale(*scale);
```
Translation and scale are written only when the track has them; rotation is rewritten **every frame regardless**, to the NIF's original 3×3. `components/nifosg/matrixtransform.{hpp,cpp}` (unread, whole file) explains why: the node stores `float mScale` and `Nif::Matrix3 mRotationScale` alongside the 4×4 precisely because *"Decomposing the original components from the 4x4 matrix isn't possible, which causes problems when a KeyframeController wants to change only one of these components"*. `setRotation` writes `_matrix(i,j) = mRotationScale.mValues[j][i] * mScale`; `setTranslation` writes row 3 independently. A port that stores only a matrix per bone, or that skips the rotation write when a track has no rotation channel, reproduces exactly the FP neck glitch that comment was written to prevent — because the RotateController from the surviving first-person rules is what accumulates into it.

**3. An attack is THREE `play()` calls, and the weapon is not always drawn.**

The doc has attack text-key NAMES (rule 11) but not the sequence. `character.cpp:1705-1719` plays wind-up `<type> start` → `<type> max attack`; `:1763-1877` plays release `<type> max attack` → `<type> hit` (literally `" release"` instead of `" hit"` when `mAttackType == "shoot"`) with `startPoint = 1.f - mAttackStrength`, further scaled by `(minHitTime - maxAttackTime)/(hitTime - maxAttackTime)` when `maxAttackTime <= minHitTime < hitTime`; `:1794-1812` plays follow `<type> <small|medium|large> follow start` → `... follow stop`, buckets at 0.33/0.66, and the strength prefix is **omitted** for `"shoot"`. All three pass `weapSpeed` as the speed multiplier, which is the weapon record's own `mData.mSpeed` (`character.cpp:1298, 1326`) — the doc has no concept of per-weapon animation speed. Separately, `NpcAnimation::showWeapons(bool)` (`npcanimation.cpp:953-989`) is what creates and destroys the weapon mesh, driven off the `equip attach`/`unequip detach` keys gated on `mUpperBodyState` (`character.cpp:1074-1087`) — so a drawn weapon is a state, not a fact. And rule 11 records only `getBestAttack`; `character.cpp:1683-1691` shows that is behind `Settings::game().mBestAttack`, with `getMovementBasedAttackType()` as the other branch, unread.

**4. The equipment priority system — the thing that decides whether the arm you are drawing exists.**

`npcanimation.cpp:573-700`, entirely unread. A `slotlist[]` table with base priorities (Robe 11, Skirt 3, everything else 0), `prio = ((mBasePriority + 1) << 1) + (0 for Clothing, 1 for Armor)`, and `reserveIndividualPart` (`:744-757`) which claims a slot with **no mesh at all** — the part is then invisible, not replaced. A ROBE reserves `PRT_RForearm, PRT_LForearm, PRT_RUpperarm, PRT_LUpperarm` among others (`:637-641`), i.e. it deletes the very forearms and upper arms a first-person view is made of. Also: the naked-body fill loop is `for (int part = ESM::PRT_Neck; part < ESM::PRT_Count; ++part)` (`:682`) — `PRT_Head = 0, PRT_Hair = 1, PRT_Neck = 2` (`components/esm3/loadarmo.hpp`), so head and hair are excluded by the **loop bound**, not only by the `VM_FirstPerson` test at `:650`. Rule 7 is true but the doc does not say why.

**5. Actor scale — and first person is deliberately different.**

The doc never mentions scale. `apps/openmw/mwclass/npc.cpp:1102-1136`: it is rendering-only (`if (!rendering) return; // collision meshes are not scaled based on race height`). For the player in first person it applies race **height** uniformly to all three axes and returns early, with the comment *"Race weight should not affect 1st-person meshes, otherwise it will change hand proportions and can break aiming."* Third person instead applies weight to x/y and height to z — a **non-uniform** scale. `NpcAnimation::setViewMode` re-applies this on every view change, before `rebuild()` (`npcanimation.cpp:304-306`). A port that scales FP hands by weight, or that scales uniformly in third person, is visibly wrong.

**6. How to get a triangle out of the file.**

There are rules about skinning and materials but none about geometry. Unread: `components/nif/data.hpp:13-64` (`mNumVertices` is a **uint16**; `mUVList` is a vector-of-vectors; separate `mNormals/mTangents/mBitangents`) and `nifloader.cpp:1557-1640` — `NiTriShapeData` yields one TRIANGLES set from `mTriangles`; `NiTriStrips` yields one TRIANGLE_STRIP **per strip** with strips of size < 3 silently skipped (`:1613-1618`); and a skinned mesh with a partition uses `partition.mTrueTriangles`/`mTrueStrips` instead (`:1571-1592`). Winding, the has-normals/has-colors flags, and the skin-partition vertex remap are all unexamined.

**7. The container format itself.**

`components/nif/niffile.cpp:539-720`, unread. Header must start with `"NetImmerse File Format"` or `"Gamebryo File Format"`; then a BCD version and a chain of version-gated optional blocks (endianness ≥ 20.0.0.4, user version ≥ 10.0.1.8, record-type listing ≥ 5.0.0.1, record sizes ≥ 20.2.0.5, string table ≥ 20.1.0.1, groups ≥ 5.0.0.6, record separators in [10.0.0.0, 10.2.0.0)). An unknown record type is a **throw**, not a skip (`:674-676`). Root records come from a trailing index list (`:698-714`). And `nifstream.cpp:58-72`: sized strings are truncated at the first NUL and then run through the `ToUTF8` encoder — Morrowind node names are **Windows-1252**, not ASCII. Every bone-name and text-key comparison in every surviving rule depends on that decode, and it is nowhere recorded.

**8. Three different animation clocks on one actor.**

`npcanimation.cpp:857-867`: the head's internal controllers get `mHeadAnimationTime`, `PRT_Weapon` gets `mWeaponAnimationTime`, and **every other attached part** gets `mAnimationTimePtr[0]` — the LOWER-BODY winner's clock, not its own bone group's. `weaponanimation.cpp:25-49`: `mWeaponAnimationTime` returns `getCurrentTime(mWeaponGroup) - mStartTime`, and `mStartTime` is `getStartTime(group)` only when relative — which `character.cpp:943-945` sets true **only for Ranged** weapons, with a comment about mods rotating throwing projectiles. The doc has one clock.

**9. Ranged aim pitch, and its unresolved first-person form.**

`NpcAnimation::addControllers` attaches `WeaponAnimation::addControllers` only in `VM_Normal` (`npcanimation.cpp:947-950`), so the spine-pitch controllers are third-person only — yet `updateWeaponState` calls `setPitchFactor` unconditionally with a text-key-derived ramp (`character.cpp:1868-1893`: `(currentTime - startTime)/(minAttackTime - startTime)` during wind-up, `1 - complete` at attack end, `max(0, 1 - complete*10)` for crossbow). What the FP arm does with bow pitch instead is genuinely unanswered; needs `weaponanimation.cpp:130+` and `npcanimation.cpp:712-750`.

**10. Two OpenMW features that must NOT be ported, and are not flagged in the doc.**

`Settings::game().mSmoothAnimTransitions` gates `AnimBlendRules` (`animation.cpp:738-765, 1157-1170`, plus `components/sceneutil/animblendrules.cpp` and `files/data/animations/animation-config.yaml`) — vanilla is a hard cut. `Settings::game().mShieldSheathing` (`npcanimation.cpp:991-1013`) invents a `"Bip01 AttachShield"` bone Morrowind has no such thing as. Given this port's history, both belong in the doc as explicit do-not-implement entries, not as omissions.

**11. VFS lookup.** `components/vfs/pathutil.hpp:18-21` (`c == '\\' ? '/' : toLower(c)`, no leading separator, no duplicate separators) and `components/vfs/registerarchives.cpp` for BSA-vs-loose precedence. Rule 18 asks "does this KF exist in the VFS" and the port has no rule for answering it.

---

**Surviving rules I consider too vague to implement from:**

- **The skinning blend accumulation.** "Skipping every index where `i % 4 == 3` — i.e. the projective last column" is only unambiguous for a flat row-major `Float32Array`. Restate as: elements [0..2][0..2] and [3][0..2] are blended; [i][3] is never touched. As written, a port using nested arrays or a column-major library will skip the wrong four elements.
- **Rule 9's lower-body-only fallback.** The doc says it "is the whole difference between a wrong animation and no animation on the arms" without saying which. Per the surviving priority rule, a bone group with no winner gets **no controller attached at all** — so the arms hold whatever the last winner left, which is not bind pose. Write that consequence down; a port will otherwise assume bind pose.
- **Rule 10 overreaches.** `character.cpp:799-812` rolls the 2–5 dice only `if (!weapShortGroup.empty())`, and `ESM::Weapon::None`'s short group is `""` (`weapontype.cpp`, `Weapon<None>::getValue`). A first-person player with nothing drawn plays bare `idle` with `numLoops = UINT32_MAX` — forever. As written the rule reads as if FP idle always loops 2–5 times.
- **The stop-key truncation rule.** "truncated to `groupname.size()+2+stop.size()`" — C++ `compare(pos, len, ...)` is well-defined when the string is shorter; a naive JS `slice()` is not equivalent. The exact predicate is needed.
- **Rule 17's node existence test.** Not stated that the lookup is against `getNodeMap()`, case-insensitive, and that failure silently keeps `Weapon Bone` (`npcanimation.cpp:780-796`).
- **The first-person FOV rule** gives OpenMW's mechanism (`modelView * newProj * inverse(oldProj)`) but not what a WebGL port must do — second pass with its own projection, or the matrix trick — and the two are only equivalent if the depth clear also happens, which lives in a **disputed** rule (render bin 12).

---

# Part IV - the gap pass, stopped early and harvested honestly

MW-R5 (2026-08-29). Nine readers over the gaps Part III named, each pointed at
the exact files the critic cited, with the same three-lens adversarial
verification.

THE RUN WAS STOPPED PART-WAY, ON COST. All nine readers had finished, so the
extraction is complete - 63 rules - but only part of the verification had
returned. Rather than discard the run or quietly present everything as
verified, the rules are recorded in THREE TIERS by how much checking each
actually received. The tier is the rule's confidence and it is stated on
every entry.

    63 rules extracted by 9 readers (all complete)
     7 tier A - all three lenses, unanimous
    17 tier B - all three lenses, caveat recorded
    39 tier C - EXTRACTED BUT UNVERIFIED, the run stopped before their turn

TIER C IS NOT A SECOND-CLASS TIER A. It is the state the whole first arc
shipped in: read once, written down, never challenged. Where a tier C rule is
load-bearing it must be verified before code depends on it. The two
verification passes that have run refuted nothing outright but attached a
caveat to well over half of what they touched, so the base rate says roughly
half of these 39 need a condition they do not yet carry.

# Tier A - all three lenses, unanimous

## [A] Exact index order: setScale and setRotation(Matrix3) both write _matrix(i,j) = mRotationScale.mValues[j][i] * mScale (a TRANSPOSE); setRotation(Quat) reads the 3x3 back out before scaling; setTranslation touches only the translation row
- `components/nifosg/matrixtransform.cpp:19-73` - importance **critical**

All four mutators rebuild from the cached components and each ends with `_inverseDirty = true; dirtyBound();`. OSG's operator()(row,col) is _mat[row][col] and OSG is ROW-VECTOR (p' = p*M), so translation lives in ROW 3 (_mat[3][0..2]). Nif::Matrix3::mValues is [row][col] as read from the file. (1) setScale(float s): sets mScale = s, then `for i in 0..2, for j in 0..2: _matrix(i,j) = mRotationScale.mValues[j][i] * mScale;` — index order is [j][i], i.e. the OSG 3x3 block is the TRANSPOSE of the NIF 3x3, uniformly scaled. Rows 3 and column 3 are never touched, so translation survives. (2) setRotation(const Nif::Matrix3& r): sets mRotationScale = r, then runs the IDENTICAL [j][i] * mScale loop — the previously stored mScale is reapplied, so a rotation-only update never loses scale. (3) setRotation(const osg::Quat& q): first `_matrix.setRotate(q)` (OSG writes ONLY _mat[0..2][0..2], leaving the translation row intact — Matrix_implementation.cpp:67-135; note a zero-length quat writes an ALL-ZERO 3x3 there, not identity), then one combined loop `for i, for j: mRotationScale.mValues[j][i] = float(_matrix(i,j)); _matrix(i,j) *= mScale;` — the unscaled quaternion matrix is harvested INTO the cache (again transposed, [j][i]) and only then is mScale multiplied in place. (4) setTranslation(const osg::Vec3f& t): `_matrix.setTrans(translation);` only — writes _mat[3][0..2], leaves the 3x3 and both cached members alone; the source comment is 'The translation is independent from the rotation and scale so we can apply it directly.' COLUMN-VECTOR PORT (three.js / gl-matrix, m[col*4+row]): because the OSG store is the transpose, all of this collapses to standard math — keep R = mRotationScale indexed [row][col] and s = mScale, and after any of setScale/setRotation write upper3x3[row][col] = R[row][col] * s while leaving the translation column untouched; for the quaternion overload set R = quatToMat3(q) in ordinary [row][col] form first, then apply s. The effective local transform is p_parent = s * R * p_local + t.

```cpp
    void MatrixTransform::setScale(float scale)
    {
        // Update the decomposed scale.
        mScale = scale;

        // Rescale the node using the known components.
        for (int i = 0; i < 3; ++i)
            for (int j = 0; j < 3; ++j)
                _matrix(i, j) = mRotationScale.mValues[j][i] * mScale; // NB: column/row major difference
...
    void MatrixTransform::setRotation(const osg::Quat& rotation)
    {
        // First override the rotation ignoring the scale.
        _matrix.setRotate(rotation);

        for (int i = 0; i < 3; ++i)
        {
            for (int j = 0; j < 3; ++j)
            {
                // Update the current decomposed rotation and restore the known scale.
                mRotationScale.mValues[j][i] = static_cast<float>(_matrix(i, j)); // NB: column/row major difference
                _matrix(i, j) *= mScale;
            }
        }
...
    void MatrixTransform::setTranslation(const osg::Vec3f& translation)
    {
        // The translation is independent from the rotation and scale so we can apply it directly.
        _matrix.setTrans(translation);
```

## [A] What breaks in first person with a 4x4-only port: RotateController writes the matrix but NEVER the cached components, so without the every-frame mRotationScale reset the neck pitch compounds without bound
- `apps/openmw/mwrender/rotatecontroller.hpp:15-17` - importance **critical**
- REFINES OR CORRECTS RECORDED RULE 31

MWRender::RotateController is a node callback appended AFTER the keyframe callback on the same node (Animation::resetActiveGroups adds the keyframe/blend callback at animation.cpp:1174 and only then calls addControllers() at :1194; animblendcontroller.cpp:323 confirms the ordering with '(if it appears after this callback)'). Each update it does `osg::Matrix matrix = node->getMatrix(); ... orient = worldOrient * mRotate * worldOrientInverse * matrix.getRotate(); matrix.setRotate(orient); matrix.setTrans(matrix.getTrans() + worldOrientInverse * mOffset); node->setMatrix(matrix);` — it goes through raw setMatrix, so NEITHER mRotationScale NOR mScale is updated. Its own header states the contract it depends on: 'Assumes that the node being rotated has its "original" orientation set every frame by a different controller. The rotation is then applied on top of that orientation.' The KeyframeController's unconditional `node->setRotation(node->mRotationScale)` IS that reset, and it works precisely because mRotationScale is a clean copy that RotateController's setMatrix could not dirty. A port that stores only a 4x4 per bone has nowhere clean to reset from, so on any first-person animation whose neck track carries no rotation keys the pitch quaternion is re-multiplied onto the already-pitched matrix every frame: the head/neck spins away and the first-person camera (which is a node of the rig) goes with it. The engine names this failure twice: 'This is necessary to prevent first person animations glitching out due to RotationController' (controller.cpp:189) and, at the neck controller's creation site, 'If there is no active animation, then the bip01 neck node will not be updated each frame, and the RotateController will accumulate rotations' (npcanimation.cpp:933-934) — which is why the neck RotateController is only created when mViewMode == VM_FirstPerson AND mStates.size() > 0. Animation::addRotateController applies the same guard generally (animation.cpp:1945-1974): it walks the node's update-callback chain for a NifAnimBlendController, BoneAnimBlendController or SceneUtil::KeyframeController and returns nullptr if none is found — 'Without KeyframeController the orientation will not be reseted each frame, so RotateController shouldn't be used for such nodes.' NOTE THE ASYMMETRY: there is no equivalent else-branch for translation, so RotateController's `+= worldOrientInverse * mOffset` is undone only by a track that actually has translation keys — the first-person sneak offset (npcanimation.cpp:712-724, setOffset(mFirstPersonOffset)) relies on that, and NifAnimBlendController has to subtract the offset explicitly at blend start to stop it being applied twice.

```cpp
    /// Applies a rotation in \a relativeTo's space.
    /// @note Assumes that the node being rotated has its "original" orientation set every frame by a different
    /// controller. The rotation is then applied on top of that orientation.

// apps/openmw/mwrender/npcanimation.cpp:931-945
        if (mViewMode == VM_FirstPerson)
        {
            // If there is no active animation, then the bip01 neck node will not be updated each frame, and the
            // RotateController will accumulate rotations.
            if (mStates.size() > 0)
            {
                NodeMap::iterator found = mNodeMap.find("bip01 neck");

// apps/openmw/mwrender/animation.cpp:1964-1968
        // Note: AnimBlendController also does the reset so if one is present - we should add the rotation node
        // Without KeyframeController the orientation will not be reseted each frame, so
        // RotateController shouldn't be used for such nodes.
        if (!foundKeyframeCtrl)
            return nullptr;
```

## [A] Which channels exist is decided per-track at CONSTRUCTION, and the six interpolators are independent - there is no combined 'has keys' flag
- `components/nifosg/controller.cpp:100-177` - importance **high**

KeyframeController holds six independent interpolators (controller.hpp:255-262): QuaternionInterpolator mRotations; FloatInterpolator mXRotations, mYRotations, mZRotations; Vec3Interpolator mTranslations; FloatInterpolator mScales; plus Nif::NiKeyframeData::AxisOrder mAxisOrder defaulting to Order_XYZ. Two construction paths. (a) NiTransformInterpolator with non-empty mData: all six are built from interp->mData (mRotations/mTranslations/mScales additionally carry defaultTransform.mRotation / .mTranslation / .mScale as their default value) and mAxisOrder = interp->mData->mAxisOrder. (b) NiTransformInterpolator with EMPTY mData: mXRotations/mYRotations/mZRotations are left default-constructed (permanently empty) and mRotations/mTranslations/mScales are built from NULL key-map pointers carrying only the default value — which, per the empty() gate in getCurrentTransformation, means the controller writes NOTHING but the mRotationScale rotation reset. (c) Plain NiKeyframeData (the Morrowind path): all six from keydata, with mScales given a default of 1.f, and mAxisOrder = keydata->mAxisOrder. A channel is 'missing' iff `!mKeys || mKeys->mKeys.empty()`. Because the three axis floats are separate, a track can supply, say, only Z rotation: getXYZRotation then takes xrot = yrot = 0 and composes osg::Quat(xrot, X_AXIS) * osg::Quat(yrot, Y_AXIS) * osg::Quat(zrot, Z_AXIS) in mAxisOrder — nine orders are handled (XYZ, XZY, YZX, YXZ, ZXY, ZYX, XYX, YZY, ZXZ) and anything else falls through to xr*yr*zr. Operand order in those products is left-to-right as written and is NOT commutative. Separately, KeyframeController::getTranslation(float) — the accumulation-root query used for root motion — returns mTranslations.interpKey(time) when non-empty and osg::Vec3f() (0,0,0) otherwise, so a missing translation track reports zero root motion rather than the interpolator's default value.

```cpp
                    mRotations = QuaternionInterpolator(interp->mData->mRotations, defaultTransform.mRotation);
                    mXRotations = FloatInterpolator(interp->mData->mXRotations);
                    mYRotations = FloatInterpolator(interp->mData->mYRotations);
                    mZRotations = FloatInterpolator(interp->mData->mZRotations);
                    mTranslations = Vec3Interpolator(interp->mData->mTranslations, defaultTransform.mTranslation);
                    mScales = FloatInterpolator(interp->mData->mScales, defaultTransform.mScale);

                    mAxisOrder = interp->mData->mAxisOrder;
...
            mScales = FloatInterpolator(keydata->mScales, 1.f);
...
    osg::Vec3f KeyframeController::getTranslation(float time) const
    {
        if (!mTranslations.empty())
            return mTranslations.interpKey(time);
        return osg::Vec3f();
    }
```

## [A] TCB: tension/continuity/bias collapse to mA..mD per key at read, then three DIFFERENT tangent formulas for first / interior / last
- `components/nif/nifkey.hpp:34-45, 153-214` - importance **critical**

TCB is fully baked at LOAD time into the same mInTan/mOutTan the Quadratic path uses; nothing TCB-specific survives to evaluation.
STEP 1, per key while reading (nifkey.hpp:153-169) — after reading time, value, then three floats tension t, continuity c, bias b in that order:
  mA = (1-t)*(1-c)*(1+b)
  mB = (1-t)*(1+c)*(1-b)
  mC = (1-t)*(1+c)*(1+b)
  mD = (1-t)*(1-c)*(1-b)
Note the pattern: A = (1-c)(1+b), B = (1+c)(1-b), C = (1+c)(1+b), D = (1-c)(1-b). There is no 0.5 factor at this stage.
STEP 2, once the whole group is read, generateTCBTangents over the vector (nifkey.hpp:171-204), with n = number of keys:
  - If n <= 1: return immediately. Every tangent stays at its default (0 for float/Vec3/Vec4). A lone TCB key therefore has zero tangents.
  - FIRST key (index 0), NO time scaling: delta = value[1] - value[0];
      inTan[0]  = delta * ((A0 + B0) * 0.5)
      outTan[0] = delta * ((C0 + D0) * 0.5)
  - INTERIOR keys i = 1 .. n-2: timeSpan = time[i+1] - time[i-1]; if timeSpan == 0.0f EXACTLY then `continue` — that key is skipped and BOTH its tangents remain zero. Otherwise prevDelta = value[i] - value[i-1], nextDelta = value[i+1] - value[i], and
      inTan[i]  = (prevDelta*A_i + nextDelta*B_i) * ((time[i]   - time[i-1]) / timeSpan)
      outTan[i] = (prevDelta*C_i + nextDelta*D_i) * ((time[i+1] - time[i])   / timeSpan)
    i.e. the in tangent is scaled by the fraction of the two-segment span that lies BEFORE the key, the out tangent by the fraction that lies after.
  - LAST key (index n-1), NO time scaling, and note the delta is BACKWARD: delta = value[n-1] - value[n-2];
      inTan[n-1]  = delta * ((A + B) * 0.5)
      outTan[n-1] = delta * ((C + D) * 0.5)
  - With n == 2 both keys use the same delta = value[1] - value[0], but each with its own key's A..D coefficients.
STEP 3: mA..mD are scratch — they live only on the temporary TCBKey vector and are dropped when the keys are moved into the runtime KeyT (nifkey.hpp:102-104); only mInTan/mOutTan survive.
Two overloads are deliberate empty stubs and generate NOTHING: std::vector<TCBKey<bool>> (nifkey.hpp:206-209) and std::vector<TCBKey<osg::Quat>> (nifkey.hpp:211-214, "TODO: implement TCB interpolation for quaternions"). TCB bool and TCB quaternion keys therefore keep default tangents forever.

```cpp
value.mA = (1.f - tension) * (1.f - continuity) * (1.f + bias);
value.mB = (1.f - tension) * (1.f + continuity) * (1.f - bias);
value.mC = (1.f - tension) * (1.f + continuity) * (1.f + bias);
value.mD = (1.f - tension) * (1.f - continuity) * (1.f - bias);
...
key.mInTan = (prevDelta * key.mA + nextDelta * key.mB) * ((key.mTime - prev.mTime) / timeSpan);
key.mOutTan = (prevDelta * key.mC + nextDelta * key.mD) * ((next.mTime - key.mTime) / timeSpan);
```

## [A] XYZ rotation (type 4): a uint32 axis order plus three separate float key groups, composed in OSG's REVERSED quaternion product
- `components/nifosg/controller.cpp:136-170, 202-223 (with components/nif/data.cpp:534-553 and components/nif/data.hpp:332-345)` - importance **critical**
- REFINES OR CORRECTS RECORDED RULE Refines the unnumbered gap note at Morrowind-Rules.md:2638, which says data.cpp "eats a float" for XYZ tracks (repeating the stale nifkey.hpp comment) and that the three sub-tracks are LINEAR: data.cpp:541 reads a uint32 AxisOrder gated on version <= 10.1.0.0, and each sub-track carries its own interpolation type.

PARSING (NiKeyframeData::read, data.cpp:534-553). The quaternion rotation group is read first. If its interpolation type came back as 4 (XYZ) then, and only then:
  - if file version <= 10.1.0.0 (every Morrowind NIF is 4.0.0.2, so always for Morrowind) read ONE uint32 and cast it to AxisOrder: `mAxisOrder = static_cast<AxisOrder>(nif->get<uint32_t>());`. It is a uint32 axis-order enum, NOT a float to be discarded — the in-source comment at nifkey.hpp:106-113 ("Eats a floating point number") is STALE and must not be ported. For version > 10.1.0.0 no field is read and mAxisOrder stays Order_XYZ.
  - then three COMPLETE float key groups are read back-to-back in the order X, Y, Z, each with its own uint32 count and its own uint32 interpolation type (usually Linear, but any type is legal and each sub-track is evaluated by its own rule, including the zero-count early-out).
  - only then come the translation (Vec3) and scale (float) groups.
The quaternion group itself ends with count > 0 and ZERO keys, so its interpolator reports empty — and that is precisely the selector at evaluation time (controller.cpp:210-213): `if (!mRotations.empty()) rotation = mRotations.interpKey(time); else if (!mXRotations.empty() || !mYRotations.empty() || !mZRotations.empty()) rotation = getXYZRotation(time);`. If all three are empty too, NO rotation is emitted at all.
EVALUATION (KeyframeController::getXYZRotation, controller.cpp:136-170): xrot = yrot = zrot = 0; each angle is sampled only if its own sub-track is non-empty (a missing axis contributes 0, i.e. identity). Build xr = quat(angle xrot about (1,0,0)), yr about (0,1,0), zr about (0,0,1); angles are RADIANS and the constructor is the half-angle form (xyz = axis*sin(angle/2), w = cos(angle/2)).
The nine AxisOrder values (data.hpp:332-343, uint32) and their OSG products:
  0 Order_XYZ -> xr*yr*zr    1 Order_XZY -> xr*zr*yr    2 Order_YZX -> yr*zr*xr
  3 Order_YXZ -> yr*xr*zr    4 Order_ZXY -> zr*xr*yr    5 Order_ZYX -> zr*yr*xr
  6 Order_XYX -> xr*yr*xr    7 Order_YZY -> yr*zr*yr    8 Order_ZXZ -> zr*xr*zr
Any other value falls through to the trailing `return xr * yr * zr;`. For orders 6/7/8 the repeated axis uses the SAME sampled angle twice — there is no second X/Y/Z track.
OPERAND ORDER IS THE TRAP: osg::Quat::operator* is REVERSED relative to the standard Hamilton product — OSG's `A * B` computes Hamilton(B x A) (include/osg/Quat:208-214, where the returned x is `rhs.w*self.x + rhs.x*self.w + rhs.y*self.z - rhs.z*self.y`), while OSG applies a quat to a vector with the ordinary v + 2w(q x v) + 2(q x (q x v)) active rotation. So OSG's `xr*yr*zr` means "rotate about X first, then Y, then Z", and in a Hamilton-convention library (three.js, gl-matrix) the identical rotation is written qz.multiply(qy).multiply(qx) — reverse the listed order. Orders 6/7/8 are palindromes, so their written order is unchanged under reversal; orders 0-5 must all be reversed.

```cpp
osg::Quat xr(xrot, osg::X_AXIS);
osg::Quat yr(yrot, osg::Y_AXIS);
osg::Quat zr(zrot, osg::Z_AXIS);
switch (mAxisOrder)
{
    case Nif::NiKeyframeData::AxisOrder::Order_XYZ:
        return xr * yr * zr;
...
// data.cpp:538-547
if (mRotations->mInterpolationType == InterpolationType_XYZ)
{
    if (nif->getVersion() <= NIFStream::generateVersion(10, 1, 0, 0))
        mAxisOrder = static_cast<AxisOrder>(nif->get<uint32_t>());
    mXRotations = std::make_shared<FloatKeyMap>();
```

## [A] The naked-body fill loop runs PRT_Neck(2)..PRT_Count(27) only where priority == 0; head and hair are excluded THREE times over
- `apps/openmw/mwrender/npcanimation.cpp:680-690` - importance **high**
- REFINES OR CORRECTS RECORDED RULE 7

The final fill is `for (int part = ESM::PRT_Neck; part < ESM::PRT_Count; ++part) if (mPartPriorities[part] < 1) if (const ESM::BodyPart* bodypart = parts[part]) addOrReplaceIndividualPart((ESM::PartReferenceType)part, -1, 1, correctMeshPath(bodypart->mModel.getNormalized()));`. Bounds: PRT_Neck == 2, PRT_Count == 27, so indices 2..26 inclusive. Condition `< 1` means exactly 0, i.e. untouched — any reservation (>= 1) skips it. Group is -1 (owned by nobody, so removePartGroup can never clear it) and priority is 1 (the floor). `parts` is `getBodyParts(race, !mNpc->isMale(), mViewMode == VM_FirstPerson, isWerewolf)`, which does `parts.resize(ESM::PRT_Count, nullptr)` and returns immediately (all-null) when werewolf, so a werewolf gets no fill at all. HEAD AND HAIR ARE EXCLUDED BY THREE INDEPENDENT MECHANISMS: (1) the loop bound — it starts at PRT_Neck == 2, so PRT_Head(0) and PRT_Hair(1) are never visited, in ANY view mode; (2) the data — sBodyPartMap (npcanimation.cpp:1187-1197) contains no MP_Head and no MP_Hair entry, so parts[0] and parts[1] are permanently nullptr even though ESM::BodyPart::MP_Head == 0 and MP_Hair == 1 exist in the record enum; (3) the view test — head and hair come from a separate earlier block, `if (mViewMode != VM_FirstPerson) { if (mPartPriorities[PRT_Head] < 1 && !mHeadModel.empty()) addOrReplaceIndividualPart(PRT_Head, -1, 1, mHeadModel); ... }` at :650-656, sourced from mHeadModel/mHairModel (the NPC record's own head/hair body part, vampire-overridden at :472-498), NOT from the race table. Note PRT_Shield(10) and PRT_Weapon(25) fall inside the loop range but also have no sBodyPartMap entry, so they are likewise always nullptr there. REFINEMENT OF RULE 7: rule 7 says 'in first person only head and hair are suppressed' and 'everything else in the race's table is present'. Both halves need qualifying — head and hair are not in the race's table at all (they are a separate model pair), and equipment can and does suppress other parts in first person: a robe deletes both forearms and both upper arms via the reservation at priority 24, in every view mode including first person.

```cpp
const std::vector<const ESM::BodyPart*>& parts
    = getBodyParts(race, !mNpc->isMale(), mViewMode == VM_FirstPerson, isWerewolf);
for (int part = ESM::PRT_Neck; part < ESM::PRT_Count; ++part)
{
    if (mPartPriorities[part] < 1)
    {
        if (const ESM::BodyPart* bodypart = parts[part])
            addOrReplaceIndividualPart(static_cast<ESM::PartReferenceType>(part), -1, 1,
                Misc::ResourceHelpers::correctMeshPath(bodypart->mModel.getNormalized()));
    }
}
```

## [A] The follow section has small/medium/large buckets at 0.33 and 0.66 — and the bucket prefix is OMITTED entirely when mAttackType == "shoot"
- `apps/openmw/mwmechanics/character.cpp:1792-1816` - importance **high**

The third play() call of the attack triad (character.cpp:1795-1812) builds its start/stop action names in two steps.

Step 1, the base: start = "follow start", stop = "follow stop".
Step 2, the bucket, applied ONLY when mAttackType != "shoot":
  strength = (mAttackStrength < 0.33f) ? "small" : (mAttackStrength < 0.66f) ? "medium" : "large"
  start = strength + " " + start;  stop = strength + " " + stop;
Step 3, unconditional: the keys passed to play() are mAttackType + " " + start and mAttackType + " " + stop.

So the resolved text keys are:
- Melee (chop/slash/thrust): "<group>: <type> <bucket> follow start" .. "<group>: <type> <bucket> follow stop", e.g. "weapononehand: chop large follow start".
- Ranged AND thrown (mAttackType == "shoot"): "<group>: shoot follow start" .. "<group>: shoot follow stop" — NO small/medium/large token at all. Do not synthesise one.

Thresholds are half-open, tested with strict less-than against float literals 0.33f and 0.66f, on the raw mAttackStrength (a [0,1] float):
  [0, 0.33)   -> "small"
  [0.33, 0.66)-> "medium"
  [0.66, 1]   -> "large"
Ties land in the HIGHER bucket: exactly 0.33 is medium, exactly 0.66 is large. A missed melee swing (mAttackStrength forced to 0) therefore always plays the "small" follow.

This call passes startpoint 0.0f, loops 0, speedmult weapSpeed, and is preceded by mReadyToHit = false (:1807) and, if the group is still playing, mAnimation->disable(mCurrentWeapon) (:1809-1810). It sets mUpperBodyState = AttackEnd.

```cpp
1795:  std::string start = "follow start";
1796:  std::string stop = "follow stop";
1797:
1798:  if (mAttackType != "shoot")
1799:  {
1800:      std::string strength = mAttackStrength < 0.33f ? "small"
1801:          : mAttackStrength < 0.66f                  ? "medium"
1802:                                                     : "large";
1803:      start = strength + ' ' + start;
1804:      stop = strength + ' ' + stop;
1805:  }
```

---

# Tier B - all three lenses, caveat recorded

## [B] A KeyframeController with NO rotation track rewrites the rotation EVERY frame from the node's own mRotationScale; a missing translation or scale writes NOTHING
- `components/nifosg/controller.cpp:179-223` - importance **critical**

NifOsg::KeyframeController::operator()(MatrixTransform* node, NodeVisitor* nv) does exactly four things, in this order. (1) It calls getCurrentTransformation(nv), which returns a KfTransform of three std::optional fields {mTranslation, mRotation, mScale} (components/sceneutil/keyframe.hpp:27-32), ALL THREE default to nullopt. (2) ROTATION IS UNCONDITIONAL: `if (rotation) node->setRotation(*rotation); else node->setRotation(node->mRotationScale);` — when the track has no rotation data the engine writes the node's OWN currently-stored decomposed 3x3 straight back into the 4x4. This runs every single frame, for every animated node, forever; it is never skipped. (3) TRANSLATION IS CONDITIONAL WITH NO ELSE: `if (translation) node->setTranslation(*translation);` — a track without translation keys leaves the matrix's translation untouched from the previous frame. (4) SCALE IS CONDITIONAL WITH NO ELSE: `if (scale) node->setScale(*scale);`. Then traverse(node, nv). WHEN IS EACH OPTIONAL SET (controller.cpp:202-223): only inside `if (hasInput())` — a controller with no input source leaves all three nullopt, so the rotation reset still fires. mRotation is set from mRotations.interpKey(time) when the quaternion track is non-empty; ELSE IF any one of mXRotations/mYRotations/mZRotations is non-empty it is set from getXYZRotation(time) (per-axis floats composed in mAxisOrder, default Order_XYZ = xr*yr*zr, controller.cpp:136-170); otherwise it stays nullopt. mTranslation is set iff mTranslations is non-empty; mScale iff mScales is non-empty. empty() is `!mKeys || mKeys->mKeys.empty()` (controller.hpp:131). EDGE CASE THAT BITES: the interpolators are constructed WITH default values taken from NiTransformInterpolator::mDefaultValue (controller.cpp:105-119) and with 1.f for NiKeyframeData scales (controller.cpp:130), but because getCurrentTransformation gates on empty() and never calls interpKey on an empty track, those defaults are DEAD for playback — an empty channel means 'do not write', not 'write the default'. Port shape: per frame, always write rotation (from the track, or from the node's stored rotation); write translation/scale only when their key lists are non-empty.

```cpp
    void KeyframeController::operator()(NifOsg::MatrixTransform* node, osg::NodeVisitor* nv)
    {
        auto [translation, rotation, scale] = getCurrentTransformation(nv);

        if (rotation)
        {
            node->setRotation(*rotation);
        }
        else
        {
            // This is necessary to prevent first person animations glitching out due to RotationController
            node->setRotation(node->mRotationScale);
        }

        if (translation)
            node->setTranslation(*translation);

        if (scale)
            node->setScale(*scale);

        traverse(node, nv);
    }
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> Almost every claim verifies line-for-line, but the rule states as always-true something that is conditional, and mis-describes the matrix write in the else branch. VERIFIED CORRECT (against /home/user/openmw/openmw): the four-step body and order; rotation unconditional with `else node->setRotation(node->mRotationScale)`; translation and scale conditional with no else; the `if (hasInput())` gate at controller.cpp:206 (hasInput() == `mSource.get() != nullptr`, sceneutil/controller.cpp:17-20), so a source-less controller leaves all three nullopt and the rotation reset still fires; quaternion-track-then-else-if-any-per-axis; mTranslation/mScale set iff their tracks are non-empty; `empty()` == `!mKeys || mKeys->mKeys.empty()` at controller.hpp:131; mAxisOrder default Order_XYZ = xr*yr*zr (controller.hpp:264, nif/data.hpp:345); KfTransform's three optionals all defaulting to nullopt at keyframe.hpp:27-32. The dead-defaults edge case is also right: interpKey does return mDefaultVal on an empty track (controller.hpp:101-102), but every call site gates on empty() first, so the defaults installed at controller.cpp:105-119 and :130 are never read during playback. All cited line numbers are exact. REFUTED ON: "This runs every single frame, for every animated node, forever; it is never skipped." (1) Even at default settings this is false. Animation::resetActiveGroups (apps/openmw/mwrender/animation.cpp:1110-1176) calls node->removeUpdateCallback for every entry in mActiveControllers (line 1116) whenever active groups change, then re-adds callbacks (line 1174) only for the single highest-priority active state per blend mask. A node whose AnimSource is not the active state has no callback attached; when no state is active for a mask (`active == mStates.end()`), nothing is added at all and the rotation reset never fires. The write is per-active-controller, not "for every animated node, forever." (2) With `smooth animation transitions` enabled (a shipped setting, files/settings-default.cfg:308, default false), animation.cpp:1162-1164 installs NifAnimBlendController INSTEAD of the KeyframeController for NifOsg::MatrixTransform nodes: handleBlendTransform returns the blend controller on that branch (animation.cpp:1107) and only returns keyframeController->getAsCallback() on the osgAnimation::Bone branch (animation.cpp:1104). NifOsg::KeyframeController::operator() then never ru ...


## [B] The node keeps float mScale and Nif::Matrix3 mRotationScale beside the 4x4 because a 4x4 CANNOT be decomposed back into NIF components - the engine calls this a 'Hack'
- `components/nifosg/matrixtransform.hpp:20-34` - importance **critical**

NifOsg::MatrixTransform derives from osg::MatrixTransform and adds exactly two extra members, both PUBLIC: `float mScale{ 0.f };` and `Nif::Matrix3 mRotationScale;` (a plain float[3][3], row-major as stored in the file, identity by default - components/nif/niftypes.hpp:36-45). The header states the reason verbatim as a 'Hack': a NIF transform is (3x3 rotationScale, float scale, vec3 position), the 3x3 may itself already carry non-uniform or negative scale (niftypes.hpp:70), and once the three are multiplied into one 4x4 there is no way to recover which part of the 3x3 was rotation and which was the float scale. So the node caches them. Construction: `MatrixTransform(const Nif::NiTransform& t) : osg::MatrixTransform(t.toMatrix()), mScale(t.mScale), mRotationScale(t.mRotation)` — the cached pair is ALWAYS seeded from the file record, and the copy constructor copies both. The class exposes four virtual mutators — setScale(float), setRotation(const osg::Quat&), setRotation(const Nif::Matrix3&), setTranslation(const osg::Vec3f&) — and the header explicitly forbids any other route: the matrix must not be edited manually or via preMult/postMult. TWO TRAPS FOR A PORT: (a) the DEFAULT constructor leaves mScale at 0.f, so a node built without a NiTransform (e.g. AutoTransform's default ctor, or an OSG clone-type call) will have its whole 3x3 collapsed to zeros by the first setRotation/setScale — always seed mScale from the NIF (nifloader.cpp:699 is the only site that builds one: `node = new NifOsg::MatrixTransform(nifNode->mTransform);`). (b) mScale is a SINGLE float, not a vec3; non-uniform scale lives inside mRotationScale.

```cpp
        // Hack: account for Transform differences between OSG and NIFs.
        // OSG uses a 4x4 matrix, NIF's use a 3x3 rotationScale, float scale, and vec3 position.
        // Decomposing the original components from the 4x4 matrix isn't possible, which causes
        // problems when a KeyframeController wants to change only one of these components. So
        // we store the scale and rotation components separately here.
        float mScale{ 0.f };
        Nif::Matrix3 mRotationScale;

        // Utility methods to transform the node and keep these components up-to-date.
        // The matrix's components should not be overridden manually or using preMult/postMult
        // unless you're sure you know what you are doing.
        virtual void setScale(float scale);
        virtual void setRotation(const osg::Quat& rotation);
        virtual void setRotation(const Nif::Matrix3& rotation);
        virtual void setTranslation(const osg::Vec3f& translation);
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> The bulk of the rule is faithful to components/nifosg/matrixtransform.hpp and components/nif/niftypes.hpp (two public members, mScale{0.f} default, Nif::Matrix3 = float mValues[3][3] identity-by-default at niftypes.hpp:36-45, the "negative and nonuniform scales" comment at line 70, the NiTransform ctor and copy ctor seeding both, four virtual mutators, scale as a single float). But trap (a) states as always-true something that is only true for setRotation. In components/nifosg/matrixtransform.cpp:19-31, setScale assigns mScale = scale BEFORE the rebuild loop (`mScale = scale;` then `_matrix(i,j) = mRotationScale.mValues[j][i] * mScale;`), so the stale 0.f is overwritten and never read: a default-constructed node given setScale(2.f) yields diag(2,2,2), not zeros (verified by simulating the exact loops). Only setRotation(const osg::Quat&) (lines 33-50) and setRotation(const Nif::Matrix3&) (lines 52-64) consume the pre-existing mScale and therefore zero the 3x3. Two further overreaches: (1) "nifloader.cpp:699 is the only site that builds one" is false - nifloader.cpp:677/679/681/686 build NifOsg::AutoTransform, which derives from MatrixTransform (autotransform.hpp:8) and whose Mode-only ctor (autotransform.cpp:9-13) delegates to the default MatrixTransform(), and components/sceneutil/serialize.cpp:149 registers createInstanceFunc<NifOsg::MatrixTransform> (plus AutoTransformSerializer at 159) which default-constructs instances during .osgb deserialization with no serializer for mScale or mRotationScale, so they stay 0.f/identity; (2) line 699 is guarded, not unconditional - createNode only reaches it in the non-billboard branch and only when `!(nifNode->mParents.empty() && nifNode->mController.empty() && nifNode->mTransform.isIdentity())`, otherwise a plain osg::Group is created. The rule also hardens the header's hedged comment ("should not be overridden ... unless you're sure you know what you are doing") into an absolute prohibition, while AutoTransform legitimately does its own matrix math in computeMatrix/computeLocalToWorldMatrix.

> Everything structural in the rule checks out verbatim against OpenMW master, but one clause is wrong and it is wrong precisely in the first-person player path, so it cannot be confirmed as stated. CONFIRMED PARTS. components/nifosg/matrixtransform.hpp:11-35 has exactly the two public members (`float mScale{ 0.f };`, `Nif::Matrix3 mRotationScale;`), the "Hack: account for Transform differences between OSG and NIFs." comment, `MatrixTransform() = default`, and the four virtuals setScale/setRotation(Quat)/setRotation(Matrix3)/setTranslation. matrixtransform.cpp:5-17 seeds both from the record and copies both. components/nif/niftypes.hpp:36-45 is Matrix3 (`float mValues[3][3]`, identity default) and :70 carries the "can contain scale components too, including negative and nonuniform scales" comment — both line refs exact. Trap (a) is real and severe: setScale/setRotation write `_matrix(i,j) = mRotationScale.mValues[j][i] * mScale` (matrixtransform.cpp:27, 44, 60), so mScale==0 collapses the 3x3; NifOsg::AutoTransform's default ctor (autotransform.cpp:9-13) reaches that state, and so does components/sceneutil/serialize.cpp:144-152, whose MatrixTransformSerializer builds via `createInstanceFunc<NifOsg::MatrixTransform>` (default ctor) and serializes neither mScale nor mRotationScale. Trap (b) is real. Werewolves/beast races change only which skeleton NIF is picked (apps/openmw/mwrender/actorutil.cpp:8-30) — no transform special case. WHAT REFUTES IT. The rule says "the header explicitly forbids any other route: the matrix must not be edited manually or via preMult/postMult." The header (matrixtransform.hpp:28-30) actually says the matrix "should not be overridden manually or using preMult/postMult *unless you're sure you know what you are doing*" — a soft rule with an explicit escape hatch — and a first-class caller takes that hatch on the first-person player body. MWRender::RotateController (apps/openmw/mwrender/rotatecontroller.cpp:30-54) is a NodeCallback over `osg::MatrixTransform*` that does `matrix = node->getMatrix(); matrix.setRotate(orient); matrix.setTrans(...); node->setMatrix(matrix);` — a direct manual matrix edit, never touching mScale/mRotationScale. It is attached to NifOsg::MatrixTransform bones: "bip01 head", "bip01 spine1", "bip01" (animation.cpp:1938-1942 via addRotateController, animation.cpp:1945-1973), "bip01 neck" for the player in VM_First ...


## [B] NifAnimBlendController repeats the identical missing-rotation reset, and seeds its blend from mRotationScale/mScale rather than from the matrix, because the matrix is polluted by RotateController
- `apps/openmw/mwrender/animblendcontroller.cpp:313-392` - importance **high**

When smooth animation blending is on, a NifOsg::MatrixTransform gets a NifAnimBlendController wrapping the KeyframeController (animation.cpp:1162-1166). Its operator() calls mKeyframeTrack->getCurrentTransformation(nv) and then reproduces the same rule in BOTH branches: while interpolating, `if (rotation) { slerp(mInterpFactor, mBlendStartRot, *rotation) -> setRotation(lerped); } else { node->setRotation(node->mRotationScale); }` with the comment 'This is necessary to prevent first person animation glitching out'; and when not interpolating, `if (rotation) node->setRotation(*rotation); else node->setRotation(node->mRotationScale);`. So the every-frame rotation rewrite holds on the blending path too — a port must implement it in both. Three further exact behaviours. (1) BLEND START READS THE DECOMPOSED COPY, NOT THE MATRIX: `mBlendStartRot = node->mRotationScale.toOsgMatrix().getRotate(); mBlendStartTrans = node->getMatrix().getTrans(); mBlendStartScale = node->mScale;` — rotation and scale come from the cached components, only translation comes from the 4x4, with the stated reason 'Nif mRotationScale is used here because it's unaffected by the side-effects of RotationController'. (Matrix3::toOsgMatrix is itself the transpose: osgMat(i,j) = mValues[j][i], niftypes.hpp:56-65.) (2) THE ROTATE-CONTROLLER OFFSET IS SUBTRACTED FROM THE BLEND START: it walks node->getUpdateCallback()->getNestedCallback() down the chain, and for each MWRender::RotateController found computes worldOrient from computeLocalToWorld(first parental node path to rotateController->getRelativeTo()), then `worldOrient = worldOrient * rotate.inverse(); mBlendStartTrans -= worldOrient.inverse() * offset;` — the comment names the symptom: 'fixes an issue with camera jumping during first person sneak jumping camera'. (3) SCALE IS NEVER BLENDED: it is applied outside both branches as `if (scale) node->setScale(*scale);` with the reason 'Scale is not lerped based on the idea that it is much more likely that scale animation will be used to instantly hide/show objects in which case the scale interpolation is undesirable.' Translation IS lerped (vec3fLerp) while interpolating.

```cpp
            // Nif mRotationScale is used here because it's unaffected by the side-effects of RotationController
            mBlendStartRot = node->mRotationScale.toOsgMatrix().getRotate();
            mBlendStartTrans = node->getMatrix().getTrans();
            mBlendStartScale = node->mScale;

            // Subtract any rotate controller's offset from start transform (if it appears after this callback)
            // this is required otherwise the blend start will be with an offset, then offset could be applied again
            // fixes an issue with camera jumping during first person sneak jumping camera
...
            else
            {
                // This is necessary to prevent first person animation glitching out
                node->setRotation(node->mRotationScale);
            }
...
            if (rotation)
                node->setRotation(*rotation);
            else
                node->setRotation(node->mRotationScale);
        }

        if (scale)
            // Scale is not lerped based on the idea that it is much more likely that scale animation will be used to
            // instantly hide/show objects in which case the scale interpolation is undesirable.
            node->setScale(*scale);
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> Refuted on an omitted guard in claim (2), not on the main thesis. Verified against upstream OpenMW: animation.cpp:1162-1166 is indeed the `dynamic_cast<NifOsg::MatrixTransform*>` -> `handleBlendTransform<NifAnimBlendController>` block gated on Settings::game().mSmoothAnimTransitions; both branches of NifAnimBlendController::operator() do reproduce the rotation fallback verbatim; claim (1)'s three blend-start reads are verbatim and mRotationScale/mScale are genuinely the cached decomposed components on NifOsg::MatrixTransform (matrixtransform.hpp), with toOsgMatrix being the transpose osgMat(i,j)=mValues[j][i]; claim (3) is verbatim and mBlendStartScale is written at line 321 and never read anywhere in the file, so scale really is never blended; vec3fLerp(t, start, end) matches the stated operand order. The failure is that claim (2) is presented as an "exact behaviour" but drops the only conditional in the block. The code is: osg::NodePathList nodepaths = node->getParentalNodePaths(rotateController->getRelativeTo()); osg::Quat worldOrient; if (!nodepaths.empty()) { osg::Matrixf worldMat = osg::computeLocalToWorld(nodepaths[0]); worldOrient = worldMat.getRotate(); } worldOrient = worldOrient * rotate.inverse(); The rule says worldOrient is computed from computeLocalToWorld of the first parental node path, unconditionally. It is not. When the node has no parental path to getRelativeTo(), worldOrient stays default-constructed (identity) and — the part that changes meaning — the subtraction STILL executes, degenerating to mBlendStartTrans -= rotate * offset. It is not skipped. A port written from the rule as stated has two wrong options and no right one: index [0] on an empty list (crash / undefined in a JS port), or treat "no node path" as "skip this RotateController" (silently wrong blend start, which is precisely the camera-jump symptom the block exists to fix). This is an omitted guard with reachable, behaviour-changing consequences in a rule that claims exactness.


## [B] AutoTransform (billboards) overrides ONLY setRotation, so the every-frame missing-rotation reset also rewrites mBaseRotation - and its default constructor leaves mScale at 0
- `components/nifosg/autotransform.cpp:15-53` - importance **medium**
- REFINES OR CORRECTS RECORDED RULE 60

NifOsg::AutoTransform derives from NifOsg::MatrixTransform and overrides exactly two of the four mutators: `void setRotation(const osg::Quat&) override;` and `void setRotation(const Nif::Matrix3&) override;` (autotransform.hpp:33-34). setScale and setTranslation are inherited unchanged. Each override calls the base implementation FIRST and then refreshes the billboard's own cached orientation: the quaternion overload does `MatrixTransform::setRotation(rotation); mBaseRotation = rotation; mRotation = rotation;`; the Matrix3 overload does `MatrixTransform::setRotation(rotation);` then rebuilds `rotMat(i, j) = rotation.mValues[j][i]` (same [j][i] transpose) and sets mBaseRotation = rotMat.getRotate(), mRotation = mBaseRotation. CONSEQUENCE FOR THE MISSING-CHANNEL RULE: a NiBillboardNode that carries a NiKeyframeController with no rotation track receives node->setRotation(node->mRotationScale) every frame, which through this override re-derives mBaseRotation and mRotation from the cached 3x3 on every single frame — it is not a one-time construction value, and any code that mutates mRotation (computeMatrixForFrame caches into the mutable mRotation) is reset by the animation callback. The constructor taking a NiTransform performs the same rotMat(i,j) = mRotationScale.mValues[j][i] conversion, so mBaseRotation is always the transpose-read quaternion of the cached NIF 3x3. FINALLY: `AutoTransform(Mode mode)` chains to `MatrixTransform()`, the defaulted base constructor, which leaves mScale at 0.f — a node built that way and then given any setRotation/setScale gets an all-zero 3x3.

```cpp
    AutoTransform::AutoTransform(const Nif::NiTransform& transform, Mode mode)
        : MatrixTransform(transform)
        , mMode(mode)
    {
        osg::Matrixd rotMat;
        for (int i = 0; i < 3; ++i)
            for (int j = 0; j < 3; ++j)
                rotMat(i, j) = mRotationScale.mValues[j][i];
        mBaseRotation = rotMat.getRotate();
        mRotation = mBaseRotation;
    }
...
    void AutoTransform::setRotation(const osg::Quat& rotation)
    {
        MatrixTransform::setRotation(rotation);
        mBaseRotation = rotation;
        mRotation = rotation;
    }

    void AutoTransform::setRotation(const Nif::Matrix3& rotation)
    {
        MatrixTransform::setRotation(rotation);

        osg::Matrixd rotMat;
        for (int i = 0; i < 3; ++i)
            for (int j = 0; j < 3; ++j)
                rotMat(i, j) = rotation.mValues[j][i];

        mBaseRotation = rotMat.getRotate();
        mRotation = mBaseRotation;
    }
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> The core of the rule checks out against the real sources, but two of its stated consequences are wrong as written. VERIFIED (no issue): AutoTransform : public MatrixTransform overrides exactly the two setRotation forms at autotransform.hpp:33-34, while the base's four virtual mutators (matrixtransform.hpp:31-34) leave setScale and setTranslation inherited; both overrides call the base first (autotransform.cpp:37, 44); the quoted bodies, the ctor's rotMat(i,j) = mRotationScale.mValues[j][i] transpose, and the identical transpose in the Matrix3 override are all exact. The missing-channel premise is also real: KeyframeController::operator() (controller.cpp:179-197) takes the else branch and calls node->setRotation(node->mRotationScale), which virtual-dispatches into AutoTransform's Matrix3 override, so mBaseRotation and mRotation are re-derived from the cached 3x3 every update traversal, not once at construction. DEFECT 1 (states as always-true something conditional on which mutator): "a node built that way and then given any setRotation/setScale gets an all-zero 3x3" is false for setScale. MatrixTransform::setScale (matrixtransform.cpp:19-31) assigns mScale = scale FIRST and only then rebuilds _matrix(i,j) = mRotationScale.mValues[j][i] * mScale, so the rebuild uses the new scale, never the stale 0.f. On an AutoTransform(Mode) node, setScale(1.f) yields the identity 3x3 (Nif::Matrix3's default ctor is identity, niftypes.hpp:40-44) — a well-formed matrix, all-zero only if the caller passes 0.f. The all-zero outcome belongs solely to the two setRotation paths, which multiply by the still-zero mScale (matrixtransform.cpp:44 and :60). setScale is in fact the cure for the zero-scale state, not another instance of it. DEFECT 2 (misattributed write site): "computeMatrixForFrame caches into the mutable mRotation" is false. computeMatrixForFrame (autotransform.cpp:90-152) is const and never touches mRotation; it only reads mBaseRotation, mScale and _matrix.getTrans(). The cache write is mRotation = mat.getRotate() at autotransform.cpp:79, inside computeMatrix, and only on the branch where nv->asCullStack() is non-null. This guard matters for the rule's conclusion: mRotation is read back only on the opposite, no-CullStack fallback path (line 85), since the cull path recomputes the orientation from mBaseRotation every time — so "any code that mutates mRotation is reset b ...


## [B] A key group is uint32 count then uint32 type, a zero count omits the type field entirely, and the four key layouts differ in width
- `components/nif/nifkey.hpp:16-24, 62-122, 133-169` - importance **critical**

Every animation track in a NIF is a "key group" read by KeyMapT::read (nifkey.hpp:62-122). Non-morph read order is EXACTLY: (1) uint32 count. (2) If count == 0, RETURN IMMEDIATELY — the interpolation-type field is NOT present in the stream; the group keeps mInterpolationType = InterpolationType_Unknown (0) and zero keys. Reading a type dword here desynchronises the whole file. (3) Otherwise read uint32 mInterpolationType. (4) Read exactly `count` keys back-to-back, layout chosen by type:
  - Linear(1) and Constant(5): float time, then one value. mInTan/mOutTan are left default-constructed (0 for float/Vec3/Vec4, (x=0,y=0,z=0,w=1) for Quat).
  - Quadratic(2) (nifkey.hpp:133-145): float time, value, then inTan and outTan of the same value type — EXCEPT when the value type is osg::Quat, where `if constexpr (std::is_same_v<T, osg::Quat>)` reads the value ONLY. A quadratic quaternion key is 4 bytes time + 16 bytes quat = 20 bytes, NOT 52.
  - TCB(3) (nifkey.hpp:153-169): float time, value, float tension, float continuity, float bias. No tangents are stored in the file; they are derived (see the TCB rule).
  - XYZ(4): NOTHING is read here. mKeys.reserve(count) runs but zero keys are appended, so the group ends up with count > 0 and an EMPTY key vector. This emptiness is load-bearing (see the XYZ rule).
  - any other type with count != 0: throw Nif::Exception("Unhandled interpolation type: " + type).
Value widths: float = 4; osg::Vec3f = 12; osg::Vec4f = 16; osg::Quat = 16 read in the order w, x, y, z (nifstream.cpp:129-137 — NOT x,y,z,w); bool = int32 when file version < 4.1.0.0 (every Morrowind NIF is 4.0.0.2, so int32 there) else int8, nonzero meaning true (nifstream.cpp:171-177).
The group stores a flat std::vector<std::pair<float,KeyT<T>>> in FILE ORDER. Keys are never sorted and duplicates are never removed — the source says so outright at nifkey.hpp:121. The interpolation type is a property of the WHOLE group; there is no per-key type. Concrete instantiations: FloatKeyMap, Vector3KeyMap, Vector4KeyMap, QuaternionKeyMap, BoolKeyMap (nifkey.hpp:227-231).

```cpp
const uint32_t count = nif->get<uint32_t>();

if (count == 0 && !morph)
    return;

nif->read(mInterpolationType);

mKeys.reserve(count);
...
// Note: NetImmerse does NOT sort keys or remove duplicates
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> The description of KeyMapT::read itself is accurate and implementable — I verified every mechanical claim against master. All line refs are right (enum 16-24, read 62-122, readQuadratic 133-145, readTCBKey 153-169, instantiations 227-231). Confirmed correct: `if (count == 0 && !morph) return;` before the type dword (nifkey.hpp:82-83), so non-morph count==0 leaves mInterpolationType=0 and no keys; Linear/Constant = time+value via readValuePair (127-131); the `if constexpr (std::is_same_v<T, osg::Quat>)` quadratic exception (135-138), so a quadratic quat key really is 20 bytes not 52; TCB = time, value, tension, continuity, bias with tangents derived (153-169); XYZ reads nothing while mKeys.reserve(count) still runs, and data.cpp:538-548 confirms the caller eats a float and re-runs read 3x; `else if (count != 0)` throws; Quat is 16 bytes in w,x,y,z order (nifstream.cpp:129-137); flat vector, no sorting or dedup (121). The mInTan/mOutTan zero claim also holds — readVectorOfRecords does `T value;` on std::pair, whose default ctor value-initializes the aggregate KeyT. Two claims overreach, and they break in the same place. (1) "Every animation track in a NIF is a 'key group' read by KeyMapT::read" is false, and it is falsified by the one track Morrowind actually needs. NiVisData — the data for NiVisController (controller.hpp:290-296) — is NOT a KeyMapT at all. data.hpp:197-203 declares it as a bare `std::shared_ptr<std::vector<std::pair<float, bool>>>`, and data.cpp:318-328 reads uint32 count, then immediately `count` pairs of {float time, uint8 flag}. There is NO interpolation-type dword in that stream. A reader built from the rule would consume 4 (count) + 4 (bogus type) + count*(4+4) where the file holds 4 + count*(4+1) — desynchronising every Morrowind NIF with a visibility controller, which is exactly the failure the rule warns about. (2) "bool = int32 when file version < 4.1.0.0 (every Morrowind NIF is 4.0.0.2, so int32 there)" is stated as the on-disk width for bool keys and is backwards for both real bool-key readers. NiVisData reads `stream.get<uint8_t>() != 0` unconditionally (data.cpp:322). The other bool-key path, the readKeyMapPair<float,bool> specialization (nifkey.hpp:220-225) used at particle.cpp:679 for NiPSysEmitterCtlrData::mVisKeyList, ALSO reads `stream.get<uint8_t>()` unconditionally and reads no type dword — and mVisKeyList is a BoolKeyMap, ...


## [B] interpKey(time): clamp to the endpoint values, lower_bound for the high key, low = high-1, fraction = (t-lo)/(hi-lo)
- `components/nifosg/controller.hpp:44-62, 99-131` - importance **critical**

Sampling a track at time t (ValueInterpolator::interpKey, controller.hpp:99-129) is exactly:
 1. If the track has no key list or the list is empty -> return mDefaultVal. NOTE: for bone tracks this branch is unreachable because the caller tests empty() first, which means a NiTransformInterpolator whose mData is empty produces NO rotation/translation/scale at all and its mDefaultValue is silently DISCARDED (controller.cpp:114-119 constructs the interpolators with null key maps, and controller.cpp:206-220 only writes an output when !empty()).
 2. `if (time <= keys.front().first) return keys.front().second.mValue;` — at or before the first key, return the first key's value VERBATIM. No extrapolation, tangents ignored.
 3. hi = first index with keys[hi].time >= t (std::lower_bound with predicate `key.first < t`, so on a run of equal times it lands on the FIRST of the run).
 4. If no such index exists (t is greater than every key time) -> `return keys.back().second.mValue;` verbatim. Again no extrapolation.
 5. lo = hi - 1. This is always in range: step 2 already removed t <= keys[0].time, and lower_bound's predicate is true at index 0, so hi >= 1.
 6. `if (highTime == lowTime) return mLastLowKey->second.mValue;` — equal-time bracket returns the LOW key's value, never divides. With sorted keys lower_bound makes this unreachable, so it is defensive cover for the unsorted/duplicated key data the loader deliberately preserves.
 7. a = (t - keys[lo].time) / (keys[hi].time - keys[lo].time), which lies in (0, 1].
 8. return interpolate(keys[lo], keys[hi], a, group.mInterpolationType).
A port may implement steps 3-8 with a plain binary search every call. OpenMW additionally caches the last bracket (retrieveKey, controller.hpp:44-62): if t > lastHigh.time it advances both iterators by one, and if t then lies inclusively inside [lastLow.time, lastHigh.time] it uses that bracket instead of searching. The only divergence from a fresh lower_bound is t exactly equal to lastLow.time, where the cache yields (lo,hi,a=0) and lower_bound yields (lo-1,lo,a=1); both evaluate to keys[lo].value under all six interpolation types, so the cache is a pure optimisation and can be omitted.
The t handed in is already mapped by ControllerFunction::calculate when a function is attached (controller.cpp:30-71): t = mFrequency*source + mPhase, then if outside [mStartTime, mStopTime] it is Cycle-wrapped, Reverse-ping-ponged, or (Constant / default) clamped to mStartTime / mStopTime.

```cpp
if (time <= keys.front().first)
    return keys.front().second.mValue;

typename MapT::MapType::const_iterator it = retrieveKey(time);

// now do the actual interpolation
if (it != keys.end())
{
    // cache for next time
    mLastHighKey = it;
    mLastLowKey = --it;

    const float highTime = mLastHighKey->first;
    const float lowTime = mLastLowKey->first;
    if (highTime == lowTime)
        return mLastLowKey->second.mValue;

    const float a = (time - lowTime) / (highTime - lowTime);

    return interpolate(mLastLowKey->second, mLastHighKey->second, a, mKeys->mInterpolationType);
}

return keys.back().second.mValue;
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> Steps 1-8, the empty-branch NOTE (controller.cpp:116-118 builds the interpolators with null key maps and 206-220 only writes an output when !empty(), so NiTransformInterpolator::mDefaultValue is indeed discarded), the equal-time guard analysis, and the ControllerFunction::calculate summary all check out against the real source. The rule is refuted on two points, one load-bearing. (1) PRIMARY — "The only divergence from a fresh lower_bound is t exactly equal to lastLow.time ... both evaluate to keys[lo].value under all six interpolation types, so the cache is a pure optimisation and can be omitted" is stated as always-true but is conditional on strictly increasing key times. The rule itself invokes the opposite premise in step 6, and components/nif/nifkey.hpp:119 confirms it verbatim: "// Note: NetImmerse does NOT sort keys or remove duplicates". When a run of equal times exists, lower_bound always lands on the FIRST of the run (as step 3 correctly says), but the cache's low iterator can be a LATER member of that run — because interpKey stores mLastLowKey = it-1, and retrieveKey's ++ advance can walk the pair forward across the run. The two paths then read DIFFERENT key records, not the same one at a=0 vs a=1. Simulated on keys [(0,A),(1,B),(1,C),(2,D)]: sample t=1.5 (both give lerp(C,D,0.5)), then t=1.0 — cache returns bracket (C,D) with a=0 -> C; a fresh lower_bound returns bracket (A,B) with a=1 -> B. C != B, under every interpolation type, since the endpoint identities differ rather than the fractions. So the cache is NOT a pure optimisation and a port that omits it will produce different output on duplicate-time tracks. For genuinely unsorted keys the claim is weaker still: lower_bound over an unsorted range yields an unspecified partition point while the cache walks linearly, so no equivalence holds at all. (2) SECONDARY — step 7's "a ... lies in (0, 1]" is presented as part of what interpKey "exactly" does, but is contradicted by the rule's own later paragraph and by the code: via the cache path a = 0 is reachable (t == lastLow.time, no advance, inclusive test passes). For the actual function a is in [0, 1]. A port asserting the (0,1] invariant would trip.


## [B] Constant (type 5) is a midpoint FLIP with a strict >, not hold-previous
- `components/nifosg/controller.hpp:138-141, 167-170` - importance **high**

InterpolationType_Constant does NOT hold the previous key's value across the segment. Both the generic overload (controller.hpp:140-141) and the quaternion overload (controller.hpp:169-170) are the identical one-liner `return fraction > 0.5f ? b.mValue : a.mValue;`. So across a segment [lo, hi] the output is keys[lo].value for fraction in [0, 0.5] and switches to keys[hi].value only once fraction exceeds 0.5. The comparison is STRICT: at fraction exactly 0.5 (t exactly halfway between the two key times) the LOW key wins. The switch point in time is lowTime + 0.5*(highTime - lowTime); a port that snaps t to the nearest key time, or that holds keys[lo] for the whole segment, will be visibly wrong for half of every constant segment. Tangents are never consulted. Outside the key range the endpoint-clamp of interpKey (return front value at or before the first key, back value past the last) applies before this code is reached.

```cpp
case Nif::InterpolationType_Constant:
    return fraction > 0.5f ? b.mValue : a.mValue;
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> The mechanical core of the rule is right, but its central porting claim is false, and it omits a guard that fires before the constant branch. (1) FALSE: "a port that snaps t to the nearest key time ... will be visibly wrong for half of every constant segment." Nearest-key snapping IS what this code computes. fraction = (time - lowTime) / (highTime - lowTime), so `fraction > 0.5f` is true exactly when time is closer to highTime than to lowTime. A nearest-key-time snap therefore agrees with `fraction > 0.5f ? b.mValue : a.mValue` at every time in the segment except the single tie point fraction == 0.5, where this code picks the LOW key and a naive nearest-snap may pick either. The rule itself states the switch point as lowTime + 0.5*(highTime - lowTime), which is the definition of nearest-key snapping, so the rule contradicts itself. Only the second listed mistake (holding keys[lo] across the whole segment) is wrong for half the segment. A porter following this rule would reject a correct implementation. (2) OMITTED GUARD: interpKey (controller.hpp:117-121) contains `if (highTime == lowTime) return mLastLowKey->second.mValue;` BEFORE fraction is computed and before interpolate() is called. For duplicate-timestamp keys the low key wins unconditionally and the constant branch is never reached; the rule's "switch point is lowTime + 0.5*(highTime - lowTime)" formula is undefined there (0/0), and the rule lists only the endpoint clamp as a preceding guard. Everything else checks out: both overloads are the identical one-liner; the comparison is strict so exact 0.5 yields a.mValue (the low key); tangents are unread in this branch; `if (time <= keys.front().first) return keys.front().second.mValue;` clamps at or before the first key and `return keys.back().second.mValue;` clamps past the last. Source read: https://raw.githubusercontent.com/OpenMW/openmw/master/components/nifosg/controller.hpp (saved locally at /tmp/claude-0/-home-user-project-dagger/0ec83e1e-fa7a-575c-b46a-fc71a6754acb/scratchpad/controller.hpp). The file does not exist anywhere in /home/user/project-dagger.


## [B] Quadratic and TCB share ONE cubic Hermite; the low key gives mOutTan, the high key gives mInTan, and tangents are used unscaled
- `components/nifosg/controller.hpp:134-163` - importance **critical**

Types Quadratic(2) and TCB(3) fall through to the SAME code (controller.hpp:142-159) and differ only in how the tangents were produced at load time. With t = fraction in (0,1], t2 = t*t, t3 = t2*t:
  b1 = 2*t3 - 3*t2 + 1
  b2 = -2*t3 + 3*t2
  b3 = t3 - 2*t2 + t
  b4 = t3 - t2
  result = a.mValue*b1 + b.mValue*b2 + a.mOutTan*b3 + b.mInTan*b4
where `a` is the LOW key and `b` is the HIGH key. The pairing is the part most often got wrong: the low key contributes its OUT tangent (with b3) and the high key contributes its IN tangent (with b4). The tangents are used RAW — they are never multiplied by (highTime - lowTime) nor divided by it, so they are in value-units-per-SEGMENT, not per second. Note b4 = t3 - t2 (i.e. t^3 - t^2), not the textbook t^3 - t^2 + ... variant; check b3(0)=0, b3(1)=0, b4(0)=0, b4(1)=0, b1(0)=1, b2(1)=1, so the curve passes through both key values exactly.
This runs component-wise for float, osg::Vec3f and osg::Vec4f (and, degenerately, for bool via integer promotion). Every other type — Linear(1), XYZ(4), Unknown(0) and any unrecognised value — falls to the `default:` branch: `a.mValue + ((b.mValue - a.mValue) * fraction)`. Quaternions NEVER reach this function at all (separate overload).

```cpp
const float t = fraction;
const float t2 = t * t;
const float t3 = t2 * t;
const float b1 = 2.f * t3 - 3.f * t2 + 1;
const float b2 = -2.f * t3 + 3.f * t2;
const float b3 = t3 - 2.f * t2 + t;
const float b4 = t3 - t2;
return a.mValue * b1 + b.mValue * b2 + a.mOutTan * b3 + b.mInTan * b4;
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> The Hermite half of the rule is accurate — I confirmed at controller.hpp:142-159 that Quadratic(2) and TCB(3) share one block, that the basis functions are exactly b1=2t^3-3t^2+1, b2=-2t^3+3t^2, b3=t^3-2t^2+t, b4=t^3-t^2, that the operand pairing is low-key `a.mOutTan*b3` + high-key `b.mInTan*b4`, that tangents are consumed raw (interpKey computes `a = (time-lowTime)/(highTime-lowTime)` at line 122 and never rescales the tangents by the segment span), and that osg::Quat is diverted to the separate non-template overload at line 164 which has no Quadratic/TCB case at all. The rule is refuted on its fall-through claim. It states: "Every other type — Linear(1), XYZ(4), Unknown(0) and any unrecognised value — falls to the `default:` branch: `a.mValue + ((b.mValue - a.mValue) * fraction)`." That presents an exhaustive partition of the remaining enum, and it is false. `Nif::InterpolationType_Constant = 5` exists in the enum (nifkey.hpp:23) and has its own case at controller.hpp:140-141, positioned ABOVE the Quadratic/TCB block: case Nif::InterpolationType_Constant: return fraction > 0.5f ? b.mValue : a.mValue; Constant(5) is a recognised type, so it is not covered by the rule's "any unrecognised value" escape hatch, and it never reaches `default:`. Anyone implementing from the rule as written would lerp Constant keys instead of stepping them — a smooth ramp where the code produces a hard switch at fraction = 0.5 (with the tie at exactly 0.5 going to the LOW key, since the test is strict `>`). This is an omitted guard that changes meaning, and it is a live path: nifkey.hpp:89 reads Constant key groups on the same code path as Linear, so real NIF data carries type 5. The same omission applies to the quaternion overload, which also has a Constant case (controller.hpp:169-170) before its slerp default.


## [B] Rotation keys never take the Hermite path: everything except Constant is plain OSG slerp, with shortest-arc negation and a linear fallback
- `components/nifosg/controller.hpp:164-179` - importance **critical**

osg::Quat has its own interpolate() overload (controller.hpp:164-179) with only two branches. Constant(5) -> the midpoint flip. EVERY other type — Linear(1), Quadratic(2), TCB(3), XYZ(4), Unknown(0) — falls to `default:` and does `result.slerp(fraction, a.mValue, b.mValue)`. The source comment is explicit: "TODO: Implement Quadratic and TBC interpolation". Do NOT implement squad or Hermite for rotation tracks; OpenMW's observable output is slerp.
The exact slerp (OSG src/osg/Quat.cpp:308-346), which a port must reproduce bit-for-bit-ish:
  cosomega = dot4(from, to)   // all four components, w included
  if (cosomega < 0) { cosomega = -cosomega; to = -to; }   // negate ALL FOUR components: shortest arc
  if ((1.0 - cosomega) > 1e-5) { omega = acos(cosomega); s = sin(omega); scaleFrom = sin((1-t)*omega)/s; scaleTo = sin(t*omega)/s; }
  else { scaleFrom = 1 - t; scaleTo = t; }   // near-identical endpoints: straight lerp
  result = from*scaleFrom + to*scaleTo      // component-wise; NOT renormalised afterwards
Argument order matters: from = the LOW key, to = the HIGH key, t = fraction.
This is consistent with the file format: quadratic quaternion keys carry NO tangent data at all (nifkey.hpp:135-138 reads the value only), and TCB quaternion tangents are never generated (nifkey.hpp:211-214), so a quaternion key's mInTan/mOutTan are always the default identity (0,0,0,1) and would corrupt the result if fed to the Hermite basis. Quaternion components come off disk in the order w, x, y, z (nifstream.cpp:129-137).

```cpp
osg::Quat interpolate(
    const Nif::KeyT<osg::Quat>& a, const Nif::KeyT<osg::Quat>& b, float fraction, unsigned int type) const
{
    switch (type)
    {
        case Nif::InterpolationType_Constant:
            return fraction > 0.5f ? b.mValue : a.mValue;
        // TODO: Implement Quadratic and TBC interpolation
        default:
        {
            osg::Quat result;
            result.slerp(fraction, a.mValue, b.mValue);
            return result;
        }
    }
}
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> Most of the rule is exact, but the XYZ(4) claim is false and it drives a wrong porting directive. VERIFIED CORRECT: the quoted overload is byte-identical to upstream at controller.hpp:164-179. nifkey.hpp:135-138 is exactly the `if constexpr (std::is_same_v<T, osg::Quat>) readValue(nif, key);` quadratic branch that skips tangents. nifkey.hpp:211-214 is exactly the empty `generateTCBTangents(std::vector<TCBKey<osg::Quat>>&)` no-op. nifstream.cpp:129-137 is exactly the w,x,y,z read. KeyT (nifkey.hpp:28-32) has no member initializers, so a quat key's mInTan/mOutTan are osg::Quat's default (0,0,0,1) as claimed. OSG Quat.cpp:308-346 matches the transcribed formula line for line: epsilon 0.00001, `cosomega = from.asVec4() * to.asVec4()`, `if (cosomega < 0.0) { cosomega = -cosomega; quatTo = -to; }` negating all four, `(1.0 - cosomega) > epsilon` guarding the acos branch, the lerp fallback, and `*this = (from*scale_from) + (quatTo*scale_to)` with no renormalisation. Argument order (from = low key, to = high key) is right. THE DEFECT — XYZ(4): "EVERY other type ... XYZ(4) ... falls to default: and does result.slerp(...)" is true of the switch statement but never happens, and the rule builds the directive "Do NOT implement squad or Hermite for rotation tracks; OpenMW's observable output is slerp" on top of it. XYZ rotation is a separate, reachable code path that this overload never touches: 1. nifkey.hpp:106-114 — when mInterpolationType == InterpolationType_XYZ the quaternion key group reads ZERO keys ("XYZ keys aren't actually read here"). The QuaternionInterpolator is therefore empty(), and interpKey returns mDefaultVal without ever calling interpolate(). Type 4 can never reach the default: branch. 2. data.cpp:534-548 — NiKeyframeData::read sees the XYZ type, eats the axis-order uint32, then reads THREE separate FloatKeyMaps (mXRotations/mYRotations/mZRotations). 3. controller.cpp:210-213 — the dispatch is `if (!mRotations.empty()) out.mRotation = mRotations.interpKey(time); else if (!mXRotations.empty() || !mYRotations.empty() || !mZRotations.empty()) out.mRotation = getXYZRotation(time);` 4. controller.cpp:136-160 — getXYZRotation interpolates the three float channels independently, builds osg::Quat xr(xrot, osg::X_AXIS) etc., and composes them by one of six AxisOrder permutations (Order_XYZ -> xr*yr*zr, Order_XZY -> xr*zr*yr, Order_YZX, Order_YXZ, Order_ZXY, Ord ...


## [B] The slotlist is 14 entries in a fixed order, and prio = ((basePriority + 1) << 1) + (isArmor ? 1 : 0)
- `apps/openmw/mwrender/npcanimation.cpp:586-631` - importance **critical**

updateParts() drives everything from one static table of {slot, basePriority}, in this exact order: Slot_Robe(11) base 11; Slot_Skirt(10) base 3; then Slot_Helmet(0), Slot_Cuirass(1), Slot_Greaves(2), Slot_LeftPauldron(3), Slot_RightPauldron(4), Slot_Boots(7), Slot_LeftGauntlet(5), Slot_RightGauntlet(6), Slot_Shirt(8), Slot_Pants(9), Slot_CarriedLeft(17), Slot_CarriedRight(16), all with base priority 0. (Parenthesised numbers are the InventoryStore slot ids from apps/openmw/mwworld/inventorystore.hpp:33-51; the base priority is the second field.) Slot_LeftRing(12), Slot_RightRing(13), Slot_Amulet(14), Slot_Belt(15) and Slot_Ammunition(18) are ABSENT from the table and therefore contribute no body parts at all. The loop is `for (size_t i = 0; i < slotlistsize && mViewMode != VM_HeadOnly; i++)` — the view-mode term is re-tested every iteration, so in VM_HeadOnly the body of the loop never executes even once. Per iteration: (1) `removePartGroup(slotlist[i].mSlot)` runs FIRST, before the equipped test, so an emptied slot's parts are always cleared; (2) `if (store == inv.end()) continue;`; (3) `int prio = 1;` — and prio stays 1 unless the item's record type is Clothing or Armor. If `store->getType() == ESM::Clothing::sRecordId`: `prio = ((base + 1) << 1) + 0`. If `ESM::Armor::sRecordId`: `prio = ((base + 1) << 1) + 1`. Any other type (Weapon, Light, Lockpick, Probe, Book, Apparatus, Repair) leaves prio == 1 and calls addPartGroup at all. Resulting concrete numbers, which a port should hardcode: Robe clothing 24 / armor 25; Skirt clothing 8 / armor 9; every other listed slot clothing 2 / armor 3; anything not Clothing or Armor 1. The naked body, the head, the hair and a carried Light's shield mesh are all added at priority 1, so ANY clothing or armor (>= 2) beats them. The armor +1 term exists purely to break ties: armor in a slot always beats clothing in the same slot by exactly 1.

```cpp
} slotlist[] = { // FIXME: Priority is based on the number of reserved slots. There should be a better way.
    { MWWorld::InventoryStore::Slot_Robe, 11 }, { MWWorld::InventoryStore::Slot_Skirt, 3 },
    { MWWorld::InventoryStore::Slot_Helmet, 0 }, { MWWorld::InventoryStore::Slot_Cuirass, 0 },
    ...
    int prio = 1;
    ...
    if (store->getType() == ESM::Clothing::sRecordId)
    {
        prio = ((slotlist[i].mBasePriority + 1) << 1) + 0;
    ...
    else if (store->getType() == ESM::Armor::sRecordId)
    {
        prio = ((slotlist[i].mBasePriority + 1) << 1) + 1;
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> The table, order, slot ids, loop guard, removePartGroup-before-equipped-test ordering, the ((base+1)<<1)+0/+1 formula and all derived numbers (24/25, 8/9, 2/3) all check out against apps/openmw/mwrender/npcanimation.cpp:586-647 and apps/openmw/mwworld/inventorystore.hpp:32-50, and "priority 1 loses to >= 2" is confirmed by the strict `if (priority <= mPartPriorities[type]) return false;` at :771. The rule is refuted on three counts, all inside the `...` it elided from its own quote. (1) OMITTED GUARD THAT CHANGES MEANING — the rule gives an explicit numbered per-iteration sequence ("(1) removePartGroup ... (2) if (store == inv.end()) continue; (3) int prio = 1;") and drops npcanimation.cpp:614-615: `if (slotlist[i].mSlot == MWWorld::InventoryStore::Slot_Helmet) removeIndividualPart(ESM::PRT_Hair);`. This runs after the equipped test and before prio is computed, so ANY item occupying the helmet slot deletes hair outright, regardless of its record type and regardless of any priority comparison. Together with the re-add guard at :654 (`mPartPriorities[PRT_Hair] < 1 && mPartPriorities[PRT_Head] <= 1`), hair is not governed purely by the priority table, contradicting the rule's claim that hair "is added at priority 1, so ANY clothing or armor (>= 2) beats them" — the mechanism is removal plus a head-priority gate, not a priority contest. A port hardcoding only the table leaves hair poking through helmets whose mParts list has no PRT_Hair entry. (2) OMITTED GUARD THAT CHANGES MEANING — the rule asserts updateParts "drives everything from one static table" and that the concrete numbers are what "a port should hardcode", yet drops the reserveIndividualPart blocks at :633-647 that are the entire reason base priorities 11 and 3 exist (they are the "reserved slots" the quoted FIXME refers to). Slot_Robe reserves PRT_Groin, Skirt, RLeg, LLeg, RUpperarm, LUpperarm, RKnee, LKnee, RForearm, LForearm, Cuirass at prio; Slot_Skirt reserves PRT_Groin, RLeg, LLeg at prio. Without them a port renders naked limbs and cuirass through an equipped robe while still matching every number the rule lists. (3) FALSE / UNIMPLEMENTABLE AS WRITTEN — "Any other type (Weapon, Light, Lockpick, Probe, Book, Apparatus, Repair) leaves prio == 1 and calls addPartGroup at all", echoed by "anything not Clothing or Armor 1" in the hardcode list. addPartGroup is called ONLY inside the `if (Clothing)`  ...


## [B] reserveIndividualPart claims a part slot with NO mesh — the visual result is a hole that cannot be refilled
- `apps/openmw/mwrender/npcanimation.cpp:731-751` - importance **critical**

`reserveIndividualPart(type, group, priority)` is guarded by STRICTLY GREATER: `if (priority > mPartPriorities[type])`. If the test fails it does nothing whatsoever — an existing part at equal or higher priority survives untouched. If it passes it calls `removeIndividualPart(type)` first, then sets `mPartPriorities[type] = priority; mPartslots[type] = group;` and returns. It never assigns mObjectParts[type]. So the part index ends up marked as owned by `group` at `priority` with a null PartHolder — a claim, not a mesh. removeIndividualPart(type) (npcanimation.cpp:731-742) does four things: `mPartPriorities[type] = 0`, `mPartslots[type] = -1`, `mObjectParts[type].reset()` (the PartHolder destructor detaches the attached osg subgraph from its bone, so any mesh already drawn there disappears), and if `mSounds[type]` is non-null and sounds are enabled it stops that looping sound and nulls it. VISUAL RESULT: nothing at all is drawn for that part, and it stays that way for the rest of this updateParts() call, because every remaining path that could supply geometry is blocked by the same counter — addOrReplaceIndividualPart bails on `priority <= mPartPriorities[type]`, and the naked-body fill loop only runs where `mPartPriorities[part] < 1`. It is a deletion, not a placeholder or a stub mesh. A JS port must model this as a per-part {priority:int, slot:int, node:Node|null} triple where node may legitimately be null while priority > 0; collapsing 'reserved' into 'absent' will let the naked mesh leak back in and re-grow the arm.

```cpp
void NpcAnimation::reserveIndividualPart(ESM::PartReferenceType type, int group, int priority)
{
    if (priority > mPartPriorities[type])
    {
        removeIndividualPart(type);
        mPartPriorities[type] = priority;
        mPartslots[type] = group;
    }
}
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> The mechanic half of the rule is exact, but the "VISUAL RESULT" half states as always-true something that is conditional. The claim "nothing at all is drawn for that part, and it stays that way for the rest of this updateParts() call, because every remaining path that could supply geometry is blocked by the same counter" is false on two counts. (1) It omits an unconditional wipe that is not a priority check at all. npcanimation.cpp:614-615, inside the same slot loop, runs `if (slotlist[i].mSlot == Slot_Helmet) removeIndividualPart(ESM::PRT_Hair);` whenever the Helmet slot is occupied. That resets mPartPriorities[PRT_Hair] to 0 no matter how high the reservation was — a PRT_Hair reservation made by the Robe slot at priority 24/25 (Robe is slot index 0, Helmet is index 2) is destroyed. Line 654 then reads `mPartPriorities[PRT_Hair] < 1 && mPartPriorities[PRT_Head] <= 1` and can add mHairModel. So a reservation demonstrably does not always survive the call, and geometry can appear where one was made. (2) addOrReplaceIndividualPart is not blocked by "the same counter" in general — it is blocked only by `priority <= mPartPriorities[type]` (line 771), so any later call with strictly greater priority overwrites the reservation and draws a mesh. What actually makes reservations usually survive is the priority ladder, which the rule never states: slotlist base priorities are Robe 11, Skirt 3, everything else 0 (line 591-...), and prio = ((base+1) << 1) + 0 for clothing / +1 for armor (lines 622, 628), giving Robe 24/25, Skirt 8/9, all other slots 2/3, evaluated in that slot order. Descending order is why the high reservations stick. Among the twelve equal-base slots the ladder is not monotonic: a clothing item reserves at 2 and a later armor slot adds at 3 (e.g. Shoes in Slot_Boots at index 7 reserving a part index that a Gauntlet/Bracer in Slot_LeftGauntlet/RightGauntlet at index 8/9 then supplies at priority 3) — the code places no restriction on which PRT_ indices an item's mParts list may name. A JS port written from the rule as stated would treat "reserved" as permanently sealed for the pass and would omit both the unconditional PRT_Hair clear and the higher-priority overwrite path.


## [B] A Robe reserves exactly 11 parts (including both forearms and both upper arms); a Skirt reserves exactly 3
- `apps/openmw/mwrender/npcanimation.cpp:633-647` - importance **critical**

After the addPartGroup call, and keyed on the SLOT (not on the item type), updateParts runs an `if (slot == Slot_Robe) ... else if (slot == Slot_Skirt) ...` block using the same `prio` computed above. Robe reserves, in this source order, exactly these 11 ESM::PartReferenceType values: PRT_Groin(4), PRT_Skirt(5), PRT_RLeg(21), PRT_LLeg(22), PRT_RUpperarm(13), PRT_LUpperarm(14), PRT_RKnee(19), PRT_LKnee(20), PRT_RForearm(11), PRT_LForearm(12), PRT_Cuirass(3) — each via `reserveIndividualPart(parts[p], Slot_Robe, prio)`. Skirt reserves exactly 3: PRT_Groin(4), PRT_RLeg(21), PRT_LLeg(22). A Robe does NOT reserve: PRT_Head(0), PRT_Hair(1), PRT_Neck(2), PRT_RHand(6), PRT_LHand(7), PRT_RWrist(8), PRT_LWrist(9), PRT_Shield(10), PRT_RFoot(15), PRT_LFoot(16), PRT_RAnkle(17), PRT_LAnkle(18), PRT_RPauldron(23), PRT_LPauldron(24), PRT_Weapon(25), PRT_Tail(26). This is the whole reason first-person hands survive a robe while the arms do not: the hand and wrist indices are simply not in the list. The block is unconditional on item type — it runs for whatever is in Slot_Robe / Slot_Skirt, so a non-Clothing, non-Armor item in Slot_Robe would still reserve all 11 parts, at prio == 1. Because a robe is Clothing its prio is ((11+1)<<1)+0 = 24, the highest value the whole system can produce (only armor in Slot_Robe, prio 25, would be higher).

```cpp
if (slotlist[i].mSlot == MWWorld::InventoryStore::Slot_Robe)
{
    ESM::PartReferenceType parts[] = { ESM::PRT_Groin, ESM::PRT_Skirt, ESM::PRT_RLeg, ESM::PRT_LLeg,
        ESM::PRT_RUpperarm, ESM::PRT_LUpperarm, ESM::PRT_RKnee, ESM::PRT_LKnee, ESM::PRT_RForearm,
        ESM::PRT_LForearm, ESM::PRT_Cuirass };
    const size_t partsSize = sizeof(parts) / sizeof(parts[0]);
    for (size_t p = 0; p < partsSize; ++p)
        reserveIndividualPart(parts[p], slotlist[i].mSlot, prio);
}
else if (slotlist[i].mSlot == MWWorld::InventoryStore::Slot_Skirt)
{
    reserveIndividualPart(ESM::PRT_Groin, slotlist[i].mSlot, prio);
    reserveIndividualPart(ESM::PRT_RLeg, slotlist[i].mSlot, prio);
    reserveIndividualPart(ESM::PRT_LLeg, slotlist[i].mSlot, prio);
}
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> The rule's structural anatomy is exactly right — verified against OpenMW master, where the quote sits at npcanimation.cpp:633-647 verbatim. The 11 Robe parts and their source order, Skirt's 3, every ESM::PartReferenceType number (checked against components/esm3/loadarmo.hpp), the 16-part complement, "keyed on slot not item type", the `int prio = 1;` default at line 617, and `prio = ((11+1)<<1)+0 = 24` (Slot_Robe's mBasePriority is 11 at line 591) all hold. But it fails on four counts. (1) OMITTED GUARD THAT CHANGES MEANING. reserveIndividualPart (line 744) is `if (priority > mPartPriorities[type]) { removeIndividualPart(type); ... }` — strictly greater, and it clears the slot first. The rule states Robe "reserves, in this source order, exactly these 11 ... each via reserveIndividualPart(parts[p], Slot_Robe, prio)" as an unconditional act. It is not. addPartGroup on line 624 has already stamped the same prio 24 on whatever parts the robe record itself declares, so for those parts the reserve is a no-op. An implementer porting the rule literally ("clear the slot and stamp prio, for all 11") would delete the robe's own just-attached PRT_Cuirass/PRT_Groin/PRT_Skirt/forearm/upperarm meshes and render an invisible robe. The strict `>` is precisely what preserves them, and the rule never mentions it. (2) THE FIRST-PERSON CAUSAL CLAIM IS OVERREACH AND WRONG ON THE ARMS. "This is the whole reason first-person hands survive a robe while the arms do not." addPartGroup contains an explicit first-person fallback (lines 886-893 and 902-909): when the `.1st` variant is missing it retries the plain bodypart and keeps it only if `mData.mPart` is MP_Hand, MP_Wrist, MP_Forearm or MP_Upperarm. Robe sleeve geometry therefore DOES render in first person. What the reserve suppresses is the bare-body forearm/upperarm supplied by the getBodyParts table at lines 681-689 (guarded by `if (mPartPriorities[part] < 1)`), not all arm geometry. "The arms do not [survive]" conflates "the naked arm parts are suppressed" with "no arms are drawn." (3) HANDS ARE NOT IMMUNE BY CONSTRUCTION. addPartGroup(slot, prio, clothes->mParts.mParts, ...) runs before the block and claims whatever the RECORD lists — including PRT_RHand/PRT_LHand/PRT_RWrist/PRT_LWrist if present — either attaching a mesh or, when the bodypart is not found, calling reserveIndividualPart at the same prio 24, which blanks the slo ...


## [B] Strictly-greater wins and ties LOSE — which is exactly why a robe's own sleeves survive its own reserve pass
- `apps/openmw/mwrender/npcanimation.cpp:744-776` - importance **critical**

Two comparisons, both strict, decide every conflict. (a) `addOrReplaceIndividualPart`: `if (priority <= mPartPriorities[type]) return false;` — an equal priority is REJECTED and the incoming mesh is dropped; on a win it does removeIndividualPart(type), then `mPartslots[type] = group; mPartPriorities[type] = priority;` (slot assigned before priority, irrelevant to behaviour), then attaches, and returns true. If the attach throws, the catch logs and returns false but the slot and priority have ALREADY been overwritten — the part stays claimed and empty. (b) `reserveIndividualPart`: `if (priority > mPartPriorities[type])`. Consequence that a port must get right: within one slot's own iteration, addPartGroup adds the item's meshes at priority P and the Robe/Skirt reserve block then runs at the same P, so `P > P` is false and the reserve is a NO-OP on the item's own parts. The reserve only wipes parts owned by other, strictly lower-priority slots. Because both tests compare absolute numbers, the final set of visible parts is independent of slotlist iteration order — order only matters for the wipe. That wipe is `removePartGroup(group)`, npcanimation.cpp:754-761: `for (int i = 0; i < ESM::PRT_Count; i++) if (mPartslots[i] == group) removeIndividualPart(...)` — it matches on the OWNING SLOT ID, so naked-body parts (added with group == -1) and the head/hair (also group -1) are never cleared by it, since -1 never appears in the slotlist. Initial state, set in the NpcAnimation constructor (npcanimation.cpp:284-288): every mPartslots[i] = -1 and every mPartPriorities[i] = 0, for i in [0, ESM::PRT_Count=27). Both arrays are plain `int[ESM::PRT_Count]` (npcanimation.hpp:68-69).

```cpp
bool NpcAnimation::addOrReplaceIndividualPart(ESM::PartReferenceType type, int group, int priority,
    VFS::Path::NormalizedView mesh, bool enchantedGlow, osg::Vec4f* glowColor, bool isLight)
{
    if (priority <= mPartPriorities[type])
        return false;

    removeIndividualPart(type);
    mPartslots[type] = group;
    mPartPriorities[type] = priority;
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> Most of the rule checks out against /tmp/claude-0/-home-user-project-dagger/0ec83e1e-fa7a-575c-b46a-fc71a6754acb/scratchpad/openmw/apps/openmw/mwrender/npcanimation.cpp (identical in all five copies): the `<=` reject, the slot-then-priority assignment (harmless, since removeIndividualPart at :731-733 zeroes both), the catch at :804-808 returning false over an already-claimed empty slot, `priority > mPartPriorities[type]` in reserveIndividualPart (:744), removePartGroup matching the owning slot id at :754-761, the constructor init at :284-288, PRT_Count = 27 (loadarmo.hpp:48) and the plain int[27] arrays (npcanimation.hpp:68-69). The "reserve is a no-op on the item's own parts" point is also correct: addPartGroup passes the same `prio` (:917/:920) that the Robe/Skirt reserve block then re-uses (:640-646). But the load-bearing claim — "the final set of visible parts is independent of slotlist iteration order — order only matters for the wipe" — is false, and it contradicts the rule's own first sentence. Absolute-number comparison plus a STRICT test means ties are broken by arrival: first writer wins, every later equal-priority claimant is dropped. Ties are not exotic, they are the norm. The priority formula at :620/:627 is `((mBasePriority + 1) << 1) + 0|1`, and in the slotlist at :590-597 twelve of the fourteen slots carry mBasePriority 0, so every clothing item in Helmet/Cuirass/Greaves/both pauldrons/Boots/both gauntlets/Shirt/Pants/CarriedLeft/CarriedRight computes priority 2 and every armor piece computes 3. Only Robe (24/25) and Skirt (8/9) are distinct. Concretely: a shirt (idx 10) and pants (idx 11) are both ESM::Clothing at priority 2; if both declare a mesh for PRT_Groin, the shirt claims it first, then the pants' addOrReplaceIndividualPart hits `2 <= 2` and its mesh is discarded. Swap those two rows and the pants' groin renders instead. Same for Cuirass vs Greaves, LGauntlet vs RGauntlet, LPauldron vs RPauldron at armor priority 3. Order-independence holds only when all competing priorities are distinct — the rule states a conditional as always-true, which is exactly what a port would get wrong (e.g. iterating slots from a hash map). The rule also omits a second order-sensitive removal that is not the removePartGroup wipe: :615-616, `if (slotlist[i].mSlot == Slot_Helmet) removeIndividualPart(ESM::PRT_Hair);` — unconditional, with no priority test at ...


## [B] In first person a robe leaves hands and wrists but deletes the forearms and upper arms
- `apps/openmw/mwrender/npcanimation.cpp:617-641, 879-920, 682-690` - importance **critical**

Compose the pieces for the case the port actually cares about. Robe equipped, mViewMode == VM_FirstPerson: prio = ((11+1)<<1)+0 = 24. addPartGroup(Slot_Robe, 24, clothes->mParts.mParts, ...) runs with `ext = ".1st"` (npcanimation.cpp:879): for each ESM::PartReference it searches the BodyPart store for `<femaleId or maleId> + ".1st"`; on a miss, and ONLY when mViewMode == VM_FirstPerson, it retries the bare id and keeps that third-person record only if its `mData.mPart` is MP_Hand(5), MP_Wrist(6), MP_Forearm(7) or MP_Upperarm(8), otherwise it sets bodypart = nullptr. Then `if (bodypart) addOrReplaceIndividualPart(part.mPart, group, priority, ...) else reserveIndividualPart((ESM::PartReferenceType)part.mPart, group, priority);` (:916-920) — so every robe part reference whose mesh could not be resolved still CLAIMS its part index at 24 with no mesh. Next the robe reserve block claims the 11 listed parts at 24, a no-op on anything the robe already set to 24. Net result at the fill loop: mPartPriorities[PRT_RForearm]=mPartPriorities[PRT_LForearm]=mPartPriorities[PRT_RUpperarm]=mPartPriorities[PRT_LUpperarm]=24, so `< 1` fails and the naked first-person forearm/upper-arm meshes are NEVER attached. The only geometry on those four bones is whatever the robe's own part list resolved to — which in first person can only be a THIRD-person mesh reached through the hand/wrist/forearm/upperarm fallback above. PRT_RHand(6), PRT_LHand(7), PRT_RWrist(8), PRT_LWrist(9) are not in the robe's reserve list, so unless the robe's own record references them they stay at priority 0 and get filled from the naked first-person table at priority 1. So: hands and wrists present, arm segments deleted, sleeves possibly present as third-person meshes. Nothing about this is first-person-specific in the reservation itself — a robe hides the naked chest, groin, legs and knees in third person by exactly the same mechanism.

```cpp
const char* ext = (mViewMode == VM_FirstPerson) ? ".1st" : "";
...
    bodypart = partStore.search(part.mMale);
    if (bodypart
        && !(bodypart->mData.mPart == ESM::BodyPart::MP_Hand
            || bodypart->mData.mPart == ESM::BodyPart::MP_Wrist
            || bodypart->mData.mPart == ESM::BodyPart::MP_Forearm
            || bodypart->mData.mPart == ESM::BodyPart::MP_Upperarm))
        bodypart = nullptr;
...
if (bodypart)
    addOrReplaceIndividualPart(static_cast<ESM::PartReferenceType>(part.mPart), group, priority,
        Misc::ResourceHelpers::correctMeshPath(bodypart->mModel.getNormalized()), enchantedGlow, glowColor);
else
    reserveIndividualPart((ESM::PartReferenceType)part.mPart, group, priority);
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> The priority arithmetic, the 11-part robe reserve list, the `reserveIndividualPart` no-op-on-equal semantics (:744, `if (priority > mPartPriorities[type])`), and the `< 1` fill-loop block at :682-690 are all faithful to the file. But the rule states as impossible something the code's FIRST branch does, and flattens two conditionals into constants. (1) Inverted/false universal. "The only geometry on those four bones is whatever the robe's own part list resolved to — which in first person can only be a THIRD-person mesh reached through the hand/wrist/forearm/upperarm fallback above." In first person the PRIMARY lookup at :882 / :898 is `partStore.search(<mFemale|mMale>.getRefIdString() + ext)` with `ext = ".1st"` (:879). If that `.1st` record exists, `bodypart` is non-null and the MP_Hand/MP_Wrist/MP_Forearm/MP_Upperarm filter is never reached — the mesh attached at priority 24 is a first-person equipment mesh. The bare-id retry at :883-891 / :899-907 is guarded by `if (!bodypart && mViewMode == VM_FirstPerson)`, i.e. it is a FALLBACK, reached only on a miss. Whether any given robe has a `.1st` part is a data question, not a code guarantee; the rule converts "usually absent in the data" into "can only be". A port written to this rule would omit the `.1st` equipment-part lookup entirely and invert the code's order of preference. (2) Omitted guard on the hand/wrist claim. "PRT_RHand(6), PRT_LHand(7), PRT_RWrist(8), PRT_LWrist(9) ... unless the robe's own record references them they stay at priority 0" ignores every other entry in `slotlist[]` (:590-598). Slot_LeftGauntlet / Slot_RightGauntlet (bracers and gauntlets) have mBasePriority 0, so armor there calls `addPartGroup(..., ((0+1)<<1)+1 = 3, ...)` and claims PRT_RHand/PRT_LHand — and a shirt (prio 2) can claim the wrists. They stay at 0 only when nothing else in the slotlist claims them, not merely "unless the robe references them". (3) prio = 24 is conditional, not fixed. `int prio = 1;` (:617) is overwritten only inside the Clothing branch (`((11+1)<<1)+0 = 24`, :622) or the Armor branch (`((11+1)<<1)+1 = 25`, :628). A robe-slot item that is neither leaves prio at 1, and the reserve block at :633-641 then reserves the 11 parts at 1 — which still blocks the `< 1` naked fill, but at a priority any clothing or armor can outrank. The rule presents 24 as the value of the case rather than as the Clothing-branch v ...


## [B] A helmet force-deletes hair before its own parts are added, and hair only returns if the helmet left PRT_Head alone
- `apps/openmw/mwrender/npcanimation.cpp:614-615, 650-655` - importance **medium**

The only per-slot special case besides Robe/Skirt: `if (slotlist[i].mSlot == MWWorld::InventoryStore::Slot_Helmet) removeIndividualPart(ESM::PRT_Hair);`. Placement matters — it sits AFTER `if (store == inv.end()) continue;` so it fires only when a helmet is actually equipped, and BEFORE prio is computed and addPartGroup runs, so the helmet's own part list can immediately re-add PRT_Hair at 2 (clothing) or 3 (armor). It is an unconditional removeIndividualPart, not a priority test: hair priority goes to 0 and its slot to -1 regardless of who owned it. Only PRT_Hair is force-removed; PRT_Head is not. Hair can then come back only through the later block, which requires BOTH conditions: `if (mPartPriorities[ESM::PRT_Hair] < 1 && mPartPriorities[ESM::PRT_Head] <= 1 && !mHairModel.empty())`. So a helmet whose part list supplies PRT_Head (priority 2 or 3, i.e. > 1) permanently suppresses hair — that is the closed-helm behaviour — while a helmet that touches only PRT_Hair or neither lets hair return at priority 1. Note the head test is `<= 1`, not `< 1`: head already added at priority 1 by the line above still permits hair. This whole block is additionally gated by `if (mViewMode != VM_FirstPerson)`, so in first person neither head nor hair is ever added and the helmet's forced hair removal simply stands.

```cpp
if (slotlist[i].mSlot == MWWorld::InventoryStore::Slot_Helmet)
    removeIndividualPart(ESM::PRT_Hair);
...
if (mViewMode != VM_FirstPerson)
{
    if (mPartPriorities[ESM::PRT_Head] < 1 && !mHeadModel.empty())
        addOrReplaceIndividualPart(ESM::PRT_Head, -1, 1, mHeadModel);
    if (mPartPriorities[ESM::PRT_Hair] < 1 && mPartPriorities[ESM::PRT_Head] <= 1 && !mHairModel.empty())
        addOrReplaceIndividualPart(ESM::PRT_Hair, -1, 1, mHairModel);
}
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> Most of the rule is accurate — the placement analysis (after the `store == inv.end()` continue at 611-612, before `int prio` at 617), the helmet priorities (mBasePriority 0 → clothing 2, armor 3), the unconditional nature of removeIndividualPart (sets priority 0 and slot -1, npcanimation.cpp:731-742), the `<= 1` vs `< 1` head asymmetry, the VM_FirstPerson gate, and the claim that racial hair can only return at 654-655 (the terminal body-part loop at 681 starts at PRT_Neck, and the enum is PRT_Head=0, PRT_Hair=1, PRT_Neck=2, so it can never touch Head or Hair). But the closing case split inverts the very guard the rule quotes. "A helmet that touches only PRT_Hair ... lets hair return at priority 1" is false: if the helmet's part list contains a PRT_Hair entry, addPartGroup (873-922) calls addOrReplaceIndividualPart at prio 2 or 3 — or, when the BodyPart record is missing/empty, reserveIndividualPart at the same prio — so mPartPriorities[PRT_Hair] becomes 2 or 3. The condition `mPartPriorities[ESM::PRT_Hair] < 1` at line 654 then fails and mHairModel is never re-added. So a hair-supplying helmet blocks racial hair exactly as firmly as a head-supplying one; only the "touches neither" case actually lets hair return at priority 1.


## [B] An attack is THREE play() calls on the same weapon group, and the wind-up's stop key is "<type> max attack", not "<type> stop"
- `apps/openmw/mwmechanics/character.cpp:1667-1668, 1674, 1704-1719, 1726-1730, 1758-1759, 1762-1817` - importance **critical**
- REFINES OR CORRECTS RECORDED RULE 11

CharacterController::updateWeaponState drives a melee/ranged attack as three separate playBlendedAnimation() calls on the SAME group (mCurrentWeapon, the long weapon group e.g. "weapononehand"), across three frames/states. Signature order is playBlendedAnimation(groupname, priority, blendMask, autodisable, speedmult, start, stop, startpoint, loops[, loopfallback]) (character.hpp:259-261); all three attack calls pass blendMask=BlendMask_All, autodisable=false, speedmult=weapSpeed, loops=0.

(1) WIND-UP, :1718-1719. startKey/stopKey are initialised to "start"/"stop" (:1667-1668). If mWeaponType != PickProbe AND !isRandomAttackAnimation(mCurrentWeapon), they are REPLACED at :1705-1706 by startKey = mAttackType + " start" and stopKey = mAttackType + " max attack". So the real text keys are e.g. "weapononehand: chop start" .. "weapononehand: chop max attack" — the stop key is "max attack", NOT "chop stop". startpoint=0. Sets mUpperBodyState = AttackWindUp (:1709) and clears mAttackSuccess=false, mAttackVictim=empty Ptr, mAttackHitPos=(0,0,0) (:1714-1716).

(2) RELEASE, :1785-1787. Entered when the state is AttackWindUp and (mWeaponType == PickProbe || isRandomAttackAnimation(mCurrentWeapon) || !getAttackingOrSpell()) — i.e. the attack button was let go (:1726-1728); state becomes AttackRelease, breakInvisibility() fires, and prepareHit() runs (:1755) for everything except PickProbe. The release play only happens if minAttackTime <= currentTime <= maxAttackTime, where currentTime = mAnimation->getCurrentTime(mCurrentWeapon), minAttackTime = getTextKeyTime(group + ": " + mAttackType + " min attack"), maxAttackTime = getTextKeyTime(group + ": " + mAttackType + " max attack") (:1766-1769). Both keys missing gives -1/-1 and the test fails (currentTime >= 0), so the release call is SKIPPED. It first calls mAnimation->disable(mCurrentWeapon) (:1785), then plays from "<mAttackType> max attack" to "<mAttackType> " + hit, where hit = (mAttackType != "shoot") ? "hit" : "release" (:1771).

(3) FOLLOW, :1811-1812. After re-reading animPlaying = getInfo(mCurrentWeapon, &complete) (:1790), it fires when !animPlaying || (currentTime >= maxAttackTime && complete >= 1.f) (:1793). Sets mReadyToHit = false (:1807), disables the group if still playing (:1809-1810), plays "<mAttackType> <maybe bucket >follow start" .. "<mAttackType> <maybe bucket >follow stop" with startpoint 0, then sets mUpperBodyState = AttackEnd (:1813).

EXCEPTION — one call only: for mWeaponType == PickProbe or a random attack animation (attack1/2/3, swimattack1/2/3), the state jumps AttackRelease -> AttackEnd immediately at :1758-1759, so calls (2) and (3) never run; those animations play their single unprefixed "start".."stop" section to the end. The spell-casting branch is a different, single call at :1659-1660 with speedmult hardcoded to 1.

```cpp
1705:  startKey = mAttackType + ' ' + startKey;
1706:  stopKey = mAttackType + " max attack";
1718:  playBlendedAnimation(mCurrentWeapon, priorityWeapon, MWRender::BlendMask_All, false, weapSpeed,
1719:      startKey, stopKey, 0.0f, 0);
...
1771:  std::string hit = mAttackType != "shoot" ? "hit" : "release";
1785:  mAnimation->disable(mCurrentWeapon);
1786:  playBlendedAnimation(mCurrentWeapon, priorityWeapon, MWRender::BlendMask_All, false, weapSpeed,
1787:      mAttackType + " max attack", mAttackType + ' ' + hit, startPoint, 0);
...
1811:  playBlendedAnimation(mCurrentWeapon, priorityWeapon, MWRender::BlendMask_All, false, weapSpeed,
1812:      mAttackType + ' ' + start, mAttackType + ' ' + stop, 0.0f, 0);
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> Almost every structural claim checks out against apps/openmw/mwmechanics/character.cpp (verified copy: /tmp/claude-0/-home-user-project-dagger/0ec83e1e-fa7a-575c-b46a-fc71a6754acb/scratchpad/character.cpp) — the signature at character.hpp:259-261, the three same-group calls at 1718-1719 / 1786-1787 / 1811-1812 with BlendMask_All, autodisable=false, weapSpeed, loops=0; the "max attack" stop key at 1706; the AttackWindUp set at 1709 and result reset at 1714-1716; the release gate at 1726-1728 with prepareHit() at 1755; the follow gate at 1793 and AttackEnd at 1813; the PickProbe/random-attack short-circuit at 1758-1759; and the single speedmult=1 casting call at 1659-1660. But one asserted behaviour is inverted, and it is stated as unconditional fact. The rule says: "Both keys missing gives -1/-1 and the test fails (currentTime >= 0), so the release call is SKIPPED." currentTime >= 0 is NOT guaranteed. Animation::getCurrentTime returns -1.f when the group has no active AnimState (mwrender/animation.cpp:1247-1254: `if (iter == mStates.end()) return -1.f;`). That is exactly the state produced when the keys are missing: Animation::reset bails out with `return false` if the start key or the stop key is absent (animation.cpp:992-993, 1003-1004), so Animation::play never inserts a state for the group (animation.cpp:918-966). A weapon group with no "<type> max attack" key therefore fails the wind-up play at 1718-1719 while mUpperBodyState is still set to AttackWindUp unconditionally at 1709, leaving getCurrentTime(mCurrentWeapon) == -1.f. And the group is genuinely empty at that point: the previous cycle disables it at 1835-1836 before returning to WeaponEquipped, which is the state the wind-up branch requires (1514). So in the very case the rule describes, the test at 1769 is -1.f <= -1.f && -1.f <= -1.f, which is TRUE — the branch is entered, mAnimation->disable(mCurrentWeapon) runs at 1785 and the release playBlendedAnimation at 1786-1787 is issued (it then no-ops inside Animation::play for the same missing-key reason). The release call is not skipped; the guard passes. The stated conclusion and its stated justification are both wrong. Secondary (not the basis for refutation, but it blocks implementing from the rule): the rule pins startpoint=0 for calls (1) and (3) but leaves call (2)'s startPoint as an unexplained token, when it is computed at 1773-1783 as start ...


## [B] The release startPoint is 1 - mAttackStrength, rescaled by (minHit-maxAttack)/(hit-maxAttack) ONLY when maxAttack <= minHit < hit
- `apps/openmw/mwmechanics/character.cpp:1766-1787` - importance **high**

The startpoint argument of the RELEASE play() call (call 2 of the attack triad) is computed at character.cpp:1773-1783 as a normalised fraction in [0,1) of the played span ("<type> max attack" -> "<type> hit"/"<type> release"):

  startPoint = 0
  if (minAttackTime != -1 && minAttackTime < maxAttackTime):
      startPoint = 1 - mAttackStrength
      minHitTime = getTextKeyTime(group + ": " + mAttackType + " min hit")
      hitTime    = getTextKeyTime(group + ": " + mAttackType + " " + hit)   // hit = "hit", or "release" when mAttackType == "shoot"
      if (maxAttackTime <= minHitTime && minHitTime < hitTime):
          startPoint *= (minHitTime - maxAttackTime) / (hitTime - maxAttackTime)

Exact conditions and edges:
- The whole block is gated on the "min attack" key EXISTING (getTextKeyTime returns -1 when absent, per rule 46) and on minAttackTime < maxAttackTime STRICTLY. If either fails, startPoint stays 0.0 and the release section plays from its very beginning regardless of attack strength.
- The rescale is a SEPARATE, stricter gate. It needs BOTH "min hit" and the hit/release key present and ordered maxAttackTime <= minHitTime < hitTime. A missing "min hit" gives minHitTime = -1, so maxAttackTime <= -1 is false (maxAttackTime >= 0 here) and no rescale happens. A missing hit key gives hitTime = -1, so minHitTime < -1 is false. Note NEITHER value is tested against the -1 sentinel directly — only the ordering comparisons filter them.
- The multiplier is in [0,1) whenever the gate passes (numerator >= 0, strictly less than the denominator), so it only ever shrinks the skip.
- Semantics: mAttackStrength == 1.0 (fully wound-up) gives startPoint 0 and the full pre-hit swing plays; mAttackStrength == 0.0 gives the maximum skip. Since a MISSED melee attack sets mAttackStrength = 0 (see the prepareHit rule), a whiff always takes the maximum skip.
- No clamping is applied; mAttackStrength is already clamped to [0,1] upstream.
- startPoint is passed as the 8th argument of playBlendedAnimation and is a FRACTION of the start->stop span, not a time.

```cpp
1773:  float startPoint = 0.f;
1774:
1775:  // Skip a bit of the pre-hit section based on the attack strength
1776:  if (minAttackTime != -1.f && minAttackTime < maxAttackTime)
1777:  {
1778:      startPoint = 1.f - mAttackStrength;
1779:      float minHitTime = mAnimation->getTextKeyTime(mCurrentWeapon + ": " + mAttackType + " min hit");
1780:      float hitTime = mAnimation->getTextKeyTime(mCurrentWeapon + ": " + mAttackType + ' ' + hit);
1781:      if (maxAttackTime <= minHitTime && minHitTime < hitTime)
1782:          startPoint *= (minHitTime - maxAttackTime) / (hitTime - maxAttackTime);
1783:  }
```

**Recorded caveat** (the mechanism is sound; this is the condition it
must not be read past):

> Every operative claim in the rule checks out against apps/openmw/mwmechanics/character.cpp:1762-1787 — the line numbers, the outer gate (minAttackTime != -1.f && minAttackTime < maxAttackTime), the nested rescale gate (maxAttackTime <= minHitTime && minHitTime < hitTime), the "shoot" -> "release" key swap, the observation that neither minHitTime nor hitTime is tested against -1 directly, the absence of clamping, and the 8th-argument fraction semantics (playBlendedAnimation at character.cpp:2610-2612; animation.hpp:392-393 documents "0 starts at the start marker, 1 starts at the stop marker"; Animation::reset at animation.cpp:1022 computes mStartTime + (mStopTime - mStartTime) * startpoint). getTextKeyTime returning -1.f when absent is confirmed at animation.cpp:853. mAttackStrength in [0,1] upstream is confirmed (calculateWindUp's std::clamp at character.cpp:1246-1247; prepareHit's std::min(1.f, 0.1f + roll) at 1259 and = 0.f on a melee miss at 1267), and the -1.f sentinel written at character.cpp:1517 cannot reach line 1778 because AttackRelease is only ever set at line 1730, immediately before prepareHit() at 1755. The defect is the headline range. The rule opens by asserting startPoint is "a normalised fraction in [0,1)", i.e. strictly less than 1. That is false on a reachable path and the rule contradicts itself two bullets later. When the outer gate passes, startPoint = 1.f - mAttackStrength (line 1778); the rescale at 1782 is a separate, stricter gate that the rule itself correctly says does NOT fire when the "min hit" key is absent. So with mAttackStrength == 0.f and no "min hit" key, startPoint stays exactly 1.0 and the play call starts at the stop marker, skipping the entire "max attack" -> "hit"/"release" section. Nothing clamps or decrements it. This is not a hypothetical: a missed melee attack sets mAttackStrength = 0.f exactly (character.cpp:1265-1267), and the "shoot" branch looks up "<type> min hit" even though its stop key is "<type> release" — the only reference to " min hit" anywhere in apps/openmw — so a bow whose animation lacks a "shoot min hit" key takes the un-rescaled path. The rule's own semantics bullet ("mAttackStrength == 0.0 gives the maximum skip") describes precisely the startPoint == 1.0 case that its stated interval excludes. The multiplier alone is correctly in [0,1); startPoint is not.


---

# Tier C - extracted, NOT yet verified

The reader's words, unchallenged. Treat each as a strong lead rather than a
settled rule, and verify before writing code against it.

## [C] mAttackStrength is the wind-up fraction between "min attack" and "max attack", falls back to a random 0.1..1.0, and is ZEROED on a melee miss
- `apps/openmw/mwmechanics/character.cpp:1235-1272, 2934-2938` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

mAttackStrength is the single float that drives both the release startPoint and the follow bucket. It is set exactly once per attack, in prepareHit() (character.cpp:1250-1272), which is called from the AttackWindUp -> AttackRelease transition at :1755 (for everything except PickProbe) and early, from the text-key handler, for random attack animations that have no "hit" key (:1140).

prepareHit():
1. `if (mReadyToHit) return;` — idempotent guard, so it never re-rolls within one attack.
2. mAttackStrength = calculateWindUp(); mAttackWindUp = mAttackStrength;  (mAttackWindUp keeps the raw value, including -1)
3. calculateWindUp() (:1235-1248) returns -1.f if (!mAnimation || mCurrentWeapon.empty() || mWeaponType == PickProbe || isRandomAttackAnimation(mCurrentWeapon)); it then reads minAttackTime = getTextKeyTime(group + ": " + mAttackType + " min attack") and maxAttackTime = getTextKeyTime(group + ": " + mAttackType + " max attack") and returns -1.f if (minAttackTime == -1.f || minAttackTime >= maxAttackTime); otherwise it returns std::clamp((getCurrentTime(mCurrentWeapon) - minAttackTime) / (maxAttackTime - minAttackTime), 0.f, 1.f).
4. `if (mAttackStrength == -1.f) mAttackStrength = std::min(1.f, 0.1f + rollClosedProbability(prng));` — rollClosedProbability is [0.0, 1.0] INCLUSIVE (components/misc/rng.hpp:31-32), so the fallback is uniform on [0.1, 1.0] with a point mass at 1.0 from the min().
5. weapclass = getWeaponType(mWeaponType)->mWeaponClass. If weapclass != Ranged: if weapclass != Thrown, mAttackSuccess = mPtr.getClass().evaluateHit(mPtr, mAttackVictim, mAttackHitPos) and, when that is false, mAttackStrength = 0.f. Then playSwishSound() runs (for melee AND thrown, not for ranged).
6. mReadyToHit = true.

Consequences a port must reproduce: a melee MISS drives mAttackStrength to 0, which makes the release startPoint the maximum skip (1 x the rescale factor) and forces the "small" follow bucket. Ranged and thrown attacks never zero it. isRandomAttackAnimation(group) is the exact set {"attack1","swimattack1","attack2","swimattack2","attack3","swimattack3"} (:2934-2938).

```cpp
1250:  void CharacterController::prepareHit()
1251:  {
1252:      if (mReadyToHit)
1253:          return;
1254:
1255:      auto& prng = MWBase::Environment::get().getWorld()->getPrng();
1256:      mAttackStrength = calculateWindUp();
1257:      mAttackWindUp = mAttackStrength;
1258:      if (mAttackStrength == -1.f)
1259:          mAttackStrength = std::min(1.f, 0.1f + Misc::Rng::rollClosedProbability(prng));
1260:      ESM::WeaponType::Class weapclass = getWeaponType(mWeaponType)->mWeaponClass;
1261:      if (weapclass != ESM::WeaponType::Ranged)
1262:      {
1263:          if (weapclass != ESM::WeaponType::Thrown)
1264:          {
1265:              mAttackSuccess = mPtr.getClass().evaluateHit(mPtr, mAttackVictim, mAttackHitPos);
1266:              if (!mAttackSuccess)
1267:                  mAttackStrength = 0.f;
```

## [C] mAttackType is a five-branch decision: "shoot" for Ranged AND Thrown, then best-attack vs movement-based for the player (chosen by the [Game] "best attack" setting, default false), AI-desired for AI-disabled actors, and AiCombat's value otherwise
- `apps/openmw/mwmechanics/character.cpp:65-78, 1674-1706, 2924-2932, 3014-3022` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

Chosen once, at the start of the wind-up (character.cpp:1674-1706). The entire block is skipped when mWeaponType == ESM::Weapon::PickProbe OR isRandomAttackAnimation(mCurrentWeapon); in that case mAttackType is left untouched and the wind-up keys stay the unprefixed "start"/"stop".

Order of branches, first match wins:
1. weapclass (== getWeaponType(mWeaponType)->mWeaponClass) is Ranged OR Thrown  ->  mAttackType = "shoot". Note THROWN counts, not just bows.
2. else if mPtr == getPlayer():
   a. if Settings::game().mBestAttack — the config key is [Game] "best attack" (components/settings/categories/game.hpp:26), default `best attack = false` (files/settings-default.cfg:270):
      - if mWeapon is non-empty AND mWeapon.getType() == ESM::Weapon::sRecordId -> getBestAttack(record)
      - else (hand-to-hand; there is no best attack for H2H) -> getRandomAttackType()
   b. else -> getMovementBasedAttackType()
3. else if aiInactive, where aiInactive = actorControls->mDisableAI || !MechanicsManager::isAIActive() -> mAttackType = getDesiredAttackType() (i.e. CreatureStats::getAttackType()); if that is the empty string, mAttackType = getRandomAttackType().
4. else (a non-player actor with AI running): mAttackType is NOT assigned — the value AiCombat previously pushed through setAIAttackType() is used as-is.

The three producers, verbatim:
- getBestAttack(const ESM::Weapon*) (character.cpp:65-78, file-static): slash = mData.mSlash[0] + mData.mSlash[1]; chop = mData.mChop[0] + mData.mChop[1]; thrust = mData.mThrust[0] + mData.mThrust[1] (each pair is {min,max} as unsigned char, summed in int). Then: if (slash == chop && slash == thrust) return "slash"; else if (thrust >= chop && thrust >= slash) return "thrust"; else if (slash >= chop && slash >= thrust) return "slash"; else return "chop". So a three-way tie yields slash, thrust wins any tie it is part of, and chop is only ever returned when it is the strict maximum.
- getMovementBasedAttackType() (character.cpp:2924-2932): float* move = mPtr.getClass().getMovementSettings(mPtr).mPosition;  if (abs(move[1]) > abs(move[0]) + 0.2f) return "thrust";  if (abs(move[0]) > abs(move[1]) + 0.2f) return "slash";  return "chop". move[0] is the sideways (left/right) axis, move[1] the forward/back axis. The 0.2f is a deadband: an axis must exceed the other by MORE than 0.2 to win, so standing still, or moving diagonally, yields "chop".
- getRandomAttackType() (character.cpp:3014-3022): random = Misc::Rng::rollProbability(world->getPrng()) in [0,1) (open upper bound); if (random >= 2/3.f) return "thrust"; if (random >= 1/3.f) return "slash"; return "chop" — three equal thirds, with the boundaries going to the higher tier.

```cpp
1676:  if (weapclass == ESM::WeaponType::Ranged || weapclass == ESM::WeaponType::Thrown)
1677:      mAttackType = "shoot";
1678:  else if (mPtr == getPlayer())
1680:      if (Settings::game().mBestAttack)
1684:              mAttackType = getBestAttack(mWeapon.get<ESM::Weapon>()->mBase);
1689:              mAttackType = getRandomAttackType();
1694:              mAttackType = getMovementBasedAttackType();
1697:  else if (aiInactive)
1699:      mAttackType = getDesiredAttackType();
1700:      if (mAttackType == "")
1701:          mAttackType = getRandomAttackType();
...
2926:  float* move = mPtr.getClass().getMovementSettings(mPtr).mPosition;
2927:  if (std::abs(move[1]) > std::abs(move[0]) + 0.2f) // forward-backward
2928:      return "thrust";
2929:  if (std::abs(move[0]) > std::abs(move[1]) + 0.2f) // sideway
2930:      return "slash";
2931:  return "chop";
```

## [C] weapSpeed is the WEAP record's float mData.mSpeed, is 1.0 for everything else, and scales ONLY the three attack play() calls
- `apps/openmw/mwmechanics/character.cpp:1298, 1320-1326, 1718, 1786, 1811` - importance **medium**
- **UNVERIFIED** - extracted by one reader, never challenged

weapSpeed is a function-local float in CharacterController::updateWeaponState, re-derived from scratch on every call. It is initialised `float weapSpeed = 1.f;` at character.cpp:1298 and is overwritten in exactly one place, character.cpp:1320-1326, under a conjunction of four conditions, ALL of which must hold:
  cls.hasInventoryStore(mPtr)          (the enclosing `if` at :1299)
  && stats.getDrawState() == DrawState::Weapon
  && !mWeapon.isEmpty()
  && mWeapon.getType() == ESM::Weapon::sRecordId
and then `weapSpeed = mWeapon.get<ESM::Weapon>()->mBase->mData.mSpeed;`.

That field is `float mSpeed` inside ESM::Weapon::WPDTstruct (components/esm3/loadweap.hpp:71 — `float mSpeed, mReach;`, a 32-byte struct laid out as float mWeight; int32_t mValue; int16_t mType; uint16_t mHealth; float mSpeed, mReach; uint16_t mEnchant; unsigned char mChop[2], mSlash[2], mThrust[2]; int32_t mFlags). It is a raw multiplier, NOT clamped or normalised anywhere on this path.

weapSpeed therefore stays 1.0 for: hand-to-hand, spell casting, lockpicks and probes (Lockpick/Probe records, not WEAP), creatures with no inventory store, and any actor whose draw state is not Weapon.

Where it is used: as the `speedmult` (5th) argument of the three attack play() calls only — the wind-up (:1718), the release (:1786) and the follow (:1811). It is NOT applied to the equip/unequip animations (:1406-1407 and :1465-1466 pass 1.0f), nor to the spell-cast animation (:1659 passes literal 1), nor to hit/recovery (:490 passes 1), nor to the torch animation (:1341 passes 1.0f). A port that multiplies the whole weapon group's playback rate by weapon speed instead of only the three attack sections will drift on the draw/sheathe timing.

```cpp
1298:  float weapSpeed = 1.f;
...
1323:  if (stats.getDrawState() == DrawState::Weapon && !mWeapon.isEmpty()
1324:      && mWeapon.getType() == ESM::Weapon::sRecordId)
1325:  {
1326:      weapSpeed = mWeapon.get<ESM::Weapon>()->mBase->mData.mSpeed;
```

## [C] "equip attach"/"unequip detach" create and destroy the weapon mesh, but ONLY while mUpperBodyState is exactly Equipping/Unequipping — and a missing key is compensated for at animation start
- `apps/openmw/mwrender/npcanimation.cpp:953-989 (plus 731-741, 768-796, 257); character.cpp:1074-1087, 1412-1414, 1451, 1469-1474` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

The weapon mesh node's whole lifetime is driven by two text keys, dispatched through CharacterController::handleTextKey (character.cpp:1074-1087) after the group filter of rule 47 has already guaranteed groupname == the currently playing group:

  if (action == "equip attach")   { if (groupname == "shield") showCarriedLeft(true);  else if (mUpperBodyState == UpperBodyState::Equipping)   mAnimation->showWeapons(true); }
  else if (action == "unequip detach") { if (groupname == "shield") showCarriedLeft(false); else if (mUpperBodyState == UpperBodyState::Unequipping) mAnimation->showWeapons(false); }

The state test is an EXACT equality, not a range: an "equip attach" key crossed in any other upper-body state (WeaponEquipped, AttackWindUp, ...) is a no-op. "shield" is special-cased before the state test and is never state-gated.

Missing-key compensation, both immediate rather than deferred:
- Unequip (:1412-1414): right after starting the unequip animation and calling detachArrow(), `if (mAnimation->getTextKeyTime(weapgroup + ": unequip detach") < 0) mAnimation->showWeapons(false);`
- Equip (:1469-1474): `if (weaptype != ESM::Weapon::Spell && mAnimation->getTextKeyTime(weapgroup + ": equip attach") < 0) mAnimation->showWeapons(true);`
Note the equip path also calls showWeapons(false) UNCONDITIONALLY at :1451 immediately before entering the Equipping state, and :1377 forces showWeapons(true) when the weapon type changes mid-attack.

NpcAnimation::showWeapons(bool) (mwrender/npcanimation.cpp:953-989) is the whole mechanism:
  mShowWeapons = showWeapon; mAmmunition.reset();   // the arrow/bolt node is dropped on BOTH show and hide
  if (showWeapon): look up inv slot Slot_CarriedRight; if present, glowColor = getEnchantmentColor(weapon), mesh = weapon.getClass().getCorrectedModel(weapon), then addOrReplaceIndividualPart(ESM::PRT_Weapon, Slot_CarriedRight, priority 1, mesh, enchantedGlow = !getEnchantment(weapon).empty(), &glowColor). Then, only for a WEAP record whose mData.mType == MarksmanCrossbow and whose Slot_Ammunition item's mData.mType equals getWeaponType(MarksmanCrossbow)->mAmmoType, attachArrow() is called — crossbows come out already loaded.
  else: removeIndividualPart(ESM::PRT_Weapon); and, if mPtr is the player, getCreatureStats(mPtr).setAttackingOrSpell(false) — hiding the player's weapon cancels the attack.
  Both branches end with updateHolsteredWeapon(!mShowWeapons); updateQuiver();

removeIndividualPart (:731-741) is the destructor: mPartPriorities[type] = 0; mPartslots[type] = -1; mObjectParts[type].reset(); and, if mSounds[type] != nullptr && !mSoundsDisabled, stopSound(mSounds[type]) and mSounds[type] = nullptr.
addOrReplaceIndividualPart (:768-...) begins with `if (priority <= mPartPriorities[type]) return false;` — since showWeapons always passes priority 1, calling showWeapons(true) while the weapon is ALREADY shown (mPartPriorities[PRT_Weapon] == 1) returns false and does NOT rebuild the mesh, though mAmmunition has already been reset. The attach bone is sPartList[PRT_Weapon] == "Weapon Bone" (:257, commented "Fallback. The real node name depends on the current weapon type."), overridden by the equipped weapon type's mAttachBone when that node exists in the actor (rule 17).

```cpp
953:  void NpcAnimation::showWeapons(bool showWeapon)
955:      mShowWeapons = showWeapon;
956:      mAmmunition.reset();
965:          addOrReplaceIndividualPart(ESM::PRT_Weapon, MWWorld::InventoryStore::Slot_CarriedRight, 1, mesh,
966:              !weapon->getClass().getEnchantment(*weapon).empty(), &glowColor);
981:          removeIndividualPart(ESM::PRT_Weapon);
983:          if (mPtr == MWMechanics::getPlayer())
984:              mPtr.getClass().getCreatureStats(mPtr).setAttackingOrSpell(false);
987:      updateHolsteredWeapon(!mShowWeapons);
988:      updateQuiver();
---- character.cpp ----
1074:  if (action == "equip attach")
1076:      if (groupname == "shield")
1077:          mAnimation->showCarriedLeft(true);
1078:      else if (mUpperBodyState == UpperBodyState::Equipping)
1079:          mAnimation->showWeapons(true);
1081:  else if (action == "unequip detach")
1085:      else if (mUpperBodyState == UpperBodyState::Unequipping)
1086:          mAnimation->showWeapons(false);
```

## [C] Actor scale is Npc::adjustScale, and first person multiplies ALL THREE axes by race HEIGHT only
- `apps/openmw/mwclass/npc.cpp:1102-1136` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

There is no `getModelScale` in npc.cpp; the function is `void Npc::adjustScale(const MWWorld::ConstPtr& ptr, osg::Vec3f& scale, bool rendering) const` at apps/openmw/mwclass/npc.cpp:1102. It MULTIPLIES INTO the caller's vector in place and never assigns it. Every caller seeds it with the uniform cellref scale s as (s,s,s). Sex is `(NPC.mFlags & 0x01) == 0` -> male (ESM::NPC::Female = 0x01, loadnpc.cpp:240-243). Race is fetched per call as store.get<ESM::Race>().find(ref->mBase->mRace) — the NPC's own race, which does NOT change in werewolf form. THIRD PERSON (and every non-player NPC, always): pick w = mMaleWeight/mFemaleWeight and h = mMaleHeight/mFemaleHeight by sex, then scale.x *= w; scale.y *= w; scale.z *= h. Weight NEVER touches Z; height NEVER touches X or Y. Final node scale = (s*w, s*w, s*h). FIRST PERSON (player only, see the three-part condition rule): `scale *= h` — osg::Vec3f *= float scales ALL THREE components by the sex-matched HEIGHT — then `return`, so race WEIGHT is applied to no axis at all. Final node scale = (s*h, s*h, s*h), i.e. uniform. The branches are mutually exclusive: the first-person branch returns before the weight code. NpcAnimation itself never calls setScale anywhere (grep 'Scale' in npcanimation.cpp hits only line 305); the vector lands on the Ptr's base PositionAttitudeTransform, under which the first-person hand parts hang, so the hands inherit exactly this uniform factor.

```cpp
void Npc::adjustScale(const MWWorld::ConstPtr& ptr, osg::Vec3f& scale, bool rendering) const
{
    if (!rendering)
        return; // collision meshes are not scaled based on race height
                // having the same collision extents for all races makes the environments easier to test

    const MWWorld::LiveCellRef<ESM::NPC>* ref = ptr.get<ESM::NPC>();

    const ESM::Race* race = MWBase::Environment::get().getESMStore()->get<ESM::Race>().find(ref->mBase->mRace);

    // Race weight should not affect 1st-person meshes, otherwise it will change hand proportions and can break
    // aiming.
    if (ptr == MWMechanics::getPlayer() && ptr.isInCell() && MWBase::Environment::get().getWorld()->isFirstPerson())
    {
        if (ref->mBase->isMale())
            scale *= race->mData.mMaleHeight;
        else
            scale *= race->mData.mFemaleHeight;

        return;
    }

    if (ref->mBase->isMale())
    {
        scale.x() *= race->mData.mMaleWeight;
        scale.y() *= race->mData.mMaleWeight;
        scale.z() *= race->mData.mMaleHeight;
    }
    else
    {
        scale.x() *= race->mData.mFemaleWeight;
        scale.y() *= race->mData.mFemaleWeight;
        scale.z() *= race->mData.mFemaleHeight;
    }
}
```

## [C] The first-person branch needs THREE conditions, and isInCell() is what keeps the inventory paperdoll on the third-person formula
- `apps/openmw/mwclass/npc.cpp:1112-1122` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

The first-person scale path at npc.cpp:1114 fires only when all three of these hold, in this order: (1) `ptr == MWMechanics::getPlayer()` — MWWorld::PtrBase::operator== compares the mRef LiveCellRefBase POINTER, not the RefId and not the cell (ptr.hpp:116-119: `return mRef == other.mRef;`); (2) `ptr.isInCell()` — defined as `(mContainerStore == nullptr) && (mCell != nullptr)` (ptr.hpp:85); (3) `World::isFirstPerson()` — which reads the CAMERA, `mRendering->getCamera()->getMode() == MWRender::Camera::Mode::FirstPerson` (worldimp.cpp:2186-2189), NOT NpcAnimation::mViewMode. The engine's stated reason for the branch, verbatim at npc.cpp:1112-1113, is: "Race weight should not affect 1st-person meshes, otherwise it will change hand proportions and can break aiming." So: applying race weight to the X/Y of a first-person hand mesh is considered a correctness bug (broken aim), not a cosmetic one. The isInCell() clause is load-bearing for the inventory paperdoll: InventoryPreview::updatePtr builds `mCharacter = MWWorld::Ptr(ptr.getBase(), nullptr)` (characterpreview.cpp:478) — same mRef pointer, so condition (1) is TRUE, but mCell is null so isInCell() is FALSE. The paperdoll therefore always takes the third-person (weight-on-XY, height-on-Z) formula even while the player is in first person. RaceSelectionPreview uses its own separate LiveCellRef (characterpreview.cpp:502) so condition (1) is false for it as well.

```cpp
    // Race weight should not affect 1st-person meshes, otherwise it will change hand proportions and can break
    // aiming.
    if (ptr == MWMechanics::getPlayer() && ptr.isInCell() && MWBase::Environment::get().getWorld()->isFirstPerson())
    {
        if (ref->mBase->isMale())
            scale *= race->mData.mMaleHeight;
        else
            scale *= race->mData.mFemaleHeight;

        return;
    }
```

## [C] The rendering-only guard: NPC collision extents carry NO race height or weight, and the physics actor computes BOTH scales
- `apps/openmw/mwphysics/actor.cpp:250-262` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

When `rendering == false`, Npc::adjustScale returns at npc.cpp:1104-1105 having multiplied nothing, with the comment "collision meshes are not scaled based on race height / having the same collision extents for all races makes the environments easier to test". So an NPC's collision capsule is scaled ONLY by the cellref scale s, identically for every race and both sexes; race height/weight is a purely visual transform. MWPhysics::Actor::updateScaleUnsafe (mwphysics/actor.cpp:250-262) computes both variants in one pass: it seeds scaleVec = (s,s,s), calls adjustScale(..., false), stores mScale = scaleVec and mHalfExtents = componentMultiply(mOriginalHalfExtents, scaleVec); then it RE-SEEDS `scaleVec = osg::Vec3f(scale, scale, scale)` (this reset is essential — the vector is an in/out parameter) and calls adjustScale(..., true) to get mRenderingHalfExtents = componentMultiply(mOriginalHalfExtents, (s*w, s*w, s*h)). Consumers split by which one they take: the collision/movement solver uses mHalfExtents (ActorFrameData mHalfExtentsZ, physicssystem.cpp:900); the swim level uses the RENDERING extents — `waterlevel - (actor.getRenderingHalfExtents().z() * 2 * fSwimHeightScale)` (physicssystem.cpp:889-895) — as does World::isUnderwater, `pos.z() += heightRatio * 2 * mPhysics->getRenderingHalfExtents(object).z()` (worldimp.cpp:2135); World::getHalfExtents(object, rendering) routes on its bool to getRenderingHalfExtents vs getHalfExtents for actors (worldimp.cpp:3578-3588). Net effect for a port: a tall Nord and a short Bosmer have the same collision cylinder but different swim/wade thresholds and different visual heights.

```cpp
void Actor::updateScaleUnsafe()
{
    float scale = mPtr.getCellRef().getScale();
    osg::Vec3f scaleVec(scale, scale, scale);

    mPtr.getClass().adjustScale(mPtr, scaleVec, false);
    mScale = scaleVec;
    mHalfExtents = osg::componentMultiply(mOriginalHalfExtents, scaleVec);

    scaleVec = osg::Vec3f(scale, scale, scale);
    mPtr.getClass().adjustScale(mPtr, scaleVec, true);
    mRenderingHalfExtents = osg::componentMultiply(mOriginalHalfExtents, scaleVec);
}
```

## [C] setViewMode re-applies the scale BEFORE rebuild(), with a forced no-op scaleObject whose only purpose is to re-run adjustScale
- `apps/openmw/mwrender/npcanimation.cpp:295-317` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

NpcAnimation::setViewMode (npcanimation.cpp:295-317) runs in this exact order, and the order matters: (1) `assert(viewMode != VM_HeadOnly)` — head-only is a construction-time mode only; (2) early return if mViewMode == viewMode, so re-entrant or repeated calls are free no-ops; (3) compute `bool viewChange = mViewMode == VM_FirstPerson || viewMode == VM_FirstPerson` from the OLD mViewMode, BEFORE assignment — true only when first person is on one side of the transition; (4) `mViewMode = viewMode`; (5) `World::scaleObject(mPtr, mPtr.getCellRef().getScale(), true)` with the comment "apply race height after view change" — it passes the scale the ref ALREADY has, so the value never changes; force=true exists purely to defeat the guard `if (!force && scale == ptr.getCellRef().getScale()) return;` (worldimp.cpp:1141-1142) and force a re-run of adjustScale now that isFirstPerson() reports the new mode; (6) mAmmunition.reset(); (7) rebuild(); (8) setRenderBin(); (9) only if viewChange AND Settings::game().mShieldSheathing, re-evaluate showCarriedLeft(updateCarriedLeftVisible(weaptype)). So the base-node scale is written while the OLD skeleton is still attached, and rebuild() — `mScabbard.reset(); mHolsteredShield.reset(); updateNpcBase();` plus a mechanics forceStateUpdate (npcanimation.cpp:435-442) — does not touch or restore it; the scale lives on the Ptr's base transform, above everything rebuild() replaces, so it survives. Re-entrancy to be aware of when porting: World::scaleObject -> Scene::updateObjectScale -> RenderingManager::scaleObject, which calls Camera::processViewChange() again when the ptr is the camera's tracking ptr; that inner call re-enters setViewMode, hits the step-2 early return, and picks a tracking node off the not-yet-rebuilt skeleton — the outer Camera::processViewChange re-assigns mTrackingNode after setViewMode returns (camera.cpp:352-356), which is what makes the final value correct.

```cpp
void NpcAnimation::setViewMode(NpcAnimation::ViewMode viewMode)
{
    assert(viewMode != VM_HeadOnly);
    if (mViewMode == viewMode)
        return;
    // FIXME: sheathing state must be consistent if the third person skeleton doesn't have the necessary node, but
    // third person skeleton is unavailable in first person view. This is a hack to avoid cosmetic issues.
    bool viewChange = mViewMode == VM_FirstPerson || viewMode == VM_FirstPerson;
    mViewMode = viewMode;
    MWBase::Environment::get().getWorld()->scaleObject(
        mPtr, mPtr.getCellRef().getScale(), true); // apply race height after view change

    mAmmunition.reset();
    rebuild();
    setRenderBin();
```

## [C] Where the scale vector is seeded and where it lands - and Camera::mHeightScale IS the race height
- `apps/openmw/mwrender/renderingmanager.cpp:818-824` - importance **medium**
- REFINES OR CORRECTS RECORDED RULE 54
- **UNVERIFIED** - extracted by one reader, never challenged

adjustScale(rendering=true) has exactly three seeding sites, and they do not all seed the same way. (a) Objects::insertBegin, at spawn: `const float scale = ptr.getCellRef().getScale(); osg::Vec3f scaleVec(scale, scale, scale); ptr.getClass().adjustScale(ptr, scaleVec, true); insert->setScale(scaleVec);` (mwrender/objects.cpp:66-69). (b) Scene::updateObjectScale, on every rescale: same three lines, then `mRendering.scaleObject(ptr, scaleVec); mPhysics->updateScale(ptr);` (mwworld/scene.cpp:341-348) — note the physics call re-seeds from the cellref itself, it does not reuse this vector. (c) InventoryPreview::onSetup seeds `osg::Vec3f scale(1.f, 1.f, 1.f)` — the identity, NOT the cellref scale — calls adjustScale(..., true), does `mNode->setScale(scale)`, and then builds its view matrix as `osg::Matrixf::lookAt(mPosition * scale.z(), mLookAt * scale.z(), osg::Vec3f(0,0,1))`, i.e. the paperdoll camera position and look-at are both scaled by the race HEIGHT so a tall race is framed identically (characterpreview.cpp:481-491). The landing point is RenderingManager::scaleObject: `ptr.getRefData().getBaseNode()->setScale(scale); if (ptr == mCamera->getTrackingPtr()) mCamera->processViewChange();` (renderingmanager.cpp:818-824) — that conditional call is the mechanism that refreshes the camera height. This pins down rule 54's mHeightScale: in third person Camera::processViewChange sets `mHeightScale = transform->getScale().z()` (camera.cpp:361-366), and that Z is exactly cellrefScale * race height (male or female) — NOT a weight and NOT the uniform ref scale; in first person mHeightScale is forced to 1.f, and calculateTrackedPosition adds `mHeight * mHeightScale` only when the mode is not FirstPerson. Hence a Nord's third-person camera sits at 124.f * s * mMaleHeight above the tracking node.

```cpp
void RenderingManager::scaleObject(const MWWorld::Ptr& ptr, const osg::Vec3f& scale)
{
    ptr.getRefData().getBaseNode()->setScale(scale);

    if (ptr == mCamera->getTrackingPtr()) // update height of camera
        mCamera->processViewChange();
}
```

## [C] The RACE RADT subrecord is 140 bytes and stores both HEIGHTS before both WEIGHTS, as four float32
- `components/esm3/loadrace.cpp:42-59` - importance **medium**
- **UNVERIFIED** - extracted by one reader, never challenged

Race::RADTstruct::load reads a single fixed 140-byte RADT subrecord with no optional fields, in this strict order: 7 x { int32 skillIndex (converted via ESM::Skill::indexToRefId), int32 bonus } = 56 bytes; then ESM::Attribute::Length (8) x AttributeValues { int32 mMale, int32 mFemale } = 64 bytes; then FOUR float32 in the order mMaleHeight, mFemaleHeight, mMaleWeight, mFemaleWeight = 16 bytes — heights first, both of them, THEN both weights, which is the same order as the C++ declaration `float mMaleHeight, mFemaleHeight, mMaleWeight, mFemaleWeight;` (loadrace.hpp:60); then int32 mFlags (0x01 Playable, 0x02 Beast). 56+64+16+4 = 140, matching the struct's `// Size = 140 bytes` comment. Each field is read with esm.getT, i.e. a raw little-endian binary read of sizeof(T) — 4 bytes each, no scaling, no clamping, no default substitution. Getting the height/weight pair order wrong silently swaps a race's X/Y fatness with its Z height. Vanilla values sit near 1.0 but the loader enforces no range, so a mod value of 0 produces a zero scale and a negative value a mirrored mesh. The header also carries an untested note about eye level: "The actual eye level height (in game units) is (probably) given as 'height' times 128. This has not been tested yet." (loadrace.hpp:58-59) — treat that as a comment, not as engine behaviour; the engine's actual camera height is Camera::mHeight (124.f) times the Z scale.

```cpp
void Race::RADTstruct::load(ESMReader& esm)
{
    esm.getSubHeader();
    for (auto& bonus : mBonus)
    {
        int32_t skill;
        esm.getT(skill);
        bonus.mSkill = ESM::Skill::indexToRefId(skill);
        esm.getT(bonus.mBonus);
    }
    for (int i = 0; i < ESM::Attribute::Length; ++i)
        mAttributeValues[ESM::Attribute::indexToRefId(i)].load(esm);
    esm.getT(mMaleHeight);
    esm.getT(mFemaleHeight);
    esm.getT(mMaleWeight);
    esm.getT(mFemaleWeight);
    esm.getT(mFlags);
}
```

## [C] Creature scale is uniform, ignores the rendering flag, and therefore DOES scale collision - the opposite of NPC race height
- `apps/openmw/mwclass/creature.cpp:850-854` - importance **medium**
- **UNVERIFIED** - extracted by one reader, never challenged

Creature::adjustScale (mwclass/creature.cpp:850-854) is the counterexample that defines the NPC rule by contrast. Its `rendering` parameter is deliberately unnamed (`bool /* rendering */`) so it is ignored: the body is a single uniform `scale *= ref->mBase->mScale` using the CREA record's own mScale. Consequences a port must reproduce: (1) a creature's collision capsule IS scaled — Actor::updateScaleUnsafe's rendering=false pass returns (s*mScale, s*mScale, s*mScale), not (s,s,s), so mHalfExtents and mRenderingHalfExtents are identical for creatures and differ for NPCs; (2) there is no first-person branch for creatures at all — a creature is never the first-person player, and no sex/race lookup happens; (3) the scale is uniform, so a creature never gets the anisotropic weight-on-XY/height-on-Z treatment. The base implementation MWWorld::Class::adjustScale (mwworld/class.cpp:307) is an empty body, `void Class::adjustScale(const MWWorld::ConstPtr& ptr, osg::Vec3f& scale, bool rendering) const {}`, so every non-actor class — statics, doors, containers, items — keeps the raw uniform cellref scale unchanged on both the rendering and collision paths. Only Npc and Creature override it.

```cpp
void Creature::adjustScale(const MWWorld::ConstPtr& ptr, osg::Vec3f& scale, bool /* rendering */) const
{
    const MWWorld::LiveCellRef<ESM::Creature>* ref = ptr.get<ESM::Creature>();
    scale *= ref->mBase->mScale;
}
```

## [C] NiGeometryData: exact stream layout, uint16 vertex count, and 4-byte bools in Morrowind files
- `components/nif/data.cpp:87-174` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

NiGeometryData is the shared header of NiTriShapeData / NiTriStripsData / NiLinesData. All scalars are little-endian on disk (byte-swapped only on big-endian hosts, nifstream.hpp:40-53). A NIF `bool` is int32 (4 bytes, true = !=0) when version < 4.1.0.0 and int8 (1 byte) at 4.1.0.0+ (nifstream.cpp:171-177), so in Morrowind's 4.0.0.2 (VER_MW = 0x04000002, niffile.hpp:28) EVERY bool below is FOUR bytes. Read order (data.cpp:87-167):
(a) int32 mGroupId — only if version >= 10.1.0.114. Absent in MW.
(b) uint16 mNumVertices — the vertex count is 16-BIT (data.hpp:24), max 65535.
(c) uint8 mKeepFlags + uint8 mCompressFlags — only if version >= 10.1.0.0. Absent in MW.
(d) bool hasVertices; if true, mNumVertices * Vec3f (3 x float32 = 12 bytes).
(e) uint16 mDataFlags — only if version >= 10.0.1.0. NOT here in MW.
(f) bool hasNormals; if true, mNumVertices * Vec3f normals, and THEN only if (mDataFlags & 0x1000 = DataFlag_HasTangents) mNumVertices * Vec3f tangents followed by mNumVertices * Vec3f bitangents. In MW mDataFlags is still 0 at this point (it is read at step (i)), so a Morrowind file NEVER reads tangents/bitangents here.
(g) bounding sphere: Vec3f centre + float32 radius = 16 bytes, unconditional (nifstream.cpp:140-144).
(h) bool hasVertexColors; if true, mNumVertices * Vec4f RGBA float32 (16 bytes each).
(i) uint16 mDataFlags — only if version <= 4.2.2.0. This is where MW reads it.
(j) UV-set count: numUVs = mDataFlags; if version > 4.0.0.2 then numUVs &= 0x003F (DataFlag_NumUVsMask), and additionally &= 0x0001 for 20.2.0.7 with bethVersion > 0; ELSE (version <= 4.0.0.2) read one more bool and force numUVs = 0 if it is false. That trailing bool is read ONLY on the <= 4.0.0.2 branch, and MW applies NO mask — the full 16-bit mDataFlags is the set count.
(k) numUVs UV sets, each mNumVertices * Vec2f (8 bytes). mUVList is a vector-of-vectors: outer size = numUVs, every inner size = mNumVertices.
(l) uint16 mConsistencyType, plus 4 skipped bytes at version >= 20.0.0.4 — only if version >= 10.0.1.0. Absent in MW.
NiTriBasedGeomData then appends uint16 mNumTriangles (data.cpp:169-174, data.hpp:42).
mNormals, mTangents and mBitangents are three SEPARATE parallel Vec3f arrays (data.hpp:30), never interleaved. When a has-flag is false the corresponding array stays length 0 — it is not zero-filled and not sized to mNumVertices. readVector with size 0 is a no-op that leaves the vector untouched (nifstream.hpp:135-146).

```cpp
        nif->read(mNumVertices);
...
        if (nif->get<bool>() && hasData)
            nif->readVector(mVertices, mNumVertices);
...
        if (nif->get<bool>() && hasData)
        {
            nif->readVector(mNormals, mNumVertices);
            if (mDataFlags & DataFlag_HasTangents)
            {
                nif->readVector(mTangents, mNumVertices);
                nif->readVector(mBitangents, mNumVertices);
            }
        }

        nif->read(mBoundingSphere);

        if (nif->get<bool>() && hasData)
            nif->readVector(mColors, mNumVertices);

        if (nif->getVersion() <= NIFStream::generateVersion(4, 2, 2, 0))
            nif->read(mDataFlags);

        // In 4.0.0.2 the flags field corresponds to the number of UV sets.
        // In later revisions the part that corresponds to the number is narrower.
        uint16_t numUVs = mDataFlags;
        if (nif->getVersion() > NIFFile::NIFVersion::VER_MW)
        {
            numUVs &= DataFlag_NumUVsMask;
            ...
        }
        else if (!nif->get<bool>())
            numUVs = 0;
```

## [C] NiTriShapeData: a uint32 INDEX count (not a triangle count), one TRIANGLES draw call, and mNumTriangles is never used to size it
- `components/nifosg/nifloader.cpp:1600-1608` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

After the NiGeometryData + NiTriBasedGeomData header, NiTriShapeData reads (data.cpp:176-186): uint32 numIndices — this is the number of INDICES (3 per triangle), not the triangle count; then, ONLY if version > 10.0.1.2 (VER_OB_OLD), a bool, and if that bool is false numIndices is forced to 0 while the uint32 has already been consumed; then numIndices * uint16 into mTriangles; then a uint16 match-group count, and per group a uint16 element count followed by that many uint16 (readNiTriShapeDataMatchGroup, data.cpp:20-23). Morrowind (4.0.0.2 <= 10.0.1.2) has NO has-triangles bool, so the layout is simply u32 count, count x u16, then the match-group tail. Indices are uint16 throughout (data.hpp:50), so a shape can never reference vertex 65536+. The uint16 mNumTriangles inherited from NiTriBasedGeomData is NOT used to size mTriangles and is never cross-checked against numIndices/3 — the render path ignores it entirely. Render: mTriangles becomes exactly ONE osg::DrawElementsUShort(GL_TRIANGLES) whose element count is mTriangles.size() (nifloader.cpp:1600-1608). If mTriangles is empty, handleNiGeometryData `return`s at :1605 BEFORE setting the vertex array, so the shape yields no drawable and no material state at all. RC_BSLODTriShape takes this same branch. RC_BSSegmentedTriShape passes isTypeNiGeometry (nifloader.cpp:160-172) but matches none of the three branches, so it silently produces zero primitive sets. Caveat for a physics/collision port: NiTriShape::getCollisionShape gates on `data->mNumTriangles != 0` (node.cpp:328-329), so there the u16 count DOES matter and a file with mNumTriangles == 0 but a non-empty mTriangles gets a renderable mesh and no collision.

```cpp
                if (niGeometry->mRecordType == Nif::RC_NiTriShape || nifNode->mRecordType == Nif::RC_BSLODTriShape)
                {
                    auto data = static_cast<const Nif::NiTriShapeData*>(niGeometryData);
                    const std::vector<unsigned short>& triangles = data->mTriangles;
                    if (triangles.empty())
                        return;
                    geometry->addPrimitiveSet(new osg::DrawElementsUShort(
                        osg::PrimitiveSet::TRIANGLES, static_cast<unsigned>(triangles.size()), triangles.data()));
                }
```

## [C] NiTriStripsData: lengths-then-data, one TRIANGLE_STRIP per strip, strips < 3 dropped, and the exact strip-to-triangle expansion
- `components/nif/node.cpp:36-58` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

NiTriStripsData reads (data.cpp:188-202): uint16 numStrips; then numStrips * uint16 strip LENGTHS as one block; then, if version <= 10.0.1.2 OR a following bool reads true, numStrips consecutive index arrays, array i holding lengths[i] * uint16. When that bool is false the length block has already been consumed and mStrips stays EMPTY. Morrowind (4.0.0.2) always takes the read branch and has no bool. mStrips is a vector-of-vectors of uint16 (data.hpp:59).
Render (nifloader.cpp:1609-1623): every strip becomes its OWN osg::DrawElementsUShort(GL_TRIANGLE_STRIP) with element count = strip.size() — never merged, never joined with degenerate indices. A strip with fewer than 3 indices is skipped outright (`if (strip.size() < 3) continue;`). If NO strip survives, handleNiGeometryData `return`s at :1622 before the vertex array is set and the whole shape is dropped.
To expand a strip into an indexed triangle list with OpenMW's exact winding, use its own converter (components/nif/node.cpp:36-58): skip strips of size < 3; set b = strip[0], c = strip[1]; for i = 2 .. strip.size()-1: a = b; b = c; c = strip[i]; if (a == b || b == c || a == c) skip this triangle (degenerate); emit (a, b, c) when i is EVEN, (a, c, b) when i is ODD. The parity comes from the strip position i, NEVER from the count of emitted triangles, so dropping degenerates must not shift it. i starts at 2 (even), so the first triangle is (strip[0], strip[1], strip[2]) in order. This reproduces GL_TRIANGLE_STRIP winding exactly: (a,c,b) is a cyclic rotation of GL's odd-triangle order (v[k+1], v[k], v[k+2]).

```cpp
        for (const auto& strip : strips)
        {
            if (strip.size() < 3)
                continue;

            unsigned short a;
            unsigned short b = strip[0];
            unsigned short c = strip[1];
            for (size_t i = 2; i < strip.size(); i++)
            {
                a = b;
                b = c;
                c = strip[i];
                if (a == b || b == c || a == c)
                    continue;
                if (i % 2 == 0)
                    mesh.addTriangleIndices(a, b, c);
                else
                    mesh.addTriangleIndices(a, c, b);
            }
        }
```

## [C] A skin PARTITION replaces the shape's own topology, and mTrueTriangles/mTrueStrips are DERIVED by mVertexMap at parse time
- `components/nif/data.cpp:505-521` - importance **critical**
- REFINES OR CORRECTS RECORDED RULE 38
- **UNVERIFIED** - extracted by one reader, never challenged

If a NiGeometry has a NiSkinInstance, the loader calls skin->getPartitions() (data.cpp:360-369): it returns mSkin->mPartitions if non-empty, else mSkin->mData->mPartitions if non-empty, else nullptr. NiSkinInstance itself reads a partition link only at version >= 10.1.0.101, but NiSkinData reads one for 4.0.0.2 <= version <= 10.1.0.0, so a Morrowind file CAN reach a partition through NiSkinData.
When getPartitions() != nullptr, hasPartitions is set and the NiTriShapeData/NiTriStripsData index data is NOT consulted at all (nifloader.cpp:1571-1598). Instead, for each Partition in mPartitions in order: if mTrueTriangles is non-empty add ONE DrawElementsUShort(TRIANGLES) of mTrueTriangles.size() elements; then for each entry of mTrueStrips with size >= 3 add one DrawElementsUShort(TRIANGLE_STRIP) of strip.size() elements (strips < 3 skipped). Several partitions therefore produce several primitive sets on one osg::Geometry.
mTrueTriangles/mTrueStrips are NOT stored in the file except on Skyrim SE (data.cpp:498-502). They are computed at the end of Partition::read (data.cpp:505-521): if mTrueTriangles is empty AND mVertexMap is non-empty, then if mStrips is non-empty set mTrueStrips = mStrips with every index replaced by mVertexMap[index]; else if mTriangles is non-empty set mTrueTriangles = mTriangles with every index replaced by mVertexMap[index]. So a partition's own mTriangles/mStrips are partition-LOCAL indices into mVertexMap, and mVertexMap[i] is the index into the shape's single global mVertices array. Note the strips branch WINS: a partition holding both strips and triangles yields only mTrueStrips.
Edge case that silently kills geometry: if mVertexMap is empty (its presence flag was 0 at version >= 10.1.0.0) both true-lists stay empty, yet hasPartitions is still true, so the `if (!hasPartitions)` fallback at :1598 is skipped and the shape gets ZERO primitive sets — handleNiGeometry then drops it via `geom->empty()` (nifloader.cpp:1687). Also: partition indices are uint16 (the source comment flags the <=65536 assumption at node.cpp:331), and the partition's own mWeights/mBoneIndices are never read by the renderer — skin weights always come from NiSkinData. Vertices, normals, colours and UVs are still taken whole and unremapped from NiGeometryData.

```cpp
        // Not technically a part of the loading process
        if (mTrueTriangles.empty() && !mVertexMap.empty())
        {
            if (!mStrips.empty())
            {
                mTrueStrips = mStrips;
                for (auto& strip : mTrueStrips)
                    for (auto& index : strip)
                        index = mVertexMap[index];
            }
            else if (!mTriangles.empty())
            {
                mTrueTriangles = mTriangles;
                for (unsigned short& index : mTrueTriangles)
                    index = mVertexMap[index];
            }
        }
```

## [C] Vertex/normal/colour arrays are set from array EMPTINESS, never from mNumVertices, and OpenMW generates nothing
- `components/nifosg/nifloader.cpp:1635-1644` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

handleNiGeometryData aborts with no drawable when niGeometry->mData is empty OR mVertices is empty (nifloader.cpp:1562-1569) — the guard is on the parsed ARRAY, not on the has-vertices bool and not on mNumVertices. Otherwise the arrays are built as (nifloader.cpp:1635-1644):
- vertex array: always set, osg::Vec3Array of mVertices.size() elements copied verbatim (no transform applied here — the shape's NiTransform lives on its scene node).
- normal array: set ONLY if mNormals is non-empty, osg::Vec3Array of mNormals.size(), BIND_PER_VERTEX.
- colour array: set ONLY if mColors is non-empty, osg::Vec4Array of mColors.size(), BIND_PER_VERTEX. Colours are RGBA float32 as parsed (data.hpp:32), NOT bytes — no /255 conversion anywhere.
So the has-normals and has-vertex-colors booleans in NiGeometryData are the only source of truth: when false the array is length 0 and the renderer simply receives no such attribute. OpenMW never synthesises normals (there is no smoothing/normal-generation pass in the NIF path), never synthesises vertex colours, and never pads a short array up to mNumVertices. mTangents/mBitangents are parsed into their own arrays but are never uploaded by this function — nothing in the NiGeometry path reads them.
Two related traps: (1) the `0x40` flag documented on NiGeometry as "mesh has no vertex normals ?" (node.hpp:128-133) is never tested by the loader — do not use it. (2) Whether vertex colours exist is forwarded separately as the 4th argument of applyDrawableProperties (nifloader.cpp:1675, `!niGeometryData->mColors.empty()`), and that flag is what disables colorMode when there are no colours.

```cpp
            const auto& normals = niGeometryData->mNormals;
            const auto& colors = niGeometryData->mColors;

            geometry->setVertexArray(new osg::Vec3Array(static_cast<unsigned>(vertices.size()), vertices.data()));
            if (!normals.empty())
                geometry->setNormalArray(new osg::Vec3Array(static_cast<unsigned>(normals.size()), normals.data()),
                    osg::Array::BIND_PER_VERTEX);
            if (!colors.empty())
                geometry->setColorArray(new osg::Vec4Array(static_cast<unsigned>(colors.size()), colors.data()),
                    osg::Array::BIND_PER_VERTEX);
```

## [C] UV sets are chosen per texture UNIT from boundTextures, with a clamp-to-0 fallback and a stage counter that advances even on skip
- `components/nifosg/nifloader.cpp:1646-1663` - importance **high**
- REFINES OR CORRECTS RECORDED RULE 61
- **UNVERIFIED** - extracted by one reader, never challenged

mUVList is a vector of UV sets (data.hpp:33): outer length = the UV-set count derived from mDataFlags, each inner vector length = mNumVertices, elements Vec2f. Texture coordinates are NOT assigned per UV set — they are assigned per bound texture UNIT. boundTextures is a parallel vector built by attachTexture (nifloader.cpp:1154-1162): index = the OSG texture unit, VALUE = that texture stage's NiTexturingProperty mUVSet. handleNiGeometryData then walks it (nifloader.cpp:1646-1663) with a separate counter `int textureStage = 0` incremented in the for-loop increment expression, so `continue` STILL advances it. Per entry: uvSet = boundTextures[i]; if uvSet >= mUVList.size(), log "Out of bounds UV set" at Debug::Verbose, then — if mUVList is empty, `continue`, leaving that texture stage with NO texcoord array while textureStage still advances — otherwise clamp uvSet = 0 and carry on. Then setTexCoordArray(textureStage, new osg::Vec2Array(mUVList[uvSet].size(), mUVList[uvSet].data()), BIND_PER_VERTEX). Consequences to port exactly: each unit gets its OWN COPY of the array, so two units naming the same uvSet do not share one buffer; the number of texcoord arrays equals boundTextures.size() minus the skipped ones, and is unrelated to mUVList.size(); and if boundTextures is empty (no NiTexturingProperty in the ancestor chain) NO texcoord array is created at all even when mUVList is fully populated. Indexing mUVList[uvSet] directly, without the bounds test, reads out of range on malformed files.

```cpp
            const auto& uvlist = niGeometryData->mUVList;
            int textureStage = 0;
            for (auto it = boundTextures.begin(); it != boundTextures.end(); ++it, ++textureStage)
            {
                unsigned int uvSet = *it;
                if (uvSet >= uvlist.size())
                {
                    Log(Debug::Verbose) << "Out of bounds UV set " << uvSet << " on shape \"" << nifNode->mName
                                        << "\" in " << mFilename;
                    if (uvlist.empty())
                        continue;
                    uvSet = 0;
                }

                geometry->setTexCoordArray(textureStage,
                    new osg::Vec2Array(static_cast<unsigned>(uvlist[uvSet].size()), uvlist[uvSet].data()),
                    osg::Array::BIND_PER_VERTEX);
            }
```

## [C] Winding: indices are used verbatim, and the default front face is COUNTER_CLOCKWISE
- `components/nifosg/nifloader.cpp:2494-2515` - importance **high**
- REFINES OR CORRECTS RECORDED RULE 65
- **UNVERIFIED** - extracted by one reader, never challenged

Nothing in the NIF geometry path reverses, sorts, re-winds or re-orders indices. mTriangles, each NiTriStripsData strip, each partition's mVertexMap-remapped list, and NiLinesData's derived line list are all handed to GL in file order (nifloader.cpp:1584-1631). Front-face orientation is therefore decided entirely by the osg::FrontFace state attribute, which in the whole loader is set in exactly one place: the NiStencilProperty branch (nifloader.cpp:2494-2510). Mapping: DrawMode::Clockwise -> FrontFace::CLOCKWISE; DrawMode::Default, DrawMode::CounterClockwise, DrawMode::Both and any unknown value -> FrontFace::COUNTER_CLOCKWISE. Additionally GL_CULL_FACE is set ON for every DrawMode except Both, which sets it OFF (:2513-2515). With NO NiStencilProperty anywhere in the ancestor chain, no FrontFace is set at all and OpenGL's own default applies: COUNTER_CLOCKWISE. So the portable rule is: a triangle listed (i0, i1, i2) is FRONT-FACING when it appears counter-clockwise in screen space, and back-face culling is on by default. Strips inherit GL's alternating parity (see the strip-expansion rule) so that every expanded triangle has the same effective orientation as the first. Mirroring is likewise NOT done by reversing indices: SceneUtil::attach.cpp:166-181 mirrors a left-side rigid part with setScale(-1, 1, 1) and pushes a FrontFace CLOCKWISE stateset to compensate for the flip the negative scale causes.

```cpp
                    osg::ref_ptr<osg::FrontFace> frontFace = new osg::FrontFace;
                    using DrawMode = Nif::NiStencilProperty::DrawMode;
                    switch (stencilprop->mDrawMode)
                    {
                        case DrawMode::Clockwise:
                            frontFace->setMode(osg::FrontFace::CLOCKWISE);
                            break;
                        case DrawMode::Default:
                        case DrawMode::CounterClockwise:
                        case DrawMode::Both:
                        default:
                            frontFace->setMode(osg::FrontFace::COUNTER_CLOCKWISE);
                            break;
                    }
```

## [C] The header is a magic-PREFIX test on a '\n'-terminated line, then a raw uint32 version — and there is NO version whitelist
- `/tmp/nifc_niffile.cpp (OpenMW master components/nif/niffile.cpp):550-572 (plus components/nif/nifstream.hpp:106-109)` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

Reading a NIF starts with getVersionString(): std::getline(stream, result) with the default '\n' delimiter — it consumes bytes up to and INCLUDING the first 0x0A, stores everything before it (a trailing 0x0D from CRLF would be kept), has no length cap, and throws if the stream fails. The file is accepted iff that line has one of exactly TWO byte-exact, case-sensitive prefixes: "NetImmerse File Format" or "Gamebryo File Format" (std::any_of over starts_with). Everything after the prefix — the human-readable ", Version 4.0.0.2" — is NEVER parsed; the textual version is ignored entirely. Immediately after the 0x0A comes a little-endian uint32 which is the real version, packed as version = (major<<24)+(minor<<16)+(patch<<8)+rev with each field a uint8 (NIFStream::generateVersion, nifstream.hpp:106-109). It is not BCD in the decimal sense: 4.0.0.2 == 0x04000002 (on disk: 02 00 00 04), 10.0.1.2 == 0x0A000102, 20.2.0.7 == 0x14020007. All version gates are plain unsigned integer >=/</== on this uint32. Reader::parse() contains exactly SIX throws and none of them is a version whitelist (niffile.cpp:559 bad magic, :586 big-endian, :636 hashed record types, :673 blank record type, :678 nonzero record separator, :683 unknown record type) — so any version with a matching magic line is attempted, and an unsupported one fails only when it hits a gate. versionToString (niffile.cpp:527-537) is log-only: decimal major.minor.patch.rev from those four bytes. JS port: read bytes to the first 0x0A as Latin-1, test the two prefixes, then read a LE uint32; store it as an integer and compare with numbers, never parse the text.

```cpp
        // Check the header string
        std::string head = nif.getVersionString();
        static const std::array<std::string, 2> verStrings = {
            "NetImmerse File Format",
            "Gamebryo File Format",
        };
        const bool supportedHeader = std::any_of(verStrings.begin(), verStrings.end(),
            [&](const std::string& verString) { return head.starts_with(verString); });
        if (!supportedHeader)
            throw Nif::Exception("Invalid NIF header: " + head, mFilename);

        // Get BCD version
        nif.read(mVersion);

// nifstream.hpp:106-109
        static constexpr uint32_t generateVersion(uint8_t major, uint8_t minor, uint8_t patch, uint8_t rev)
        {
            return (major << 24) + (minor << 16) + (patch << 8) + rev;
        }
```

## [C] Nine version-gated header blocks, in this exact stream order — and for Morrowind 4.0.0.2 every one of them is ABSENT
- `/tmp/nifc_niffile.cpp (OpenMW master components/nif/niffile.cpp):564-662` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

After the uint32 version, parse() computes nine booleans (niffile.cpp:564-572) and then reads the guarded fields in this exact order. (1) endianness: uint8, present iff version >= 0x14000004 (20.0.0.4); when absent it defaults to 1; if the byte reads 0 -> throw "Big endian NIF files are unsupported"; ANY nonzero value is accepted. (2) userVersion: uint32, present iff version >= 0x0A000108 (10.0.1.8); otherwise stays 0. (3) recordsCount: uint32, ALWAYS present. (4) Bethesda stream header, present iff version == 0x0A000102, OR (userVersion >= 3 AND version >= 0x0A010000 AND (version <= 0x14000005 OR version == 0x14020007) AND (userVersion <= 11 OR version >= 0x14000005)); its contents in order are: bethVersion uint32; one export string (Author); then if bethVersion >= 131 a discarded uint32 else an export string (Process script); an export string (Export script); if bethVersion >= 103 an export string (Max file path). An export string is uint8 length + that many bytes. (5) Record-type listings, iff version >= 0x05000001 (5.0.0.1): if version == 0x14030102 exactly -> throw "Hashed record types are unsupported"; else uint16 typeCount, then typeCount uint32-length-prefixed strings, then recordsCount uint16 indices (note uint16, not uint32). (6) Record sizes, iff version >= 0x14020005 (20.2.0.5): recordsCount uint32s, read and discarded. (7) String table, iff version >= 0x14010001 (20.1.0.1): uint32 stringNum, uint32 maxStringLength, then stringNum uint32-length-prefixed strings. (8) Groups, iff version >= 0x05000006 (5.0.0.6): uint32 groupCount then groupCount uint32s, discarded. (9) Record separators, iff 0x0A000000 <= version < 0x0A020000: an int32 read BEFORE each record whose type name does not start with "bhk"; nonzero -> throw. For Morrowind's 0x04000002 all nine are false, so the entire header is literally: [version line][0x0A][uint32 0x04000002][uint32 recordsCount]; records follow immediately, then [uint32 rootsCount][rootsCount x int32].

```cpp
        const bool hasEndianness = mVersion >= NIFStream::generateVersion(20, 0, 0, 4);
        const bool hasUserVersion = mVersion >= NIFStream::generateVersion(10, 0, 1, 8);
        const bool hasRecTypeListings = mVersion >= NIFStream::generateVersion(5, 0, 0, 1);
        const bool hasRecTypeHashes = mVersion == NIFStream::generateVersion(20, 3, 1, 2);
        const bool hasRecordSizes = mVersion >= NIFStream::generateVersion(20, 2, 0, 5);
        const bool hasGroups = mVersion >= NIFStream::generateVersion(5, 0, 0, 6);
        const bool hasStringTable = mVersion >= NIFStream::generateVersion(20, 1, 0, 1);
        const bool hasRecordSeparators
            = mVersion >= NIFStream::generateVersion(10, 0, 0, 0) && mVersion < NIFStream::generateVersion(10, 2, 0, 0);
...
            std::uint8_t endianness = 1;
            if (hasEndianness)
                nif.read(endianness);
            if (endianness == 0)
                throw Nif::Exception("Big endian NIF files are unsupported", mFilename);
        }
        if (hasUserVersion)
            nif.read(mUserVersion);
        const std::uint32_t recordsCount = nif.get<std::uint32_t>();
...
                nif.getSizedStrings(recTypes, nif.get<std::uint16_t>());
                nif.readVector(recTypeIndices, recordsCount);
```

## [C] getSizedString: uint32 length, the stream ALWAYS advances the full length, then truncate at the first NUL, then encode
- `/tmp/nifc_nifstream.cpp (OpenMW master components/nif/nifstream.cpp):58-72 (plus nifstream.hpp:157-166 and nifstream.cpp:179-186)` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

getSizedString(length) does four things in this order: (a) checkStreamSize(length) — throws std::runtime_error if length > mStreamSize, where mStreamSize is the byte count from the stream position at NIFStream construction to EOF, i.e. the whole file (Files::getHash at niffile.cpp:545 reads the file but seeks back to start, and getStreamSizeLeft restores the position); so it is a sanity cap against the WHOLE FILE SIZE, not against bytes remaining; (b) read exactly `length` bytes — THE STREAM CURSOR ADVANCES BY `length` UNCONDITIONALLY, even when the payload contains an embedded NUL; (c) find the FIRST 0x00 and erase from it to the end (so "Bip01\0\0\0" of declared length 8 yields "Bip01" but consumes 8 bytes); (d) if an encoder is installed, convert the truncated bytes to UTF-8. Length widths differ by call site: getSizedString() with no argument reads a uint32 length (nifstream.hpp:160); getExportString() reads a uint8 length (nifstream.hpp:166) and is used only in the Bethesda stream header; getStringPalette() reads a uint32 size and then raw bytes with NO NUL truncation and NO encoder conversion (nifstream.cpp:92-101). read<std::string> switches on version (nifstream.cpp:179-186): version < 0x14010001 (20.1.0.1) -> inline getSizedString(); otherwise -> mReader.getString(get<uint32_t>()), where index 0xFFFFFFFF returns the empty string and any other out-of-range index throws from mStrings.at() (niffile.cpp:744-749). Morrowind 4.0.0.2 is below 20.1.0.1, so every node name, every NiStringExtraData, every NiTextKeyExtraData text blob AND every per-record type name is an inline uint32-length-prefixed, NUL-truncated, encoder-converted string. length == 0 yields the empty string with no read.

```cpp
    std::string NIFStream::getSizedString(size_t length)
    {
        checkStreamSize(length);
        std::string str(length, '\0');
        mStream->read(str.data(), length);
        if (mStream->fail())
            throw std::runtime_error(std::format(
                "Failed to read sized string of {} chars: {}", length, std::generic_category().message(errno)));
        size_t end = str.find('\0');
        if (end != std::string::npos)
            str.erase(end);
        if (mEncoder)
            str = mEncoder->getUtf8(str, ToUTF8::BufferAllocationPolicy::UseGrowFactor, mBuffer);
        return str;
    }

// nifstream.hpp:160,166
        std::string getSizedString() { return getSizedString(get<uint32_t>()); }
        std::string getExportString() { return getSizedString(get<uint8_t>()); }
```

## [C] Morrowind node names are WINDOWS-1252, converted to UTF-8 at read — with five bytes that map to a SPACE, not to U+FFFD and not to the C1 control
- `/tmp/nifc_toutf8.cpp (OpenMW master components/toutf8/toutf8.cpp) + components/toutf8/tablesgen.hpp:toutf8.cpp:105-135, 191-231, 361-372; tablesgen.hpp:118 (windows_1252, 1536 entries); engine.cpp:373,752,960; niffilemanager.cpp:50` - importance **critical**
- REFINES OR CORRECTS RECORDED RULE 45
- **UNVERIFIED** - extracted by one reader, never challenged

The encoder is chosen once at engine start and is NOT read from the file. OMW::Engine::mEncoding defaults to ToUTF8::WINDOWS_1252 (engine.cpp:373); the `encoding` option defaults to the string "win1252" (apps/openmw/options.cpp:77) and calculateEncoding accepts only "win1250"/"win1251"/"win1252", throwing otherwise (toutf8.cpp:361-372) — CP437 exists in the enum but is reachable only for .fnt fonts. Engine builds ToUTF8::Utf8Encoder(mEncoding) (engine.cpp:960) and hands &encoder.getStatelessEncoder() to ResourceSystem (engine.cpp:752), which passes the same pointer to NifFileManager (resourcesystem.cpp:19) and KeyframeManager (resourcesystem.cpp:24); NifFileManager::get constructs Nif::Reader(*file, mEncoder) (niffilemanager.cpp:50). So both .nif and .kf strings go through it. The table (components/toutf8/tablesgen.hpp) is 256 entries x 6 signed chars: entry[b*6] is the UTF-8 output byte count, entry[b*6+1 .. +5] the bytes. I decoded windows_1252 and verified: bytes 0x00-0x7F are all identity, length 1 (no exceptions); 0x80-0xFF are genuine CP1252 (0x92 -> E2 80 99 U+2019, 0xE9 -> C3 A9 U+00E9, 0xA0 -> C2 A0); and the five CP1252-UNDEFINED bytes 0x81, 0x8D, 0x8F, 0x90, 0x9D map to a single ASCII SPACE 0x20. getUtf8 has a fast path: getLength/skipAscii stop at the first byte that is 0 or >= 128, and if none is found the input is returned byte-identical with no allocation (toutf8.cpp:105-135, 191-231). What a JS port MUST do to decode a bone name: take the `length` raw bytes, cut at the first 0x00, then map each byte through a 256-entry CP1252 table in which 0x81/0x8D/0x8F/0x90/0x9D produce " ". Do NOT use TextDecoder('utf-8') (Morrowind bytes are not UTF-8) and do NOT use TextDecoder('windows-1252') unmodified — the WHATWG index maps those five bytes to U+0081/U+008D/U+008F/U+0090/U+009D, which will not compare equal to OpenMW's space. Critically, this conversion happens BEFORE any case folding: Misc::StringUtils::toLower is a 256-entry byte map that touches only 'A'-'Z' (lower.hpp:9-40) and ciEqual first requires EQUAL BYTE LENGTH (algorithm.hpp:31-37), so an accented bone name is multi-byte UTF-8 that can never fold or match its differently-accented or ASCII spelling. Byte-for-byte name equality after this pipeline is what rule 16's skeleton bone cache and rule 45's text-key compares actually rely on.

```cpp
// toutf8.cpp:117-124 (the ASCII fast path)
    const auto [outlen, ascii] = getLength(input);
    // If we're pure ascii, then don't bother converting anything.
    if (ascii)
        return std::string_view(input.data(), outlen);

// toutf8.cpp:218-231 (per-byte translation)
void StatelessUtf8Encoder::copyFromArray(unsigned char ch, char*& out) const
{
    // Optimize for ASCII values
    if (ch < 128)
    {
        *(out++) = ch;
        return;
    }
    const signed char* in = &mTranslationArray[ch * 6];
    int len = *(in++);
    memcpy(out, in, len);
    out += len;
}

// apps/openmw/options.cpp:77
        addOption("encoding", bpo::value<std::string>()->default_value("win1252"), ...
// apps/openmw/engine.cpp:373
    , mEncoding(ToUTF8::WINDOWS_1252)
```

## [C] In a Morrowind NIF every `bool` field on the wire is FOUR bytes, not one
- `/tmp/nifc_nifstream.cpp (OpenMW master components/nif/nifstream.cpp):170-177 (call sites: node.cpp:151,242; data.cpp:113,125,137,152,320-323)` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

NIFStream::read<bool> switches on version: below 0x04010000 (4.1.0.0) it reads an int32 and tests != 0; at 4.1.0.0 and above it reads an int8 and tests != 0. Morrowind's 0x04000002 is BELOW 4.1.0.0, so every get<bool>()/read(bool&) in a Morrowind NIF consumes 4 little-endian bytes. The array form read<bool>(bool*, size) makes the same choice and reads size*4 bytes in Morrowind (nifstream.cpp:236-255). This changes the byte layout of records a JS port has to walk: NiAVObject::read reads a 4-byte 'has bounding volume' flag after the property list when version <= 4.2.2.0 (node.cpp:151); NiGeometryData::read reads a 4-byte hasVertices (data.cpp:113), a 4-byte hasNormals (data.cpp:125), a 4-byte hasVertexColors (data.cpp:137) and, on the 4.0.0.2 branch only, a 4-byte hasUV whose false value forces numUVs to 0 (data.cpp:152); NiExtraData-holder NiNode name lists use get<bool>() as a COUNT on old versions (node.cpp:242). Treating any of these as one byte desynchronises the stream by 3 bytes and corrupts every subsequent record. The one deliberate exception in the codebase: NiVisData reads its per-key visibility as an explicit uint8, never via get<bool> (data.cpp:320-323), so it is 1 byte in Morrowind too.

```cpp
    template <>
    void NIFStream::read<bool>(bool& data)
    {
        if (getVersion() < generateVersion(4, 1, 0, 0))
            data = get<int32_t>() != 0;
        else
            data = get<int8_t>() != 0;
    }

// data.cpp:113,125,137,152 - the four Morrowind geometry flags this makes 4 bytes each
        if (nif->get<bool>() && hasData)
            nif->readVector(mVertices, mNumVertices);
...
        else if (!nif->get<bool>())
            numUVs = 0;
```

## [C] An unknown record type THROWS and kills the whole file — there is no skip path, and in Morrowind there cannot be one
- `/tmp/nifc_niffile.cpp (OpenMW master components/nif/niffile.cpp):664-696 (factory table at 50-522)` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

The record loop runs recordsCount times. The type name comes from one of two places: for version >= 5.0.0.1 it is recTypes.at(recTypeIndices[i]) from the header listing; for Morrowind (below 5.0.0.1) it is a fresh inline nif.get<std::string>() per record — i.e. a uint32 length prefix, NUL-truncated and encoder-converted like any other sized string (see the getSizedString rule). An empty type string throws "Record type is blank (index i)". Lookup is factories.find(rec) on a std::map<std::string, CreateRecord> built once by makeFactory() (niffile.cpp:50-522, ~300 entries) with default std::less<std::string>, so the match is EXACT and CASE-SENSITIVE byte comparison — no prefix match, no case folding, no fallback entry. A miss throws Nif::Exception("Unknown record type " + rec) and the entire parse aborts; nothing is skipped and no partial model is produced. That is not a policy choice a port can relax for Morrowind: hasRecordSizes requires version >= 20.2.0.5, so a 4.0.0.2 file carries no per-record size and there is no way to know how many bytes to skip. The factory value also decouples the C++ class, the RecordType enum and the wire name: "AvoidNode" constructs a NiNode tagged RC_AvoidNode, "BSFadeNode" constructs a NiNode tagged RC_NiNode, "Lighting30ShaderProperty" constructs a BSShaderPPLightingProperty tagged RC_BSShaderPPLightingProperty — so a port needs a name -> (class, typeTag) table, not a name -> class one. After construction the reader sets r->mRecordName = the original wire string and r->mRecordIndex = i, the 0-based position in FILE order (not root order) — that index is what the 'discard the transform of record 0 unless it is named bip01' behaviour keys off.

```cpp
            std::string rec = hasRecTypeListings ? recTypes.at(recTypeIndices[i]) : nif.get<std::string>();
            if (rec.empty())
            {
                std::stringstream error;
                error << "Record type is blank (index " << i << ")";
                throw Nif::Exception(error.str(), mFilename);
            }
            // Record separator. Some Havok records in Oblivion do not have it.
            if (hasRecordSeparators && !rec.starts_with("bhk") && nif.get<int32_t>())
                throw Nif::Exception("Non-zero separator precedes " + rec + ", index " + std::to_string(i), mFilename);

            const auto entry = factories.find(rec);

            if (entry == factories.end())
                throw Nif::Exception("Unknown record type " + rec, mFilename);
...
            r->mRecordName = std::move(rec);
            r->mRecordIndex = static_cast<unsigned>(i);
            r->read(&nif);
```

## [C] Roots are a trailing int32 index list; a bad index becomes a KEPT null hole, and the mesh loader takes EVERY NiAVObject root, not just the first
- `/tmp/nifc_niffile.cpp (OpenMW master components/nif/niffile.cpp):698-728 (consumers: components/nifosg/nifloader.cpp:341-357 and 432-444)` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

Immediately after the last record the file has a uint32 rootsCount followed by rootsCount SIGNED int32 record indices. For each: if idx >= 0 && (size_t)idx < mRecords.size() the record pointer is appended; otherwise a nullptr is appended in its place — the hole is KEPT, so root slot i keeps its ordinal — and a warning is logged for the first 10 offenders, then one summary line for the rest. Negative and out-of-range are handled identically. Only after the whole root list is built does the reader run post() on every record in file order (niffile.cpp:726-728), which is when all record cross-references resolve. Consumers then differ by file kind. Mesh loading (nifloader.cpp:432-444) iterates ALL roots in order, skips nulls, dynamic_casts each to Nif::NiAVObject, and keeps every one that succeeds; if the survivor list is empty it throws Nif::Exception("Found no root nodes"). All survivors are loaded and added as children of ONE freshly created osg::Group — so a multi-root NIF produces a multi-child scene, and it is emphatically NOT 'root 0 only'. Non-NiAVObject roots are silently ignored rather than being an error. Keyframe loading (nifloader.cpp:341-357) uses the opposite rule: scan the roots in order and take the FIRST whose mRecordType == RC_NiSequenceStreamHelper; if there is none, log a warning and return with no animation loaded — it does not throw and it does not search deeper than the root list.

```cpp
        // Determine which records are roots
        const std::uint32_t rootsCount = nif.get<uint32_t>();
        mRoots.reserve(rootsCount);
        ...
            std::int32_t idx;
            nif.read(idx);
            if (idx >= 0 && static_cast<std::size_t>(idx) < mRecords.size())
            {
                mRoots.push_back(mRecords[idx].get());
            }
            else
            {
                mRoots.push_back(nullptr);
                ++doesNotPointWarnings;

// nifloader.cpp:432-444
            const size_t numRoots = nif.numRoots();
            std::vector<const Nif::NiAVObject*> roots;
            for (size_t i = 0; i < numRoots; ++i)
            {
                const Nif::Record* r = nif.getRoot(i);
                if (!r)
                    continue;
                const Nif::NiAVObject* nifNode = dynamic_cast<const Nif::NiAVObject*>(r);
                if (nifNode)
                    roots.emplace_back(nifNode);
            }
            if (roots.empty())
                throw Nif::Exception("Found no root nodes", nif.getFilename());
```

## [C] Attached equipment reads the LOWER-BODY clock; only the head and the right-hand weapon get their own
- `apps/openmw/mwrender/npcanimation.cpp:825-868` - importance **critical**
- REFINES OR CORRECTS RECORDED RULE 26
- **UNVERIFIED** - extracted by one reader, never challenged

After NpcAnimation::addOrReplaceIndividualPart instances and attaches a part mesh, it assigns a ControllerSource to the controllers INSIDE that part's subtree — but only if `node->getNumChildrenRequiringUpdateTraversal() > 0` (a part with no update callbacks is skipped entirely). The choice is a three-way branch on the ESM::PartReferenceType: (a) `PRT_Head` (0) -> `mHeadAnimationTime`, assigned with SceneUtil::ForceControllerSourcesVisitor, whose visit is `ctrl.setSource(mToAssign)` with NO null check (components/sceneutil/controller.cpp:128-131) — it OVERWRITES sources that are already set. Before assigning, it walks `node->getUserDataContainer()`'s user objects, takes the FIRST SceneUtil::TextKeyMapHolder (then `break`), and for every key in it does a case-insensitive full-string compare (Misc::StringUtils::ciEqual) against exactly "talk: start", "talk: stop", "blink: start", "blink: stop", feeding setTalkStart/setTalkStop/setBlinkStart/setBlinkStop. These are the head PART mesh's own text keys, not the skeleton's. (b) `PRT_Weapon` (25) -> `mWeaponAnimationTime`. (c) EVERY other of the 27 slots — Hair 1, Neck 2, Cuirass 3, Groin 4, Skirt 5, RHand 6, LHand 7, RWrist 8, LWrist 9, Shield 10, RForearm 11, LForearm 12, RUpperarm 13, LUpperarm 14, RFoot 15, LFoot 16, RAnkle 17, LAnkle 18, RKnee 19, LKnee 20, RLeg 21, LLeg 22, RPauldron 23, LPauldron 24, Tail 26 -> `mAnimationTimePtr[0]`, i.e. index 0 == BoneGroup_LowerBody (bonegroup.hpp: BoneGroup_LowerBody = 0), the shared playhead of whichever AnimState currently wins the LOWER BODY. So a shield (bone "Shield Bone", left-arm group), both pauldrons, both hands and both forearms drive their own embedded NIF controllers (UV scroll, vis, flipbook, particle) off the LEGS' clock, never off the bone group they hang from. (b) and (c) use SceneUtil::AssignControllerSourcesVisitor, whose visit is `if (!ctrl.getSource()) ctrl.setSource(mToAssign)` (controller.cpp:112-116) — an already-sourced controller is left alone. CreatureWeaponAnimation::updatePart repeats the same split (apps/openmw/mwrender/creatureanimation.cpp:167-175): Slot_CarriedRight -> mWeaponAnimationTime, every other slot -> mAnimationTimePtr[0]. Corroborating default: Animation::addAnimSource ends with `AssignControllerSourcesVisitor assignVisitor(mAnimationTimePtr[0]); mObjectRoot->accept(assignVisitor);` (animation.cpp:709-710), so anything still sourceless anywhere on the actor also falls to the lower-body clock. EXCEPTION: the ammunition attached by WeaponAnimation::attachArrow (weaponanimation.cpp:84-90) gets NO visitor at all and is attached after that sweep, so an arrow's own controllers stay sourceless.

```cpp
        osg::Node* node = mObjectParts[type]->getNode();
        if (node->getNumChildrenRequiringUpdateTraversal() > 0)
        {
            std::shared_ptr<SceneUtil::ControllerSource> src;
            if (type == ESM::PRT_Head)
            {
                src = mHeadAnimationTime;
                ...
                                if (Misc::StringUtils::ciEqual(key.second, "talk: start"))
                                    mHeadAnimationTime->setTalkStart(key.first);
                ...
                SceneUtil::ForceControllerSourcesVisitor assignVisitor(std::move(src));
                node->accept(assignVisitor);
            }
            else
            {
                if (type == ESM::PRT_Weapon)
                    src = mWeaponAnimationTime;
                else
                    src = mAnimationTimePtr[0];
                SceneUtil::AssignControllerSourcesVisitor assignVisitor(std::move(src));
                node->accept(assignVisitor);
            }
        }
```

## [C] WeaponAnimationTime returns (weapon group playhead - mStartTime), and mStartTime is relative ONLY for weapon class Ranged
- `apps/openmw/mwrender/weaponanimation.cpp:25-50` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

WeaponAnimationTime is a ControllerSource holding {Animation* mAnimation; std::string mWeaponGroup; float mStartTime = 0; bool mRelativeTime = false} (weaponanimation.hpp:15-32). getValue(): if mWeaponGroup is EMPTY return 0.0f; else `current = mAnimation->getCurrentTime(mWeaponGroup)`, which is the AnimState's live playhead `*mTime` for that group or exactly -1.0f when the group is not in mStates (animation.cpp:1247-1254); if `current == -1` (bare float equality against -1) return 0.0f; otherwise return `current - mStartTime`. setGroup(group, relativeTime) stores both and then sets `mStartTime = relativeTime ? mAnimation->getStartTime(group) : 0`. Animation::getStartTime (animation.cpp:827-838) walks mAnimSources in REVERSE (newest source first) and returns `keys.findGroupStart(groupname)->first` — the time of the group's FIRST text key, not its "start" key — and returns -1.0f if no source contains the group; a -1 there makes getValue return `current + 1`, so a missing group silently biases the clock by +1 second. updateStartTime() is just `setGroup(mWeaponGroup, mRelativeTime)`, i.e. re-resolves mStartTime against the CURRENT anim-source list without changing the group; it is called once at the very end of NpcAnimation::updateNpcBase (npcanimation.cpp:549), after every addAnimSource, because the source list has just been rebuilt. WHICH WEAPON CLASSES ARE RELATIVE: both call sites of Animation::setWeaponGroup compute `bool useRelativeDuration = weaponClass == ESM::WeaponType::Ranged;` — apps/openmw/mwmechanics/character.cpp:943-945 (on entering the weapon state) and character.cpp:1441-1443 (on a weapon change). So class Ranged (bow, crossbow) uses time measured from the group's first key; Melee, Thrown, Ammo and every other class use ABSOLUTE animation time (mStartTime = 0). The in-source reason: "controllers for ranged weapon should use time for beginning of animation to play shooting properly, for other weapons they should use absolute time. Some mods rely on this behaviour (to rotate throwing projectiles, for example)". setWeaponGroup is only reached when the weapon type is not None, not Spell and not HandToHand; the base Animation::setWeaponGroup is an empty virtual (animation.hpp:467), so creatures without a CreatureWeaponAnimation ignore it.

```cpp
    float WeaponAnimationTime::getValue(osg::NodeVisitor*)
    {
        if (mWeaponGroup.empty())
            return 0;

        float current = mAnimation->getCurrentTime(mWeaponGroup);
        if (current == -1)
            return 0;
        return current - mStartTime;
    }

    void WeaponAnimationTime::setGroup(const std::string& group, bool relativeTime)
    {
        mWeaponGroup = group;
        mRelativeTime = relativeTime;

        if (mRelativeTime)
            mStartTime = mAnimation->getStartTime(mWeaponGroup);
        else
            mStartTime = 0;
    }

    void WeaponAnimationTime::updateStartTime()
    {
        setGroup(mWeaponGroup, mRelativeTime);
    }
```

## [C] HeadAnimationTime is the third clock: a blink ramp with a random negative delay, replaced by loudness-scaled talk while a voice line plays
- `apps/openmw/mwrender/npcanimation.cpp:155-199` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

HeadAnimationTime holds mTalkStart/mTalkStop/mBlinkStart/mBlinkStop (all 0 by default, filled from the head PART mesh's text keys — see the PRT_Head branch), mBlinkTimer, mEnabled (default TRUE) and mValue (default 0). getValue() just returns mValue — it never computes anything; mValue is advanced once per frame by update(dt), called from NpcAnimation::runAnimation AFTER Animation::runAnimation has already stepped all AnimStates (npcanimation.cpp:708-710). update(dt) returns immediately if `!mEnabled`, and again if `dt == 0.f` exactly (so a paused frame freezes the eye/mouth rather than resetting it). Branch on `MWBase::Environment::get().getSoundManager()->sayActive(mReference)`: NOT saying -> `mBlinkTimer += dt; duration = mBlinkStop - mBlinkStart; if (mBlinkTimer >= 0 && mBlinkTimer <= duration) mValue = mBlinkStart + mBlinkTimer; else mValue = mBlinkStop; if (mBlinkTimer > duration) resetBlinkTimer();` — i.e. the head texture/UV controller is parked at mBlinkStop between blinks, then plays mBlinkStart..mBlinkStop in real time once the timer reaches 0. Saying -> `mValue = mTalkStart + (mTalkStop - mTalkStart) * std::min(1.f, getSaySoundLoudness(mReference) * 2)`, an instantaneous (unsmoothed) lerp; loudness is doubled then clamped at 1. resetBlinkTimer() sets `mBlinkTimer = -(2.0f + Misc::Rng::rollDice(6, prng))`, and rollDice(6) is uniform over [0,5] inclusive (components/misc/rng.hpp:34-39, "return value in range [0, max)"), so the pause between blinks is uniformly one of -2, -3, -4, -5, -6 or -7 seconds. EDGE CASE: a head with no blink keys leaves mBlinkStart = mBlinkStop = 0, so duration = 0, mValue is pinned to 0, and the timer is re-rolled on the first frame after it passes 0. mEnabled is toggled by NpcAnimation::enableHeadAnimation (npcanimation.cpp:1117-1120).

```cpp
    void HeadAnimationTime::resetBlinkTimer()
    {
        auto& prng = MWBase::Environment::get().getWorld()->getPrng();
        mBlinkTimer = -(2.0f + Misc::Rng::rollDice(6, prng));
    }

    void HeadAnimationTime::update(float dt)
    {
        if (!mEnabled)
            return;

        if (dt == 0.f)
            return;

        if (!MWBase::Environment::get().getSoundManager()->sayActive(mReference))
        {
            mBlinkTimer += dt;

            float duration = mBlinkStop - mBlinkStart;

            if (mBlinkTimer >= 0 && mBlinkTimer <= duration)
            {
                mValue = mBlinkStart + mBlinkTimer;
            }
            else
                mValue = mBlinkStop;

            if (mBlinkTimer > duration)
                resetBlinkTimer();
        }
        else
        {
            mValue = mTalkStart
                + (mTalkStop - mTalkStart)
                    * std::min(1.f,
                        MWBase::Environment::get().getSoundManager()->getSaySoundLoudness(mReference)
                            * 2);
        }
    }
```

## [C] The ranged aim pitch is TWO RotateControllers, on "bip01 spine1" and "bip01 spine2", each given HALF the pitch about -X
- `apps/openmw/mwrender/weaponanimation.cpp:175-211` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

WeaponAnimation::addControllers(nodes, map, objectRoot) loops i = 0..1, sets `mSpineControllers[i] = nullptr` FIRST (so a bone that is missing leaves a null slot while the other slot can still be live), then looks up the literal lowercase names `i == 0 ? "bip01 spine1" : "bip01 spine2"` in the Animation::NodeMap. That map is an unordered_map keyed with Misc::StringUtils::CiHash/CiEqual (animation.hpp:126-128), so the lookup is CASE-INSENSITIVE and, per rule 16, the first matching MatrixTransform in traversal order wins. Each found node gets `new RotateController(objectRoot)` added as an UPDATE callback and recorded in the caller's active-controller vector (which is mActiveControllers, cleared and detached by Animation::resetActiveGroups). deleteControllers() only nulls the two pointers — it does not detach anything; detachment is resetActiveGroups' job. configureControllers(characterPitchRadians), called once per frame: if `mPitchFactor == 0.f || characterPitchRadians == 0.f` (both bare float equality tests, so any nonzero epsilon still counts as pitched) it calls setControllerEnabled(false) and RETURNS — the animated spine matrix is left untouched. Otherwise `pitch = characterPitchRadians * mPitchFactor` and BOTH controllers are given the IDENTICAL quaternion `osg::Quat(pitch / 2, osg::Vec3f(-1, 0, 0))` — a rotation of HALF the pitch about the NEGATIVE X axis — and both are enabled. Because "bip01 spine2" is a descendant of "bip01 spine1" in the Morrowind biped rig, the two halves compose and the net rotation carried down to the clavicles, arms and the weapon bone is the full `characterPitchRadians * mPitchFactor` about -X, delivered as a two-segment curve rather than a single hinge. Each RotateController conjugates its quaternion into the node's local frame relative to mRelativeTo == mObjectRoot and PRE-multiplies it onto the animated local rotation (`orient = worldOrient * mRotate * worldOrientInverse * matrix.getRotate()`, rule 31), so the pitch is expressed in ACTOR-ROOT space, not bone space, and it stacks on top of whatever the weapon animation wrote that frame. mPitchFactor is a float member of WeaponAnimation initialised to 0 in its constructor (weaponanimation.cpp:51-54, weaponanimation.hpp:76), written only by the setPitchFactor overrides in NpcAnimation (npcanimation.hpp:139) and CreatureWeaponAnimation (creatureanimation.hpp:66); Animation::setPitchFactor is an empty virtual (animation.hpp:470), so plain creatures and objects ignore it.

```cpp
    void WeaponAnimation::addControllers(const Animation::NodeMap& nodes,
        std::vector<std::pair<osg::ref_ptr<osg::Node>, osg::ref_ptr<osg::Callback>>>& map, osg::Node* objectRoot)
    {
        for (int i = 0; i < 2; ++i)
        {
            mSpineControllers[i] = nullptr;

            Animation::NodeMap::const_iterator found = nodes.find(i == 0 ? "bip01 spine1" : "bip01 spine2");
            if (found != nodes.end())
            {
                osg::Node* node = found->second;
                mSpineControllers[i] = new RotateController(objectRoot);
                node->addUpdateCallback(mSpineControllers[i]);
                map.emplace_back(node, mSpineControllers[i]);
            }
        }
    }
...
    void WeaponAnimation::configureControllers(float characterPitchRadians)
    {
        if (mPitchFactor == 0.f || characterPitchRadians == 0.f)
        {
            setControllerEnabled(false);
            return;
        }

        float pitch = characterPitchRadians * mPitchFactor;
        osg::Quat rotate(pitch / 2, osg::Vec3f(-1, 0, 0));
        setControllerRotate(rotate);
        setControllerEnabled(true);
    }
```

## [C] The spine controllers are attached only in VM_Normal, but configureControllers runs every frame in every view mode
- `apps/openmw/mwrender/npcanimation.cpp:706-729, 924-951` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

NpcAnimation::addControllers is an if / else-if with NO else. It always starts by calling Animation::addControllers(), setting `mFirstPersonNeckController = nullptr` and calling `WeaponAnimation::deleteControllers()` (which nulls both spine pointers). Then: `if (mViewMode == VM_FirstPerson)` -> attach the "bip01 neck" RotateController, and ONLY when `mStates.size() > 0` (rule 30) — the spine controllers are NOT attached; `else if (mViewMode == VM_Normal)` -> `WeaponAnimation::addControllers(mNodeMap, mActiveControllers, mObjectRoot.get())`. VM_HeadOnly (the third enum value, npcanimation.hpp:39-44) matches NEITHER branch and therefore gets no neck controller and no spine controllers. Independently of all that, NpcAnimation::runAnimation calls `WeaponAnimation::configureControllers(mPtr.getRefData().getPosition().rot[0] + getBodyPitchRadians())` UNCONDITIONALLY, outside every view-mode test, on every frame, for every NPC. In first person and head-only this is a no-op by construction: setControllerRotate/setControllerEnabled iterate `for (int i = 0; i < 2; ++i) if (mSpineControllers[i])` over two null pointers. mPitchFactor is still being maintained by CharacterController every frame in first person — it is computed and stored and then consumed by nobody. THE ARGUMENT: `rot[0]` is the actor's PITCH in radians straight out of ESM::Position (positive = looking down in Morrowind's convention); `getBodyPitchRadians()` (animation.hpp:490) is mBodyPitchRadians, which CharacterController sets NONZERO only for a non-first-person biped swimming forward/back with the turn-to-movement-direction setting on, where it eases toward `-rot[0]` at a maximum of 3.0 rad/s (character.cpp:2333-2344) and is otherwise forced to 0. So the sum is normally just rot[0], and while swimming it converges to rot[0] + (-rot[0]) = 0, i.e. the spine aim pitch cancels itself out exactly when the whole root is already being pitched by mRootController (`legYaw * osg::Quat(mBodyPitchRadians, osg::Vec3f(1, 0, 0))`, animation.cpp:1417-1422 — note that one is about +X, the spine one about -X). CreatureWeaponAnimation has no view mode: its addControllers always calls WeaponAnimation::addControllers (guarded only by `if (mObjectRoot)`) and its runAnimation calls configureControllers with the identical argument (creatureanimation.cpp:259-272), so weapon-carrying creatures always get the spine pitch.

```cpp
    osg::Vec3f NpcAnimation::runAnimation(float timepassed)
    {
        osg::Vec3f ret = Animation::runAnimation(timepassed);

        mHeadAnimationTime->update(timepassed);

        if (mFirstPersonNeckController)
        { ... }

        WeaponAnimation::configureControllers(mPtr.getRefData().getPosition().rot[0] + getBodyPitchRadians());

        return ret;
    }

    void NpcAnimation::addControllers()
    {
        Animation::addControllers();

        mFirstPersonNeckController = nullptr;
        WeaponAnimation::deleteControllers();

        if (mViewMode == VM_FirstPerson)
        {
            if (mStates.size() > 0)
            { ... "bip01 neck" RotateController ... }
        }
        else if (mViewMode == VM_Normal)
        {
            WeaponAnimation::addControllers(mNodeMap, mActiveControllers, mObjectRoot.get());
        }
    }
```

## [C] setPitchFactor: 0 by default, 1 while attacking with Ranged or Thrown, with a wind-up ramp-in and two different ramp-outs
- `apps/openmw/mwmechanics/character.cpp:1868-1895` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

Every call of CharacterController::updateWeaponState first does `mAnimation->setPitchFactor(0.f)` unconditionally, then raises it only if BOTH: `mUpperBodyState > UpperBodyState::WeaponEquipped` (the enum is None=0, Equipping=1, Unequipping=2, WeaponEquipped=3, AttackWindUp=4, AttackRelease=5, AttackEnd=6, Casting=7 — character.hpp:107-117, so the condition is exactly AttackWindUp | AttackRelease | AttackEnd | Casting) AND the weapon class of mWeaponType is `ESM::WeaponType::Ranged` or `ESM::WeaponType::Thrown` (melee, spell, hand-to-hand, pick/probe never pitch). Baseline in that block is 1.0f, then two mutually exclusive overrides: (1) WIND-UP RAMP-IN — only when `mUpperBodyState == UpperBodyState::AttackWindUp` AND `!isRandomAttackAnimation(mCurrentWeapon)`, where isRandomAttackAnimation is the exact set {"attack1","attack2","attack3","swimattack1","swimattack2","swimattack3"} (character.cpp:2934-2938). It reads `currentTime = getCurrentTime(mCurrentWeapon)` (-1 if that group is not playing), `minAttackTime = getTextKeyTime(mCurrentWeapon + ": " + mAttackType + " min attack")` and `startTime = getTextKeyTime(mCurrentWeapon + ": " + mAttackType + " start")` — getTextKeyTime is a PREFIX match scanning anim sources in reverse and returns -1.0f when the key is absent (animation.cpp:840-854). Only if `startTime <= currentTime && currentTime < minAttackTime` does it set `factor = (currentTime - startTime) / (minAttackTime - startTime)`. There is no clamp; the guard alone confines it to [0,1). If either key is missing the guard normally fails and the factor stays at 1.0 — a hard snap, which is exactly what the comment means by "Random attack animations never have one [a pre-wind-up section]". (2) RAMP-OUT — only when `mUpperBodyState == UpperBodyState::AttackEnd`: if `mWeaponType == ESM::Weapon::MarksmanCrossbow` the factor is `std::max(0.f, 1.f - complete * 10.f)`, reaching 0 at complete == 0.1, i.e. the pitch is dumped over the FIRST TENTH of the reload and the rest of the reload plays unpitched; every other ranged/thrown weapon gets `1.f - complete`, a linear fade across the whole follow section. `complete` is AnimState::getCompletion() of mCurrentWeapon from Animation::getInfo — `(getTime() - mStartTime) / (mStopTime - mStartTime)`, or `mPlaying ? 0.0f : 1.0f` when mStopTime <= mStartTime, and 0.0f when the group is not in mStates (animation.cpp:1212-1229, 2160-2166). In the AttackEnd state that span is the "<attackType> follow start" -> "<attackType> follow stop" section just started at character.cpp:1811-1815, so complete is confined to [0,1] and 1-complete never goes negative. AttackRelease and Casting take NEITHER branch: the factor stays exactly 1.0. Immediately after, `mAnimation->setAccurateAiming(mUpperBodyState > UpperBodyState::WeaponEquipped)` uses the same state test but WITHOUT the weapon-class test.

```cpp
        mAnimation->setPitchFactor(0.f);
        if (mUpperBodyState > UpperBodyState::WeaponEquipped
            && (weapclass == ESM::WeaponType::Ranged || weapclass == ESM::WeaponType::Thrown))
        {
            mAnimation->setPitchFactor(1.f);

            // A smooth transition can be provided if a pre-wind-up section is defined. Random attack animations never
            // have one.
            if (mUpperBodyState == UpperBodyState::AttackWindUp && !isRandomAttackAnimation(mCurrentWeapon))
            {
                float currentTime = mAnimation->getCurrentTime(mCurrentWeapon);
                float minAttackTime = mAnimation->getTextKeyTime(mCurrentWeapon + ": " + mAttackType + " min attack");
                float startTime = mAnimation->getTextKeyTime(mCurrentWeapon + ": " + mAttackType + " start");
                if (startTime <= currentTime && currentTime < minAttackTime)
                    mAnimation->setPitchFactor((currentTime - startTime) / (minAttackTime - startTime));
            }
            else if (mUpperBodyState == UpperBodyState::AttackEnd)
            {
                // technically we do not need a pitch for crossbow reload animation,
                // but we should avoid abrupt repositioning
                if (mWeaponType == ESM::Weapon::MarksmanCrossbow)
                    mAnimation->setPitchFactor(std::max(0.f, 1.f - complete * 10.f));
                else
                    mAnimation->setPitchFactor(1.f - complete);
            
...(truncated; see the cited lines)
```

## [C] UNRESOLVED: OpenMW has NO code path that pitches a first-person arm for bow aim — do not invent one and call it parity
- `apps/openmw/mwrender/weaponanimation.cpp:111-114` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

Exhaustively, from source: (1) the only thing that applies aim pitch to a rig is the pair of spine RotateControllers, and they are attached ONLY under `else if (mViewMode == VM_Normal)`; (2) the first-person branch attaches the "bip01 neck" controller instead, which rotates the neck subtree — the head and the "Camera" bone — while the arms hang off the clavicles under spine1/spine2 and are therefore NOT moved by it; (3) the first-person camera's ORIENTATION does not come from the rig at all: Camera::getOrient() is `osg::Quat(mRoll+mExtraRoll,(0,1,0)) * osg::Quat(mPitch+mExtraPitch,(1,0,0)) * osg::Quat(mYaw+mExtraYaw,(0,0,1))` (apps/openmw/mwrender/camera.cpp:211-215) and the tracked bone supplies only the camera POSITION (camera.cpp:110-127); (4) the actor's scene node itself is rotated by YAW ONLY — `makeActorOsgQuat` is `osg::Quat(position.rot[2], osg::Vec3(0, 0, -1))` (apps/openmw/mwworld/scene.cpp:59-62), so rot[0] never tilts the rig; it is consumed solely by the neck controller, the spine controllers and the camera; (5) mPitchFactor is nevertheless computed and stored every frame in first person by CharacterController and configureControllers is still called every frame — it just finds two null controllers. NET BEHAVIOUR IN OPENMW FIRST PERSON: the bow and the arms sit at whatever the ".1st" animation authored, the camera pitches freely, and the two are visually decoupled. What the projectile does is independent of ALL of it: WeaponAnimation::releaseArrow takes the launch POSITION from the world transform of the ammunition node (so in third person the spine pitch does move the spawn point) but builds the direction purely from the actor's numbers — `orient = osg::Quat(rot[0], osg::Vec3f(-1,0,0)) * osg::Quat(rot[2], osg::Vec3f(0,0,-1))`, in that operand order, with the comment "Always the same as the actor orientation, even if the ArrowBone's orientation dictates otherwise" (weaponanimation.cpp:111-114) — so aim accuracy is unaffected by whether anything is pitched. WHAT IS UNRESOLVED: OpenMW gives no answer as to what a first-person arm SHOULD do with bow pitch — there is no first-person equivalent of the spine controllers, no first-person mPitchFactor consumer, and no comment explaining the omission. Whether original Morrowind pitched first-person arms cannot be decided from this source. A port that adds a first-person spine/arm pitch is DIVERGING from OpenMW, not matching it, and must be flagged as such; a port that omits it reproduces OpenMW exactly.

```cpp
        // The orientation of the launched projectile. Always the same as the actor orientation, even if the ArrowBone's
        // orientation dictates otherwise.
        osg::Quat orient = osg::Quat(actor.getRefData().getPosition().rot[0], osg::Vec3f(-1, 0, 0))
            * osg::Quat(actor.getRefData().getPosition().rot[2], osg::Vec3f(0, 0, -1));

// apps/openmw/mwworld/scene.cpp:59-62
    osg::Quat makeActorOsgQuat(const ESM::Position& position)
    {
        return osg::Quat(position.rot[2], osg::Vec3(0, 0, -1));
    }

// apps/openmw/mwrender/camera.cpp:211-215
    osg::Quat Camera::getOrient() const
    {
        return osg::Quat(mRoll + mExtraRoll, osg::Vec3d(0, 1, 0)) * osg::Quat(mPitch + mExtraPitch, osg::Vec3d(1, 0, 0))
            * osg::Quat(mYaw + mExtraYaw, osg::Vec3d(0, 0, 1));
    }
```

## [C] VFS path normalisation is three ordered byte passes: backslash→slash, ASCII-ONLY lowercase, collapse separator runs, drop the leading separator
- `components/vfs/pathutil.hpp:15-77 (plus 156-161, 206-235, 289-297, 303-325)` - importance **critical**
- REFINES OR CORRECTS RECORDED RULE 36
- **UNVERIFIED** - extracted by one reader, never challenged

`VFS::Path::normalize(char c)` = `c == '\\' ? '/' : toLower(c)`, where `toLower` is a 256-entry byte table that maps ONLY 0x41-0x5A ('A'-'Z') to 0x61-0x7A and leaves every other byte value unchanged (components/misc/strings/lower.hpp:10-29). `normalizeFilenameInPlace` then runs exactly three passes, IN THIS ORDER: (1) transform every byte with `normalize`; (2) `std::unique` with predicate `a=='/' && b=='/'`, collapsing every RUN of consecutive separators to one; (3) if the first surviving byte is '/', drop exactly one — because step 2 already collapsed a leading run to a single '/', ANY number of leading separators ends up removed. Nothing else happens: '.'/'..' are NOT resolved, a TRAILING '/' is NOT removed (that is why the literals "meshes/" and "animations/" are legal), colons/drive letters are untouched, there is no Unicode case folding and no NFC. In JS you MUST use a hand-written A-Z map over bytes; `String.prototype.toLowerCase()` is wrong because it also folds non-ASCII (À→à, İ→i̇) and BSA names carry code-page bytes OpenMW never folds. `isNormalized(s)` (pathutil.hpp:23-43): empty → true; `s[0]=='/'` → false; any byte != normalize(byte) → false; any i>0 with `s[i]=='/' && s[i-1]=='/'` → false. Type contract: `Normalized(std::string_view)` normalizes on construction, but `NormalizedView(const char*)` THROWS `std::invalid_argument` when the literal is not already normalized (pathutil.hpp:156-161) — every path literal in the engine is lowercase / forward-slash / no leading slash. Accessors, exactly: `extension()` = everything after the LAST '.' in the WHOLE string, dot excluded, empty if there is no '.' — it does NOT stop at the last '/', so "a.b/c" yields "b/c"; `filename()` = everything after the last '/'; `stem()` = `filename()` truncated at ITS last '.'; `parent()` = everything before the last '/', empty when there is none. `changeExtension(ext)` scans backwards for the first '.'-or-'/'; if that is a '/' or nothing is found it returns false and changes nothing; otherwise it replaces everything after that '.' with `ext` (ext is stored WITHOUT a leading dot) and returns true — so "foo.nif"→"foo.kf" and "foo."→"foo.kf". `append(string_view)` inserts exactly one '/' first (none if the receiver is empty) and then normalizes ONLY the appended segment; `operator/` on two NormalizedViews joins with one '/' and re-normalizes nothing.

```cpp
inline constexpr char separator = '/';
inline constexpr char extensionSeparator = '.';

[[nodiscard]] inline constexpr char normalize(char c)
{
    return c == '\\' ? separator : Misc::StringUtils::toLower(c);
}
...
[[nodiscard]] inline auto removeDuplicatedSeparators(auto begin, auto end)
{
    return std::unique(begin, end, [](char a, char b) { return a == separator && b == separator; });
}

[[nodiscard]] inline auto removeLeadingSeparator(auto begin, auto end)
{
    if (begin != end && *begin == separator)
        return begin + 1;
    return begin;
}

[[nodiscard]] inline auto normalizeFilenameInPlace(auto begin, auto end)
{
    std::transform(begin, end, begin, normalize);
    end = removeDuplicatedSeparators(begin, end);
    begin = removeLeadingSeparator(begin, end);
    return std::pair(begin, end);
}
```

## [C] "Does this file exist" is ONE exact byte lookup in a single flat sorted map — no directory walk, no case retry, no extension fallback
- `components/vfs/manager.cpp:32-38, 55-72, 100-136 (with components/vfs/filemap.hpp:16 and components/vfs/recursivedirectoryiterator.hpp:19-21)` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

The whole VFS is one `std::map<Path::Normalized, File*, std::less<>>` (components/vfs/filemap.hpp:16) keyed by the fully normalized relative path, built once by `buildIndex()`. `Manager::exists(name)` is literally `mIndex.find(name) != mIndex.end()` — a single exact byte-wise string comparison. There is NO filesystem probe, NO case-insensitive rescan, NO extension fallback and NO directory traversal inside `exists`; every fallback chain (the .dds→original-ext→top-level-flatten walk of rule 36, the x-prefix KF probe of rule 18, the `_sh` scabbard probe) is spelled out by the CALLER as repeated `exists()` calls. Both overloads take an ALREADY-normalized argument (`Path::Normalized` or `NormalizedView`), so a port must apply rule A to the query string first; `getNormalized`/`findNormalized` `assert(Path::isNormalized(...))`. Sibling API contracts: `find(name)` returns an open stream or **nullptr**; `get(name)` throws `std::runtime_error("Resource '" + name + "' not found")`; `getLastModified`/`getStem` throw the same on a miss. Directory listing is a PURE SORTED-PREFIX RANGE over that same map, not a tree walk: `getRecursiveDirectoryIterator(path)` normalizes `path`, takes `lower_bound(path)`; if that is `end()` or its key does not `starts_with(path)` the range is EMPTY; otherwise the upper bound is `lower_bound(path with its LAST BYTE incremented by one)`. It therefore yields FULL normalized paths (not bare filenames), recurses implicitly through subdirectories, returns an empty range for a directory holding no files, and — because the test is a plain string prefix — matches siblings unless the caller appends a trailing '/' (which `Animation::loadAdditionalAnimations` does). An empty path yields the entire index. Implement `exists` as `index.has(normalize(p))` over a `Map`/sorted array and implement listing as a prefix range over the sorted keys; anything cleverer will diverge from OpenMW.

```cpp
bool Manager::exists(const Path::Normalized& name) const
{
    return mIndex.find(name) != mIndex.end();
}
...
RecursiveDirectoryRange Manager::getRecursiveDirectoryIterator(std::string_view path) const
{
    if (path.empty())
        return { mIndex.begin(), mIndex.end() };
    std::string normalized = Path::normalizeFilename(path);
    const auto it = mIndex.lower_bound(normalized);
    if (it == mIndex.end() || !it->first.view().starts_with(normalized))
        return { it, it };
    ++normalized.back();
    return { it, mIndex.lower_bound(normalized) };
}
```

## [C] Load order: every BSA first in list order, then every data dir in list order, and the index is built by OVERWRITE — so the last archive wins and loose files always beat BSAs
- `components/vfs/registerarchives.cpp:16-53 (with components/vfs/manager.cpp:27-38, components/vfs/filesystemarchive.cpp:14-61, components/vfs/bsaarchive.hpp:84-92, apps/openmw/engine.cpp:456-460 and 749)` - importance **critical**
- **UNVERIFIED** - extracted by one reader, never challenged

`registerArchives` does exactly three things, in order. (1) For each entry of `archives` IN LIST ORDER, resolve the name to a real file and `vfs->addArchive(makeBsaArchive(path, encoder))`; if a listed archive cannot be found it THROWS `std::runtime_error("Archive '<name>' not found")` — a missing BSA is fatal, never skipped. (2) If `useLooseFiles` (apps/openmw/engine.cpp:749 passes a hardcoded `true` for the game), for each data directory IN LIST ORDER add a `FileSystemArchive`, skipping any path already added (`std::set` dedupe, logged "Ignoring duplicate data directory"). (3) `buildIndex()` clears the index and calls `listResources(mIndex)` on each archive IN INSERTION ORDER; both implementations do `out[key] = &file` — plain ASSIGNMENT, not insert — so THE LAST ARCHIVE TO BE ADDED WINS. The exact consequences to implement: a loose file always beats any BSA (all BSAs are registered before any directory); a later `fallback-archive=` entry beats an earlier one (apps/openmw/options.cpp: "set fallback BSA archives (later archives have higher priority)"); a later `data=` directory beats an earlier one; OpenMW's own `resources/vfs` directory is inserted at the FRONT of the data-dir list (engine.cpp:456-460) making it the LOWEST-priority loose source. Archive-name→path resolution walks the data dirs in REVERSE (last first) and compares only the FILENAME case-insensitively, returning the first hit (components/files/collections.cpp:33-48) — so a same-named BSA in a later data dir shadows the earlier one. Inside ONE `FileSystemArchive`: files are enumerated with `recursive_directory_iterator(dir, follow_directory_symlink)`, directories are not entries, and the key is the path relative to the data dir (the prefix stripped is `dirString.size()`, +1 unless the dir string already ends in '\\' or '/') put through rule A. If two on-disk files normalize to the same key (they differ only in case), `mIndex.emplace` keeps the FIRST one the iterator reached — filesystem-defined, NOT deterministic — and logs "Found duplicate file for '<path>'".

```cpp
for (std::vector<std::string>::const_iterator archive = archives.begin(); archive != archives.end(); ++archive)
{
    if (collections.doesExist(*archive))
    {
        // Last BSA has the highest priority
        const auto archivePath = collections.getPath(*archive);
        ...
        vfs->addArchive(makeBsaArchive(archivePath, encoder));
    }
    else
    {
        throw std::runtime_error("Archive '" + *archive + "' not found");
    }
}

if (useLooseFiles)
{
    std::set<std::filesystem::path> seen;
    for (const auto& dataDir : dataDirs)
    {
        if (seen.insert(dataDir).second)
        {
            // Last data dir has the highest priority
            vfs->addArchive(std::make_unique<FileSystemArchive>(dataDir));
        }
        ...
```

## [C] Building the index from a Morrowind BSA: all-uint32 little-endian, magic 0x100, and the hash table is READ AND THROWN AWAY
- `components/bsa/bsafile.cpp:77-215 (with components/vfs/bsaarchive.hpp:74-97)` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

Uncompressed Morrowind BSA layout, all integers little-endian uint32 unless stated. Header = 12 bytes: `magic` (must equal 0x00000100 exactly, else fail "Unrecognized BSA header"), `dirsize`, `filenum`. Immediately after: `filenum` records of TWO uint32 each — (fileSize, offset) — i.e. 8*filenum bytes; then `filenum` uint32 name-offsets (4*filenum bytes) indexing into the name buffer; then the name buffer of exactly `dirsize - 12*filenum` bytes of NUL-terminated strings. Then `filenum` 8-byte hash entries (two uint32, mLow/mHigh). Then the data buffer. `fileDataOffset = 12 + dirsize + 8*filenum`, and every record's stored `offset` is RELATIVE to that, so absolute = stored + fileDataOffset. THE HASH TABLE IS READ AND DISCARDED — the comment is verbatim "8*filenum - hash table block, we currently ignore this"; lookup is never by hash. `getHash()` exists only for WRITING archives (bsafile.cpp:312). DO NOT implement Morrowind's BSA hash for lookups: OpenMW builds its own normalized-name index instead. Name bytes are decoded from the configured legacy code page (default `win1252`, apps/openmw/options.cpp:77) to UTF-8 by `ToUTF8::StatelessUtf8Encoder` BEFORE normalisation (components/vfs/bsaarchive.hpp:78, 89-90), and only then put through rule A — so "meshes\\Foo.NIF" becomes the key "meshes/foo.nif", while non-ASCII bytes are code-page converted but NOT case-folded. Validation OpenMW enforces and a port should reproduce: file smaller than 12 bytes → "File too small to be a valid BSA archive"; `filenum*21 > fsize-12` OR `dirsize + 8*filenum > fsize-12` → "Directory information larger than entire archive"; `nameOffset >= nameBufferSize` → "Archive contains names offset outside itself"; no NUL found after a name offset → "Archive contains non-zero terminated string"; `fileSize + absoluteOffset > fsize` → "Archive contains offsets outside itself".

```cpp
// - 8 bytes*numfiles, each record contains:
//         fileSize
//         offset into data buffer (see below)
// - 4 bytes*numfiles, each record is an offset into the following name buffer
// - name buffer, indexed by the previous table, each string is null-terminated. Size is (dirsize - 12*numfiles).
// - 8*filenum - hash table block, we currently ignore this
...
    uint32_t head[3];
    input.read(reinterpret_cast<char*>(head), 12);
    if (head[0] != 0x100)
        fail("Unrecognized BSA header");
    dirsize = head[1];
    filenum = head[2];
...
    const std::streamsize fileDataOffset = 12 + dirsize + 8 * filenum;
```

## [C] DO NOT IMPLEMENT weapon/shield sheathing — it is an off-by-default OpenMW feature that needs modded `_sh` assets; the vanilla rule is one line
- `apps/openmw/mwrender/actoranimation.cpp:141-160, 162-184, 187-248, 252-283, 321-406 (with apps/openmw/mwrender/npcanimation.cpp:991-1013, 1127-1136, 311-316 and files/settings-default.cfg:318-322)` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

Gated by two settings, BOTH defaulting to false (files/settings-default.cfg:318-322, "Render holstered weapons (with quivers and scabbards), requires modded assets" / "Render holstered shield when it is not in actor's hands, requires modded assets"): `Game/weapon sheathing` and `Game/shield sheathing`. They require assets no Morrowind install has: an `xbase_anim_sh.nif` carrying extra weapon bones injected into the skeleton, per-item meshes named by `addSuffixBeforeExtension(mesh, "_sh")` (insert `_sh` before the last '.', or append if there is no '.', apps/openmw/mwrender/actorutil.cpp:40-50), and named nodes `Bip01 AttachShield`, `Bip01 Sheath`, `Bip01 Weapon`. DO NOT PORT: `updateHolsteredShield` (actoranimation.cpp:187-248), `updateHolsteredWeapon` (:321-406), `updateQuiver` (:410-), `getSheathedShieldMesh` (:141-160), `useShieldAnimations` (:252-283), and the `_sh` existence probes. WHAT VANILLA DOES INSTEAD, exactly: `updateCarriedLeftVisible(weaptype)` must collapse to its final line — `return !(MWMechanics::getWeaponType(weaptype)->mFlags & ESM::WeaponType::TwoHanded);` — i.e. the carried-left (shield) part is shown unless the equipped weapon type is flagged two-handed, and nothing else is consulted (no draw state, no `Bip01 AttachShield` search, no inventory probe, and in NpcAnimation no `mViewMode == VM_FirstPerson` branch, npcanimation.cpp:991-1013). A holstered weapon/shield simply is not rendered when not in hand; there is no scabbard, no quiver and no back-mounted shield. `useShieldAnimations()` must return false, so the text keys `"shield: equip attach"` and `"shield: unequip detach"` are never looked up. Keep `getShieldMesh` itself (actoranimation.cpp:108-139) — resolving a shield through its `PRT_Shield` body part with a male/female pick and an MT_Armor type check, falling back to the ground model — that part IS vanilla and is used by normal equipping.

```cpp
bool ActorAnimation::updateCarriedLeftVisible(const int weaptype) const
{
    if (Settings::game().mShieldSheathing && mObjectRoot)
    {
        ...
            SceneUtil::FindByNameVisitor findVisitor("Bip01 AttachShield");
            mObjectRoot->accept(findVisitor);
            if (findVisitor.mFoundNode)
            { ... return false; }
    }

    return !(MWMechanics::getWeaponType(weaptype)->mFlags & ESM::WeaponType::TwoHanded);
}
...
void ActorAnimation::updateHolsteredShield(bool showCarriedLeft)
{
    if (!Settings::game().mShieldSheathing)
        return;
```

## [C] DO NOT IMPLEMENT smooth animation transitions / AnimBlendRules — off by default, driven by a YAML file OpenMW itself ships; vanilla switches poses with zero cross-fade
- `apps/openmw/mwrender/animation.cpp:737-765 and 1155-1174 (with components/sceneutil/animblendrules.cpp:18-39, 116-163 and files/data/animations/animation-config.yaml)` - importance **high**
- **UNVERIFIED** - extracted by one reader, never challenged

Gated by `Game/smooth animation transitions`, default FALSE (files/settings-default.cfg:306-308). With it OFF — the vanilla path — `Animation::resetActiveGroups` installs the raw keyframe controller: `osg::Callback* callback = it->second->getAsCallback();` and adds it directly (animation.cpp:1159, 1174). There is NO cross-fade whatsoever: on the frame a new group starts, its pose replaces the previous pose outright. Implement ONLY that. With it ON, `addSingleAnimSource` loads blend rules and — note the operand ORDER — for ACTORS calls `getRules(globalBlendConfigPath, blendConfigPath)` where the GLOBAL `"animations/animation-config.yaml"` is the template and the per-KF file (the .kf path with its extension changed to "yaml") is the OVERRIDE; `getRules` returns nullptr when the FIRST path is missing even if the override exists (components/resource/animblendrulesmanager.cpp:35-38). For non-actor objects it calls `getRules(blendConfigPath, blendConfigPath)` — objects have no default blending. That global YAML is authored by OpenMW and shipped in `files/data/animations/animation-config.yaml`; no Morrowind install contains it, so against a vanilla Data Files VFS the whole feature loads nothing. If ever ported, the matching contract is: rules are scanned from LAST to FIRST (`rbegin`→`rend`) and the FIRST match wins, so later rules override earlier ones and `addOverrideRules` appends the per-animation rules AFTER the global ones; each rule side is lowercased and split on the FIRST ':' into (group, key) with both halves trimmed — plain ':' here, NOT the ": " separator that splits text keys in rule 21; a side matches when the rule string is `"*"`, equals the value exactly, is `"*suffix"` and the value `ends_with(suffix)`, or is `"prefix*"` and the value `starts_with(prefix)` — wildcards are supported ONLY at the very first or very last character; an EMPTY key half matches anything; the literal `"$"` as the to-group means "the same group as the from-group"; a YAML entry missing any of from/to/duration/easing is skipped with a warning, and if zero rules survive `fromFile` returns nullptr rather than an empty rule set.

```cpp
// Get the blending rules
if (Settings::game().mSmoothAnimTransitions)
{
    constexpr VFS::Path::ExtensionView yaml("yaml");
    VFS::Path::Normalized blendConfigPath(kfname);
    blendConfigPath.changeExtension(yaml);
    // globalBlendConfigPath is only used with actors! Objects have no default blending.
    constexpr VFS::Path::NormalizedView globalBlendConfigPath("animations/animation-config.yaml");
    ...
        blendRules = mResourceSystem->getAnimBlendRulesManager()->getRules(globalBlendConfigPath, blendConfigPath);
...
    osg::Callback* callback = it->second->getAsCallback();
    if (useSmoothAnims) { ... callback = handleBlendTransform<NifAnimBlendController>(...); }
```

## [C] DO NOT IMPLEMENT the three remaining modded-asset features: additional anim sources (plus its skeleton-bone injection), day/night switch nodes, graphic herbalism
- `apps/openmw/mwrender/animation.cpp:623-660, 1570-1600, 2104-2114 (with components/settings/categories/game.hpp:41, 68, 73 and files/settings-default.cfg:303-304, 369-370, 379-380)` - importance **medium**
- **UNVERIFIED** - extracted by one reader, never challenged

Three more OpenMW-only behaviours reachable from the animation path; none exist in Morrowind. (1) `Game/use additional anim sources`, default FALSE ("Allow to load per-group KF-files from Animations folder"). It does two separate things and BOTH must be skipped. (a) `loadAdditionalAnimations` (animation.cpp:623-644): if the model path does NOT start with "meshes/" it returns immediately; otherwise it replaces that 7-byte prefix with "animations/", finds the LAST '.' in the whole remaining path (returns if there is none), replaces everything from that '.' to the end with a single "/", and then adds EVERY entry under that prefix whose `extension()` is "kf" as an extra anim source — so "meshes/xbase_anim.kf" scans "animations/xbase_anim/" recursively. Vanilla has exactly one KF per skeleton and no Animations/ tree. (b) The SAME setting gates default-skeleton bone injection for actors (animation.cpp:1570-1600): with it off, a Creature flagged `Bipedal` gets no `xbase_anim` bones, and an NPC with a non-empty custom `mModel` gets NO bones injected from the race/sex default skeleton — the custom model stands alone. (2) `Game/day night switches`, default TRUE but still OpenMW-only: it only fires when the loaded model carries the `Constants::NightDayLabel` user description (animation.cpp:2104-2107); no vanilla NIF does, so a port that omits the AddSwitchCallbacksVisitor loses nothing. (3) `Game/graphic herbalism`, default TRUE: needs a harvestable container model plus custom data (animation.cpp:2110-2114); vanilla always opens the container menu instead. Reasoning for all three: each is guarded by a `Settings::game()` flag whose documented purpose is to consume assets shipped by mods ("Some mods add models which change visuals based on time of day", "Some mods add harvestable container models", "if you want to use several animation replacers without merging them"). Porting them adds code paths that can never trigger on vanilla data but can misfire on it — exactly the class of guessed behaviour that broke earlier attempts.

```cpp
void Animation::loadAdditionalAnimations(VFS::Path::NormalizedView model, const std::string& baseModel)
{
    constexpr VFS::Path::NormalizedView meshes("meshes/");
    if (!model.value().starts_with(meshes.value()))
        return;
    std::string path(model.value());
    constexpr VFS::Path::NormalizedView animations("animations/");
    path.replace(0, meshes.value().size(), animations.value());
    const std::string::size_type extensionStart = path.find_last_of(VFS::Path::extensionSeparator);
    if (extensionStart == std::string::npos)
        return;
    path.replace(extensionStart, path.size() - extensionStart, "/");
    constexpr VFS::Path::ExtensionView kf("kf");
    for (const VFS::Path::Normalized& name : mResourceSystem->getVFS()->getRecursiveDirectoryIterator(path))
        if (name.extension() == kf)
            addSingleAnimSource(name, baseModel);
}
```

---

# Part V - tier C promotions, verified by hand

MW-R6 (2026-08-29). No fan-out; read solo, because the fan-outs were the
expense and Mac flagged the budget. Five tier C rules promoted - chosen
because they are exactly what MW-D, the diagnostic, touches first: open the
player's BSA, read a NIF header, decode a bone name. TWO OF THE FIVE NEEDED
CORRECTING, which is the tier C base rate showing up on schedule.

## [VERIFIED] The Morrowind BSA directory is ONE contiguous block, and the hash table is skipped

`components/bsa/bsafile.cpp:77-205`. Layout, exactly:

    12-byte header: 3x uint32 LE - id (MUST be 0x100), dirsize, filenum
    then 3*filenum uint32, read as ONE block of 12*filenum bytes:
        offsets[i*2]              -> fileSize
        offsets[i*2 + 1]          -> data offset, RELATIVE to fileDataOffset
        offsets[2*filenum + i]    -> name offset into the string buffer
    string buffer: dirsize - 12*filenum bytes, NUL-terminated names
    hash table: 8*filenum bytes - READ AND IGNORED ("we currently ignore this")
    fileDataOffset = 12 + dirsize + 8*filenum

CORRECTION TO THE TIER C FORM, which said "8 bytes*numfiles then 4
bytes*numfiles". That is the header comment's description of two tables; the
CODE reads one contiguous run of `3 * filenum` uint32 and indexes into it as
above. Same bytes, but a port that reads two separate arrays in sequence and
a port that indexes one array must agree on where the name table starts, and
only the second form is what runs.

Sanity limits the engine enforces, worth copying: `filenum * 21 > fsize - 12`
or `dirsize + 8*filenum > fsize - 12` is a corrupt archive; an entry whose
`fileSize + offset` exceeds the file is corrupt; a name offset at or past the
string buffer's end is corrupt; a name with no NUL is corrupt.

## [VERIFIED] The NIF header is a PREFIX test on one '\n'-terminated line

`components/nif/niffile.cpp:539-562` with `nifstream.cpp:82-90`.
`getVersionString()` is `std::getline` - it reads to the first `\n`. The
result must START WITH either `"NetImmerse File Format"` or `"Gamebryo File
Format"` (`starts_with`, not equality - the line carries a trailing version
in practice). Anything else throws `Invalid NIF header`. The BCD version is
then a raw uint32 immediately after that line.

## [VERIFIED] getSizedString always advances the full length, THEN truncates at NUL

`components/nif/nifstream.cpp:58-72`:

```cpp
std::string str(length, '\0');
mStream->read(str.data(), length);
size_t end = str.find('\0');
if (end != std::string::npos) str.erase(end);
if (mEncoder) str = mEncoder->getUtf8(str, ...);
```

The stream advances by `length` REGARDLESS of where the NUL falls - a port
that stops reading at the NUL desynchronises the stream and every subsequent
field is garbage. Truncation is at the FIRST NUL, and the encoder runs after.

## [VERIFIED, and the rule is the THRESHOLD not the conclusion] A NIF `bool` is 4 bytes below version 4.1.0.0

`components/nif/nifstream.cpp:170-177`:

```cpp
if (getVersion() < generateVersion(4, 1, 0, 0)) data = get<int32_t>() != 0;
else                                            data = get<int8_t>()  != 0;
```

Morrowind is 4.0.0.2, so in Morrowind files every `bool` on the wire is int32
- the tier C claim is correct FOR MORROWIND. But the rule is the version
threshold, and a port that hardcodes 4 bytes will misparse any 4.1.0.0+ file
it is ever handed. Record the comparison, not the answer.

(Same shape at `:179-186`: a `std::string` is a sized string below 20.1.0.1
and a string-table INDEX at or above it. Morrowind takes the sized-string
arm.)

## [CORRECTED] Windows-1252 is a DEFAULT, not an invariant

`apps/openmw/engine.cpp:373` initialises `mEncoding(ToUTF8::WINDOWS_1252)`,
and `:1106-1108` is `setEncoding` - it is a configurable setting, fed from
the user's config, because the localised Morrowind releases ship different
code pages (Russian win1251, Polish win1250, and so on). The encoder is
constructed at `:960` and handed to NIFStream, which applies it inside
getSizedString.

THE TIER C RULE SAID node names "are WINDOWS-1252". They are Windows-1252 in
the English release, which is what this port targets, and that is what the
port should implement - but as a NAMED DEFAULT with the reason written down,
not as a property of the format. A Russian player's Morrowind.bsa would
decode to mojibake bone names under a hardcoded win1252, and the failure mode
would be "no bone matched" with nothing pointing at the cause.

---

# Part VI - OBSERVED ON RETAIL DATA (2026-08-29)

The first entry in this document that is not read off source code. Mac ran
mw-inspect.html against his own Morrowind.bsa and Morrowind.esm. Everything
below is a fact about retail data, and where it contradicts something
recorded above, the observation wins.

## CORRECTION: `meshes/base_anim.1st.nif` IS in the retail archive

MW-R1 recorded, under rule 6, that the reverted rig hardcoded
`base_anim.1st.nif` and that this name "appears nowhere in that table", and
its commit went further: "That alone would have failed the load on retail
data."

THE SECOND HALF WAS WRONG. The file is present in Morrowind.bsa and parses
as a valid NetImmerse 4.0.0.2 NIF. The load SUCCEEDED. Rule 6 remains
correct in what it actually says - the engine asks for `xbase_anim.1st.nif`
for a male non-beast actor and never asks for the plain name - but the
inference drawn from it, that the reverted rig died at the file load, is
disproved.

The real cause stands where MW8 put it: the base skeleton carries no body
geometry, and the arms that were loaded afterwards were thrown away because
only bindPart's `.skinned` half was kept. A wrong filename would have been
the easier bug.

WHAT THIS COSTS: any rule in this document whose evidence is "the engine
does not ask for X" says nothing about whether X is in the archive, and
nothing about what happens if you ask for it anyway. Four skeletons are
present and parse - xbase_anim.1st.nif, base_anim_female.1st.nif,
base_animkna.1st.nif and base_anim.1st.nif - all NetImmerse 4.0.0.2, all
with 4-byte bools, which confirms the header and threshold rules of Part V
against real files.

`meshes/wolf/skin.1st.nif` is ABSENT, which is expected and benign: the
werewolf skeleton ships with Bloodmoon, and only Morrowind.bsa was attached.

## THE FINDING: retail gives a Nord male ONE first-person arm record

Morrowind.esm carries 1,125 BODY records, 64 of them first-person (record id
ending `1st`). For race `nord`, male, the four arm slots resolve:

| slot | record | first-person? |
|---|---|---|
| hand | `b_n_nord_m_hands.1st` | YES |
| wrist | `b_n_nord_m_wrist` | no - third-person fallback |
| forearm | `b_n_nord_m_forearm` | no - third-person fallback |
| upperarm | `b_n_nord_m_upper arm` | no - third-person fallback |

THE FALLBACK IS THE MAIN PATH, NOT AN EDGE CASE. Rule 3 (npcanimation.cpp:
1217-1253) lets exactly hand/wrist/forearm/upperarm fall back to their
third-person mesh when the `1st` record is missing. On retail data three of
those four slots take that path for a Nord male. A port that implements only
the `1st` records - which is the obvious reading, and close to what MW7
did - draws a pair of hands and nothing joining them to the player.

Two further details visible in the same row, both fatal to the filename
approach:

- The hand record is `b_n_nord_m_hand**S**.1st` - PLURAL. MW7 spliced
  `.1st` into the MODL path of a record found by slot, so whatever it built
  came from the singular stem. The engine does not build names; it looks up
  a record id.
- `b_n_nord_m_upper arm` contains a SPACE. Any lookup that assumes record
  ids are path-safe or token-safe breaks on the upper arm specifically.

## What this section does NOT establish

These are one player's files, one race and one sex. The arm coverage for
other races, for females, and with Tribunal or Bloodmoon attached is
unmeasured. The inspector reports whatever it is given, so widening this
table costs nothing but attaching more archives and changing the dropdown -
and until that is done, "three of four slots fall back" is a fact about
nord/male and not yet a fact about Morrowind.
