// AUDIT PISTOLET (bible/01-Overview/audits/Audit-Pistolet.md): THE PINS THE PISTOLET LACKED - each test here answers
// mutants that survived every suite of the branch the audit read (lane D's campaign, tools/mutants/pistolet.json): the
// pictures' registration and every doll record's file and place, the art's gold frame by frame (never the flash) and its
// enchanted type, the Morrowind rows' grip, both hands of a pair on the arm, the Legendary a gun rolls, the name, the
// siege's top and the mint's condition.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPistolet, PISTOLET_ICON_FILES, PISTOLET_ART_RECORDS, PISTOLET_PAPERDOLL_OFFSET, pistoletImageRecord, installPistoletIcons, PISTOLET_ARCHIVE,
} from '../../src/systems/pistolet.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { mintGilded, SOVEREIGN_PISTOLET_ERA } from '../../src/systems/gilded.js';
import { loadPistoletArt, pistoletGildKeep, flashMask, cutStrip, pistolFrameSet, bleedArm } from '../../src/combat/gun/pistoletArt.js';
import { cropImage } from '../../src/combat/gun/pistolStrip.js';
import { PISTOLET_FEEL } from '../../src/combat/gun/gunFeel.js';
import { gildFrame } from '../../src/combat/thunderlockArt.js';
import { WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { readPng } from '../../tools/pngIO.mjs';
import { OWN_MW_MODELS, OWN_MW_GILDED, PISTOL_GRIP_ATTITUDE, PISTOL_FIST_UP, GUN_GRIP_ATTITUDE } from '../../src/characters/ownModels/ownWeaponModels.js';
import { resolveWeaponParts, resolveOffWeaponParts, archiveHas } from '../../src/combat/fpArm.js';
import { PISTOLET_TEMPLATE, THUNDERLOCK_TEMPLATE } from '../../src/characters/thunderlockIds.js';
import { legendariesFor, applyRarity } from '../../src/systems/loot/lootRarity.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { itemLongName } from '../../src/systems/item/itemInfo.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { SIEGE_PISTOLET, armsTop } from '../../src/net/siege/siegeRef.js';
import { weaponMaxDamage } from '../../src/characters/weapons.js';
import { PlayerWeapon } from '../../src/combat/playerWeapon.js';
import { HANDS_MODE } from '../../src/combat/twoHands/handsLaw.js';

test('D9 D10: the six pictures register as STAND-INS of archive 562, each doll record at its hand\'s place - the right\'s at the right, the left\'s at the left, gold and plain (mutants: nothing registered; not a stand-in; the offsets dropped; a left record at the right\'s place)', async () => {
  assert.deepEqual(PISTOLET_ICON_FILES.map(({ record, file, offset }) => ({ record, file, offset: offset ?? null })), [
    { record: PISTOLET_ART_RECORDS.doll, file: 'pistolet-paperdoll.png', offset: PISTOLET_PAPERDOLL_OFFSET.right },
    { record: PISTOLET_ART_RECORDS.icon, file: 'pistolet-icon.png', offset: null },
    { record: PISTOLET_ART_RECORDS.gildedDoll, file: 'pistolet-paperdoll-gilded.png', offset: PISTOLET_PAPERDOLL_OFFSET.right },
    { record: PISTOLET_ART_RECORDS.gildedIcon, file: 'pistolet-icon-gilded.png', offset: null },
    { record: PISTOLET_ART_RECORDS.dollLeft, file: 'pistolet-paperdoll-left.png', offset: PISTOLET_PAPERDOLL_OFFSET.left },
    { record: PISTOLET_ART_RECORDS.gildedDollLeft, file: 'pistolet-paperdoll-left-gilded.png', offset: PISTOLET_PAPERDOLL_OFFSET.left },
  ]);
  const textures = await import('../../src/systems/textureReplacement.js');
  const n = await installPistoletIcons({ fetchBytes: async (f) => readFileSync(`public/art/${f}`) });
  assert.ok(n === 6 || n === 0, `six registered, or already (${n}) - the install runs once`);
  const standIn = textures.vendorTextureStandIn(PISTOLET_ARCHIVE);
  assert.equal(standIn.recordCount, 6, 'archive 562 stands in, six records');
  for (const r of PISTOLET_ICON_FILES) {
    if (r.offset) assert.deepEqual(standIn.getOffset(r.record), { x: r.offset.x, y: r.offset.y }, `${r.file} at its hand's place`);
  }
});

test('D10: every hand, every finish: the doll wears its hand\'s layer, gold for the Sovereign; a list the whole gun (mutant: the gilded right hand plain)', () => {
  const plain = createPistolet(), gold = mintGilded(SOVEREIGN_PISTOLET_ERA);   // PIN MOVED (GUNS-UNFOUND): the gold Pistolet a save holds - the Sovereign's pistolet era
  const at = (it, slot) => ({ ...it, equipSlot: slot });
  assert.equal(pistoletImageRecord(at(plain, EQUIP_SLOTS.RightHand), true), PISTOLET_ART_RECORDS.doll);
  assert.equal(pistoletImageRecord(at(plain, EQUIP_SLOTS.LeftHand), true), PISTOLET_ART_RECORDS.dollLeft);
  assert.equal(pistoletImageRecord(at(gold, EQUIP_SLOTS.RightHand), true), PISTOLET_ART_RECORDS.gildedDoll);
  assert.equal(pistoletImageRecord(at(gold, EQUIP_SLOTS.LeftHand), true), PISTOLET_ART_RECORDS.gildedDollLeft);
  assert.equal(pistoletImageRecord(plain, true), PISTOLET_ART_RECORDS.doll, 'unworn: the right\'s');
  assert.equal(pistoletImageRecord(plain, false), PISTOLET_ART_RECORDS.icon);
  assert.equal(pistoletImageRecord(gold, false), PISTOLET_ART_RECORDS.gildedIcon);
});

/** The art through a stub renderer that keeps every upload's pixels. */
async function art(opts) {
  const ups = new Map();
  const renderer = { uploadTexture: (_k, name, img) => { ups.set(name, img); return name; } };
  const a = await loadPistoletArt(renderer, { fetch: async (f) => new Uint8Array(readFileSync(`public/${f}`)), decode: async (b) => readPng(b), ...opts });
  return { a, ups };
}

test('D18 B3: the gilded art gilds EACH frame by its own keep - the pistol, never the hand, never the flash; the enchanted art is type 20 (mutants: the rest frame\'s keep for all; the enchanted plain; the flame gilded)', async () => {
  const plain = await art({});
  const gold = await art({ gilded: true });
  const magic = await art({ magic: true });
  assert.equal(plain.a.weaponType, WEAPON_TYPES.Pistolet);
  assert.equal(magic.a.weaponType, WEAPON_TYPES.Pistolet_Magic, 'an enchanted Pistolet is type 20');
  assert.equal(gold.a.records[1].frames.length, 6);
  let flameKept = 0;
  // PIN MOVED (PISTOL-EDGE): each frame is gilded on the owner's own canvas - where its keep reads the sleeve from the
  // corner the forearm leaves by - and THEN carried past the cut along the rest frame's lean (pistolStrip.js bleedArm) and
  // cropped to the union, as the plain is; the gold is the keep's on the canvas, and the bleed carries it on
  const set = pistolFrameSet(readPng(readFileSync('public/art/pistol-frames.png')), PISTOLET_FEEL.alphaCut);
  const firstOff = (a, b) => { if (a.length !== b.length) return -2; for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return k; return -1; };
  for (let i = 0; i < 6; i++) {
    const p = plain.ups.get(`pistolet:${i}`), g = gold.ups.get(`pistolet:gilded:${i}`);
    const crop = { width: p.width, height: p.height, data: Uint8ClampedArray.from(p.colors) };
    const own = { width: set.cells[i].width, height: set.cells[i].height, data: Uint8ClampedArray.from(set.cells[i].data) };
    const want = cropImage(bleedArm(gildFrame(own, pistoletGildKeep(own)), set.lean), set.union);
    assert.equal(firstOff(g.colors, want.data), -1, `frame ${i + 1}: gilded by its own keep, then bled`);
    assert.equal(firstOff(crop.data, cropImage(set.bled[i], set.union).data), -1, `frame ${i + 1}: the plain the bled cell`);
    const flame = flashMask(crop);
    for (let k = 0; k < flame.length; k++) {
      if (!flame[k]) continue;
      flameKept++;
      for (let c = 0; c < 4; c++) assert.equal(g.colors[k * 4 + c], p.colors[k * 4 + c], `frame ${i + 1}: the flash stays the flash`);
    }
  }
  assert.ok(flameKept > 200, `the flash found and kept (${flameKept} texels)`);
  // the flash is one frame's, and it is not the brass: no flame on the rest frame, and the brass beside the muzzle gilded
  const { frames } = cutStrip(readPng(readFileSync('public/art/pistol-frames.png')));
  assert.equal(flashMask(frames[0]).reduce((a, b) => a + b, 0), 0, 'no flame on the rest frame');
  const flame = flashMask(frames[1]).reduce((a, b) => a + b, 0);
  assert.ok(flame >= 200 && flame <= 280, `the flame and its burnt-red rim, and no more - never the brass beside it (${flame} texels)`);
});

test('D16: the Morrowind rows hold the pistol\'s own grip - its 12-degree rake through the fist, not the rifle\'s - and the gilded row the same (mutants: the rake zero; the rifle\'s grip)', () => {
  const row = OWN_MW_MODELS[PISTOLET_TEMPLATE], gold = OWN_MW_GILDED[PISTOLET_TEMPLATE];
  assert.equal(row.attitude, PISTOL_GRIP_ATTITUDE);
  assert.equal(gold.attitude, PISTOL_GRIP_ATTITUDE);
  assert.notEqual(PISTOL_GRIP_ATTITUDE, GUN_GRIP_ATTITUDE);
  const r = 12 * Math.PI / 180;
  assert.ok(Math.abs(PISTOL_GRIP_ATTITUDE.a[1] - Math.cos(r)) < 1e-12 && Math.abs(PISTOL_GRIP_ATTITUDE.a[4] - Math.sin(r)) < 1e-12, 'twelve degrees');
  // PIN MOVED (PISTOL-STANCE, the owner: "the grip is too high up when held"): the grip's middle sat at the bone, and the
  // fist closed on its lower half; the fist stands PISTOL_FIST_UP up the grip now - the mesh moved down the grip's own way
  const up = [0, Math.sin(r), Math.cos(r)], A = PISTOL_GRIP_ATTITUDE.a;
  const want = [0, 1, 2].map((i) => -PISTOL_FIST_UP * (A[i * 3] * up[0] + A[i * 3 + 1] * up[1] + A[i * 3 + 2] * up[2]));
  assert.ok(PISTOL_GRIP_ATTITUDE.t.every((v, i) => Math.abs(v - want[i]) < 1e-12), `the fist up the grip (${PISTOL_GRIP_ATTITUDE.t})`);
  assert.equal(OWN_MW_MODELS[THUNDERLOCK_TEMPLATE].attitude, GUN_GRIP_ATTITUDE, 'the Thunderlock keeps the rifle\'s');
});

test('C6: a pair on the Morrowind arm - the LEFT pistol keeps the grip\'s attitude through its fist, as the right does (mutant: the off part bare)', () => {
  const shipped = (p) => new Uint8Array(readFileSync(`src/assets/mw/${p}`));
  const files = new Map();
  for (const own of [...Object.values(OWN_MW_MODELS), ...Object.values(OWN_MW_GILDED)]) files.set(`meshes/${own.model}`, shipped(`meshes/${own.model}`));
  const arc = { has: (p) => files.has(p), get: (p) => files.get(p) };
  const find = (p) => (arc.has(p) ? arc : null);
  const skeletonBytes = new Uint8Array(readFileSync('test/fixtures/mw/armfp.nif'));
  for (const weapon of [{ templateIndex: PISTOLET_TEMPLATE }, { templateIndex: PISTOLET_TEMPLATE, rarity: 'gilded' }]) {
    const right = resolveWeaponParts({ weapon, allWeapons: [], find, skeletonBytes, has: archiveHas([arc]) }).parts.find((p) => p.slot === 'weapon');
    const left = resolveOffWeaponParts({ weapon, allWeapons: [], find, skeletonBytes, has: archiveHas([arc]), hasBone: () => true }).parts.find((p) => p.slot === 'offweapon');
    assert.ok(right?.preTransform && left?.preTransform, `${weapon.rarity ?? 'plain'}: both hands carry the attitude`);
    assert.deepEqual(left.preTransform, right.preTransform);
  }
});

test('C5: a Legendary Pistolet is a GUN\'s - The Last Lock claims both guns, and a gun never rolls up as a blade (mutant: the Pistolet unclaimed)', () => {
  assert.deepEqual(legendariesFor(createPistolet()).map((l) => l.id), ['the-last-lock']);
  assert.deepEqual(legendariesFor(createThunderlock()).map((l) => l.id), ['the-last-lock']);
});

test('C9: the pack names it "Dwarven Pistolet", never "Dwarven Dwarven Pistolet" - nor the Thunderlock, nor a Magic or Rare of either ("Warrior\'s Dwarven Pistolet of the Sage", never "Dwarven Warrior\'s Dwarven ..."); a classic weapon keeps its metal in front, plain and Rare (mutants: the metal said twice; the whole name asked)', () => {
  const p = { ...createPistolet(), isIdentified: true }, t = { ...createThunderlock(), isIdentified: true };
  assert.equal(itemLongName(p), 'Dwarven Pistolet');
  assert.equal(itemLongName(t), 'Dwarven Thunderlock');
  // PISTOLET-NAMES (2026-10-22, the owner: "just to make sure"): a Magic's or a Rare's name carries the template's
  // inside its prefix and suffix, and the first cut asked whether the WHOLE name began with the metal - so it took the
  // metal again in front of the prefix
  const seeded = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  for (const tier of ['magic', 'rare']) {
    for (let seed = 1; seed <= 12; seed++) {
      for (const [make, bare] of [[createPistolet, 'Dwarven Pistolet'], [createThunderlock, 'Dwarven Thunderlock']]) {
        const it = applyRarity(make(), tier, seeded(seed));
        it.isIdentified = true;
        const n = itemLongName(it);
        assert.ok(n.includes(bare) && n.split('Dwarven').length === 2, `a ${tier} names its metal once: "${n}"`);
      }
      const sword = applyRarity(createWeapon(119, 1), tier, seeded(seed));
      sword.isIdentified = true;
      assert.match(itemLongName(sword), /^Steel /, `a classic ${tier} keeps its metal in front: "${itemLongName(sword)}"`);
    }
  }
  assert.equal(itemLongName({ ...createWeapon(119, 1), isIdentified: true }), 'Steel Saber', 'and a plain one');
});

test('A10 D32: the siege\'s top for the Pistolet IS its damage\'s top, pinned equal (mutant: the top off by one)', () => {
  assert.equal(SIEGE_PISTOLET.template, PISTOLET_TEMPLATE);
  assert.equal(SIEGE_PISTOLET.max, weaponMaxDamage(PISTOLET_TEMPLATE));
  assert.equal(armsTop(PISTOLET_TEMPLATE, 4), weaponMaxDamage(PISTOLET_TEMPLATE) + 2, 'Dwarven, plus its material\'s two');
});

test('the mint\'s condition clamps into [0, its max] (mutant: unclamped)', () => {
  const max = createPistolet().maxCondition;
  assert.equal(createPistolet({ condition: max * 10 }).currentCondition, max);
  assert.equal(createPistolet({ condition: -5 }).currentCondition, 0);
  assert.equal(createPistolet({ condition: 7 }).currentCondition, 7);
});

test('D30: a pair equipped through the equip law IS a gun pair to the player weapon - Dual, both hands guns', () => {
  const pw = new PlayerWeapon();
  pw.updateHands(createPistolet(), createPistolet()); pw.applyWeapon();
  assert.equal(pw.handsMode, HANDS_MODE.Dual);
  assert.equal(pw.gunPair, true);
  pw.updateHands(createPistolet(), null); pw.applyWeapon();
  assert.equal(pw.gunPair, false, 'one is no pair');
});
