// IT1 (2026-10-04): IMMERSIVE TRAVEL'S CARRIAGES AT THE GATES. OWN-WORK2 (2026-10-31, the owner: "Wave 2: data and
// words"): the stand is our own (world/immersiveTravelGates.js CARRIAGE_STAND, STAND_DRIVERS), set in each gate's frame;
// the author's edit of WALLAA08-11 left the tree, and no gate block is edited. The LAYER lays the stand onto whichever
// gate file the door serves - Beautiful Cities' gates and its wall-and-farm composites (the owner's "Add carriages to
// either") - moved the least step that stands it clear of that file's things.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerWorldDataAsset, registerWorldDataLayer, getDFBlockReplacementData, installWorldDataReplacement, _resetWorldDataReplacement } from '../../../src/formats/worldData/worldDataReplacement.js';
import {
  layGateRecords, installImmersiveTravelGates, carriageRecordsOf, standRecords, standShift, gateFileClear, IT_GATE_FILE, IT_GATE_FRAMES,
  CARRIAGE_STAND, STAND_DRIVERS, STAND_DRIVER_FACTION,
} from '../../../src/world/immersiveTravelGates.js';
import { CARRIAGE_DRIVERS_FACTION_ID } from '../../../src/systems/immersiveTravel.js';
import { GATE_CLEAR, GATE_OPENING } from '../../../src/world/townWalls.js';
import { setValue, resetToDefaults } from '../../../src/systems/settings/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GATES = ['WALLAA08', 'WALLAA09', 'WALLAA10', 'WALLAA11'];
/** A record's place in its gate's frame: [along, out] metres. */
const local = (gate, r) => {
  const f = IT_GATE_FRAMES[gate], dx = r.XPos * 0.025 - f.at[0], dz = (r.ZPos + 4096) * 0.025 - f.at[1];
  return [dx * f.out[1] - dz * f.out[0], dx * f.out[0] + dz * f.out[1]];
};
/** A gate file of another mod's, made up here: open ground, no house, `models` and `flats` its own records. */
const gateFile = (name, { models = [], flats = [], houses = [] } = {}) => {
  const AutoMapData = new Array(4096).fill(0);
  for (const [gx, gz] of houses) AutoMapData[(63 - gz) * 64 + gx] = 0x10;
  return { Name: name, RmbBlock: { FldHeader: { AutoMapData, GroundData: { GroundTiles: [] } }, SubRecords: [], Misc3dObjectRecords: models, MiscFlatObjectRecords: flats } };
};

test('OWN-WORK2 the stand: on each gate a carriage, its two horses, the hay, the signpost and a driver in Carriage Drivers - as drawn here, the same at every gate in its own frame, each outside the gate\'s line and off its lane by its reach, at Daggerfall\'s own heights (mutants: a thing moved; the frame unturned)', () => {
  assert.equal(STAND_DRIVER_FACTION, CARRIAGE_DRIVERS_FACTION_ID);
  // the stand as designed, [along, out] metres
  assert.deepEqual(CARRIAGE_STAND.map((s) => [s.what, s.model ?? s.flat?.join('.') ?? null, ...s.at]), [
    ['carriage', 41214, 26, 10], ['horse', '201.0', 25.4, 12.8], ['horse', '201.1', 26.6, 12.8], ['hay', '212.1', 28.2, 12.8],
    ['driver', null, 23.9, 11.2], ['sign', '212.6', 23.6, 7.6],
  ]);
  assert.deepEqual(Object.fromEntries(Object.entries(STAND_DRIVERS).map(([g, d]) => [g, [...d.flat, d.seed]])), {
    WALLAA08: [182, 14, 864208], WALLAA09: [184, 17, 864209], WALLAA10: [182, 19, 864210], WALLAA11: [182, 22, 864211],
  });
  // WALLAA08's records, the frame unturned (its out is north)
  assert.deepEqual(standRecords('WALLAA08'), {
    Misc3dObjectRecords: [{ ModelId: '41214', ModelIdNum: 41214, ObjectType: 0, XPos: 2576, YPos: -31, ZPos: -3248, XRotation: 0, YRotation: 0, ZRotation: 0 }],
    MiscFlatObjectRecords: [
      { Position: 0, XPos: 2552, YPos: -4, ZPos: -3136, TextureArchive: 201, TextureRecord: 0, FactionID: 0, Flags: 0 },
      { Position: 0, XPos: 2600, YPos: -4, ZPos: -3136, TextureArchive: 201, TextureRecord: 1, FactionID: 0, Flags: 0 },
      { Position: 0, XPos: 2664, YPos: -4, ZPos: -3136, TextureArchive: 212, TextureRecord: 1, FactionID: 0, Flags: 0 },
      { Position: 864208, XPos: 2492, YPos: -4, ZPos: -3200, TextureArchive: 182, TextureRecord: 14, FactionID: 8642, Flags: 0 },
      { Position: 0, XPos: 2480, YPos: -4, ZPos: -3344, TextureArchive: 212, TextureRecord: 6, FactionID: 0, Flags: 0 },
    ],
  });
  // every gate: the same stand in its own frame, the carriage's shafts down its out (east -512, south -1024, west 512)
  assert.deepEqual(GATES.map((g) => standRecords(g).Misc3dObjectRecords[0].YRotation), [0, -512, -1024, 512]);
  for (const g of GATES) {
    const r = standRecords(g), all = [...r.Misc3dObjectRecords, ...r.MiscFlatObjectRecords];
    assert.equal(r.MiscFlatObjectRecords.filter((f) => f.FactionID === 8642).length, 1, `${g}: one driver`);
    for (const [i, rec] of all.entries()) {
      const [a, b] = local(g, rec), want = CARRIAGE_STAND[i].at, reach = i === 0 ? GATE_CLEAR.model : GATE_CLEAR.flat;
      assert.ok(Math.abs(a - want[0]) < 0.02 && Math.abs(b - want[1]) < 0.02, `${g}: ${i} where it is drawn (${a}, ${b})`);
      assert.ok(b > reach, `${g}: ${i} outside the gate's line`);
      assert.ok(Math.abs(a - GATE_OPENING.along) >= GATE_OPENING.half + reach, `${g}: ${i} off the gate's lane`);
    }
  }
  assert.equal(standRecords('WALLAA07'), null);
});

test('OWN-WORK2 the stand on a served gate file: as drawn on open ground; a house, a prop or a road tile where it stands moves it the least step clear, never across the gate\'s line or onto its lane, never out of the block (mutants: the house unread; a prop unread; the road unread; the lane unread)', () => {
  assert.deepEqual(standShift(gateFile('WALLAA08.RMB'), 'WALLAA08'), [0, 0], 'open ground: as drawn');
  // a house on the carriage's place (its town-map cells), a prop by the hay, a road tile under the horses
  const house = [];
  for (let gx = 39; gx <= 41; gx++) for (let gz = 12; gz <= 14; gz++) house.push([gx, gz]);
  const cases = [
    gateFile('WALLAA08.RMB', { houses: house }),
    gateFile('WALLAA08.RMB', { models: [{ ModelIdNum: 1, XPos: 2664, ZPos: -3136 }] }),
    gateFile('WALLAA08.RMB', { flats: [{ XPos: 2552, ZPos: -3136, TextureArchive: 210, TextureRecord: 1 }] }),
  ];
  const road = gateFile('WALLAA08.RMB');
  road.RmbBlock.FldHeader.GroundData.GroundTiles = Array.from({ length: 256 }, (_, i) => ({ TextureRecord: i === (15 - 3) * 16 + 10 ? 46 : 2 }));
  cases.push(road);
  // houses east of x 44.8 m to 38.4 m out: the nearer way, west, would stand it on the gate's lane - it goes out instead
  const east = [];
  for (let gx = 28; gx < 64; gx++) for (let gz = 0; gz < 31; gz++) east.push([gx, gz]);
  cases.push(gateFile('WALLAA08.RMB', { houses: east }));
  const shifts = cases.map((json) => standShift(json, 'WALLAA08'));
  assert.deepEqual(shifts, [[-5.6, 0], [-3.2, 0], [0, -1.6], [-4, 0], [0, 32]], 'the least step: along the wall toward the gate, a flat\'s step in, or out past the houses');
  for (const [i, json] of cases.entries()) {
    const s = shifts[i], clear = gateFileClear(json), r = standRecords('WALLAA08', s);
    for (const [k, rec] of [...r.Misc3dObjectRecords, ...r.MiscFlatObjectRecords].entries()) {
      const reach = k === 0 ? GATE_CLEAR.model : GATE_CLEAR.flat, [a, b] = local('WALLAA08', rec);
      assert.ok(clear(rec.XPos * 0.025, (rec.ZPos + 4096) * 0.025, reach - 0.02), `case ${i}: ${k} clear (a record rounds to 0.025 m)`);
      assert.ok(b > reach && Math.abs(a - GATE_OPENING.along) >= GATE_OPENING.half + reach, `case ${i}: ${k} outside, off the lane`);
    }
  }
  assert.equal(gateFileClear(gateFile('X'))(0.5, 50, GATE_CLEAR.flat), false, 'off the block\'s west edge');
});

test('IT1 the layer: the stand appended to whatever the door serves under a gate\'s name or a composite on it - never with the mod off, never to another name; the served document untouched (mutant: no composites)', () => {
  assert.equal(IT_GATE_FILE.exec('WALLAA08.RMB.json')?.[1], 'WALLAA08');
  assert.equal(IT_GATE_FILE.exec('WALLAA11.FARMBA03.RMB.json')?.[1], 'WALLAA11');
  assert.equal(IT_GATE_FILE.exec('WALLAA07.RMB.json'), null);
  assert.equal(IT_GATE_FILE.exec('WALLAA12.FARMAA00.RMB.json'), null, 'Beautiful Cities\' own corners are not gates');
  const served = gateFile('WALLAA08.RMB', { flats: [{ XPos: 1410, ZPos: -2977, TextureArchive: 199, TextureRecord: 10 }] });
  const laid = layGateRecords(served, standRecords('WALLAA08'));
  assert.notEqual(laid, served, 'a new document');
  assert.equal(served.RmbBlock.MiscFlatObjectRecords.length, 1, 'the served one untouched');
  assert.deepEqual(laid.RmbBlock.MiscFlatObjectRecords.slice(1), standRecords('WALLAA08').MiscFlatObjectRecords);
  assert.deepEqual(laid.RmbBlock.FldHeader, served.RmbBlock.FldHeader, 'the header as served - DFU lays a block out by its arrays');

  let on = true;
  resetToDefaults(); setValue('Enhancements', 'AssetInjection', 'True');
  _resetWorldDataReplacement(); installWorldDataReplacement();
  try {
    registerWorldDataAsset('WALLAA08.RMB.json', served, null, { priority: 20, vendor: 'beautiful-cities' });
    const farm = [];   // a farm house where the carriage is drawn
    for (let gx = 39; gx <= 41; gx++) for (let gz = 12; gz <= 14; gz++) farm.push([gx, gz]);
    registerWorldDataAsset('WALLAA08.FARMAA00.RMB.json', gateFile('WALLAA08.FARMAA00.RMB', { houses: farm }), null, { priority: 20, vendor: 'beautiful-cities' });
    registerWorldDataAsset('WALLAA07.RMB.json', gateFile('WALLAA07.RMB'), null, { priority: 20, vendor: 'beautiful-cities' });
    assert.equal(installImmersiveTravelGates(() => on), true);
    const driver = (b) => b.rmbBlock.miscFlatObjectRecords.filter((f) => f.factionID === 8642);
    assert.equal(driver(getDFBlockReplacementData(5, 'WALLAA08.RMB')).length, 1, 'Beautiful Cities\' gate carries the driver');
    assert.equal(driver(getDFBlockReplacementData(1780, 'WALLAA08.FARMAA00.RMB')).length, 1, 'and its composite on it');
    const car = getDFBlockReplacementData(1780, 'WALLAA08.FARMAA00.RMB').rmbBlock.misc3dObjectRecords.find((m) => m.modelIdNum === 41214);
    const moved = standRecords('WALLAA08', [-5.6, 0]).Misc3dObjectRecords[0];
    assert.deepEqual([car.xPos, car.zPos], [moved.XPos, moved.ZPos], 'clear of the composite\'s house');
    assert.equal(driver(getDFBlockReplacementData(4, 'WALLAA07.RMB')).length, 0, 'another wall is not a gate');
    assert.equal(getDFBlockReplacementData(6, 'WALLAA09.RMB'), null, 'a gate nothing serves: the classic block, read as it is');
    assert.equal(carriageRecordsOf('wallaa08.rmb').MiscFlatObjectRecords.length, 5);
    // the door's own law (IT1-28): a layer stands aside on a file it owns - the stand owns none, so it is held here
    const owned = gateFile('TESTAA00.RMB'), more = { MiscFlatObjectRecords: [{ XPos: 0, ZPos: -4096, TextureArchive: 1, TextureRecord: 0 }] };
    registerWorldDataAsset('TESTAA00.RMB.json', owned, null, { vendor: 'beautiful-cities' });
    registerWorldDataAsset('TESTAA01.RMB.json', gateFile('TESTAA01.RMB'), null, { vendor: 'beautiful-cities' });
    registerWorldDataLayer({ vendor: 'own-test', match: (n) => n.startsWith('TESTAA'), owns: (j) => j === owned, apply: (j) => layGateRecords(j, more) });
    assert.deepEqual([700, 701].map((i) => getDFBlockReplacementData(i, `TESTAA0${i - 700}.RMB`).rmbBlock.miscFlatObjectRecords.length), [0, 1], 'its own file stood aside, another laid');
    _resetWorldDataReplacement({ assets: false }); installWorldDataReplacement();
    on = false;
    assert.equal(driver(getDFBlockReplacementData(5, 'WALLAA08.RMB')).length, 0, 'the mod off: the gate as served');
    assert.equal(carriageRecordsOf('WALLAA08.RMB'), null);
  } finally { _resetWorldDataReplacement(); resetToDefaults(); }
});

test('IT1 by source: the loader lays the stand with the mod loaded for the game, guarded; no patch and no vendored directory of the mod\'s', () => {
  const src = readFileSync(join(ROOT, 'src/scenes/modWorldData.js'), 'utf8');
  assert.match(src, /try \{ installImmersiveTravelGates\(immersiveTravelLoaded\); \} catch \(e\)/);   // AUDIT IT1 G2, G3
  assert.equal(existsSync(join(ROOT, 'vendor/immersive-travel')), false, 'OWN-WORK2: retired');
  assert.equal(existsSync(join(ROOT, 'tools/immersiveTravelPatches.mjs')), false);
});

// With ARENA2 (`sh tools/fetch-data.sh`): each classic gate block stands the stand as drawn, and from the gate's mouth a
// walker reaches the driver over the block's own open ground while the way straight out stays open.
const ARENA2 = process.env.ARENA2_PATH ?? '';
const BC_PACK = join(ROOT, 'vendor/beautiful-cities/WorldDataPack/beautiful-cities.pack.json.gz');
test('OWN-WORK2 with ARENA2_PATH: the four classic gates stand it as drawn, the driver reached from the gate\'s mouth and the road out open; every one of Beautiful Cities\' 56 gate files stands it clear', { skip: !existsSync(join(ARENA2, 'BLOCKS.BSA')) && 'no ARENA2_PATH' }, async () => {
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { blockToDfuJson } = await import('../../../src/formats/worldData/worldDataJson.js');
  const blocks = new BlocksFile();
  assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  for (const g of GATES) {
    const json = blockToDfuJson(blocks.getBlock(blocks.getBlockIndex(`${g}.RMB`)));
    assert.deepEqual(standShift(json, g), [0, 0], `${g}: as drawn`);
    // the walk grid: the block's open town-map cells, less the stand's things by their reach (the driver the goal)
    const f = IT_GATE_FRAMES[g], am = json.RmbBlock.FldHeader.AutoMapData, open = new Uint8Array(4096), stood = new Uint8Array(4096);
    for (let gz = 0; gz < 64; gz++) for (let gx = 0; gx < 64; gx++) { const v = am[(63 - gz) * 64 + gx]; open[gz * 64 + gx] = !v || v === 0xfb ? 1 : 0; }
    const r = standRecords(g), things = [...r.Misc3dObjectRecords.map((m) => [m, GATE_CLEAR.model]), ...r.MiscFlatObjectRecords.map((t) => [t, GATE_CLEAR.flat])];
    const at = (rec) => [rec.XPos * 0.025, (rec.ZPos + 4096) * 0.025], cellOf = ([x, z]) => Math.floor(z / 1.6) * 64 + Math.floor(x / 1.6);
    const driver = r.MiscFlatObjectRecords.find((t) => t.FactionID === 8642);
    for (const [rec, reach] of things) {
      if (rec === driver) continue;
      const [x, z] = at(rec);
      for (let gz = 0; gz < 64; gz++) for (let gx = 0; gx < 64; gx++) if (Math.hypot((gx + 0.5) * 1.6 - x, (gz + 0.5) * 1.6 - z) < reach) stood[gz * 64 + gx] = 1;
    }
    // the way straight out of the opening, 30 m: no thing of the stand on it
    const ut = [f.out[1], -f.out[0]], point = (a, b) => [f.at[0] + a * ut[0] + b * f.out[0], f.at[1] + a * ut[1] + b * f.out[1]];
    for (let b = 0; b <= 30; b += 0.8) for (const a of [GATE_OPENING.along - 2.4, GATE_OPENING.along, GATE_OPENING.along + 2.4]) assert.equal(stood[cellOf(point(a, b))], 0, `${g}: the road out open at ${a}, ${b}`);
    // the driver reached from the gate's mouth (the town map's wall runs to 5.6 m out of the gate's line) over open ground
    const start = cellOf(point(GATE_OPENING.along, 6)), goal = cellOf(at(driver)), seen = new Uint8Array(4096), stack = [start];
    assert.equal(open[start], 1, `${g}: the gate's mouth open`);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % 64, z = (i - x) / 64;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz, j = nz * 64 + nx;
        if (nx < 0 || nz < 0 || nx > 63 || nz > 63 || seen[j] || !((open[j] && !stood[j]) || j === goal)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    assert.equal(seen[goal], 1, `${g}: the driver reached from the gate`);
  }
  if (!existsSync(BC_PACK)) return;
  const { openWorldDataPack, readPackText } = await import('../../../src/formats/worldData/worldDataPack.js');
  const pack = openWorldDataPack(JSON.parse(await readPackText(new Uint8Array(readFileSync(BC_PACK)))), { blocks });
  const names = [...pack.names()].filter((n) => IT_GATE_FILE.test(n));
  assert.equal(names.length, 56);
  let asDrawn = 0;
  for (const n of names) {
    const json = pack.rebuild(n), g = IT_GATE_FILE.exec(n)[1], s = standShift(json, g), clear = gateFileClear(json), r = standRecords(g, s);
    if (s[0] === 0 && s[1] === 0) asDrawn++;
    for (const [k, rec] of [...r.Misc3dObjectRecords, ...r.MiscFlatObjectRecords].entries()) assert.ok(clear(rec.XPos * 0.025, (rec.ZPos + 4096) * 0.025, (k === 0 ? GATE_CLEAR.model : GATE_CLEAR.flat) - 0.02), `${n}: ${k} clear`);
  }
  assert.equal(asDrawn, 48, 'Beautiful Cities\' gate files that stand it as drawn');
});
