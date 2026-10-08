// MW-CAST1 (2026-10-07, Mac: "We need to implement morrowind spell casting effects and animations"): THE MORROWIND
// CAST, PLAYED.
//
// MW-D39 gave the arm a spellcast stance and a cast, and none of it reached the screen: in first person a readied spell
// hid the weapon and the Morrowind arm with it (the draw returned before the arm), the cast was dropped two tenths of a
// second in (Daggerfall clears the ready at its release, and the arm took that for an abort), the weapon stayed in the
// casting hand, and indoors the cast never reached the wire. These pins stand an arm whose clips carry the spellcast
// group (test/fixtures/mw/castClip.mjs) and hold each fix, and the release that now waits for the arm's own
// "<type> release" - OpenMW's cast moment - with a ceiling so nothing waits for ever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY } from '../src/combat/fpArm.js';
import { MW_WEAPON_TYPE } from '../src/formats/mwFirstPerson.js';
import { SpellCastAnim, HELD_RELEASE_MAX_S, CAST_FRAME_PERIOD, RELEASE_FRAME } from '../src/combat/fpsSpellCasting.js';
import { castClip, CAST_KEYS } from './fixtures/mw/castClip.mjs';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
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
const fakeRenderer = () => ({ gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1 });

/** The longsword arm, its clips carrying the spellcast group; drawn and at rest. */
async function castingArm(clip = castClip()) {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, new Uint8Array(clip)],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/blade.nif', f('weapon.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const weap = wpdtRec('iron longsword', 'w/blade.nif', MW_WEAPON_TYPE.LongBladeOneHand);
  const arm = createFpArm();
  arm.attach(fakeRenderer(), () => ({ pitch: 0 }));
  const res = await arm.build({
    race: 'fprace', weapon: { templateIndex: 120 },
    deps: {
      loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
      storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
      loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
    },
  });
  assert.ok(res.ok, `build: ${res.stage} ${res.error}`);
  arm.setSheathed(false);
  for (let i = 0; i < 400 && arm.status().upper !== UPPER_BODY.WeaponEquipped; i++) arm.update(0.05);
  assert.equal(arm.status().upper, UPPER_BODY.WeaponEquipped);
  return arm;
}
/** Step until `done(status)` or `steps` run out; answers the steps taken. */
function stepUntil(arm, done, { dt = 1 / 60, steps = 600, each = null } = {}) {
  for (let i = 0; i < steps; i++) {
    if (done(arm.status())) return i;
    arm.update(dt);
    each?.(i);
  }
  return -1;
}

// ── the hands' release, held ─────────────────────────────────────────────────────────────────────────────────────

test('MW-CAST1: a release HELD for the arm goes on its key, not on frame 5 - and at the ceiling if the key never comes', () => {
  const anim = new SpellCastAnim();
  let released = 0;
  let key = false;
  assert.equal(anim.playOneShot(4, () => released++, { hold: () => key }), true);
  assert.equal(anim.releaseHeld, true);
  for (let t = 0; t < RELEASE_FRAME * CAST_FRAME_PERIOD + 0.1; t += 0.01) anim.tick(0.01);
  assert.equal(released, 0, 'frame 5 is not the release while the arm casts');
  assert.equal(anim.playOneShot(4, () => {}, {}), false, 'one pair of hands: no second cast while the first is held');
  key = true;
  anim.tick(0.01);
  assert.equal(released, 1, 'the arm\'s key releases it');
  assert.equal(anim.releaseHeld, false);
  for (let i = 0; i < 100; i++) anim.tick(0.05);
  assert.equal(released, 1, 'once');
  // never-traps: no key, the ceiling
  const late = new SpellCastAnim();
  let at = null; let t = 0;
  late.playOneShot(0, () => { at = t; }, { hold: () => false });
  for (let i = 0; i < 400 && at == null; i++) { t += 0.01; late.tick(0.01); }
  assert.ok(at != null && Math.abs(at - HELD_RELEASE_MAX_S) < 0.011, `the ceiling releases it (${at})`);
  // the classic lane: frame 5, as DFU
  const classic = new SpellCastAnim();
  let ct = 0; let cat = null;
  classic.playOneShot(1, () => { cat = ct; });
  for (let i = 0; i < 100 && cat == null; i++) { ct += 0.01; classic.tick(0.01); }
  assert.ok(Math.abs(cat - RELEASE_FRAME * CAST_FRAME_PERIOD) < 0.011, `without a hold the release is frame 5 (${cat})`);   // CAST-SPEED: the port's period
});

// ── the arm ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('MW-CAST1: the arm casts through its spellcast group - "<type> start" to "<type> stop" - and signals "<type> release" once, where OpenMW casts', async () => {
  const arm = await castingArm();
  arm.readySpell(true);
  arm.update(1 / 60);
  assert.equal(arm.status().weaponGroup, 'spellcast');
  assert.equal(arm.status().idleGroup, 'idlespell');
  assert.equal(arm.castSpell(2), true);
  assert.equal(arm.status().upper, UPPER_BODY.Casting);
  assert.ok(Math.abs(arm.status().time - 9.6) < 1e-6, 'at "target start"');
  assert.equal(arm.castInFlight(), true);
  let releasedAt = null;
  stepUntil(arm, (s) => s.upper !== UPPER_BODY.Casting, { each: () => { if (releasedAt == null && arm.takeCastRelease()) releasedAt = arm.status().time; } });
  assert.ok(releasedAt != null && Math.abs(releasedAt - 9.9) < 0.02, `the release key crossed at ${releasedAt}`);
  assert.equal(arm.takeCastRelease(), false, 'consumed');
  assert.equal(arm.castInFlight(), false, 'and the cast ends at "target stop"');
  // self and touch take their own pairs
  assert.equal(arm.castSpell(0), true);
  assert.ok(Math.abs(arm.status().time - 8.6) < 1e-6, '"self start"');
  stepUntil(arm, (s) => s.upper !== UPPER_BODY.Casting);
  assert.equal(arm.castSpell(1), true);
  assert.ok(Math.abs(arm.status().time - 9.1) < 1e-6, '"touch start"');
});

test('MW-CAST1: THE CAST FINISHES - the ready cleared at the release (Daggerfall\'s order) no longer drops it two tenths in; the stance drops when it ends', async () => {
  const arm = await castingArm();
  arm.readySpell(true);
  arm.update(1 / 60);
  arm.castSpell(2);
  for (let i = 0; i < 12; i++) arm.update(1 / 60);   // the classic release, 0.2 s in
  assert.equal(arm.readySpell(false), false, 'the un-ready waits');
  assert.equal(arm.status().upper, UPPER_BODY.Casting, 'the cast plays on');
  assert.equal(arm.status().unreadyAfterCast, true);
  assert.equal(arm.status().spellReady, true, 'the stance holds through the motion');
  // the un-ready came ONCE, at the release - nothing re-asserts it, so the drop at the end is the arm's own
  stepUntil(arm, (s) => s.upper !== UPPER_BODY.Casting);
  const s = arm.status();
  assert.equal(s.spellReady, false, 'and drops at "target stop", by itself');
  assert.equal(s.unreadyAfterCast, false);
  assert.equal(s.upper, UPPER_BODY.WeaponEquipped);
  assert.equal(s.weaponGroup, 'weapononehand', 'back to the sword\'s group');
  // a re-ready mid-cast keeps the stance
  arm.readySpell(true); arm.update(1 / 60); arm.castSpell(2);
  arm.readySpell(false);
  assert.equal(arm.readySpell(true), false, 'already readied');
  assert.equal(arm.status().unreadyAfterCast, false, 'the pending drop is cancelled');
});

test('MW-CAST1: THE CASTING HANDS ARE EMPTY - a readied spell and a cast in flight put the weapon out of the hand, on both rigs', async () => {
  const arm = await castingArm();
  assert.equal(arm.status().weaponInHand, true, 'drawn and at rest');
  arm.readySpell(true);
  assert.equal(arm.status().weaponInHand, false, 'readied');
  arm.castSpell(2);
  arm.readySpell(false);
  assert.equal(arm.status().weaponInHand, false, 'casting, the ready already gone');
  stepUntil(arm, (s) => s.upper !== UPPER_BODY.Casting, { each: () => arm.readySpell(false) });
  assert.equal(arm.status().weaponInHand, true, 'back in the hand');
  const fp = src('src/combat/fpArm.js');
  assert.match(fp, /if \(r\.slot === 'weapon'\) r\.hidden = !weaponInHand\(\) \|\| climbHands;/, 'the third person\'s range');
  assert.match(fp, /if \(r\.slot === 'weapon'\) r\.hidden = !weaponInHand\(\);/, 'the first person\'s');
  assert.match(fp, /if \(eff\.slot === 'weapon'\) return !weaponInHand\(\);/, 'and a weapon\'s own effects');
});

test('MW-CAST1: a cast whose group carries no release key still lets the spell go when it ends', async () => {
  const arm = await castingArm(castClip({ without: ['SpellCast: Target Release'] }));
  arm.readySpell(true); arm.update(1 / 60);
  assert.equal(arm.castSpell(2), true);
  const anim = new SpellCastAnim();
  let released = 0;
  anim.playOneShot(4, () => released++, { hold: () => arm.takeCastRelease() || !arm.castInFlight() });
  stepUntil(arm, () => released > 0, { each: () => anim.tick(1 / 60), steps: 400 });
  assert.equal(released, 1, 'the cast\'s end releases it');
  assert.ok(CAST_KEYS.some(([, t]) => t === 'SpellCast: Target Release'));
});

// ── the rig and the hosts ────────────────────────────────────────────────────────────────────────────────────────

test('MW-CAST1: the rig holds the release for the arm on screen, draws the casting arm, and the world starts a cast on the LIVE rig', async () => {
  const { createWeaponRig } = await import('../src/combat/weaponRig.js');
  const { fpArm } = await import('../src/combat/fpArm.js');
  const { fpsSpellCasting } = await import('../src/combat/fpsSpellCasting.js');
  const saved = { castSpell: fpArm.castSpell, active: fpArm.active, thirdActive: fpArm.thirdActive, takeCastRelease: fpArm.takeCastRelease, castInFlight: fpArm.castInFlight };
  let key = false;
  fpArm.castSpell = () => true;
  fpArm.active = () => true;
  fpArm.thirdActive = () => false;
  fpArm.takeCastRelease = () => { if (!key) return false; key = false; return true; };
  fpArm.castInFlight = () => true;
  try {
    const r = createWeaponRig({ renderer: {}, canvas: { clientWidth: 1000, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art'); }, palette: null, audio: { playOneShot() {} }, entity: { items: [], stats: { speed: 50 }, activeEffects: [] } });   // CAST-SPEED: rate 1
    let released = 0;
    assert.equal(r.castSpellAnim(2, 0, () => released++), true);
    assert.equal(fpsSpellCasting.releaseHeld, true, 'held for the arm');
    for (let i = 0; i < 30; i++) fpsSpellCasting.tick(1 / 60);
    assert.equal(released, 0, 'not on frame 5');
    key = true;
    fpsSpellCasting.tick(1 / 60);
    assert.equal(released, 1, 'on the arm\'s key');
    for (let i = 0; i < 30; i++) fpsSpellCasting.tick(1 / 60);
    // with no Morrowind arm on screen, the classic frame 5
    fpArm.castSpell = () => false;
    let classic = 0;
    assert.equal(r.castSpellAnim(2, 0, () => classic++), true);
    assert.equal(fpsSpellCasting.releaseHeld, false);
    for (let i = 0; i < 40; i++) fpsSpellCasting.tick(1 / 60);   // CAST-SPEED: frame 5 at the port's 0.5 s
    assert.equal(classic, 1);
  } finally {
    Object.assign(fpArm, saved);
    for (let i = 0; i < 200; i++) fpsSpellCasting.tick(0.05);
  }
  const rig = src('src/combat/weaponRig.js');
  assert.match(rig, /const armCasts = fpArm\.active\(\) && \(spellArmed\(\) \|\| fpsSpellCasting\.isPlayingAnim \|\| fpArm\.castInFlight\(\)\);\n\s+if \(paralyzed \|\| \(!shown\(\) && !torchOnly && !sheetOnly && !shieldRect && !gunSliding && !armCasts\)\) return;/,
    'the casting arm is not returned past');
  const world = src('src/scenes/world.js');
  assert.match(world, /startCastAnim: \(sp, onRelease\) => !!\(modes\?\.liveArm\?\.\(\)\?\.rig \?\? weaponRig\)\?\.castSpellAnim\?\.\(sp\?\.rangeType, sp\?\.element, onRelease\),/,
    'the live rig counts the cast the pose reads');
});
