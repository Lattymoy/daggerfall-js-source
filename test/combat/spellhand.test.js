// SPELL-HAND (2026-10-23, the owner: "Using the spell hand and any 1 handed weapon in tandem. Basically being able to cast
// one handed spells and visually seeing the one handed spell sprite hand/morrowind"; "Make the best decisions";
// bible/05-Combat/Two-Hands.md "The spell hand"). A readied spell in the free hand beside a drawn one-handed weapon: the law
// (combat/twoHands/spellHand.js spellHandOf), the live word the cast's doors read, the swing button the weapon's and the
// cast's own press the spell's (scenes/hostMagic.js interceptAttack, firePending - THE FOUR HOSTS RULE: every host's cast
// press says so), and the classic lane through the real rig: the weapon up, ONE of FPSSpellCasting's hands on the free
// side, the hands taking turns, each lowered under the other's strike; DFU's two-handed cast wherever the hands are full.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPistolet } from '../../src/systems/pistolet.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { handDesc } from '../../src/combat/playerWeapon.js';
import { spellHandOf, spellHandUp, spellHandBusy, tellSpellHand, _resetSpellHand, guardDrop, CAST_PRESS, castPending } from '../../src/combat/twoHands/spellHand.js';
import { fpsSpellCasting, RIGHT_HAND_UV } from '../../src/combat/fpsSpellCasting.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { TEMPLATES } from '../../src/systems/useItem.js';
import { pistolRig } from './weapon/pistolRigHarness.js';
import { fpArm } from '../../src/combat/fpArm.js';
import { TUTORIALS } from '../../src/systems/tutorialCatalogue.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const weapon = (templateIndex, name) => ({ name, group: 'Weapons', templateIndex, material: 0 });
const LONGSWORD = () => weapon(120, 'Longsword');
const DAGGER = () => weapon(113, 'Dagger');
const CLAYMORE = () => weapon(122, 'Claymore');
const LONG_BOW = () => weapon(130, 'Long Bow');
const BUCKLER = { name: 'Buckler', group: 'Armor', templateIndex: 109, material: 0 };
const d = (item) => handDesc(item);

test('SPELL-HAND THE LAW: a one-handed weapon in the hand that fights and NOTHING in the other - the free hand takes the spell; the weapon in the left (H) frees the right; a shield, a second weapon, a light, a two-hander, a bow, the Thunderlock, the fists or the beast keep DFU\'s two-handed cast (mutants: the free hand unread; a two-hander let in; the weapon read off the free hand; the light unread)', () => {
  const sword = d(LONGSWORD());
  assert.deepEqual(spellHandOf({ lead: 'R', right: sword, left: null }), { weaponHand: 'R', spellHand: 'L' });
  assert.deepEqual(spellHandOf({ lead: 'L', right: null, left: sword }), { weaponHand: 'L', spellHand: 'R' }, 'the weapon in the left: the right casts');
  assert.deepEqual(spellHandOf({ lead: 'R', right: d(createPistolet()), left: null }), { weaponHand: 'R', spellHand: 'L' }, 'a Pistolet is one-handed too');
  assert.equal(spellHandOf({ lead: 'R', right: sword, left: { item: BUCKLER, shield: true } }), null, 'a shield in the free hand');
  assert.equal(spellHandOf({ lead: 'R', right: sword, left: null, leftBusy: true }), null, 'a light carried in it');
  assert.equal(spellHandOf({ lead: 'R', right: sword, left: d(DAGGER()) }), null, 'a pair: both hands up');
  assert.equal(spellHandOf({ lead: 'R', right: null, left: null }), null, 'the fists');
  assert.equal(spellHandOf({ lead: 'R', right: d(CLAYMORE()), left: null }), null, 'a two-hander');
  assert.equal(spellHandOf({ lead: 'R', right: d(LONG_BOW()), left: null }), null, 'a bow');
  assert.equal(spellHandOf({ lead: 'R', right: d(createThunderlock()), left: null }), null, 'the Thunderlock');
  assert.equal(spellHandOf({ lead: 'L', right: sword, left: null }), null, 'the hand that fights is empty (H to the bare left): its fist and DFU\'s cast');
  // AUDIT SPELL-HAND L5-10: the beast's line was this one twice (`right` and `left` null) and pinned nothing of its own -
  // MorphSelf empties both hand slots, so the beast IS the fists' line above; its rig is DFU's (the claws, one hand)
});

test('SPELL-HAND THE LIVE WORD: the rig\'s once-a-frame word, read by the cast\'s doors - up, and busy only while up (mutants: busy without up; the word never kept)', () => {
  _resetSpellHand();
  assert.deepEqual([spellHandUp(), spellHandBusy()], [false, false]);
  tellSpellHand({ up: true, busy: false });
  assert.deepEqual([spellHandUp(), spellHandBusy()], [true, false]);
  tellSpellHand({ up: true, busy: true });
  assert.deepEqual([spellHandUp(), spellHandBusy()], [true, true]);
  tellSpellHand({ up: false, busy: true });
  assert.deepEqual([spellHandUp(), spellHandBusy()], [false, false], 'a blow with no spell hand holds no cast');
  _resetSpellHand();
  assert.equal(guardDrop(1, 100), 12, 'the guard: GUARD.LOWER of the picture\'s own height');
  assert.equal(guardDrop(0, 100), 0);
});

test('SPELL-HAND THE CAST\'S DOORS (scenes/hostMagic.js): with the spell hand up the SWING button is the weapon\'s - interceptAttack lets it through - and a cast\'s own press still casts; a cast pressed while the weapon is mid-blow WAITS and leaves when the blow ends, never dropped; without the spell hand the click casts as ever (mutants: the swing door eating the click; the cast door refused; the wait dropping the press)', () => {
  const player = { isPlayer: true, level: 1, magicka: 100, maxMagicka: 100, skills: new Array(35).fill(30), stats: { intelligence: 50, willpower: 50 }, items: [], activeEffects: [] };
  const sinks = { damage() {}, heal() {} };
  const engine = () => createPlayerMagic({ renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} }, getTexture: async () => null, uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: player, playerSinks: sinks, say() {}, surfacePlayer() {},
    foes: () => [], foeSinks: () => sinks, absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99 });
  const spell = { name: 'Fire', rangeType: 2, element: 0, effects: [] };
  try {
    _resetSpellHand();
    const plain = engine();
    plain.takeReady({ sp: spell, free: true });
    assert.equal(plain.interceptAttack(true), true, 'no spell hand: the swing button casts (M2)');
    const magic = engine();
    magic.takeReady({ sp: spell, free: true });
    tellSpellHand({ up: true, busy: false });
    assert.equal(magic.interceptAttack(true), false, 'the spell hand up: the swing is the weapon\'s');
    assert.equal(magic.readied(), spell, 'and the spell stays readied');
    assert.equal(magic.interceptAttack(true, { cast: true }), true, 'the cast\'s own press casts');
    // the press mid-blow waits, then leaves
    tellSpellHand({ up: true, busy: true });
    assert.equal(magic.firePending([0, 1.7, 0], [0, 0, 1]), false, 'the weapon mid-blow: the cast waits');
    assert.equal(magic.spellArmed(), true, 'kept, never dropped');
    tellSpellHand({ up: true, busy: false });
    magic.firePending([0, 1.7, 0], [0, 0, 1]);
    assert.equal(magic.spellArmed(), false, 'the blow over: the cast left');
  } finally { _resetSpellHand(); }
});

test('SPELL-HAND THE FOUR HOSTS RULE: every cast press is a cast\'s own - ActivateCenterObject\'s in the street (world.js, exterior.js), indoors and in the dungeon (worldModes.js), the fixed dungeon (dungeon.js) and the hotbar - and the dungeon\'s attack door never swings on one; no swing button says it is a cast (mutants: a host\'s cast press unsaid; the dungeon swinging on a cast press)', () => {
  // PIN MOVED (AUDIT SPELL-HAND, HOST-SPLIT): the press is the imported word CAST_PRESS (combat/twoHands/spellHand.js, handed to the hosts by scenes/hostMagic.js - TWO-HANDS' FOUR HOSTS read no two-hands module) and the
  // dungeon's door takes its `cast` positionally - an option object was an entry each host grew by (was: `{ cast: true }`)
  const casts = (file) => (src(file).match(/interceptAttack\?*\.?\(true, CAST_PRESS\)/g) ?? []).length;
  assert.equal(casts('src/scenes/world.js'), 1, 'world.js: the activate press');
  assert.equal(casts('src/scenes/exterior.js'), 1, 'exterior.js');
  assert.equal(casts('src/scenes/worldModes.js'), 1, 'worldModes.js: the interior');
  assert.equal(casts('src/systems/quickslots.js'), 1, 'the hotbar');
  assert.match(src('src/scenes/worldModes.js'), /dungeonCtx\?\.playerAttackInput\?\.\(0, 0, true, true\)/, 'worldModes.js: the dungeon\'s');
  assert.match(src('src/scenes/dungeon.js'), /if \(_act\.cast\) ctx\.playerAttackInput\(0, 0, true, true\)/, 'the fixed dungeon\'s');
  assert.match(src('src/scenes/dungeonContext.js'), /function playerAttackInput\(dx, dy, held, cast = false\)[^\n]*\n(?:[^\n]*\n){0,8}?\s+if \(magic\.interceptAttack\(held, cast \? CAST_PRESS : undefined\) \|\| cast\) return;/, 'a cast press in the dungeon never swings');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/dungeon.js']) {
    assert.equal((src(f).match(/isSwingButton\([^)]*\)[^\n]*interceptAttack\([^)]*CAST_PRESS/g) ?? []).length, 0, `${f}: no swing button casts as a cast`);
  }
  // AUDIT SPELL-HAND L4-9: the stick-half tap (TS1) is the lock pick and nothing below it - never a cast, in every host
  assert.match(src('src/scenes/world.js'), /hasReadySpell: magic\.spellArmed\(\) && !_tapLockOnly,/);
  assert.match(src('src/scenes/exterior.js'), /hasReadySpell: magic\.spellArmed\(\) && !_tapLockOnly,/);
  assert.match(src('src/scenes/dungeon.js'), /hasReadySpell: \(ctx\.spellArmed\?\.\(\) \?\? false\) && !_tapLockOnly,/);
  assert.match(src('src/scenes/worldModes.js'), /hasReadySpell: \(\(mode === 'dungeon' \? dungeonCtx\?\.spellArmed\?\.\(\) : magic\?\.spellArmed\(\)\) \?\? false\) && !host\.activateLockOnly\?\.\(\),/);
  // AUDIT SPELL-HAND L4-6: a kept press never leaves under a window - every host hands its own pause word
  assert.match(src('src/scenes/world.js'), /magic\.firePending\(\[\.\.\.cam\.pos\], _mfwd, gamePaused\(\)\);/);
  assert.match(src('src/scenes/exterior.js'), /magic\.firePending\(\[\.\.\.cam\.pos\], _mfwd, gamePaused\(\)\);/);
  assert.match(src('src/scenes/worldModes.js'), /magic\.firePending\(\[\.\.\.cam\.pos\], eyeDir\(\), overlayHeld\);/);
  assert.match(src('src/scenes/dungeonContext.js'), /magic\.firePending\(eye, \[-aimed\[2\], -aimed\[6\], -aimed\[10\]\], !!opts\.breathHeld\?\.\(\)\);/);
});

// ---- THE CLASSIC LANE, THROUGH THE REAL RIG -------------------------------------------------------------------------

/** A WEAPON CIF (the two-hands suite's) and a casting CIF (the readied hands suite's: six single-frame records). */
function meleeCif() {
  const parts = Array.from({ length: 7 }, () => {
    const w = 120, h = 100, head = 12 + 31 * 2 + 2, runs = Math.ceil((w * h) / 127) + 1;
    const b = new Uint8Array(head + runs * 2); const v = new DataView(b.buffer);
    v.setUint16(0, w, true); v.setUint16(2, h, true);
    for (let f = 0; f < 5; f++) v.setUint16(12 + f * 2, head, true);
    for (let k = 0; k < runs; k++) b[head + k * 2] = 255;
    v.setUint16(12 + 62, b.length, true);
    return b;
  });
  const wield = new Uint8Array(12 + 40 * 30); const wv = new DataView(wield.buffer);
  wv.setUint16(4, 40, true); wv.setUint16(6, 30, true); wv.setUint16(10, 40 * 30, true); wield.fill(1, 12);
  const all = [wield, ...parts];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0)); let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}
function castCif() {
  const parts = [];
  for (let r = 0; r < 6; r++) {
    const w = 60 + r, h = 80;
    const b = new Uint8Array(12 + w * h); const v = new DataView(b.buffer);
    v.setInt16(4, w, true); v.setInt16(6, h, true); v.setUint16(8, 0, true); v.setUint16(10, w * h, true);
    b.fill(1, 12);
    parts.push(b);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
const MELEE = meleeCif(), CAST = castCif();
const ART = (name) => (/C6\.CIF$/.test(name) ? CAST : MELEE);
const FIRE = Object.freeze({ name: 'Fireball', rangeType: 2, element: 0 });
const isHand = (q) => String(q.tex).startsWith('fpsc:');
const isWeapon = (q) => !isHand(q);
const mirrored = (q) => q.uv?.u0 === RIGHT_HAND_UV.u0 && q.uv?.u1 === RIGHT_HAND_UV.u1;

/** A rig wearing `right`/`left` and a spell the pin readies; `aborted` counts the abort door. */
async function spellRig({ right = LONGSWORD(), left = null, leftHanded = false, widget = {} } = {}) {
  const ready = { spell: null }, aborted = { n: 0 };
  const rig = await pistolRig({ right, left, leftHanded, widget, cif: ART, spellArmed: () => ready.spell != null, readiedSpell: () => ready.spell, abortSpell: () => { aborted.n++; ready.spell = null; } });
  return { ...rig, ready, aborted };
}
const settle = async (frame, n = 40) => { let q = []; for (let i = 0; i < n; i++) q = await frame(); return q; };

test('SPELL-HAND THE RIG: a spell readied beside a drawn longsword - the weapon stays up and ONE readied hand (the casting art\'s frame 0) stands on the free side, as painted; the swing button swings the weapon with the spell still readied, the readied hand lowered under the blow; without a spell the weapon alone (mutants: shown()\'s spell leg; the swing refused; both hands drawn; the hand on the weapon\'s side; no guard)', async () => {
  try {
    const { r, frame, ready } = await spellRig();
    let q = await settle(frame);
    assert.deepEqual([q.filter(isWeapon).length, q.filter(isHand).length], [1, 0], 'no spell: the weapon alone');
    ready.spell = FIRE;
    q = await settle(frame);
    assert.equal(q.filter(isWeapon).length, 1, 'the weapon stays up');
    const hands = q.filter(isHand);
    assert.equal(hands.length, 1, 'one hand holds the spell');
    assert.equal(hands[0].tex, 'fpsc:FIRE00C6.CIF:0', 'the readied frame');
    assert.ok(hands[0].rect.x + hands[0].rect.w / 2 < 160 && !mirrored(hands[0]), 'the free hand on the left, as painted');
    assert.equal(spellHandUp(), true, 'the cast\'s doors told');
    const rest = hands[0].rect.y;
    let swung = false, lowered = -Infinity;
    for (let i = 0; i < 40; i++) {
      q = await frame(1 / 60, i < 2);
      if (r.playerWeapon.machine.state !== 'Idle') swung = true;
      const h = q.find(isHand);
      if (h) lowered = Math.max(lowered, h.rect.y);
    }
    assert.ok(swung, 'the weapon swung with the spell readied');
    assert.equal(ready.spell, FIRE, 'the spell still readied');
    assert.ok(lowered > rest + 1, `the readied hand lowers under the blow (${rest.toFixed(1)} -> ${lowered.toFixed(1)})`);
  } finally { _resetSpellHand(); }
});

test('SPELL-HAND THE RIG, THE CAST: one hand plays the cast\'s frames on the free side while the weapon lowers under it (GUARD.LOWER of its own height), no swing starts while the hands play, and the weapon comes back up after (mutants: the cast on both hands; the weapon not lowered; a swing over the cast)', async () => {
  try {
    const { r, frame, ready } = await spellRig();
    ready.spell = FIRE;
    let q = await settle(frame);
    const weaponRest = q.find(isWeapon).rect.y, weaponH = q.find(isWeapon).rect.h;
    assert.equal(r.castSpellAnim(2, 0, () => { ready.spell = null; }), true, 'the cast\'s hands start');
    const frames = new Set();
    let weaponLow = -Infinity, swungUnderCast = false;
    for (let i = 0; i < 60 && (fpsSpellCasting.isPlayingAnim || i < 2); i++) {
      q = await frame(1 / 60, true);
      if (fpsSpellCasting.isPlayingAnim) {
        assert.ok(q.filter(isHand).length <= 1, 'one hand casts');
        for (const h of q.filter(isHand)) { frames.add(h.tex); assert.ok(!mirrored(h), 'on the free side'); }
        if (r.playerWeapon.machine.state !== 'Idle') swungUnderCast = true;
        weaponLow = Math.max(weaponLow, q.find(isWeapon)?.rect.y ?? -Infinity);
      }
    }
    assert.ok(frames.size >= 4, `the cast's frames played (${[...frames].join(', ')})`);
    assert.equal(swungUnderCast, false, 'the hands take turns: no swing under the cast');
    assert.ok(weaponLow >= weaponRest + 0.9 * GUARD_DROP(weaponH) && weaponLow <= weaponRest + GUARD_DROP(weaponH) + 1e-6, `the weapon lowers by its guard, a share of its own height (${weaponRest.toFixed(1)} -> ${weaponLow.toFixed(1)}, ${weaponH} tall)`);
    q = await settle(frame, 150);   // the button held through the cast swings once the hands are free - let it end
    assert.equal(r.playerWeapon.machine.state, 'Idle');
    assert.ok(Math.abs(q.find(isWeapon).rect.y - weaponRest) < 0.5, 'and back up after');
  } finally { _resetSpellHand(); }
});
const GUARD_DROP = (h) => guardDrop(1, h);

test('SPELL-HAND THE RIG, Z: with the hands able to hold the spell beside the weapon, sheathing keeps the spell - DFU\'s two hands then hold it - and drawing again puts it back in the free hand; never mid-cast; where the hands cannot (a two-hander) Z puts the spell away, DFU\'s (mutants: the abort kept; the toggle mid-cast)', async () => {
  try {
    const one = await spellRig();
    one.ready.spell = FIRE;
    await settle(one.frame);
    assert.equal(one.r.readyWeapon(), true);
    let q = await settle(one.frame);
    assert.equal(one.aborted.n, 0, 'the spell kept');
    assert.equal(one.r.playerWeapon.sheathed, true);
    assert.deepEqual([q.filter(isWeapon).length, q.filter(isHand).length], [0, 2], 'sheathed: DFU\'s two readied hands');
    assert.equal(one.r.readyWeapon(), true);
    q = await settle(one.frame);
    assert.deepEqual([q.filter(isWeapon).length, q.filter(isHand).length], [1, 1], 'drawn: the weapon and the one hand');
    one.r.castSpellAnim(2, 0, () => {});
    await one.frame();
    assert.equal(one.r.readyWeapon(), false, 'never mid-cast');
    const two = await spellRig({ right: CLAYMORE() });
    two.ready.spell = FIRE;
    await settle(two.frame);
    two.r.readyWeapon();
    assert.equal(two.aborted.n, 1, 'a two-hander: Z puts the spell away (AbortReadySpell)');
  } finally { _resetSpellHand(); }
});

test('SPELL-HAND THE RIG, DFU WHERE THE HANDS ARE FULL: a two-hander, a shield beside the sword, or a pair - a readied spell hides the weapon and BOTH readied hands stand, the swing button the cast\'s (mutants: the spell hand let in; the two-handed draw lost)', async () => {
  try {
    for (const [name, right, left] of [['a two-hander', CLAYMORE(), null], ['a shield', LONGSWORD(), BUCKLER], ['a pair', LONGSWORD(), DAGGER()]]) {
      const { r, frame, ready } = await spellRig({ right, left });
      ready.spell = FIRE;
      const q = await settle(frame);
      assert.equal(q.filter(isWeapon).length, 0, `${name}: the weapon down`);
      assert.equal(q.filter(isHand).length, 2, `${name}: both hands`);
      assert.equal(spellHandUp(), false, `${name}: no spell hand`);
      // AUDIT SPELL-HAND L5-10: the swing button PRESSED - it is the cast's, never a blow (it was asserted unpressed)
      await frame(1 / 60, true); await frame(1 / 60, true);
      assert.equal(r.playerWeapon.machine.state, 'Idle', `${name}: the swing button swings nothing`);
    }
  } finally { _resetSpellHand(); }
});

test('SPELL-HAND THE RIG, THE SIDES: a left-handed player\'s weapon is on the left, so the spell hand stands on the right - AlignRightHand\'s rect, the art mirrored; a Pistolet beside the spell lowers under the cast as a blade does (mutants: the side fixed; the pistol\'s guard unasked)', async () => {
  try {
    const lh = await spellRig({ leftHanded: true });
    lh.ready.spell = FIRE;
    const q = await settle(lh.frame);
    const h = q.find(isHand), w = q.find(isWeapon);
    assert.ok(h && w, 'both drawn');
    assert.ok(h.rect.x + h.rect.w / 2 > 160 && mirrored(h), 'the spell hand on the right, mirrored');
    const gun = await spellRig({ right: createPistolet() });
    gun.ready.spell = FIRE;
    let g = await settle(gun.frame);
    const rest = g.find(isWeapon).rect.y;
    gun.r.castSpellAnim(2, 0, () => { gun.ready.spell = null; });
    let low = -Infinity;
    for (let i = 0; i < 20; i++) { g = await gun.frame(); low = Math.max(low, g.find(isWeapon)?.rect.y ?? -Infinity); }
    assert.ok(low > rest + 2, `the pistol lowers under the cast (${rest.toFixed(1)} -> ${low.toFixed(1)})`);
  } finally { _resetSpellHand(); }
});

/** The Morrowind arm stubbed to the contract the rig reads (fpArm.js castSpell/castInFlight/takeCastRelease/shotBusy/
 *  setSpellHand): `arm.casting` its spellcast section, `arm.release` its "<type> release" key, `arm.busy` a blow or draw. */
function stubArm() {
  const saved = {}, arm = { casting: false, release: false, busy: false, told: [] };
  for (const k of Object.keys(fpArm)) if (typeof fpArm[k] === 'function') { saved[k] = fpArm[k]; fpArm[k] = () => undefined; }
  fpArm.ready = () => true; fpArm.active = () => true; fpArm.thirdActive = () => false;
  fpArm.castSpell = () => { arm.casting = true; return true; };
  fpArm.castInFlight = () => arm.casting;
  fpArm.takeCastRelease = () => { const r = arm.release; arm.release = false; return r; };
  fpArm.shotBusy = () => arm.busy;
  fpArm.setSpellHand = (on) => { arm.told.push(!!on); };
  fpArm.attack = () => true;
  arm.restore = () => Object.assign(fpArm, saved);
  return arm;
}

test('SPELL-HAND UNDER THE MORROWIND ARM THE HANDS TAKE TURNS ON THE ARM\'S CLOCK: its cast outlasts the classic frames (the spell leaves on its "<type> release", MW-CAST1) - the spell hand stays up and the weapon in hand to the cast\'s end, and no blow (drag or touch) and no Z starts until the arm\'s hands are free; then the hand goes down and the weapon swings (mutants: the hand dropped at the classic frames\' end; a swing, a touch blow or a Z over the arm\'s cast)', async () => {
  const arm = stubArm();
  try {
    const { r, frame, ready } = await spellRig();
    ready.spell = FIRE;
    await settle(frame);
    assert.equal(arm.told.at(-1), true, 'the arm told: the spell in the free hand');
    assert.equal(r.castSpellAnim(2, 0, () => { ready.spell = null; }), true);
    for (let i = 0; i < 60 && fpsSpellCasting.isPlayingAnim; i++) await frame();
    assert.equal(fpsSpellCasting.isPlayingAnim, false, 'the classic frames are over');
    assert.equal(fpsSpellCasting.releaseHeld, true, 'the spell still waits on the arm\'s key');
    arm.release = true;
    await frame();
    assert.equal(ready.spell, null, 'the spell left on the arm\'s release - nothing but the arm\'s cast holds the hand now');
    for (let i = 0; i < 10; i++) await frame(1 / 60, true);
    assert.equal(arm.told.at(-1), true, 'the weapon kept in hand through the arm\'s cast');
    assert.equal(spellHandUp(), true);
    assert.equal(r.playerWeapon.machine.state, 'Idle', 'the drag waits for the arm');
    r.clickAttack();
    assert.equal(r.playerWeapon.machine.state, 'Idle', 'the probes\' door waits (AUDIT SPELL-HAND L4-10: the touch button is the latch - the drag\'s, above)');
    assert.equal(r.readyWeapon(), false, 'Z waits');
    arm.casting = false;
    await frame(1 / 60, true);
    assert.equal(arm.told.at(-1), false, 'the cast over: the spell hand down');
    let swung = false;
    for (let i = 0; i < 10; i++) { await frame(1 / 60, true); if (r.playerWeapon.machine.state !== 'Idle') swung = true; }
    assert.ok(swung, 'and the weapon swings');
  } finally { arm.restore(); _resetSpellHand(); }
});

test('SPELL-HAND THE BUSY WORD IS THE HANDS\' WHOLE STRIKE: a blow begun this frame is in flight for the cast door the hosts ask before the next, and under the Morrowind arm its blow or draw still playing past the machine holds a cast too (mutants: the word told only at the frame\'s top; the arm\'s blow unread; the frame\'s word blind to hands that fit)', async () => {
  const arm = stubArm();
  try {
    const { r, frame, ready } = await spellRig();
    ready.spell = FIRE;
    await settle(frame);
    assert.equal(spellHandBusy(), false);
    await frame(1 / 60, true);
    assert.notEqual(r.playerWeapon.machine.state, 'Idle', 'the swing began this frame');
    assert.equal(spellHandBusy(), true, 'told at once - the hosts\' next cast door waits');
    await settle(frame, 150);
    assert.equal(r.playerWeapon.machine.state, 'Idle');
    assert.equal(spellHandBusy(), false, 'the blow over');
    arm.busy = true;
    await frame();
    assert.equal(spellHandBusy(), true, 'the arm\'s blow still playing holds the cast');
    arm.busy = false;
    await frame();
    assert.equal(spellHandBusy(), false);
    // AUDIT SPELL-HAND L2-2: no spell readied yet, the hands FIT - a blow is busy on every frame of it, not only its
    // first: the hotbar's ready-and-cast and CasterOnly's instant cast, coming mid-blow, wait on it
    ready.spell = null;
    await settle(frame, 30);
    await frame(1 / 60, true);
    await frame(); await frame();
    assert.notEqual(r.playerWeapon.machine.state, 'Idle', 'still mid-blow');
    assert.equal(spellHandUp(), false, 'no spell in the hand');
    assert.equal(spellHandBusy(), true, 'the frame\'s own word says the fitting hands are busy');
  } finally { arm.restore(); _resetSpellHand(); }
});

// ---- AUDIT SPELL-HAND (bible/01-Overview/audits/Audit-Mixed-Pair-Spell-Hand.md) ---------------------------------------

const audPlayer = () => ({ isPlayer: true, level: 1, magicka: 1000, maxMagicka: 1000, skills: new Array(35).fill(30), stats: { intelligence: 50, willpower: 50 }, items: [], activeEffects: [] });
/** A magic engine whose cast's hands are the rig's (`rigOf().r.castSpellAnim`), as every host wires it; `casts` counts them. */
function audEngine(rigOf, player = audPlayer()) {
  const sinks = { damage() {}, heal() {} };
  const casts = { n: 0 };
  const magic = createPlayerMagic({ renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} }, getTexture: async () => null, uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: player, playerSinks: sinks, say() {}, surfacePlayer() {},
    foes: () => [], foeSinks: () => sinks, absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99,
    startCastAnim: (sp, onRelease) => { casts.n++; return rigOf()?.r.castSpellAnim(sp.rangeType, sp.element ?? 0, onRelease) ?? false; } });
  return { magic, casts };
}
const SP_FIRE = { name: 'Fire', rangeType: 2, element: 0, effects: [] };
const EYE = [0, 1.7, 0], DIR = [0, 0, 1];

test('SPELL-HAND AUDIT L4-1, THE HELD SWING NEVER STARVES THE CAST: the swing button held (WeaponSwingMode 2, the default - a blow after a blow) and a cast pressed mid-blow - the blow ends, no new blow starts while the press waits, the cast leaves, then the held blows go on (mutant: the waiting press unread by the swing\'s gate)', async () => {
  try {
    let rig = null;
    const { magic, casts } = audEngine(() => rig);
    rig = await pistolRig({ right: LONGSWORD(), cif: ART, spellArmed: () => magic.spellArmed(), readiedSpell: () => magic.readied(), abortSpell: () => magic.abortReadySpell() });
    magic.takeReady({ sp: SP_FIRE, free: true });
    const step = (held) => { magic.firePending(EYE, DIR); return rig.frame(1 / 60, held); };
    for (let i = 0; i < 30; i++) await step(false);
    assert.equal(spellHandUp(), true);
    let leftAt = -1, swingsAfter = 0, last = 'Idle';
    for (let i = 0; i < 400; i++) {
      await step(true);
      if (i === 5) assert.equal(magic.interceptAttack(true, CAST_PRESS), true, 'the press, mid-blow');
      const st = rig.r.playerWeapon.machine.state;
      if (leftAt >= 0 && st !== 'Idle' && last === 'Idle') swingsAfter++;
      last = st;
      if (leftAt < 0 && casts.n > 0) leftAt = i;
    }
    assert.ok(leftAt > 5 && leftAt < 100, `the cast left once the blow in flight ended (frame ${leftAt}), the button held throughout`);
    assert.ok(swingsAfter >= 2, `and the held blows went on after it (${swingsAfter})`);
  } finally { _resetSpellHand(); }
});

test('SPELL-HAND AUDIT L2-2 / L4-6, THE PRESS KEPT AND MANAGED: a spell readied THIS moment beside a blow (the hotbar\'s ready-and-cast) waits as a readied one does, and a CasterOnly instant cast waits for the blow too; a press waiting is the spell\'s it was made for - a new ready drops it, AbortSpell drops it (and HasReadySpell with it), a door hands it over with the spell, a window holds it (mutants: the fresh ready\'s fit unread; the instant cast unparked; the press outliving its spell, its abort, its door; the window unread)', () => {
  try {
    _resetSpellHand();
    // the hotbar: readied and pressed in one call, the rig having never seen the spell - the hands FIT, mid-blow
    const a = audEngine(() => null).magic;
    tellSpellHand({ up: false, fits: true, busy: true });
    a.takeReady({ sp: SP_FIRE, free: true });
    assert.equal(a.interceptAttack(true, CAST_PRESS), true);
    assert.equal(a.firePending(EYE, DIR), false, 'mid-blow: it waits');
    assert.equal(castPending(), true, 'and says so to the swing\'s gate');
    tellSpellHand({ up: true, fits: true, busy: false });
    a.firePending(EYE, DIR);
    assert.equal(a.spellArmed(), false, 'the blow over: it left');
    assert.equal(castPending(), false);
    // a CasterOnly instant cast beside a blow waits for it
    let played = 0;
    const b = audEngine(() => ({ r: { castSpellAnim: () => { played++; return true; } } })).magic;
    tellSpellHand({ up: false, fits: true, busy: true });
    b.readySpell?.({ name: 'Heal', rangeType: 0, element: 4, effects: [] }, { free: true });
    assert.equal(played, 0, 'the instant cast waits for the blow');
    assert.equal(castPending(), true);
    tellSpellHand({ up: true, fits: true, busy: false });
    b.firePending(EYE, DIR);
    assert.equal(played, 1, 'and leaves after it');
    // the press is its spell's: a new ready drops it; AbortSpell drops it and HasReadySpell with it
    const c = audEngine(() => null).magic;
    tellSpellHand({ up: true, fits: true, busy: true });
    c.takeReady({ sp: SP_FIRE, free: true });
    c.interceptAttack(true, CAST_PRESS);
    c.readySpell({ ...SP_FIRE, name: 'Frost', element: 1 }, { free: true });
    assert.equal(castPending(), false, 'a new ready: the old press is gone');
    tellSpellHand({ up: true, fits: true, busy: false });
    assert.equal(c.firePending(EYE, DIR), false, 'and nothing leaves on it');
    tellSpellHand({ up: true, fits: true, busy: true });
    c.interceptAttack(true, CAST_PRESS);
    c.abortReadySpell();
    assert.equal(c.spellArmed(), false, 'AbortSpell: HasReadySpell false at once');
    assert.equal(castPending(), false);
    // a door crossed mid-wait: the press crosses with its spell
    const d = audEngine(() => null).magic, e = audEngine(() => null).magic;
    d.takeReady({ sp: SP_FIRE, free: true });
    d.interceptAttack(true, CAST_PRESS);
    d.handReadyTo(e);
    assert.equal(e.readied(), SP_FIRE);
    assert.equal(e.spellArmed(), true, 'the press came across');
    // a window: held, then it leaves as the window closes
    tellSpellHand({ up: true, fits: true, busy: false });
    assert.equal(e.firePending(EYE, DIR, true), false, 'under a window: it waits');
    assert.equal(e.spellArmed(), true);
    e.firePending(EYE, DIR, false);
    assert.equal(e.spellArmed(), false, 'the window closed: it left');
  } finally { _resetSpellHand(); }
});

test('SPELL-HAND AUDIT L2-4 / L2-5 / L4-5, THE CAST\'S HANDS ARE ITS OWN: decided as it starts - H refused mid-cast (DFU\'s Update returns before ToggleHand while IsPlayingAnim), a swap delay ending mid two-handed cast leaves it two-handed; the free hand\'s cast frames stand on UpdateSpellCast\'s own rect (no guard carried in); on a wall the spell is DFU\'s (mutants: H mid-cast; the cast leg raising the hand; the guard on the cast frames; the climb unread)', async () => {
  try {
    const one = await spellRig();
    one.ready.spell = FIRE;
    await settle(one.frame);
    await one.frame(1 / 60, true);   // a blow, so the readied hand carries its guard into the cast
    for (let i = 0; i < 240 && one.r.playerWeapon.machine.state !== 'Idle'; i++) await one.frame();
    assert.equal(one.r.playerWeapon.machine.state, 'Idle', 'the blow ended - H is the cast\'s to refuse, not the blow\'s');
    assert.equal(one.r.castSpellAnim(2, 0, () => {}), true);
    let q = await one.frame();
    assert.equal(one.r.switchHand(), false, 'H mid-cast: refused');
    const castFrames = [];
    for (let i = 0; i < 40 && fpsSpellCasting.isPlayingAnim; i++) { q = await one.frame(); const h = q.filter(isHand); assert.equal(h.length, 1, 'one hand to the cast\'s end'); if (fpsSpellCasting.isPlayingAnim) castFrames.push(h[0]); }
    // the same cast from a hand never lowered: frame for frame the same rects - the guard is not carried into the cast
    const calm = await spellRig();
    calm.ready.spell = FIRE;
    await settle(calm.frame, 90);
    assert.equal(calm.r.castSpellAnim(2, 0, () => {}), true);
    await calm.frame();
    const calmFrames = [];
    for (let i = 0; i < 40 && fpsSpellCasting.isPlayingAnim; i++) { const cq = await calm.frame(); if (fpsSpellCasting.isPlayingAnim) calmFrames.push(cq.find(isHand)); }
    assert.ok(castFrames.length > 4, `the cast played (${castFrames.length} frames)`);
    assert.deepEqual(castFrames.map((h) => h.rect.y), calmFrames.slice(0, castFrames.length).map((h) => h.rect.y), 'the cast frames on UpdateSpellCast\'s rect, as an unlowered hand\'s');
    // a two-handed cast (a swap delay running as it starts) stays two-handed as the delay ends
    const two = await spellRig();
    two.ready.spell = FIRE;
    await settle(two.frame);
    two.entity.equipCountdown = 5000;   // drains at 980 a second (CH3): still running as the cast starts
    await two.frame();
    assert.ok(two.entity.equipCountdown > 0);
    assert.equal(two.r.castSpellAnim(2, 0, () => {}), true);
    two.entity.equipCountdown = 0;
    for (let i = 0; i < 40 && fpsSpellCasting.isPlayingAnim; i++) { q = await two.frame(); assert.equal(q.filter(isHand).length, 2, 'DFU\'s two hands to the cast\'s end'); }
    // on a wall: DFU's climb hides the weapon - the spell is DFU's, the swing button casts as before
    const wall = await spellRig();
    wall.ready.spell = FIRE;
    await settle(wall.frame);
    assert.equal(spellHandUp(), true);
    wall.walk.climbing = true;
    await wall.frame(); await wall.frame();
    assert.equal(spellHandUp(), false, 'climbing: no spell hand');
  } finally { _resetSpellHand(); }
});

test('SPELL-HAND AUDIT L2-1 / L5-2 / L5-3, THE WEAPON WIDGET: the spell hand stands on the side the clone is not, through the clone\'s Hide wind-up and recovery (its defaults) with the weapon in the left hand - never jumping to the weapon\'s side - and the clone lowers by its guard under the cast (mutants: the side read off the clone only while it draws; the side blind to the clone; the clone unlowered)', async () => {
  try {
    const w = await spellRig({ right: null, left: LONGSWORD(), widget: { Enabled: true } });
    w.r.playerWeapon.usingRightHand = false;   // the longsword in the left, leading - Ambidexterity draws it on the left
    w.ready.spell = FIRE;
    let q = await settle(w.frame, 60);
    const sideOf = (h) => (h.rect.x + h.rect.w / 2 > 160 ? 'R' : 'L');
    const hand0 = q.find(isHand);
    assert.ok(hand0 && sideOf(hand0) === 'R' && mirrored(hand0), 'the weapon on the left: the spell hand on the right, mirrored');
    const sides = new Set();
    for (let i = 0; i < 90; i++) { q = await w.frame(1 / 60, i < 2); const h = q.find(isHand); if (h) sides.add(sideOf(h)); }
    assert.deepEqual([...sides], ['R'], 'through the blow\'s Hide frames: never on the weapon\'s side');
    // the clone under the cast
    const rest = (await settle(w.frame)).find((x) => !isHand(x));
    w.r.castSpellAnim(2, 0, () => {});
    let low = -Infinity;
    for (let i = 0; i < 30 && fpsSpellCasting.isPlayingAnim; i++) { q = await w.frame(); const c = q.find((x) => !isHand(x)); if (c) low = Math.max(low, c.rect.y); }
    assert.ok(rest && low > rest.rect.y + 1, `the clone lowers under the cast (${rest?.rect.y.toFixed(1)} -> ${low.toFixed(1)})`);
  } finally { _resetSpellHand(); }
});

test('SPELL-HAND AUDIT L2-3 / L5-8, A LIGHT PUT AWAY FOR THE SPELL AND A SWAP UNDER WAY: with Handheld Torches on (StowWhenSpellcasting, its default) a torch carried in the free hand is put away for a spell readied - the hand is the spell\'s from the first frame, never DFU\'s two hands for two frames first; a spell readied while a swap delay runs is DFU\'s two hands (mutants: the stow unread - the pop; the swap delay unread)', async () => {
  try {
    const t = await spellRig();
    t.ready.spell = FIRE; await settle(t.frame); t.ready.spell = null; await settle(t.frame);   // the spell's art cached
    const torch = { group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50 };
    t.entity.items.push(torch); t.entity.lightSource = torch;
    await settle(t.frame, 20);
    t.ready.spell = FIRE;
    for (let i = 0; i < 6; i++) {
      const q = await t.frame();
      assert.ok(q.filter(isHand).length <= 1, `frame ${i}: never DFU's two hands (${q.filter(isHand).length})`);
      assert.equal(q.filter((x) => String(x.tex).startsWith('fpw:') || (!isHand(x) && !String(x.tex).startsWith('ht:'))).length >= 1, true, `frame ${i}: the weapon stays up`);
    }
    const s = await spellRig();
    s.ready.spell = FIRE; await settle(s.frame);
    s.entity.equipCountdown = 5000;
    const q = await s.frame();
    assert.deepEqual([q.filter(isHand).length, q.filter(isWeapon).length], [2, 0], 'a swap under way: DFU\'s two hands, the weapon down');
  } finally { _resetSpellHand(); }
});

test('SPELL-HAND AUDIT L3-4 / L4-7, THE ARM\'S CAST HOLDS EVERY HAND, AND A LEAP IS A BLOW: after DFU\'s two-handed cast (a two-hander: no spell hand) the Morrowind arm still casts past the classic frames - no blow starts until its hands are free (the arm refuses a blow mid-cast, so the blow landed unshown); a technique\'s leap or dash is a strike in flight to the cast door (mutants: the arm\'s cast read for the spell hand alone; the leap unread)', async () => {
  const arm = stubArm();
  try {
    const { r, frame, ready } = await spellRig({ right: CLAYMORE() });
    ready.spell = FIRE;
    await settle(frame);
    assert.equal(spellHandUp(), false, 'a two-hander: DFU\'s cast');
    assert.equal(r.castSpellAnim(2, 0, () => { ready.spell = null; }), true);
    for (let i = 0; i < 60 && fpsSpellCasting.isPlayingAnim; i++) await frame();
    arm.release = true; await frame();
    for (let i = 0; i < 30 && fpsSpellCasting.isPlayingAnim; i++) await frame();
    assert.equal(fpsSpellCasting.isPlayingAnim, false);
    for (let i = 0; i < 10; i++) await frame(1 / 60, true);
    assert.equal(r.playerWeapon.machine.state, 'Idle', 'the arm still casting: no blow');
    arm.casting = false;
    let swung = false;
    for (let i = 0; i < 10; i++) { await frame(1 / 60, true); if (r.playerWeapon.machine.state !== 'Idle') swung = true; }
    assert.ok(swung, 'its hands free: the blow');
  } finally { arm.restore(); _resetSpellHand(); }
  assert.match(src('src/combat/weapon/weaponRig.js'), /const handsBusy = \(\) => [^\n]*\|\| techniqueFlying\(\);/, 'L4-7: a technique\'s leap or dash is a strike in flight (its landing blow paid for at the launch)');
});

test('SPELL-HAND AUDIT L4-4 THE TUTORIAL NAMES THE CAST\'S OWN PRESS: the spellbook page casts with ActivateCenterObject (EntityEffectManager\'s own, which casts whatever the hands) and says the swing button swings the weapon beside a spell in the free hand - never the swing button as the cast\'s (mutant: the page back to the swing button)', () => {
  const page = TUTORIALS.find((p) => p.id === 'spellbook');
  assert.match(page.body[0], /cast it with \{ActivateCenterObject\}\./);
  assert.match(page.body[0], /the spell waits in that hand and \{SwingWeapon\} still swings the weapon\./);
  assert.doesNotMatch(page.body[0], /cast it with \{SwingWeapon\}/);
});

test('SPELL-HAND AUDIT L5-8 A SHOT\'S HIT STILL HELD IS A BLOW IN FLIGHT: under the Morrowind arm a Pistolet\'s hit waits for the arm\'s "shoot release" (MW-D42) - and where the .kf carries none (NEVER-TRAPS: it lands on its own after HELD_HIT_MAX_S), the shot is the hand\'s until it lands, its machine Idle and the arm\'s blow over: a cast beside it waits (mutant: the held hit unread by the busy word)', async () => {
  const arm = stubArm();
  try {
    const { r, frame, ready } = await spellRig({ right: createPistolet() });
    ready.spell = FIRE;
    await settle(frame);
    assert.equal(spellHandUp(), true, 'the spell beside the Pistolet');
    await frame(1 / 60, true);
    let i = 0;
    for (; i < 120 && (r.playerWeapon.machine.state !== 'Idle' || !r.playerWeapon.shotHeld()); i++) await frame();
    assert.equal(r.playerWeapon.machine.state, 'Idle', 'the shot\'s frames done');
    assert.equal(r.playerWeapon.shotHeld(), true, 'its hit held for a release that never comes');
    await frame();
    assert.equal(spellHandBusy(), true, 'held: the cast waits');
    for (let j = 0; j < 120 && r.playerWeapon.shotHeld(); j++) await frame();
    assert.equal(r.playerWeapon.shotHeld(), false, 'landed on its own');
    await frame();
    assert.equal(spellHandBusy(), false, 'and the hands are free');
  } finally { arm.restore(); _resetSpellHand(); }
});
