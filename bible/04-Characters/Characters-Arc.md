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

## Direction pivot 3 (Mac, 2026-07-06): CLASSIC VISUALS

"I think for now we stay with the classic visuals" - E4c (authored
monster morphologies on the rewrite/ bench) is DEFERRED; monsters
remain classic billboards, which the doctrine already names the
baseline visual. The rewrite/ bench stays vendored for when the
direction reopens. Consequence: Rendering's spectral row unblocks ON
BILLBOARDS - shipped same day (see the E4 records + Rendering.md);
with it C8's engine queue is DONE and the arc parks pending
direction (E4c) with the flagged Systems-arc interims tracked in the
Home ledger.

## Direction pivot 2 (Mac, 2026-07-04): NEUTRAL REDESIGN

The paperdoll is redesigned from scratch, NOT constrained to the
reference sprite (Mac: "we aren't constrained to the reference
sprite"). The whole trace/pin lineage below (C6-C7b: row traces
through BODY00I0, the IoU 1.0000 silhouette pin, the derived back
sheet) is RETIRED and REMOVED: daggerBodySpec, silhouetteIoU,
paperdollPose, gen-dagger-spec, fit-pose, silhouette-diff,
paperdoll-spec, the paint sheets, and silhouette.test.js are deleted;
the two DAGGER_SPEC cases in piece.test.js went with them (pieces
re-seat on the neutral rig later). The sections below are HISTORY.

The live model is a designed standing figure - `buildNeutralBody()` in
`src/characters/neutralBody.js` (pure, browser-safe; takes ART_PAL
ramps, returns faces with baked colour):
- **Pose:** arms at the sides, legs parallel and forward, feet
  forward. Proper 7.5-head proportions (total ~2.0 rig units).
- **Geometry:** loft profiles (super-ellipse cross-sections, power
  `p` flattens toward squarish). Torso V-taper broad-shoulder ->
  narrow waist, waist-width hips fused to the thighs. Trapezius yoke +
  angular deltoid caps (planar, low `p` - NOT round balls). Egg head
  (deeper than wide, chin taper). Arms with deltoid/bicep/forearm/
  wrist taper + mitten hands (flat palm, fused fingers, thumb nub).
  Legs thigh-thickest -> thin ankle, defined knee (kneecap bulge +
  joint pinch) and elbow (crease + olecranon). Explicit FLAT-SOLED box
  feet (ring-loft makes a ball; feet are extruded heel->toe).
- **Shading (baked per face):** intensity from the face normal (upper-
  right key) SNAPPED to an ART_PAL ramp step = the blocky look Mac
  wants (skin/boot ramps from the sprite). Geometry AO darkens
  crevices (armpit/crotch/neck/inner joints) by in-front neighbour
  density - flat panels untouched. No lerp, no rim light (both tried,
  rejected). No pecs/abs (tried, "silly").
- **Live:** interiorContext builds buildNeutralBody(ramps) directly;
  baked colours pass straight through (no sprite projection, no paint
  sheets). ?world&play&voxelfolk renders it in the tavern.
- **Viewer:** `tools/neutral/` - standalone Three.js orbit viewer off
  the SAME module (`build-viewer.mjs`, ramps from the sprite). The
  in-chat iteration tool.

Open: pieces (armor) re-seat on the new rig; hands/face detail (face
declined); engine-shader vs baked-shading interaction to confirm.

## Combat layer: CURRENT STATE (integrated + audited 2026-07-06)

The player combat system is COMPLETE and Daggerfall-1:1. The
chronological root-cause logs live in C-Weapons / C-Anim below;
this section is the architecture as it stands.

**The grip-station system.** Every weapon is authored pre-HSCALE on
the left-fist column, every face 'armL', with REAL on-axis station
rings whose centroids ARE the anchors (the phantom-axis rule:
end-only tubes put nearest-vert probes 0.1+ off axis). Grip station
at the bake pivot (post: -0.235, 0.81, 0), test-pinned to 0.003.
Seat bakes: blades/hafted carry Mac's +45 point-forward
(GRIP_PITCH -2.40+pi/4, house layout: pommel HIGH, business end
DESCENDS); bows carry -pi/2 (fore-aft at rest, vertical at aim).

**THE 2H CONTRACT.** Any two-hand weapon that places its off-hand
station at the claymore-standard point (-0.235, 0.8038, -0.1578)
inherits the solved melee2H pose AND the six station-coupled attack
clips BY CONSTRUCTION. Verified across classes: Claymore 0.050,
Dai-Katana 0.049, Warhammer 0.053 seat; strike coupling 0.061-0.105
vs the 0.050 geometric floor (fist radius 0.074).

**The roster: all 19 templates (113-131).** 8 blades (blades.js, one
parameterized builder; curves via per-row cz), 6 hafted (hafted.js;
flanged mace, single/double-bit axes, hammer, quarterstaff, flail
with a RIGID chain-and-ball - fidelity class of the drawn string),
2 bows + the nocked ARROW built into the drawn assembly (tail at the
nock, shaft IS the aim line - alignment/gait-lock/Release free by
construction). Verbatim item math incl. the weight chain's second /4.
Registry is data: payload weaponPacks [{name, hands, pack, items}].

**Poses (v3 format).** melee1H (low ready; 7 blades + 2 hafted 1H
share it), melee2H (coupled two-hand, gait pumps OFF), rangedAim
(bladed archer: twist +0.65 form-locked, draw fist ON the nock 0.012,
humeral roll -1.315 folds the forearm across - the roll DOF exists
because the chain otherwise fully determines elbow orientation from
fist position), fpMelee1H (view-space-solved viewmodel). FORM IS A
CONSTRAINT, NOT AN OUTCOME - anatomy penalties live INSIDE solvers.

**Attacks.** Three clip tables (anims.js): six 1H kinetic-chain
strikes with root motion; six 2H greatsword strikes with OFFLINE
PRE-SOLVED armR tracks (continuity-seeded grids, bd clamped >= -0.33,
rescue + midpoint densify; coils must keep the hilt IN FRONT); one
bow Release (back-driven pull, anchor beat, snap loose 10.9, 50deg
bow roll). The clips are the VISUAL ONLY:

**weaponStates.js OWNS TIME (DFU-verbatim).** tick = 3*(115-SPD)/980;
bow cooldown (10*(100-SPD)+800)/980; classic 16Hz bow ticks; 5-frame
strikes; HIT at melee frame 2 / bow 5 / sound 4; gesture radial table
(six tracked directions, diagonal-up folds to Up); threshold 0.05;
EquipDelayTimes; fatigue 11; the interrupt rule (one-shots
irreplaceable except the bow release); the bow arc press-draw-HOLD
(frame 3) / 10s auto-undraw / release-loose / cooldown. Machine
progress maps onto clip duration. Bow frame span (4 draw / 6 release)
reconstructed from verbatim checkpoints, flagged.

**Input.** Drag-to-swing through the verbatim pipeline (FP left-drag,
orbit right-drag; left-drag stays the camera); direction buttons kept;
bows press=draw/hold, release=loose on button and canvas alike; SPD
slider drives the formula live.

**First person.** Eye rides the POSED head (+0.04, +0.18; FOV 62;
near 0.10 - too-close chest/arm surfaces CLIP instead of filling the
frame, pixel-verified 0.83 -> 0.01 worst). fpMelee1H frames the
weapon bottom-right (the left-dominant rig projects to DF's classic
side for free). ATTACKS_FP (SHIPPED, gate closed): six dedicated
viewmodel strikes - the WRIST drives, body stays small (the camera
rides the head), deltas end at zero. NDC signatures: chop crosses
top-to-bottom through centre (0.05), cuts cross 1.65 frame widths
AND drop through mid-view (pitch drive - yaw alone waves along the
top edge), the thrust levels the point to 0.15 of centre with a
0.16 eye lunge (pitch SIGN pinned: positive lowers the tip on this
base). Pixel near-fill worst 0.06. fpMelee1H routes ATTACKS_FP
through the machine; drag-to-swing works in FP end to end. ZERO
open gates - the combat layer is complete.

**Integration audit (2026-07-06).** Pose switch is a STATE change:
clears the clip + machine (a drawn bow no longer persists over a
melee stance); bows are single-pathed to the pointer pair. Battery:
24 machine strikes at SPD 10/100 across 1H+2H clean (no NaN, worst
vert 1.83), quick-tap loose + cooldown block, weapon-switch mid-swing
completes, orbit camera isolated from gestures.

**Arrow projectile (2026-07-06).** The nocked arrow is its OWN held
target (split from the bow mesh; nocked = identical chain ride,
tail-to-nock 0.014). At the verbatim bow HIT frame it LOOSES into
straight flight along its own axis at DaggerfallMissile
MovementSpeed 25.0 verbatim (ArmLength 0.9 carried); chain loops
skip a flying arrow; despawn at 28, re-nock on the next draw,
visibility choked through the weapon/pose/draw paths. MACHINE-CLOCK
BUG fixed en route: stepping only ran while a clip was live, so
cooldowns never expired and bows locked after one shot - the clock
runs every frame now (Idle steps are just time).

**Deep audit 2 (2026-07-06, post-FP-clips).** Two integration flaws
fixed at root: a FLYING arrow is world state (visibility was tied to
the equipped weapon - switching mid-flight vanished it mid-air; now
flight-first), and combatPose() still excluded fpMelee1H from drag
gestures (a stale gate predating ATTACKS_FP; lifted). Cross-feature
battery green: 2H strike WHILE running holds the off-hand at 0.10
under loco + the machine simultaneously; FP loose flies;
weapon-switch mid-flight keeps the arrow; FP drag fires the FP
table. Static pass clean. Next candidates (unnamed): hit reactions,
enemy rigs on the shared states, engine-world integration.

**Hit reactions (2026-07-06).** Four directional staggers
(HurtFront/Back/Left/Right) knocking the pelvis AWAY from the hit.
COUPLING LAW test-pinned: reactions use ONLY shared channels - body
and held move together, so every station coupling survives by
construction (2H off-hand exactly at the 0.050 baseline through all
four). FREE-CLIP path: reactions run wall-clock outside the weapon
machine (its idle u-mapping would null them) and may interrupt a
swing visually. hurt button cycles; __hurt(name) hook.

**RENDER STANDARD (Mac 2026-07-06; revised 9 -> 7 by Mac): CHAR_PIXEL
= 7 pixelize** for the character and everything character-side; the
WORLD is excluded. Single source: `CHAR_PIXEL` exported from
renderer.js - the engine character pass divides by it and the viewer
defaults to it. (History: shipped at 9; the 9px scanline verification
and slice-4 texel numbers in the log are of the 9 era.) The engine
slices render the CHARACTER PASS at CHAR_PIXEL and leave the world
pass untouched. Live re-verification of the 7x texel grid: open
(needs ARENA2 in the environment).

**Engine-world integration (ACTIVE arc, opened 2026-07-06).** The
world side: bootExterior(canvas, renderer, ...) with pointer-lock,
streamingWorld, terrain, dungeons - a RAW-GL renderer (mat4/
meshReader), not THREE. SLICE 1 SHIPPED: the animation runtime
extracted to src/characters/animate.js, renderer-agnostic
(animateTarget(ctx,...) writes T.pos + T.dirty; the HOST flushes;
createAnimContext binds joint constants from geometry - identical
math). The viewer inlines the module behind a one-line THREE
adapter; every call site/probe signature unchanged; exact-number
regression (claymore StrikeDown offMax 0.097). SLICE 2 SHIPPED: engineRig.js - the canonical runtime in the
engine. RECON CORRECTION: the renderer is hand-rolled WebGL2
(src/render/renderer.js) and createCharacterMesh/update/
drawCharacter ALREADY EXISTED (C4b, consumed by interiorContext's
static chars) - grep-first. engineRig: buildNeutralBody +
deriveClassicRamps (single source; interiorContext's INLINE loco
copy predates animate.js - migration is a named later slice),
per-packed-vertex targets, createAnimContext with the payload's
exact constants, update() splices T.pos over cached normal/color ->
updateCharacterMesh. POSE_L canonicalized into animate.js. ?rig
spawns it near the player in the exterior, walking (12816 verts,
joints 0.90/0.43/1.11 = viewer-identical, scale 0.99). SLICE 3 SHIPPED: grounded. Fixed world placement (captured once);
height queried live through collider.heightAt(x,z) - the player's
own ground contract, so real terrain inherits free. GROUNDING RULE
(pinned): an animated character grounds by its LIVE support point
(current lowest vertex, tracked in the update splice loop) - the
stride arc dips 0.038 below rest minY, so rest-footY placement
clips the floor. Gap 0.000 across the full cycle. SLICE 4 SHIPPED: THE 9x CHARACTER PASS. Characters render into a
low-res offscreen target (projected screen height / 9, NEAREST,
lazy FBO - the renderer's first) under a fitted ortho camera at the
main view's azimuth, composited as a camera-facing alpha-cut FOGGED
quad, depth-tested like classic billboards: a live sprite, chunky
by construction; the world pass untouched. Sizing is
PROJECTION-EXACT (analytic fov estimates disagree with the true
projection at high pitch). ?rigNear parks the rig 24u ahead of the
shot vantage for measurement (the shot camera is near-horizontal at
altitude - its ground ray hits the horizon). PROVEN: texel 8.69 ~ 9
by integer construction; temporal variance 75.0 in-quad vs 0.0
world (animated composite live). SLICE 5 SHIPPED: interior loco
migrated onto the canonical runtime. createCharacterRig(renderer,
faces) generalizes the rig over ANY tagged face list (createEngineRig
is now the neutral-body wrapper, signature unchanged); rigs gain
drive(wt, L, pose, moving) - the absolute-phase entry for hosts with
their own clock (update(dt) keeps the rig-owned clock over it). IDLE
canonicalized into animate.js from the interior's values; the inline
ramps/buildCharMesh/loco in interiorContext are DELETED
(deriveClassicRamps single-sourced live, as pinned). Regression
battery vs the deleted inline math on the same race mesh: idle and
off EXACT (0.0000 worst vert); walk 0.054, fully attributed - the
canonical WALK carries elbowBase 0.18 + lean 0.05 the stale copy
never had (zeroing both -> 0.0000). SLICE 6 SHIPPED: WORLD CAMERA
MODES. First person (default, rig hidden - classic DF shows no body)
/ third person: the rig RIDES the player - FEET position verbatim
from the motor (jumps carry it), facing = cam.yaw (model +z is the
front; trs yaw maps +z -> [sin,0,cos] = fwd, probe-exact), gait from
live input over the SAME keys the motor reads (walk/run; stand =
gait 3, the new IDLE slot in the rig's gait table) - and the eye
pulls back 3.2 along the view ray. V edge-toggles at runtime (lazy
rig build); ?tp starts in third person; ?rig keeps its fixed-park
probe semantics when not riding. rigMat unified onto trs (yaw-0
bit-identical to the old inline T*S) and the sprite-pass center goes
through transformPoint(rigMat, ...) so yaw is exact by construction
(halfW's hypot bound is azimuth-safe under rotation for free).
Node battery: matrix parity 0, facing delta 0.000000 across 4 yaws,
gait-3-vs-drive(IDLE) 0.000000. OPEN: live in-scene verification
(this container has no ARENA2 - user-supplied per doctrine) and
third-person camera-terrain/building clip. Next arc decision: Mac
(candidates: enemy rigs on the shared states; spectral emission
unblock for Rendering).

## C8 - ENEMY RIGS (ACTIVE arc, opened 2026-07-06, Mac: option 1)

Rigged enemies replace the C3 billboards; Rendering's blocked
spectral-emission row unblocks here. The vendored rewrite/ Voxlight
rig is the authoring bench for monster morphologies. Slices:

- **E1 (spine): SHIPPED.** Class enemies (mobileType > 43 - human
  morphology, gender-flagged) spawn as canonical rigs
  (createCharacterRig over buildRaceCharacter, tone/hair varied per
  type) at their C3 markers behind `?foes`, floor-snapped
  (floorLanding through the dungeon collider), IDLE gait,
  deterministic facing (no engine PRNG - Ledger A rule). The
  CHAR_PIXEL sprite pass EXTRACTED from exterior.js verbatim into
  characterSprite.js - player and foes render through ONE
  implementation (context-owned drawFoes; both dungeon hosts wired;
  exterior's shot probe reads the pass diagnostics). Billboards stay
  the default path; monsters 0-42 stay billboards until E4.
  charsprite.test pins projection-exact sizing at CHAR_PIXEL against
  hand-computed values. OPEN: live verification (?dungeon&foes /
  ?foes through an entrance) pending ARENA2 in the environment;
  per-enemy mesh-update perf unmeasured (E4 queue).
- **E2a (senses + approach): SHIPPED.** enemyMotor.js is a verbatim
  port of the CLASSIC path (EnhancedCombatAI=false) from DFU
  EnemyMotor/EnemySenses/EnemyAttack: sight 4096*GlobalScale, FOV 180,
  hearing 25, melee stop 2.25 (vs AI 1.5), in-place turns on
  the 0.0625s classic update behind the 5.625deg move yaw-gate,
  moveSpeed = (LiveSpeed + dfWalkBase)*GlobalScale ("same formula as
  when the player walks"), classic always moves in for attack. Senses
  recompute per classic update (DFU recomputes per Update; the 5-unit
  system timer only switches TARGETS - single-target here, constants
  exported for E3). Grounded via the SAME capsule contract the player
  walks on; gait WALK pursuing / IDLE at rest; LOS through the level
  collider (open swing doors transparent for free - the actionSystem
  bucket rule). Departures documented in the module header (eye = feet
  + 5/6h; stealth pending E3). Flagged E3 plumbing: per-enemy
  LiveSpeed from career stats (stub 50 at the spawn site). 4 tests.
- **E2b (attacks): SHIPPED.** enemyAttack.js ports EnemyAttack.cs
  verbatim onto the SHARED weaponStates machine: MeleeTimer countdown
  (0-floor), speed floor 8, the classic per-update roll
  DFRandom.rand() % speed >= (speed >> 3) + 6 (DFU keeps classic's
  reversed comparison; so do we), MeleeAnimation gates (in sight,
  22.5deg yaw, distance <= MeleeDistance + rate-of-approach),
  ResetMeleeTimer arithmetic exact (Range(1500,3001), -50/level over
  10, +450/reflex step, 0-floor, /980). Unity-Random slots stay
  uniform rolls (DFU's own choice); DFRandom used exactly where DFU
  uses it. The strike is a uniform roll over STRIKES (classic mobiles
  have one PrimaryAttack; the WeaponManager click-attack precedent),
  played on the rig via the authored ATTACKS_1H clips sampled on the
  machine's frame clock (rig.setPose over the gait). 'hit' events
  surface on each foe for E3 damage. PENDING E3: playerLevel/reflexes
  stubs (10/2 - both zero their terms), per-enemy LiveSpeed. 3 tests.
- **E3a (entity layer): SHIPPED.** The pending stubs are gone at the
  root: enemyBasics.js RE-EXTRACTED from EnemyBasics.cs with the
  combat/entity fields (tools/extract-enemy-basics.mjs; C3's three
  fields byte-identical for all 62 keys, ASSERTED at generation -
  incl the ID-39 Horse stub whose C# struct defaults C3 had baked
  in). classFile.js is a verbatim CLASS*.CFG reader (74-byte record
  incl the source's (a<<16)|(c<<8)|b weapon/armor byte shuffle;
  attributes in DFCareer.StructureData order). enemyEntity.js is
  SetEnemyCareer + RollEnemyClassMaxHealth verbatim: class enemies
  get careerIndex = ID-128 -> CLASS{nn}.CFG, level = player level
  (city watch +Range(3,7)), HP = 10 + level rolls of
  Range(1, hpPerLevel+1), every skill = min(100, level*5+30),
  LiveSpeed = the career's Speed attribute - now feeding EnemyAI and
  EnemyAttack for real. playerEntity.js is the truthful
  pre-character-creation state (level 1, reflexes Average). REVIEW
  CATCH: the first wiring referenced fetchBytes from a sibling
  block's scope (syntax-clean, runtime-fatal) - all foe deps hoisted
  into one Promise.all. FLAGGED: monster careers
  (GetMonsterCareerTemplate) + class equipment/armor
  (SetEnemyEquipment) + loot -> E3b/E4. 3 tests.
- **E3b (hit resolution, enemy -> player): SHIPPED.** combat/
  formulas.js is the verbatim FormulaHelper core: Dice100,
  DamageModifier (Mathf.Floor, NOT trunc - matters for str < 50),
  hand-to-hand min/max (the character-sheet rule over the Chronicles
  table), the weapon min/max switch tables, material modifiers
  ([-1,0,0,1,2,3,3,4,5,6] - half the in-game display, per source),
  struck-body-part table, the career attack-modifier bit table
  (0x01/0x10 undead ... 0x08/0x80 animals) + always-on enemy-type
  bonus (DFU's port of classic's broken gate), stats-to-hit (TRUNC -
  C# int div), skills-to-hit with classic's dodging/4 bug and the
  crit +skill/10 roll, CalculateSuccessfulHit (source roll ordering,
  3..97 clamp), hand-to-hand + weapon damage (source operation order:
  skeletal edged/silver rules BEFORE strength/material), backstab,
  and the EnemyAttack.MeleeDamage hit gate 'matched to classic'
  (0.25 point-blank / MeleeDistance + 35.156deg - MELEE_DISTANCE
  single-sourced from enemyMotor, caught in review). Entities carry
  career stats (STR/AGI/LUC) + attackModifierFlags; playerEntity
  gains INTERIM maxHealth 50 / flat skills 30 (loud flags, chargen
  replaces). Enemy hit frames now damage the player through the full
  chain; health floors at 0 on __player (death screen + HUD: UI arc;
  foe reactions + death land with player attacks in E3c). Roll slots
  injectable - 5 deterministic tests.
- **E3c (player melee vs foes): SHIPPED.** combat/playerWeapon.js
  ports the WeaponManager player-side verbatim: reach 2.25 + 0.25
  (defaultWeaponReach + SphereCastRadius), the base hit rule (center
  within reach, in camera view, LOS through the level collider - the
  in-view check projects through the live proj*view), the
  CalculateSwingModifiers table (StrikeUp -4/+10 ... StrikeDown
  +4/-10), drag-to-swing on the ported gesture rules feeding the
  SHARED machine (deltas buffered per frame, MAX_GESTURE reset).
  REVIEW CATCH: swing mods first landed post-hoc - moved onto the
  source channels (toHit onto chanceToHitMod; damage INTO the damage
  call, before the skeletal rules and the <1 floor) via
  calculateAttackDamage's damageMod/toHitMod params. Hits stagger
  foes on the SHIPPED reaction clips (HurtFront/Back by facing,
  overriding the strike pose); death swaps the rig for the extracted
  corpseTexture flat (base-centered, drawn + destroyed with the
  billboard batches). RMB is the weapon control in both dungeon
  hosts (contextmenu suppressed), classic-style. INTERIM (loud): the
  equipped weapon is an Iron Dagger until the items arc; proficiency
  /racial mods pend chargen; backstab pends foe-facing bookkeeping;
  player attack ANIM (FP viewmodel in-world) is E3d. 3 tests.
- **E3d (FP viewmodel + backstab): SHIPPED.** The player's own
  authored rig renders as the FP viewmodel: fpMelee1H base +
  the dedicated FP sweeps composited on the machine's frame clock
  (combinePose is now CANONICAL in animate.js, ported verbatim from
  the viewer's effectivePose - the viewer's inlined copy retires at
  the next template regen). The pass renders from the player's eye
  through the SAME pixelize standard into the shared RT (raised to
  512 for the FP frame; pw/ph clamp PROPORTIONALLY so the overlay
  never squashes) and composites as a depth-off fullscreen overlay
  (classic draws the weapon over everything) - drawn LAST in
  drawFoes (review catch: it first drew before the foes, who painted
  over it). BACKSTAB: isBackFacing is the verbatim
  DaggerfallMobileUnit 8-orientation wheel (records 3/4 = the back
  arc; sign-symmetric so the |angle| form is exact; Unity's
  half-to-EVEN rounding preserved at the 112.5/157.5 boundaries -
  review catch: the first cut had a double-negative sign chain and
  JS rounding). The chance = the player's Backstabbing skill (flat
  interim) riding chanceToHitMod; x3 on the post-calc roll - both on
  the source's channels via calculateAttackDamage's backstabChance
  param. TallySkill pends Systems. resolveHit review catch: a fifth
  arg was passed before the signature existed. 3 tests. C8's E-queue
  is now E4: monster careers, equipment, authored morphologies,
  spectral unblock.
- **E4a (monster careers): SHIPPED.** loadMonsterCareer ports
  GetMonsterCareerTemplate -> MonsterFile.LoadMonster verbatim:
  ENEMY{nnn}.CFG records inside MONSTER.BSA, parsed by the SAME
  74-byte ClassFile reader, one BSA parse per session with a
  per-index cache. makeEnemyEntity's monster branch consumes the
  career for real - LiveSpeed/stats/attackModifierFlags interims are
  GONE (Open flags ledger shrinks by three at the next audit regen);
  monster HP stays the basics range and armor*5, per SetEnemyCareer.
  Crafted-BSA test pins the read, the cache, and the -1 path.
- **E4b (equipment): SHIPPED.** combat/enemyEquipment.js ports the
  full chain verbatim: AssignEnemyStartingEquipment (variant-0
  Broadsword..Longsword + 50% shield-or-offhand; variant-1/2
  Claymore..Battle Axe at 75/90% armor chances; city watch rolls at
  itemLevel 1), FormulaHelper.RandomMaterial (the [64,128,10,21,13,
  8,5,3,2,5] modifier walk with the +-level scaling and 0..256
  clamp) + RandomArmorMaterial (70/90 split, plate = 0x0200 + weapon
  material), the material armor values (leather 3 .. daedric 21,
  shields material-blind 1..4 on their protected-part sets), and
  SetEnemyEquipment's armor-value pass (init 100 = no armor, each
  piece SUBTRACTS value*5 on its body part, class clamp >60 -> 60,
  monsters keep the BETTER of equipment vs definition - the DFU
  rule). The variant table is EntityEnums-verified (review catch:
  OrcShaman is 21, my guess said 20). Entities now carry
  armorValues[7] + a right-hand weapon; CalculateArmorToHit reads
  the STRUCK part when equipped; enemy attacks route through
  chooseEnemyWeapon (weaponless when its average is higher, the DFU
  port of classic's rule). The class-armor interim is GONE; the
  poisoned-weapon chance pends the poison system (Systems). 3
  deterministic tests incl the full material walk to Daedric.
- **Spectral emission: SHIPPED (classic-visuals direction).** The two
  owed BaseImageFile helpers ported verbatim (TextureReader.cs):
  SetSpectral (eyes 14 -> 247, other indices -> the 96-index gray
  gradient) and GetSpectralEmissionColors32 (red eyes; body lerps
  black -> albedo by V^1.9, Unity RGBToHSV's V = max component,
  Clamp01). The pipeline's uploadRecord routes spectral archives
  (273/278/473 - the textureFile list is the single source) through
  the verbatim path on a CLONED bitmap (the cache is never mutated):
  albedo at the 180 spectral alpha + the emission map. The billboard
  shader gains uEmissionTex (black otherwise) added pre-fog like the
  mesh convention, and a two-phase draw: opaque flats keep the 0.5
  cutout; spectral batches blend SRC_ALPHA with depth-writes off at
  a 0.1 cutout - ghosts render ~70% visible with glowing red eyes.
  GetFireWallColors32 stays unported (two-line lerp, no consumer).
  OPEN: live visual sign-off (Mac; no ARENA2 here).

**Audit 2026-07-06 (Mac, engine included):** the shared pixelize pass
survives N foes now - the renderer's character-sprite RT was keyed on
exact (pw, ph) and REALLOCATED per character per frame once sizes
diverged; fixed to ONE CHAR_SPRITE_RT_SIZE (256) target with viewport
sub-rect rendering and UV-extent sampling (full-clear keeps
out-of-rect transparent; NEAREST boundary bleed discards).
Single-source catches: CLASSIC_UPDATE_INTERVAL (weaponStates is the
source, enemyMotor re-exports), enemy capsule height (CAPSULE_HEIGHT
from the motor), a dead `ortho` import in exterior. The Open flags
ledger (Home.md) pins all 15 documented interims from the code.
- **E4+:** authored monster morphologies (rewrite/ bench), spectral
  emission unblock, perf pass (per-enemy mesh updates).

**Verification doctrine pins.** Stations over nearest-verts; numeric
batteries over eyeballs; PIXEL-COUNTING screenshots for render-level
claims (vertex-band filters false-negative); solver grids snapshot
their centre; probe pose stepping is manual (never trust headless
rAF); POSES order is the button contract (append last).

## C-Weapons (log; shipped - see Current State): true item data + the first weapon in hand

The data layer is verbatim DFU (`src/characters/weapons.js`): Weapons
enum (113-131) and WeaponMaterialTypes (Iron 0 -> Daedric 9) from
ItemEnums; the three ItemBuilder multiplier arrays and
SetItemPropertiesByMaterial math (value x3 x valueMult, the quarter-kg
weight rule, condition x condMult / 4); GetWeaponMaterialModifier
(Iron -1 ... Daedric +6) and CalculateWeaponToHit (mod x10);
GetWeaponDyeColor into the dyes.js DyeColors; FormulaHelper's full
CalculateWeaponMin/MaxDamage table. `buildWeapon(template, material)`
is ApplyWeaponMaterial as a pure builder (incl. the female
playerTextureArchive-1 rule). `weaponMaterialRamp` resolves the metal
colour table (METAL_TABLES, extraction-generated) through ART_PAL -
the classic tint mechanism, one geometry x ten materials.
ROOT-CAUSE PIN: Unity Mathf.Round is half-to-EVEN; JS Math.round is
half-up. 4.5kg x Daedric hits 22.5 quarter-kgs exactly (DFU 5.5kg, JS
5.75) - weightForMaterial ports banker's rounding. weapons.test.js
witnesses every constant against the DFU source.

- **Longsword (SHIPPED)** - `pieces/sword.js`: pommel/grip/broad
  cruciform guard/tapered blade lofts at the LEFT-fist column (Mac:
  left hand, and big - 0.70-unit blade), every face tagged `armL` so
  the ARM TRANSFORM carries it. THE GRIP (Mac's reference photo,
  2026-07-05): a sword is NOT collinear with the forearm - the handle
  crosses the palm. Baked as GRIP_PITCH (-2.40 rad about the grip
  point, verts + normals), so a hanging arm carries the blade
  UP-FORWARD at 46.7deg with the pommel low behind the fist; the
  blade's WIDE axis lives in the swing plane (z) so the flat faces
  sideways like the reference (the old handRoll 1.57 became a yaw
  once the blade left vertical - deleted from the pose). melee1H v4
  reads 41deg at idle, 43-87deg through the run (see C-Anim). No
  weapon-specific
  animation code. HELD RULE: a gripped rigid object takes the FULL
  hand transform - the tuner's per-height wrist cut split the sword
  (blade rolled, pommel didn't); sword's animTarget carries
  `held: true` and poseArms skips the height cuts for held targets
  (probed rigid: extents identical under a maxed hand roll). Viewer:
  `sword:` button cycles off -> Iron..Daedric (recolor via stored
  piece intensities - shadePiece now bakes `_i`); stats line shows the
  verbatim item record (dmg, mat mod, hit, kg, value, condition).
  `__setSword(i)` hook.
- Next candidates (not approved): the other 1H blades on the same
  loft (Dagger/Tanto/Shortsword/Wakazashi/Broadsword/Saber/Katana),
  blunt/axe families, 2H + the 2H hold, sheath/hip carry.

## C-Anim (log; shipped - see Current State): poses + animation on the neutral rig

Static poses as data (v2: the FULL joint set) over the loco transform.
`src/characters/poses.js` - arms take `{ sw, bd, spread, handRoll,
handPitch, handYaw }`, legs `{ sw, bd }`, plus pose-level `lean` and
gait-blend dials. Pivots/order/mirroring match the tuner exactly:
hand roll about the FOREARM AXIS (stacks on the baked rest roll),
pitch about the wrist junction, yaw about (armX, wrist) mirrored,
then bend, root swing, spread (mirrored rotZ), torso lean (pose lean
ADDS to the gait's). Joint gates read REST y; held objects take the
whole hand chain. GAIT BLEND (redesign): posed LEGS give the stance
at rest and hand to the gait; posed ARMS stay ALIVE while moving -
the pose is the BASE and `gaitArm`/`gaitElbow` fractions of the loco
arm motion ride on top, so the fighter pumps around the grip instead
of freezing. Viewer: `pose:` button; `__setPose(i)` / `__setView`
hooks. poses.test.js guards the full table shape + joint ranges.

- **melee1H (SHIPPED, v4 - Mac's grip reference, 2026-07-05)**: the
  LOW READY, matched to the photo. Weapon arm HANGS with a soft elbow
  (sw -0.04, bd 0.08, spread 0.06; NO hand joints - the baked sword
  grip does the work), fist at hip height (y 0.78), blade up-forward
  at 41.2deg; off arm relaxed (-0.05/0.12); easy right-lead stagger,
  soft knees, lean 0.03. RUN: gaitArm 0.55 swings the low arm so the
  blade genuinely sweeps 43-87deg through the stride - alive, not
  frozen. Steepening trap pinned: elbow/shoulder flex rotates a tip
  that sits ABOVE the elbow up-and-back (~-15deg at v4's first
  values); the reference arm is near-neutral, tuned to it.
- **melee2H (SHIPPED)**: the two-hand ready (Claymore). The weapon
  rides the LEFT chain; the RIGHT arm is POSED onto the hilt, not
  parented. Values SOLVED by a two-stage sweep: (1) left fist to the
  designed centreline hilt seat (lands -0.09,0.88,0.33), (2) right
  fist to the hilt point 0.16 pommel-ward - dist 0.057, inside the
  mitten radius (first single-stage sweep bottomed at 0.44: the old
  armL spread pushed the hilt AWAY from centre, unreachable). Blade
  46deg up-forward, headClr 0.46. LOCKED GRIP through the gait:
  gaitArm/gaitElbow/runElbow all 0 - shared transforms (lean, bob,
  root, twist) preserve the coupling exactly; probed 0.057 constant
  across a full run. Life comes from lean/bob/root. Right-lead
  square stance. NOTE: pose order in POSES stays melee1H-first (the
  button/index contract); the 1H strike clips are NOT valid on the
  2H grip (the off hand would leave the hilt) - 2H attacks are a
  candidate, not approved.
- Viewer arm/hand tuner (idle sliders, other session + extended):
  all sliders live in a collapsible TUNERS BAR - a bottom tab ascends/
  descends the stack (collapsed by default, Mac); rows scroll past
  55vh. Axes: shoulder pitch/spread, elbow, and FULL hand rotation - roll +/-180deg
  about the measured hand centre (MIRRORED L/R), pitch (rotX about the
  wrist), yaw (mirrored rotZ). Held targets take hand/elbow whole (the
  held rule - see C-Weapons). THREE ROOT CAUSES fixed here, all
  probe-traced: (1) the wrist cut was "14% up the arm" = y 0.841,
  INSIDE the mitten - palm static, knuckles rotating, thumb torn; the
  hand/forearm junction is a rig fact, now exported
  (neutralBody WRIST_JUNCTION_Y 0.9875 preH, payload-fed, test-pinned
  to cleanly split the arm groups). (2) roll was unmirrored - both
  hands twisted the same world direction. (3) MUTATED-Y GATES: joint
  gates read y AFTER pitch moved it - a thumb-top vert pitched across
  the junction and the yaw skipped it, shearing the hand 0.0153 under
  combos (hand-traced to 6 decimals against the live value). Joint
  membership is REST anatomy: every gate reads base y. (4) The roll
  pivoted on the hand CENTROID - the outer thumb pulls it ~0.011 off
  the forearm axis, so rolling translated the wrist ring ~0.013 off
  the arm (Mac: "offsets slightly"). Hand roll/yaw now pivot on the
  FOREARM AXIS (+/-ARM_X, exported from neutralBody, payload-fed);
  swept the full roll range - wrist ring stays on-axis to 5e-9.
  Mac's tuned rest is BAKED: neutralBody HAND_REST_ROLL rolls the
  hands -40 (mirrored, about the same axis, normals rotated with the
  verts) so slider 0 shows it and it holds through poses and gaits.
  Verified rigid to 1e-7 over 60 random full-range six-slider combos.
- **Directional attacks (SHIPPED)** - `src/characters/anims.js` +
  viewer playback. Directions are 1:1 DFU: MouseDirections enum order
  and FPSWeapon.OnAttackDirection's switch ported verbatim
  (Down/DownLeft/DownRight/Left/Right -> their strikes; Up + UpLeft +
  UpRight ALL -> StrikeUp, the thrust) - anims.test pins both. Clips
  are keyframed DELTAS over the active pose (every track starts/ends
  at 0 -> entry/exit continuous by construction; probed endErr 0 on
  all six), smoothstepped, phased windup -> fast strike -> recover.
  Two new body channels: `twist` (rotY about the spine - torso, head,
  arms AND the held sword commit into slashes) and `headPitch` (rotX
  about NECK_PIVOT_Y, exported from neutralBody). Playback merges the
  sampled delta over melee1H, suppressing the gait pump + runElbow
  mid-strike; LEGS stay with the gait, so attacks fire mid-run
  (probed: ankle z swing 0.89 through a running thrust). AUTHORING
  TRAP pinned: armL spread/yaw/twist land MIRRORED in world (the g=2
  sign flip) - both slashes and both diagonals shipped inverted on
  first authoring. WRIST-DRIVEN v2 (Mac: "the tip doesn't swing -
  it's all relative to the tip"): the grip-pitched tip sits NEAR the
  shoulder/elbow rotX lines (tip radius 0.57 vs pommel 0.73 about the
  shoulder), so arm-driven strikes whirl the POMMEL around a hovering
  tip. About the WRIST the ratio inverts (pitch 0.735 vs 0.196, yaw
  0.471 vs 0.163) - every strike now carries its energy in handPitch/
  handYaw; arms only carry. YAW SIGN serves the TIP: the tip sits
  ABOVE the wrist pivot, the fist below - rotZ throws them opposite
  ways (first tip-tuning inverted all four laterals). Slashes are
  yaw-led with twist committing THROUGH the strike and spread reduced
  to windup flavor (three coupled channels were cancelling at the
  tip). OVERHAUL v3 (Mac): clips rebuilt as KINETIC CHAINS with per-
  segment easing - sampler keys are now [t, v, ease?] where the LEFT
  key names its segment: 'smooth' (default), 'snap' (u^3: slow load,
  explosive arrival - every launch), 'out' ((1-(1-u)^3): hard-stop
  follow-throughs/settles), 'lin', 'hold'. TAG TRAP pinned: tags
  shape the segment to their RIGHT; first authoring put 'snap' on
  impact keys and 'hold' on coil keys, turning launches into step-
  jumps - every tag shifted one key left. Structure per strike: slow
  load -> loaded beat -> snap launch -> follow-through PAST the line
  with a hard stop -> settle -> home (all tracks end 0). Sequencing:
  hips (twist) load/fire ~0.04 before the arm, the wrist ~0.04 after
  (whip). GUARD ARM counters every swing; LEGS shift weight at rest
  (clip deltas merge over the stance; the gait owns them while
  moving) - chop sinks the lead knee, the thrust LUNGES (rear ankle
  0.27). Probed at 120Hz: tip peak speeds AT the impact keys, snap
  ratio (peak/mean) 5.6-5.7 chops/hacks (72-73 u/s), 6.8 slashes
  (36-37), 3.7 thrust (32, on the lunge); guard counter 0.24-0.46.
  Durations per character: chop 0.60, hacks 0.46, cuts 0.42, thrust
  0.38. Viewer: `dir:` cycles, `strike` fires; `__attack` hook.
- **Quality pass (Mac: "you can do better")**: added PENETRATION
  GUARDS the numbers never checked - min sword y (floor) and head-
  sphere clearance (0,1.62,0.02 r0.15) swept per clip at 120Hz. They
  caught a real defect: the DIAGONAL COIL swung the blade THROUGH the
  skull (DownLeft -0.11 inside; the chop grazed at 0.06). Two guessed
  fixes failed (lateral spread, MORE coil pitch made it worse) - the
  argmin probe located the offender (the TIP at the loaded beat,
  crossing (0.05,1.64)) and a 45-combo windup SWEEP picked the values:
  clearance is driven by SHALLOWER coils; the snap supplies the speed,
  not the windup depth. Final: headClr 0.13-0.62 all six, floor 0.10+,
  peaks 58-60 chops/hacks (snap 5.3-5.4), cuts 36-37 (6.7-6.8),
  thrust 32. HITSTOP added: a 0.03u frozen beat at every impact key
  (contact reads as contact). Filmstrip renderer exists for review
  frames (deterministic atk.t stepping); this session's env could not
  visually verify images, so the pass ran on geometry guards - Mac's
  eyes judge the viewer.
- **ACTION REDESIGN v4 (Mac: "stiff, not action oriented - stop band
  aiding")**: the architectural flaw was NO ROOT MOTION - every
  strike fired from a statue bolted to the floor. Clips now carry
  `rootX/rootY/rootZ` (whole-body translation): animateTarget adds
  the root to EVERY vertex (torso, head, arms, legs, held sword);
  effectivePose merges it; clothSim gains rootX/Y/Z opts so the PINS
  and the CORE COLLIDER ride the moving body; and the drape wrapper
  now forwards the FULL lean (gait + pose + attack - it only sent the
  gait's, which left the cloak 0.21 behind a lunging torso; 0.055
  after). Every strike MOVES: the chop STEPS IN (0.16 fwd, 0.06 dip -
  trimmed from 0.09 when the blade came 0.03 off the floor), the
  thrust rocks back then LUNGES 0.23, the hacks DROP 0.11 and drive
  0.11, the cuts throw weight 0.12 ACROSS; legs step WITH the root.
  Per-clip rhythm (cuts 0.40, hacks 0.46, chop 0.58, thrust 0.36).
  Drive stacks with the whip: chop tip peak 85 u/s snap 7.4. Head
  clearance re-verified vs a root-following head sphere (0.13-0.61);
  anims.test pins the thrust lunge > 0.20.
- **Sword seat sliders (Mac)**: tuners bar gains swd pitch (+/-45deg
  about the GRIP POINT, y 0.81/z 0 - invariant under the mesh bake),
  swd fwd, swd up (+/-0.12). Rewrites the sword animTarget BASE +
  normals, so every pose/gait/attack carries the adjusted seat;
  labels show real units for baking a chosen fit. `__swordFit` hook.
- **Seat BAKED at Mac's +45 (2026-07-05)**: GRIP_PITCH = -2.40 + pi/4
  -> a near-horizontal POINT-FORWARD carry (88.8deg off vertical, tip
  y 0.84 z +0.83, pommel behind the fist). The tip crossed BELOW the
  wrist pivot, which flipped the strike levers: TWIST (spine, tip
  radius 0.83) is now the lateral engine and the yaw contribution is
  minor - all six clips re-probed on the new seat, signs HELD.
  Thrust handPitch trimmed (point stays level, +0.84 fwd / -0.30
  dip), diagonal twist widened (+/-0.25..0.46 lateral over -1.45
  down). Chop slams the tip -1.45 at r2.45; slashes +/-0.63 r2.2-2.6.
  weapons.test re-pinned on the +45 seat.
- **Claymore (SHIPPED)** - `pieces/claymore.js`, template 122 (2H,
  dmg 2-18, verbatim item math pinned incl. the 9.5kg Daedric
  half-even round). Greatsword on the SAME grip system: armL chain +
  the baked +45 seat, 0.95-unit blade, broad quillons, a LONG
  two-hand hilt (0.34 - two fists and a gap pommel-ward) and a wheel
  pommel. Seat sliders, materials and the stats line apply unchanged
  (viewer `wpn:` button swaps Longsword/Claymore). Span note: the
  seat bake rotates length into Z, so the Y-only HSCALE barely
  shortens it (1.36). PHANTOM-AXIS ROOT CAUSE (Mac: "the left hand
  doesn't grip and animate properly"): grip tubes had verts ONLY at
  their end rings, so every "nearest vert to the grip point" probe -
  including the melee2H two-stage solve's hilt target - anchored to a
  ring end 0.1+ OFF the handle axis; the whole grip was validated
  against a line that wasn't the hilt. Fix at the mesh: GRIP STATION
  rings (real on-axis collars) at the bake pivot on both weapons + an
  OFF-HAND STATION on the claymore (pre-bake y 0.74); ring CENTROIDS
  are the true anchor/axis, test-pinned to 0.003. melee2H re-solved
  against the true station (armR bd 0.16 -> 0.33, dist 0.050); the
  left hand measures a genuine grip - fist centre 0.012 off the true
  hilt line, mitten straddling it (tips/wrist 0.072/0.077), 84deg
  wrap. Both fists hold their stations 0.048/0.050 CONSTANT through a
  full run. The "animate" half: firing the six 1H clips in melee2H
  tore the off hand 0.32 off the hilt - superseded: see 2H attacks.
- **2H attacks (SHIPPED)** - `ATTACKS_2H`, six greatsword strikes,
  fireAttack routes by pose (melee2H -> the 2H table). COUPLING RULE:
  both fists hold their hilt stations every frame. armL + body
  channels authored freely; the armR tracks are PRE-SOLVED offline
  against the moving off-hand station (17+ samples per clip,
  continuity-seeded shrinking grids, bd clamped >= -0.33 - the first
  solve reached targets by hyperextending the elbow - keys over 0.09
  rescued by a global grid, fast segments midpoint-densified) and
  baked as dense 'lin' tracks. AUTHORING CONSTRAINT pinned: 2H coils
  must keep the hilt IN FRONT - the off hand cannot reach behind the
  shoulder (deep cleave coils bottomed the solver at 0.49; trimmed,
  the rootY rise + lean sell the windup instead). Clips: overhead
  cleave 0.66 (steps in 0.19, tip 79 u/s snap 7.4), great cuts 0.50
  (rootX + twist are the blade), diagonal cleaves 0.56 (frame drops
  0.13), ram thrust 0.42 (lunge 0.27, the set's biggest). Verified
  at 120Hz per clip: off-fist-to-station 0.061-0.105 max against the
  0.050 geometric baseline (fist radius 0.074; the 0.105 is a 3-key
  reach-ceiling beat on the mirrored diagonal), left grip 0.048
  INVARIANT, ends exactly on stations, headClr 0.15-0.46 vs a
  root-following head, floor 0.09+ (cleave tuned up from -0.15).
- **Ranged: bows + rangedAim + Release (SHIPPED)** - `pieces/bow.js`
  (Short/Long Bow, 129/130; verbatim item pins - the weight chain
  ends in a SECOND /4: Daedric Short 1.25kg, Long 2kg). Recurve stave
  via per-row cz; PERPENDICULAR grip bake (-pi/2): fore-aft carry at
  a hanging arm, near-VERTICAL (13deg) at the extended aim. STRING is
  modeled DRAWN (two segments to a NOCK STATION 0.25 toward the
  archer) - the aim pose IS the drawn bow; an undrawn string put the
  nock out by the bow, unreachable. BAKE-SIGN pinned: authoring + cz
  = the archer side (rest-above-grip maps behind the fist at aim; the
  first nock landed 0.95 FORWARD). rangedAim: bow arm on the
  frame-rotated straight-arm seat (0.03; the seat must live on the
  reachable manifold and rotate WITH the stance - a world-fixed seat
  fought the frame), draw fist solved onto the nock to 0.002, BLADED
  twist -0.65 (square-on the draw arm bottoms 0.26 short; the
  miss-vector read +0.20y and spread -1.45 carries the fist
  up-across; NOTE twist is a rigid rotation - it cannot change
  relative reach, the win came from the seat + spread). Locked
  through the gait: nock 0.002 constant across a run. Release clip
  (one, direction-agnostic like the classic bow): pull to anchor
  0.22, beat, loose flick, settle home (fist path 0.44, end 0.002,
  bow arm holds to 0.058). SOLVER HYGIENE pinned: refine grids must
  snapshot their centre (a mutating-best walk railed spread at
  -0.885 and hid the reach).
- **Archer FORM fix + Release v2 (Mac: "the left arm looks so off")**:
  the stance was INVERTED - the twist sweep optimized nock reach and
  chose NEGATIVE twist (draw shoulder led by 0.24, chest closed
  across the aim, the bow arm wrapping an inverted torso). The
  negative preference came from comparing against the broken
  world-fixed seat; positive was never re-tested after the seat fix.
  FORM IS A CONSTRAINT, NOT AN OUTCOME: twist locked +0.65 (bow
  shoulder forward +0.20 / draw back -0.09, battery-asserted); with
  the wide spread grid the nock is reachable at 0.011 (armR
  -0.165/1.115/-1.515: draw arm up-across, elbow high) - no
  draw-depth change needed. Release v2 (0.70): back-driven last-inch
  pull, held ANCHOR beat, snap loose - string hand flies back-open
  past the ear (peak 20 u/s AT the release key, snap 13.6, the set's
  sharpest), the bow JUMPS and ROLLS 50deg in the loose grip
  (handRoll = the aim axis at extension), frame recoil (rootZ
  -0.035, bow-arm kick 0.08), settle home (end 0.011; run-hold
  constant).
- **HUMERAL ROLL - the missing arm DOF (Mac: "supporting arm
  contorted, bent inward")**: the chain (bend about world-X, swing,
  frontal spread) fully determines elbow/forearm ORIENTATION from
  fist position - with no humeral rotation, the nock solve could only
  cross the body via a railed -1.5 spread (elbow dragged across/up:
  the chicken-wing). Pose v3 arm channel `roll`: the bent forearm +
  hand + held rotate about the UPPER-ARM axis (rotY about the arm
  column at the elbow, mirrored, rest-frame, applied between bend and
  swing) - elbows can fold ACROSS. rangedAim armR re-solved with FORM
  CONSTRAINTS IN THE SOLVER (elbow right-of-body x >= 0.08 and below
  the shoulder line as hard penalties - the second lesson after the
  inverted stance: anatomy is an input): {sw -0.69, bd 1.035, spread
  -0.875, roll -1.315} -> nock 0.012 at ZERO penalty, elbow (0.15,
  1.29), upper arm out-back, forearm folded naturally. Release on the
  new base: snap 10.9 peaking at the release key, home 0.012,
  run-hold constant.
- **Nocked ARROW (SHIPPED)** - template 131 pinned (0-0 dmg, 0.25kg
  at every tier: the quarter-kg chain collapses via half-even
  round(1.25)=1). Ships as BOW GEOMETRY inside the drawn assembly -
  the tail lives at the nock and the shaft IS the aim line, so
  alignment, the gait lock and Release come by construction (posed:
  0.0deg off the nock-to-grip line, head 0.48 down the axis past the
  stave, resting on the riser). LOFT LIMIT pinned: loftPiece is
  Y-only - an axis:'z' option silently degenerated to a zero-length
  stack; the arrow is authored along Y and locally rotated onto the
  aim axis about the grip line before the shared grip bake.
- **Blade family (SHIPPED)** - `pieces/blades.js`, one parameterized
  builder: Dagger, Tanto, Shortsword, Wakazashi, Broadsword, Saber,
  Katana (1H; inherit melee1H + ATTACKS_1H free) + Dai-Katana (2H).
  HOUSE LAYOUT pinned: pommel HIGH, blade DESCENDS below the grip -
  the seat bake maps down to point-forward (an upward-authored blade
  points BACKWARD; the first cut had every tip at z 0.21). Curves
  (wakazashi/saber/katana/dai) bow via per-row cz. THE 2H CONTRACT:
  any 2H weapon that places its off-hand station at the
  claymore-standard point (-0.235, 0.8038, -0.1578) inherits the
  solved melee2H pose AND the station-coupled attack tracks by
  construction - Dai-Katana verifies at off 0.003 build / StrikeDown
  offMax 0.097 live, claymore-identical. Registry is data now:
  payload `weaponPacks` [{name, hands, pack, items}]; the viewer wpn
  control is a SELECT. Item + station + tip pins per blade.
- **Hafted family (SHIPPED) - THE ROSTER IS COMPLETE**:
  `pieces/hafted.js` (shaft/head specs, house layout): flanged Mace,
  single-bit Battle Axe + double-bit War Axe (flat plates hanging
  forward of the shaft), forward-massed Warhammer block, quarterstaff
  spanning both ways, Flail with a RIGID chain-and-ball (fidelity
  note: same class as the drawn bow string). 1H inherit melee1H +
  ATTACKS_1H; 2H carry the claymore-standard grip block and the 2H
  CONTRACT holds live (Warhammer off-hand 0.053, ram offMax 0.063).
  All 19 Daggerfall weapon templates (113-131) now have meshes on the
  grip-station system: 8 blades, 6 hafted, 2 bows + the nocked arrow,
  registry-driven (18 viewer entries). Every 1H weapon shares
  melee1H + the six 1H strikes; every 2H shares melee2H + the six
  solved 2H strikes; bows share rangedAim + Release - three combat
  states, nineteen weapons, zero per-weapon animation work.
- **Scale pass (Mac: handles need girth, heads much larger)**: 1H
  grips 0.012 -> 0.019-0.023, 2H grip blocks 0.028 uniform, shafts
  0.020, bow riser plumped, pommels +40%. Heads: mace flange 0.078,
  axe plates 0.140 wide (offsets 0.075/0.082), hammer block 0.068,
  flail ball 0.055. Stations are ON-AXIS rings - radius cannot move a
  centroid: grips still exact, off-hand seats 0.049-0.053, contract
  intact, zero pin changes.
- **First person: FP camera + fpMelee1H (SHIPPED)**: the viewer's fp
  mode anchors the eye to the POSED head (0.04 up, 0.14 forward of
  the centroid so the shell sits behind the near plane; FOV 62) -
  gait bob 0.047, lean and attack ROOT MOTION read through the
  camera. fpMelee1H solved IN VIEW SPACE (NDC objective): fist (0.40,
  -0.52) bottom-right, blade raked tall (0.08, 0.76), zero near-plane
  hits, gait pumps OFF (the camera bobs, the viewmodel holds).
  PROJECTION NOTE: looking +z the LEFT fist lands view-RIGHT - the
  left-dominant rig matches DF's bottom-right viewmodel for free.
  FP STRIKES GATED (viewer hint): the 1H clips are deltas over the
  LOW ready; on the raised base the cleave crosses the near plane
  (1770 hits) and the thrust folds past vertical (tip NDC +/-111).
  Dedicated FP swing clips = the next arc (classic DF's FP attacks
  are dedicated animations).
- **DFU-VERBATIM attack patterns + hold states (SHIPPED)** -
  `weaponStates.js`, ported from WeaponManager/FPSWeapon/
  FormulaHelper: tick = 3*(115-SPD)/980 (SPD 50: 0.199s/frame,
  0.995s strike), bow cooldown (10*(100-SPD)+800)/980, classic 16Hz
  bow ticks, 5-frame strikes, HIT at melee frame 2 (arrives ON the
  2nd tick - DFU waits then steps) / bow frame 5 / sound 4, the
  gesture radial table (SIX tracked directions - diagonal-up folds
  into Up; UpLeft/UpRight exist only for the click-attack random
  roll), threshold 0.05, EquipDelayTimes, fatigue 11, the INTERRUPT
  RULE (one-shots irreplaceable except the bow release), and the
  full bow arc: press = draw to frame 3 + HOLD, 10s cap auto
  un-draws, release = loose, SPD cooldown blocks redraw. THE MACHINE
  OWNS TIME; the rig clips are the visual (clip u = machine
  progress). SPD slider; strike = press/release on bows. Bow frame
  span (4 draw / 6 release) reconstructed from the verbatim
  checkpoints, flagged. Sprite Alignment/Offset = N/A on a 3D rig.
  Machine-time verified live: 1.004s@50, 0.266@100, mid-swing
  rejected, anchor hold u 0.50, cooldown 1.33s.
- **FP screen-fill fix (Mac: skin fills the screen in attacks)**:
  lean-heavy clips pitch the CHEST just ahead of the eye; surfaces at
  0.01-0.10 rasterize as a full-frame fill (StrikeUp pixel-sampled at
  0.83 coverage). PROBE LESSON: vertex-band checks false-negatived on
  an over-tight frustum cone - PIXEL COUNTING found it (screenshots
  are numerically verifiable via skin-band fractions even where
  images aren't eyeballable). Fix at the mechanism: FP near 0.01 ->
  0.10 (the near plane IS the tool for too-close geometry) + eye
  margin 0.18. Worst coverage now 0.01 across all six strikes at
  40ms density; the viewmodel renders intact.
- **Drag-to-swing (Mac: click and drag)**: the classic mouse attack,
  through the verbatim pipeline - pointer deltas accumulate like
  TrackMouseAttack (threshold 0.05 * longest dim, 1s stale reset),
  the radial table picks the strike, the machine's interrupt rule
  absorbs spam. LEFT-drag swings in FP; RIGHT-drag swings in orbit
  (left stays camera); bows press-to-draw-and-hold, release to
  loose. Buttons kept. Battery: radials correct, sub-threshold
  silent, orbit isolated, bow hold/loose/cooldown on the pointer.
- **Run life (Mac)**: RUN loco gains `headPitch -0.30` - the head
  looks UP against the 24deg charge lean instead of at the ground;
  melee1H gains `runElbow 0.55` - both elbows bend while moving,
  layered under the gait pump.
- Next candidates (not approved): 2H hold, hit reaction, attack
  impact/trails, walk-gait attacks tuning.

## C-Drapes (SHIPPED): draped garments as simulated cloth

The 16 loose/draped item names (skirts, robes, dresses, kimono, mummy
wraps, cloaks, surcoats, toga, wrap, sash) do NOT displace body vertices
like body-hugging clothing (`clothing.js`). Each is a separate MESH the
verlet cloth sim animates and collides against the body. Geometry lives
in `src/characters/pieces/draped.js`; the pure sim in
`src/characters/clothSim.js` (no THREE - tested headless, and inlined
into the viewer via the `/*__CLOTHSIM__*/` marker for rendering).

**Geometry (`draped.js`).** `BODY_CORE` = measured torso+legs half-extents
per height (NO arms), `coreHalfExtents(y)` interpolates it; every ring is
`clip()`ed outside it + a 0.038 standoff so nothing starts inside the
body. Two grid kinds, both `{rows, cols, wrap, pos, faces, pin?}`:
- **Ring lofts** (`GRIDSPEC` via `drapedGrid`): rings of points swept down
  the body. `flareRows` (waist/chest/shoulder->hem cones), `capeRows`
  (back cape arc), `shawlRows` (wrap). Row count SCALES with garment
  length (~constant 0.055 spacing, clamp 6-24) - a fixed count made long
  garments coarse and facet/fold; this was the "folding" root cause.
- **Centreline strips** (`stripGrid`): a ribbon swept along a path with a
  per-row width + explicit pin mask, for asymmetric drapes the ring grid
  can't do (the sash: band -> hip knot -> tail). The width frame is
  PARALLEL-TRANSPORTED along the path, or it flips at sharp curves and the
  ribbon twists through itself.

**Sim (`clothSim.js`).** `buildCloth(grid, pinRows)` -> particles +
distance constraints (structural + weak bend) + a pin mask (grid.pin, or
the top `pinRows`). `stepCloth(cloth, dt, opts, core)` order, which the
long debugging arc converged on and every step matters:
1. verlet integrate (gravity, per-step `maxStep` clamp -> no spikes),
2. pin the pinned rows (shift by pinDX/DY/DZ to follow the body bob),
3. distance constraints (`iters`) - NO collision interleaved,
4. anti-pop clamp of the verlet+constraint move,
5. **bone-drive** (`opts.bones`) - leg-drapes only,
6. **collision** LAST (`opts.capsules` + body ellipse + ground), so cloth
   always ends outside the body.

**Collision.** Body = the `core` ellipse at ALL heights (leg-together
envelope below the hip stops cloth falling between the legs) + articulated
LEG capsules (`articulatedCapsules`: 2 legs x thigh+shin, bent knee +
swing, exact rig transform, radii measured from the mesh). Arms are NOT
collided (they hang outside; garments aren't sleeves). `pushCapsule` uses
TRUE-3D distance (a flat height-slice reads "clear" for a tilted swinging
leg while it visibly clips) but responds HORIZONTALLY, keeping y, so cloth
can't ratchet up the leg. Collision is iterated collision-ONLY (converges
on tilted limbs without the ratchet that interleaving with constraints
caused - that ratchet was the hem-climbs-to-the-waist bug).

**Bone-drive** (the lower-leg-fold root fix). Free cloth over the fast
shin is lose-lose: wide hem buckles, narrow hem clips. So below the hip
each leg-drape vertex is rigid-skinned toward a leg-BONE target - its own
(y,z) run through the rig transform (bend about knee, swing about hip)
while rest-x is kept (no circumferential buckle); weight ramps 0 at the
hip -> ~0.85 at the ankle; front/back-centre blends both legs 50/50 so it
stays put while sides track their leg. Runs BEFORE collision (which then
guarantees no clip). Applied to leg garments only; SHOULDER drapes
(cloaks, wrap, sash) skip it and use free cloth + collision.

**Materials.** `DRAPE_MATERIAL` = per-garment { ramp, sheen, rim }. The
viewer's `shadeClothGeo` snaps the normal-shade to the ramp, adds a
specular sheen term (silk: kimono, sash) and a cool rim - so each garment
reads as its own fabric, not one shared grey.

**Viewer.** `build-viewer.mjs` emits the grids + `bodyCore` +
`drapeMaterials` and inlines the sim; `viewer-template.html` builds a mesh
per grid, steps the visible one each frame (`drapeColliders` builds the
gait's capsules + bones from the rig's real joint Ys), recomputes normals,
reshades with the garment's material. `drape:` toolbar button cycles them.

**Test:** `test/clothSim.test.js` - stability, no-clip static, no-clip
walking (true-3D vs the articulated capsules), and the bone-driven path,
all over hundreds of gait steps.

**Non-obvious learnings.** (a) The "lower-leg fold" that resisted every
cloth-tuning lever was TWO things: coarse rings on long garments (fixed
row count) AND a viewer ASPECT bug - canvas CSS `height:100vh` with
`renderer.setSize(w,h,false)` stretched the buffer vertically on mobile
(100vh != innerHeight); `setSize(w,h,true)` fixed it. (b) Collision MUST
run after constraints (once), not interleaved, or the hem ratchets up. (c)
Limb push must keep y (horizontal) or cloth climbs the leg. (d) The body
ellipse must apply below the hip too, or centre-front cloth falls between
the legs and oscillates. Diagnose cloth with NUMERIC headless metrics
(penetration, hem drift, per-column curvature, per-frame jump); the ASCII
rasterizer can't judge fold quality and images don't reach the sandbox.


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

### C6L - Mac shades it (SHIPPED): the hand-paint pipeline + tuner

The tuner: `?world&play&voxelfolk&paint` mounts an in-browser sheet
editor next to the live figure - ART_PAL swatches (index 0 = erase-
to-classic), eyedrop, undo (24), export/load PNG, localStorage
autosave (survives reloads; 'clear saved' resets to starters), 6x
pixel canvas with front/back tabs. Strokes outside the silhouette are
ignored; every stroke-end rebuilds the character mesh in place
(destroyMesh on the old one) so the figure updates live - walk behind
it to check the back. Probed: plot lands, mask guards, autosave
persists. The paint flag plumbs world -> modes host -> interior opts.


Mac's idea, and the true in-house answer: HE is the artist. Two
paintable sheets in classic sprite space at 1x (69x145, the doctrine
resolution): src/characters/paint/body-front.png (starter = the
classic sprite itself) and body-back.png (starter = mirrored front as
an underlay guide; authored in rear-view space). The harness samples
them per face by normal - painted pixel wins, transparent falls
through to the classic projection, pixels outside the silhouette are
ignored (silhouette is the law: the IoU + excess gates hold
regardless of paint). Loop: edit the 1x PNG, push, refresh.
tools/export-paint-sheets.mjs regenerates starters + 4x previews.

### C7b (SHIPPED): underarm arc - the tube was a 12-gon

Mac: under the arms should be a smooth arc like the front. The
instrumentation settled it: the sprite's underarm boundary IS a smooth
curve (torso edge curls col 19->16) and the front matches it 1:1 head-
on - but the loft was a 12-SIDED prism, so from a quarter view the
underarm showed a flat facet panel, not a curve. Root fix: loftTorso/
loftPair take a segments param (default 12, Voxlight unchanged); the
paperdoll passes PD_SEG=24 at every loft site (torso, hair, arms,
legs, relief). Doubled resolution = smooth arcs from angles. The
silhouette pin is unaffected at any seg (front IoU 1.0000 verified at
24). Not the depth blend (C7a), not shading - the faceting.

### C7a (SHIPPED): armpit crease - arm depth blends to the torso

Mac: the armpit (both arms), on the back. Not a hole (the torso wall
spans the full z-range where the arm abuts) - a z-STEP: the arm loft
(rz ~ rx*0.9 ~ 0.07) met the deep torso/shoulder (~0.14) at a hard
0.08 ledge, reading as a dark crease at the junction on angled views,
front and back. Fix: within 0.14 rig units of each arm's top, rz lerps
from the torso/shoulder depth at that height down to the arm's own
depth (top 0.138 -> wrist 0.024) - the shoulder is genuinely deep, so
the junction is seamless. Depth-only (x,y untouched): pin 1.0000, all
other lists byte-identical.

### C6z (SHIPPED): the back samples the sprite - like the front

Mac: look at how the front achieves clarity and replicate it for the
back. The front's clarity is ONE thing - it samples the real sprite
pixel at each face (the classic projection), no computed shading. The
back never reached that path: the derived body-back.png was fully
opaque, so back faces always used the fabricated shading (the whole
C6t-C6y thrash). Fix: the back sheet starter is now TRANSPARENT, so
every back face falls through to the same sample() the front uses - a
back face shares x,y with its front counterpart, so it reads the same
sprite pixel: identical clarity, not a mirror. gen-back-sheet.mjs
(derived shading) deleted; backRelief empties (the fabricated mounds
gone). Front + cores byte-identical, pin 1.0000. Optional hand-paint
still overrides per pixel.

### C6y (SHIPPED): crotch seam - ambient occlusion in the crevice

Mac: the seam where the legs meet. Both inner thighs were lit bright
right to the crotch gap - the derived shading is pure directional
light on the loft normal, with no occlusion, so the concave crevice
(like the armpit) stayed lit. Added crotch AO: per row, the gap centre
between the two leg runs is measured from the sprite, and inner-thigh
pixels darken by proximity (0.45x at the seam, ramping to 1x by 7px
out). Derived from the measured gap, not painted. The crotch now reads
as a shadowed crevice. Front + cores byte-identical, pin 1.0000.

### C6x (SHIPPED): back shading was INVERTED

Mac: the lower back still needs proper shading. Instrumenting the
derived sheet exposed it: the lighting intensity `it` was a correct
smooth gradient (0.06 dark -> 0.90 lit), but the ramp index used
`(1 - it) * (len-1)` while the ramp is sorted dark->bright - so high
light picked the DARK end. The lit surface rendered dark and the
shadow side rendered bright; the lower back read as a flat dark
expanse with a stray bright edge strip. Fix: index by `it` (lit ->
bright end). The lower back is now a proper shadow->lit gradient
across its width. Front + cores byte-identical, pin 1.0000.

### C6w (SHIPPED): back shading continuous - the blocky bands

Mac: the upper/lower back are too blocky; the front does it well, copy
it. The front reads the sprite's CONTINUOUS luminance; the derived
back sheet snapped each pixel to one of ~14 palette ramp indices - 14
flat colour bands = the blocky back. Fix: gen-back-sheet now LERPs
between adjacent ramp colours by the continuous lighting intensity
instead of snapping (endpoints stay palette-exact). Back sheet colour
went 14 -> 341 distinct values, a smooth gradient like the front.
Front + all cores byte-identical, pin 1.0000. NOTE: back RELIEF
geometry is still 3 wide mounds - the derived shading is a smooth
ellipse gradient (one bright side), which has no discrete muscle for
the island detector to find; unlike the front's hand-drawn muscle,
there is no back sprite to extract fine form from (policy bars
inventing it). The colour blockiness is fixed; genuine back muscle
needs a painted back sheet.

### C6v (SHIPPED): relief mounds - the lumps were floating cards

Mac's angled screenshot: lumps on the chest and belly. Root cause:
each relief plate was rz 0.012 centred at cz = frontAt + lift*0.3,
which put its BACK face up to 0.012 proud of the torso surface - a
detached card floating in front, invisible head-on but a lit shelf on
any angled view. Fix: each plate is now a MOUND - back face buried
0.03 into the surface, front face proud by the bump (lift*0.3), rz and
cz derived so it rises continuously from the skin instead of hovering.
Depth-only change (x,y untouched) so the front pin stays 1.0000 by
construction; five core lists byte-identical. Front and back relief
both moundified. Remaining from the shot: the armpit gap is the
sprite's own arm/torso notch (separate arm-depth item, not relief).

### C6u (SHIPPED): the back, shaded like the front (derived)

Mac: shade the back with the same skin-coloured shading as the front.
Done, fully DERIVED - nothing invented (policy holds). tools/gen-back-
sheet.mjs: per back pixel, mirror to front space, find the owning part
from the measured traces (hair band / torso rows / arm rows / leg
rows), take the loft cross-section normal at that column, light it
with the sprite's own convention (view-relative upper-right key), and
quantize through the FRONT'S OWN palette ramps measured per region
(skin from the mid torso, hair from the crown, boot from the feet:
14/17/16 indices). The lateral normal flips for the rear view. The
C6s pipeline then turns that shaded sheet into back relief (43 rows /
3 strands - the derived pec/lat/calf volumes, NOT the mirrored front
islands). Six core lists incl. front relief byte-identical; pin
1.0000. body-back.png is now a shaded starter Mac can still repaint.

### C6t (SHIPPED): the back is not a mirrored front

Mac: the backside needs to be completely different, not a mirror. It
was byte-for-byte the mirrored front (verified: 5237px identical) -
which is exactly why it read as a copied front. Project policy bars
inventing the back's detail (no AI assets), so the fix is structural:
the back's starter is now a FLAT mid-tone silhouette (the front's
median opaque luminance, single palette index, mask mirrored so
strokes stay inside) - no front detail baked in, back relief empties
to 0 until the sheet is authored. The mobile artifact's BACK tab and
RESET reseed to the same flat surface. The back is now a genuine
blank authoring surface; when Mac paints it, the paint pipeline (C6s)
turns that paint into the back's own relief - front detail no longer
leaks around. Five core lists byte-identical; front relief unchanged
(94); pin 1.0000.

### C6s (SHIPPED): upper-chest polish + the entire backside

Upper-upper chest: coverage existed but 1px-radius flecks read as
noise - island minimum width raised to 3px (front relief 112 -> 94
rows, same 16 strands, cleaner). THE BACKSIDE: the classic has no
back sprite, but the back HAS an authoring surface - the paint sheet.
body-back.png's luminance now drives back relief through the
identical interior-island + strand pipeline (rear-view sheet cols
mirror into rig space, every island CLAMPED to the row's real
silhouette run - the lean is asymmetric and unclamped mirrors could
exit the union), emitted at NEGATIVE cz riding the back surface. 223
rows in 37 strands from the starter sheet; when Mac paints the real
back, the form follows the paint automatically - the tuner and the
mobile artifact now author geometry, not just colour. Upstream:
guarded SPEC.backRelief loft (+1 line, 918/920). Five core lists
byte-identical; pin 1.0000; both suites green.

### C6r (SHIPPED): relief strands - the forms connect

Mac: rough. It was - 240 disconnected one-row plates, hard edges,
row-to-row lift jitter. The relief islands now chain across rows by
pixel-interval overlap into STRANDS (the same tracker pattern as the
legs and the hand: drawn forms are vertical shapes); within a strand
the loft bridges continuously (brk only at strand starts), lift takes
a 3-row average, and single-row speckles are dropped. 112 rows in 16
strands - one bump per pec, one ridge per hair strand, connected ab
and collar forms. Five core lists byte-identical; pin 1.0000.

### C6q (SHIPPED): upper-torso relief - traps, collar, hair strands

The shoulder/trap/collar band (above the armpit) rode the hairRows
loft with no interior form. Same interior-island emitter over the
single run's own edges - with two data facts honoured: (1) there is
NO span step between hair and shoulders (the drape is continuous;
span creeps 38 -> 54), so the exclusion is the measured FACE BOX
(crown width about the head centreline, the head's own row span:
top + 0.24/u rows) - headPieces owns the face, plates never land on
it (first cut put highlights on the cheeks; caught by inspection
before regen); (2) frontAt learned the hair-loft surface (halfW *
0.6) for rows above the armpit so the plates ride the drape, not the
0.105 fallback. 56 upper plates (hair strands at the flanks, trap and
collar highlights). Only core change: the hand cz +0.004 from
frontAt's first-match tie-break on slab pairs - other four lists
byte-identical. Pin 1.0000; 240 relief slabs total.

### C6p (SHIPPED): torso + groin relief - the drawn highlights as form

Mac: parity with the groin and torso detail. The trunk map showed the
interior structure AND the trap: the sprite is lit from the upper
right, so the right flank's bright columns are RIM LIGHT, not raised
form - naive bright->proud would warp the torso sideways. The rule:
only INTERIOR bright islands qualify (both ends >= 2px inside the
trunk interval; rim light self-excludes, the hand's traced columns
are excluded explicitly). 60 islands found - the paired pec
highlights at cx -/+0.12 rows 1.39-1.48, the ab/rib clusters, navel-
adjacent and groin highlights - each a thin additive plate (rz 0.012)
riding the front surface at lift ~ brightness over the row median.
One frontAt(y) now serves the trunk rows, the hand overlay, and the
relief (the hand's finger rows had floated 0.058 proud on untapered
chest depth - the only core-list change, a correction; trunk/arms/
hair/legs asserted byte-identical). Upstream: guarded SPEC.torsoRelief
loft after the trunk trace. Pin 1.0000; both suites green.

### C6o (SHIPPED): the right hand, read from the light

Mac: detail the right hand for 1:1. The pixel map answered where the
hand actually IS: not the dark outer wedge but the BRIGHT skin
cluster (ramp 69-71 against the hip's 73-78, idx-35 thumb highlights)
- the raised form catches the light. The overlay tracker now follows
the contiguous bright run per row (seed = the last split row's arm
run, window = previous interval +-2, bright = luminance >= FLANK
median + 8 - the first cut referenced the window's own median, which
is mostly hand, and starved at row 49; the reference must be the
flanking hip skin). 21 rows: thin forearm below the elbow (rx 0.027)
angling in, the fist's peak (rx 0.099 at y 1.147), fingers tapering
to rx 0.033 - the drawn diagonal, verbatim. cz still rides the torso
surface per row. Core emission byte-identical (asserted); pin 1.0000.

### C6n (SHIPPED): the groin - the trunk ends where the thighs begin

The square Mac kept seeing was the TRUNK'S BLUNT TERMINATION: the
last torso slabs ran full hip width at full depth (rz 0.18) to a hard
stop at the crotch row, shelving over the thigh tops (rz ~0.11). The
reference disagrees twice: (1) the artist DRAWS the thigh division
inside the merged pelvis rows - the dark crotch line holds contrast
rows 67-70 (walked up from the row-71 gap centre, ratio <= 0.92, one
gap tolerated and re-admitted) - so those rows leave the trunk and
join the LEGS as two thigh-top intervals split at the seam (arms on
the same rows emit normally; the first cut's early-continue dropped
them and the 1:1 pin caught 39 missing pixels immediately); (2) a
pelvis keeps no chest depth - the trunk's rz now tapers into the leg
depth over the hip band (0.7 -> 0.45 below y 1.16; bottom rz 0.109 vs
thigh 0.107, flush). Front view unchanged by construction: pin
1.0000, hair/arm/overlay byte-identical (asserted), torsoRows pin
unchanged at 20 (slab merging absorbed the 4 rows).

### C6m v3 (SHIPPED): the wedge the artist actually drew

Mac: why is there a square in front of the crotch, and match the hand
to the true reference. The seam-contrast dump answered both: a real
separator line exists ONLY rows 47-54 (seam/median luminance 0.64-
0.90); from row 55 down the ratio is ~1.0 - the artist drew no
articulated hand below that. The square was the walker's phantom tail:
min-luminance always finds SOMETHING, so it emitted slabs to row 70,
and only that below-torso overhang was visible (the rest sat buried at
fixed cz 0.09 inside the hip's rz ~0.16). Fixes: the walk terminates
when the separator's contrast vanishes (ratio > 0.92, one tolerated
gap row), and cz derives per row from the trunk's own depth (tz -
rz*0.5 - the wedge rides the hip surface half-proud). The overlay is
now the 7-row forearm wedge the reference actually contains. Core
emission byte-identical (asserted); pin 1.0000.

### C6m v2 (SHIPPED): the tucked hand as a pure OVERLAY

The first C6m regressed the torso twice (carved notch from the rear;
then full-run merged slabs jittering the whole torso region) - both
reverted at Mac's call. The redesign holds one hard constraint: THE
PROVEN TORSO/ARM EMISSION IS NEVER TOUCHED - asserted byte-identical
against a captured baseline before and after. The tucked forearm/hand
is a separate additive rows list (armOverlay): the interior seam
walked down from the right arm's last split row (min-luminance,
stay-put prior, +-5 anchor clamp), emitting [seam..runOuter] slabs at
cz +0.09. A subset of the sprite run cannot change the silhouette
union - the 1:1 pin holds trivially. Upstream: loftPair gains an
optional third trace (the first cut breached the body.js ceiling by
one line and was carved into bodySpec, where spec interpretation
lives). cz 0.09 is the flush/proud knob on Mac's read.

### C6k iteration 10 (SHIPPED): IoU 1.0000 - the 1:1 match

Mac circled the blue armpit fills twice; the whodunit was earned:
per-face inversion (which faces own excess pixel col 51.5 / row 37.5)
recovered a prism with rx 0.1175 = a 17.7px arm - and the partition
itself was the bug: the arm interval was [torsoEdge..outer]
UNCONDITIONALLY, right for merged rows (tiles the torso) but wrong
for SPLIT rows, where it swallowed the real arm-torso gap (left arm
[4..17] instead of [4..10] - Mac's circled columns exactly). Split
rows now use the arm run's own edges. Two supporting changes landed
en route: per-row SLABS (each pixel row painted only by its own
interval; identical-interval runs merge; brk at every change) which
is the true pixel semantics, and hand TAILS (the fist's last row sat
below wristRow at the crotch - row 71 cols 5-8, the final 4 missing
pixels). RESULT: IoU 1.0000 - every zone 1.000, zero missing, zero
excess. The gate is now THE 1:1 PIN: inter == union == modelArea
asserted exactly; any drift is a defect. The paperdoll model's front
silhouette IS the classic sprite, pixel for pixel, derived entirely
from the sprite's own rows.

### C6k iteration 9 (SHIPPED): 0.9736 - the half-pixel and the stance

Mac: "still not fixed" - correct, and the roots were two: (1) THE
HALF-PIXEL BUG: every measured interval centre used (a+b)/2, but the
pixel block [a..b] centres at (a+b+1)/2 - the whole model sat half a
pixel up-left of the sprite, and centre-sampling rimmed every edge
(blue left, red right, exactly the annotated screenshot); fixed
GLOBALLY in the traceMap (+0.5 col, -0.5 row - centres now land on
the sampler's k+0.5 points, boundary ties impossible). Generator also
marks brk on transition rows (interval overlap < 1px) and upstream
loftTorso honors it - the diamond bridges die by policy, not
threshold luck. (2) THE STANCE: with legs/feet going pixel-exact
(0.997/1.000) the entire upper-body residual followed one cause - the
paperdoll stance transform still shifted trunk/hair/arms (the fit
grid had no zero; even {} takes defaults). Under a full trace the
lean IS the data: the pose fit converges to ALL-ZERO. Result: 0.9012
-> 0.9736; head+hair 1.000, feet 1.000, legs 0.997, ZERO missing
pixels above the legs. Gates: floor 0.95, excess 3.5%. Remaining 138
excess px in the torso band (rows 21-70) - the last named target.

### C6k iteration 8 (SHIPPED): 0.9012 - seams, diamonds, rims

Mac's annotated diff named three artifacts; each had a mechanical
root: (1) blue diamonds in the arm gaps = the loft BRIDGING split<->
merged transition rows where the traced interval jumps sideways -
upstream loftTorso now refuses to bridge disjoint intervals (|dcx| >
rxA+rxB); (2) red horizontal seam lines (crotch, mid-arm) = lofts
span row-centre to row-centre so edge rows covered half a pixel -
every emitted trace now carries HALF-ROW END CAPS and adjacent parts
tile vertically; (3) thick outer rims = sub-pixel registration phase
from centroid ESTIMATION - the trace knows its exact column mapping,
so the spec now emits traceMap {u, colOffset, rowTop} and the metric,
fitter, and diff all register BY CONSTRUCTION (silhouetteIoU gained
an exact-map mode; estimation remains the fallback for non-trace
consumers). 0.8962 -> 0.9012; legs 0.931, shoulders 0.910, upper
torso 0.899, feet 0.892; excess 6.3% of sprite area. Floor 0.88.
Residual: lower-torso band 113 excess (near-adjacent transition
bridges under the disjoint threshold) + 12-gon aliasing.

### C6k iteration 7 (SHIPPED): full-trace retirement - 0.8962

Mac's blotch report, both roots found: the groin blotches were
LITERAL VOXLIGHT LEFTOVERS still building under the trace - the
hardcoded groin wedge (y 0.765-0.9), the pelvis prism, my generator's
synthetic below-crotch hips row, and the deltoid caps doubling the
traced shoulders into the arm gap. The foot blotches were the
sculpted buildFoot poking past the boot pixels. Fixes, all
retirements not patches: trunkLower exits under torsoRows, the
deltoid cap exits under hairRows+armRows, the synthetic row is gone,
and the leg trace now runs THROUGH the foot rows (per-leg span
tracking to each leg's true bottom - the free boot reaches row 144,
the weight sole ends at 137 exactly as drawn: the trace carries the
classic oblique itself) so buildFoot and footYaw retire. Result:
0.8673 -> 0.8962; legs 0.950, feet 0.626 -> 0.896 (24 miss / 21
excess), groin excess 174 -> 53. Gates: floor 0.87, excess ceiling
8%. The paperdoll figure is now trace end to end: every silhouette
pixel derives from the sprite's own rows.

### C6k iteration 6 (SHIPPED): arms trace; ONE partitioner tiles it all

The arms were the last parametric limbs. armRows: per-row trace both
arms armpit->wrist - split rows give both edges exactly; merged rows
take the combined run's OUTER edge (exact arm data) with the inner
edge at the torso boundary. First cut leaked a 1-2px seam down every
merged row (arm inner at torsoEdge+-1 vs the torso's old subtract-
estimator edge: two conventions, lower-torso miss 19 -> 136). Root
fix: ONE PARTITIONER - each row splits into [left arm][torso][right
arm] at exact shared pixel edges, and torsoProfile AND armRows both
emit from it, tiling by construction (the subtract-estimator died;
armBars/wrist/armW re-derive from the same partition). Upstream:
armsDown lofts SPEC.armRows under paperdoll (hand geometry retires -
the trace carries the fist rows); the branch tipped the ceiling and
carved to bodySpec.loftPair, forward-fixing a grep-masked guard
breach. Fitter pruned to the live knobs (arm axes + handScale stage
inert). Result: 0.8371 -> 0.8673 - upper torso miss 102 -> 7 (0.915),
shoulders 0.911, lower torso 0.877, legs 0.862; every TRACED zone
0.86-0.93. Gates: floor 0.84, excess 12%. Last un-traced part: the
feet (0.626) - extend the leg trace through the foot rows next, which
also carries the classic oblique drawing itself.

### C6k iteration 5 (SHIPPED): the ROW TRACE - Mac's question was the design

Mac: "why are you having a hard time just simply tracing inside the
body?" The pattern was already in the numbers: every zone built as a
per-row trace (hair 0.93, torso 0.86-0.91) scored high; every
parametric zone (IK legs, sculpted feet) scored low. So the legs now
TRACE: body-measure emits legRows (per-row centre + half-width, crotch
to the REAL bottom of the leg pixels - the first cut reused the
knee/calf stats series truncated at the ankle, which left the figure
FLOATING at minY 0.187, shrank the u mapping 11% and smeared every
zone fat: a one-dump diagnosis, model runs vs sprite runs per row),
upstream loftTorso gained per-row cx, and bodyLeg under a paperdoll
build lofts each leg through its rows - geometry + stance in one; IK
could never produce the free leg's outward ankle flare (0.149 ->
0.321). The lean became DATA everywhere: torso + hair rows now carry
their measured centres (one x-origin for the whole trace; the split-
origin first attempt skewed registration globally). Result: raw IoU
0.8078 -> 0.8371, legs 0.821, feet 0.467 -> 0.665 (boot shafts
carried, figure grounded), shoulders 0.885. Gates: floor 0.79 ->
0.82, excess ceiling 15% -> 13%. Remaining: the arm-torso junction
band (arms stay IK - bars only cover the split rows, no per-row data
in the merged bands), fist overhang, feet oblique truth.

### C6k iteration 4 (SHIPPED): inside the lines - excess costs double

Mac: "shading way too much outside of the lines." The excess anatomy
(per-band, per-side breakdown added to the diagnostics): beyond-RIGHT
197 px at rows 60-105 (the right fist spilling past the outline +
the free thigh ~0.04 too far out), beyond-LEFT at the bottom rows
(weight foot/calf outside the leaning sprite edge), ~300 px of
gap-bridging (round tubes crossing the sprite's 1-3px internal
separations - a structural floor). The directive became the
OBJECTIVE: the fitter now scores inter/(inter + miss + 2*excess) -
excess costs double - with wrists raised so fists END at the sprite's
row 70 and tighter freeOut. Result: raw IoU 0.7919 -> 0.8078 (staying
inside the lines won on the pure metric too), excess 819 -> 714,
upper torso 0.912, lower torso 0.827, beyond-right halved. Gates:
IoU floor 0.77 -> 0.79 AND a new excess ceiling (spill <= 15% of
sprite area) - the rule is now a test. Remaining: weight-leg lean
(sprite legs converge; model's straight leg spills left at the
bottom), the gap-bridging floor, feet projection truth.

### C6k iteration 3 (SHIPPED): the arms are ASYMMETRIC - fit as data

Mac: arms/hands are the weakest link - really focus. The data ended
the corner-lock mystery: the classic paperdoll arms are CONTRAPPOSTO-
ASYMMETRIC - the image-left arm hangs slack on a flaring bar (centre
-0.30 -> -0.36, wrist at row 70) while the image-right elbows out at
+0.34 and tucks the forearm against the hip - so no mirrored target
can express them, and the old 0.7927 "optimum" literally HID the thin
arms inside the torso silhouette (great metric, armless figure).
Landed: (1) per-arm paperdoll overrides armL/armR {x,y,z,curl,poleX}
at the TRUE armsDown site - which exposed and reverted my earlier
armPoleX plumb that had pattern-matched the blade-guard combat call
(wrong site; the no-op fitter axis was the tell); (2) armBars
measurement (per split band: centre line + MEDIAN width - the mean
diluted with wrist rows); (3) the arm skeleton regenerated from the
bars: joint 0.3014/1.458, elbow rides HIGH at 1.28 so classic's
forearm (0.298) is LONGER than its upper arm (0.179) - inverse of
Voxlight - with per-segment radii (r 1.046 upper, rFore 0.908, a new
upstream seam); (4) handScale fit 2.2 - the classic fist is 14px on a
10px forearm. Result 0.7919 with arms VISIBLE on their bars: lower
torso 0.70 -> 0.82 (miss 259 -> 35), upper torso 0.87. Fist overhang
below row 70 shows as leg-zone excess (0.76) - the fitter's optimum,
named. Truth over metric: the armless 0.7927 is dead.

### C6k iteration 2 (SHIPPED): hair mass, arm/foot knobs, IoU 0.79

Mac: pose off, neck/head unaccounted, upper torso wrong - iterate to
1:1, don't rush. The zone diagnostic (tools/silhouette-diff.mjs:
per-zone inter/MISSING/EXCESS + red/blue diff PNG) corrected my
guess: upper torso was already 0.87 - the losses were head+hair
(0.42, 426 px missing) and the shoulder band (0.45, 433 px): rows
0-32 are ONE fused hair/traps/deltoid mass the rig never modelled,
and those rows are single-run = EXACT sprite widths. hairRows seam
upstream (loftTorso gains per-row cz; the mass sits back 0.03 so the
face emerges; replaces the neck prism) + measured emission -> head
0.93 / shoulders 0.86 in one move, 0.6649 -> 0.7834. Pose refit +
2D armX*armY sweep (single-axis descent corner-locks) -> 0.7924.
armPoleX (elbow bow) and a wider arm anchor both tried and REVERTED
on the numbers (anchor trade: lower torso +0.04, upper -0.04, net
wash - data wins). footYaw upstream (yaw about the ankle after
pitch; yaw===0 short-circuits to the exact pre-yaw arithmetic - the
parity fixture caught a 1-ulp drift from ax+(p0-ax)) -> feet 0.49,
total 0.7927, floor ratcheted 0.64 -> 0.77. Residuals NAMED with
causes: lower-torso 259 px (the sprite arm is a near-vertical bar at
|x| 0.33-0.37 the bowed rig arm cannot occupy without losing the
upper junction - next: joint spec-level anchor+wrist fit), legs 255
px excess (spacing/radii - measured values stand, spacing next),
feet 295 px (the classic sprite draws the forward foot LOWER -
oblique projection; front-ortho cannot express it - a projection
truth, not a defect).

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

### C6i - in-house backs (SHIPPED, then SUPERSEDED BY C6z - see the note below)

> **AUDIT 21 (doctrine lane, F10).** Two things were wrong with this slice's
> record. First, C6z retired the derived-shading path outright ("the back
> sheet starter is now TRANSPARENT ... gen-back-sheet.mjs deleted"), and this
> entry still read SHIPPED with no forward pointer, so the arc log made the
> in-house back grids look live when nothing had read them for slices.
>
> Second, `src/characters/backs/body00i0.json` (DELETED) and
> `src/characters/backs/cuirass-251-4.json` (DELETED) were committed ARENA2
> DERIVATIVES - which is why they are gone rather than merely marked dead. Measured against the real corpus, the body grid's opaque
> mask is identical to the mirrored BODY00I0 sprite pixel for pixel -
> 5237/5237 texels, 100.00% silhouette agreement. The shading is recomputed
> (only 1.83% of palette indices match), but the SHAPE and the ramps are the
> source art's. Port-Doctrine now says it plainly: A RENDER OF GAME DATA IS
> GAME DATA, and a re-shaded sprite that keeps the original silhouette answers
> yes to "did these pixels come from ARENA2?".
>
> The claim below that "everything comes from data we own" was the doc lie
> that let them sit there: the front sprite they are derived from is the
> USER'S ARENA2 file, not ours. Regenerate locally with `tools/derive-back.mjs`
> if the path is ever revived.



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

RECONCILIATION NOTE: commit 0da703d is a mislabeled sweep - a
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

### C5 - Neutral rig redesign + full race system (SHIPPED)

Direction pivot: the vendored rewrite/trace rig and the 1:1
silhouette-IoU pin are RETIRED (daggerBodySpec / silhouetteIoU /
paperdollPose and their tools/paint sheets removed). The live figure is
now a from-scratch DESIGNED standing body, `src/characters/neutralBody.js`
`buildNeutralBody(ramps, opts)`: arms at the sides, forward legs/feet,
~7.5-head proportions, HSCALE 0.9 global vertical compress (height
~1.82, ~2136 bare faces). Colour is baked per face (geometry AO +
ART_PAL-ramp shading SNAPPED to ramp steps = the blocky look), ramps
sampled from the loaded sprite. Limb groups body/head/armL/armR/legL/
legR stamped per face; deltoid caps are tagged armL/armR (not body) so
shoulders move with the arms. neutral.test.js (2) pins mesh shape +
snapped shading. Test suite unchanged at 179/36 - the race system is
viewer- and engine-side geometry, no new suites.

**Armour - body-as-displacement.** Mac's chosen approach for
body-hugging pieces: a generic `displace(groups, yLo, yHi, th, cxFor,
zScale, mat)` in buildNeutralBody pushes body faces radially outward and
stamps a material; shading resolves the ramp by material name. Data-
driven table `src/characters/armorSet.js` `armorZones(index, family)`:
Cuirass 102, Greaves 104, Gauntlets 103, Boots 108 -> zones stamped with
the family material (Plate->steel, Chain->mail, Leather->leather; MAIL/
LEATHER ramps added). Standoff pieces are separate meshes via the shared
loft `src/characters/pieces/pieceLoft.js` (`loftPiece` with the OUTWARD-
normal flip that fixed the recurring backwards-texture bug; `capTop`/
`capBottom` end-caps; `arc:[a0,a1]` partial rings): pauldrons (105/106,
tagged armL/armR, raised onto the shoulder) and helm (107, a simple
medieval dome + cheek guards after the Corinthian attempts were
rejected). Clothing `src/characters/clothing.js` `clothingZones(index)`
resolves every body-hugging garment 1:1 with the item DB by name; draped
garments (skirts/robes/cloaks/togas/dresses/wraps/sashes) are separate
SIMULATED cloth meshes (see C-Drapes), not zones. Layer order: clothing
(thin) under armour.

**Race heads** `src/characters/pieces/hair.js` `buildHair(ramp, race,
skin, style)`. Hairstyles (Human 8: short/buzz/medium/long/ponytail/
topknot/mohawk/bald; Elf 6) - ponytail/topknot are lofted strand-tubes,
mohawk a sagittal crest, long/medium extend the back drop; Khajiit +
Argonian get no hair mass (fur/scales instead). Race features are
flesh-shaded geometry: Elf = curled pinna ear (lofted lobe->point spine,
helix rim, concha hollow); Khajiit = wide-splayed corner ears, heavy
brow, WIDE short whisker-pad muzzle + small 3D nose, thin whisker
strands, cheek/neck ruff; Argonian = temple horns sweeping back, tall
spinal crest, brow scales, short reptilian snout with nostril dents, a
welded neck frill, and discrete raised scale bumps tiled over the head.
KEY FIX (the recurring "disconnected/floating" bug): every feature base
must sit WITHIN the measured head surface (maxX ~0.10; profile measured
from the actual head faces), not in empty space beside it - features
that exceeded it floated. Snout/muzzle protrusions kept short.

**Tails** `src/characters/pieces/tail.js` `buildTail(skin, kind)` -
tube lofted on parallel-transport frames (planar, no twist), root buried
INSIDE the pelvis so it emerges from the lower back with no gap. Argonian
= thick tapering, dorsal spine-fin, ventral scutes, scale bumps, spine
ARCHES up from the base then sweeps down and trails back. Khajiit = thin
uniform, gentle S-curve, bushier furry tip, fur tufts. Tagged body.

**Body detail** `src/characters/pieces/bodyScales.js` - generated by
SAMPLING the body faces so each scale/tuft sits on the surface and
inherits that face's group (animates, never floats). `buildBodyScales`
= Argonian raised scale bumps over torso/arms/legs + banded belly
scutes; `buildBodyFur` = Khajiit short downward fur tufts, split
coat/belly for counter-shading (region param).

**Colour selection** `src/characters/palettes.js` - per-race ramp
palettes (6 human skins, 5 elf tones incl. High/Wood/Dark, 6 Khajiit
furs coat+belly, 6 Argonian hides). Root mechanism: every shade point
attaches a per-face normalized intensity (`_i`); the viewer emits it and
recolours client-side by snapping intensity onto the chosen ramp, so any
tone keeps correct shading with no payload bloat. Base body recolours
per race (same geometry, re-shaded); fur split into coat/belly meshes so
counter-shading survives a tone change.

**Engine bake** `src/characters/raceCharacter.js` `buildRaceCharacter(
race, spriteRamps, opts)` assembles body (race-coloured) + head + tail +
body detail into ONE merged face list with groups intact.
interiorContext builds a cached mesh per race via `buildCharMesh` (packs
+ the animate closure) and instances each NPC onto its race mesh, race
from `raceOfArchive(textureArchive)`; animateChars drives all race
meshes. Replaces the single bare body all NPCs shared.

**Tooling.** Standalone viewer `tools/neutral/build-viewer.mjs` ->
dagger-viewer.html: rotating figure with race / tone / hair / armour
piece / walk / pixelize controls, mobile-scrollable toolbar, helm<->hair
mutual exclusivity. The view tool could not render images this session,
so geometry was self-verified with an ASCII rasterizer (dump faces ->
project -> brightness ramp, read as text) before every viewer build.

OPEN: `raceOfArchive` is a deterministic 4-way spread, a STAND-IN for the
real Daggerfall archive->race table. One mesh per race (default tone +
style) - per-NPC tone/hairstyle variety needs per-instance colour, not
yet wired. NPCs of a race animate in lockstep (one shared mesh - the
per-instance animation phase is still open). Equipment selection is not
yet data-driven in-engine (viewer only).

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

### C5 - the villager designs (EDITOR ONLY, no game wiring)

`src/characters/villagerDesigns.js`: the 25 wandering-townsperson
variations as DATA the editor consumes. Mac's call, twice over -
FULLY REDESIGNED (the classic sprites are inspiration, not a trace,
per tools/neutral's retired 1:1 silhouette pin) and delivered as a
data spec rather than as engine wiring. Nothing in src/ reads them.

The ROSTER is not ours to choose. mobilePerson.js's PERSON_TEXTURES is
3 races x 2 genders x 4 archives plus the city guard, and SetPerson
spawns off that table, so an archive with no design is a blank
townsperson - test/villagerdesigns.test.js fails the moment the two
drift. Colour is an ART_PAL INDEX SPAN, never free RGB: the rig snaps
faces to ramp steps, which is what makes the blocky look.

**A gown is not a cloth zone.** The first cut expressed skirts as a
zone spanning [body, legL, legR]. That cannot work: `displace` pushes
a group's faces out from THAT GROUP's centre, so it thickens each leg
about its own axis and the render came back as a tunic plus a pair of
shorts. Only the render said so - every numeric check passed.
pieces/draped.js already owned the answer, with a standoff grid per
garment that clothSim swings, so hanging cloth is now a
`drape: {name, mat}` and only what lies ON the body stays a zone.

**A hood needs a face opening.** Same lesson, same day: gated on
height alone the hood painted the whole skull, face included. So
`displace` grew a DEPTH gate (zLo/zHi, unbounded by default, inert for
every existing caller) and a hood became two zones - temples-back,
plus the crown above the brow. The guard's closed helm still covers
the face, on purpose.

Two engine seams, both additive and both inert for the game: the cloth
loop passes `z.mat || 'cloth'` (it hardcoded one colour, so a whole
outfit resolved to a single dye), and createAnimContext returns the
`ankleY` it already measured. No src/ caller passes clothZones at all.

**Two dead viewer paths found while wiring the editor.** `ZERO_ARM`
was declared by BOTH the template and the injected animate.js - two
`const` in one scope is a SyntaxError, so the entire viewer script had
never run for anyone. And `drapeColliders` read a bare `ankL`, a local
inside createAnimContext that has never existed in that scope, so
every simulated drape threw on its first frame - which is every drape
in DRAPED_NAMES. Both are fixed; both had been committed and green.

Editor support: selecting a villager drives the drape, hairstyle,
hair-colour and skin-tone controls, because all four are part of the
design rather than separate toggles a reader has to find. Villagers
ship as a DELTA over the base body's faces (zones displace and
recolour, they never add geometry) - 25 whole bodies would be
megabytes in one standalone file. `tools/villagerRender.mjs` is the
offline still life for when a browser is not to hand.

OPEN: nothing consumes these designs in-engine. Wiring them to
SetPerson is the next step and is deliberately not taken here.

## DECIDEs (Mac)

- **DECIDE-C1 (RESCOPED at the pivot)** - equipment-piece art review
  cadence: per piece as authored, or batch a slot set then review.
- **DECIDE-C2 (RESOLVED)** - inventory paperdoll presentation: live
  rotating 3D viewport (not a baked sprite). Mac, 2026-07-03.
- **DECIDE-C3 (OPEN)** - in-engine race assignment: wire the real
  Daggerfall people archive->race(+gender) table, or keep deriving race
  another way. `raceOfArchive` is a deterministic stand-in today.
- **DECIDE-C4 (OPEN)** - per-NPC appearance variety (tone + hairstyle):
  needs per-instance colour/mesh; currently one mesh per race.

See: 01-Overview/Port-Ledger.md section C rows routed here.

## AUDIT 18 - doc-truth corrections to this page

Two claims on this page were false about the code and are corrected here
rather than rewritten out of the milestone records above.

**E2a's turn rate.** The E2a paragraph listed "11.25deg in-place turns"
inside a sentence describing enemyMotor.js as a VERBATIM port of DFU's
classic path. 11.25 is classic's rate, but it is not what DFU ships:
EnemyMotor.TurnToTarget (:1348-1355) reads
`const float turnSpeed = 20f;` with the 11.25 sitting directly beneath it
as a dead comment - "Classic speed is 11.25f, too slow for Daggerfall
Unity's agile player movement". The port shipped 11.25 at E2a and called it
verbatim, so the number has been struck from the E2a sentence; the constant
itself (enemyMotor.js CLASSIC_TURN_DEG) is routed to the Enemies lane of
this audit. Whichever value ships, "verbatim DFU" means 20.

**C2's exterior NPCs.** The C2 record says "collectExteriorNpcs filters the
registry", and the function does exactly that - but NOTHING IN `src/` CALLS
IT. Its only importer is test/names.test.js, so no scene ever builds the
exterior NPC registry and no exterior static NPC is a talk or activation
target in the running game. The interior twin IS live
(interiorContext.js:131 -> collectInteriorPeople), which is what made the
gap invisible: the feature demonstrably works on one side. The corpus pin
(76 NPCs across 16 RMB blocks) pins the FUNCTION, not the game. Recorded as
a Port-Ledger C row (static-NPC activation, exterior side) so the gap stops
living only inside a SHIPPED heading.

## CH-C (2026-08-20): the C-slice's three characters rows - SHIPPED

**THE ARCHER BAND (combat-3 = characters-1).**
EnemyMotor.DoRangedAttack (:570-614): inside the STRICT 6..51.2m
band (240/2048 classic units at GlobalScale, EnemyAttack.cs:28-29) a
bow foe's whole cadence is the 1/32 classic-update roll within the
22.5deg yaw - no melee timer, no speed roll - and the melee machine
never runs from inside the band (DFU returns true even while only
turning). Outside it the archer is a MELEE fighter, so the reach
gate now applies to everyone; the port used to fire bows on the
melee cadence at any seen distance. Each swing records WHICH
decision fired it (firedRanged), so the sprite records and the
damage arm key per SWING: a point-blank archer plays the melee
records and lands melee damage while an in-band shot draws 20-24
and looses on the -1 marker. RESIDUE on the struck row:
HasClearPathToShootProjectile's fine grain (the in-sight gate
stands in) and the Enhanced-AI strafe.

**ENEMIES OPENING DOORS (characters-3).**
The senses half first: EnemySenses.CanSeeTarget clears its door
every pass (:879) and records the sight ray's FIRST BLOCKER when it
is an action door (:912-918). The port's collider grew raycastHit -
the same DDA, now returning the bucket that produced the nearest
hit; action doors are their own buckets keyed by action object, so
the attribution is exact and an OPENED door (bucket removed,
MakeTrigger) unblocks the ray. Then EnemyMotor.OpenDoors
(:1425-1442): a CanOpenDoors foe - 52 mobile entries, matching
DFU's 52 - whose known door is not open, not locked, and closer
than 2m (foe to door CENTER, :917) toggles it through the
ActionSystem's own door path, whose IsMoving gate refuses a
swinging door exactly as DFU's ToggleDoor. The dungeon arm gates on
DOOR_VERB_FLAGS so only real doors count. The Enhanced-AI bash arm
stays with its setting.

**PACIFICATION (characters-2).**
CalculateEnemyPacification (:357-391): Etiquette/Streetwise read
skill/10 + personality/5 (C# INT divisions); a monster tongue reads
the FULL skill + personality/10 - fluency in Orcish counts for far
more than manners; sheathed +10, drawn -25; roll Range(0,200) <
chance. GetEnemyEntityLanguageSkill (:2808-2880): the six stealth
classes speak Streetwise, the rest Etiquette (DFU's BCHG over
classic's all-Etiquette - the port follows its source), 24 monster
careers map to the nine tongues, vampires and liches hear
Etiquette, beasts speak nothing. The hook is EnemySenses' FIRST
detection (:504-528), an edge both senses arms now raise; success
stands the foe down - IsHostile false gates the DECISION TICK
itself, so a pacified foe neither pursues, TURNS, swings nor casts
- with the languagePacified line (prose ours, key cited) and a
tally of 3 (DFU's BCHG); a failed monster tongue still tallies 1,
social skills tally nothing on failure. Damaging a pacified foe
re-hostiles it (MakeEnemyHostileToAttacker) and pre-loads the
pursuit through the G1 shape. The port's first non-hostile foe
state; the faction/team model stays a ledger row.

12 pins across arrows/enemydoors/pacification.test.js; 9 mutations
run, 9 killed across the slice.

## CH-X (2026-08-20): THE EXTERIOR MOBILE-FOE MOUNT - SHIPPED

The X-slice; S32's above-ground arms go live. scenes/exteriorFoes.js
is the encounter pool: the same shared pieces every foe host runs -
EnemyAI senses/pursuit against the exterior collider (playerInside
false for the exterior despawn band), the EnemyAttack cadence with
the C-slice archer band, MobileUnit classic sprites with the lazy
record/frame batch mutation, makeEnemyEntity + the loot roll +
equipEnemy, CalculateAttackDamage both directions (the -1 damage
marker vs the player, resolveHit with backstab and the zero-damage
sounds against the pool), corpses on the guard shape - and NONE of
the watch's crime machinery: killing a wilderness wolf is not
Murder. Two allocation-owner guards bound a long session (a pool cap
and a 120-unit relevance cull that runs AFTER fresh senses - the
live probe caught the inversion culling every newborn foe on its
Infinity placeholder).

The world host drives it beside the watch: the classic per-minute
catch-up loop (PlayerEntity.Update:486-492) rolls
intermittentEnemySpawn with the live pixel's climate and the
location-rect read off the location index, breaks on the first
spawn, lands the foe at the classic distance on eight compass
points, and FAST TRAVEL RESETS THE ANCHOR - DFU's
PreventEnemySpawns parity, so a week at sea does not queue a week
of wolves. Encounter foes are spell targets (magic.foes() sees both
pools, the sinks route by pool to the right damage door) and melee
targets (the chain runs watch -> encounters -> civilians).

Probed LIVE in the streaming world: a rat spawned at 10 units
detected the player and closed 8.8 -> 4.8 over four seconds, zero
page errors. RESIDUE on the narrowed S32 row: exterior enemy
archery/casting (their missile seams), the single-location exterior
page's arm, RegionPower, the guard-spawn crime arms.

2 pin groups (the pool laws incl. the cull order and the no-crime
sweep; the host wiring incl. the bounded catch-up, the travel
reset, the facade routing and the melee order); 3 mutations run, 3
killed.

## CH-X2 - EXTERIOR ENEMY ARCHERY: the band fires above ground

2026-08-20, the X2-slice. The encounter pool's loud rangedAttack
residue retires: bow foes now arm by the SAME ranged-flags law the
dungeon build reads, and the C-slice 6..51.2 band - already ported
into the shared attack driver - simply starts firing out here. The
ranged -1 marker looses a REAL arrow through the host's new onArrow
seam: the C13 exterior flight gained an enemy meta that hunts the
player mid-capsule per step (the dungeon missile's exact contact
law), ArrowShoot rings from the archer, and the impact runs the
shared damage member - so the Dodging tally, the C2 poison seam and
the recoverable arrow all ride the hit, identical to the dungeon's
arrow arm. Player arrows keep the visible-flight-only law (their
foe impacts resolve at the fire host's own chain); the bare
update(dt) form still serves the single-location page, which has no
encounter pool. Exterior enemy CASTING stays the narrowed residue -
its missile seam is the S16 decision loop the dungeon host owns.

4 pins (the hunt law + the sails-through player-arrow discriminator
+ the pool/world wiring sweeps; the old residue pin rewritten to the
live law); 4 mutations run, 4 killed. Suite 1452 across 190, green
both modes.

## CH3 - FALL DAMAGE AND THE SWAP PAUSE: two small laws land

2026-08-20. Two AUDIT 23 rows closed; the senses fine-grain trio
(characters-9/10/12) is NOT among them - its shorthand no longer
resolves to concrete findings and the row now says so, pending the
original finding bodies or a dedicated senses pass.

characters-8, enemy FALL DAMAGE: the foe motor tracks its grounded
height on every ground contact, and the grounded edge after airborne
reports a past-threshold drop. Both pools bill the PLAYER's own
formula - trunc(5 x (drop - 5)), constants single-sourced from
motor.js - through their damage doors, no knockback, with the
FallDamage clip at the foe. A knocked-down flyer measures from its
LAST ground height, verbatim: hovering never touches the anchor.
The double-math trunc is pinned exactly as the C# cast computes it
(an 8.2 drop bills 15, not 16).

characters-13, the SWAP PAUSE (the row's name corrected - this is
the PLAYER's equip delay): both halves bill onto the entity's
countdown - the leaver at the one unequip door, the arriver in
equipItem, accumulating across a swap exactly as the writer sums
both sides per hand - and the weapon rig blocks the attack while it
runs, draining at the classic 980 units/second. The table quirk
carries verbatim: the delay table indexes by the item's index
WITHIN ITS OWN GROUP, so a shield swap bills the low armor indexes
against the weapon delay table.

3 pins; 4 mutations run, 4 killed. Suite 1460 across 192, green
both modes.

## CH-X3 - EXTERIOR ENEMY CASTING: the one executor

2026-08-20, the X3-slice. The above-ground combat arms COMPLETE:
after X2's archery, the casters go live in the streaming world.

The extraction first: the dungeon host's castEnemySpell body - the
magic-15 silence gate, the player-priced cost floored at 0, the
element cast sound, the CasterOnly self-assign, the magic-9
at-caster AoC with the caster excluded, and the missile loose -
moves whole into characters/enemyCasting.js beside the EnemyCaster
decision driver it always served, behind injected deps (the M3
one-engine doctrine). The dungeon rebinds through foeDeps and its
local copy is gone; three pins that anchored on the old body
repinned to the shared member.

Then the exterior mount: spawnFoe assigns the S16 spell lists once
the SPELLS.STD map lands and mints the shared decision driver; the
pool's update runs the decision beside the attack machine and
releases through the one executor with the world host's seams - the
AoC through the engine's explodeAt, and missiles through the
engine's NEW enemy arm (fireEnemyMissile + the player-hunting
impact at the CASTER's level, the caster wrapper carrying the
transfer heal-back sinks). The sprite Spell one-shot rides the cast
edge, the same C14 pulse the dungeon plays.

Shared residual, honest in both hosts: enemy missiles resolve
against the player only - foe-vs-foe friendly fire pends the
missile seam's target sweep.

3 pins + 3 repins; 5 mutations run, 5 killed. Suite 1466 across
193, green both modes.

### CH-X2/CH-X3 addendum: the live probe (tools/x23Probe.mjs)

2026-08-20, after the merges. The exterior combat stack proved out
in a real browser, frame-synced on the world host: an Archer (141)
spawned at 15 armed as a bow foe and a REAL enemy arrow flew
(enemyArrows=1 in the live pool); a Mage (128) spawned at 20 minted
its caster with the tier list and RELEASED an Ice Bolt missile
through the engine. Zero page errors (the one CURSOR.IMG 404 is a
guarded miss - the file is absent from this ARENA2 set and
cursor.js's own header says NEVER TRAPS; the probe filters exactly
that line).

Two probe drafts died on FAITHFUL behavior, which is its own
verification: a mage spawned at 40 stood permanently blind (outside
the 25-unit hearing radius with an away-facing spawn yaw - the P13
stealth flow), and a mage that reaches melee undischarged can never
cast at all (its tier list - Ice Bolt 2, Ice Storm 4 - is all
ranged, and DoTouchSpell picks rangeType 0/1 only). The probe now
spawns inside hearing and sends a second mage through the band for
the ~11% undischarged tail.

## CH4 (2026-08-20): THE SENSES VERIFY PASS - characters-9/10/12 resolved

The AUDIT 23 shorthand row ("roll order + yaw gate + frame clamp")
had lost its finding bodies; CH3 marked it unfixable without a
dedicated pass. CH4 is that pass: EnemySenses.cs (965 lines) and
EnemyMotor.cs's classic path re-read whole against
characters/enemyMotor.js, member by member.

VERIFIED CLEAN (the "roll order" third): the illusion die is
classic-gated in both (EnemySenses.cs:444-449 - the source's own
comment explains the per-classic re-roll is what makes chameleon
matter); the stealth die is minute-gated in both with the shared
once-per-minute player tally; CalculateStealthChance is byte-exact
(`2 * ((int)(d/GS) * liveStealth >> 10)`); BlockedByIllusionEffect
matches arm for arm (seesThrough, invisible-always-blocks, the
8/4 see-through, no die for an unconcealed target); StealthCheck's
gate ladder matches (wouldBeSpawned, the 1024-unit cap, the odd-
minute skip for a slow player, fast+encountered auto-detect);
EvaluateMoveInForAttack, SetChangeStateTimer and the giveUpTimer
laws all confirm the port's classic shape (always move in, no
timer, refill-200/decrement).

FIXED (the other two thirds were real):

- **The stop-branch yaw gate** (the "yaw gate" finding): DFU's
  "Not moving, just look at target" branch turns when outside
  TargetIsWithinYawAngle(22.5f) (EnemyMotor.cs:514); AttemptMove's
  5.625 gate (:896) belongs to the MOVING branch only. The port
  used 5.625 in the melee-stop branch, so stopped foes
  micro-tracked the player's every step. STOP_YAW_GATE_DEG = 22.5
  now - a melee foe stands up to 22.5deg off-face (the 35.156
  attack cone still covers it), turning only past that.
- **The senses cadence** (the "frame clamp" finding): DFU resolves
  sight (:421/:428), the hearing gate (:433-436) and the detection
  ladder (:451-470) EVERY FixedUpdate; only the spawn-band
  recompute (:260-310) and the illusion re-roll are classic-gated.
  The port ran everything at the classic rate (16Hz) - up to 62ms
  of detection lag DFU does not have - and its own _step comment
  even said so. The split is now DFU's exactly: _classicSenses
  (spawn band + illusion die) per classic tick, _senses (sight/
  hearing/ladder/encounter edge) per fixed step, decisions after
  the resolution in DFU's senses-then-motor component order.
- **The hearing ray origin** (found on the way): CanHearTarget
  casts from transform.position - the capsule CENTER - along
  directionToTarget (:942); the port cast from the EYE (feet +
  5h/6), a third of a height too high. Center-to-center now; the
  closed-door departure stays documented.

Shipped with the pass (the SL2 residue): the dungeon foe snapshot
carries isHostile + hasEncounteredPlayer + magicka
(SerializableEnemy.cs:112-114 save, :178/:182-183 restore) - a
pacified foe stays pacified across F9/F11, a discharged caster
does not refill - restore gated on field presence so pre-CH4
saves keep the live state.

Mutations: 4 run, 4 killed (the stop gate reverted to 5.625; the
hearing origin back at the eye; the resolution re-gated on the
classic tick; the magicka restore dropped).

Pins: test/ch4senses.test.js x4 (the 22.5/5.625 pair with a live
15deg-stands/30deg-turns drive; the hearing origin captured off
the mock ray; the cadence - detection on the first 1/60 step with
zero classic ticks and exactly one illusion die per classic tick,
the failed see-through blocking the ladder; the snapshot halves
sweep with the presence-gated restores).

## MT - MOBILE TEAMS: ENEMY INFIGHTING, PlayerAlly, AND THE TARGET MACHINE (2026-08-27)

The completion analysis' standing item five. Until this slice every
enemy in the port targeted the player and nothing else: `EnemyAI` had
no target field at all, `SENSES_INTERVAL_UNITS` sat exported and
unconsumed since C8, and `ENEMY_BASICS` carried a team string for
every mobile that nothing read.

### MT-i - the selection half (`src/characters/enemyTargets.js`)

`MOBILE_TEAMS` is DaggerfallUnityEnums.cs's enum, index for value
(gated in-test against the C# itself). `getTargets` is
EnemySenses.GetTargets (:752-878) whole: the self skip, the
NoTarget/non-hostile/PlayerAlly player skip, the pacified-vs-ally
pair, the three-arm can't-target-ally chain, the quest arms, the
would-be-spawned-or-seen reject and the priority arithmetic.
`runTargetMachine` is the Update:312-414 classic block: the
system-timer cadence, the dead-target cull, the non-hostile player
drop, the null-target reset with the secondary switch, and the
mutual-target write.

**THREE TEAM FIELDS, NOT ONE**, and getting this wrong is the bug the
slice nearly shipped. C# takes `MobileEnemy` BY VALUE out of the enemy
dictionary (SetupDemoEnemy.cs:82) and an allied summon overwrites
THAT COPY (:85-86) before `SetEnemy`; `EnemyEntity.cs:316` then seeds
`Entity.Team` from the copy. So:
- the STATIC row (`ENEMY_BASICS[id].team`, frozen and shared by every
  foe of the type) - what `MakeEnemyHostileToAttacker`'s ally revert
  reads (:211), and the ONLY thing that may not be written;
- the per-instance `MobileEnemy` copy (`entity.mobileTeam`) - what
  GetTargets' :776 and :801 arms read;
- the live `Entity.Team` (`entity.team`) - what ChangeFoeTeam rewrites
  and the :784/:792/:796 arms read.
They differ for exactly one foe in the game - a Sanguine Rose or Skull
of Corruption summon - and reading the copy in the revert would have
left a struck ally allied forever.

THE SEAM is the headless charter's two arms: the machine arms only
when the host's senses context carries a `targeting` closure. Every
pre-MT caller keeps the player-only path, which is also DFU's own
behaviour with no other enemy in the scene.

### MT-ii - the hosts (`exteriorFoes`, `cityGuards`, `hostCombat`)

`world.js` owns both exterior pools and hands them one senses builder,
so the shared candidate list lives there - DFU's
ActiveGameObjectDatabase is one database across the scene, which is
what lets a spawned monster and a watchman see each other. The record
IS the candidate (its identity is the target handle), with the two
quest halves as LIVE getters because `bindQuestFoeHost` runs after the
mint and ChangeFoeInfighting flips the flag mid-quest.

`applyDamageToNonPlayer` (EnemyAttack.cs:303-392) had no port at all,
because until MT-i no foe could hold a foe as its target. It carries
the damage roll, the concealment break, blood, knockback, the class
pain voice, the miss/parry fork and the retaliation - and NOT the
player-only riders (no `onMonsterHit`: a rat biting an orc infects
nothing; no damage flash; no Dodging tally).

**THE KNOCKBACK GUARD IS NOT THE PLAYER'S.** EnemyAttack:336-337
writes parentheses WeaponManager:578-580 leaves out, and its class
test names the ATTACKER where the player's names the TARGET. Two
laws that merely look alike, one home each (`enemyKnockbackApplies`
beside `weaponKnockbackApplies`).

Arming the pools turned five dormant `Target == player` terms live,
each of which had been unobservable while every foe targeted the
player - and one of them was a trap:
- **the Murder crime** (cityGuards) was levied on ANY guard death.
  DaggerfallEntityBehaviour.cs:203 gates the whole player block on a
  player source, so an ungated crime would have FRAMED THE PLAYER for
  a murder a rat committed - and the watch responds to that crime.
- the alert raise (EnemySenses:531) and clear (EnemyDeath:131) both
  gate on `Target == PlayerEntityBehaviour`;
- the encounter cull measured `_dist`, which is the distance to the
  SELECTED TARGET once armed - two foes brawling 2m apart would never
  cull, and the pool respawns forever;
- the attack component, the casting decision and the arrow all aimed
  at the player while the motor aimed elsewhere;
- `CLASSIC_MELEE_DISTANCE_VS_AI` (1.5, not 2.25) was exported at C8
  and never consumed: "Classic uses separate melee distance for
  targeting player and for targeting other AI" (:157-160).

### MT-iii - the two quest actions

`ChangeFoeInfighting` and `ChangeFoeTeam` leave GUARD_PATTERNS, which
drops to FOUR. Both write EVERY live instance of a foe symbol through
the new `questFoeInstances` host door, both leave the action LIVE when
no instance stands yet (SetComplete sits inside C#'s instance walk),
and the infighting flag rides C#'s `Convert.ToBoolean` - true/false
case-insensitively and nothing else.

### What MT unblocked, and what it did not

**Unblocked:** V3's allied-summon door is MOUNTED - and both summons
turned out to carry a law the port lacked, filtering their nearby scan
on `Team != PlayerAlly` (so your own summons are not company), with
the Skull carrying a second, redundant check the port keeps because
dropping one of two is guessing which. `areEnemiesNearby` gained
GameManager.cs:709's hostility/team gate and C#'s own
`includingPacified` parameter.

~~**STILL OPEN (MT-iv):** the DUNGEON host is not armed.~~
**MT-iv SHIPPED (2026-08-27), the same day.** See below.

Pins: 14 in `test/enemytargets.test.js`, 9 in
`test/enemyinfighting.test.js`. Three of the MT-i pins exist because
an adversarial re-read of EnemySenses.cs found the port had them
wrong: the mutual-target write nested one level too deep (it is a
sibling of the spawn-band gate, firing off the PERSISTENT
`targetSenses`), the illusion re-roll and LOS decrement running on
null-target ticks (C#'s :410-414 return sits above them), and the
sight ray aiming at a player-sized eye for every target. A fourth,
`sawSecondaryTarget`, is ported with its quirk intact: the flag is
written outside the Enhanced guard while `secondaryTargetPos` is
written only inside it, so a classic-path secondary switch begins its
pursuit at the world origin.


## MT-iv - THE DUNGEON HOST ARMED (2026-08-27)

MT's recorded remainder, closed. `dungeonContext` was the one pool
still on the player-only path; infighting is no longer an above-ground
mechanic.

**The subsystem gate held.** This host loads the whole foe subsystem
lazily behind `opts.foes && palette`, precisely so a foe-less dungeon
never pays for `enemyMotor` - and `enemyTargets` imports `enemyMotor`.
So unlike `exteriorFoes`, which imports it statically, the target
machine rides the DYNAMIC import and is published on `foeDeps`, with
every consumer below the block guarding on it. A degraded subsystem
idles the arming and leaves the legacy path, which is the same charter
the machine's own seam uses.

**The candidate list is this host's whole active-enemy database**
(EnemySenses.cs:741-749) - nothing to join, unlike world.js, but
filtered `!dead` every frame so corpses leave it the frame they die.
The record is the candidate at both mints (the class branch and the
monster branch) through one `asCandidate` decorator, with the two
quest halves as live getters.

**The forks, both of them.** MeleeDamage's two-arm split (:199-209)
sits INSIDE the resolver rather than at its two call sites (the rig
path and the sprite marker path), so both spellings get it from one
home. BowDamage carries the same split (:134-148), and it had to land
together with the aim: an enemy missile now locks its victim at fire
time, so aiming one at another foe while the impact test still knew
only the player would have made it fly through and hit nothing - worse
than never aiming there. The recovered Arrow goes into the TARGET's
items (:145-147), which had credited the player unconditionally.
Enemy SPELL missiles take the same fork; the self and AoE-at-caster
arms need none, being position-driven already.

**One hazard this host has that the exterior pools do not:** a
DESTROYED foe (the quest teardown, the dispel sweep, the restore cull)
is marked dead with its health still above zero, so the machine's
health-based cull can never drop it and every foe holding it would
chase an object that no longer draws. DFU never has this problem - its
database stops yielding a destroyed behaviour. One `dropCandidate`
sweep, called from the single removal door.

**And ChangeFoeTeam finally reaches underground.** The
`questFoeInstances` door walked the two exterior pools, so a quest foe
standing in a dungeon was never found - and since SetComplete sits
inside C#'s instance loop, `change foe X team 1` re-ran every machine
tick for ever instead of completing. `worldModes.liveQuestFoes()` is
the inside pool's half of DFU's one database; the interior arm stays
empty, that host having no enemy pool at all.

Pins: 8 in `test/dungeoninfighting.test.js`. One pre-existing pin
(`ch3`'s fall-damage arm) was repaired rather than merely advanced:
its `braceBlock` helper took the last `{` BEFORE the match, so any
helper declared above the arm shadowed the block it meant to read -
its own wave-39 comment says the intent was to "brace-match the arm",
and it now anchors to the arm's own brace.
