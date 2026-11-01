// CAPITAL-CARRIAGES (2026-10-29, the owner: "Ensure all capitals and cities outside the bay properly have the wagon
// transport at their gates"; departure 14): Immersive Travel's carriage and driver at
// every road gate of the seven capitals past the Bay, carried by the block of the gate's cell, none while the mod is not
// loaded; Solitude's stand under its main gate; and with ARENA2 the gate frames Daggerfall's, and every city past the Bay
// a carriage and a driver at each of its gates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { installImmersiveTravelGates, carriageRecordsOf, hasCarriageGate, IT_GATE_FRAMES } from '../../src/world/immersiveTravelGates.js';
import { capitalCarriages, capitalGatePoints, capitalGateThings, carriageRecordsIn, isCarriageTown, capitalCarriageSlices, SIDE_GATES, CARRIAGE_LEVEL, CARRIAGE_MOST } from '../../src/world/capitalCarriages.js';
import { townWallBlockName, GATE_ROAD_CLEAR, townGateOutside } from '../../src/world/townWalls.js';
import { DIR } from '../../src/world/road/roadNetwork.js';
import { rumareFlatAt, RUMARE_LANDING } from '../../src/world/rumareWaters.js';
import { reliefDrawnAt } from '../../src/world/terrain/capitalRelief.js';
import { CAPITALS, capitalDims, capitalPortBlocks, inCapitalRim, planCell, capitalGardenName, capitalApproachName, synthesizeCapitalLocation, capitalCentre } from '../../src/world/tamrielCapitals.js';
import { installCapitals, capitalFootprint, capitalCarriagesOf, carriageFootprintOf, imperialSliceFootprint } from '../../src/world/capitalModels.js';
import { onCapitalApproach, APPROACH_HALF } from '../../src/world/capitalApproaches.js';
import { GATE_CLEAR } from '../../src/world/townWalls.js';
import { CAPITAL_RELIEFS } from '../../src/world/terrain/capitalRelief.js';
import * as R from '../../src/world/solitudeRelief.js';
import { bayRoads } from '../bayRoads.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const B = 102.4;
const modOn = (on = true) => installImmersiveTravelGates(() => on);   // Our stand on every gate
/** Each capital's stands as the blocks read them (world/capitalModels.js capitalCarriagesOf) - its own footprint kept. */
const footprints = new Map();
const standsOf = (cap) => capitalCarriagesOf(cap, () => (footprints.has(cap.key) ? footprints.get(cap.key) : footprints.set(cap.key, capitalFootprint(cap)).get(cap.key))).stands;
const OUT = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

test('CAPITAL-CARRIAGES every capital past the Bay a carriage and a driver at each of its road gates - outside as the mod stands them where its ground allows, else just inside facing in; each on a garden or open ground, off the rim and on the capital\'s own level ground under its whole reach, on its side of the gate, and clear of the capital\'s models, its approach and the gate\'s lane by its reach; Solitude\'s on its stand, level on its ground as drawn (mutants: the frames turned; the rim unread; the rim by the centre alone; the far shore read flat; the footprint unread; the lane unread; inside never tried; the level unread; the relief\'s own law for the drawn ground)', () => {
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
        // Off the rim, and on the capital's own level ground, under its whole reach
        for (let a = 0; a < 8; a++) {
          const x = it.x + Math.cos((a * Math.PI) / 4) * reach, z = it.z + Math.sin((a * Math.PI) / 4) * reach;
          assert.ok(!inCapitalRim(cap, x + cap.anchor[0] * B, z + cap.anchor[1] * B), `${tag}: off the rim`);
          if (cap.flatAt) assert.ok(cap.flatAt(x, z), `${tag}: on its own level ground`);
        }
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
        // The ground as the terrain draws it (its vertices' heights), level under a model
        const drawn = (x, z) => reliefDrawnAt(relief, x, z) - relief.flat;
        if (relief && it.model) for (let a = 0; a < 8; a++) assert.ok(Math.abs(drawn(it.x + Math.cos((a * Math.PI) / 4) * reach, it.z + Math.sin((a * Math.PI) / 4) * reach) - it.h) <= CARRIAGE_LEVEL + 1e-9, `${tag}: level`);
        assert.equal(it.h, relief ? drawn(it.x, it.z) : 0, `${tag}: at its ground's height`);
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
  assert.equal(CARRIAGE_MOST, 2 * GATE_CLEAR.most);
  // The Imperial City's things kept off its apron's east (a model there) stand nowhere, never on
  // the far shore's rise past it
  const kept = capitalCarriages(CAPITALS[0], { footprintOf: () => (x, z) => x > -10058 && Math.abs(z) < 40 });
  for (const s of kept) for (const it of s.items) assert.ok(rumareFlatAt(it.x, it.z), `never on the far shore's rise: ${it.x}, ${it.z}`);
});

test('CAPITAL-CARRIAGES the blocks carry them: each gate\'s records on the block of its cell (a garden\'s, the Imperial City\'s approach\'s), each where its law stands it; no tree and no walker under them; none while the mod is not loaded, each block as it stands without them (Solitude\'s stand is its ground\'s, mod or no mod); a capital\'s slice with a road gate a carriage town, no other (mutants: the records unlaid; the cell another\'s; the trees planted; the walkers through; every slice a carriage town; the map\'s wheel by the blocks\' word alone)', () => {
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
  // A capital's slice with a road gate in it is a carriage town (OW-HUBS' wheel), no other -
  // the Imperial City's west slice of its 625, a harbour's sea slice none; a walled town by its blocks
  assert.deepEqual(CAPITALS.map((c) => [...capitalCarriageSlices(c)]), [[300], [0], [0], [0], [0], [0], [0]]);
  assert.equal(isCarriageTown({ capital: { k: 0, s: 300 } }), true, 'the Imperial City\'s landing slice');
  assert.equal(isCarriageTown({ capital: { k: 0, s: 312 } }), false, 'its centre: no gate of its own');
  assert.equal(isCarriageTown({ capital: { k: 3, s: 0 } }), true, 'Alinor\'s land');
  assert.equal(isCarriageTown({ capital: { k: 3, s: 1 } }), false, 'Alinor\'s harbour\'s sea');
  assert.equal(isCarriageTown({ capital: { k: 2 } }), true, 'a slice unnamed is its centre');
  assert.equal(isCarriageTown({ exterior: { exteriorData: { blockNames: [townWallBlockName(5), 'H.RMB'] } } }), true, 'a walled town');
  assert.equal(isCarriageTown({ exterior: { exteriorData: { blockNames: ['RESIAM00.RMB'] } } }), false);
  assert.equal(hasCarriageGate({ capital: { k: 2, s: 0 }, exterior: { exteriorData: { blockNames: ['TESGMH00.RMB'] } } }), false, 'the blocks\' word: no gate of the mod\'s');
  assert.match(rd('src/scenes/mapPlacesHost.js'), /on = isCarriageTown\(townOfKey\(id\)\)/);
  assert.match(rd('src/world/capitalModels.js'), /capitalPortBlocks\(\{ footprint: \(cap\) => capitalFootprint\(cap\), gateThings: capitalCarriagesOf \}\)/);
});

test('CAPITAL-CARRIAGES Solitude\'s stand and the Imperial City\'s landing: Solitude\'s Well District\'s ledge carried out level under the south wall west of the Gate Road\'s last run, its edges on the terrain\'s vertex lines, banked to the slope, the road and its shoulder unchanged; Talos Bridge\'s landing apron its own level ground; Falinesti\'s gates where its roads reach its ground (mutants: the stand unlaid; the bank unread; the stand off the vertex lines; the apron unread)', () => {
  const S = R.SOLITUDE_CARRIAGE_STAND, L = R.SOLITUDE_LEVELS, G = R.SOLITUDE_GATE_ROAD, sol = CAPITAL_RELIEFS.solitude;
  for (let x = S.x0; x <= S.x1; x += 4) for (let z = S.z0 + 0.5; z <= S.z1; z += 2) assert.equal(R.solitudeHeight(x, z), L.city, `level at ${x},${z}`);
  // Its edges and its bank's on the vertex lines (6.4 m from the pixel's corner), so the ground as
  // drawn is level to its edge
  for (const v of [S.x0, S.x1, S.x1 + S.bank]) assert.ok(Math.abs(((v - R.SOLITUDE_PIXEL.x0) / 6.4) - Math.round((v - R.SOLITUDE_PIXEL.x0) / 6.4)) < 1e-9, `x ${v} on a vertex line`);
  for (const v of [S.z1, S.z1 + S.bank]) assert.ok(Math.abs(((v - R.SOLITUDE_PIXEL.z0) / 6.4) - Math.round((v - R.SOLITUDE_PIXEL.z0) / 6.4)) < 1e-9, `z ${v} on a vertex line`);
  for (let x = S.x0; x <= S.x1; x += 1.6) for (let z = 416; z <= S.z1; z += 1.6) assert.ok(Math.abs(reliefDrawnAt(sol, x, z) - L.city) < 1e-9, `drawn level at ${x},${z}`);
  // past its bank the slope's own, as the road's law has it; inside the bank between the two
  const old = (x, z) => { const r = R.gateRoadAt(x, z), s = R.southSlope(x, z); return r.d <= G.half ? r.h : r.d < G.half + G.shoulder ? r.h + (s - r.h) * (((t) => t * t * (3 - 2 * t))(Math.min(1, (r.d - G.half) / G.shoulder))) : s; };
  for (const [x, z] of [[S.x0 - S.bank - 1, 430], [280, S.z1 + S.bank + 1], [250, 460], [400, 430]]) assert.ok(Math.abs(R.southHeight(x, z) - old(x, z)) < 1e-9, `the slope at ${x},${z}`);
  const mid = R.southHeight(280, S.z1 + S.bank / 2);
  assert.ok(mid < L.city && mid > old(280, S.z1 + S.bank / 2), `banked: ${mid}`);
  // The road's shoulder unchanged - every half metre of it
  let shoulder = 0;
  for (let x = 250; x <= 340; x += 0.5) for (let z = R.SOLITUDE_CLIFFS.south + 0.5; z <= 470; z += 0.5) {
    const d = R.gateRoadAt(x, z).d;
    if (d <= G.half || d >= G.half + G.shoulder) continue;
    shoulder++;
    assert.ok(Math.abs(R.southHeight(x, z) - old(x, z)) < 1e-9, `the shoulder at ${x},${z}`);
  }
  assert.ok(shoulder > 1000, `${shoulder} points of the shoulder`);
  // Talos Bridge's landing apron (the city's metres), its edges on the vertex lines from the span's
  // corner, the city's level ground where the far shore rises past it
  const A = RUMARE_LANDING;
  for (const v of [A.x0, A.x1, A.x0 - A.bank]) assert.ok(Math.abs((v + 10240) / 6.4 - Math.round((v + 10240) / 6.4)) < 1e-9, `x ${v} on a vertex line`);
  for (const v of [A.z0, A.z1, A.z1 + A.bank]) assert.ok(Math.abs((v + 409.6) / 6.4 - Math.round((v + 409.6) / 6.4)) < 1e-9, `z ${v} on a vertex line`);
  assert.equal(rumareFlatAt(-10048, -8.8), true, 'the landing\'s apron');
  assert.equal(rumareFlatAt(A.x0 - 0.1, 0), false, 'the far shore past it');
  assert.equal(rumareFlatAt(-10048, A.z1 + 0.1), false);
  assert.equal(rumareFlatAt(-9000, 0), true, 'inside the lake\'s far shore');
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

test('AUDIT CAPITAL-CARRIAGES with ARENA2: every capital\'s gate things on the ground the terrain kernel draws - the Imperial City\'s at Talos Bridge\'s landing on its apron, the deck\'s end on it, Solitude\'s on its stand - each at its height, a model level under its reach (mutants: the far shore read flat; the apron unread; the relief\'s own law for the drawn ground)', { skip: skipReal, timeout: 600_000 }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (f) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), f)));
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundMaps, groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const wd = await import('../../src/formats/worldData/worldDataReplacement.js');
  const tc = await import('../../src/world/tamrielCapitals.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { groundOffPlane } = await import('../../src/world/terrain/terrainSurface.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  groundMaps(maps);
  wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
  modOn();
  installCapitals({ addTextures: () => 0 });
  const ground = groundWoods(woods), base = tc.capitalBase(rows, isMainStoryDungeon), names = tc.cityBlockNames(rows), kept = new Map();
  const terrainOf = (px, py) => {
    const key = `${px},${py}`;
    if (kept.has(key)) return kept.get(key);
    const a = tc.capitalOnPixel(px, py), tm = new Uint8Array(16384);
    const loc = tc.synthesizeCapitalLocation(a, { base, names, blockOf: (nm) => blocks.getBlockByName(nm), px, py }), rect = setLocationTiles(loc, maps, blocks, tm);
    const t = generatePixelTerrain({ woods: ground, px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, flattenAt: loc.capital.flattenAt, bed: true });
    kept.set(key, t);
    return t;
  };
  const P = 819.2;
  for (const [k, cap] of CAPITALS.entries()) {
    const span = tc.capitalSpanPixels(k), x0 = Math.min(...span.map((p) => p.x)), y0 = Math.min(...span.map((p) => p.y));
    const drawnAt = (x, z) => {
      const X = x + cap.anchor[0] * B, Z = z + cap.anchor[1] * B, sx = Math.floor(X / P), sy = Math.floor(Z / P), t = terrainOf(x0 + sx, y0 + sy);
      return groundOffPlane(t.samples, t.avg, X - sx * P, P - (Z - sy * P));
    };
    for (const s of standsOf(cap)) {
      for (const it of s.items) {
        const tag = `${cap.key} ${s.side} ${it.model ? it.r.ModelIdNum : `${it.r.TextureArchive}.${it.r.TextureRecord}`}`, reach = it.model ? GATE_CLEAR.model : GATE_CLEAR.flat;
        assert.ok(Math.abs(drawnAt(it.x, it.z) - it.h) < 0.05, `${tag}: at the drawn ground (${drawnAt(it.x, it.z).toFixed(2)} for ${it.h.toFixed(2)})`);
        if (it.model) for (let a = 0; a < 16; a++) assert.ok(Math.abs(drawnAt(it.x + Math.cos((a * Math.PI) / 8) * reach, it.z + Math.sin((a * Math.PI) / 8) * reach) - it.h) <= CARRIAGE_LEVEL, `${tag}: level under its reach`);
      }
    }
    // the deck comes down to 0.3 m over the city's land at the landing (capitalImperial.js buildTalosBridge): on its apron
    if (cap.key === 'imperial-city') for (const z of [-12, 0, 12]) assert.ok(Math.abs(drawnAt(cap.gateAt.W[0] + 2, z)) < 0.05, `the deck's end on the ground at ${z}`);
  }
});

test('AUDIT CAPITAL-CARRIAGES with ARENA2: a walled city\'s gates on their roads - on the Bay (every sixth of its walled cities, walled on their outline with the packs off, on Basic Roads\' roads) and past it (every sixth city template, a road every way) every gate a carriage and a driver, none on a gate\'s laid road, the Bay\'s none on a painted road; the carriage\'s models a gate\'s road goes round (mutants: a gate past the frames bare; the roads unread; the ground unread; the passage unread; the group never moved along; the carrier unread by the gates\' roads)', { skip: skipReal, timeout: 1_200_000 }, async () => {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const W = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { arenaTemplates } = await import('../../src/world/arenaLocations.js');
  const { installTownOutline, outlineTownLocation, townOutlineBlockJson } = await import('../../src/world/townOutline.js');
  const TW = await import('../../src/world/townWalls.js');
  const { townGateRoads } = await import('../../src/world/townGates.js');
  const { setLocationTiles, getLocationTerrainTileOrigin } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { ROADS_EVERY_WAY } = await import('../../tools/townBoardsSweep.mjs');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  W.installWorldDataReplacement(); W.bindWorldDataBlocks(blocks); installTownOutline();
  modOn();
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  const { roads: roadsB, tracks: tracksB } = bayRoads();   // The Bay's own network
  const classicOf = (n) => { const i = blocks.getBlockIndex(blocks.checkName(n)); return i < 0 ? null : blocks.readClassicBlock(i); };
  const io = { classicOf, servedOf: (n) => blocks.getBlockByName(n) };
  const pixelOf = (loc) => ({ px: Math.trunc(loc.mapTableData.longitude / 128), py: 499 - Math.trunc(loc.mapTableData.latitude / 128) });
  /** a city's gates against the tiles the kernel paints, its carrier as the door serves it - the furniture the game stands */
  const tally = (cities, roads, tracks) => {
    const n = { cities: 0, gates: 0, drivers: 0, carriages: 0, onRoad: 0, onGate: 0 };
    for (const loc of cities) {
      const wall = TW.townWallOf(loc);
      if (!wall) continue;
      const { px, py } = pixelOf(loc), tm = new Uint8Array(16384), rect = setLocationTiles(loc, maps, blocks, tm), tm0 = Uint8Array.from(tm);
      rect.gateRoads = townGateRoads(loc, maps, blocks);
      const lay = (tilemap, r) => generatePixelTerrain({ woods, px, py, tilemap, locationRect: r, hasLocation: true, climateType: 0, roads: { roads: roads(px, py), tracks, smooth: true } });
      const T = lay(tm, rect), T0 = lay(tm0, { ...rect, gateRoads: null });
      const rmb = blocks.getBlock(blocks.getBlockIndex(TW.townWallBlockName(loc.mapTableData.mapId)))?.rmbBlock;
      const o = getLocationTerrainTileOrigin(loc), tileOf = (r) => (o.x + Math.floor((r.xPos * 0.025) / 6.4)) + (o.y + Math.floor(((r.zPos + 4096) * 0.025) / 6.4)) * 128;
      n.cities++; n.gates += wall.pieces.filter((q) => q.model === TW.WALL_MODELS.gate).length;
      n.drivers += rmb.miscFlatObjectRecords.filter((q) => q.factionID === 8642).length;
      for (const m of rmb.misc3dObjectRecords.filter((q) => q.modelIdNum === 41214)) { n.carriages++; const i = tileOf(m); if (T.paths?.[i]) n.onRoad++; if (T.paths?.[i] && !T0.paths?.[i]) n.onGate++; }
    }
    return n;
  };
  // the Bay: its walled cities walled on their outline as the door reads them (installTownOutline), on Basic Roads' bytes -
  // BAY-OWN: the Bay's own cities on the Bay's own road data (y * 1000 + x)
  TW.setTownWallPaths((x, y) => ({ roads: roadsB[y * 1000 + x], tracks: tracksB[y * 1000 + x], curved: false }));
  try {
    const bay = [];
    let k = 0;
    for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); for (let l = 0; reg && l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc?.outline?.bay && k++ % 6 === 0) bay.push(loc); } }
    const b = tally(bay, () => roadsB, tracksB);
    assert.ok(b.cities > 60 && b.gates > b.cities * 2, `the Bay: ${JSON.stringify(b)}`);
    assert.deepEqual([b.drivers, b.carriages, b.onGate, b.onRoad], [b.gates, b.gates, 0, 0], `the Bay: ${JSON.stringify(b)}`);
    // past the Bay: every sixth city template walled on its outline, a road every way into it (eight gates)
    TW.setTownWallPaths(() => ({ roads: ROADS_EVERY_WAY, tracks: 0, curved: false }));
    const rows = [];
    for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); for (let l = 0; reg && l < reg.locationCount; l++) { const lc = maps.getLocation(r, l); if (lc) rows.push(lc); } }
    const past = arenaTemplates(rows)['city-state'].filter((_, j) => j % 6 === 0).map((t, j) => {
      const loc = outlineTownLocation({ ...t, mapTableData: { ...t.mapTableData, mapId: ((0xa7 << 20) | (730000 + j)) >>> 0 } }, io);
      TW.standTownWall(loc, t.exterior.exteriorData.blockNames, io, townOutlineBlockJson);
      return loc;
    });
    const p = tally(past, (px, py) => { const R0 = new Uint8Array(1000 * 500); R0[py * 1000 + px] = ROADS_EVERY_WAY; return R0; }, new Uint8Array(1000 * 500));
    assert.ok(p.cities > 60 && p.gates > p.cities * 6, `past the Bay: ${JSON.stringify(p)}`);
    assert.deepEqual([p.drivers, p.carriages, p.onGate], [p.gates, p.gates, 0], `past the Bay: ${JSON.stringify(p)}`);
    // RECORDED: with eight roads in, a few gates have no clear place within GATE_ROAD_CLEAR.most
    assert.ok(p.onRoad <= 0.02 * p.gates, `past the Bay on a painted road: ${p.onRoad} of ${p.gates}`);
    assert.equal(GATE_ROAD_CLEAR.most, 2 * GATE_CLEAR.most);
  } finally { TW.setTownWallPaths(null); }
});

test('AUDIT CAPITAL-CARRIAGES T3-T7: the Imperial City\'s stand clear of its gate slice\'s models and its walkers round it; the search\'s every arm - the next gate\'s things where the side\'s own stand nowhere, a step toward the wall, along either way, a reach off the gate\'s line, never the sea or a lake; the carriage towns as the capitals\' own locations are minted; the gate frames; the stand\'s measures (mutants: the slice\'s footprint none; the slice another; the approach\'s walkers through; no next gate; never toward the wall; along one way; on the gate\'s line; the sea read as ground; a lake open; the Imperial City\'s number read as a flag; a frame moved; the stand narrowed; the bank linear)', () => {
  modOn();
  installCapitals({ addTextures: () => 0 });
  // The Imperial City's footprint at its gate its slice's, 300 (imperialSliceFootprint: the parts of it and its eight
  // neighbours); a capital of one footprint its own
  const IC = CAPITALS[0];
  assert.equal(carriageFootprintOf(IC, () => 'own')(...IC.gateAt.W), imperialSliceFootprint(300));
  assert.notEqual(imperialSliceFootprint(300), null, 'Talos Bridge stands on it');
  assert.equal(carriageFootprintOf(CAPITALS[2], () => 'own')(0, 0), 'own');
  // The walkers round its things - each one's cell shut on the approach block it stands on
  const blocks = capitalPortBlocks({ gateThings: capitalCarriagesOf }), byName = new Map(blocks.map((b) => [b.name, b]));
  for (const it of standsOf(IC)[0].items) {
    const c = Math.floor(it.x / B + IC.anchor[0]), r = Math.floor(it.z / B + IC.anchor[1]), a = byName.get(capitalApproachName(IC, c, r))?.json?.RmbBlock;
    assert.ok(a, `on an approach block (${c}, ${r})`);
    const bx = it.x - (c - IC.anchor[0]) * B, bz = (r + 1 - IC.anchor[1]) * B - it.z;
    assert.equal(a.FldHeader.AutoMapData[(63 - Math.floor(bz / 1.6)) * 64 + Math.floor(bx / 1.6)], 0xfe, 'its walkers round it');
  }
  const he = CAPITALS.find((c) => c.key === 'helstrom'), N = { ...he, gates: ['N'] }, fpHe = () => (footprints.get('helstrom') ?? footprints.set('helstrom', capitalFootprint(he)).get('helstrom'));
  // The side's own gate's things that stand nowhere (one of them 100 m inside the wall's line): the next gate's, outside
  const r08 = carriageRecordsOf('WALLAA08'), deep = { ...r08, MiscFlatObjectRecords: [...r08.MiscFlatObjectRecords, { ...r08.MiscFlatObjectRecords[0], ZPos: r08.MiscFlatObjectRecords[0].ZPos - 4000 }] };
  const next = capitalCarriages(N, { footprintOf: fpHe, records: (g) => (g === 'WALLAA08' ? deep : carriageRecordsOf(g)) })[0];
  assert.deepEqual([next.gate, next.inside], ['WALLAA09', false]);
  // Toward the wall - Helstrom's north carriage a step nearer its gate than Daggerfall's, its reach off the rim
  const car = standsOf(he)[0].items.find((it) => it.r.ModelIdNum === 41214), out08 = (r08.Misc3dObjectRecords.find((q) => q.ModelIdNum === 41214).ZPos + 4096) * 0.025 - IT_GATE_FRAMES.WALLAA08.at[1];
  assert.ok(he.gateAt.N[1] - car.z < out08 - 0.5, `toward the wall: ${he.gateAt.N[1] - car.z} for ${out08}`);
  // Along either way - kept off the ground east of x 27, the things step west (the nearer: east is past x 64). PIN
  // MOVED: our stand stands east of Helstrom's north gate, where the mod's stood west of it
  const west = capitalCarriages(N, { footprintOf: () => (x, z) => x > 27 && x < 64 && z < -224.8 })[0];
  assert.ok(west && !west.inside && west.items.every((it) => it.x < 27), 'west');
  // A thing within its reach of the gate's line steps out of it
  const f0 = r08.MiscFlatObjectRecords[0], near = { Misc3dObjectRecords: [], MiscFlatObjectRecords: [{ ...f0, XPos: Math.round((38.4 - 14) / 0.025), ZPos: Math.round((11.2 + 0.5) / 0.025) - 4096 }] };
  const stepped = capitalCarriages(N, { footprintOf: () => null, records: (g) => (g === 'WALLAA08' ? near : null) })[0];
  assert.ok(he.gateAt.N[1] - stepped.items[0].z > GATE_CLEAR.flat, `off the gate's line: ${he.gateAt.N[1] - stepped.items[0].z}`);
  // Never the sea - Solitude's east wall where its cliff falls to the sea north of the neck; never a lake - Alinor's
  // harbour wall, the quay and the sea past it
  const so = CAPITALS.find((c) => c.key === 'solitude'), east = capitalCarriages({ ...so, gates: ['E'], gateAt: { E: [530, -40] } }, { footprintOf: () => null });
  for (const st of east) for (const it of st.items) assert.ok(CAPITAL_RELIEFS.solitude.height(it.x, it.z) > 1e-3, `Solitude's ${st.inside ? 'inside' : 'outside'}: on the sea at ${it.x}, ${it.z}`);
  const al = CAPITALS.find((c) => c.key === 'alinor'), south = capitalCarriages({ ...al, gates: ['S'], gateAt: { S: [0, 466] } }, { footprintOf: () => null });
  for (const st of south) for (const it of st.items) assert.notEqual(planCell(al, Math.floor(it.z / B + al.anchor[1]), Math.floor(it.x / B + al.anchor[0])), 'L', 'on a lake');
  // Never a lake - a capital whose ground outside its north gate is all water stands its things inside, on its gardens
  const lakeside = { key: 'lakeside', tag: 'LK', anchor: [4, 4], blocks: {}, plan: Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, () => (r < 3 ? 'L' : 'G'))), gates: ['N'], gateAt: { N: [0, -110] } };
  const lk = capitalCarriages(lakeside, { footprintOf: () => null });
  assert.deepEqual(lk.map((st) => st.inside), [true], 'inside, the lake outside');
  for (const it of lk[0].items) assert.equal(planCell(lakeside, Math.floor(it.z / B + 4), Math.floor(it.x / B + 4)), 'G');
  // Never on the gate's lane - a thing drawn 3 m along it, stood inside, steps along off it. PIN MOVED:
  // our stand stands 26 m along, past any lane, so the thing is the test's own
  const laneRec = { Misc3dObjectRecords: [], MiscFlatObjectRecords: [{ ...f0, XPos: Math.round((38.4 - 3) / 0.025), ZPos: Math.round((91.2 - 5) / 0.025) - 4096 }] };
  const onLane = capitalCarriages(lakeside, { footprintOf: () => null, records: (g) => (g === 'WALLAA10' ? laneRec : null) })[0];
  assert.ok(onLane.inside && Math.abs(onLane.items[0].x) >= APPROACH_HALF + GATE_CLEAR.flat, `off the lane: ${onLane.items[0].x}`);
  // Never the sea - Solitude's north wall where its cliff falls to the sea, its plan's water there made garden: its
  // things stand on no ground the relief says is the sea's (the sea lies level), a model level on the ground as drawn.
  // PIN MOVED: our stand stands east of its gate, so a gate at x -60 puts it over the sea west of x -30
  const sr = CAPITAL_RELIEFS.solitude, drawnSol = (x, z) => reliefDrawnAt(sr, x, z) - sr.flat;
  for (const gx of [-60, 20]) {
    const cliff = capitalCarriages({ ...so, plan: so.plan.map((row, r) => (r < 2 ? row.map(() => 'G') : row)), gates: ['N'], gateAt: { N: [gx, -108] } }, { footprintOf: () => null });
    for (const st of cliff) for (const it of st.items) {
      assert.ok(sr.height(it.x, it.z) > 1e-3, `on the sea at ${it.x}, ${it.z}`);
      if (it.model) for (let k = 0; k < 8; k++) assert.ok(Math.abs(drawnSol(it.x + Math.cos((k * Math.PI) / 4) * GATE_CLEAR.model, it.z + Math.sin((k * Math.PI) / 4) * GATE_CLEAR.model) - it.h) <= CARRIAGE_LEVEL + 1e-9, `level at ${gx}`);
    }
  }
  // A painted road's band two and a half tiles either side of its line - a 2 x 2 town, an arm in from the north
  const town = { exterior: { exteriorData: { width: 2, height: 2, blockNames: ['X', 'X', 'X', 'X'] } }, mapTableData: { mapId: 1 } };
  const roadOk = townGateOutside(town, { pieces: [] }, { roads: DIR.N, tracks: 0, curved: false }, () => null), mid = (64 - 48) * 6.4;
  assert.deepEqual([roadOk(mid + 15.9, mid, 0), roadOk(mid + 16.1, mid, 0), roadOk(mid + 16.1, mid, 0.3)], [false, true, false], 'the road\'s band, and a thing\'s reach past it');
  // The carriage towns as the capitals' own locations are minted (synthesizeCapitalLocation) - the Imperial City (its k
  // 0) its landing's slice and no other, a harbour's sea slice none
  const kinds = new Map([...new Set(['RESI', 'GENR', ...CAPITALS.flatMap((c) => (c.plan ?? []).flat())])].map((k) => [k, [`${k}AA00.RMB`]])), base = { name: 'B', regionIndex: 1, regionName: 'R', politic: 129, climate: { worldClimate: 231 }, hasDungeon: false, mapTableData: { mapId: 9, locationType: 0 }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1, mapId: 9, portTownAndUnknown: 0 }, buildings: [], recordElement: { header: { locationId: 9 } } } };
  const minted = (k, s) => synthesizeCapitalLocation({ cap: CAPITALS[k], k, s }, { base, names: kinds, blockOf: () => null, px: 2177, py: 612 });
  assert.deepEqual([minted(0, 300), minted(0, 312), minted(0, 0), minted(3, 0), minted(3, 1), minted(6, capitalCentre(CAPITALS[6]))].map((l) => isCarriageTown(l)), [true, false, false, true, false, true]);
  // The gate frames, as the ARENA2 pin measures them on BLOCKS.BSA
  assert.deepEqual(JSON.parse(JSON.stringify(IT_GATE_FRAMES)), { WALLAA08: { at: [38.4, 11.2], out: [0, 1] }, WALLAA09: { at: [11.2, 64], out: [1, 0] }, WALLAA10: { at: [38.4, 91.2], out: [0, -1] }, WALLAA11: { at: [91.2, 38.4], out: [-1, 0] } });
  // The stand 32 m along the wall and 13.2 m out past the cliff's line, banked over a tile by a smoothstep
  const S = R.SOLITUDE_CARRIAGE_STAND;
  assert.deepEqual([S.x1 - S.x0, Math.round((S.z1 - S.z0) * 10) / 10, S.bank], [32, 13.2, 6.4]);
  const G = R.SOLITUDE_GATE_ROAD, at = [280, S.z1 + S.bank / 4], r = R.gateRoadAt(...at), slope = r.d < G.half + G.shoulder ? null : R.southSlope(...at);
  assert.ok(slope !== null && Math.abs(R.southHeight(...at) - (R.SOLITUDE_LEVELS.city + (slope - R.SOLITUDE_LEVELS.city) * 0.15625)) < 1e-9, 'a quarter into the bank: smoothstep\'s 0.15625');
});

test('AUDIT CAPITAL-CARRIAGES P: each capital\'s driver, read off its block by the game\'s own reader, a person in Carriage Drivers whose click is the merchant\'s popup - Fast Travel on its button - as the Bay\'s are (mutants: the faction dropped)', async () => {
  const { blockFromJson } = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { collectMiscFlats } = await import('../../src/world/rmbFlats.js');
  const { staticNpcRoute } = await import('../../src/systems/guild/guildServiceFlow.js');
  const { IT_FACTIONS, CARRIAGE_DRIVERS_FACTION_ID } = await import('../../src/systems/immersiveTravel.js');
  modOn();
  installCapitals({ addTextures: () => 0 });
  const npcFaction = IT_FACTIONS.find((f) => f.id === CARRIAGE_DRIVERS_FACTION_ID);
  const drivers = capitalPortBlocks({ gateThings: capitalCarriagesOf }).flatMap((b) => collectMiscFlats(blockFromJson(b.json, 0, b.name)).filter((f) => f.factionID === CARRIAGE_DRIVERS_FACTION_ID));
  assert.equal(drivers.length, CAPITALS.reduce((n, c) => n + c.gates.length, 0), 'one a road gate');
  for (const f of drivers) assert.deepEqual(staticNpcRoute({ npcFactionId: f.factionID, npcFaction, insideBuilding: false, hasCustomMerchantService: (id) => id === CARRIAGE_DRIVERS_FACTION_ID }), { kind: 'merchant', service: 'sell' });
});
