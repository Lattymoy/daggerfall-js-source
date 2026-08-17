# Combat

**Core scope SHIPPED via Characters C8** (the phase plan named
"FormulaHelper, weapons, enemy AI" - all three landed inside the
enemy-rigs arc; full records live in 04-Characters/Characters-Arc.md):
- FormulaHelper port: src/combat/formulas.js (to-hit chain, damage
  paths, backstab, materials, body parts - verbatim, roll-injectable).
- Weapons: the shared weaponStates machine (player + enemies), player
  melee (src/combat/playerWeapon.js), enemy equipment + per-part armor
  (src/combat/enemyEquipment.js).
- Enemy AI: senses/pursuit (enemyMotor), attacks (enemyAttack), the
  entity layer (enemyEntity + CLASS*.CFG + MONSTER.BSA careers).

**Shipped here (routed rows):**
- RDB effect actions Hurt21-25 / Poison / DrainMagicka
  (src/world/actionSystem.js EFFECT_ACTION_FLAGS): Hurt21 fires every
  20th activation with the verbatim exclusive Range * level; Hurt22-25
  every activation (IsFlat ? Magnitude : AxisRaw) * level; Poison is
  DFU's OWN empty delegate, preserved; DrainMagicka is an INTERIM
  no-op until the magicka stat (Systems). Traps damage the shared
  player entity with or without ?foes.

**Remaining (queue):**
- CastSpell action flag: SHIPPED via Systems S4b (trap-spell missiles
  + the classic damage family through the verbatim saving throw; the
  wider effect library remains Systems work).
- Bows in-world: SHIPPED. Arrows ride the S5 missile system as
  weapon-carrying missiles (element None) rendered as the oriented
  99800 model through dynamicDraws; the player's bow (?weapon=bow,
  Short Bow template 129 - the equip UI pends) looses on the strike
  frame along the view-matrix forward and tallies Archery; enemy
  archers (equipped-bow foes) attack from SIGHT (the melee-distance
  gate is melee's) and loose at the player; hits resolve through
  calculateAttackDamage with the bow BOTH directions, and a landed
  arrow adds ONE recoverable Arrow to the TARGET'S items (BowDamage's
  classic charm). Crouch pass-over pends.
- Trigger-on-collision: SHIPPED. DaggerfallAction.Receive's verbatim
  trigger gate lands in the action system (TRIGGER_GATE: each RDB
  TriggerFlag's accepted types; chains always valid; undefined flags
  never fire; player activation is now the typed Direct trigger -
  fixture movers gained real lever flags); effect objects carry their
  placement AABB and a per-frame pass fires WalkOn/WalkInto with the
  component's exact semantics - 0.12s per-object timeout, only while
  the player actively moves HORIZONTALLY (classic ignores up/down/
  jump), contact beneath -> WalkOn; movers carry their AT-REST bounds and
  trigger only while parked (audit 06f closed the step-on-platform
  gap). The Combat build queue is EMPTY;
  remaining Combat-adjacent work lives in Systems (effect library)
  and UI.
- Systems-shared interims tracked in the Home ledger: TallySkill,
  proficiency/racial mods, poisoned weapons, stealth checks.

## The FP weapon: the TRUE classic method (design pivot 2026-08-17, Mac-directed)

The voxel FP viewmodel (C8 E3d + the 2026-08-16 framing fix) is ON
ICE, not deleted: Mac's call is the Daggerfall method 1:1 with the
true art. combat/fpsWeapon.js is the live path - WEAPON*.CIF frames
(WEAPO1xx enchanted variants included) through the shared CifRciFile
reader, ItemHelper's template-index -> WeaponType mapping, the metal
dye over palette band 0x70-0x7F (dyes.js tables), and FPSWeapon's
320x200 screen-space alignment verbatim. The DFU-verbatim swing
STATE MACHINE (weaponStates.js), the hit resolution, drag-to-swing,
the touch attack button, and the audio seams are all untouched - only
the render swapped. S19's ShowWeapons(false)-while-paralyzed gate
carried through the pivot.

THE ICED SURFACE stays whole for a reversible thaw: characterSprite's
drawFirstPersonViewmodel, anims' ATTACKS_FP sweeps, PlayerWeapon's
pose() with its units pins, and tools/fpProbe.mjs - each annotated ON
ICE at the site. tools/fpsWeaponProbe.mjs is the live path's standing
probe (real ARENA2 CIFs headless; zero coverage in any state is the
failure class the voxel path shipped for six weeks). Gallery:
public/visual-changes/combat-fp/classic-weapon/. Departures at the
module head: no FlipHorizontal (right-hand only until a settings
surface), weaponOffsetHeight 0 (no large HUD yet). Follow-up rollout:
the exterior/interior hosts (the voxel path was dungeon-only too).

## 2026-08-17 - the classic-FP-weapon parity audit (Mac-directed)

Full diff of combat/fpsWeapon.js + its consumers against FPSWeapon.cs,
WeaponBasics.cs, ItemHelper.ConvertItemToAPIWeaponType,
ImageProcessing.ChangeDye, and WeaponManager.Update. VERIFIED
byte-identical, no change: all seven animation tables (records,
frames, speeds 10/20, alignments, offsets 0.15/0.04/0.02/0.2, the
MagicBattleAxe record shuffle, the bow 7/7/7/7/7/4), the anims +
filename routing (WEAPO1xx variants, WEAPON10/11), the three alignment
functions + the 320x200 bottom anchor, the frame clock (3*(115-SPD)/
980 melee, the 0.0625 bow tick, draw-to-hold, the StrikeUp->StrikeDown
release chain, the bow-only frame-reset rule), hit frames 2/5, the
index-0 transparency, the bow record-0 force, NEAREST filtering (DFU's
1.01 non-point fudge correctly absent). Tint is a mod seam defaulting
white. FlipHorizontal + weaponOffsetHeight stay documented departures.

SIX findings, all rooted and pinned:
1. SILVER weapons rendered undyed: DFU's DyeColors aliases Silver =
   Chain = SilverOrElven = Unchanged = 18 and ChangeDye routes 18 into
   the SILVER metal table; the bake's Unchanged short-circuit skipped
   it. The caller now guards Steel/None exactly as
   FPSWeapon.GetWeaponTexture2D does; everything else dyes.
2. The STARTING Iron Dagger drew no weapon art: INTERIM_WEAPON lacked
   templateIndex, so weaponTypeForItem fell to None (a test pin caught
   it live).
3. SHEATHING did not exist: classic starts sheathed; Z (ReadyWeapon)
   toggles, edge-detected in both hosts + a touch button; attacks are
   refused while sheathed; SOUND.DrawWeapon (78) plays only on
   unsheathing a real weapon (ToggleSheath verbatim).
4. The ShowWeapons legs were missing: the bow-cooldown hide and the
   spell-armed hide (clickCast / pendingClickCast) now fold with S19's
   paralysis gate into one predicate in WeaponManager.Update's order.
   Routed legs, no system yet: equip countdown, climbing, transport.
5. ARROWS were never consumed: one Arrow per player loose
   (inventory.removeOne), and an unsheathed bow at zero arrows
   auto-sheathes with the classic "You have no arrows." line
   (FPSWeapon.UpdateWeapon's guard, verbatim).
6. The standing probe gained silver/steel dye-parity evidence shots
   (gallery: public/visual-changes/combat-fp/classic-weapon/).

## C9 (2026-08-16): the FP-weapon HOST ROLLOUT - SHIPPED

The weapon audit's follow-up closes: the classic weapon was
dungeon-only (the voxel path was too). combat/weaponRig.js bundles
the host surface - PlayerWeapon + the WEAPON*.CIF art cache, the
ShowWeapons legs (spellArmed a hook; hosts without casting omit it),
ToggleSheath + DrawWeapon 78, the zero-arrow bow auto-sheathe, the
RMB gesture buffer with the sheathed gate, the swing-sound edge, and
an envAttack export (the WeaponEnvDamage ray: doors bash and consume,
other action objects Receive(Attack), geometry occludes). Every law
mirrors the AUDITED dungeon implementation verbatim.

Mounted (the host rule - every motor host):
- worldModes INTERIOR mode: RMB drag/click through the shared sink,
  Z per-mode (the old unconditional dungeonCtx read CRASHED on Z
  inside a building - fixed here), strike frames run envAttack
  against the interior's action objects (swing doors bash), bows
  consume an Arrow + tally Archery.
- world.js + exterior.js walk modes: full render/swing/sheathe;
  exterior.js only in first person (V's third-person view has no FP
  overlay). RMB drag feeds the rig INSTEAD of the look, as the
  dungeon host; touch gains the attack button + tap.

RESIDUALS (honest): dungeonContext keeps its own inline copy - that
file is the parallel FP lane's ACTIVE surface and conflicted on every
merge today; folding it onto the rig is queued for when the lanes
settle. The exterior hosts' 'You have no arrows.' line lands on
console (their HUD-text layer pends); exterior/interior arrow
MISSILES pend (arrows consume + tally, nothing hostile to hit yet);
static building doors are not bashables (the E-enter seam; towns
arc); the standalone interior.js viewer has no motor - out of scope.

BYCATCH (probe-found): bare ?world had boot-CRASHED since U2b -
walkMode read shotMode 70 lines before its declaration (TDZ), and
?play/?fly short-circuited past the read so every played path missed
it. Declaration hoisted; the &shot&world probe now boots and streams
Daggerfall city green.

4 tests (weaponrig.test.js). Suite 388/86, ARENA2 green pre-commit,
dungeon + exterior(&play) + world shot probes green.

## C10 (2026-08-16): the dungeonContext rig fold - SHIPPED

The C9 residual closes (the parallel FP lane has ended; this session
is the only one): dungeonContext's inline weapon surface collapses
onto combat/weaponRig.js - ONE home for the art cache, the
ShowWeapons legs (spellArmed = the click-cast HasReadySpell leg,
threaded), ToggleSheath + DrawWeapon 78, the zero-arrow bow guard
(say -> hudText), the gesture buffer, the swing-sound edge, and the
WeaponEnvDamage ray (the inline env block in resolvePlayerHit is now
the shared envAttack). The rig's canvas dep became late-resolvable
(() => element) - the dungeon context only holds a canvas per
drawFoes call. The dungeon-only pieces stay put: foe hit resolution,
the bow fireArrow loose, click-cast consumption, the equip seam.

Behavior deltas, all parity-positive:
- The weapon EXISTS in foe-less dungeons now (the old playerWeapon
  was foes-gated; DFU's WeaponManager always runs) - and the
  listener/torch/animal ambient pass, which sat INSIDE the old
  `if (playerWeapon)`, is un-gated: foe-less dungeons had silently
  lost 3D audio + ambient barks since A2.
- The touch tap (playerClickAttack) gains the sheathed gate the
  inline version bypassed (WeaponManager: no attack processing
  while sheathed). Pinned in weaponrig.test.js.

Suite 389/86 (the clickAttack gate pin). ARENA2 green pre-commit,
dungeon + world shot probes green.

## C11 (2026-08-17): THE MONSTER PIVOT - classic sprite mobiles, LIVE - SHIPPED

Monsters 0-42 stop being static flats and become full foes: the
classic 8-orientation sprite animation (characters/mobileUnit.js,
DaggerfallMobileUnit + EnemyBasics verbatim) driving a live billboard
batch per foe, on the SAME combat spine as the rigged class enemies -
EnemyAI/EnemyAttack senses + pursuit, makeEnemyEntity (monster HP/
level/armor from loadMonsterCareer's ENEMY{nnn}.CFG), generateItems
loot, S16 spells, S18 riders, corpses, damageFoe. Foes are DEFAULT ON
in every host now (`!params.has('nofoes')` - dungeon, world walk,
exterior walk).

The laws (all pinned in mobileunit.test.js, 6 tests):
- Record layout Move 0-4 / PrimaryAttack 5-9 / Hurt 10-14 / Idle
  15-19; orientations 0-7 with the three back diagonals mirrored;
  speeds 6/10/4/4 fps; orientation = -round(signedAngle/45) mod 8
  (enemy->camera vs enemy forward, sign from cross.y - the identical
  vector algebra to DFU, verified against UpdateOrientation line by
  line).
- Attack frame SEQUENCES per enemy (PrimaryAttackAnimFrames + the
  one-Dice100-roll chance ladder to variants 2-5) with -1 as the
  damage marker: sets hitFrame, skips, exhaust reverts to idle.
- Hurt one-shot -> idle; hasIdle=false keeps the frame across
  idle<->move; BounceAnim reverses at n-2.
- Specials: Rat 0 (inverted idle flips), Ghost 18/Wraith 23 (own
  move/attack tables, move doubles as idle), Slaughterfish 11
  (bounce move doubles as idle), Giant Scorpion 20 (OrientEnemy's
  flip INVERSION), and the orientation-switch frame RESCALE
  (frame*newN/oldN - the Ancient Lich 288 8-vs-4-frame overflow).
- The extractor grew ChanceForAttack4/5 + HasIdle + the frame
  sequences; enemyBasics.js regenerated (C3 parity asserted, all 42
  monsters carry sequences).

THE BILLBOARD-AXIS DOCTRINE (ground-truthed, engine-wide): our
right-handed lookAt puts world +x on screen-right where Unity puts
it on screen-LEFT - for identical world data and camera pose our
frame is the horizontal mirror of DFU's (the A/D strafe comment in
every host records the same fact: Unity's (cos,-sin) right vector
moved screen-left here). The hosts' static-flat axis
`camRight = (cos yaw, 0, -sin yaw)` = the NEGATED view row 0 bakes
the compensating mirror into every billboard, so the engine is
self-consistently mirrored - and DFU's verbatim FlipLeftRight
booleans are correct ONLY under that axis. Any new billboard pass
MUST use the flats' axis, never the raw view row. Proven by the
sprite-orientation doctrine: skeletal warrior 270/17 raw art faces
image-left; with the raw view row the o=6 flip rendered it
moonwalking (facing against its own yaw); with the flats' axis it
faces its walk direction, matching the raw art. (The scratchpad
record dumper + tools/monsterProbe.mjs are the standing check.)
Corollary for the ledger: the whole render is chirality-flipped vs
classic per-frame (texture text would read backwards); un-mirroring
is a candidate slice (negate the view x row + frontFace swap +
strafe/gesture audit), Mac's call - within-engine consistency holds
either way.

Rendering: one live batch per foe (unit quad; renderer `record`
takes the composite `${record}#${frame}` key; negative size.w =
flip; origin = ai.feet, bottom-anchored shader). Per-frame textures
via dataPipeline.uploadRecordFrame (spectral path preserved for the
ghost/wraith archives). Deterministic spawn yaw (Ledger A - no
engine PRNG). Feet law vs DFU: our bottom-anchor equals DFU's
non-idle branch exactly (controller-height algebra cancels); idle
records deviate by half the record-height difference - accepted
sub-pixel.

Residuals (LOUD): flying/aquatic monsters use the grounded motor
(they walk); Spell + RangedAttack1/2 anim states pend (casters cast
without the cast anim; texture 475 female record 20-24 x1.35
post-fix pends with them); Seducer transforms; the -1 marker as the
DAMAGE moment (damage rides the shared EnemyAttack machine - the
per-frame timing is a recorded refinement); foe-AI fixed stepping
(P16 residual, all foes).

Suite 400/88. ARENA2 green, dungeon + world + exterior probes green
(foes default-on), monsterProbe close-up verified vs raw art.

### C11 pre-merge audit (2026-08-17, Mac-directed): six findings

Line-by-line re-read of DaggerfallMobileUnit/EnemyBasics/EnemyAttack/
EnemyMotor/EnemySounds against the port. All tables, GetStateAnims
branch order, UpdateOrientation algebra, AnimateEnemy stepping, and
NextStateAfterCurrentOneShot verified verbatim-identical. Six real
deviations found and fixed (five in code, one recorded):

1. LEADING -1 SWALLOWED: ApplyEnemyState checks the FIRST attack
   frame for -1 up front (the Frost Daedra's 50% variant [-1,4,5,0])
   - damage flags immediately, display advances to the next entry.
   The port clamped it to frame 0 and lost the hit flag.
2. HURT/ATTACK PRIORITY BACKWARDS: DFU's ChangeEnemyState(
   PrimaryAttack) at MeleeAnimation is unconditional (overrides
   Hurt); knockback-hurt gates on state != PrimaryAttack. The port
   had hurt preempting attack. (Hurt-per-player-hit stands: the
   WeaponManager knockback floor 15 clears the 5-unit hurt threshold
   on every landed hit.)
3. FLYING CLOCK: Behaviour == Flying overrides Move/Idle to
   FlyAnimSpeed 10 fps (GetStateAnims' tail). The port ran flyers at
   the ground 6/4.
4. STRIKING WAS LEVEL-TRIGGERED: the shared machine's swing (~1s at
   speed 50) outlasts the sprite sequence (~0.6s), so
   `machine.state != Idle` REPLAYED the attack anim (+ re-rolled the
   variant) inside one swing. Now an EDGE (Idle -> swing), computed
   beside the machine update; paralysis eats the edge exactly as
   FreezeAnims blocks ChangeEnemyState. The attack SOUND moved to
   the same edge - DFU plays it at MeleeAnimation START, not at the
   hit frame, and not gated on the hit connecting.
5. CORPSES + LOOT PILES FLOATED h/2: both passed base + h/2 to the
   bottom-anchored billboard shader (a center-anchor holdover; the
   static-flat path shifts DOWN for the same reason, missiles pass
   the base). Pre-existing since C8/S2, magnified by C11's common
   monster corpses. Both grounded now.
6. RECORDED, NOT MODELED: knockback MOTION (the push-back
   displacement + its decay re-triggering Hurt) pends with foe
   knockback; the hit-test foe center at feet+0.9 overshoots small
   sprites (rats) - cosmetic-only today (LOS raycast, not a hitbox).

Suite 402/88 (the audit pins ride mobileunit.test.js: leading -1,
priority, flying clock). ARENA2 green, probes re-run green.

## C12 (2026-08-17): THE BEHAVIOUR MOTORS - flying + aquatic monsters SHIPPED

The loudest C11 interim closes: imps, giant bats, harpies (Behaviour
Flying) and ghosts/wraiths (Spectral - CanFly folds both, verbatim)
stop walking; slaughterfish/dreugh/lamia (Aquatic) stop strolling on
dry stone. EnemyMotor.cs laws on the P17 fixed-step body:

- FLYING (CanFly = Flying || Spectral): 3D pursuit at the target's
  FACE (PredictedTargetPos + targetHeight/2 = feet + 1.8), NO
  gravity - idle/turning flyers hover exactly in place; the
  floor-skim guard (descending with ground inside height/2 + 1 below
  the center forces direction.y to +0.1, not renormalized, as DFU);
  the classic turn-in-place yaw gate applies to flyers unchanged.
  Spawn: flyers hover at the raw spawn marker (no floor landing) -
  the probe shows 9 airborne bats/imps across Privateer's Hold.
- AQUATIC (WaterMove verbatim): movement EXISTS only while the
  controller center is below the block water surface (P11's
  waterSurfaceYAt = PlayerEnterExit.blockWaterLevel, threaded in);
  rising motion caps at center + 100*GlobalScale (2.5) under the
  surface; a beached or waterless-block fish is FROZEN - no pursuit
  and no gravity (WaterMove owns all its movement). The
  slaughterfish aims at the face (the ID 11 special); other swimmers
  aim at the target center (no ground flatten - swims skips it).
- PARALYSIS flows through the motor now (DFU CanAct=false +
  flyerFalls): senses keep running, decisions stop, paralyzed FLYERS
  FALL OUT OF THE AIR ("intentional side-effect", EnemyMotor
  comment), swimmers "just freeze in place", walkers stop pursuing
  but keep gravity. The old scene-side full skip is gone.
- Corpses land: a flyer killed mid-air drops its corpse to the floor
  (floorLanding in spawnCorpse - AlignBillboardToGround for every
  corpse).
- Sprite anchoring needs NO change: DFU center-anchors flying/
  aquatic billboards at the controller center = feet + h/2, which
  equals our bottom-anchor at feet for matched heights.

Residuals (carried): knockback flyerFalls (a hit knocking a flyer
out of the air) pends with knockback motion (C11 audit item 6);
enhanced-AI strafe/backing/pitch-pause branches N/A (classic
doctrine); flying foes use the walk speed formula as DFU does.

Suite 406/88 (3 C12 pins in enemymotor.test.js: 3D face pursuit +
gravity-free hover, the WaterMove caps + beached/dry freezes, the
paralysis triad). ARENA2 green, probes green.

## C13 (2026-08-17): host arrow missiles - the visible loose SHIPPED

The Combat queue's named next: bows in the exterior/interior hosts
consumed an Arrow and tallied Archery but nothing flew - the loose
looked broken. combat/arrowFlight.js is the shared flight for hosts
WITHOUT the dungeon missile system: the 99800 arrow model oriented
along its direction (dungeonContext's arrowMatrix law verbatim),
MISSILE_SPEED/LIFESPAN/RADIUS single-sourced from S5 (spellcast.js),
the swept geometry raycast (the sweep covers the whole step - raw
dt cannot tunnel), plus a terrain landing check the dungeon never
needed: the mesh raycast cannot see the collider's heightAt fallback
floor, so an arrow at or under it has landed. A lost arrow is LOST
(DFU's law for a miss - no recovery without a struck target).

Mounted (the host rule): worldModes INTERIOR mode (fires from
player.eye along eyeDir; per-building collider late-resolved; a new
interior drops stale flights), exterior.js walk (frame-scope
eye/fwd), world.js walk (cam.pos + the live streaming collider -
arrows land on real terrain via heightAt). The dungeon keeps its
FULL missile path (foe seeking + BowDamage recovery) - this module
is the no-targets subset, and the dungeon path is the fold target
when exterior foes land (random encounters, the RMB animal arc).

Suite 409/89 (arrowflight.test.js x3: the S5 single-source + matrix
law, wall kill + lifespan retire, terrain landing + the function-
collider form + the all-dead sweep).

## C14 (2026-08-17): the monster Spell anim state SHIPPED

The C11 cast-anim residual closes: the 13 monster casters (S16's
exact roster) stop casting frozen. Verbatim DaggerfallMobileUnit:

- GetStateAnims' Spell branch: HasSpellAnimation routes to records
  20-24 (RangedAttack1Anims, 10 fps) - the Orc Shaman (21) is the
  ONLY such monster; every other caster plays its SpellAnimFrames
  over the PRIMARY attack records. And NO ghost/wraith special in
  the Spell branch (verbatim: ghosts/wraiths cast on
  PrimaryAttackAnims, not their own attack table).
- ApplyEnemyState's Spell branch: the one-shot rides the shared
  frame iterator (frames[0], iterator 1) - no chance ladder, no -1
  in the data; exhaustion reverts to idle
  (NextStateAfterCurrentOneShot).
- The interrupts, verbatim: the attack edge overrides a cast
  (ChangeEnemyState unconditional at MeleeAnimation); knockback-hurt
  CAN cut a cast (EnemyMotor's gate is state != PrimaryAttack ONLY);
  a cast never interrupts an attack in progress.
- The trigger: castEnemySpell sets the cast edge (the decision IS
  DFU's ChangeEnemyState(Spell) moment); paralysis eats the edge
  exactly as FreezeAnims blocks ChangeEnemyState. Extraction grew
  HasSpellAnimation + SpellAnimFrames (13 monster casters carry
  frames; C3 parity asserted).
- RangedAttack1/2 close as N/A for monsters: HasRangedAttack1 is
  true only for class enemies (128+) in EnemyBasics - the rigs' bow
  path owns actual ranged attacks. The texture-475 female casting
  scale post-fix rides class enemies too - both documented at the
  module head, no longer deferred work.

Residual: the Seducer transform pair + the -1 damage-moment
refinement (unchanged, LOUD at the module head).

Suite 410/89 (the C14 pin in mobileunit.test.js: the route + the
shaman one-shot playout [0,0,1,2,3,3,3] + all three interrupt laws).

## C15 (2026-08-17): knockback - hits shove SHIPPED

C11 audit item 6 closes: landed weapon hits physically knock foes
back, and the Hurt anim now rides the knockback threshold instead of
the hit itself. Verbatim WeaponManager.WeaponDamage +
EnemyMotor.KnockbackMovement + FormulaHelper:

- THE SPEED (weaponKnockbackSpeed, formulas.js): kb = ((10d - w) *
  256)/(w + 10d) * 2d; speed = (10d/w) * (2d - kb/256), through
  classicToUnitySpeedUnitRatio/10 (3.95), FLOORED at 15 classic - so
  every landed player hit clears the 5-classic hurt threshold.
  Weight (enemyWeightClassicUnits): monster table Weight, class
  female 240 / male 350; the + items*4 term FLAGGED to item weights.
- THE GATE (WeaponManager:578): monsters need Weight > 0 - the
  weight-0 SPECTRALS (ghost/wraith) take NO knockback, verbatim -
  and class enemies re-knock only once the current shove decays
  under the threshold. The attack RAY is the direction: melee = the
  look ray, arrows = their flight; spell damage carries no ray and
  knocks nothing (and therefore plays no hurt anim - DFU's law:
  damage alone never triggers Hurt, only knockback does; the C11
  per-hit _hurtPending is RETIRED).
- THE MOTION (KnockbackMovement on the P17 fixed step): stored speed
  clamps at 40 classic, motion caps at 25, decay 5 per CLASSIC tick;
  CanAct=false (pursuit + decisions suspend, senses run); grounded
  foes take it via the SimpleMove shape (ray y DROPPED, gravity on),
  FLYERS take the full 3D ray AND FALL (flyerFalls - a hit knocks
  them out of the air), swimmers ride the C12 WaterMove gates.
  hurtKnock (speed > 5 classic) is the scene's hurting input - the
  MobileUnit re-enters Hurt while it holds (DFU's repeated
  ChangeEnemyState) and its own state gate keeps attack unbroken.
- Rig (class) foes share the same motor knockback; their
  HurtFront/Back stagger clips stay (our own visual, documented).

Residual: enemy-vs-enemy knockback (EnemyAttack:344) pends foe-vs-foe
combat; player knockback from enemy hits is not a DFU law (none).

Suite 416/91 (the C15 pin in enemymotor.test.js).
