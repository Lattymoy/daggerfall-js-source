// RPT1026-MISC CAST-PACE (a private report: a Morrowind-look caster's spells left later than a Daggerfall-look caster's,
// whose hands move faster). The classic hands let the spell go on their frame 5, 0.2 s after the cast
// at rate 1 (CAST-QUICK, DFU's own clock); with the Morrowind arm on screen the release waited for its spellcast
// group's "<type> release" (MW-CAST1), played at the cast's rate - the Morrowind section's own length, longer, so the
// same caster's spell left later and the next cast waited on it. The section is paced now to bring its release key to
// the classic frame 5 (fpArm castSpell's `releaseIn`, fpsSpellCasting castReleaseS), and the rig lets the spell go on
// that frame for both looks. Driven on the REAL arm built from MW-CAST1's spellcast fixture (test/fixtures/mw/castClip.mjs:
// "target start" 9.6, "target release" 9.9 - a 0.3 s lead), the real SpellCastAnim and the real rig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY } from '../../src/combat/fpArm.js';
import { MW_WEAPON_TYPE } from '../../src/formats/morrowind/mwFirstPerson.js';
import { SpellCastAnim, castReleaseS, RELEASE_FRAME, CAST_FRAME_PERIOD } from '../../src/combat/fpsSpellCasting.js';
import { castClip } from '../fixtures/mw/castClip.mjs';

const f = (n) => new Uint8Array(readFileSync(new URL(`../fixtures/mw/${n}`, import.meta.url)));
const DT = 1 / 120;
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

/** mwcast1.test.js's longsword arm, its clips carrying the spellcast group; drawn, a spell readied. */
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
  arm.readySpell(true);
  arm.update(DT);
  return arm;
}
/** Seconds from the cast to the arm's "<type> release", stepped at DT. */
function armReleaseS(arm) {
  for (let i = 1; i <= 600 && arm.status().upper === UPPER_BODY.Casting; i++) {
    arm.update(DT);
    if (arm.takeCastRelease()) return i * DT;
  }
  return null;
}
/** Seconds from the cast to the classic hands' release, stepped at DT. */
function classicReleaseS(rate) {
  const anim = new SpellCastAnim();
  let at = null;
  anim.playOneShot(4, () => { at ??= 0; }, { rate });
  for (let i = 1; i <= 600 && at == null; i++) { anim.tick(DT); if (at === 0) at = i * DT; }
  return at;
}

test('RPT1026-MISC CAST-PACE: the Morrowind arm\'s release lands where the classic hands\' does - at rate 1 and at a quickened rate - where unpaced it lands its own section\'s lead later (mutants: rpt1026-misc-cast-pace-unfit, rpt1026-misc-cast-pace-unsaid, rpt1026-misc-cast-pace-rateless)', async () => {
  assert.ok(Math.abs(castReleaseS(1) - RELEASE_FRAME * CAST_FRAME_PERIOD) < 1e-9, 'the moment: frame 5 at the cast\'s rate');
  for (const rate of [1, 1.25]) {
    const arm = await castingArm();
    assert.equal(arm.castSpell(2, rate, castReleaseS(rate)), true);
    assert.equal(arm.castPaced(), true, 'the section had a release key to pace');
    const mw = armReleaseS(arm), classic = classicReleaseS(rate);
    assert.ok(mw != null && classic != null, `both released (${mw}, ${classic})`);
    assert.ok(Math.abs(mw - classic) <= DT + 1e-9, `rate ${rate}: the Morrowind release at ${mw.toFixed(3)} s, the classic at ${classic.toFixed(3)} s`);
    assert.ok(Math.abs(classic - castReleaseS(rate)) <= DT + 1e-9, `and both at the spell's moment, ${castReleaseS(rate).toFixed(3)} s`);
  }
  // the report's case: the arm unpaced (no moment handed) plays its section at the rate and lets go its own lead in
  const slow = await castingArm();
  assert.equal(slow.castSpell(2, 1), true);
  assert.equal(slow.castPaced(), false);
  const late = armReleaseS(slow);
  assert.ok(Math.abs(late - 0.3) <= DT + 1e-9 && late > castReleaseS(1) + 0.05, `unpaced, the release at the section's 0.3 s (${late})`);
  // a group with no release key has nothing to pace: unpaced, and MW-CAST1's hold carries it to the cast's end
  const keyless = await castingArm(castClip({ without: ['SpellCast: Target Release'] }));
  assert.equal(keyless.castSpell(2, 1, castReleaseS(1)), true);
  assert.equal(keyless.castPaced(), false, 'no key, no pace');
});

test('RPT1026-MISC CAST-PACE: the rig hands the arm the spell\'s moment and, the arm paced, lets the spell go on frame 5 - not held for the key; an unpaced arm is still held (MW-CAST1) (mutants: rpt1026-misc-cast-pace-unasked, rpt1026-misc-cast-pace-held)', async () => {
  const { createWeaponRig } = await import('../../src/combat/weapon/weaponRig.js');
  const { fpArm } = await import('../../src/combat/fpArm.js');
  const { fpsSpellCasting } = await import('../../src/combat/fpsSpellCasting.js');
  const saved = { castSpell: fpArm.castSpell, castPaced: fpArm.castPaced, active: fpArm.active, thirdActive: fpArm.thirdActive, takeCastRelease: fpArm.takeCastRelease, castInFlight: fpArm.castInFlight };
  let handed = null, paced = true;
  fpArm.castSpell = (_range, _rate, releaseIn) => { handed = releaseIn; return true; };
  fpArm.castPaced = () => paced;
  fpArm.active = () => true;
  fpArm.thirdActive = () => false;
  fpArm.takeCastRelease = () => false;   // the key never comes: only frame 5 can let a paced cast's spell go
  fpArm.castInFlight = () => true;
  try {
    const r = createWeaponRig({ renderer: {}, canvas: { clientWidth: 1000, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art'); }, palette: null, audio: { playOneShot() {} }, entity: { items: [], stats: { speed: 50 }, activeEffects: [] } });   // rate 1
    let released = 0, steps = 0;
    assert.equal(r.castSpellAnim(2, 0, () => released++), true);
    assert.ok(handed != null && Math.abs(handed - castReleaseS(1)) < 1e-9, `the arm is handed the spell's moment (${handed})`);
    assert.equal(fpsSpellCasting.releaseHeld, false, 'a paced arm holds nothing');
    while (!released && steps < 120) { fpsSpellCasting.tick(DT); steps++; }
    assert.equal(released, 1);
    assert.ok(Math.abs(steps * DT - castReleaseS(1)) <= DT + 1e-9, `on frame 5 (${(steps * DT).toFixed(3)} s)`);
    for (let i = 0; i < 200; i++) fpsSpellCasting.tick(0.05);   // the hands down and the recovery out
    paced = false;
    let held = 0;
    assert.equal(r.castSpellAnim(2, 0, () => held++), true);
    assert.equal(fpsSpellCasting.releaseHeld, true, 'unpaced, held for the arm\'s key as MW-CAST1 has it');
    for (let i = 0; i < 60; i++) fpsSpellCasting.tick(DT);
    assert.equal(held, 0, 'not on frame 5');
  } finally {
    Object.assign(fpArm, saved);
    for (let i = 0; i < 200; i++) fpsSpellCasting.tick(0.05);
  }
});
