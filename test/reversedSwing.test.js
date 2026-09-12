// MS1 - THE BACKHAND (2026-09-12).
//
// Mac: "classic Daggerfall has a swing animation for left and right
// while Morrowind only has the animation that swings right to left.
// Could we insert a mirrored swing so you're able to swing all
// directions?" - and of a mirror that changed hands: "There must be a
// way to keep it correctly in the correct hand. I'm not okay with the
// honest cost."
//
// Morrowind's slash is one motion, right to left. A StrikeRight plays
// that clip BACKWARDS, section by section, on the same right arm: the
// follow-through reversed carries the arm across to the left (the
// wind-up), the release reversed sweeps the blade left to right, the
// wind-up reversed settles the arm. The sword never changes hands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REVERSED_STRIKES, strikeReversed, DF_STRIKE_TO_MW_ATTACK, attackKeys, MW_SHOOT_ATTACK } from '../src/formats/mwFirstPerson.js';
import { createFpArm, UPPER_BODY } from '../src/combat/fpArm.js';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('MS1: the table - the one strike that runs against Morrowind\'s slash', () => {
  assert.deepEqual([...REVERSED_STRIKES], ['StrikeRight']);
  for (const s of Object.keys(DF_STRIKE_TO_MW_ATTACK)) assert.equal(strikeReversed(s), s === 'StrikeRight', s);
  assert.equal(strikeReversed('StrikeLeft'), false, 'StrikeLeft IS Morrowind\'s slash');
});

test('MS1: attackKeys reversed - the sections in reverse order, each pair still in file order, a shot never', () => {
  const fwd = attackKeys('slash', 1);
  const back = attackKeys('slash', 1, { reversed: true });
  assert.equal(fwd.reversed, false); assert.equal(back.reversed, true);
  assert.deepEqual(back.windUp, fwd.follow, 'the follow-through, backwards, is the wind-up');
  assert.deepEqual(back.release, fwd.release, 'the release, backwards, is the sweep the other way');
  assert.deepEqual(back.follow, fwd.windUp, 'the wind-up, backwards, settles the arm');
  assert.equal(back.hitKey, fwd.hitKey); assert.equal(back.maxAttack, fwd.maxAttack);
  const shot = attackKeys(MW_SHOOT_ATTACK, 1, { reversed: true });
  assert.equal(shot.reversed, false);
  assert.deepEqual(shot.windUp, attackKeys(MW_SHOOT_ATTACK, 1).windUp, 'a bow has one draw');
});

// ── through a real build: the weapon fixture carries the slash keys ──
const wpdtRec = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
};
function deps() {
  const files = new Map([
    ['meshes/xbase_anim.1st.nif', f('armfp.nif')],
    ['meshes/xbase_anim.1st.kf', f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/blade.nif', f('weapon.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const weap = wpdtRec('iron longsword', 'w/blade.nif', 1);
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
  };
}
async function drawnArm() {
  const arm = createFpArm();
  arm.attach({
    gl: null,
    createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: () => 1,
  }, () => ({ pitch: 0 }));
  const res = await arm.build({ race: 'fprace', weapon: { templateIndex: 120 }, deps: deps() });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 80 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped);
  return arm;
}
const keyAt = (arm, name) => {
  const k = arm.built().keys.find((x) => x.text.toLowerCase() === `weapononehand: ${name}`);
  assert.ok(k, `the fixture names "${name}"`);
  return k.time;
};

test('MS1: a right slash runs the clip backwards on the same arm - wind-up from the follow, sweep from hit to max attack, settle from the start', async () => {
  const arm = await drawnArm();
  const t = (n) => keyAt(arm, n);
  const [start, max, hit, fStart, fStop] = ['slash start', 'slash max attack', 'slash hit', 'slash large follow start', 'slash large follow stop'].map(t);
  assert.ok(start < max && max < hit && hit <= fStart && fStart < fStop, 'the fixture orders the slash keys as retail does');

  assert.equal(arm.attack('StrikeRight'), 'slash', 'rule 11: a side slash is Morrowind\'s slash');
  let st = arm.status();
  assert.equal(st.attackReversed, true);
  assert.equal(st.upper, UPPER_BODY.AttackWindUp);
  assert.ok(Math.abs(st.poseTime - fStop) < 1e-6, `the wind-up begins at the follow-through's END (${st.poseTime} vs ${fStop})`);
  // the playhead walks forward, the pose walks backward
  const before = arm.status();
  arm.update(0.02);
  const after = arm.status();
  assert.ok(after.time > before.time, 'the clip state advances');
  assert.ok(after.poseTime < before.poseTime, 'and the pose retreats through the follow-through');
  // run the wind-up out: it ends at the follow's START, and the release
  // begins at the HIT and runs back to max attack
  for (let i = 0; i < 200 && arm.status().upper === UPPER_BODY.AttackWindUp; i++) arm.update(0.05);
  st = arm.status();
  assert.equal(st.upper, UPPER_BODY.AttackRelease, 'uncharged: straight into the release');
  assert.equal(st.attackReversed, true);
  assert.ok(Math.abs(st.poseTime - hit) < 1e-6, `the sweep begins at the hit (${st.poseTime} vs ${hit})`);
  let lowest = Infinity;
  for (let i = 0; i < 200 && arm.status().upper === UPPER_BODY.AttackRelease; i++) { arm.update(0.05); lowest = Math.min(lowest, arm.status().poseTime); }
  assert.ok(lowest <= max + 1e-6 && lowest >= max - 1e-6, `and ends at max attack (${lowest} vs ${max}) - the blade crossed left to right`);
  st = arm.status();
  assert.equal(st.upper, UPPER_BODY.AttackEnd);
  assert.ok(Math.abs(st.poseTime - max) < 1e-6, 'the settle begins where the sweep ended');
  for (let i = 0; i < 200 && arm.status().upper === UPPER_BODY.AttackEnd; i++) arm.update(0.05);
  st = arm.status();
  assert.equal(st.upper, UPPER_BODY.WeaponEquipped, 'and the blow is over');
  assert.equal(st.attackReversed, false, 'the hand rests; nothing is reversed between blows');

  // the other way is the clip's own way
  assert.equal(arm.attack('StrikeLeft'), 'slash');
  st = arm.status();
  assert.equal(st.attackReversed, false);
  assert.ok(Math.abs(st.poseTime - start) < 1e-6, 'a left slash begins at "slash start", forward');
  for (let i = 0; i < 400 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.attack('StrikeDownRight'), 'chop');
  assert.equal(arm.status().attackReversed, false, 'a chop backwards is an uppercut - the chops keep their one way');
});

test('MS1: no mirror anywhere - the draws are untouched and the pose alone reads the window backwards', () => {
  const src = rd('src/combat/fpArm.js');
  assert.ok(!/MIRROR_X|mirrorNow|attackMirror/.test(src), 'the mirror is gone: a mirror changes hands');
  assert.match(src, /renderCharacterSprite\(mesh, NIF_TO_PASS, proj, view, pw, ph, \{ lensLocal: true \}\)/);
  assert.match(src, /const poseTime = \(state\) => \(state && state\.reversed \? state\.startTime \+ state\.stopTime - state\.time : state\.time\);/);
  assert.equal((src.match(/time: poseTime\(state\),/g) || []).length, 2, 'both rigs pose through it');
  assert.match(src, /actionState\.reversed = !!reversed;/);
  assert.match(src, /attackReversed = type === 'slash' && strikeReversed\(strike\);/);
  assert.match(src, /attackReversed = false;\s*\/\/ MS1: a cast has no side/);
});
