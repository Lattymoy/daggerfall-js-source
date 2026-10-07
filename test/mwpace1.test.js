// MW-PACE1 (2026-10-07, Mac: "Morrowind attack animations don't scale with attack speed/multiple attacks when attack
// speed is high"): THE MORROWIND BLOW IS PACED BY DAGGERFALL'S.
//
// The classic machine owns every blow (characters/weaponStates.js; rule 24's note in Morrowind-Rules.md: the hit
// frame is FPSWeapon's, not the .kf's). The Morrowind arm drew each blow at its WEAP record's pace and refused a strike
// that arrived while one was still playing - so at a high Speed it drew one blow in two, the second landing on an arm
// at rest. These pins hold the four halves of the fix:
//   - blowSchedule is the machine's OWN clock, said ahead (when its hit lands, when it is done), measured against the
//     machine itself at several Speeds and frame times;
//   - the arm fits each section into it - the release ends on the machine's hit, the follow-through on its done -
//     slow or fast, on the fixture's real key times;
//   - a strike that arrives in the follow-through cuts it (the machine only strikes from Idle, so that blow is over);
//     the wind-up and the release are never cut; a shot keeps the record's pace;
//   - the rig hands the machine's schedule to the arm at the strike's first frame, and a peer's burst paces its blows
//     by the gaps between its counts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createWeaponMachine, machineAttack, machineStep, blowSchedule, getMeleeWeaponAnimTime, HIT_FRAME_MELEE,
  MELEE_NUM_FRAMES, LEFT_UNARMED_ANIMS,
} from '../src/characters/weaponStates.js';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY, blowRate, BLOW_RATE_MAX, BLOW_RATE_MIN } from '../src/combat/fpArm.js';
import { MW_WEAPON_TYPE } from '../src/formats/mwFirstPerson.js';
import { PeerBodies, peerBlowPace, peerBlow, PEER_BLOW_MIN_S, PEER_BLOW_MAX_S } from '../src/net/peerBodies.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { setValue as setSetting } from '../src/systems/settings.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b} (within ${eps})`);

// --- the machine's own clock ----------------------------------------------------------------------------------------

/** Run a fresh machine through one strike at a fixed frame time and read when its hit and its done fire. */
function machineTimes({ unarmed = false, strike, speed, dt }) {
  const m = createWeaponMachine(false, unarmed);
  machineAttack(m, strike);
  const schedule = blowSchedule(m, speed, null, dt);
  let t = 0; let hit = null; let done = null;
  for (let i = 0; i < 5000 && done == null; i++) {
    t += dt;
    const ev = machineStep(m, dt, speed);
    if (ev.includes('hit') && hit == null) hit = t;
    if (ev.includes('done')) done = t;
  }
  return { schedule, hit, done };
}

test('MW-PACE1: blowSchedule IS the machine\'s clock - its hit and its done, at every Speed and frame time, the unarmed strike to the left its own eight ticks', () => {
  const cases = [
    { strike: 'StrikeDown', speed: 50, dt: 1 / 60 },
    { strike: 'StrikeRight', speed: 100, dt: 1 / 60 },
    { strike: 'StrikeUp', speed: 0, dt: 1 / 30 },
    { strike: 'StrikeDownLeft', speed: 75, dt: 1 / 144 },
    { strike: 'StrikeLeft', speed: 80, dt: 1 / 144, unarmed: true },
    { strike: 'StrikeLeft', speed: 30, dt: 0.05, unarmed: true },
    { strike: 'StrikeRight', speed: 100, dt: 1 / 60, unarmed: true },
  ];
  for (const c of cases) {
    const { schedule, hit, done } = machineTimes(c);
    const tag = `${c.unarmed ? 'unarmed ' : ''}${c.strike} at Speed ${c.speed}, dt ${c.dt.toFixed(4)}`;
    near(schedule.hitAt, hit, 1e-9, `${tag} - the hit`);
    near(schedule.seconds, done, 1e-9, `${tag} - the done`);
  }
  // the nominal tick without a frame time, and the counts it is made of
  const m = createWeaponMachine(false);
  machineAttack(m, 'StrikeDown');
  const tick = getMeleeWeaponAnimTime(50);
  assert.deepEqual(blowSchedule(m, 50), { seconds: MELEE_NUM_FRAMES.StrikeDown * tick, hitAt: HIT_FRAME_MELEE * tick, step: tick });
  const u = createWeaponMachine(false, true);
  machineAttack(u, 'StrikeLeft');
  assert.deepEqual(blowSchedule(u, 50), { seconds: LEFT_UNARMED_ANIMS.length * tick, hitAt: 3 * tick, step: tick }, 'the hit is the list\'s first visit to frame 2 - its third tick');
});

test('MW-PACE1: no schedule for a machine at rest or a ranged one - the bow\'s hit waits for the arm (MW-D42)', () => {
  const idle = createWeaponMachine(false);
  assert.equal(blowSchedule(idle, 50), null, 'Idle');
  const bow = createWeaponMachine(true);
  machineAttack(bow, 'StrikeDown');
  assert.equal(blowSchedule(bow, 50), null, 'a bow');
  const gun = createWeaponMachine(false);
  gun.ranged = true; gun.tick = 0.07;
  machineAttack(gun, 'StrikeDown');
  assert.equal(blowSchedule(gun, 50), null, 'the port\'s own gun pays the ranged cooldown - ranged');
  const zero = createWeaponMachine(false);
  zero.tick = 0;
  machineAttack(zero, 'StrikeDown');
  assert.equal(blowSchedule(zero, 50), null, 'a tick that is no tick says nothing');
});

test('MW-PACE1: blowRate - span over the time left, held to its bounds', () => {
  assert.equal(blowRate(0.8, 0.4), 2);
  assert.equal(blowRate(0.8, 0.0001), BLOW_RATE_MAX, 'a blow already late finishes at the cap, never in one jump');
  assert.equal(blowRate(0.01, 100), BLOW_RATE_MIN);
  assert.equal(blowRate(0, 1), 1, 'a span that is no span plays at 1');
});

// --- the arm, on the fixture's real key times ------------------------------------------------------------------------

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
/** A WEAP record, byte-shaped as loadweap.hpp says (test/mwattackclip.test.js's, at its MW-D28 speed byte). */
const wpdtRec = (id, model, type, speed = 1) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  const dv = new DataView(w.buffer);
  dv.setInt16(8, type, true);
  dv.setFloat32(12, speed, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
};
function fpDeps(weapEsm) {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/blade.nif', f('weapon.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weapEsm : f('armfp.esm')),
  };
}
const fakeRenderer = () => ({
  gl: null,
  createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }),
  updateCharacterMesh: () => {},
  createCharacterTexture: () => 1,
});
/** The longsword drawn and at rest, its record's pace `speed` (the MW-D28 fallback a paced blow must not read). */
async function drawnArm(speed = 1) {
  const arm = createFpArm();
  arm.attach(fakeRenderer(), () => ({ pitch: 0 }));
  const res = await arm.build({
    race: 'fprace', weapon: { templateIndex: 120 },
    deps: fpDeps(wpdtRec('iron longsword', 'w/blade.nif', MW_WEAPON_TYPE.LongBladeOneHand, speed)),
  });
  assert.ok(res.ok, `build: ${res.stage} ${res.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 400 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped, 'drawn and at rest');
  return arm;
}
/** Step a blow and read when each section began, on the blow's own clock. */
function strikeLog(arm, dt, steps = 2000) {
  const at = {};
  let clock = 0;
  let last = arm.status().upper;
  for (let i = 0; i < steps; i++) {
    arm.update(dt);
    clock += dt;
    const u = arm.status().upper;
    if (u !== last) { at[u] ??= clock; last = u; }
    if (u === UPPER_BODY.WeaponEquipped) break;
  }
  return at;
}

test('MW-PACE1: the arm lands its "hit" on the machine\'s and is ready when the blow is done - slow, middling and fast, the record\'s own pace ignored', async () => {
  // The fixture's chop: start 2.5, max attack 2.9, hit 3.3, large follow 3.8 to 4.0 - 0.8 s to the hit at the file's
  // own pace, and the record says 3.0. A paced blow reads neither.
  const arm = await drawnArm(3.0);
  const dt = 1 / 60;
  for (const blow of [{ seconds: 2.0, hitAt: 0.8 }, { seconds: 1.0, hitAt: 0.4 }, { seconds: 0.25, hitAt: 0.1 }]) {
    assert.equal(arm.attack('StrikeDown', { blow }), 'chop');
    const plan = arm.status().blow;
    assert.ok(plan && plan.seconds === blow.seconds && plan.hitAt === blow.hitAt, 'the schedule is the blow\'s');
    near(plan.rate, 0.8 / blow.hitAt, 1e-6, 'the wind-up runs at the span to the hit over the time to it');
    const at = strikeLog(arm, dt);
    // the release ENDS on "chop hit" - the AttackEnd edge is the frame the playhead crossed it
    near(at[UPPER_BODY.AttackEnd], blow.hitAt, dt + 1e-9, `hitAt ${blow.hitAt}: the blade lands with the damage`);
    near(at[UPPER_BODY.WeaponEquipped], blow.seconds, dt + 1e-9, `seconds ${blow.seconds}: the follow-through ends with the blow`);
    assert.equal(arm.status().blow, null, 'and the plan goes with the blow');
  }
});

test('MW-PACE1: without a schedule the arm keeps the record\'s pace (MW-D28) - the fallback a viewer and a first peer blow read', async () => {
  const arm = await drawnArm(2.0);
  assert.equal(arm.attack('StrikeDown'), 'chop');
  assert.equal(arm.status().blow, null);
  const t0 = arm.status().time;
  arm.update(0.05);
  near(arm.status().time - t0, 0.1, 1e-9, 'the wind-up at the record\'s 2.0');
  // a schedule that says nothing is no schedule
  const arm2 = await drawnArm(2.0);
  assert.equal(arm2.attack('StrikeDown', { blow: { seconds: 0.2, hitAt: 0.5 } }), 'chop');
  assert.equal(arm2.status().blow, null, 'a hit after the blow\'s end is refused');
});

test('MW-PACE1: a strike in the FOLLOW-THROUGH cuts it for the next blow - the wind-up and the release are never cut', async () => {
  const arm = await drawnArm();
  const blow = { seconds: 1.0, hitAt: 0.4 };
  assert.equal(arm.attack('StrikeDown', { blow }), 'chop');
  assert.equal(arm.attack('StrikeLeft', { blow }), null, 'the wind-up carries a blow that has not landed');
  for (let i = 0; i < 400 && arm.status().upper !== UPPER_BODY.AttackRelease; i++) arm.update(1 / 60);
  assert.equal(arm.attack('StrikeLeft', { blow }), null, 'nor is the release cut');
  for (let i = 0; i < 400 && arm.status().upper !== UPPER_BODY.AttackEnd; i++) arm.update(1 / 60);
  assert.equal(arm.status().upper, UPPER_BODY.AttackEnd);
  assert.equal(arm.attack('StrikeLeft', { blow }), 'slash', 'the follow-through is cut: the machine has finished that blow');
  assert.equal(arm.status().upper, UPPER_BODY.AttackWindUp);
  near(arm.status().time, 4.1, 1e-6, 'and the new blow starts at "slash start"');
  assert.equal(arm.status().blow.clock, 0, 'on its own clock');
});

test('MW-PACE1: a held wind-up keeps the record\'s pace - the bow\'s draw waits for its release', async () => {
  const arm = await drawnArm(2.0);
  assert.equal(arm.attack('StrikeDown', { hold: true, blow: { seconds: 1, hitAt: 0.4 } }), 'chop');
  assert.equal(arm.status().blow, null, 'a held wind-up has no deadline');
});

test('MW-PACE1: a SHOT keeps the record\'s pace - its hit waits for the arm\'s own "shoot release" (MW-D42), so there is no deadline to fit', async () => {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/bowmesh.nif', f('bowmesh.nif')],
    ['meshes/w/arrow.nif', f('arrow.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const weap = Uint8Array.from([...wpdtRec('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow), ...wpdtRec('iron arrow', 'w/arrow.nif', MW_WEAPON_TYPE.Arrow)]);
  const arm = createFpArm();
  arm.attach(fakeRenderer(), () => ({ pitch: 0 }));
  const res = await arm.build({
    race: 'fprace', weapon: { templateIndex: 130 }, hasAmmo: true,
    deps: {
      loadMorrowindArchives: async () => [{ has: (q) => files.has(q), get: (q) => files.get(q) }],
      storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
      loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
    },
  });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 400 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.attack('StrikeDown', { blow: { seconds: 0.3, hitAt: 0.12 } }), 'shoot');
  assert.equal(arm.status().blow, null, 'a shot is not paced');
});

test('MW-PACE1: a frame that runs long across the wind-up\'s end is made up in the release - the hit still lands with the damage', async () => {
  // advanceClip drops what a section's last frame had left past its stop (mwAnim.js), so a hitch there starts the
  // release late; the release is re-fitted from where the blow's clock stands, not from the wind-up's rate.
  const arm = await drawnArm();
  const blow = { seconds: 1.0, hitAt: 0.4 };
  assert.equal(arm.attack('StrikeDown', { blow }), 'chop');   // wind-up at 2.0: its 0.4 of file time in 0.2 s
  let clock = 0;
  const step = (dt) => { arm.update(dt); clock += dt; };
  for (let i = 0; i < 6; i++) step(1 / 60);                   // 0.1 s in
  step(0.2);                                                  // the hitch: past the wind-up's end by 0.1 s, dropped
  assert.equal(arm.status().upper, UPPER_BODY.AttackRelease, 'the release has begun, late');
  let hitAt = null;
  for (let i = 0; i < 600 && hitAt == null; i++) { step(1 / 60); if (arm.status().upper !== UPPER_BODY.AttackRelease) hitAt = clock; }
  near(hitAt, blow.hitAt, 1 / 60 + 1e-9, 'the release made up the hitch');
});

// --- the rig hands it over --------------------------------------------------------------------------------------------

test('MW-PACE1: the rig hands the arm the MACHINE\'s schedule at the strike\'s first frame - and it moves with Speed', async () => {
  setSetting('Controls', 'WeaponSwingMode', '0');   // the drag, as weaponrig.test.js asks for it
  const { fpArm } = await import('../src/combat/fpArm.js');
  const saved = { ready: fpArm.ready, attack: fpArm.attack };
  const calls = [];
  fpArm.ready = () => true;
  fpArm.attack = (strike, opts) => { calls.push({ strike, opts }); return 'chop'; };
  const SWORD = { name: 'Longsword', templateIndex: 120, material: 0 };
  try {
    const blowAt = (speed) => {
      calls.length = 0;
      const entity = { items: [], equip: { slots: { [EQUIP_SLOTS.RightHand]: SWORD } }, stats: { live: { speed } } };
      const r = createWeaponRig({ renderer: {}, canvas: { clientWidth: 1000, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art'); }, palette: null, audio: { playOneShot() {} }, entity });
      r.playerWeapon.liveSpeed = speed;
      r.toggleSheath();
      for (let i = 0; i < 30; i++) r.frame(1 / 60);
      r.attackInput(900, 0, true);
      r.frame(1 / 60);
      assert.equal(calls.length, 1, 'the arm is told once');
      const { blow } = calls[0].opts;
      assert.ok(blow, 'with the blow\'s schedule');
      assert.deepEqual(blow, r.playerWeapon.strikeSchedule(1 / 60), 'the machine\'s own, at the frame\'s dt');
      return blow;
    };
    const slow = blowAt(20);
    const fast = blowAt(100);
    assert.ok(fast.seconds < slow.seconds && fast.hitAt < slow.hitAt, `Speed quickens the blow the arm is fitted to (${slow.seconds} -> ${fast.seconds})`);
    near(fast.hitAt / fast.seconds, HIT_FRAME_MELEE / MELEE_NUM_FRAMES.StrikeDown, 1e-9, 'the hit two fifths in');
  } finally {
    fpArm.ready = saved.ready;
    fpArm.attack = saved.attack;
  }
});

// --- a peer -----------------------------------------------------------------------------------------------------------

test('MW-PACE1: a peer\'s burst is paced by its shortest gap; a pause ends it, and a burst\'s first blow keeps the record\'s pace', () => {
  assert.equal(peerBlowPace(null, -1), null, 'no gap yet');
  assert.equal(peerBlowPace(null, 0.6), 0.6);
  assert.equal(peerBlowPace(0.6, 1.5), 0.6, 'a pause inside the fight does not slow the blows');
  assert.equal(peerBlowPace(0.6, 0.5), 0.5, 'a shorter gap is the truer blow');
  assert.equal(peerBlowPace(0.5, PEER_BLOW_MAX_S + 0.01), null, 'past the slowest blow: a new burst');
  assert.equal(peerBlowPace(null, 0.05), PEER_BLOW_MIN_S, 'two counts in one pose read no faster than the floor');
  assert.equal(peerBlow(null), null);
  assert.deepEqual(peerBlow(0.5), { seconds: 0.5, hitAt: 0.2 });
});

test('MW-PACE1: the peer\'s body hands its rig the burst\'s schedule', async () => {
  let now = 1000;
  const rigs = [];
  const createRig = () => {
    const r = { calls: [], mode: 'first', updates: [],
      attach() {}, async build() { return { ok: true }; }, canThirdPerson: () => true,
      setViewMode(m) { r.mode = m; return true; }, thirdActive: () => r.mode === 'third' && r.updates.length > 0,
      update(dt) { r.updates.push(dt); }, drawThird: () => true, unload() {}, raceHeightScale: () => 1,
      setSheathed() { return false; }, release() { return false; }, setWeapon() { return true; },
      readySpell() { return false; }, castSpell() { return true; }, upperBodyReady: () => true,
      attack(strike, opts) { r.calls.push({ strike, blow: opts?.blow ?? null }); return 'chop'; },
    };
    rigs.push(r);
    return r;
  };
  const pb = new PeerBodies({ renderer: {}, createRig, now: () => now, warn: () => {} });
  const ARM0 = { wd: 1, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0 };
  const p = { id: 'p1', name: 'p1', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 3, y: 0, z: -10, yaw: 0, pitch: 0, mv: 0, ...ARM0 } };
  const toScene = (q) => [q.x, q.y, q.z];
  pb.sync([p], toScene, 0.016, [0, 0, 0]);
  for (let i = 0; i < 6; i++) await new Promise((res) => setTimeout(res, 0));
  pb.sync([p], toScene, 0.016, [0, 0, 0]);
  const r = rigs[0];
  const swing = (an, dtMs) => { now += dtMs; p.shown = { ...p.shown, an, as: 1 }; pb.sync([p], toScene, 0.016, [0, 0, 0]); };
  swing(1, 100);
  swing(2, 600);
  swing(3, 700);
  swing(4, 5000);
  assert.deepEqual(r.calls.map((c) => c.blow), [
    null,                                  // the burst's first: the record's pace
    { seconds: 0.6, hitAt: 0.24 },         // the gap
    { seconds: 0.6, hitAt: 0.24 },         // a longer gap does not slow it
    null,                                  // a pause: a new burst
  ]);
});
