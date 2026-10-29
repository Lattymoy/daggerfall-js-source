// CAPITAL-CARRIAGES (2026-10-29, the owner: "Ensure all capitals and cities outside the bay properly have the wagon
// transport at their gates"; bible/06-Systems/Immersive-Travel.md departure 14): Immersive Travel's carriage and driver at
// every road gate of the seven capitals past the Bay, carried by the block of the gate's cell, none while the mod is not
// loaded; Solitude's stand under its main gate; and with ARENA2 the gate frames Daggerfall's, and every city past the Bay
// a carriage and a driver at each of its gates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { installImmersiveTravelGates, carriageRecordsOf, hasCarriageGate, IT_GATE_FRAMES } from '../../src/world/immersiveTravelGates.js';
import { capitalCarriages, capitalGatePoints, capitalGateThings, carriageRecordsIn, SIDE_GATES, CARRIAGE_LEVEL } from '../../src/world/capitalCarriages.js';
import { CAPITALS, capitalDims, capitalPortBlocks, inCapitalRim, planCell, capitalGardenName, capitalApproachName } from '../../src/world/tamrielCapitals.js';
import { installCapitals, capitalFootprint, capitalCarriagesOf } from '../../src/world/capitalModels.js';
import { onCapitalApproach, APPROACH_HALF } from '../../src/world/capitalApproaches.js';
import { GATE_CLEAR } from '../../src/world/townWalls.js';
import { CAPITAL_RELIEFS } from '../../src/world/terrain/capitalRelief.js';
import * as R from '../../src/world/solitudeRelief.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const B = 102.4;
const patches = ['08', '09', '10', '11'].map((g) => JSON.parse(rd(`vendor/immersive-travel/WorldDataPatches/WALLAA${g}.RMB.json`)));
const modOn = (on = true) => installImmersiveTravelGates(patches, patches.map(() => null), () => on);
/** Each capital's stands as the blocks read them (world/capitalModels.js capitalCarriagesOf) - its own footprint kept. */
const footprints = new Map();
const standsOf = (cap) => capitalCarriagesOf(cap, () => (footprints.has(cap.key) ? footprints.get(cap.key) : footprints.set(cap.key, capitalFootprint(cap)).get(cap.key))).stands;
const OUT = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

test('CAPITAL-CARRIAGES every capital past the Bay a carriage and a driver at each of its road gates - outside as the mod stands them where its ground allows, else just inside facing in; each on a garden or open ground, off the rim, on its side of the gate, and clear of the capital\'s models, its approach and the gate\'s lane by its reach; Solitude\'s on its stand, level (mutants: the frames turned; the rim unread; the footprint unread; the lane unread; inside never tried; the level unread)', () => {
  modOn();
  installCapitals({ addTextures: () => 0 });
  const got = Object.fromEntries(CAPITALS.map((cap) => [cap.key, standsOf(cap).map((s) => `${s.side} ${s.gate} ${s.inside ? 'in' : 'out'}`)]));
  assert.deepEqual(got, {
    'imperial-city': ['W WALLAA11 out'],
    solitude: ['S WALLAA10 out'],
    mournhold: ['N WALLAA10 in', 'E WALLAA11 in', 'S WALLAA08 in', 'W WALLAA09 in'],
    alinor: ['N WALLAA10 in', 'E WALLAA11 in', 'W WALLAA09 in'],
    falinesti: ['N WALLAA10 in', 'E WALLAA11 in', 'S WALLAA08 in', 'W WALLAA09 in'],
    torval: ['N WALLAA10 in', 'E WALLAA11 in', 'W WALLAA09 in'],
    helstrom: ['N WALLAA08 out', 'S WALLAA10 out'],
  });
  for (const cap of CAPITALS) {
    const D = capitalDims(cap), way = onCapitalApproach(cap, D), relief = CAPITAL_RELIEFS[cap.relief] ?? null;
    assert.equal(standsOf(cap).length, cap.gates.length, `${cap.key}: a stand a road gate`);
    for (const s of standsOf(cap)) {
      const tag = `${cap.key} ${s.side}`, n = s.inside ? OUT[s.side].map((v) => -v) : OUT[s.side], along = [-n[1], n[0]];
      assert.equal(s.items.filter((it) => it.r.FactionID === 8642).length, 1, `${tag}: its driver`);
      assert.equal(s.items.filter((it) => it.r.ModelIdNum === 41214).length, 1, `${tag}: its carriage`);
      assert.equal(s.items.length, carriageRecordsOf(s.gate).Misc3dObjectRecords.length + carriageRecordsOf(s.gate).MiscFlatObjectRecords.length, `${tag}: every record of its gate`);
      const fp = cap.family ? null : footprints.get(cap.key);
      for (const it of s.items) {
        const reach = it.model ? GATE_CLEAR.model : GATE_CLEAR.flat, dx = it.x - s.at[0], dz = it.z - s.at[1];
        const cell = planCell(cap, Math.floor(it.z / B + cap.anchor[1]), Math.floor(it.x / B + cap.anchor[0]));
        assert.ok(cell === 'G' || cell === 'O', `${tag}: on a garden or open ground (${cell})`);
        assert.ok(!inCapitalRim(cap, it.x + cap.anchor[0] * B, it.z + cap.anchor[1] * B), `${tag}: off the rim`);
        assert.ok(dx * n[0] + dz * n[1] > reach, `${tag}: on its side of the gate`);
        assert.ok(Math.abs(dx * along[0] + dz * along[1]) >= APPROACH_HALF + reach, `${tag}: off the gate's lane`);
        // every 1.6 m cell within its reach, asked at its centre (the footprint's own cells)
        for (let i = Math.floor((it.x - reach) / 1.6); i <= Math.floor((it.x + reach) / 1.6); i++) {
          for (let j = Math.floor((it.z - reach) / 1.6); j <= Math.floor((it.z + reach) / 1.6); j++) {
            if (Math.hypot(Math.max(i * 1.6, Math.min(it.x, (i + 1) * 1.6)) - it.x, Math.max(j * 1.6, Math.min(it.z, (j + 1) * 1.6)) - it.z) >= reach) continue;
            assert.ok(!way((i + 0.5) * 1.6, (j + 0.5) * 1.6), `${tag}: off the approach`);
            if (fp) assert.ok(!fp((i + 0.5) * 1.6, (j + 0.5) * 1.6), `${tag}: clear of the capital's models`);
          }
        }
        if (relief && it.model) for (const [a, b] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach]]) assert.ok(Math.abs(relief.height(it.x + a, it.z + b) - relief.flat - it.h) <= CARRIAGE_LEVEL + 1e-9, `${tag}: level`);
        assert.equal(it.h, relief ? relief.height(it.x, it.z) - relief.flat : 0, `${tag}: at its ground's height`);
      }
    }
  }
  // the turn: a model carried from its gate's frame to the capital's turned as gateFurniture turns it - Mournhold's north
  // gate inside faces south, Daggerfall's WALLAA10's way (none); Helstrom's north gate outside, WALLAA08's (none)
  const mh = standsOf(CAPITALS.find((c) => c.key === 'mournhold'))[0];
  assert.deepEqual(mh.items.filter((it) => it.model).map((it) => it.r.YRotation), carriageRecordsOf('WALLAA10').Misc3dObjectRecords.map((r) => r.YRotation));
  const sol = standsOf(CAPITALS.find((c) => c.key === 'solitude'))[0], S = R.SOLITUDE_CARRIAGE_STAND;
  for (const it of sol.items) assert.ok(it.x >= S.x0 - S.bank && it.x <= S.x1 + S.bank && it.z >= S.z0 && it.z <= S.z1 + S.bank, `Solitude's on its stand: ${it.x}, ${it.z}`);
  // a gate on a side of its own facing: a frame turned a quarter turns its models a quarter
  const turned = capitalCarriages({ ...CAPITALS.find((c) => c.key === 'helstrom'), gates: ['N'] }, { footprintOf: () => footprints.get('helstrom'), records: (g) => (g === 'WALLAA09' ? carriageRecordsOf(g) : null) })[0];
  assert.deepEqual([turned.gate, turned.inside], ['WALLAA09', false]);
  assert.deepEqual(turned.items.filter((it) => it.model).map((it) => it.r.YRotation), carriageRecordsOf('WALLAA09').Misc3dObjectRecords.map((r) => r.YRotation + 512));
  assert.deepEqual(Object.keys(SIDE_GATES), ['N', 'E', 'S', 'W']);
});

test('CAPITAL-CARRIAGES the blocks carry them: each gate\'s records on the block of its cell (a garden\'s, the Imperial City\'s approach\'s), each where its law stands it; no tree and no walker under them; none and no block changed while the mod is not loaded; a capital a carriage town (mutants: the records unlaid; the cell another\'s; the trees planted; the walkers through)', () => {
  modOn();
  installCapitals({ addTextures: () => 0 });
  const blocks = capitalPortBlocks({ footprint: (cap) => (footprints.has(cap.key) ? footprints.get(cap.key) : footprints.set(cap.key, capitalFootprint(cap)).get(cap.key)), gateThings: capitalCarriagesOf });
  const byName = new Map(blocks.map((b) => [b.name, b]));
  let drivers = 0;
  for (const b of blocks) drivers += b.json.RmbBlock.MiscFlatObjectRecords.filter((f) => f.FactionID === 8642).length;
  assert.equal(drivers, CAPITALS.reduce((n, c) => n + c.gates.length, 0), 'a driver a road gate, 18');
  for (const cap of CAPITALS) {
    for (const s of standsOf(cap)) {
      const cx = Math.floor(s.at[0] / B + cap.anchor[0]), r = Math.floor(s.at[1] / B + cap.anchor[1]);
      const name = planCell(cap, r, cx) === 'G' && !cap.family ? capitalGardenName(cap, cx, r) : capitalApproachName(cap, cx, r);
      const rmb = byName.get(name)?.json?.RmbBlock, at = [(cap.anchor[0] - cx) * B, (r + 1 - cap.anchor[1]) * B];
      assert.ok(rmb, `${cap.key} ${s.side}: ${name}`);
      assert.deepEqual([...rmb.Misc3dObjectRecords, ...rmb.MiscFlatObjectRecords].filter((x) => x.FactionID === 8642 || x.ModelIdNum === 41214).length, 2, `${cap.key} ${s.side}: its carriage and driver on ${name}`);
      const { models, flats } = carriageRecordsIn([s], at);
      for (const rec of [...models, ...flats]) assert.ok([...rmb.Misc3dObjectRecords, ...rmb.MiscFlatObjectRecords].some((x) => JSON.stringify(x) === JSON.stringify(rec)), `${cap.key} ${s.side}: laid`);
      for (const [rec, it] of [...models, ...flats].map((x, i) => [x, [...s.items.filter((q) => q.model), ...s.items.filter((q) => !q.model)][i]])) {
        assert.ok(Math.abs(rec.XPos * 0.025 - at[0] - it.x) < 0.02 && Math.abs(at[1] - (rec.ZPos + 4096) * 0.025 - it.z) < 0.02, `${cap.key} ${s.side}: at its place`);
        assert.equal(rec.YPos, it.r.YPos - Math.round(it.h / 0.025));
      }
      if (cap.family) continue;
      // the garden under each thing: no tree on its tile, its automap cell shut
      for (const it of s.items) {
        const c2 = Math.floor(it.x / B + cap.anchor[0]), r2 = Math.floor(it.z / B + cap.anchor[1]), g = byName.get(capitalGardenName(cap, c2, r2))?.json?.RmbBlock;
        if (!g) continue;
        const bx = it.x - (c2 - cap.anchor[0]) * B, bz = (r2 + 1 - cap.anchor[1]) * B - it.z;
        assert.equal(g.FldHeader.GroundData.GroundScenery[(15 - Math.floor(bz / 6.4)) * 16 + Math.floor(bx / 6.4)].TextureRecord, -1, `${cap.key} ${s.side}: no tree`);
        assert.equal(g.FldHeader.AutoMapData[(63 - Math.floor(bz / 1.6)) * 64 + Math.floor(bx / 1.6)], 0xfe, `${cap.key} ${s.side}: its walkers round it`);
      }
    }
  }
  // the mod not loaded: no record, and every block as it stood without them
  modOn(false);
  assert.equal(carriageRecordsOf('WALLAA08'), null);
  const off = capitalPortBlocks({ footprint: (cap) => footprints.get(cap.key) ?? null, gateThings: capitalCarriagesOf }), bare = capitalPortBlocks({ footprint: (cap) => footprints.get(cap.key) ?? null });
  for (const name of ['TESGMH04.RMB', 'TESGSO75.RMB', 'TESGHE74.RMB', capitalApproachName(CAPITALS[0], 1, 100)]) {
    assert.deepEqual(off.find((b) => b.name === name)?.json, bare.find((b) => b.name === name)?.json, name);
  }
  assert.equal(capitalGateThings(CAPITALS[2]).stands.length, 0, 'no stand');
  // a capital is a carriage town (OW-HUBS' wheel, scenes/mapPlacesHost.js carriageTown); a town with no wall is none
  assert.equal(hasCarriageGate({ capital: { k: 2, s: 0 }, exterior: { exteriorData: { blockNames: ['TESGMH00.RMB'] } } }), true);
  assert.equal(hasCarriageGate({ exterior: { exteriorData: { blockNames: ['RESIAM00.RMB'] } } }), false);
  assert.match(rd('src/world/capitalModels.js'), /capitalPortBlocks\(\{ footprint: \(cap\) => capitalFootprint\(cap\), gateThings: capitalCarriagesOf \}\)/);
});

test('CAPITAL-CARRIAGES Solitude\'s stand: the Well District\'s ledge carried out level under the south wall west of the Gate Road\'s last run, banked to the slope, the road and its shoulder clear of it; Falinesti\'s gates where its roads reach its ground (mutants: the stand unlaid; the bank unread)', () => {
  const S = R.SOLITUDE_CARRIAGE_STAND, L = R.SOLITUDE_LEVELS, G = R.SOLITUDE_GATE_ROAD;
  for (let x = S.x0; x <= S.x1; x += 4) for (let z = S.z0 + 0.5; z <= S.z1; z += 2) assert.equal(R.solitudeHeight(x, z), L.city, `level at ${x},${z}`);
  // past its bank the slope's own, as the road's law has it; inside the bank between the two
  const old = (x, z) => { const r = R.gateRoadAt(x, z), s = R.southSlope(x, z); return r.d <= G.half ? r.h : r.d < G.half + G.shoulder ? r.h + (s - r.h) * (((t) => t * t * (3 - 2 * t))(Math.min(1, (r.d - G.half) / G.shoulder))) : s; };
  for (const [x, z] of [[S.x0 - S.bank - 1, 430], [280, S.z1 + S.bank + 1], [250, 460], [400, 430]]) assert.ok(Math.abs(R.southHeight(x, z) - old(x, z)) < 1e-9, `the slope at ${x},${z}`);
  const mid = R.southHeight(280, S.z1 + S.bank / 2);
  assert.ok(mid < L.city && mid > old(280, S.z1 + S.bank / 2), `banked: ${mid}`);
  for (const [x, z] of [[S.x1, S.z0], [S.x1, S.z1], [S.x0, S.z1]]) assert.ok(R.gateRoadAt(x, z).d >= G.half + G.shoulder, `clear of the road's shoulder at ${x},${z}`);
  for (const [x, z, h] of R.gateRoadPoints) if (z > R.SOLITUDE_CLIFFS.south) assert.ok(Math.abs(R.southHeight(x, z) - h) < 1e-9, 'the road its own height');
  // Falinesti, walled by its forest alone: its gates where each road reaches its own ground (its arrival in past the rim)
  const fa = CAPITALS.find((c) => c.key === 'falinesti');
  assert.deepEqual(capitalGatePoints(fa).map((g) => [g.side, ...g.at.map((v) => Math.round(v * 10) / 10 + 0)]), [['N', 0, -339.2], ['E', 339.2, 0], ['S', 0, 339.2], ['W', -339.2, 0]]);
});

test('CAPITAL-CARRIAGES with ARENA2: the gate frames are Daggerfall\'s (each gate block\'s gate model, its origin and its outward normal), and every city past the Bay - each of Daggerfall\'s 407 city templates cloned past it - walled, a carriage town, a carriage and a driver at each of its gates (mutants: a frame moved; the cities\' carriages unlaid)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { arenaTemplates } = await import('../../src/world/arenaLocations.js');
  const { outlineTownLocation, installTownOutline, TOWN_OUTLINE_BLOCK } = await import('../../src/world/townOutline.js');
  const { townWall, gateFurniture, townBlockedCells, WALL_MODELS } = await import('../../src/world/townWalls.js');
  const { isWallCarrier } = await import('../../src/world/townShape.js');
  const W = await import('../../src/formats/worldData/worldDataReplacement.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  for (const [name, f] of Object.entries(IT_GATE_FRAMES)) {
    const subs = blocks.getBlockByName(`${name}.RMB`).rmbBlock.subRecords.filter((s) => (s.exterior?.block3dObjectRecords ?? []).some((o) => o.modelIdNum === 446));
    assert.equal(subs.length, 1, name);
    const s = subs[0], o = s.exterior.block3dObjectRecords.find((q) => q.modelIdNum === 446), a = ((s.yRotation ?? 0) * Math.PI) / 1024;
    const at = [s.xPos * 0.025 + o.xPos * 0.025 * Math.cos(a) - o.zPos * 0.025 * Math.sin(a), (4096 - s.zPos) * 0.025 + o.xPos * 0.025 * Math.sin(a) + o.zPos * 0.025 * Math.cos(a)];
    assert.deepEqual(at.map((v) => Math.round(v * 1000) / 1000 + 0), [...f.at], `${name}: its gate's origin`);
    assert.deepEqual([-Math.sin(a), Math.cos(a)].map((v) => Math.round(v * 1e9) / 1e9 + 0), [...f.out], `${name}: facing out`);
  }
  W.installWorldDataReplacement(); W.bindWorldDataBlocks(blocks);
  installTownOutline();
  modOn();
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const lc = maps.getLocation(r, l); if (lc) rows.push(lc); } }
  const cities = arenaTemplates(rows)['city-state'];
  assert.equal(cities.length, 407);
  const classicOf = (n) => { const i = blocks.getBlockIndex(blocks.checkName(n)); return i < 0 ? null : blocks.readClassicBlock(i); };
  const rmbOf = (n) => (isWallCarrier(n) || n === TOWN_OUTLINE_BLOCK ? null : blocks.getBlockByName(n)?.rmbBlock ?? null);
  cities.forEach((t, j) => {
    const loc = outlineTownLocation({ ...t, mapTableData: { ...t.mapTableData, mapId: ((0xa7 << 20) | (710000 + j)) >>> 0 } }, { classicOf, servedOf: (n) => blocks.getBlockByName(n) });
    assert.ok(loc.outline?.walled, `${t.name}: walled past the Bay`);
    assert.ok(hasCarriageGate(loc), `${t.name}: a carriage town`);
    const wall = townWall(loc, t.exterior.exteriorData.blockNames, rmbOf, null), gates = wall.pieces.filter((p) => p.model === WALL_MODELS.gate).length;
    const f = gateFurniture(wall, classicOf, carriageRecordsOf, townBlockedCells(loc, wall, rmbOf));
    assert.ok(gates >= 1, `${t.name}: a gate`);
    assert.equal(f.flats.filter((x) => x.FactionID === 8642).length, gates, `${t.name}: a driver a gate`);
    assert.equal(f.models.filter((m) => m.ModelIdNum === 41214).length, gates, `${t.name}: a carriage a gate`);
  });
});
