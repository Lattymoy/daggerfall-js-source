// MW-D50 - THE ARROW THE ARCHIVES CARRY (2026-09-12).
//
// Mac: "when wielding a Morrowind bow, the arrow isn't shown being
// drawn and shot from the bow. The actual projectile is correct and
// shoots properly, but on the bow itself, the arrow is never shown
// being ready."
//
// The records come from every .esm attached and the meshes from
// whichever .bsa files are, and the two need not agree: with an
// expansion's .esm beside the base game's, the id-sorted first Arrow
// record is the expansion's, its mesh is in an archive the store may
// not have, and the bow drew empty for ever while the base game's iron
// arrow sat one id further down. The pick now prefers a record whose
// mesh the archives carry; the preload and the read agree; and a bow
// that still resolves without its arrow says why on the console, once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickWeaponRecord, MW_WEAPON_TYPE } from '../src/formats/mwFirstPerson.js';
import { buildFpArm, weaponPartPaths, resolveWeaponParts, archiveHas, fpSkeletonPath, FP_CLIP_PATH } from '../src/combat/fpArm.js';

const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const wpdt = (id, model, type) => {
  const A = (x) => [...x].map((c) => c.charCodeAt(0));
  const Z = (x) => [...A(x), 0];
  const U = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const sub = (n, d) => [...A(n), ...U(d.length), ...d];
  const w = new Uint8Array(32);
  new DataView(w.buffer).setInt16(8, type, true);
  const d = [...sub('NAME', Z(id)), ...sub('MODL', Z(model)), ...sub('FNAM', Z('W')), ...sub('WPDT', [...w])];
  return [...A('WEAP'), ...U(d.length), ...U(0), ...U(0), ...d];
};
const REC = (id, model, type) => ({ id, model, type, enchanted: false });

test('MW-D50: pickWeaponRecord prefers a record whose mesh the archives carry, and keeps the old pick when none is', () => {
  const records = [
    REC('iron arrow', 'w/arrow.nif', MW_WEAPON_TYPE.Arrow),
    REC('adamantium arrow', 'w/adamantium_arrow.nif', MW_WEAPON_TYPE.Arrow),   // sorts first
    REC('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow),
  ];
  assert.equal(pickWeaponRecord(records, MW_WEAPON_TYPE.Arrow).id, 'adamantium arrow', 'without a directory the id-sorted first stands (AUDIT MW-A F3)');
  const onlyBase = (p) => p === 'meshes/w/arrow.nif' || p === 'meshes/w/bowmesh.nif';
  assert.equal(pickWeaponRecord(records, MW_WEAPON_TYPE.Arrow, null, { has: onlyBase }).id, 'iron arrow', 'the expansion\'s arrow has no mesh here: the base game\'s is picked');
  assert.equal(pickWeaponRecord(records, MW_WEAPON_TYPE.Arrow, null, { has: () => false }).id, 'adamantium arrow', 'no mesh at all: the old pick, so the note names the missing file');
  assert.equal(pickWeaponRecord(records, MW_WEAPON_TYPE.Bolt, null, { has: onlyBase }), null);
});

test('MW-D50: the preload and the read pick the same record, through the same directory', () => {
  const allWeapons = [
    REC('adamantium arrow', 'w/adamantium_arrow.nif', MW_WEAPON_TYPE.Arrow),
    REC('iron arrow', 'w/arrow.nif', MW_WEAPON_TYPE.Arrow),
    REC('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow),
  ];
  const files = new Map([['meshes/w/arrow.nif', f('arrow.nif')], ['meshes/w/bowmesh.nif', f('bowmesh.nif')]]);
  const archives = [{ has: (p) => files.has(p), get: (p) => files.get(p) }];
  const has = archiveHas(archives);
  const bow = { templateIndex: 130 };
  const paths = weaponPartPaths({ weapon: bow, hasAmmo: true, allWeapons, has });
  assert.deepEqual(paths, ['meshes/w/bowmesh.nif', 'meshes/w/arrow.nif'], 'the preload names the arrow the archives have');
  const res = resolveWeaponParts({ weapon: bow, hasAmmo: true, allWeapons, find: (p) => (files.has(p) ? archives[0] : null), skeletonBytes: f('armfp.nif'), has });
  assert.ok(res.arrowInfo, `the arrow resolved: ${res.notes.join('; ')}`);
  assert.equal(res.arrowInfo.id, 'iron arrow');
  assert.equal(res.parts.filter((p) => p.slot === 'arrow').length, 1);
});

test('MW-D50: through a real build - an expansion arrow first in the .esm, only the base .bsa attached, and the bow still nocks', async () => {
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')],
    [FP_CLIP_PATH, f('armfpweapon.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/w/bowmesh.nif', f('bowmesh.nif')],
    ['meshes/w/arrow.nif', f('arrow.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  const weap = Uint8Array.from([
    ...wpdt('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow),
    ...wpdt('adamantium arrow', 'w/adamantium_arrow.nif', MW_WEAPON_TYPE.Arrow),   // the expansion's, mesh absent
    ...wpdt('iron arrow', 'w/arrow.nif', MW_WEAPON_TYPE.Arrow),
  ]);
  const deps = {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm', 'weap.esm'],
    loadMorrowindFile: async (n) => (n === 'weap.esm' ? weap : f('armfp.esm')),
  };
  const res = await buildFpArm({ race: 'fprace', weapon: { templateIndex: 130 }, hasAmmo: true, deps });
  assert.ok(res.ok, `${res.stage}: ${res.error}`);
  assert.ok(res.arrow, `the arrow resolved: ${(res.notes || []).join('; ')}`);
  assert.equal(res.arrow.id, 'iron arrow', 'the one whose mesh is here');
  assert.ok(res.rows.some((r) => r.slot === 'arrow') || res.arm.pieces.some((p) => p.slot === 'arrow'), 'and it is a piece of the arm');
  assert.ok(!(res.notes || []).some((n) => n.startsWith('arrow')), 'no arrow note on the card');
});

test('MW-D50: a bow that resolves without its arrow says why on the console, once per reason', () => {
  const allWeapons = [REC('long bow', 'w/bowmesh.nif', MW_WEAPON_TYPE.MarksmanBow)];   // no ammunition records at all
  const said = [];
  const orig = console.warn;
  console.warn = (m) => said.push(String(m));
  try {
    const find = () => ({ get: () => f('bowmesh.nif') });
    for (let i = 0; i < 2; i++) resolveWeaponParts({ weapon: { templateIndex: 130 }, hasAmmo: true, allWeapons, find, skeletonBytes: f('armfp.nif') });
    resolveWeaponParts({ weapon: { templateIndex: 130 }, hasAmmo: false, allWeapons, find, skeletonBytes: f('armfp.nif') });
  } finally { console.warn = orig; }
  assert.equal(said.length, 1, 'once for the reason, and never without ammunition in the pack');
  assert.match(said[0], /^\[mw\] the bow carries no arrow - arrow: your archives carry no unenchanted Morrowind ammunition/);
  const src = rd('src/combat/fpArm.js');
  assert.equal((src.match(/has: archiveHas\(archives\)/g) || []).length, 7, 'every preload and every resolve - two builds, the tp body, the swap\'s two - pass the one directory');
});
