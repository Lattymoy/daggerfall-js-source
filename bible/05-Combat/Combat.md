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
