// AUDIT 23 fix pins, wave 3: the combat cluster.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { CLASSIC_UPDATE_INTERVAL, BOW_SOUND_FRAME, HIT_FRAME_BOW, getBowCooldownTime } from '../src/characters/weaponStates.js';
import { SOUND } from '../src/systems/soundClips.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const SHORT_BOW = { name: 'Short Bow', templateIndex: 129 };
const SABER = { name: 'Saber', templateIndex: 117 };

test('AUDIT 23 combat-2: a wielded bow engages the bow machine - forced direction, 0.0625 clock, sound@4, loose@5, cooldown', () => {
  const pw = new PlayerWeapon({ weapon: SHORT_BOW, liveSpeed: 50 });
  pw.sheathed = false;
  pw.update(0);
  assert.equal(pw.machine.isBow, true, 'isBow reads off the wielded weapon');

  // WeaponManager.cs:355-358: no swing tracking - the attack input
  // fires StrikeDown on the RISING edge only.
  assert.equal(pw.gesture(0, 0, true, 1 / 60, 1000), 'StrikeDown', 'no travel needed');
  assert.equal(pw.gesture(0, 0, true, 1 / 60, 1000), null, 'held: no re-fire without release');

  // The release runs on the classic 0.0625 tick with the bow frames.
  const events = [];
  for (let i = 0; i < 200 && !events.includes('done'); i++) {
    for (const ev of pw.update(CLASSIC_UPDATE_INTERVAL)) events.push(ev);
  }
  assert.ok(events.includes('bowSound'), `frame ${BOW_SOUND_FRAME} sound event`);
  assert.ok(events.includes('hit'), `frame ${HIT_FRAME_BOW} loose event`);
  assert.ok(events.indexOf('bowSound') < events.indexOf('hit'), 'sound precedes the loose');
  assert.ok(pw.machine.cooldownUntil > pw.machine.now - 1e-9, 'GetBowCooldownTime armed at done');
  assert.ok(Math.abs((pw.machine.cooldownUntil - pw.machine.now) - getBowCooldownTime(50)) < 0.07,
    'the cooldown is the formula value');

  // Released + re-held during cooldown: still no shot.
  pw.gesture(0, 0, false, 1 / 60, 1000);
  assert.equal(pw.gesture(0, 0, true, 1 / 60, 1000), null, 'cooldown blocks the next rise');

  // clickAttack is the same forced shot, not a random melee direction.
  const pw2 = new PlayerWeapon({ weapon: SHORT_BOW, liveSpeed: 50 });
  pw2.update(0);
  assert.equal(pw2.clickAttack(() => 0.99), 'StrikeDown');
});

test('AUDIT 23 combat-2: swapping to a melee weapon disengages the bow machine', () => {
  const pw = new PlayerWeapon({ weapon: SHORT_BOW, liveSpeed: 50 });
  pw.update(0);
  assert.equal(pw.machine.isBow, true);
  pw.weapon = SABER;
  pw.update(0);
  assert.equal(pw.machine.isBow, false);
  // ...and the melee gesture path is back (travel threshold applies).
  assert.equal(pw.gesture(0, 0, true, 1 / 60, 1000), null, 'no travel, no melee strike');
});

test('AUDIT 23 combat-6: the melee swing resolves EVERY foe in reach, not the first', () => {
  // WeaponManager.cs:917 OverlapBox + :1051-1055 foreach.
  const pw = new PlayerWeapon({ weapon: SABER, liveSpeed: 50 });
  const entity = () => ({
    level: 1, skills: new Array(35).fill(30), stats: { strength: 50, agility: 50, luck: 50 },
    items: [], isPlayer: true,
  });
  const foes = [
    { entity: { ...entity(), isPlayer: false }, ai: {} },
    { entity: { ...entity(), isPlayer: false }, ai: {} },
    { dead: true, entity: { ...entity(), isPlayer: false }, ai: {} },
  ];
  const results = pw.resolveHit(foes, entity(), () => ({ dist: 1, inView: true, losClear: true }), () => 0.5);
  assert.equal(results.length, 2, 'both live foes resolve; the dead one skips');
});

test('AUDIT 23 combat-14: foes resolve before the environment; env is the no-entity fallback', () => {
  // WeaponManager.cs:1048-1064 - the else arm is the only
  // WeaponEnvDamage path.
  const dc = src('src/scenes/dungeonContext.js');
  const fn = dc.slice(dc.indexOf('function resolvePlayerHit'), dc.indexOf('// S3b: the classic clock'));
  const envIdx = fn.indexOf('if (!hitEnemy && lookDir) envAttack');
  const loopIdx = fn.indexOf('playerWeapon.resolveHit');
  assert.ok(loopIdx > 0 && envIdx > loopIdx, 'the env fallback sits after the foe loop');
  assert.equal(/Verbatim WeaponEnvDamage FIRST/.test(fn), false, 'the env-first claim is gone');
});

test('AUDIT 23 C9/combat-2: the hosts own the swing sounds - whiff whoosh at hit frame, ArrowShoot at bow frame 4', () => {
  assert.equal(SOUND.ArrowShoot, 3, 'SoundClips.ArrowShoot');
  const rig = src('src/combat/weaponRig.js');
  assert.equal(/startsWith\('Strike'\)\) audio\.playOneShot\(swingSoundFor/.test(rig), false,
    'the rig strike-entry whoosh is gone');
  const dc = src('src/scenes/dungeonContext.js');
  assert.ok(dc.includes("if (ev === 'bowSound') { audio.playOneShot(SOUND.ArrowShoot, 1.1); continue; }"),
    'dungeon: bow frame-4 sound');
  assert.ok(dc.includes('else audio.playOneShot(swingSoundFor(playerWeapon.weapon), 1.1);'),
    'dungeon: no-enemy swing sound at the hit frame');
  const wm = src('src/scenes/worldModes.js');
  assert.ok(wm.includes("if (ev === 'bowSound') { audio.playOneShot(SOUND.ArrowShoot, 1.1); continue; }"),
    'interior: bow frame-4 sound');
  assert.ok(wm.includes('audio.playOneShot(swingSoundFor(interiorWeapon.playerWeapon.weapon), 1.1);'),
    'interior: the no-enemy swing sound');
});
