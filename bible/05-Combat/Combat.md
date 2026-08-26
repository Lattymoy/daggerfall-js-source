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
  DFU's OWN empty delegate, preserved; DrainMagicka is REAL since
  Systems S4a gave the player a rolled magicka pool - the verbatim
  max(1, IsFlat ? Magnitude : AxisRaw) off CURRENT magicka, floored
  at 0 (actionSystem.js:312-317, pinned in magicka.test.js). Traps
  damage the shared player entity with or without ?foes.

**Remaining (queue):**
- CastSpell action flag: SHIPPED via Systems S4b (trap-spell missiles
  + the classic damage family through the verbatim saving throw; the
  wider effect library remains Systems work).
- Bows in-world: SHIPPED. Arrows ride the S5 missile system as
  weapon-carrying missiles (element None) rendered as the oriented
  99800 model through dynamicDraws; the player's bow (?weapon=bow,
  Short Bow template 129, or equipped through the inventory window's
  Equip mode since U8g) looses on the strike frame along the
  view-matrix forward and tallies Archery; enemy archers hold the
  STRICT 6..51.2m band since CH-C - DoRangedAttack returns ahead of
  the advance/retreat decision, so an in-band shooter stops, turns to
  within 22.5deg and rolls 1/32 per classic update, while outside the
  band the same foe is a melee fighter under the reach gate and each
  swing keys its records and damage by WHICH decision fired it; hits
  resolve through calculateAttackDamage with the bow BOTH directions,
  and a landed arrow adds ONE recoverable Arrow to the TARGET'S items (BowDamage's
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
  gap). The Combat build queue is NOT empty: AUDIT 26 (2026-08-26)
  routed five unstruck Combat-arc rows into the Ledger - F023 (every
  unsheathe plays clip 78 where DFU plays the weapon's own equip
  sound), F024/F025 (the bow blinks out over its cooldown, and an
  equip countdown never calls ShowWeapons(false)), F128 (the equip
  delay bills per transition, not per inventory visit), F182
  (envAttack skips Receive(Attack) on doors) and F052/F053 (the arrow
  impact's missing sound and blood halves). The rest of the
  Combat-adjacent work lives in Systems (effect library) and UI.
- Systems-shared interims tracked in the Home ledger: TallySkill
  SHIPPED at S3 (systems/skills.js:94), stealth checks SHIPPED with
  shared.js's StealthCheck seam, poisoned weapons SHIPPED at S19b
  (systems/poisons.js) with the player's own blade dosing its victim
  through calculateAttackDamage (C2-slice), and the RACIAL half of
  the swing mods is verbatim (formulas.js:199-207). TWO INTERIMS
  LEFT: CalculateProficiencyModifiers reads 0 until the career
  "Expertise In" flags land (formulas.js:449-450), and the enemy's
  poisoned-weapon assignment roll is still unrolled
  (enemyEquipment.js:183) now that the system it waited on ships.

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
failure class the voxel path shipped for six weeks). Gallery: generated
locally, never committed - the ignore rule is `public/visual-changes/`
(.gitignore:37), the published root AUDIT 21 doctrine F1 took the
fourteen frames out of; the standing probe writes its own shots outside
the repo. Departures at the module head, both now with EXPIRED
conditions: no FlipHorizontal, whose "until a settings surface" ran out
when the settings screen shipped - Controls/Handedness sits on it
(settingsMap.js:72) at STORED tier, a switch the player can flip that
reaches nothing, which is the same shape U45 found GUI/LargeHUD in; and
weaponOffsetHeight 0 (fpsWeapon.js:22, :266), whose "no large HUD yet"
ran out AT U45 - the classic bottom bar ships, so the screen weapon now
sits at the wrong height behind it. That second one is a REAL
undocumented gap, not a moot departure: it is the one place in this
page where the staleness understates the WORK, not the port.
Follow-up rollout: the exterior/interior hosts (the voxel path was
dungeon-only too).

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
   (tools/fpsWeaponProbe.mjs:91-92 - fpProbe.mjs is the ICED voxel
   path's probe and shoots none of these; regenerate locally, they are
   not committed).

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

THE BILLBOARD-AXIS DOCTRINE (ground-truthed, engine-wide): the world
DATA is DFU's, left-handed (x east, y up, z north), and the
right-handed lookAt put world +x on screen-LEFT where Unity puts it
on screen-RIGHT - so for identical world data and camera pose our
frame was the horizontal MIRROR of DFU's, from M1 until 2026-08-23.
The hosts' static-flat axis `camRight = (cos yaw, 0, -sin yaw)` =
the NEGATED view row 0 is Unity's OWN right vector, and DFU's
verbatim FlipLeftRight booleans are correct only under it: while the
mesh pass ran mirrored, that axis was the one surface already
drawing classic's way. Any new billboard pass MUST use the flats'
axis, never the raw view row. Proven by the sprite-orientation
doctrine: skeletal warrior 270/17 raw art faces image-left; with the
raw view row the o=6 flip rendered it moonwalking (facing against
its own yaw); with the flats' axis it faces its walk direction,
matching the raw art. (The scratchpad record dumper +
tools/monsterProbe.mjs are the standing check.)

THE UN-MIRRORING SHIPPED (2026-08-23, off Mac's playtest "signage is
inverted") - it is the HANDEDNESS LAW at mat4.js:86-110, not a
candidate slice. Every input sign had been tuned against the mirror,
so the port PLAYED correctly and only text could tell; the motor even
carried a comment PROVING the old screen side from the projection and
reverting a prior fix - the proof was true and the convention it
proved was the mirror (motor.js:625-631). The fix is ONE mirror at
the projection: `mirrorProjectionX` negates the NDC x row, so screen
x flips for meshes, billboards, missiles and precipitation at once
and world +x lands screen-RIGHT. Consequences, each at its site:
triangle winding flips, so renderer init sets `frontFace(CW)`
(renderer.js:617); the input signs go back to Unity's (yaw += dx,
strafe/fly right = (cos, -sin), motor.js:636-637); the billboard
camRight above and the sky's screen ray were ALREADY written to this
convention and simply stopped mismatching. The FP viewmodel keeps its
own UNMIRRORED perspective - its pass never culls - and the automap's
2D lens takes the mirror because its mesh pass does
(automapWindow.js:216). test/handedness.test.js pins the math and
greps every host for the mirrored projection.

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
   beside the machine update; paralysis eats the edge because the
   attack MACHINE is gated (EnemyAttack.Update returns at the top while
   paralysed, so MeleeAnimation never fires ChangeEnemyState). AUDIT 24
   wave 33 corrected the attribution: it is NOT FreezeAnims, which is a
   dead store. The attack SOUND moved to
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
  because the cast decision is gated, not because of FreezeAnims (wave
  33: dead store). Extraction grew
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

## C16 (2026-08-17): the -1 damage moment SHIPPED

The last loud C11 combat residual: sprite monsters now land their
melee damage exactly on the -1 markers of their attack sequences
(AnimateEnemy doMeleeDamage -> EnemyAttack.MeleeDamage), not on the
shared machine's HIT_FRAME_MELEE. The machine stays authoritative
for the attack DECISION (meleeTimer, the classic roll, the strike
edge) and remains the RIGS' damage clock; the mobile's hitFrame is
the mobiles'. The melee resolution (gate 0.25/MeleeDistance +
35.156deg + CalculateAttackDamage with the S18/S19b riders) is
extracted once - resolveFoeMelee - and both clocks call it.

Consequences, verbatim: the Frost Daedra's base sequence
[0,1,-1,2,3,-1,4,5,0] strikes TWICE per swing (pinned); paralysis
never lands a mobile damage frame - but it LATCHES one (AUDIT 24 wave
33: EnemyAttack.Update returns before the `DoMeleeDamage = false` at
:100, so the blow waits and lands on the first unparalysed frame);
damage timing now tracks the
VISIBLE animation (10 fps sequence position) instead of the
machine's SPD-scaled clock.

Suite 416/91 (the double-strike pin extends mobileunit's audit test).

## 2026-08-17b: the deep audit + C17 THE HUMANOID PIVOT - SHIPPED

Mac's audit directive + the humanoid report ("humanoid enemies dont
utilize the classic daggerfall artwork and still utilize the voxel
system when it should be on ice").

THE AUDIT (everything since 16f - this session's nine slices), each
verified against the DFU source line by line where not already:
- C15 knockback: the class-weight question CLOSED verbatim - class
  EnemyBasics entries carry NO Weight field, so DFU's
  `(speed <= 5 && EnemyClass) || Weight > 0` gate reduces exactly to
  our port (classes re-knock only decayed, monsters always,
  spectrals never). Player arrows route through the SAME
  WeaponManager.WeaponDamage (knockback confirmed); enemy arrows
  (EnemyAttack.BowDamage) damage without knockback - the player has
  no knockback machinery in DFU, matching ours.
- C13 arrows: DaggerfallMissile.MovementSpeed = 25.0 confirmed =
  MISSILE_SPEED (the S5 single source).
- C12/C14/S22/A4/P17: previously line-verified in their slices; no
  new findings. The C16 damage-frame flows re-checked - and AUDIT 24
  wave 33 overturned the conclusion recorded here. "Paralysis skips the
  mobile update entirely, verbatim FreezeAnims" was wrong twice:
  EnemyMotor.HandleParalysis (:253-259) sets `mobile.FreezeAnims = true`
  inside its guard and `false` on the line after the closing brace, with
  no reader in between and no other writer in the tree, so a paralysed
  enemy's animation is never frozen in DFU and its sprite keeps turning
  to face the player (UpdateOrientation has no FreezeAnims check at
  all). What stops the blow is EnemyAttack's early return - and because
  that return precedes the flag clear, the swing is latched, not
  dropped.

C17 THE HUMANOID PIVOT: class enemies (128+) render as classic
sprite mobiles; the voxel foe rig goes ON ICE beside the voxel FP
weapon (reversible thaw, loaders kept, draw path annotated + dead).
The entity spine is UNCHANGED (CLASS*.CFG careers, SetEnemyEquipment
loadouts, poisoned-weapon rolls, archer detection). New verbatim
surface:
- FemaleThiefIdleAnims (record 11 riding BOTH front diagonals - the
  quirk) on the female + FemaleTexture 483 route (Thief 138);
- the RangedAttack1 state: records 20-24 with RangedAttackAnimFrames
  ([3,2,0,0,0,-1,1,1,2,3] shared across the bow classes) - the -1 is
  the shootArrow moment (shootFrame): sprite archers loose exactly
  there, the machine's hit frame demoted to the decision clock;
- the texture-475 female casting scale x1.35 on records 20-24
  (OrientEnemy's post-fix - the files read too small);
- gender picks the archive (male/female textures per class).
Extraction grew HasRangedAttack1/2 + RangedAttackAnimFrames (C3
parity asserted). DOCTRINE PROOF: the type-138 thief's back view
(o=4, record 19) crops IDENTICAL to the raw 484/19 art -
human-closeup vs rec484-19, the standing probe now close-ups a class
foe every run.

Suite 417/91. ARENA2 green, probes green.

## AUDIT 17k hotfix (2026-08-18): the fist crash

Mac's report: attacking with a fist crashed the game. Bare hands are a
NULL weapon since U8h bound the rig to `equip.slots[RightHand]` - and
the DEFAULT state, because starting weapons land in the bag unequipped
(DFU adds them via AddItem, never equips) - and the DUNGEON host read
`WEAPON_SKILL[playerWeapon.weapon.name]` raw at both its swing sites
where the exterior hosts guarded with `?.`: the strike-frame bow test
threw on EVERY bare-handed swing (reproduced live at
dungeonContext.js:1488 by tools/fistProbe.mjs), the melee tally on
every resolved fist hit. Fixed with the rule enforced, not remembered:
a source sweep over src/scenes fails on any unguarded
`playerWeapon.weapon.` deref, the bare-handed path is driven
functionally (ready without the draw sound, swing, HandToHand damage),
and WEAPON10.CIF - the fist art, now the default draw - is
corpus-pinned against every MELEE_ANIMS row. The fourth instance of
the dungeon-host-falls-behind shape; see Home.md Audits, 17k.

## C18 (2026-08-20): equipment CONDITION DAMAGE - SHIPPED

The C-slice's combat row (AUDIT 23 combat-1). Items had carried
conditions since items-5; nothing in the hit chain consumed them.
FormulaHelper.DamageEquipment (:1080-1118) +
ApplyConditionDamageThroughPhysicalHit (:1123-1138), called at
CalculateAttackDamage's TAIL with the clamped damage
(FormulaHelper.cs:699-701) - so the law rides EVERY attack the
formulas resolve, in every host, without a single scene edit.

The gates are the law: a WEAPON hit that dealt damage. Hand-to-hand
and monster natural attacks degrade nothing; a whiff degrades
nothing. The attacker's weapon always takes (10*damage+50)/100 (C#
int division; when that is 0, a 20% roll makes it 1 - rolled PER
ITEM). The struck side routes to an equipped SHIELD when its
protected-parts table covers the struck body part - DFU's own
improvement, its comment says classic never damaged shields - else
to the struck part's armor slot through GetEquipSlotForBodyPart
(the inverse of the slot-part map equip.js already owned).

LowerCondition/ItemBreaks (DaggerfallUnityItem.cs:1170-1214): a
break clamps at 0, speaks the classic line - the plural variant for
Gauntlets/Greaves/Boots; keys cited, prose pending a string source -
and UNEQUIPS through unequipSlot, which restores the armor table.
Broken mundane items stay in the pack; DFU removes only ENCHANTED
player items, and that arm rides the enchantment arc.

Two port guards the pin suite caught before shipping: the frozen
pre-chargen INTERIM_WEAPON cannot be minted a condition
(Object.isExtensible) and a 0-max item cannot break - the first
swing of a fresh boot would otherwise have thrown a TypeError.

4 pins (conditiondamage.test.js), 3 mutations run, 3 killed.

## C19 (2026-08-20): the C2-slice - audio arms, the poison hook, roll-order parity, COMBAT VOICES - SHIPPED

Five ledger rows in one pass, closing the combat family's remainder.

combat-9: every enemy melee frame now RINGS its failures - the
out-of-reach whiff and the failed-roll arm both play the attacker's
swing clip from the foe (barehanded, the high pitch), in the dungeon
pool, the watch and the exterior encounter pool alike; the enemy bow
loose plays ArrowShoot from the archer.

combat-10: an arrow reaching the player rides the same damage member
the melee swing does, so the Dodging tally fires on incoming arrows
too - one tally per attack attempt, hit roll or no.

combat-11: resolveHit threads onInflictPoison, so the PLAYER's
poisoned blade doses ITS victim in all three pools - and the player's
poisoned arrow doses its mark. The formulas were already clearing
the weapon's dose either way; without the hook it simply vanished.

combat-12, two roll-order laws: the enemy melee DFRandom byte now
draws on EVERY idle classic tick - it is the left operand of the
source's pass-and-timer expression, and the attack component ticks
even for a bow foe the band owns - where the old shape gated the
draw behind the timer and the band, desyncing the classic stream.
And the backstab Dice100 draws ONLY behind the level>1 gate (the old
eager argument burned a draw on every non-backstab swing); a landed
backstab speaks (key successfulBackstab, prose ours).

combat-17 COMBAT VOICES: combat/combatVoices.js carries the decision
tables - the 1..5 spawn voice-race roll cached once per foe, male
attack = the race's first pain clip with pain one above it, the male
HighElf-to-WoodElf swap, the female shared-clip forks, the 0..0.3
pitch lift - and hostCombat's gates ride the pools: the 20%
enemy-class attack voice at the melee frame whatever the outcome,
the 40% pain voice on a landed player hit (heavyDamage = a quarter
of max health), the CityWatch knight forced male, and the player's
own 20% attack grunt at the hit frame, never for a bow, reading the
PLAYER's race and gender. All behind the CombatVoices setting,
shipping enabled.

5 pins + 4 backstab fixtures moved to the lazy signature; 5
mutations run, 5 killed. Suite 1444 across 189, green both modes.
