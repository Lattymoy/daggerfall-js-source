// CAST-SPEED (2026-10-08, Mac on a Discord post, "Morrowind magic anims nerf you": "I think we nerf the animation of
// the regular sprite spellcasting to fall in line with the morrowind model. Also have casting speed a new rarity affix
// along with scaling with speed"). The laws pinned here:
//   - THE RATE (systems/castSpeed.js): 1 at Speed 50, a quarter faster at 100 and slower at 0, the attribute clamped,
//     every registered modifier's percent added on, the whole clamped to [0.5, 2].
//   - THE CLASSIC HANDS (combat/fpsSpellCasting.js): CAST_FRAME_PERIOD over the cast's rate - the release at 0.5 s and
//     the hands down at 0.7 s at rate 1, where DFU's animSpeed put them at 0.2 s and 0.28 s.
//   - THE RIG (combat/weaponRig.js castSpellAnim) reads the caster's rate once a cast and hands it to BOTH lanes.
//   - THE MORROWIND ARM (combat/fpArm.js castSpell) plays its spellcast group at that rate.
//   - THE LOOT LINE (systems/lootRarity.js castSpeed, systems/lootPowers.js lootCastSpeed): a line that does something,
//     on jewellery and weapons, banded, worded, summed over what I wear under its cap, mine alone, none with the switch off.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as CS from '../src/systems/castSpeed.js';
import { SpellCastAnim, CAST_FRAME_PERIOD, CAST_RECOVER_S, RELEASE_FRAME, FRAME_INDICES, fpsSpellCasting } from '../src/combat/fpsSpellCasting.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH, UPPER_BODY, fpArm } from '../src/combat/fpArm.js';
import { MW_WEAPON_TYPE } from '../src/formats/mwFirstPerson.js';
import { castClip } from './fixtures/mw/castClip.mjs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as LP from '../src/systems/lootPowers.js';
import { _resetSetPowersForTests } from '../src/systems/sigilSetPowers.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { validLootItem } from '../src/systems/loot.js';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const on = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); setPlayerDoor(null); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const caster = (speed = 50, over = {}) => ({ isPlayer: true, items: [], stats: { speed }, activeEffects: [], ...over });
const ring = (affixes, templateIndex = 135) => Object.assign(mintCondition({ group: 'Jewellery', templateIndex, name: 'Ring', flags: 0 }), { rarity: 'rare', affixes });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };

/** When a cast at `rate` releases and ends, in seconds, stepped finely. */
function classicTimes(rate) {
  const a = new SpellCastAnim();
  let t = 0, release = null;
  a.playOneShot(4, () => { release = t; }, rate === undefined ? {} : { rate });
  while (a.isPlayingAnim && t < 5) { t += 0.001; a.tick(0.001); }
  return [Math.round(release * 100) / 100, Math.round(t * 100) / 100];
}

test('CAST-SPEED: the rate - Speed 50 casts at 1, a quarter either way at 100 and 0, clamped; the modifiers add their percent', () => {
  assert.equal(CS.CAST_SPEED_PIVOT, 50);
  assert.equal(CS.CAST_SPEED_SPAN, 200);
  assert.deepEqual([CS.CAST_RATE_MIN, CS.CAST_RATE_MAX], [0.5, 2]);
  assert.deepEqual([0, 10, 50, 90, 100].map(CS.speedCastRate), [0.75, 0.8, 1, 1.2, 1.25]);
  assert.deepEqual([-20, 140, NaN, undefined].map(CS.speedCastRate), [0.75, 1.25, 1, 1], 'the attribute clamped; no number is the pivot');
  assert.equal(CS.castRate(null), 1, 'no caster, rate 1');
  assert.equal(CS.castRate(caster(50)), 1);
  assert.equal(CS.castRate(caster(100)), 1.25);
  assert.equal(CS.castRate(caster(0)), 0.75);
  // a fortify reaches it - the LIVE Speed
  assert.equal(CS.castRate(caster(50, { activeEffects: [{ kind: 'fortifyAttribute', stat: 'speed', magnitude: 30 }] })), 1 + 30 / 200);
  CS.registerCastSpeedMod('test', () => 20);
  try {
    assert.equal(CS.castRate(caster(50)), 1.2, 'twenty percent on');
    CS.registerCastSpeedMod('test', () => 500);
    assert.equal(CS.castRate(caster(100)), CS.CAST_RATE_MAX, 'never past the top');
    CS.registerCastSpeedMod('test', () => -500);
    assert.equal(CS.castRate(caster(0)), CS.CAST_RATE_MIN, 'nor under the floor');
    CS.registerCastSpeedMod('test', () => NaN);
    assert.equal(CS.castRate(caster(50)), 1, 'a modifier with no number adds nothing');
  } finally { CS.registerCastSpeedMod('test', null); }
  assert.equal(CS.castRate(caster(50)), 1, 'unregistered');
  assert.deepEqual([1.3, 0, -1, NaN, 9, 0.1].map(CS.validCastRate), [1.3, 1, 1, 1, 2, 0.5]);
});

test('CAST-SPEED: the classic hands step at CAST_FRAME_PERIOD over the rate - 0.2 s to the release and 0.28 s down at rate 1 (CAST-QUICK: back to DFU timing)', () => {
  assert.equal(CAST_FRAME_PERIOD, 0.04);   // CAST-QUICK: DFU's own clock again
  assert.equal(FRAME_INDICES.length, 7);
  const r2 = (x) => Math.round(x * 100) / 100;
  assert.deepEqual(classicTimes(), [r2(RELEASE_FRAME * CAST_FRAME_PERIOD), r2(FRAME_INDICES.length * CAST_FRAME_PERIOD)], 'rate 1 by default');
  assert.deepEqual(classicTimes(1), [0.2, 0.28]);
  assert.deepEqual(classicTimes(1.25), [0.16, 0.22], 'Speed 100');
  assert.deepEqual(classicTimes(0.75), [0.27, 0.37], 'Speed 0');
  assert.deepEqual(classicTimes(2), [0.1, 0.14], 'the fastest any cast runs');
  assert.deepEqual(classicTimes(-3), [0.2, 0.28], 'a nonsense rate is rate 1');
  // the rate is the cast's own: the next cast takes its own
  const a = new SpellCastAnim();
  a.playOneShot(4, null, { rate: 2 });
  for (let i = 0; i < 7; i++) a.tick(CAST_FRAME_PERIOD / 2);
  assert.equal(a.isPlayingAnim, false, 'seven half-steps at rate 2');
  a.tick(CAST_RECOVER_S);   // CAST-RECOVER: the last cast's recovery run out
  a.playOneShot(4, null, {});
  for (let i = 0; i < 7; i++) a.tick(CAST_FRAME_PERIOD / 2);
  assert.equal(a.isPlayingAnim, true, 'and rate 1 after it is not');
});

test('CAST-SPEED: the rig reads the caster\'s rate once a cast and hands it to both lanes', () => {
  const saved = { castSpell: fpArm.castSpell, active: fpArm.active, thirdActive: fpArm.thirdActive };
  const asked = [];
  fpArm.castSpell = (rangeType, rate) => { asked.push([rangeType, rate]); return false; };
  fpArm.active = () => false;
  fpArm.thirdActive = () => false;
  try {
    fpsSpellCasting.currentFrame = -1;
    const me = caster(100);
    const r = createWeaponRig({ renderer: {}, canvas: { clientWidth: 1000, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art'); }, palette: null, audio: { playOneShot() {} }, entity: me });
    let released = null, t = 0;
    assert.equal(r.castSpellAnim(2, 0, () => { released = t; }), true);
    assert.deepEqual(asked, [[2, 1.25]], 'the arm is handed Speed 100\'s rate');
    while (fpsSpellCasting.isPlayingAnim && t < 2) { t += 0.001; fpsSpellCasting.tick(0.001); }
    assert.ok(Math.abs(released - 0.16) < 0.002 && Math.abs(t - 0.224) < 0.002, `the classic hands at the same rate (${released}, ${t})`);
    // the castSpeed loot line reaches the same door
    on();
    wear(me, ring([{ id: 'castSpeed', value: 15 }]));
    asked.length = 0;
    r.castSpellAnim(2, 0, null);
    assert.deepEqual(asked, [[2, 1.4]], 'Speed 100 and fifteen in a hundred');
  } finally {
    Object.assign(fpArm, saved);
    for (let i = 0; i < 200; i++) fpsSpellCasting.tick(0.05);
    off();
  }
});

/** The longsword arm, its clips carrying the spellcast group (mwcast1.test.js's own); drawn and at rest. */
async function castingArm() {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, MW_WEAPON_TYPE.LongBladeOneHand, true);
  new DataView(w.buffer).setFloat32(12, 1, true);
  const d = [...sub('NAME', Z('iron longsword')), ...sub('MODL', Z('w/blade.nif')), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  const weap = Uint8Array.from([...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d]);
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, new Uint8Array(castClip())],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/blade.nif', f('weapon.nif')], ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const arm = createFpArm();
  arm.attach({ gl: null, createCharacterMesh: () => ({ vao: 1, buffers: [], ranges: [] }), updateCharacterMesh: () => {}, createCharacterTexture: () => 1 }, () => ({ pitch: 0 }));
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

test('CAST-SPEED: the Morrowind arm plays its spellcast group at the cast\'s rate - "<type> release" and "<type> stop" come that much sooner', async () => {
  const arm = await castingArm();
  /** Wall seconds from "target start" to the release key and to the stop, at `rate`. */
  const run = (rate) => {
    assert.equal(arm.castSpell(2, rate), true);
    let t = 0, release = null;
    for (let i = 0; i < 600 && arm.status().upper === UPPER_BODY.Casting; i++) {
      arm.update(1 / 120); t += 1 / 120;
      if (release == null && arm.takeCastRelease()) release = t;
    }
    return [Math.round(release * 100) / 100, Math.round(t * 100) / 100];
  };
  // the fixture's keys: "target start" 9.6, "target release" 9.9, "target stop" 10.2 (test/fixtures/mw/castClip.mjs)
  assert.deepEqual(run(1), [0.3, 0.6], 'rate 1 is the clip\'s own time');
  assert.deepEqual(run(2), [0.15, 0.3], 'twice the rate, half the time');
  assert.deepEqual(run(0.75), [0.4, 0.8]);
  assert.deepEqual(run(), [0.3, 0.6], 'a cast handed no rate plays at 1');
  // a swing after it is the weapon's own pace again, not the last cast's
  const fpSrc = readFileSync(new URL('../src/combat/fpArm.js', import.meta.url), 'utf8');
  assert.match(fpSrc, /const speed = paced \? blowPlan\.rate : upper === UPPER_BODY\.Casting \? castRate : weapSpeed;/);
});

test('CAST-SPEED: the loot line - casting speed, a line that does something on jewellery and weapons; what I wear, summed under its cap, mine alone', () => {
  on();
  const k = LR.AFFIX_KINDS.castSpeed;
  assert.equal(LR.AFFIX_IDS.at(-1), 'castSpeed', 'after every kind before it, so the numbers\' pass draws as it did (the last pass moved - CAST-SPEED-PINS)');
  assert.deepEqual(k.groups, ['Jewellery', 'Weapons']);
  assert.equal(k.proc, true);
  assert.equal(k.params, null);
  assert.deepEqual(LR.AFFIX_RANGES.castSpeed, { magic: [3, 6], rare: [6, 10], legendary: [10, 15] });
  assert.equal(LR.AFFIX_WORTH.castSpeed, 60);
  assert.equal(LR.affixLabel({ id: 'castSpeed', value: 8 }), '+8% casting speed');
  assert.deepEqual(['magic', 'rare', 'legendary'].map((t) => LR.affixWord({ id: 'castSpeed', value: 3 }, t)), ['of Quickening', 'of Alacrity', 'of the Swift Hand']);
  assert.equal(LR.validAffix({ id: 'castSpeed', value: 16 }), false, 'past its ceiling');
  assert.equal(LR.validAffix({ id: 'castSpeed', param: 'fire', value: 5 }), false, 'it takes no param');
  // a door's last pass may land it on a ring or a sword, never on armour
  for (const make of [() => ring([]), () => Object.assign(createWeapon(120, 1), { rarity: 'rare', affixes: [] })]) {
    const it = make();
    const line = LR.addProcLine(it, () => 0.999);
    assert.equal(line.id, 'castSpeed', `the last proc kind of ${it.group}`);
    assert.ok(validLootItem(it), 'and the item it rides is a valid loot item, on the wire and in a save');
  }
  // the sum
  const me = caster(50);
  assert.equal(LP.lootCastSpeed(me), 0);
  wear(me, ring([{ id: 'castSpeed', value: 10 }], 135));
  wear(me, Object.assign(createWeapon(120, 1), { rarity: 'rare', affixes: [{ id: 'castSpeed', value: 6 }] }));
  assert.equal(LP.lootCastSpeed(me), 16);
  assert.equal(CS.castRate(me), 1.16, 'registered: the rate reads it');
  assert.equal(LP.lootCastSpeed({ ...me, peer: true }), 0, 'a peer\'s cast is its own');
  for (const t of [133, 136, 137, 138]) wear(me, ring([{ id: 'castSpeed', value: 15 }], t));
  assert.equal(LP.CAST_SPEED_CAP, 30);
  assert.equal(LP.lootCastSpeed(me), LP.CAST_SPEED_CAP, 'never past the cap');
  off();
  assert.equal(LP.lootCastSpeed(me), 0, 'the switch off: none');
  assert.equal(CS.castRate(me), 1);
});

test('CAST-RECOVER: the quick hands keep the old pace - the next cast waits CAST_RECOVER_S from the click over the cast\'s rate, the hands down long before; the host\'s click and recast read it', () => {
  assert.equal(CAST_RECOVER_S, 0.7, 'the whole cast CAST-SPEED\'s 0.1 s step took');
  const a = new SpellCastAnim();
  assert.equal(a.playOneShot(4, null, {}), true);
  for (let i = 0; i < FRAME_INDICES.length; i++) a.tick(CAST_FRAME_PERIOD);
  assert.equal(a.isPlayingAnim, false, 'the hands are down at DFU\'s clock (0.28 s)');
  assert.equal(a.recovering, true, 'and the cast still recovers');
  assert.equal(a.playOneShot(4, null, {}), false, 'no second cast inside it');
  a.tick(CAST_RECOVER_S - FRAME_INDICES.length * CAST_FRAME_PERIOD - 0.01);
  assert.equal(a.playOneShot(4, null, {}), false, 'not a hundredth early');
  a.tick(0.02);
  assert.equal(a.recovering, false);
  assert.equal(a.playOneShot(4, null, { rate: 2 }), true, '0.7 s after the click, the next');
  a.tick(CAST_RECOVER_S / 2 - 0.01);
  assert.equal(a.recovering, true, 'at rate 2 the recovery is halved - not shorter');
  a.tick(0.02);
  assert.equal(a.recovering, false, 'and not longer');
  a.tick(NaN); a.tick(-5);
  assert.equal(a.recovering, false, 'a nonsense step changes nothing');
  const hm = readFileSync(new URL('../src/scenes/hostMagic.js', import.meta.url), 'utf8');
  assert.match(hm, /castBusy = \(\) => fpsSpellCasting\.isPlayingAnim \|\| fpsSpellCasting\.releaseHeld \|\| fpsSpellCasting\.recovering,/, 'the host\'s gate: a click and a recast wait it out, nothing spent');
});
