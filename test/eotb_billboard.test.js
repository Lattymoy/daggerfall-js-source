import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STATE_TABLES, RECORD_OFFSETS, MIRRORED, ORIENTATIONS, ANGLE_PER_ORIENTATION, TABLE_FRAMES, frameCount,
  ARCHIVE_FOOT, ARCHIVE_HORSE, ARCHIVE_LYCAN, lycanArchive, tableArchive,
  stateFor, roundToInt, orientationFor, signedAngleY, facingFor, frameTime, speedMod, isFootstepFrame,
  FRAME_TIME_ON_FOOT, FRAME_TIME_RIDING, chooseTable, deathTable, spriteKey, GALLOP_SPEED,
  STRING, meleeAnimTickTime, usesPingPong, pingPongFrames, forwardFrames, holdDrawFrames, pingPongTickFrames,
  mirrorFlips, MIRROR_TABLES, mirrorRevertTime, autoToggleRows, DELAYED_FRAMES, ORIENTATION_TIME,
} from '../src/player/eotbBillboard.js';

// ═══ EOTB3: THE PLAYER BILLBOARD ══════════════════════════════════
//
// The body you see in third person when you have no Morrowind data
// (Mac: "This is moreso for those who opt out of using morrowind").
// EOTB-IL (2026-09-17): every law below is read off the assembly, and
// the two Mac reported - the chop and the turn - are the first two
// pins after the table.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = JSON.parse(readFileSync(join(root, 'vendor/eye-of-the-beholder/states.json'), 'utf8'));
const TEX = join(root, 'vendor/eye-of-the-beholder/Textures');

test('EOTB3: the GENERATED table is the mod’s own - all 168 states, checked not claimed', () => {
  // THE PIN THIS SLICE EXISTS FOR. The port carries 21 base records and
  // one wheel; the mod carries 168 written-out states. The claim that
  // those are the same thing is worth exactly nothing as a sentence in
  // a comment, so the mod's table is vendored out of the IL and the
  // port's is generated and compared, state for state, forever.
  const names = Object.keys(bundle.tables);
  assert.equal(names.length, 21, 'the bundle builds 21 tables');
  assert.deepEqual(names.sort(), Object.keys(STATE_TABLES).sort(), 'and the port knows the same 21');

  let checked = 0;
  for (const [table, states] of Object.entries(bundle.tables)) {
    assert.equal(states.length, ORIENTATIONS, `${table} has eight orientations`);
    for (let i = 0; i < states.length; i++) {
      const got = stateFor(table, i);
      assert.equal(got.record, states[i].record, `${table}[${i}] record`);
      assert.equal(got.mirror, states[i].mirror, `${table}[${i}] mirror`);
      assert.equal(got.frames, states[i].frames, `${table}[${i}] the ctor's ignored fourth argument`);
      checked++;
    }
  }
  assert.equal(checked, 168, 'every state the bundle ships was compared, not a sample');
});

test('EOTB-IL: THE CHOP - the clip lengths are the ART’s, counted per record over all 23 archives, and an idle is ONE frame', () => {
  // Mac: "Frame chopping between animations". The port ran every table
  // on a five-frame clock; the bundle's records are not five frames.
  // `InitializeTextures` counts `archive_record-i` while the bundle has
  // one (IL_5a70-IL_5ad4), so the count is asked of the vendored files
  // - every archive, every record - and compared with TABLE_FRAMES.
  const counts = new Map();   // archive -> record -> frames
  for (const arch of readdirSync(TEX)) {
    const per = new Map();
    for (const f of readdirSync(join(TEX, arch))) {
      const m = /^(\d+)_(\d+)-(\d+)\.png$/.exec(f);
      if (!m) continue;
      per.set(+m[2], (per.get(+m[2]) ?? 0) + 1);
    }
    counts.set(+arch, per);
  }
  assert.equal(counts.size, 23, 'the 23 archives');
  const kinds = { foot: [], horse: [], lycan: [] };
  for (const a of counts.keys()) {
    if (a >= ARCHIVE_HORSE && a <= ARCHIVE_HORSE + 4) kinds.horse.push(a);
    else if (a === ARCHIVE_LYCAN || a === ARCHIVE_LYCAN + 1) kinds.lycan.push(a);
    else kinds.foot.push(a);
  }
  assert.deepEqual([kinds.foot.length, kinds.horse.length, kinds.lycan.length], [16, 5, 2]);
  let asked = 0;
  for (const table of Object.keys(STATE_TABLES)) {
    const archives = table.endsWith('Horse') ? kinds.horse : table.endsWith('Lycan') ? kinds.lycan : kinds.foot;
    for (const a of archives) {
      for (let o = 0; o < ORIENTATIONS; o++) {
        const { record } = stateFor(table, o);
        assert.equal(counts.get(a).get(record), frameCount(table), `${table} record ${record} in ${a}: the art's frame count`);
        asked++;
      }
    }
  }
  assert.equal(asked, 12 * 8 * 16 + 3 * 8 * 5 + 6 * 8 * 2, 'every table over every archive of its kind - 1752 asks');
  // the shape a reader should carry: idle ONE, walk four, death two,
  // the swing six - and never five anywhere
  assert.equal(TABLE_FRAMES.Idle, 1);
  assert.equal(TABLE_FRAMES.Move, 4);
  assert.equal(TABLE_FRAMES.Death, 2);
  assert.equal(TABLE_FRAMES.AttackMelee, 6);
  assert.equal(TABLE_FRAMES.MoveHorse, 8);
  assert.equal(TABLE_FRAMES.AttackMeleeLycan, 3);
  assert.ok(!Object.values(TABLE_FRAMES).includes(5), 'no table is five frames - the number the old clock assumed for all of them');
  assert.equal(frameCount('NotATable'), 1, 'an unknown table is one frame, never zero');
});

test('EOTB3: the wheel is the CLASSIC one - five records, the right half flipped', () => {
  assert.deepEqual([...RECORD_OFFSETS], [0, 1, 2, 3, 4, 3, 2, 1], 'front to back, then back out the other side');
  assert.deepEqual([...MIRRORED], [false, true, true, true, false, false, false, false],
    'the LEFT half is drawn flipped; forward and backward are drawn straight');
  for (let i = 1; i < 4; i++) {
    const twin = ORIENTATIONS - i;
    assert.equal(RECORD_OFFSETS[i], RECORD_OFFSETS[twin], `${i} and ${twin} draw the same record`);
    assert.notEqual(MIRRORED[i], MIRRORED[twin], '...one flipped, one not');
  }
  assert.equal(ANGLE_PER_ORIENTATION, 45);
});

test('EOTB3: every sprite the table asks for is a sprite the bundle actually ships', () => {
  const missing = [];
  let asked = 0;
  for (const table of Object.keys(STATE_TABLES)) {
    for (let o = 0; o < ORIENTATIONS; o++) {
      const { record } = stateFor(table, o);
      const archive = tableArchive(table, { onFoot: 0, onHorse: 0, lycanthropyType: 1 });
      for (let f = 0; f < frameCount(table); f++) {
        const file = join(TEX, String(archive), `${spriteKey(archive, record, f)}.png`);
        asked++;
        if (!existsSync(file)) missing.push(`${table}[${o}] -> ${spriteKey(archive, record, f)}`);
      }
    }
  }
  assert.ok(asked > 168, 'the sweep really ran over every state and every frame');
  assert.deepEqual(missing, [], 'every frame of every state is in the vendored art');
});

test('EOTB3: every on-foot and horse archive the settings can pick is present', () => {
  for (let i = 0; i <= 15; i++) assert.ok(existsSync(join(TEX, String(ARCHIVE_FOOT + i))), `OnFoot ${i}`);
  for (let i = 0; i <= 4; i++) assert.ok(existsSync(join(TEX, String(ARCHIVE_HORSE + i))), `OnHorse ${i}`);
  assert.equal(tableArchive('Idle', { onFoot: 7 }), ARCHIVE_FOOT + 7);
  assert.equal(tableArchive('GallopHorse', { onHorse: 3 }), ARCHIVE_HORSE + 3);
});

test('EOTB3: the wereboar is the SECOND lycan archive, and everything else is the first', () => {
  assert.equal(lycanArchive(2), ARCHIVE_LYCAN + 1, 'Wereboar');
  assert.equal(lycanArchive(1), ARCHIVE_LYCAN, 'Werewolf');
  assert.equal(lycanArchive(0), ARCHIVE_LYCAN, 'none');
  assert.equal(lycanArchive(3), ARCHIVE_LYCAN, 'a value past the table is not the boar');
  assert.equal(tableArchive('MoveLycan', { lycanthropyType: 2 }), ARCHIVE_LYCAN + 1);
});

test('EOTB3: RoundToInt is UNITY’s, not JavaScript’s - a half goes to the even side', () => {
  assert.equal(roundToInt(0.5), 0, 'JS Math.round says 1');
  assert.equal(roundToInt(1.5), 2);
  assert.equal(roundToInt(2.5), 2, 'JS Math.round says 3');
  assert.equal(roundToInt(-0.5), 0);
  assert.equal(roundToInt(-1.5), -2);
  assert.equal(roundToInt(-2.5), -2);
  for (const h of [0.5, 2.5, 4.5, -1.5, -3.5]) assert.notEqual(roundToInt(h), Math.round(h), `${h}: Unity and JS must differ here`);
});

test('EOTB-IL: THE TURN - the angle is measured FROM the camera TO the facing, so the camera off the player’s left shows their left side', () => {
  // Mac: "Sprite turns in wrong direction on input". `UpdateOrientation`
  // is `SignedAngle(toCamera, facing, up)` (IL_4779-IL_4786), negated
  // and snapped; the port had the two arguments swapped, which negates
  // the angle and runs the wheel BACKWARDS.
  const N = [0, 0, 1];   // the sprite faces +z
  assert.equal(orientationFor(N, [0, 0, 1]), 0, 'camera dead ahead: the forward record');
  assert.equal(orientationFor(N, [0, 0, -1]), 4, 'camera behind: the backward record');
  // the camera off the player's LEFT (-x, in the port's left-handed
  // y-up frame where forward is +z and right is +x): the angle from the
  // camera vector to the facing is +90, so the index is -2 -> 6, the
  // record the mod names IdleRight, drawn straight; off the right it is
  // 2, IdleLeft, the mirrored one. The NAMES are the mod's (the same
  // wheel DFU's own MobileUnit.OrientEnemy turns, which the port's
  // characters/mobileUnit.js already runs for every foe); the arithmetic
  // is what the pin holds
  assert.equal(orientationFor(N, [-1, 0, 0]), 6, 'camera off the left: index 6');
  assert.equal(orientationFor(N, [1, 0, 0]), 2, 'camera off the right: index 2, the mirrored record');
  assert.equal(stateFor('Idle', 2).mirror, true, 'and 2 IS the flipped one');
  // THE WRONG WAY ROUND, spelled out so it cannot come back: the sprite
  // facing +x with the camera behind it at -z is index 2 - the old
  // port answered 6 and drew every side view from the other side
  assert.equal(orientationFor([1, 0, 0], [0, 0, -1]), 2, 'facing +x with the camera behind: index 2');
  assert.equal(signedAngleY([0, 0, -1], [1, 0, 0]), -90, 'the angle itself, from the camera vector to the facing');
  assert.equal(signedAngleY([0, 0, 1], [1, 0, 0]), 90);
  // the zero vector answers 0 - Unity's Angle with a vanished
  // denominator - which is the first-person billboard's whole orientation
  assert.equal(signedAngleY([0, 0, 0], [1, 0, 0]), 0);
  assert.equal(orientationFor([1, 0, 0], [0, 0, 0]), 0, 'a camera ON the player reads the front record');
  for (let deg = 0; deg < 360; deg += 3) {
    const r = deg * Math.PI / 180;
    const o = orientationFor(N, [Math.sin(r), 0, Math.cos(r)]);
    assert.ok(Number.isInteger(o) && o >= 0 && o < ORIENTATIONS, `${deg} deg -> ${o}`);
  }
  // and it is Unity's snap, through RoundToInt (the exact half is pinned
  // on roundToInt itself above - atan2 cannot hand this one an exact
  // 22.5): a hair inside the half stays 0, a hair past it turns
  assert.equal(orientationFor(N, [Math.sin(22.4 * Math.PI / 180), 0, Math.cos(22.4 * Math.PI / 180)]), 0);
  assert.equal(orientationFor(N, [Math.sin(22.6 * Math.PI / 180), 0, Math.cos(22.6 * Math.PI / 180)]), 1);
});

test('EOTB-IL: the FACING - TurnToView’s ladder, the floating override, and lastMoveDirection as the last facing', () => {
  const cam = [0, 0, 1], move = [1, 0, 0], last = [0, 0, -1];
  // Always
  assert.deepEqual(facingFor({ turnToView: 3 }, move, last, cam), cam);
  // WhenWeaponReadied (shipped): animating or readied faces the camera; else the move; stopped, the last facing
  assert.deepEqual(facingFor({ turnToView: 2, animating: true }, move, last, cam), cam);
  assert.deepEqual(facingFor({ turnToView: 2, sheathed: false, stopped: false }, move, last, cam), cam);
  assert.deepEqual(facingFor({ turnToView: 2, spellcasting: true, stopped: false }, move, last, cam), cam);
  assert.deepEqual(facingFor({ turnToView: 2, stopped: false }, move, last, cam), move);
  assert.deepEqual(facingFor({ turnToView: 2, stopped: true }, move, last, cam), last);
  // OnlyWhenAnimating
  assert.deepEqual(facingFor({ turnToView: 1, animating: true, stopped: false }, move, last, cam), cam);
  assert.deepEqual(facingFor({ turnToView: 1, sheathed: false, stopped: false }, move, last, cam), move, 'a readied weapon is not a reason here');
  // Never
  assert.deepEqual(facingFor({ turnToView: 0, animating: true, stopped: false }, move, last, cam), move);
  assert.deepEqual(facingFor({ turnToView: 0, stopped: true }, move, last, cam), last);
  // floating (levitating or swimming) faces the camera whatever the option says (IL_4622-IL_4628)
  assert.deepEqual(facingFor({ turnToView: 0, floating: true, stopped: false }, move, last, cam), cam);
  // no move and no last facing: the camera's forward stands in (IL_45d8-IL_4610)
  assert.deepEqual(facingFor({ turnToView: 0, stopped: false }, [0, 0, 0], null, cam), cam);
  assert.deepEqual(facingFor({ turnToView: 0, stopped: false }, null, last, cam), last, 'no move: the last facing');
  // the answer is flattened
  assert.deepEqual(facingFor({ turnToView: 3 }, move, last, [0, 0.7, 0.7]), [0, 0, 0.7]);
});

test('EOTB3: the frame clock is four a second on foot, sixteen mounted, the dial reads forwards, and the speed modifier is the IL’s', () => {
  assert.equal(frameTime(false, 1), FRAME_TIME_ON_FOOT, 'a quarter second a frame - classic’s own 4 fps');
  assert.equal(frameTime(true, 1), FRAME_TIME_RIDING, 'and 16 a second in the saddle');
  assert.ok(frameTime(false, 1.5) < frameTime(false, 1), 'a faster setting is a shorter frame');
  assert.equal(frameTime(false, 1.5), 0.25 * 0.5);
  // IL_41d4-IL_422a: a run halves, a crouch doubles, a sneak doubles, and they multiply
  assert.equal(speedMod({}), 1);
  assert.equal(speedMod({ running: true }), 0.5);
  assert.equal(speedMod({ crouching: true }), 2);
  assert.equal(speedMod({ sneaking: true }), 2);
  assert.equal(speedMod({ crouching: true, sneaking: true }), 4);
  assert.equal(speedMod({ running: true, crouching: true }), 1);
  // IL_4244-IL_4264: a foot lands on every second frame on foot, every fourth mounted
  assert.deepEqual([0, 1, 2, 3].filter((f) => isFootstepFrame(f)), [0, 2]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].filter((f) => isFootstepFrame(f, true)), [0, 4]);
  assert.equal(DELAYED_FRAMES, 3, 'UpdateBillboardDelayed waits three frames');
  assert.equal(ORIENTATION_TIME, 0.1, 'UpdateOrientation runs at most ten times a second');
});

test('EOTB-IL: chooseTable is LoopIdleBillboard’s (IL_4328-IL_4499) - three lycan tables, no death arm, the gallop a SPEED', () => {
  const T = (s) => chooseTable(s);
  // transformed: stopped picks by the sheath, moving is MoveLycan whatever is drawn; ReadyStance never asked
  assert.equal(T({ transformed: true, stopped: true }), 'IdleLycan');
  assert.equal(T({ transformed: true, stopped: true, sheathed: false }), 'IdleMeleeLycan');
  assert.equal(T({ transformed: true, stopped: true, sheathed: false, readyStance: 0 }), 'IdleMeleeLycan', 'ReadyStance is not consulted for a lycanthrope');
  assert.equal(T({ transformed: true, stopped: false, sheathed: false }), 'MoveLycan', 'a moving lycanthrope is never MoveMeleeLycan');
  assert.equal(T({ transformed: true, riding: true, stopped: false }), 'MoveLycan', 'transformed beats the saddle');
  // death is NOT a loop table - PlayDeathAnimation is a one-shot and LateUpdate returns while died holds
  assert.equal(T({ died: true, stopped: true }), 'Idle');
  assert.equal(deathTable({}), 'Death');
  assert.equal(deathTable({ transformed: true }), 'DeathLycan');
  // mounted: the gallop is |MoveDirection.xz| > 10, which a horse clears at a walk and a cart never does
  assert.equal(T({ riding: true, stopped: true }), 'IdleHorse');
  assert.equal(T({ riding: true, stopped: false, moveSpeed: 7.6 }), 'MoveHorse', 'the cart (SPD 50: 7.6 m/s)');
  assert.equal(T({ riding: true, stopped: false, moveSpeed: 10.8 }), 'GallopHorse', 'the horse (SPD 50: 10.8 m/s)');
  assert.equal(T({ riding: true, stopped: false, moveSpeed: GALLOP_SPEED }), 'MoveHorse', 'exactly 10 is not past it');
  assert.equal(T({ riding: true, stopped: false, moveSpeed: 20, sheathed: false }), 'GallopHorse', 'the saddle beats a drawn weapon');
  // on foot, by what is readied
  assert.equal(T({ stopped: true }), 'Idle');
  assert.equal(T({ stopped: false }), 'Move');
  assert.equal(T({ stopped: true, sheathed: false }), 'IdleMelee');
  assert.equal(T({ stopped: false, sheathed: false }), 'MoveMelee');
  assert.equal(T({ stopped: true, sheathed: false, usingBow: true }), 'IdleRanged');
  assert.equal(T({ stopped: false, sheathed: false, usingBow: true }), 'MoveRanged');
  assert.equal(T({ stopped: true, spellcasting: true }), 'IdleSpell');
  assert.equal(T({ stopped: false, spellcasting: true, sheathed: false }), 'MoveSpell', 'a readied spell beats a drawn blade');
});

test('EOTB3: ReadyStance decides WHEN a drawn weapon shows, and 1 really does drop it while moving', () => {
  const drawn = { sheathed: false };
  assert.equal(chooseTable({ ...drawn, stopped: true, readyStance: 0 }), 'Idle', 'never');
  assert.equal(chooseTable({ ...drawn, stopped: false, readyStance: 0 }), 'Move');
  assert.equal(chooseTable({ ...drawn, stopped: true, readyStance: 1 }), 'IdleMelee', 'when idle');
  assert.equal(chooseTable({ ...drawn, stopped: false, readyStance: 1 }), 'Move', '...and NOT while moving');
  assert.equal(chooseTable({ ...drawn, stopped: true, readyStance: 2 }), 'IdleMelee', 'idle or moving');
  assert.equal(chooseTable({ ...drawn, stopped: false, readyStance: 2 }), 'MoveMelee');
  assert.equal(chooseTable({ stopped: true, spellcasting: true, readyStance: 0 }), 'Idle', 'the spell stance is gated by it too');
});

test('EOTB-IL: the one-shots’ arithmetic - the melee tick, PingPong’s order and its every-fourth under Mixed, the hold’s draw', () => {
  // GetMeleeAnimTickTime (IL_545c-IL_549c): the weapon's frame time times five over the clip's frames
  assert.equal(meleeAnimTickTime(0.2, 6), 0.2 * 5 / 6);
  assert.equal(meleeAnimTickTime(0.2, 5), 0.2, 'a five-frame clip runs at the weapon’s own tick');
  // PlayMeleeAttackAnimation's choice (IL_507c-IL_509f)
  assert.equal(usesPingPong(STRING.PingPong, 3), true);
  assert.equal(usesPingPong(STRING.Mirror, 0), false);
  assert.equal(usesPingPong(STRING.None, 0), false);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => usesPingPong(STRING.Mixed, n)),
    [true, false, false, false, true, false, false, false, true], 'Mixed: the first swing and every fourth after it - never a coin toss');
  // the ping-pong order (IL_5e45-IL_5f21): forward while i < n/2 + offset, then back down to 1
  assert.deepEqual(pingPongFrames(6, 1), [0, 1, 2, 3, 3, 2, 1], 'the six-frame swing at the shipped offset');
  assert.deepEqual(pingPongFrames(5, 1), [0, 1, 2, 2, 1]);
  assert.deepEqual(pingPongFrames(6, 0), [0, 1, 2, 2, 1]);
  assert.deepEqual(pingPongFrames(6, 3), [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1]);
  assert.deepEqual(pingPongFrames(6, -3), [], 'an offset that empties the forward run empties the clip');
  assert.equal(pingPongTickFrames(6, 1), 7, 'and its tick is spread over the frames it shows');
  assert.deepEqual(forwardFrames(4), [0, 1, 2, 3]);
  // the hold's draw (IL_5fa5-IL_6020): decremented before it is shown - n-2 down to 0, then held on 0
  assert.deepEqual(holdDrawFrames(4), [2, 1, 0]);
  assert.deepEqual(holdDrawFrames(1), []);
});

test('EOTB-IL: the Mirror string flips the FRONT and BACK records of twelve tables while the count is odd - not the whole clip', () => {
  assert.equal(MIRROR_TABLES.size, 12);
  assert.ok(!MIRROR_TABLES.has('AttackRanged') && !MIRROR_TABLES.has('IdleHorse') && !MIRROR_TABLES.has('Death'), 'the loose, the saddle and the death never mirror');
  assert.equal(mirrorFlips(STRING.Mirror, 'Idle', 0, 1), true);
  assert.equal(mirrorFlips(STRING.Mirror, 'Idle', 4, 1), true);
  assert.equal(mirrorFlips(STRING.Mirror, 'Idle', 2, 1), false, 'a side view keeps the wheel’s own flip');
  assert.equal(mirrorFlips(STRING.Mirror, 'Idle', 0, 2), false, 'an even count is unmirrored');
  assert.equal(mirrorFlips(STRING.Mixed, 'AttackMelee', 0, 3), true);
  assert.equal(mirrorFlips(STRING.PingPong, 'AttackMelee', 0, 1), false, 'PingPong alone never mirrors');
  assert.equal(mirrorFlips(STRING.None, 'AttackMelee', 0, 1), false);
  assert.equal(mirrorFlips(STRING.Mirror, 'AttackRanged', 0, 1), false);
  // the revert clock (IL_3cd1-IL_3d18): MirrorTime, or a tenth of a second for the first-person billboard
  assert.equal(mirrorRevertTime(3, false), 3);
  assert.equal(mirrorRevertTime(3, true), 0.1);
});

test('EOTB-IL: LateUpdate’s auto-toggle is three independent blocks and a fan-out (IL_1847-IL_1c6e), not one situation', () => {
  const still = { transformed: false, riding: false, spellcasting: false, sheathed: true, ranged: false };
  // THE FIRST FRAME: the mod's five fields initialise FALSE, and a
  // player starts sheathed, so `isSheathedPrevious != Sheathed` fans out
  // to OnFoot on the very first LateUpdate - the mod's own quirk, kept
  assert.deepEqual(autoToggleRows(still, null), ['OnFoot'], 'the first frame against the mod’s all-false fields: the sheath "changed"');
  assert.deepEqual(autoToggleRows({ ...still, sheathed: false }, null), [], 'and a player who starts DRAWN matches the all-false fields: nothing fires');
  assert.deepEqual(autoToggleRows(still, still), []);
  // drawing a weapon: the sheathed flag changed -> the drawn fan-out
  assert.deepEqual(autoToggleRows({ ...still, sheathed: false }, still), ['OnFootMelee']);
  assert.deepEqual(autoToggleRows({ ...still, sheathed: false, ranged: true }, still), ['OnFootRanged']);
  // staying drawn while the bow flag changes re-applies the drawn fan-out
  const drawn = { ...still, sheathed: false };
  assert.deepEqual(autoToggleRows({ ...drawn, ranged: true }, drawn), ['OnFootRanged']);
  assert.deepEqual(autoToggleRows(drawn, drawn), []);
  // sheathing
  assert.deepEqual(autoToggleRows(still, drawn), ['OnFoot']);
  // mounting: the horse block, and the fan-out only through `changed` on DISMOUNT
  assert.deepEqual(autoToggleRows({ ...still, riding: true }, still), ['OnHorse']);
  assert.deepEqual(autoToggleRows(still, { ...still, riding: true }), ['OnFoot'], 'dismounting sets changed and fans out');
  assert.deepEqual(autoToggleRows({ ...still, riding: true, sheathed: false }, { ...still, riding: true }), ['OnHorseReady'], 'the saddle with a weapon DRAWN');
  // a readied spell alone is OnFootSpell, even in the saddle - the spell block is independent of riding
  assert.deepEqual(autoToggleRows({ ...still, riding: true, spellcasting: true }, { ...still, riding: true }), ['OnFootSpell'], 'a spellcasting rider takes OnFootSpell, not OnHorseReady');
  assert.deepEqual(autoToggleRows({ ...still, riding: true, spellcasting: true, sheathed: false }, still), ['OnHorse', 'OnFootSpell', 'OnHorseReady'], 'three blocks can all fire in one frame, in the IL’s order');
  // the lycan block
  assert.deepEqual(autoToggleRows({ ...still, transformed: true }, still), ['OnLycan']);
  assert.deepEqual(autoToggleRows(still, { ...still, transformed: true }), ['OnFoot'], 'the change back sets changed');
  // arming the table forces the fan-out this frame (IL_1814)
  assert.deepEqual(autoToggleRows(still, still, { forced: true }), ['OnFoot']);
  assert.deepEqual(autoToggleRows({ ...still, riding: true }, { ...still, riding: true }, { forced: true }), ['OnHorse']);
});

test('EOTB3: the sprite key is the bundle’s own naming', () => {
  assert.equal(spriteKey(112364, 25, 3), '112364_25-3');
  const { record } = stateFor('AttackMelee', 0);
  assert.equal(spriteKey(ARCHIVE_FOOT, record, 0), '112364_25-0');
  assert.ok(existsSync(join(TEX, '112364', '112364_25-5.png')), 'and the swing really has a sixth frame');
  assert.ok(!existsSync(join(TEX, '112364', '112364_0-1.png')), 'and the idle really has no second');
});
