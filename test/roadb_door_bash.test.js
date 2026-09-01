// ROAD-B (b2-hostility-model) - THE EXTERIOR STATIC-DOOR BASH.
//
// R1 flagged this precisely: "what is missing is not the two rolls but
// the INPUT that would reach them... the day that input lands the arms
// drop in beside it." The input is PlayerActivate
// .AttemptExteriorDoorBash (:1056-1079), offered every exterior weapon
// swing by WeaponManager.WeaponEnvDamage (:474-477), and it runs the
// WHOLE of ActivateStaticDoor with isBash true - which is a different
// ladder, not just two extra rolls: the readied Open spell is not
// spent, the interaction mode is not read, Lockpicking is not trained,
// and isBrokenIn starts true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dice100 } from '../src/combat/formulas.js';
import { buildingLockValue } from '../src/systems/buildingLocks.js';
import { CRIMES } from '../src/systems/court.js';
import { WEAPON_REACH } from '../src/combat/playerWeapon.js';
import { DEFAULT_ACTIVATION_DISTANCE } from '../src/player/activate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const WM = read('src/scenes/worldModes.js');
/** ActivateStaticDoor's building block, matched not counted. */
const ARM = WM.slice(WM.indexOf('let isBrokenIn = isBash;'), WM.indexOf('return enterInteriorCore(hit, entries);'));

// ---------------------------------------------------------------
// The rolls themselves (:570-583, :621-627)
// ---------------------------------------------------------------

test('ROAD-B: the bash chance is 25 - buildingLockValue, and a rich door can never be bashed', () => {
  // GetBuildingLockValue is quality / 2 (PlayerActivate.cs:653-660), so
  // the bash chance is 25 - quality/2: a hovel (quality 0) opens one
  // time in four, and anything of quality 50 or better never opens at
  // all - `Dice100.FailedRoll(0)` is always true.
  assert.equal(buildingLockValue(0), 0);
  assert.equal(25 - buildingLockValue(0), 25);
  assert.equal(25 - buildingLockValue(50), 0);
  // Dice100.SuccessRoll(chance) is Range(0,100) < chance, which is what
  // the port's dice100 answers - so chance 0 never succeeds and the
  // FailedRoll DFU tests is therefore always true.
  assert.equal(dice100(0, 0), false);
  assert.equal(dice100(25, 0.24), true);
  assert.equal(dice100(25, 0.25), false, 'the edge is exclusive');
});

test('ROAD-B: the two crimes are the ATTEMPT and the deed, and they are different rows', () => {
  assert.equal(CRIMES.Attempted_Breaking_And_Entering, 1);
  assert.equal(CRIMES.Breaking_And_Entering, 3);
});

test('ROAD-B: the swing\'s reach is the WEAPON\'s, which is inside the door activation distance', () => {
  // DFU's bash `hit` comes from WeaponManager's own SphereCast at
  // weapon.Reach (:1064), not from the activation ray - so
  // ActivateStaticDoor's "you are too far away" refusal (:500-504) is
  // unreachable on this path, which is why it is not re-tested there.
  assert.ok(WEAPON_REACH < DEFAULT_ACTIVATION_DISTANCE);
});

// ---------------------------------------------------------------
// ActivateStaticDoor's isBash ladder
// ---------------------------------------------------------------

test('ROAD-B: ActivateStaticDoor is one member with two callers, as C# has it', () => {
  assert.match(WM, /async function activateStaticDoor\(hit, entries, isBash = false\) \{/);
  assert.match(WM, /return activateStaticDoor\(entries\[key\], entries, false\);/, 'the click, isBash false');
  assert.match(WM, /activateStaticDoor\(hit, entries, true\)\.catch/, 'the swing, isBash true');
  // :507-509 - the bash sound, before the type routing, every door but
  // a dungeon exit, from the PLAYER (PlayerActivate's own source).
  const sound = WM.indexOf("if (isBash && hit.door.doorType !== DOOR_TYPE.DUNGEON_EXIT) audio.playOneShot(SOUND.PlayerDoorBash, 1);");
  const route = WM.indexOf('if (hit.door.doorType === DOOR_TYPE.DUNGEON_ENTRANCE) return tryEnterDungeon(');
  assert.ok(sound > 0 && route > sound, 'the sound precedes the type routing');
});

test('ROAD-B: a bash skips the Open spell, the mode ladder and the Lockpicking tally', () => {
  // :519-520 `!buildingUnlocked && !isBash && HandleOpenEffect...`
  assert.match(ARM, /if \(!opened && !isBash\) \{\n\s*const spell = doorSpellFor\(playerEntity\);/,
    'a swing never spends the readied Open spell');
  // :523-524 `if (!buildingUnlocked && !isBash)` wraps the WHOLE
  // refusal / steal-pick ladder, so a swing trains nothing and never
  // touches the anti-grind record.
  assert.match(ARM, /if \(!opened && !isBash\) \{\n\s*const lockpick = skillValue\(playerEntity, SKILLS\.Lockpicking\);/);
  const tally = ARM.indexOf('tallySkill(playerEntity, SKILLS.Lockpicking, 1);');
  const ladder = ARM.indexOf('if (!opened && !isBash) {\n          const lockpick');
  assert.ok(ladder > 0 && tally > ladder, 'the tally is inside the ladder the bash skips');
});

test('ROAD-B: the failed bash consumes the swing and only 10% of them are noticed', () => {
  const i = ARM.indexOf('if (isBash && !opened) {');
  assert.ok(i > 0);
  const bashArm = ARM.slice(i, ARM.indexOf('// BG1: the greeting (:585-628)'));
  // the nested roll: the crime is levied only when someone notices
  const outer = bashArm.indexOf('if (!dice100(25 - lockValue, Math.random())) {');
  const inner = bashArm.indexOf('if (dice100(10, Math.random())) {');
  assert.ok(outer >= 0 && inner > outer, 'the 10% notice is INSIDE the failed roll');
  assert.match(bashArm, /setCrimeCommitted\(playerEntity, CRIMES\.Attempted_Breaking_And_Entering\)/);
  assert.match(bashArm, /host\.spawnCityGuards\?\.\(true\);/, 'and the watch is called immediately');
  // :582 - the failure RETURNS; the player does not get in.
  assert.ok(bashArm.indexOf('return true;') > inner, 'a failed bash does not enter the building');
  // ...and the arm is ahead of the greeting, where C# has it.
  assert.ok(i < ARM.indexOf('// BG1: the greeting (:585-628)'));
});

test('ROAD-B: the second arm sits inside the greeting block, AFTER the deferring box', () => {
  const box = ARM.indexOf('townTalk.showOverlay(new ChoiceWindow({ lines })');
  const arm2 = ARM.indexOf('if (isBash && dice100(10, Math.random())) {');
  assert.ok(box > 0 && arm2 > box,
    'a bash that raised a greeting popup returns before the roll, exactly as :617-627 orders it');
  assert.match(ARM.slice(arm2), /setCrimeCommitted\(playerEntity, CRIMES\.Breaking_And_Entering\);/);
  // and it is the LAST thing before the transition
  assert.ok(arm2 < ARM.length);
});

// ---------------------------------------------------------------
// THE INPUT
// ---------------------------------------------------------------

test('ROAD-B: attemptExteriorDoorBash is a DOOR-only ray at weapon reach, exterior only', () => {
  const fn = WM.slice(WM.indexOf('function attemptExteriorDoorBash(eye, dir) {'),
    WM.indexOf('/** IS1: TransitionInterior\'s shared core'));
  assert.match(fn, /if \(mode !== 'exterior'\) return false;/);
  assert.match(fn, /distance: WEAPON_REACH/, 'the SWING\'s reach, not the click\'s');
  assert.ok(!fn.includes('npcTargets'), 'street NPCs are in the activation ray, not the weapon\'s');
  assert.ok(!fn.includes('boardTargets'), 'and so are the bulletin boards');
  // AttemptExteriorDoorBash returns `door.doorType != DungeonExit`
  assert.match(fn, /return hit\.door\.doorType !== DOOR_TYPE\.DUNGEON_EXIT;/);
  assert.match(WM, /^ {4}attemptExteriorDoorBash,/m, 'and the host can reach it');
});

test('ROAD-B: both exterior hosts offer a missed swing to the doors before ringing the miss', () => {
  for (const [host, ray] of [['src/scenes/world.js', 'cam.pos, lookFwd'], ['src/scenes/exterior.js', 'eye, fwd']]) {
    const s = read(host);
    assert.ok(s.includes(`else if (!modes?.attemptExteriorDoorBash?.(${ray})) audio.playOneShot(swingSoundFor(weaponRig.playerWeapon.weapon), 1.1);`),
      `${host}: the door arm runs on the no-enemy swing, and a consumed swing rings nothing`);
    // ...and the old unconditional miss sound is gone
    assert.ok(!s.includes('else audio.playOneShot(swingSoundFor(weaponRig.playerWeapon.weapon), 1.1);'),
      `${host}: the miss sound is no longer unconditional`);
  }
});
