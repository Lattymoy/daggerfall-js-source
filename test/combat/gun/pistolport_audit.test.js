// AUDIT PISTOL-PORT (2026-10-22; bible/01-Overview/audits/Audit-Pistol-Port.md). The port gave each Pistolet its own
// machine, so two shots can be in flight at once - and every reader downstream had been written for one: the hosts fire
// a 'hit' with the weapon, strike and blow the player weapon holds as they read it; the Morrowind arm holds ONE hit for
// its release; a technique claims the frame's hits; the pack's Pellets were checked one shot at a time. Each pin drives
// the real code through the doors the hosts use, and a host stand-in does what the four hosts do on a ranged 'hit'
// (exterior.js's ranged arm: spendAmmoFor, then the weapon, the blow and the muzzle as the player weapon holds them).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pistolRig } from '../weapon/pistolRigHarness.js';
import { createPistolet } from '../../../src/systems/pistolet.js';
import { createPellets, createThunderlock } from '../../../src/systems/thunderlock.js';
import { PISTOLET_FEEL, armGunPose } from '../../../src/combat/gun/gunFeel.js';
import { createGunMachine } from '../../../src/combat/gun/gunMachine.js';
import { createPair, PAIR_TRIGGER } from '../../../src/combat/gun/pistolPair.js';
import * as VM from '../../../src/combat/gun/pistolViewmodel.js';
import { gunMotion } from '../../../src/combat/gun/gunViewmodel.js';
import { walkSpeed, crouchSpeed, DIAGONAL_FACTOR, JUMP_SPEED, GRAVITY } from '../../../src/player/motor.js';
import { betterAmbience } from '../../../src/systems/betterAmbience.js';
import { pistolPageState, pistolPageStep, pistolJumpClimb } from '../../../src/tools/pistolLab.js';
import { PlayerWeapon } from '../../../src/combat/playerWeapon.js';
import { spendAmmoFor, ammoCountFor } from '../../../src/systems/inventory.js';
import { fpArm } from '../../../src/combat/fpArm.js';
import { setValue } from '../../../src/systems/settings/settings.js';
import { LookFilter } from '../../../src/player/lookFilter.js';
import { OFF_HAND_BLOW } from '../../../src/combat/twoHands/handsLaw.js';
import * as T from '../../../src/combat/techniques.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { setSigilDueling } from '../../../src/systems/sigil/sigil.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';

const DT = 1 / 60;

/** What a host does with the frame's events: each 'hit' spends a Pellet and fires the weapon in hand, as it is read. */
function host(rig) {
  const out = { shots: [], dry: 0 };
  out.take = () => {
    for (const ev of rig.events) {
      if (ev !== 'hit') continue;
      const pw = rig.r.playerWeapon, w = pw.weapon;
      if (!spendAmmoFor(rig.entity.items, w, { summoned: false })) { out.dry++; continue; }
      out.shots.push({ weapon: w, blow: pw.blowWeight, off: pw.isOffHandItem(w), muzzle: JSON.stringify(rig.r.thunderlockMuzzle(Math.PI / 3)) });
    }
  };
  return out;
}
const firedBy = (pw) => pw.pistols.R.shots + pw.pistols.L.shots;
const pairWeapon = () => {
  const pw = new PlayerWeapon();
  pw.currentRightHandWeapon = createPistolet(); pw.currentLeftHandWeapon = createPistolet(); pw.usingRightHand = true; pw.sheathed = false;
  pw.applyWeapon(); pw.update(DT);
  return pw;
};

test('A2: ONE HIT AN UPDATE - two pistols hitting in one step (a flurry pulled a frame apart, a 50 ms frame) are handed out one an update in the order they fired, each with its OWN weapon, blow and off-hand terms (mutant: both read as the second pistol)', () => {
  const pw = pairWeapon();
  assert.ok(pw.clickAttack(() => 0.5));
  pw.update(0.02);
  assert.ok(pw.clickAttack(() => 0.5), 'the left, pulled before the right\'s hit');
  const reads = [];
  assert.equal(pw.update(0.09).filter((e) => e === 'hit').length, 1, 'both pistols crossed their hit frame in that step - one hit handed out');
  reads.push({ weapon: pw.weapon, blow: pw.blowWeight, off: pw.isOffHandItem(pw.weapon), hand: pw.strike.hand });
  for (const dt of [DT, DT]) for (const ev of pw.update(dt)) if (ev === 'hit') reads.push({ weapon: pw.weapon, blow: pw.blowWeight, off: pw.isOffHandItem(pw.weapon), hand: pw.strike.hand });
  assert.deepEqual(reads.map((x) => x.hand), ['R', 'L'], 'the right first - it fired first');
  assert.equal(reads[0].weapon, pw.currentRightHandWeapon);
  assert.deepEqual([reads[0].blow, reads[0].off], [1, false], 'the lead\'s shot whole');
  assert.equal(reads[1].weapon, pw.currentLeftHandWeapon);
  assert.deepEqual([reads[1].blow, reads[1].off], [OFF_HAND_BLOW.blowWeight, true], 'the off hand\'s its own terms');
  // and led by the LEFT hand: the left fired first, so its hit is handed out first, though the right is stepped first
  const lw = new PlayerWeapon();
  lw.currentRightHandWeapon = createPistolet(); lw.currentLeftHandWeapon = createPistolet(); lw.usingRightHand = false; lw.sheathed = false;
  lw.applyWeapon(); lw.update(DT);
  assert.equal(lw.leadHand, 'L');
  assert.ok(lw.clickAttack(() => 0.5)); lw.update(0.02); assert.ok(lw.clickAttack(() => 0.5));
  const order = [];
  for (const dt of [0.09, DT, DT]) for (const ev of lw.update(dt)) if (ev === 'hit') order.push(lw.strike.hand);
  assert.deepEqual(order, ['L', 'R'], 'the earlier shot first');
});

test('A2: and through the real rig on a 90 ms frame, each shot leaves its own barrel', async () => {
  const rig = await pistolRig({ right: createPistolet(), left: createPistolet() });
  const h = host(rig);
  rig.r.clickAttack(); await rig.frame(0.02); h.take();
  rig.r.clickAttack(); await rig.frame(0.09); h.take();   // a hitch: both pistols cross their hit frame in this one frame
  for (let i = 0; i < 4; i++) { await rig.frame(); h.take(); }
  assert.equal(h.shots.length, 2);
  assert.deepEqual(h.shots.map((s) => s.off), [false, true], 'the lead\'s, then the off hand\'s');
  assert.notEqual(h.shots[0].weapon, h.shots[1].weapon, 'each pistol\'s own shot');
  assert.notEqual(h.shots[0].muzzle, h.shots[1].muzzle, 'from its own barrel');
});

test('A1: UNDER THE MORROWIND ARM a pair loses no shot - a pull waits for the arm, as a bow\'s does, and every pistol that fires is a shot the host fires, the right\'s whole (mutants: the gate on an Idle machine alone - the second pistol fires into a busy arm and its hit is lost)', async () => {
  // the arm stubbed to the contract the rig reads (fpArm.js attack/shotBusy/takeShootRelease): an attack taken only when
  // the arm is free, busy 0.6 s after, its "shoot release" key once, 0.3 s in; the rest of the arm a quiet built one
  const saved = {};
  for (const k of Object.keys(fpArm)) if (typeof fpArm[k] === 'function') { saved[k] = fpArm[k]; fpArm[k] = () => undefined; }
  let clock = 0, at = -Infinity, released = true;
  fpArm.ready = () => true; fpArm.active = () => true; fpArm.thirdActive = () => false;
  fpArm.shotBusy = () => clock - at < 0.6;
  fpArm.attack = () => { if (clock - at < 0.6) return false; at = clock; released = false; return true; };
  fpArm.takeShootRelease = () => { if (!released && clock - at >= 0.3) { released = true; return true; } return false; };
  fpArm.weaponMuzzle = () => null;
  try {
    const rig = await pistolRig({ right: createPistolet(), left: createPistolet(), warm: 30 });
    const h = host(rig);
    for (let i = 0; i < 20 * 60; i++) {
      if (i % 3 === 0) rig.r.clickAttack();
      await rig.frame(); h.take(); clock += DT;
    }
    const pw = rig.r.playerWeapon;
    assert.ok(h.shots.length > 15, `the pair kept firing (${h.shots.length} shots in 20 s)`);
    assert.equal(h.shots.length, firedBy(pw), `every pistol that fired is a shot (${firedBy(pw)} fired)`);
    assert.equal(h.shots[0].off, false, 'the first shot is the lead\'s, whole');
    assert.ok(h.shots.some((s) => !s.off) && h.shots.some((s) => s.off), 'both hands fire');
  } finally {
    Object.assign(fpArm, saved);
  }
});

test('A3: A RELOAD IS THE PISTOL\'S - one Pistolet moved to the other hand inside its reload is still reloading, and fires once it is loaded (mutant: the reload left on the hand\'s machine - one pistol juggled at a pair\'s rate)', () => {
  const P = createPistolet();
  const pw = new PlayerWeapon();
  let right = P, left = null;
  const sync = () => { pw.updateHands(right, left); pw.followHeldHand(); pw.applyWeapon(); };
  pw.usingRightHand = true; pw.sheathed = false; sync(); pw.update(DT);
  sync(); assert.ok(pw.clickAttack(() => 0.5));
  for (let i = 0; i < 40; i++) { sync(); pw.update(DT); }
  right = null; left = P;
  sync(); pw.update(DT);
  assert.equal(pw.leadHand, 'L', 'held in the left now');
  assert.equal(pw.clickAttack(() => 0.5), null, 'still reloading: it will not fire');
  for (let i = 0; i < 90; i++) { sync(); pw.update(DT); }
  assert.ok(pw.clickAttack(() => 0.5), 'loaded, it fires');
});

test('A4: A TECHNIQUE AND A PLAIN SHOT IN ONE FRAME - the technique (stepped first in the frame) takes the lead\'s hit, handed out first; the off hand\'s plain shot reaches the host the next update (mutant: both hits in one update - the claim swallows them both)', () => {
  _resetForTests(); setPref('lootRarity', true); T._resetTechniquesForTests(); setSigilDueling(false); setPlayerDoor(null);
  const lcg = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const R = LR.applyRarity(createPistolet(), 'rare', lcg(7));
  R.isIdentified = true; LR.addTechniqueLine(R, () => 0.5, { id: 'pierce' }); LR.techniqueLineOf(R).value = 10;
  const stats = { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
  const me = { isPlayer: true, level: 8, items: [createPellets(10)], stats, skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, equip: { slots: [] }, career: {}, activeEffects: [] };
  const pw = new PlayerWeapon({ liveSpeed: 50 });
  pw.currentRightHandWeapon = R; pw.currentLeftHandWeapon = createPistolet(); pw.usingRightHand = true; pw.sheathed = false; pw.applyWeapon(); pw.update(0);
  const loosed = [];
  const flat = { raycast: (o, d, max) => { if (!(d[1] < 0)) return Infinity; const t = -o[1] / d[1]; return t <= max ? t : Infinity; }, surfaceHit: () => null, heightAt: () => 0 };
  const RIG = {};
  const ctx = (held) => ({ rig: RIG, entity: me, pw, cam: { pos: [0, 1.7, 0], yaw: 0, pitch: -0.2, feet: [0, 0, 0] }, collider: flat, held, ready: true, cancel: false,
    startSwing: (s) => pw.techniqueStrike(s), door: { fireArrow: () => loosed.push(pw.strike?.hand) }, say: () => {}, noteShot: () => {} });
  try {
    T.stepTechnique(DT, ctx(true)); pw.update(DT);
    T.stepTechnique(DT, ctx(false));   // the key released: the lead's technique shot
    assert.equal(pw.pistols.R.state, 'Firing');
    assert.ok(pw.clickAttack(() => 0.5), 'and a plain pull the same frame fires the left');
    let plain = 0;
    for (let i = 0; i < 60; i++) plain += T.claimShot(pw.update(DT), ctx(false)).filter((e) => e === 'hit').length;
    assert.deepEqual(loosed, ['R'], 'the technique loosed once, on the lead\'s hit');
    assert.equal(plain, 1, 'the off hand\'s plain shot handed to the host');
  } finally {
    T._resetTechniquesForTests(); _resetForTests();
  }
});

test('A5: THE LAST PELLET FIRES ONCE - a second pull while the first pistol\'s shot is still owed the last Pellet is refused: no bang, no dry shot (mutant: the Pellets counted one shot at a time)', async () => {
  const rig = await pistolRig({ right: createPistolet(), left: createPistolet(), warm: 30 });
  rig.entity.items = [createPellets(1)];
  const h = host(rig);
  rig.audio.played.length = 0;
  rig.r.clickAttack(); await rig.frame(); h.take();
  rig.r.clickAttack();   // inside the right's 83 ms before its hit
  for (let i = 0; i < 60; i++) { await rig.frame(); h.take(); }
  assert.equal(firedBy(rig.r.playerWeapon), 1, 'one pistol fired');
  assert.equal(rig.audio.played.filter((k) => k === 'pistolet:fire').length, 1, 'one report');
  assert.deepEqual([h.shots.length, h.dry], [1, 0], 'one shot, nothing dry');
  assert.equal(ammoCountFor(rig.entity.items, rig.r.playerWeapon.weapon), 0);
});

test('A5: and a held trigger (WeaponSwingMode 2, click or hold - a pull every frame through the gesture door) fires the last Pellet once (mutant: the gesture door ungated)', async () => {
  const rig = await pistolRig({ right: createPistolet(), left: createPistolet(), warm: 30 });
  setValue('Controls', 'WeaponSwingMode', 2);
  rig.entity.items = [createPellets(1)];
  const h = host(rig);
  rig.audio.played.length = 0;
  for (let i = 0; i < 30; i++) { await rig.frame(DT, true); h.take(); }
  for (let i = 0; i < 30; i++) { await rig.frame(); h.take(); }
  assert.equal(firedBy(rig.r.playerWeapon), 1, 'one pistol fired');
  assert.equal(rig.audio.played.filter((k) => k === 'pistolet:fire').length, 1, 'one report');
  assert.deepEqual([h.shots.length, h.dry], [1, 0], 'one shot, nothing dry');
});

test('A6: A PISTOL PUT AWAY BETWEEN ITS PULL AND ITS HIT FIRES NOTHING - never as the pistol left in hand (mutant: the stowed pistol\'s hit handed out on the other\'s weapon)', () => {
  const pw = pairWeapon();
  assert.ok(pw.clickAttack(() => 0.5));
  for (let i = 0; i < 2; i++) pw.update(DT);
  assert.ok(pw.clickAttack(() => 0.5));
  assert.equal(pw.strike.hand, 'L');
  pw.updateHands(pw.currentRightHandWeapon, null); pw.applyWeapon();   // the left hand takes a light: no pair
  const hits = [];
  for (let i = 0; i < 40; i++) for (const ev of pw.update(DT)) if (ev === 'hit') hits.push({ hand: pw.strike.hand, weapon: pw.weapon });
  assert.deepEqual(hits.map((x) => x.hand), ['R'], 'the right\'s shot alone');
  assert.equal(hits[0].weapon, pw.currentRightHandWeapon);
});

test('A9: PISTOLS PUT BY FOR A SWORD release the classic machine - the sword swings at once, never waiting out a pistol\'s reload nor finishing its shot as a blow (mutant: the mirror left mid-shot with the pistol\'s cooldown)', () => {
  const pw = new PlayerWeapon();
  const pistol = createPistolet(), sword = { name: 'Longsword', group: 'Weapons', templateIndex: 120, material: 0 };
  pw.currentRightHandWeapon = pistol; pw.usingRightHand = true; pw.sheathed = false; pw.applyWeapon(); pw.update(DT);
  assert.ok(pw.clickAttack(() => 0.5));
  for (let i = 0; i < 40; i++) pw.update(DT);   // into the pistol's reload
  pw.currentRightHandWeapon = sword; pw.applyWeapon();
  const evs = pw.update(DT);
  assert.ok(!evs.includes('hit'), 'no blow the pistol started');
  assert.equal(pw.machine.state, 'Idle');
  assert.ok(pw.machine.cooldownUntil <= pw.machine.now, 'no pistol reload on the sword');
  assert.ok(pw.clickAttack(() => 0.5), 'the sword swings');
  // and swapped MID-SHOT, before the pistol's hit (AUDIT PISTOL-PORT C3, before the port too): the shot is the pistol's
  // or nothing - never finished as the sword's blow
  const pw2 = new PlayerWeapon();
  pw2.currentRightHandWeapon = createPistolet(); pw2.usingRightHand = true; pw2.sheathed = false; pw2.applyWeapon(); pw2.update(DT);
  assert.ok(pw2.clickAttack(() => 0.5));
  pw2.update(DT);
  pw2.currentRightHandWeapon = sword; pw2.applyWeapon();
  const after = [];
  for (let i = 0; i < 40; i++) after.push(...pw2.update(DT));
  assert.ok(!after.includes('hit'), 'no blow from a swing never made');
});

test('C1: A PISTOLET FRAME NEVER ERASES ANOTHER WEAPON\'S RELOAD - the Thunderlock swapped through a Pistolet for one frame (the quickslot key: both guns\' equip delay is nought) is still reloading, and its technique door shut (mutant: the mirror\'s cooldown left on the classic machine)', () => {
  const pw = new PlayerWeapon({ liveSpeed: 50 }); pw.sheathed = false;
  const TL = createThunderlock(), P = createPistolet();
  const wear = (R) => { pw.updateHands(R, null); pw.applyWeapon(null); };
  wear(TL); pw.update(DT); assert.ok(pw.clickAttack(() => 0));
  while (pw.machine.state !== 'Idle') pw.update(DT);
  const owed = pw.machine.cooldownUntil;
  assert.ok(owed > pw.machine.now + 1, 'the Thunderlock owes its reload');
  wear(P); pw.update(DT); wear(TL); pw.update(DT);
  assert.ok(Math.abs(pw.machine.cooldownUntil - owed) < 1e-9, 'still owed, to the instant');
  assert.equal(pw.techniqueStrike('StrikeDown'), false, 'no technique through it');
  assert.equal(pw.clickAttack(() => 0), null, 'nor a shot');
});

test('C4: THE PISTOLS\' OWN FRAME CLOCK on the classic machine - the Morrowind arm\'s flash counts a Pistolet\'s frames at its 12 fps, never the weapon held before (mutant: the tick left the Thunderlock\'s)', () => {
  const pw = new PlayerWeapon({ liveSpeed: 50 }); pw.sheathed = false;
  pw.updateHands(createThunderlock(), null); pw.applyWeapon(null); pw.update(DT);
  pw.updateHands(createPistolet(), null); pw.applyWeapon(null); pw.update(DT);
  assert.equal(pw.machine.tick, 1 / PISTOLET_FEEL.fps);
  assert.equal(pw.machine.hitFrame, PISTOLET_FEEL.hitFrame);
});

test('B4: THE ROOM\'S LIGHT IS THE FLAME ON SCREEN - lit the frame a pistol draws its flash, and thrown from the side of the brightest flash, not the last pull\'s (mutants: the light a frame late, read off last frame\'s pictures; the side the last-fired hand\'s)', async () => {
  const rig = await pistolRig({ right: createPistolet(), left: createPistolet() });
  const p = rig.r.playerWeapon.pistols;
  rig.r.clickAttack();
  let lit = false, sided = 0;
  for (let f = 0; f < 14; f++) {
    if (f === 5) rig.r.clickAttack();   // the left, mid-shot of the right
    const q = await rig.frame();
    const flame = q.find((x) => !x.uv && x.tex === 'pistolet:1');   // the right drawn on its flash frame
    if (flame && !lit) { lit = true; assert.equal(rig.entity._thunderlockFlash, 1, 'the room lit the frame the flame is drawn'); }
    if (p.R.state === 'Firing' && p.R.frame === 1 && p.L.state === 'Firing' && p.L.frame === 0) {
      sided++;
      assert.equal(rig.entity._thunderlockFlashSide, 1, 'the right\'s flame is the bright one: its side, though the left fired last');
    }
  }
  assert.ok(lit && sided > 0, `both cases reached (lit ${lit}, ${sided} frames of the right's flame beside the left's dark one)`);
});

test('UNDER THE MORROWIND ARM A PISTOL\'S BREECH NEVER OPENS BEFORE ITS BANG - the clacks wait while the shot is held for the arm\'s release, as the Thunderlock\'s do (MW-GUN-FEEL) (mutant: the clacks off the machine alone)', async () => {
  const saved = {};
  for (const k of Object.keys(fpArm)) if (typeof fpArm[k] === 'function') { saved[k] = fpArm[k]; fpArm[k] = () => undefined; }
  let clock = 0, at = -Infinity, released = true;
  fpArm.ready = () => true; fpArm.active = () => true; fpArm.thirdActive = () => false;
  fpArm.shotBusy = () => clock - at < 1.0;
  fpArm.attack = () => { if (clock - at < 1.0) return false; at = clock; released = false; return true; };
  fpArm.takeShootRelease = () => { if (!released && clock - at >= 0.7) { released = true; return true; } return false; };   // a release later than the pistol's six frames
  fpArm.weaponMuzzle = () => null;
  try {
    const rig = await pistolRig({ right: createPistolet(), warm: 30 });
    rig.audio.played.length = 0;
    rig.r.clickAttack();
    let hitAt = -1;
    for (let i = 0; i < 150; i++) { await rig.frame(); clock += DT; if (rig.events.includes('hit') && hitAt < 0) hitAt = clock; }
    const order = rig.audio.played.filter((k) => /^pistolet:(fire|open|close)$/.test(k));
    assert.deepEqual(order, ['pistolet:fire', 'pistolet:open', 'pistolet:close'], 'the bang, then the breech');
    // and the shot itself leaves at the arm's release (MW-D42's hold, which reads the machine's `ranged`) - never at the
    // pistol's own hit frame, 83 ms in
    assert.ok(hitAt >= 0.7 - 1e-9 && hitAt < 0.8, `the hit handed to the host at the release (${hitAt.toFixed(3)} s)`);
  } finally {
    Object.assign(fpArm, saved);
  }
});

// ── lane D: the laws the port's pins could not see ──────────────────────────────────────────────────────────────────
test('D1: EVERY SHOT HITS - the gun machine fired again and again answers one hit a shot, on its hit frame, then its reload, then ready; and one Pistolet pulled four times lands four shots (mutants: the hit never re-armed; the hit frame or the reload ignored)', () => {
  const m = createGunMachine({ fps: 12, cooldownMs: 1400, hitFrame: 1 });
  for (let shot = 0; shot < 4; shot++) {
    assert.ok(m.fire(), `shot ${shot} fires`);
    assert.equal(m.fire(), false, 'one shot at a time');
    const evs = []; let t = 0, hitAt = -1;
    while (m.state !== 'Idle' && t < 3) { t += DT; const e = m.step(DT); if (e) evs.push(e); if (e === 'hit') hitAt = t; }
    assert.deepEqual(evs, ['hit', 'ready'], `shot ${shot}: one hit, then ready`);
    assert.ok(Math.abs(hitAt - 1 / 12) <= DT + 1e-9, `on frame 1 (${hitAt.toFixed(3)} s)`);
    assert.ok(Math.abs(t - (6 / 12 + 1.4)) <= DT + 1e-9, `six frames and the reload (${t.toFixed(3)} s)`);
  }
  const pw = new PlayerWeapon();
  pw.currentRightHandWeapon = createPistolet(); pw.usingRightHand = true; pw.sheathed = false; pw.applyWeapon(); pw.update(DT);
  let hits = 0;
  for (let i = 0; i < 4 * 2 * 60; i++) { pw.clickAttack(() => 0.5); hits += pw.update(DT).filter((e) => e === 'hit').length; }
  assert.equal(hits, pw.pistols.R.shots, 'every shot a hit');
  assert.ok(hits >= 4);
});

/** The page's frame alone, at 1280x800, on its own pair - for the laws its identity with the game cannot see. */
function frameAlone() {
  const pair = createPair({ trigger: PAIR_TRIGGER.Alternate, fps: 12, cooldownMs: 1400, hitFrame: 1 });
  const hands = VM.createPistolHands(), settings = VM.pistolWidgetSettings();
  const step = ({ walking = false, look = [0, 0], away = false } = {}) => {
    pair.step(DT);
    VM.pistolHandsStep(hands, DT, {
      machines: pair, drawn: pair.hands(), spring: PISTOLET_FEEL, settings, screenRect: { width: 1280, height: 800 },
      motion: gunMotion({ walking }), look, hiddenTarget: PISTOLET_FEEL.hiddenTarget, away, awayTarget: PISTOLET_FEEL.sheathTarget,
    });
  };
  return { pair, hands, step };
}

test('D9: THE LEFT HAND IS THE RIGHT IN THE GLASS - its rig steps flipped: a walk bobs the two pistols OUTWARD, each the other\'s mirror; a turn of the head lags both the SAME way across the screen (Two-Hands\' two sway rules) (mutant: the left rig never flipped)', () => {
  // read on the SCREEN, where the left hand's picture and rect are mirrored (the rig's own space is the mod's)
  // PIN MOVED (PISTOL-EDGE): the union reaches past the anchor's corner as the strip's does (pistolStrip.js bleedArm) - a
  // union flush with the screen's corner is art that ends there, and holdToCorner holds such a picture still
  const W = 1280, box = { x: 0, y: 0, w: 120, h: 90 }, union = { x: 0, y: 0, w: 120 + 96, h: 90 + 64 };
  const xOf = (f, h) => VM.pistolHandRect(f.hands, h, { canvasW: W, canvasH: 800, anchor: box, union, widthPct: 0.3, offset: 0, raise: 0, heightPx: 90 }).rect;
  const walk = frameAlone();
  const restR = xOf(walk, 'R').x;
  let span = 0;
  for (let i = 0; i < 90; i++) {
    walk.step({ walking: true });
    const r = xOf(walk, 'R'), l = xOf(walk, 'L');
    assert.ok(Math.abs(l.x - (W - (r.x + r.w))) < 1e-9, `frame ${i}: the left drawn as the right's mirror - its bob outward`);
    span = Math.max(span, Math.abs(r.x - restR));
  }
  assert.ok(span > 1, `and the walk bobbed (${span.toFixed(1)} px)`);
  const turn = frameAlone();
  const was = { R: xOf(turn, 'R').x, L: xOf(turn, 'L').x };
  for (let i = 0; i < 20; i++) turn.step({ look: [0.02, 0] });
  const dR = xOf(turn, 'R').x - was.R, dL = xOf(turn, 'L').x - was.L;
  // the same way, not the same distance: Inertia scales the picture too, and the mirrored rect grows from the other corner
  assert.ok(Math.abs(dR) > 1 && Math.abs(dL) > 1 && Math.sign(dR) === Math.sign(dL), `both lag the same way across the screen (${dR.toFixed(2)}, ${dL.toFixed(2)} px)`);
});

test('D9: A LOADED PISTOL STAYS UP while the other reloads - the dip is the reloading pistol\'s alone (mutant: both dip)', () => {
  const f = frameAlone();
  for (let i = 0; i < 10; i++) f.step();
  f.pair.pull(0);
  let dipped = 0;
  for (let i = 0; i < 100; i++) {
    f.step();
    if (f.pair.R.state === 'Cooling') {
      dipped = Math.max(dipped, f.hands.R.rig.offsetCurrent[1]);
      assert.ok(Math.abs(f.hands.L.rig.offsetCurrent[1]) < 1e-9, 'the loaded left stays up');
    }
  }
  assert.ok(dipped > 0.3, 'while the right dipped');
});

test('D9: PUT AWAY, A PAIR SLIDES OFF WHOLE - the pistols are drawn until the LAST is off the screen, so one already low with its reload never pops the other (mutant: drawn only while every pistol is still on)', async () => {
  const slideFrames = async (shootFirst) => {
    const rig = await pistolRig({ right: createPistolet(), left: createPistolet() });
    if (shootFirst) { rig.r.clickAttack(); for (let i = 0; i < 45; i++) await rig.frame(); }   // the right low in its reload
    rig.r.toggleSheath();
    let n = 0;
    while ((await rig.frame()).length && n < 200) n++;
    return n;
  };
  const whole = await slideFrames(false), oneLow = await slideFrames(true);
  assert.ok(whole > 3 && oneLow >= whole - 1, `the loaded pistol slides its whole way (${oneLow} frames, ${whole} for a pair at rest)`);
});

test('D11: EACH SHOT KICKS THE ROOM - Better Ambience\'s camera shake at the Pistolet\'s own room shake, one a shot (the named departure: the page shakes its own camera) (mutant: no room kick)', async () => {
  const kicks = [];
  const was = betterAmbience.weaponKick;
  betterAmbience.weaponKick = (k) => kicks.push(k);
  try {
    const rig = await pistolRig({ right: createPistolet(), left: createPistolet() });
    kicks.length = 0;
    rig.r.clickAttack(); for (let i = 0; i < 4; i++) await rig.frame();
    rig.r.clickAttack(); for (let i = 0; i < 4; i++) await rig.frame();
    assert.deepEqual(kicks, [PISTOLET_FEEL.roomShake, PISTOLET_FEEL.roomShake]);
  } finally {
    betterAmbience.weaponKick = was;
  }
});

test('D11: THE PLAYER\'S OFFSET SWITCH IS THEIRS - with Weapon Widget\'s Offset module off, a reloading pistol does not dip (the page\'s panel has it on) (mutant: the switch dropped)', async () => {
  const lowest = async (widget) => {
    const rig = await pistolRig({ right: createPistolet(), widget });
    const rest = (await rig.frame())[0].rect.y;
    rig.r.clickAttack();
    let y = rest;
    for (let i = 0; i < 70; i++) { const q = await rig.frame(); if (q[0]) y = Math.max(y, q[0].rect.y); }
    return y - rest;
  };
  assert.ok(await lowest({}) > 20, 'Offset on (the default): the reload dips');
  assert.ok(await lowest({ 'Modules.Offset': false }) < 15, 'Offset off: no dip - only the kick');
});

test('D11: A LEFT-HANDED PLAYER\'S PAIR IS THE MIRROR - every hand drawn where the right-handed player\'s other hand is, mirrored about the screen\'s middle, on a walk (mutants: the rigs stepped right-handed)', async () => {
  // a walk, then a turn of the head: the left-handed player turning LEFT is the mirror of the right-handed turning right -
  // Bob is the same in the rig's own space whichever way it is flipped, Inertia is not
  const run = async (leftHanded, yaw) => {
    const rig = await pistolRig({ right: createPistolet(), left: createPistolet(), leftHanded, size: [1280, 800] });
    const head = new LookFilter();
    rig.walk.on = true;
    const rows = [];
    for (let i = 0; i < 80; i++) {
      if (i >= 40) { rig.walk.on = false; head.add(yaw, 0); }
      rows.push((await rig.frame()).map((q) => ({ hand: q.uv ? 'mirrored' : 'plain', rect: q.rect })));
    }
    return rows;
  };
  const rh = await run(false, 0.02), lh = await run(true, -0.02);
  for (let f = 0; f < 80; f++) {
    for (const q of lh[f]) {
      const twin = rh[f].find((x) => x.hand === q.hand ? false : true);
      assert.ok(twin, 'a twin across the middle');
      assert.ok(Math.abs(q.rect.x - (1280 - (twin.rect.x + twin.rect.w))) < 1e-6 && Math.abs(q.rect.y - twin.rect.y) < 1e-6, `frame ${f}: the mirror`);
    }
  }
});

test('D11: ONE PISTOL IN THE LEFT HAND is drawn as DFU draws the weapon in use - on the Handedness side, its picture unmirrored, at the unmirrored rect (mutant: the picture mirrored by the hand)', async () => {
  const rig = await pistolRig({ left: createPistolet() });
  rig.r.switchHand();   // H: the left hand in use - the one that holds the weapon
  await rig.frame();
  assert.equal(rig.r.playerWeapon.pistols?.lead, 'L', 'the left pistol leads');
  const q = (await rig.frame())[0];
  assert.ok(q, 'drawn');
  assert.ok(!q.uv, 'its picture as painted');
  assert.ok(q.rect.x > 160, 'on the right of the screen');
});

test('D11: THE CHARACTER\'S SPEED EASES THE DIP - the Offset module\'s pace is the live Speed\'s, as the page\'s Speed slider sets it (the game\'s input) (mutants: the speed ignored, or fixed)', async () => {
  const yAt = async (speed) => {
    const rig = await pistolRig({ right: createPistolet() });
    rig.entity.stats.speed = speed;
    await rig.frame();
    rig.r.clickAttack();
    let q;
    // PISTOL-RAISE: 31 frames, while both are still on their way down - at the owner's -60 a fast pistol is off the
    // screen's bottom by frame 40, and a dip that has finished cannot show its pace
    for (let i = 0; i < 31; i++) q = await rig.frame();
    return q[0].rect.y;
  };
  const slow = await yAt(20), fast = await yAt(90);
  assert.ok(fast - slow > 20, `a fast character's pistol is lower 31 frames in (${slow.toFixed(1)} at Speed 20, ${fast.toFixed(1)} at 90)`);
});

test('D7: THE PAGE\'S CLACKS - its open clip at 0.9, then its close clip at 0.95, through its own wiring (mutant: the clips swapped)', () => {
  const state = pistolPageState();
  const pair = createPair({ fps: state.fps, cooldownMs: state.cool, hitFrame: state.hit });
  const hands = VM.createPistolHands(), played = [];
  pair.pull(0);
  for (let i = 0; i < 150; i++) {
    pair.step(DT);
    pistolPageStep(hands, pair, state, DT, { drawn: pair.hands(), screen: { width: 1280, height: 800 }, play: (clip, gain) => played.push([clip, gain]) });
  }
  assert.deepEqual(played, [[state.sfxOpen, 0.9], [state.sfxClose, 0.95]]);
  assert.notEqual(state.sfxOpen, state.sfxClose);
});

test('D12: A PAIR BROKEN MID-RELOAD - the Morrowind arm takes the pump of the pistol still in hand, never the last one fired if it has left the hand (mutant: the arm off `last` alone)', async () => {
  const poses = [];
  const was = fpArm.setGunFeel;
  fpArm.setGunFeel = (pose) => { poses.push(pose); return was?.call(fpArm, pose); };
  try {
    const rig = await pistolRig({ right: createPistolet(), left: createPistolet() });
    rig.r.clickAttack(); for (let i = 0; i < 3; i++) await rig.frame();
    rig.r.clickAttack(); for (let i = 0; i < 40; i++) await rig.frame();   // both fired, both reloading - the left last
    const slots = rig.entity.equip.slots, key = Object.keys(slots).find((k) => slots[k] === rig.r.playerWeapon.currentLeftHandWeapon);
    slots[key] = null; rig.r.refreshWorn();   // the left pistol taken off: one pistol, the right, still reloading
    await rig.frame();
    assert.equal(rig.r.playerWeapon.pistols.hands().join(), 'R');
    assert.equal(rig.r.playerWeapon.pistols.R.state, 'Cooling');
    const R = rig.r.playerWeapon.pistols.R;
    for (let i = 0; i < 20; i++) {
      poses.length = 0;
      await rig.frame();
      const want = armGunPose(0, R.state === 'Cooling' ? R.cooledMs / R.cooldownMs : null).down;   // the drop is the reload's alone
      assert.ok(Math.abs(poses.at(-1).down - want) < 1e-9, `frame ${i}: the arm pumps on the right pistol's own reload`);
    }
  } finally {
    fpArm.setGunFeel = was;
  }
});

test('B1 B6 B8: THE LABS\' STAND-IN MOTOR MOVES AS THE GAME\'S - a crouched walk at the motor\'s crouch speed, a strafe alone at the walk\'s, a step and a strafe each at the diagonal .7071, a jump in the air, and the speed ratio PlayerMotor.Speed over the walk, standing or not (the hosts\' `speedField`) (mutants: the crouch at the walk\'s speed; a strafe that needs a walk; no diagonal; never airborne; the ratio of the step)', () => {
  const base = walkSpeed(50);
  const crouch = gunMotion({ walking: true, crouching: true });
  assert.equal(crouch.localVel[2], crouchSpeed(50));
  assert.equal(crouch.speedRatio, crouchSpeed(50) / base);
  const strafe = gunMotion({ strafe: -1 });
  assert.deepEqual(strafe.localVel, [-base, 0, 0]);
  assert.equal(strafe.standing, false);
  const both = gunMotion({ walking: true, strafe: 1 });
  assert.deepEqual(both.localVel, [base * DIAGONAL_FACTOR, 0, base * DIAGONAL_FACTOR]);
  const air = gunMotion({ vertical: 2 });
  assert.deepEqual([air.grounded, air.standing, air.localVel[1]], [false, false, 2]);
  const still = gunMotion({});
  assert.deepEqual([still.grounded, still.standing, still.speedRatio], [true, true, 1], 'standing: the walk\'s Speed all the same - never nought');
});

test('B1: THE PAGE\'S JUMP IS THE MOTOR\'S - JUMP_SPEED up, GRAVITY down, airborne until it lands (the identity pins run one curve on both sides, so the curve is held here) (mutant: a flat jump)', () => {
  assert.equal(pistolJumpClimb(0), JUMP_SPEED);
  assert.equal(pistolJumpClimb(0.1), JUMP_SPEED - GRAVITY * 0.1);
  assert.ok(pistolJumpClimb(JUMP_SPEED / GRAVITY + 0.05) < 0, 'falling on the way down');
  assert.equal(pistolJumpClimb(2 * JUMP_SPEED / GRAVITY), null, 'landed');
  assert.equal(pistolJumpClimb(-1), null, 'on the ground');
});
