// MW-ASSIGN (2026-09-27, Discord: "Some sprites not assigned morrowind skin").
//
// THE PIECES THAT FELL THROUGH THE ITEM MAP, ASSIGNED. With Morrowind data attached a hung weapon or a displayed piece
// of armour is its Morrowind picture (MW-MOUNT) - but only for what the one item map could read: DFU's own weapons and
// armour. Three kinds stood as their classic sprites instead: the port's own weapon (the Thunderlock, which is its own
// shipped model in the hand but was never asked for on the icon or the wall), and Roleplay & Realism Items' two
// weapons and twelve pieces of armour (templates 513-526), which no row knew - in Morrowind first person those
// weapons drew empty hands, and worn, those pieces were bare skin. Each now resolves as the classic item of its shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MwBsaFile } from '../src/formats/mwBsaFile.js';
import { MW_WEAPON_TYPE, MOD_WEAPON_TO_MW, dfWeaponToMw } from '../src/formats/mwFirstPerson.js';
import { MOD_ARMOR_ROWS, mwArmorRecords, armorRowOf, DF_ARMOR_ROWS, dfWornArmor } from '../src/formats/mwItemMap.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { RRI_CLASSES } from '../src/systems/rriItems.js';
import { WEAPONS, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { THUNDERLOCK_TEMPLATE } from '../src/characters/thunderlockIds.js';
import { createFpArm, fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';
import { createDecorRoom, MW_STAND_ARCHIVE, decorStandsOwn } from '../src/scenes/decorRoom.js';
import { ITEM_GROUP_NAME_BY_CLASS } from '../src/systems/loot.js';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('MW-ASSIGN the weapons: Roleplay & Realism Items\' Archer\'s Axe is a one-handed axe and its Light Flail a one-handed blunt, as the classic flail; nothing else moves (mutants: a row dropped; the classic table read second)', () => {
  assert.deepEqual({ ...MOD_WEAPON_TO_MW }, { 513: MW_WEAPON_TYPE.AxeOneHand, 514: MW_WEAPON_TYPE.BluntOneHand });
  assert.deepEqual(Object.keys(MOD_WEAPON_TO_MW).map(Number), Object.values(RRI_CLASSES).filter((c) => c.group === 'Weapons').map((c) => c.index), 'the mod\'s every weapon');
  assert.equal(dfWeaponToMw({ group: 'Weapons', templateIndex: 513 }, WEAPONS), MW_WEAPON_TYPE.AxeOneHand);
  assert.equal(dfWeaponToMw({ group: 'Weapons', templateIndex: 514 }, WEAPONS), MW_WEAPON_TYPE.BluntOneHand);
  assert.equal(dfWeaponToMw({ group: 'Weapons', templateIndex: WEAPONS.Flail }, WEAPONS), MW_WEAPON_TYPE.BluntOneHand, 'the classic flail, as ever');
  assert.equal(dfWeaponToMw({ group: 'Weapons', templateIndex: 9999 }, WEAPONS), MW_WEAPON_TYPE.None);
  assert.equal(dfWeaponToMw({ group: 'Weapons', templateIndex: 513, werecreatureClaws: true }, WEAPONS), MW_WEAPON_TYPE.None, 'claws are no axe');
});

test('MW-ASSIGN the armour: every piece of the mod\'s two sets by the classic row of its shape, its material through the classic chain; a vambrace is a bracer first, one side; worn, each is dressed and a helmet hides the hair (mutants: a row missing; the vambrace\'s sides; the worn filter on the classic rows alone)', () => {
  const armour = Object.values(RRI_CLASSES).filter((c) => c.group === 'Armor').map((c) => c.index);
  assert.deepEqual(Object.keys(MOD_ARMOR_ROWS).map(Number), armour, 'the mod\'s every piece');
  const as = (t) => Object.entries(DF_ARMOR_ROWS).find(([, r]) => r === MOD_ARMOR_ROWS[t])?.[0];
  assert.deepEqual([515, 516, 517, 518, 519, 520, 521, 522, 523, 524].map((t) => Number(as(t))),
    [ARMOR_ENUM.Cuirass, ARMOR_ENUM.Greaves, ARMOR_ENUM.Left_Pauldron, ARMOR_ENUM.Right_Pauldron, ARMOR_ENUM.Boots,
      ARMOR_ENUM.Cuirass, ARMOR_ENUM.Greaves, ARMOR_ENUM.Helm, ARMOR_ENUM.Boots, ARMOR_ENUM.Gauntlets]);
  assert.equal(armorRowOf(ARMOR_ENUM.Helm), DF_ARMOR_ROWS[ARMOR_ENUM.Helm], 'a classic row is its own');
  const R = (id) => ({ id, model: `a/${id}.nif`, name: id, enchanted: false });
  const recs = [R('steel_cuirass'), R('netch_leather_cuirass'), R('netch_leather_bracer_left'), R('netch_leather_bracer_right'),
    R('netch_leather_gauntlet_left'), R('iron_pauldron_left'), R('iron_pauldron_right'), R('netch_leather_helm'), R('chain_greaves')];
  assert.equal(mwArmorRecords(recs, 515, ARMOR_MATERIAL.Steel).records[0].id, 'steel_cuirass', 'a steel mail hauberk is steel');
  assert.equal(mwArmorRecords(recs, 520, ARMOR_MATERIAL.Leather).records[0].id, 'netch_leather_cuirass', 'a jerkin is leather');
  assert.equal(mwArmorRecords(recs, 516, ARMOR_MATERIAL.Chain).records[0].id, 'chain_greaves');
  assert.deepEqual(mwArmorRecords(recs, 525, ARMOR_MATERIAL.Leather).records.map((r) => r.id), ['netch_leather_bracer_left'], 'the left vambrace: the left bracer, before any gauntlet');
  assert.deepEqual(mwArmorRecords(recs, 526, ARMOR_MATERIAL.Leather).records.map((r) => r.id), ['netch_leather_bracer_right']);
  assert.deepEqual(mwArmorRecords(recs, 517, ARMOR_MATERIAL.Iron).records.map((r) => r.id), ['iron_pauldron_left']);
  assert.equal(mwArmorRecords(recs, 522, ARMOR_MATERIAL.Leather).records[0].id, 'netch_leather_helm');
  assert.deepEqual(mwArmorRecords(recs, 600, ARMOR_MATERIAL.Leather).records, [], 'no row: the classic sprite, said');
  const S = { Head: 0, RightArm: 1, LeftArm: 2, ChestArmor: 3, Gloves: 4, LegsArmor: 5, Feet: 6, RightHand: 7, LeftHand: 8 };
  const worn = dfWornArmor([{ templateIndex: 522, material: 0 }, null, { templateIndex: 525, material: 0 }, { templateIndex: 515, material: ARMOR_MATERIAL.Steel }], S, ARMOR_ENUM);
  assert.deepEqual(worn.map((w) => w.templateIndex), [522, 525, 515], 'worn, the mod\'s pieces are dressed');
  assert.match(src('src/formats/mwItemMap.js'), /if \(armorRowOf\(piece\.templateIndex\) === DF_ARMOR_ROWS\[HELM_TEMPLATE\]\) hairHidden/, 'a helm-shaped piece hides the hair');
});

// ── the wall and the icon: the rig's own door ─────────────────────────

function makeBsa(files) {
  const names = [...files.keys()];
  const enc = new TextEncoder();
  const nameBytes = names.map((n) => enc.encode(n.replace(/\//g, '\\')));
  let nameBufSize = 0;
  const nameOffsets = [];
  for (const nb of nameBytes) { nameOffsets.push(nameBufSize); nameBufSize += nb.length + 1; }
  const dirSize = 12 * names.length + nameBufSize;
  const dataSize = names.reduce((a, n) => a + files.get(n).length, 0);
  const out = new Uint8Array(12 + dirSize + 8 * names.length + dataSize);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x100, true); dv.setUint32(4, dirSize, true); dv.setUint32(8, names.length, true);
  let o = 12, off = 0;
  for (const n of names) { dv.setUint32(o, files.get(n).length, true); dv.setUint32(o + 4, off, true); o += 8; off += files.get(n).length; }
  for (const no of nameOffsets) { dv.setUint32(o, no, true); o += 4; }
  for (const nb of nameBytes) { out.set(nb, o); o += nb.length; out[o++] = 0; }
  o += 8 * names.length;
  for (const n of names) { out.set(files.get(n), o); o += files.get(n).length; }
  return out;
}
const weap = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};
const STAFF = 115;
const WEAP_ESM = Uint8Array.from([
  ...weap('iron staff', 'w/weapon.nif', MW_WEAPON_TYPE.BluntTwoWide),
  ...weap('iron war axe', 'w/axe.nif', MW_WEAPON_TYPE.AxeOneHand),
]);
const ARCHIVE = makeBsa(new Map([
  [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpweapon.kf')],
  ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
  ['meshes/w/weapon.nif', f('weapon.nif')], ['meshes/w/axe.nif', f('weapon.nif')],
  ['meshes/thunderlock.nif', f('weapon.nif')],   // the port's own shipped model stands in the list as ownMwAssets' archive does
  ['textures/tx_fixture.dds', f('fixture.dds')],
]));

test('MW-ASSIGN the wall and the icon: the Thunderlock hangs as its own shipped model and the Archer\'s Axe as Morrowind\'s axe of its material, where both stood as the classic picture (mutants: the own model unasked; the mod\'s weapon unmapped)', async () => {
  const archive = await MwBsaFile.open(new Blob([ARCHIVE]));
  const renderer = {
    createCharacterMesh: () => ({ vao: {}, buffers: [] }),
    updateCharacterMesh: () => {},
    createCharacterTexture: (mips) => ({ mips }),
    renderCharacterSpriteImage: (mesh, model, proj, view, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0 }));
  const deps = {
    loadMorrowindArchives: async () => [archive],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? WEAP_ESM : f('armfp.esm')),
  };
  const res = await arm.build({ race: 'fprace', weapon: { group: 'Weapons', templateIndex: STAFF, material: WEAPON_MATERIALS.Iron }, deps });
  assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
  const gun = await arm.mountPicture({ group: 'Weapons', templateIndex: THUNDERLOCK_TEMPLATE, material: WEAPON_MATERIALS.Dwarven });
  assert.ok(gun, 'the Thunderlock pictured');
  assert.match(gun.key, /:daggerfall_thunderlock:256$/, 'its own model');
  const axe = await arm.mountPicture({ group: 'Weapons', templateIndex: 513, material: WEAPON_MATERIALS.Iron });
  assert.ok(axe, 'the Archer\'s Axe pictured');
  assert.match(axe.key, /:iron war axe:256$/, 'Morrowind\'s one-handed axe, of its material');
});

// ── one's own thing set down: its Morrowind picture, on the billboard pass ──


const SHIRT = { t: 141, g: ITEM_GROUP_NAME_BY_CLASS.indexOf('MensClothing'), m: null, v: null, a: null, p: null };
const GEM = { t: 400, g: ITEM_GROUP_NAME_BY_CLASS.indexOf('Gems'), m: null, v: null, a: null, p: null };
const standPiece = (id, item) => ({ id, model: null, flat: [204, 0], item, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 });

test('MW-ASSIGN a garment set down stands as its Morrowind picture - the billboard keyed by the picture, its size the picture\'s - while a build stands; a thing with none, and every piece without a build, stands as its world picture; a refresh lets the old pictures go (mutants: the stand never asked; the classic drawn over it; the keys never let go)', async () => {
  const made = [];
  const released = [];
  const asked = [];
  let build = true;
  const room = createDecorRoom({
    meshes: null, collider: () => null, origin: () => [0, 0, 0],
    renderer: {
      createBillboardBatch: (a, r, size) => { const b = { a, r, size }; made.push(b); return b; },
      destroyBillboardBatch() {},
      uploadTexture: (a, r) => `tex:${a}_${r}`,
      releaseTexture: (a, r) => released.push(`${a}_${r}`),
    },
    getTexture: async () => ({ recordCount: 8, getSize: () => ({ width: 20, height: 30 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 }),
    uploadRecord() {},
    mwPicture: async (item) => { asked.push(item.group); return build && item.group === 'MensClothing' ? { key: 'mount:1:common_shirt_01:256', image: { width: 1, height: 1, data: new Uint8ClampedArray(4) }, w: 0.5, h: 0.7 } : null; },
  });
  assert.equal(decorStandsOwn(standPiece('s', SHIRT)), true);
  assert.equal(decorStandsOwn({ ...standPiece('x', SHIRT), item: null }), false, 'the catalogue\'s own flats are the game\'s');
  room.put(standPiece('shirt', SHIRT));
  room.put(standPiece('gem', GEM));
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  const shirt = made.find((b) => b.a === MW_STAND_ARCHIVE);
  assert.ok(shirt, 'the shirt stands as its Morrowind picture');
  assert.equal(shirt.r, 'mount:1:common_shirt_01:256');
  assert.deepEqual(shirt.size, { w: 0.5, h: 0.7 }, 'at the picture\'s own size');
  assert.equal(made.filter((b) => b.a === 204).length, 1, 'the gem, with no Morrowind picture, stands as its world picture - and only it');
  assert.deepEqual(asked.sort(), ['Gems', 'MensClothing']);
  build = false;
  room.refreshMounts();
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  assert.ok(released.includes(`${MW_STAND_ARCHIVE}_mount:1:common_shirt_01:256`), 'the old picture let go');
  assert.deepEqual(made.slice(-2).map((b) => b.a), [204, 204], 'no build: the shirt stands as its world picture again, as the gem does');
});
