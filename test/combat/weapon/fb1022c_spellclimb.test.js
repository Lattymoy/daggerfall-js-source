// FIELD BUGS 2026-10-22c SPELL-CLIMB (#bug-reports, Panthyon: "Spell+Climbing=4 arms" - "When you hold a spell and dont
// drop it, climbing will then manifest a second set of arms"). Record: bible/01-Overview/bugs/Field-Bugs-2026-10-22c.md.
// Driven through the REAL weapon rig on the classic lane, over a synthetic casting CIF (RSH1's) and the climb law's own
// hands: a readied spell's hands (RSH1) and the fists on the wall (CLIMB-HANDS) are never on the screen together. The
// readied hands stand down while the fists show and come back off the wall; a cast on the wall takes the hands off the
// stone while its own play, and they come back up onto it after, eased; DFU's own climb draws no fists, so there the
// readied hands stand as the mod has them.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createWeaponRig } from '../../../src/combat/weapon/weaponRig.js';
import { fpsSpellCasting } from '../../../src/combat/fpsSpellCasting.js';
import { resetToDefaults } from '../../../src/systems/settings/settings.js';
import { _resetModSettings } from '../../../src/systems/modSettings.js';

const DT = 1 / 60;
const hang = (extra = {}) => ({ mode: 'hang', classic: false, normal: [0, 0, -1], lipY: 2.8, track: [0, 1, 0], feet: [0, 1, 0], grip: 1, move: null, ...extra });
const FIREBALL = Object.freeze({ element: 0, rangeType: 2, name: 'Fireball' });

// the rig fetches the paintings from the build beside the page: here that load is left in flight (no network, no warning)
const realFetch = globalThis.fetch;
before(() => { globalThis.fetch = () => new Promise(() => {}); });
after(() => { globalThis.fetch = realFetch; });

/** A plain casting CIF: six single-frame records of (20 + r) x 30, uncompressed (RSH1's). */
function castCif() {
  const parts = [];
  for (let r = 0; r < 6; r++) {
    const w = 20 + r, h = 30;
    const b = new Uint8Array(12 + w * h);
    const v = new DataView(b.buffer);
    v.setInt16(4, w, true); v.setInt16(6, h, true); v.setUint16(8, 0, true); v.setUint16(10, w * h, true);
    b.fill(1, 12);
    parts.push(b);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** The real rig on the classic lane, the readied spell and the climb the test sets, and one frame's two pictures: the
 *  spell's hands (the quads of its casting archive) and the fists (the law's hands, whenever the rig asks them drawn -
 *  the paintings themselves are a browser's decode, createImageBitmap, which Node has not). */
async function wallRig() {
  resetToDefaults(); _resetModSettings();
  fpsSpellCasting.currentFrame = -1; fpsSpellCasting._hold = null; fpsSpellCasting._recover = 0;
  const quads = [];
  const renderer = { uploadTexture: (_k, name) => name, drawScreenQuad: (tex) => quads.push(tex) };
  const canvas = { width: 600, height: 400, clientWidth: 600, clientHeight: 400 };
  const state = { ready: null, climb: null };
  const r = createWeaponRig({
    renderer, canvas, entity: { items: [], equip: { slots: {} }, stats: { speed: 50 } }, audio: { playOneShot() {} },
    palette: { get: () => ({ r: 200, g: 100, b: 50 }) }, fetchBytes: async () => castCif(),
    spellArmed: () => state.ready != null, readiedSpell: () => state.ready,
    camera: () => ({ pos: [0, 1.7, 0], yaw: 0, pitch: 0, climbing: !!state.climb, move: { grounded: !state.climb }, climb: state.climb }),
  });
  let fists = false;
  const drawFists = r.climbHands.draw;
  r.climbHands.draw = (...a) => { fists = r.climbHands.showing(); return drawFists(...a); };
  const frame = async () => {
    r.frame(DT);
    r.draw();   // a first ask starts the archive's load...
    await new Promise((res) => setTimeout(res, 0));   // ...and it lands before the next
    quads.length = 0; fists = false;
    r.draw();
    const spell = quads.filter((t) => typeof t === 'string' && t.startsWith('fpsc:')).length;
    return { spell, fists, present: r.climbHands.law.out.present, playing: fpsSpellCasting.isPlayingAnim };
  };
  const frames = async (n) => { const out = []; for (let i = 0; i < n; i++) out.push(await frame()); return out; };
  return { r, state, frame, frames };
}

const onePair = (fs, what) => { for (const f of fs) assert.ok(!(f.spell && f.fists), `${what}: one pair of arms on the screen, never the spell's hands with the fists`); };

test('SPELL-CLIMB: a readied spell\'s hands stand down for the fists on the wall and come back off it - never two pairs, and the spell stays readied (mutant: the readied hands drawn over the fists)', async () => {
  const { state, frame, frames } = await wallRig();
  state.ready = FIREBALL;
  assert.equal((await frame()).spell, 2, 'readied on the ground: its two hands (RSH1)');
  state.climb = hang();
  const on = await frames(60);
  onePair(on, 'onto the wall');
  assert.deepEqual([on.at(-1).spell, on.at(-1).fists], [0, true], 'on the wall: the fists alone');
  assert.equal(state.ready, FIREBALL, 'the spell still readied - a click on the wall casts it');
  state.climb = null;
  const off = await frames(60);
  onePair(off, 'off the wall');
  assert.ok(off.some((f) => f.fists), 'the fists eased off the stone, not cut');
  assert.deepEqual([off.at(-1).spell, off.at(-1).fists], [2, false], 'off the wall: the readied hands back');
});

test('SPELL-CLIMB: a cast on the wall takes the hands off the stone - its own hands alone while it plays - and they come back up onto it after, eased (mutants: the fists drawn under the cast; the law kept on the climb under it, the fists popped back whole)', async () => {
  const { r, state, frames } = await wallRig();
  state.ready = FIREBALL;
  state.climb = hang();
  await frames(60);
  assert.equal(r.climbHands.law.out.present, 1, 'the fists on the stone');
  assert.equal(r.castSpellAnim(FIREBALL.rangeType, FIREBALL.element, () => { state.ready = null; }), true,
    'the click casts it on the wall, as DFU does (EntityEffectManager.Update reads no climb)');
  const after = await frames(90);
  onePair(after, 'the cast on the wall');
  const casting = after.filter((f) => f.playing), back = after.filter((f) => !f.playing);
  assert.ok(casting.length > 2 && after.indexOf(back[0]) === casting.length, 'the cast plays, then is done');
  for (const f of casting) assert.equal(f.fists, false, 'no fists under the cast');
  assert.ok(casting.some((f) => f.spell === 2), 'the cast\'s hands drawn');
  const first = back.find((f) => f.fists);
  assert.ok(first && first.present < 1, `back onto the stone eased, not popped back whole (present ${first?.present})`);
  assert.equal(back.at(-1).present, 1, 'and on it');
  assert.equal(back.at(-1).spell, 0, 'the spell spent: no readied hands after');
});

test('SPELL-CLIMB: the cast takes the fists off the stone only where its own hands are drawn - the Beholder\'s third person hides the spell\'s hands (ToggleOffset, IL_22f9) and Don\'tHideWeapon keeps the fists, so they hold on through the cast (mutant: a cast with no hands on the screen taking the fists off it)', async () => {
  const { eotbBody } = await import('../../../src/player/eyeOfTheBeholder/eotbBody.js');
  const hides = eotbBody.hides;
  try {
    eotbBody.hides = () => ({ weapon: false, horse: false, spellHands: true });   // third person, Compatibility.Don'tHideWeapon on
    const { r, state, frames } = await wallRig();
    state.ready = FIREBALL;
    state.climb = hang();
    await frames(60);
    assert.equal(r.climbHands.law.out.present, 1, 'the fists on the stone');
    assert.equal(r.castSpellAnim(FIREBALL.rangeType, FIREBALL.element, () => { state.ready = null; }), true);
    const casting = (await frames(90)).filter((f) => f.playing);
    assert.ok(casting.length > 2, 'the cast plays');
    for (const f of casting) assert.deepEqual([f.spell, f.fists, f.present], [0, true, 1], 'no spell hands drawn: the fists hold the stone');
  } finally { eotbBody.hides = hides; }
});

test('SPELL-CLIMB: DFU\'s own climb draws no fists (WeaponManager\'s empty screen), so a readied spell\'s hands stand on it as the mod has them (mutant: the readied hands put down on any climb)', async () => {
  const { state, frames } = await wallRig();
  state.ready = FIREBALL;
  state.climb = hang({ classic: true });
  const on = await frames(30);
  for (const f of on) assert.deepEqual([f.spell, f.fists], [2, false], 'the classic climb: the readied hands, no fists');
});
