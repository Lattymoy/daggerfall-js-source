// IT1 (2026-10-04): IMMERSIVE TRAVEL'S CARRIAGES AT THE GATES. OWN-WORK2 (2026-10-31, the owner: "Wave 2: data and
// words"): the stand is our own (world/immersiveTravelGates.js CARRIAGE_STAND, STAND_DRIVERS), set in each gate's frame;
// the author's edit of WALLAA08-11 left the tree, and no gate block is edited. OWN-WORK3 (2026-10-31): Beautiful Cities
// is retired, and with it the layer that laid the stand onto its gate files - every gate stands it as drawn (TS7's walls
// carry it, world/townWalls.js gateFurniture).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerWorldDataAsset, getDFBlockReplacementData, installWorldDataReplacement, _resetWorldDataReplacement } from '../../../src/formats/worldData/worldDataReplacement.js';
import {
  installImmersiveTravelGates, carriageRecordsOf, standRecords, IT_GATE_FILE, IT_GATE_FRAMES,
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

test('OWN-WORK3 no layer: a gate file another mod serves is served as it is - the stand is laid on no file; it reaches the gates through TS7\'s walls (carriageRecordsOf), while the mod is loaded (mutants: the layer kept; the switch unread)', () => {
  assert.equal(IT_GATE_FILE.exec('WALLAA08.RMB.json')?.[1], 'WALLAA08');
  assert.equal(IT_GATE_FILE.exec('WALLAA11.FARMBA03.RMB.json')?.[1], 'WALLAA11');
  assert.equal(IT_GATE_FILE.exec('WALLAA07.RMB.json'), null);
  const served = gateFile('WALLAA08.RMB', { flats: [{ XPos: 1410, ZPos: -2977, TextureArchive: 199, TextureRecord: 10 }] });
  let on = true;
  resetToDefaults(); setValue('Enhancements', 'AssetInjection', 'True');
  _resetWorldDataReplacement(); installWorldDataReplacement();
  try {
    registerWorldDataAsset('WALLAA08.RMB.json', served, null, { priority: 20, vendor: 'own-test-mod' });
    assert.equal(installImmersiveTravelGates(() => on), true);
    const driver = (b) => b.rmbBlock.miscFlatObjectRecords.filter((f) => f.factionID === 8642);
    assert.equal(driver(getDFBlockReplacementData(5, 'WALLAA08.RMB')).length, 0, 'the served gate as served');
    assert.equal(getDFBlockReplacementData(5, 'WALLAA08.RMB').rmbBlock.miscFlatObjectRecords.length, 1);
    assert.equal(carriageRecordsOf('wallaa08.rmb').MiscFlatObjectRecords.length, 5, 'TS7\'s carrier asks the stand');
    on = false;
    assert.equal(carriageRecordsOf('WALLAA08.RMB'), null, 'the mod off: no stand');
  } finally { _resetWorldDataReplacement(); resetToDefaults(); }
  const src = readFileSync(join(ROOT, 'src/world/immersiveTravelGates.js'), 'utf8');
  assert.doesNotMatch(src, /registerWorldDataLayer|standShift|layGateRecords/, 'no layer, no shift');
});

test('IT1 by source: the loader lays the stand with the mod loaded for the game, guarded; no patch and no vendored directory of the mod\'s', () => {
  const src = readFileSync(join(ROOT, 'src/scenes/modWorldData.js'), 'utf8');
  assert.match(src, /try \{\n\s*installImmersiveTravelGates\(immersiveTravelLoaded\);\n\s*\} catch \(e\)/);   // AUDIT IT1 G2, G3
  assert.equal(existsSync(join(ROOT, 'vendor/immersive-travel')), false, 'OWN-WORK2: retired');
  assert.equal(existsSync(join(ROOT, 'tools/immersiveTravelPatches.mjs')), false);
});

// With ARENA2 (`sh tools/fetch-data.sh`): each classic gate block stands the stand as drawn, and from the gate's mouth a
// walker reaches the driver over the block's own open ground while the way straight out stays open.
const ARENA2 = process.env.ARENA2_PATH ?? '';
test('OWN-WORK2 with ARENA2_PATH: the four classic gates stand it as drawn, the driver reached from the gate\'s mouth and the road out open', { skip: !existsSync(join(ARENA2, 'BLOCKS.BSA')) && 'no ARENA2_PATH' }, async () => {
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { blockToDfuJson } = await import('../../../src/formats/worldData/worldDataJson.js');
  const blocks = new BlocksFile();
  assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  for (const g of GATES) {
    const json = blockToDfuJson(blocks.getBlock(blocks.getBlockIndex(`${g}.RMB`)));
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
});
