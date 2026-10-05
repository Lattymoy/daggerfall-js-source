// DECOR-MODS (FIELD BUGS 2026-10-05b, the owner: "There seems to be a lot of missing decor items with house
// decoration"; asked which, the town mods' furnishings first). The catalogue read Daggerfall's own blocks alone (WD3), so
// nothing Beautiful Villages, Beautiful Cities or Detailed Ships furnish - the coloured beds, the paintings, the
// tapestries and banners, the set tables and stocked shelves - could be set in a house. Now the pieces the port stands in
// for what the mods place join it, offered while the port stands them: a room's where the mods stand them inside, a
// yard's where outside alone, counted as the mods place them, named as the port names them, numbered after every place
// of Daggerfall's - never the town's own structure. AUDIT 05b A3: every one catalogued whatever is on, the switch asked
// as the piece is offered. Pinned through the real stand-ins, catalogue, scan and decorator; the measure is taken again
// over the player's own blocks where ARENA2 is at hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';
import {
  DECOR_MOD_ROOMS, DECOR_MOD_STREETS, DECOR_MOD_TWINS, DECOR_MOD_LEFT_OUT, addDecorMods, decorModNaming, decorModLive,
  decorModFlatSource, decorModsLive, DECOR_MODS_LIVE_S,
} from '../src/systems/decorMods.js';
import { collectDecor, decorCatalogue, decorRoomEntries, DECOR_KINDS, DECOR_FROM } from '../src/systems/decorCatalogue.js';
import { createDecorScan, decorScanDeps, standInRadius } from '../src/systems/decorScan.js';
import {
  installTownStandIns, TOWN_BED_FIRST, TOWN_BED_COUNT, TOWN_PAINTINGS, ROSYS_PIECES, RMBRP_PIECES, RMBRP_ROCKS, RMBRP_STALLS,
  TOWN_CLUTTER, TOWN_CLUTTER_ARCHIVE, TOWN_GARDEN, TOWN_GARDEN_ARCHIVE, ROSYS_PICTURES,
} from '../src/world/townStandIns.js';
import { DET_MODELS, DET_TOWN_MODELS, DET_FLAT_STAND_INS, DET_FLAT_DRAWINGS, DET_TOWN_FLATS, DET_OLD_ARCHIVES, DET_PICTURES } from '../src/world/detStandIns.js';
import { TOWN_PICTURE_ARCHIVE } from '../src/world/townPictures.js';
import { customModelFor } from '../src/world/customModels.js';
import { decorPrice } from '../src/net/decorLaw.js';
import { installDetailedShipsArt, DETAILED_SHIPS_DERIVED, DETAILED_SHIPS_OWN_ART } from '../src/systems/detailedShips.js';
import { setModSetting } from '../src/systems/modSettings.js';
import { BLOCK_TYPES } from '../src/formats/blocksFile.js';
import { openWorldDataPack } from '../src/formats/worldDataPack.js';
import { rebuildWorldDataPatch } from '../src/formats/worldDataPatch.js';
import { rmb, fakeBlocks, toolRig, settle, rows, all } from './decorFakes.mjs';
import { HAS_ARENA2, loadBlocks, loadMaps, ROOT } from './arena1Data.mjs';

// the port's stand-ins, on - as while a town mod stands (scenes/modWorldData.js), Detailed Ships' own switch off
let townsOn = true;
setModSetting('detailed-ships', 'Enabled', false);
installDetailedShipsArt({ fetchBytes: async () => new Uint8Array(0) });
installTownStandIns(() => townsOn);

const offered = (t) => [...Object.keys(t.models).map((id) => `m${id}`), ...Object.keys(t.flats).map((k) => `f${k.replace('_', '.')}`)];
const ROOM_KEYS = offered(DECOR_MOD_ROOMS), STREET_KEYS = offered(DECOR_MOD_STREETS);

test('DECOR-MODS the pieces: every one the port stands in for the mods - a room\'s where they stand it inside, a street\'s where outside alone - never the town\'s structure, a sown field or the sea\'s; a twin offered once, DET\'s old archive numbers its new ones (mutants: DECORMODS-structure-offered, DECORMODS-twin-offered)', () => {
  assert.deepEqual([ROOM_KEYS.length, STREET_KEYS.length], [223, 74]);
  assert.equal(new Set([...ROOM_KEYS, ...STREET_KEYS]).size, 297, 'no piece in both');
  const models = [...Object.keys(DECOR_MOD_ROOMS.models), ...Object.keys(DECOR_MOD_STREETS.models)].map(Number);
  // every model offered is one the port stands in for the mods
  const standIns = new Set([...Array(TOWN_BED_COUNT).keys()].map((k) => TOWN_BED_FIRST + k).concat(
    [TOWN_PAINTINGS, ROSYS_PIECES, RMBRP_PIECES, DET_MODELS, DET_TOWN_MODELS].flatMap((t) => Object.keys(t).map(Number))));
  for (const id of models) assert.ok(standIns.has(id), `${id} is a stand-in`);
  // ...and every one of those offered, a twin, or left out by why
  const left = new Set([...DECOR_MOD_LEFT_OUT.hills, ...DECOR_MOD_LEFT_OUT.structure, ...DECOR_MOD_LEFT_OUT.fields]);
  for (const id of standIns) {
    const where = [models.includes(id), !!DECOR_MOD_TWINS[id], left.has(id)].filter(Boolean).length;
    assert.equal(where, 1, `${id}: offered, a twin or left out - exactly one`);
  }
  for (const [twin, one] of Object.entries(DECOR_MOD_TWINS)) assert.ok(models.includes(one) && !models.includes(Number(twin)), `${twin} is offered as ${one}`);
  assert.deepEqual(DECOR_MOD_LEFT_OUT.sea, ['10009_29', '10009_30', '10009_31']);
  // the flats: every one a mod's own archive the port stands in, never an old DET number, never the sea's
  const flatKeys = [...Object.keys(DECOR_MOD_ROOMS.flats), ...Object.keys(DECOR_MOD_STREETS.flats)];
  const known = new Set([
    ...[DET_FLAT_STAND_INS, DET_FLAT_DRAWINGS, DET_TOWN_FLATS].flatMap((t) => Object.entries(t).flatMap(([a, rs]) => Object.keys(rs).map((r) => `${a}_${r}`))),
    ...Object.keys(TOWN_CLUTTER).map((r) => `${TOWN_CLUTTER_ARCHIVE}_${r}`), ...Object.keys(TOWN_GARDEN).map((r) => `${TOWN_GARDEN_ARCHIVE}_${r}`),
    ...[...Object.keys(DETAILED_SHIPS_DERIVED), ...DETAILED_SHIPS_OWN_ART].map((n) => n.replace(/-0$/, '')),
  ]);
  for (const k of flatKeys) {
    assert.ok(known.has(k), `${k} is a stand-in`);
    assert.ok(!(Number(k.split('_')[0]) in DET_OLD_ARCHIVES) && !DECOR_MOD_LEFT_OUT.sea.includes(k), k);
  }
  // inside or outside, as the mods stand them: their beds, paintings and Rosy's pieces in a room; rocks and stalls outside
  for (const id of [TOWN_BED_FIRST, ...Object.keys(TOWN_PAINTINGS), ...Object.keys(ROSYS_PIECES)]) assert.ok(ROOM_KEYS.includes(`m${id}`), `${id} a room's`);
  for (const id of [...Object.keys(RMBRP_ROCKS), ...Object.keys(RMBRP_STALLS)]) assert.ok(STREET_KEYS.includes(`m${id}`), `${id} a street's`);
});

test('DECOR-MODS the offer follows the port\'s own switch: every piece offered while its stand-in stands, none while the mods are off - AUDIT 05b A3: and every one catalogued whatever is on, so no name, kind or number moves with a switch; a key a place of Daggerfall\'s holds stays that place\'s (mutants: DECORMODS-unswitched, DECORMODS-offered-unswitched, DECORMODS-place-overwritten)', () => {
  const c = addDecorMods(new Map());
  assert.equal(c.size, 297);
  assert.deepEqual([c.get('m42069').count, c.get('m42069').from, c.get('f10010.44').count, c.get('f10010.44').from], [347, 'mod', 1607, 'modstreet']);
  const cat = decorCatalogue(c);
  const yard = { kind: 'home', yard: true, natureBase: 504 };
  assert.equal(decorModsLive(cat).size, 297, 'every one stands while the mods do');
  assert.equal(decorRoomEntries(cat, yard, true, decorModsLive(cat)).length, 297, 'and is offered');
  townsOn = false;
  try {
    // DET's pieces and Cliffworms' answer Detailed Ships' switch too - off here as the towns'
    assert.deepEqual([addDecorMods(new Map()).size, decorModsLive(cat).size], [297, 0], 'the mods off: every piece catalogued, none standing');
    assert.deepEqual([decorRoomEntries(cat, yard, true, decorModsLive(cat)).length, decorRoomEntries(cat, yard, true).length], [0, 0], 'none offered - nor where the offer is told nothing stands');
    const named = (list) => list.map((e) => [e.key, e.kind, e.name]);
    assert.deepEqual(named(decorCatalogue(addDecorMods(new Map()))), named(cat), 'no name, kind or number moves with a switch');
  } finally { townsOn = true; }
  const room = collectDecor([rmb([], [[56790, 2]])]);
  addDecorMods(room);
  assert.deepEqual([room.get('f56790.2').from, room.get('f56790.2').count], ['room', 1], 'a room\'s own stays the room\'s');
  assert.deepEqual([DECOR_FROM.mod, DECOR_FROM.modstreet], [4, 5], 'after every place of Daggerfall\'s');
});

test('DECOR-MODS the names and the filing: a bed by its colour, filed with the beds; a hanging by its picture; a drawn sprite by its drawing; a flat standing in as one of Daggerfall\'s filed and numbered as that one\'s kind; the rest the mods\' own furnishing - and no name of Daggerfall\'s moves; offered in every room and a yard, a street\'s in a yard alone (mutants: DECORMODS-filed-as-itself, DECORMODS-unnamed, DECORMODS-numbered-first, DECORMODS-kind-unset, DECORMODS-street-indoors)', () => {
  assert.deepEqual(decorModNaming({ model: 42069 }), { base: 'Blue bed', as: 41000 });
  assert.deepEqual(decorModNaming({ model: 45008 }).base, 'Tapestry of Glenpoint');
  assert.deepEqual(decorModNaming({ model: 45150 }).base, 'Banner of Akatosh');
  assert.deepEqual(decorModNaming({ model: 69471 }).base, 'Rug 3');
  assert.deepEqual(decorModNaming({ flat: [10010, 44] }), { base: 'Dove', as: 10010 });
  assert.deepEqual(decorModNaming({ flat: [56790, 2] }), { base: null, as: TOWN_CLUTTER[2][0] });
  assert.deepEqual(decorModNaming({ flat: [1210, 10] }), { base: 'Green bottle', as: 205 });
  assert.deepEqual(decorModFlatSource(1021, 13), [...DET_FLAT_STAND_INS[10021][13]], 'an old DET number is its new one');
  // a classic room: a bed, a box, a book and a chair, then the mods
  const classic = rmb([41000, 41001, 41120], [[205, 9], [209, 2]]);
  const alone = Object.fromEntries(decorCatalogue(collectDecor([classic])).map((e) => [e.key, e.name]));
  const cat = decorCatalogue(addDecorMods(collectDecor([classic])));
  const by = Object.fromEntries(cat.map((e) => [e.key, e]));
  for (const [k, name] of Object.entries(alone)) assert.equal(by[k].name, name, `${k} keeps "${name}"`);
  assert.deepEqual(['m42069', 'm42070', 'm42071'].map((k) => [by[k].kind, by[k].name]), [['bed', 'Blue bed 1'], ['bed', 'Blue bed 2'], ['bed', 'Blue bed 3']]);
  assert.deepEqual([by['f56790.2'].kind, by['f1210.1'].kind], ['boxes', 'books'], 'filed as the classic flats they stand in as');
  assert.ok(by['f56790.2'].name.startsWith('Box ') && Number(by['f56790.2'].name.slice(4)) > 1, 'numbered after the room\'s own box');
  assert.deepEqual([by['m45008'].kind, by['m45008'].name, by['m69420'].kind, by['m69420'].name], ['mods', 'Tapestry of Glenpoint', 'mods', 'Painting 1']);
  assert.deepEqual([by['m53038'].kind, by['m53038'].outside, by['f10010.44'].kind, by['f10010.44'].name], ['outdoor', true, 'outdoor', 'Dove 2']);
  assert.equal(DECOR_KINDS.mods, 'Town mods\' furnishings');
  // offered: the mods' rooms' in every room and a yard; their streets' in a yard alone
  const keys = (r) => new Set(decorRoomEntries(cat, r, true, decorModsLive(cat)).map((e) => e.key));
  for (const r of [{ kind: 'house' }, { kind: 'ship' }, { kind: 'home', yard: true, natureBase: 504 }]) assert.ok(keys(r).has('m42069') && keys(r).has('f56790.2'), JSON.stringify(r));
  assert.deepEqual([keys({ kind: 'house' }).has('m53038'), keys({ kind: 'home', yard: true, natureBase: 504 }).has('m53038')], [false, true]);
});

test('DECOR-MODS the scan, through the hosts\' one constructor: the mods\' pieces join after the blocks are read, each measured - a stand-in off its own model, a coloured bed off its classic one - so priced; a host that asks for none reads none (mutants: DECORMODS-scan-unjoined, DECORMODS-stand-in-unmeasured, DECORMODS-alias-unmeasured)', async () => {
  const blocks = fakeBlocks([{ type: BLOCK_TYPES.Rmb, block: rmb([41000]) }]);
  const arch = { getRecordIndex: (id) => (id === 41000 ? 7 : -1), getMesh: () => ({ radius: 60 }) };
  const getTexture = async () => ({ recordCount: 64, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }) });
  const deps = decorScanDeps({ blocks, arch, getTexture });
  assert.equal(deps.mods, true);
  assert.equal(deps.modelRadius(42069), 1.5, 'a blue bed: its classic bed\'s size');
  const r = deps.modelRadius(45190);
  assert.ok(r > 0 && r === standInRadius(45190), 'the sea chest: its own model\'s');
  const scan = createDecorScan(deps);
  for (let i = 0; i < 40 && scan.phase() !== 'done'; i++) { scan.step(); await new Promise((res) => setTimeout(res, 0)); }
  const e = scan.entries();
  assert.ok(['m42069', 'm45190', 'f10021.7', 'm53038'].every((k) => e.some((x) => x.key === k)), 'the mods\' pieces');
  assert.ok(['m42069', 'm45190', 'm53038'].every((k) => scan.radiusOf(e.find((x) => x.key === k)) > 0), 'measured, so priced');
  const none = createDecorScan({ ...deps, mods: false });
  while (none.phase() === 'blocks') none.step();
  assert.equal(none.entries().some((x) => x.key === 'm42069'), false, 'a host that asks for none reads none');
});

test('DECOR-MODS AUDIT 05b A3 the scan: a piece the port stood only after the scan measured it - its mod off, or its pack not landed - is measured when the host asks again, in the steps after, so priced; never one measured already (mutant: DECORMODS-never-remeasured)', async () => {
  const blocks = fakeBlocks([{ type: BLOCK_TYPES.Rmb, block: rmb([41000]) }]);
  const arch = { getRecordIndex: (id) => (id === 41000 ? 7 : -1), getMesh: () => ({ radius: 60 }) };
  const getTexture = async () => ({ recordCount: 64, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }) });
  townsOn = false;
  try {
    const scan = createDecorScan(decorScanDeps({ blocks, arch, getTexture }));
    for (let i = 0; i < 40 && scan.phase() !== 'done'; i++) { scan.step(); await settle(); }
    const chest = scan.entries().find((x) => x.key === 'm45190'), bed = scan.entries().find((x) => x.key === 'm42069');
    assert.deepEqual([scan.radiusOf(chest), scan.radiusOf(bed), scan.lateSized()], [null, null, 0], 'catalogued, but no stand-in to measure while the mods are off');
    townsOn = true;
    scan.remeasure(decorModsLive(scan.entries()));
    for (let i = 0; i < 20; i++) { scan.step(); await settle(); }
    assert.deepEqual([scan.radiusOf(chest), scan.radiusOf(bed)], [standInRadius(45190), 1.5], 'measured once it stands: the chest off its own model, the bed off its classic one');
    const n = scan.lateSized();
    assert.ok(n >= 2, 'counted, so the panel lists again');
    scan.remeasure(decorModsLive(scan.entries()));
    for (let i = 0; i < 4; i++) { scan.step(); await settle(); }
    assert.equal(scan.lateSized(), n, 'none measured twice');
  } finally { townsOn = true; }
});

test('DECOR-MODS AUDIT 05b A3 the decorator asks the switches as it offers, never once a session: a mod turned off with the panel up takes its pieces off the list within the second; turned on, they come back - one measured only then, priced and listed again as it lands (mutants: DECORMODS-live-once, DECORMODS-late-unlisted)', async () => {
  // the rig's own blocks and measures, the mods joined: a stand-in measured off its own model (none while it is off), a
  // mod's flat by its picture (an archive past Daggerfall's has one only through its stand-in)
  const scan = { mods: true, modelRadius: (id) => (id < TOWN_BED_FIRST ? 0.8 : standInRadius(id)), flatRadius: async (a, r) => (a > 511 && !decorModLive({ model: null, flat: [a, r] }) ? null : 0.2) };
  townsOn = false;
  try {
    const rig = toolRig({ scan, gold: 100000 });
    rig.frame();
    assert.equal(rig.tool.openPanel(), true);
    const run = async (n) => { for (let i = 0; i < n; i++) { rig.frame({ overlayUp: true }); await settle(); } };
    await run(12);
    const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
    const row = (k) => rows(root).find((r) => r.dataset.key === k) ?? null;
    assert.deepEqual([!!row('m41000'), row('m45190')], [true, null], 'the mods off as it opens: Daggerfall\'s own, none of theirs');
    townsOn = true;
    await run(Math.ceil(DECOR_MODS_LIVE_S / 0.1) + 1);
    assert.ok(row('m45190'), 'turned on with the panel up: offered within the second');
    await run(10);   // the scan's steps after: a step's worth of models at a time
    assert.equal(all(row('m45190'), 'dfdecor-row-price')[0].textContent, `${decorPrice(standInRadius(45190), 1)} gold`, 'measured then, so priced - listed again as it landed');
    townsOn = false;
    await run(Math.ceil(DECOR_MODS_LIVE_S / 0.1) + 2);
    assert.equal(row('m45190'), null, 'turned off again: gone from the list');
  } finally { townsOn = true; }
});

test('DECOR-MODS AUDIT 05b A8 the names, off the tables: every hanging and rug is named by the picture its builder wears - one table both read (DET_PICTURES, ROSYS_PICTURES) - and no piece\'s name builds a model or asks a switch (mutants: DECORMODS-names-built, DECORMODS-picture-table-unread)', () => {
  const hung = [...Object.keys(DET_PICTURES), ...Object.keys(ROSYS_PICTURES)].map(Number);
  assert.equal(hung.length, 47);
  for (const id of hung) {
    const worn = customModelFor(id).subMeshes.find((m) => m.textureArchive === TOWN_PICTURE_ARCHIVE).textureRecord;
    assert.equal(worn, DET_PICTURES[id] ?? ROSYS_PICTURES[id], `${id}: the builder wears its table's picture`);
  }
  const every = [...Object.keys(DECOR_MOD_ROOMS.models), ...Object.keys(DECOR_MOD_STREETS.models)].map((id) => ({ model: Number(id) }))
    .concat([...Object.keys(DECOR_MOD_ROOMS.flats), ...Object.keys(DECOR_MOD_STREETS.flats)].map((k) => ({ flat: k.split('_').map(Number) })));
  const on = every.map(decorModNaming);
  townsOn = false;
  try {
    assert.deepEqual(every.map(decorModNaming), on, 'the same names with every switch off');
  } finally { townsOn = true; }
  for (const id of hung.filter((k) => `${k}` in DECOR_MOD_ROOMS.models)) assert.ok(on[every.findIndex((w) => w.model === id)].base, `${id} named`);
});

test('DECOR-MODS measured (ARENA2): every stand-in the mods place - both town packs and Detailed Ships\' two ships over the player\'s own blocks - is offered with the count and the place measured, a twin\'s count in its one, an old DET number\'s in its new one, or left out by why', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const blocks = loadBlocks(), maps = loadMaps();
  const inside = new Map(), outside = new Map();
  const tally = (key, side) => { const m = side === 'Interior' ? inside : outside; m.set(key, (m.get(key) ?? 0) + 1); };
  const walk = (rb) => {
    for (const s of rb.SubRecords) {
      for (const side of ['Exterior', 'Interior']) {
        for (const m of s[side].Block3dObjectRecords) tally(`m${m.ModelIdNum}`, side);
        for (const f of s[side].BlockFlatObjectRecords) tally(`f${f.TextureArchive}.${f.TextureRecord}`, side);
      }
    }
    for (const m of rb.Misc3dObjectRecords ?? []) tally(`m${m.ModelIdNum}`, 'Misc');
    for (const f of rb.MiscFlatObjectRecords ?? []) tally(`f${f.TextureArchive}.${f.TextureRecord}`, 'Misc');
  };
  for (const v of ['beautiful-villages', 'beautiful-cities']) {
    const p = openWorldDataPack(JSON.parse(zlib.gunzipSync(readFileSync(join(ROOT, `vendor/${v}/WorldDataPack/${v}.pack.json.gz`))).toString('utf8')), { blocks });
    for (const name of p.names()) if (name.endsWith('.RMB.json')) walk(p.rebuild(name, maps).RmbBlock);
    p.release();
  }
  for (const f of ['SHIPAA00.RMB-390-building0.json', 'SHIPAA01.RMB-630-building0.json']) {
    const json = rebuildWorldDataPatch(JSON.parse(readFileSync(join(ROOT, 'vendor/detailed-ships/WorldDataPatches', f), 'utf8')), blocks);
    walk({ SubRecords: [json.RmbSubRecord] });
  }
  // fold the twins and the old numbers as the tables do, keep the stand-ins
  const fold = (key) => {
    const m = /^m(\d+)$/.exec(key);
    if (m) return `m${DECOR_MOD_TWINS[m[1]] ?? m[1]}`;
    const [a, r] = key.slice(1).split('.').map(Number);
    return `f${DET_OLD_ARCHIVES[a] ?? a}.${r}`;
  };
  const want = new Map();
  for (const [side, map] of [['in', inside], ['out', outside]]) {
    for (const [key, n] of map) {
      const what = key[0] === 'm' ? { model: Number(key.slice(1)), flat: null } : { model: null, flat: key.slice(1).split('.').map(Number) };
      if (!decorModLive(what) || (what.flat && what.flat[0] <= 511)) continue;
      const k = fold(key);
      const w = want.get(k) ?? { in: 0, out: 0 };
      w[side] += n;
      want.set(k, w);
    }
  }
  const left = new Set([...DECOR_MOD_LEFT_OUT.hills, ...DECOR_MOD_LEFT_OUT.structure, ...DECOR_MOD_LEFT_OUT.fields].map((id) => `m${id}`)
    .concat(DECOR_MOD_LEFT_OUT.sea.map((k) => `f${k.replace('_', '.')}`)));
  const got = new Map([...ROOM_KEYS.map((k) => [k, 'in']), ...STREET_KEYS.map((k) => [k, 'out'])]);
  const countOf = (k) => (k[0] === 'm' ? { ...DECOR_MOD_ROOMS.models, ...DECOR_MOD_STREETS.models }[k.slice(1)] : { ...DECOR_MOD_ROOMS.flats, ...DECOR_MOD_STREETS.flats }[k.slice(1).replace('.', '_')]);
  for (const [k, w] of want) {
    if (left.has(k)) { assert.ok(!got.has(k), `${k} left out`); continue; }
    assert.equal(got.get(k), w.in > 0 ? 'in' : 'out', `${k}: inside where any stands inside`);
    assert.equal(countOf(k), w.in + w.out, `${k}: its count`);
  }
  for (const k of got.keys()) assert.ok(want.has(k), `${k}: one the mods place`);
});
