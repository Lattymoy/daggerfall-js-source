// AUDIT TESA II, lane C (2026-10-25; bible/03-World/Arena-Provinces.md TESA10 to TESA11, TESA-LORE, IC-RING) - the
// capitals' fixes, pinned: the rim Daggerfall's own cities leave the land (C1), the shore capitals at the sea's floor and
// over the sea pixel off their harbour (C2), the Imperial City's causeways to its compounds' gates (C3), Falinesti's
// walkway clear to every platform (C4), the city's laws worked once (C5), Helstrom's gates on its hummocks (C6), every
// slice's arrivals (C7), the capitals' port blocks built from `make` (C8), the pixel's side law (C9), the gates' lanes
// (C10), an unused base of block indices (C13), a quad on one plane (C14), the measures in BLOCK_M (C15), and (lane R's
// R2) a gate the roads can reach. The real data's pins (ARENA2_PATH) build every capital on the freeware's ground.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  CAPITALS, CAPITAL_BLOCK_INDEX, CAPITAL_RIM_M, CAPITAL_RIM_TILES, CAPITAL_NO_GROUND, CAPITAL_MODELS, BLOCK_M, GATE_REACH, GATE_STEPS,
  capitalPortBlocks, inCapitalRim, onCapitalRing, capitalLakeName, capitalGardenName, spanSideBytes, capitalGates, capitalSpanPixels,
  capitalDims, capitalSliceCarriers, capitalSliceMarkers, capitalCentre, tileCentre, synthesizeCapitalLocation, SOLITUDE,
} from '../../src/world/tamrielCapitals.js';
import { ALINOR, TORVAL, HELSTROM, FALINESTI, ALINOR_HARBOUR, TORVAL_DOCKS } from '../../src/world/capitalPlans.js';
import { alinorTowers } from '../../src/world/capitalAlinor.js';
import { torvalTowers } from '../../src/world/capitalTorval.js';
import {
  IMPERIAL, IMPERIAL_SPAN, polar, causewayLines, bridgeLine, prisonAt, prisonGates, universityGates, compoundGateAt, imperialClosed,
  divinesAt, divinePlinths, universityTowerAt, universityHallAt, imperialPartId, IMPERIAL_CELLS, imperialSliceName,
} from '../../src/world/imperialCity.js';
import { imperialOpenAt, imperialOwnLaws } from '../../src/world/imperialBlocks.js';   // PIN MOVED (IC-GRAND): the arrivals' law with the city's blocks
import { buildGrahtOak, spiralAt, spiralInner, hutAngle, platformOpen, PLATFORM_SIDES } from '../../src/world/capitalFalinesti.js';
import { installCapitals, capitalFootprint, vanillaTexels } from '../../src/world/capitalModels.js';
import { customModelFor } from '../../src/world/customModels.js';
import { CITIES } from '../../src/world/tamriel/tamrielGeography.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { WoodsFile } from '../../src/formats/woodsFile.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { generatePixelTerrain } from '../../src/world/terrain/terrainGen.js';
import { SCALED_OCEAN_ELEVATION, MAX_TERRAIN_HEIGHT } from '../../src/world/terrain/terrainSampler.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
afterEach(() => { setTamrielFit(null); setTamrielTrace(null); });

/** Every capital model's mesh, installed (vanillaTexels' UVs), by key. */
const models = () => { installCapitals({ addTextures: () => 0 }); return Object.fromEntries(Object.entries(CAPITAL_MODELS).map(([k, id]) => [k, customModelFor(id)])); };
/** A plan's metres (x east, z south of its north-west corner) of a point the anchor's metres. */
const planAt = (cap, dx, dz) => [cap.anchor[0] * BLOCK_M + dx, cap.anchor[1] * BLOCK_M + dz];

// ── C1: THE RIM ─────────────────────────────────────────────────

test('AUDIT TESA II C1: a capital leaves Daggerfall\'s rim to the land - its outer eleven tiles no ground of its own, closed and treeless, on the span\'s outer sides alone (the Imperial City\'s inner seams level ground) - in every block it lays, its own, its gardens and its ring\'s lakes', () => {
  assert.deepEqual([CAPITAL_RIM_TILES, CAPITAL_RIM_M], [11, 70.4]);
  const ic = CAPITALS[0], W = IMPERIAL_CELLS * BLOCK_M;   // PIN MOVED (IC-GRAND): its plan a law, two hundred cells a side
  assert.ok(inCapitalRim(ic, 70.3, 900) && !inCapitalRim(ic, 70.5, 900) && inCapitalRim(ic, W - 70.3, 900) && inCapitalRim(ic, 900, 1) && inCapitalRim(ic, 900, W - 1));
  for (const seam of [8 * BLOCK_M, 16 * BLOCK_M]) assert.ok(!inCapitalRim(ic, seam, 900) && !inCapitalRim(ic, 900, seam), `the slices' seam at ${seam} no rim`);
  const blocks = capitalPortBlocks();
  let laid = 0;
  for (const cap of CAPITALS) {
    if (cap.family) continue;   // PIN MOVED (IC-GRAND): the Imperial City's blocks a family's, each its rim by the same law (test/world/icgrand_lod.test.js)
    cap.plan.forEach((row, r) => row.forEach((cell, cx) => {
      const own = Object.hasOwn(cap.blocks, cell) ? cap.blocks[cell].name : null;
      const name = own ?? (cell === 'G' ? capitalGardenName(cap, cx, r) : cell === 'L' && onCapitalRing(cap, cx, r) ? capitalLakeName(cap, cx, r) : null);
      if (!name) return;
      const b = blocks.find((x) => x.name === name), g = b.json.RmbBlock.FldHeader.GroundData, A = b.json.RmbBlock.FldHeader.AutoMapData;
      g.GroundTiles.forEach((t, i) => {
        const [x, z] = tileCentre(i % 16, Math.floor(i / 16)), rim = inCapitalRim(cap, cx * BLOCK_M + x, (r + 1) * BLOCK_M - z);
        assert.equal(t.TileBitfield === CAPITAL_NO_GROUND, rim, `${name} tile ${i}`);
        if (rim) { assert.equal(g.GroundScenery[i].TextureRecord, -1, `${name}: no tree in its rim`); laid++; }
      });
      for (let ay = 0; ay < 64; ay += 7) for (let ax = 0; ax < 64; ax += 7) {
        const x = (ax + 0.5) * 1.6, z = (63 - ay + 0.5) * 1.6;
        if (inCapitalRim(cap, cx * BLOCK_M + x, (r + 1) * BLOCK_M - z)) assert.notEqual(A[ay * 64 + ax], 0, `${name}: its rim closed`);
      }
    }));
    // the ring's lakes its own, the shared lake's none on it
    cap.plan.forEach((row, r) => row.forEach((cell, cx) => { if (cell === 'L' && !onCapitalRing(cap, cx, r)) assert.ok(!blocks.some((b) => b.name === capitalLakeName(cap, cx, r)), 'an inner lake the shared one'); }));
  }
  assert.ok(laid > 1000, `the rims laid: ${laid}`);
  // the location's rect: the rim's land blends from where the city's ground ends (terrainTiles.js' capital arm)
  assert.match(read('src/world/terrain/terrainTiles.js'), /if \(dfLocation\.capital\) \{\n\s+const lo = \(v\) => \(v > 0 \? v : v - extraClearance\), hi = \(v\) => \(v < WORLD_MAP_TILE_DIM - 1 \? v \+ 1 : v \+ extraClearance\);/);
});

test('AUDIT TESA II C1: no landmark stands in the rim on a side of land - every vertex of every capital\'s models inside it; Talos Bridge\'s west end at its inner edge, down at the ground (AUDIT-TESA A3-2: the road from the west meets it, where its deck stood 42 m over the road\'s end)', () => {
  installCapitals({ addTextures: () => 0 });
  let bridgeEnd = Infinity;
  const bridge = new Set([CAPITAL_MODELS.talosBridge, ...Array.from({ length: IMPERIAL_SPAN ** 2 }, (_, s) => imperialPartId(CAPITAL_MODELS.talosBridge, s))]);   // TS5: carried in its parts
  for (const cap of CAPITALS) {
    const W = (cap.plan ? cap.plan[0].length : cap.cells) * BLOCK_M, H = (cap.plan ? cap.plan.length : cap.cells) * BLOCK_M, water = new Set(cap.sea ?? []);   // PIN MOVED (IC-GRAND): the Imperial City's plan a law
    for (const id of cap.models) {
      const p = customModelFor(id).positions;
      for (let i = 0; i < p.length; i += 3) {
        const [X, Z] = planAt(cap, p[i], -p[i + 2]);
        for (const [side, d] of [['W', X], ['E', W - X], ['N', Z], ['S', H - Z]]) if (!water.has(side)) assert.ok(d >= CAPITAL_RIM_M - 1e-3, `${cap.key} model ${id}: ${d.toFixed(2)} m from its ${side} edge`);
        if (bridge.has(id)) bridgeEnd = Math.min(bridgeEnd, X);
      }
    }
  }
  // PIN MOVED (TS5): on seven pixels the land past the round lake stands between its far shore and the rim - the bridge
  // comes down on it, its landing short of the rim (on TESA11's three the rim's inner edge was the far shore)
  const end = IMPERIAL_CELLS / 2 * BLOCK_M - IMPERIAL.lake - IMPERIAL.bridge.landing;
  assert.ok(Math.abs(bridgeEnd - end) < 1e-3 && bridgeEnd >= CAPITAL_RIM_M, `the bridge to its landing, short of the rim: ${bridgeEnd}`);
  assert.ok(Math.abs(bridgeLine()[1][0] + IMPERIAL.lake + IMPERIAL.bridge.landing) < 1e-9, 'its line the same');
  const p = customModelFor(CAPITAL_MODELS.talosBridge).positions;
  let deck = Infinity;
  for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i] - bridgeLine()[1][0]) < 1e-3 && p[i + 1] > 0) deck = Math.min(deck, p[i + 1]);
  assert.ok(deck <= 0.31, `its deck at its west end: ${deck} m`);
});

// ── C2 / C9: THE SHORE CAPITALS ─────────────────────────────────

test('AUDIT TESA II C2: a shore capital stands at the sea\'s floor - every slice flattened to the kernel\'s ocean clamp, its harbour\'s water the sea\'s; Alinor and Torval over the sea pixel off their harbours, its own block the slice\'s carrier, named its district\'s', () => {
  assert.deepEqual([ALINOR_HARBOUR, TORVAL_DOCKS], ['Alinor Harbour', 'Torval Docks']);
  for (const key of ['alinor', 'torval']) {
    const cap = CAPITALS.find((c) => c.key === key), D = capitalDims(cap);
    assert.deepEqual([D.w, D.h, D.mx, D.my, D.sea], [1, 2, 0, 0, [1]], key);
    assert.equal(cap.plan.length, 16);
    cap.plan.slice(8).forEach((row, r) => row.forEach((cell, cx) => assert.equal(cell, r === 0 && cx === 3 ? 'S0' : 'L', `${key} ${cx},${8 + r}`)));
    assert.equal(capitalSliceCarriers(cap).get(1), 'S0');
    assert.deepEqual(cap.sliceNames, [null, key === 'alinor' ? ALINOR_HARBOUR : TORVAL_DOCKS]);
  }
  const names = new Map(['MAGE', 'GENR', 'TVRN', 'RESI', 'LIBR', 'ALCH', 'GEMS', 'BOOK', 'ARMR', 'TEMP', 'PAWN', 'GRVE', 'BANK', 'FIGH', 'THIE', 'CUST'].map((k) => [k, [`${k}AA00.RMB`]]));
  const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 0, buildingDataList: [] } } };
  const base = { name: 'Broadvale', regionIndex: 1, regionName: 'R', politic: 129, climate: {}, hasDungeon: false, mapTableData: { mapId: 9, locationType: LOCATION_TYPES.TownCity }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1 }, buildings: [] } };
  CAPITALS.forEach((cap, k) => {
    const D = capitalDims(cap);
    for (let s = 0; s < D.w * D.h; s++) {
      const px = 100 + (s % D.w), py = 100 + Math.floor(s / D.w), loc = synthesizeCapitalLocation({ cap, k, s }, { base, names, blockOf: () => fh, px, py });
      const f = loc.capital.flattenAt;
      if (cap.shore) assert.deepEqual(f, { px: 100 + D.mx, py: 100 + D.my, sea: true }, `${cap.key} slice ${s}`);
      else assert.equal(f?.sea, undefined, `${cap.key}: inland, its own ground`);
    }
  });
  // the kernel: a shore capital's ground the ocean clamp, whatever the land under it
  const woods = new WoodsFile();
  assert.equal(woods.load(syntheticWoodsBytes()), true);
  const job = (flattenAt) => generatePixelTerrain({ woods, px: 400, py: 200, tilemap: new Uint8Array(128 * 128), locationRect: { xMin: 11, xMax: 117, yMin: 11, yMax: 117 }, hasLocation: true, climateType: 0, flattenAt });
  const sea = job({ px: 400, py: 200, sea: true }), land = job({ px: 400, py: 200 });
  assert.equal(sea.avg, SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT);
  assert.notEqual(land.avg, sea.avg, 'a land of its own height');
  assert.equal(sea.samples[64 * 129 + 64], Math.fround(sea.avg), 'flat at the sea\'s floor');
});

test('AUDIT TESA II C9: a span\'s side is read from the heights Daggerfall\'s patches are laid from - the north edge the row above from the column before, the west the column before from the row above, the south and east its own last row and column', () => {
  assert.deepEqual(spanSideBytes(10, 20, 1, 1, 'N'), [[9, 19], [10, 19]]);
  assert.deepEqual(spanSideBytes(10, 20, 1, 1, 'W'), [[9, 19], [9, 20]]);
  assert.deepEqual(spanSideBytes(10, 20, 1, 1, 'S'), [[9, 20], [10, 20]]);
  assert.deepEqual(spanSideBytes(10, 20, 1, 1, 'E'), [[10, 19], [10, 20]]);
  assert.deepEqual(spanSideBytes(10, 20, 3, 3, 'S'), [[9, 22], [10, 22], [11, 22], [12, 22]]);
  assert.deepEqual(spanSideBytes(10, 20, 1, 2, 'E'), [[10, 19], [10, 20], [10, 21]]);
  assert.deepEqual(CAPITALS.filter((c) => c.shore).map((c) => [c.key, c.sea]), [['solitude', ['N', 'W']], ['alinor', ['S']], ['torval', ['S']]]);
});

// ── C3: THE CAUSEWAYS ───────────────────────────────────────────

test('AUDIT TESA II C3: each of the Imperial City\'s causeways ends at a gate of the compound it leads to - within a gate\'s width of it, outside the curtain - and the way on through the gate is open (the curtain\'s, the law\'s one gates)', () => {
  const [prison, ...university] = causewayLines();
  installCapitals({ addTextures: () => 0 });
  const P = IMPERIAL.prison, U = IMPERIAL.university, fp = capitalFootprint(CAPITALS[0]);
  for (const [way, centre, half, gates, w] of [[prison, prisonAt(), P.half, prisonGates(), 12], ...university.slice(0, 2).map((u) => [u, polar(U.b, U.r), U.half, universityGates(), 10])]) {
    const end = way[1], at = gates.map((g) => compoundGateAt(centre, half, g, 0));
    const near = Math.min(...at.map(([x, z]) => Math.hypot(x - end[0], z - end[1])));
    assert.ok(near <= w, `the way ends ${near.toFixed(1)} m from a gate`);
    assert.ok(Math.max(Math.abs(end[0] - centre[0]), Math.abs(end[1] - centre[1])) > half, 'outside the curtain');
    const [gx, gz] = at.find(([x, z]) => Math.hypot(x - end[0], z - end[1]) === near), into = [Math.sign(centre[0] - gx) * (Math.abs(centre[0] - gx) > half - 1 ? 1 : 0), Math.sign(centre[1] - gz) * (Math.abs(centre[1] - gz) > half - 1 ? 1 : 0)];
    for (let t = -4; t <= 8; t += 0.5) assert.equal(fp(gx + into[0] * t, gz + into[1] * t), false, `through the gate at ${t} m`);
  }
  assert.equal(university.length, 3, 'the University\'s two ways and the Waterfront\'s');
});

// ── C4: FALINESTI'S WALKWAY ─────────────────────────────────────

test('AUDIT TESA II C4: Falinesti\'s walkway is clear for a body all the way up - 2 m over its deck across its width, from the ground through the roots at its foot to the highest platform', () => {
  const m = buildGrahtOak(), p = m.positions, ix = m.indices, S = FALINESTI.spiral;
  // the oak's faces bucketed on a 4 m grid over the walkway's ring
  const cell = 4, grid = new Map(), key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  for (let t = 0; t < ix.length; t += 3) {
    const v = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3], xs = v.map((a) => p[a]), zs = v.map((a) => p[a + 2]);
    if (Math.min(...xs) > 60 || Math.max(...xs) < -60 || Math.min(...zs) > 60 || Math.max(...zs) < -60) continue;
    for (let gx = Math.floor(Math.min(...xs) / cell); gx <= Math.floor(Math.max(...xs) / cell); gx++) for (let gz = Math.floor(Math.min(...zs) / cell); gz <= Math.floor(Math.max(...zs) / cell); gz++) {
      const k = `${gx},${gz}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(t);
    }
  }
  const lowest = (x, z, y0, y1) => {
    let best = null;
    for (const t of grid.get(key(x, z)) ?? []) {
      const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3], d = (p[b + 2] - p[c + 2]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 2] - p[c + 2]);
      if (Math.abs(d) < 1e-12) continue;
      const w0 = ((p[b + 2] - p[c + 2]) * (x - p[c]) + (p[c] - p[b]) * (z - p[c + 2])) / d, w1 = ((p[c + 2] - p[a + 2]) * (x - p[c]) + (p[a] - p[c]) * (z - p[c + 2])) / d, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const y = w0 * p[a + 1] + w1 * p[b + 1] + w2 * p[c + 1];
      if (y > y0 && y < y1 && (best === null || y < best)) best = y;
    }
    return best;
  };
  const N = 4 * 400;
  let samples = 0;
  for (let i = 0; i < N; i++) {
    const [a, y] = spiralAt((i + 0.5) / N);
    for (const off of [0.6, S.w / 2, S.w - 0.6]) {
      const r = spiralInner(y) + off, hit = lowest(Math.cos(a) * r, Math.sin(a) * r, y + 0.05, y + 2);
      assert.equal(hit, null, `a face ${hit === null ? '' : (hit - y).toFixed(2)} m over the walkway at y ${y.toFixed(1)}, ${off.toFixed(1)} m out`);
      samples++;
    }
  }
  assert.equal(samples, 3 * N);
  // the huts on the deck: none over its open arc
  for (let i = 0; i < FALINESTI.huts; i++) {
    const a = ((hutAngle(i) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    assert.equal(platformOpen()(Math.floor((a / (2 * Math.PI)) * PLATFORM_SIDES)), false, `hut ${i} over the deck's open arc`);
  }
});

// ── C5: THE CITY'S LAWS WORKED ONCE ─────────────────────────────

test('AUDIT TESA II C5: the Imperial City\'s closed law asks its fixed points worked once, each ring of them only near its own radius - the plain law\'s answer at every cell about them', () => {
  const I = IMPERIAL;
  const plain = (x, z) => {   // the law as it stood, every point worked at every call
    if (Math.hypot(x, z) < I.tower.plinthR + 1) return true;
    for (let i = 0; i < I.tombs.n; i++) { const [tx, tz] = polar(22.5 + i * (360 / I.tombs.n), I.tombs.r); if (Math.abs(x - tx) < I.tombs.w / 2 + 0.5 && Math.abs(z - tz) < I.tombs.w / 2 + 0.5) return true; }
    // PIN MOVED (IC-GRAND): the Colosseum's stands retired with it (Daggerfall's arena's block closes its own); the Elven
    // Gardens' pool closed
    const [qx, qz] = polar(I.pool.b, I.pool.r);
    if (Math.hypot(x - qx, z - qz) < I.pool.r0) return true;
    const T = I.temple, [tx, tz] = polar(T.b, T.r);
    if (Math.abs(x - tx) < T.w / 2 + 0.5 && Math.abs(z - tz) < T.l / 2 + 0.5) return true;
    const [sx, sz] = polar(I.statue.b, I.statue.r);
    if (Math.abs(x - sx) < I.statue.plinth / 2 + 0.5 && Math.abs(z - sz) < I.statue.plinth / 2 + 0.5) return true;
    const D = I.divines, [ax, az] = divinesAt(I);
    if (Math.abs(x - ax) < D.talosPlinth / 2 + 1.5 && Math.abs(z - az) < D.talosPlinth / 2 + 1.5) return true;
    if (divinePlinths(I).some(([px, pz]) => Math.abs(x - px) < D.plinth / 2 + 0.5 && Math.abs(z - pz) < D.plinth / 2 + 0.5)) return true;
    const [px, pz] = prisonAt(I);
    if (Math.hypot(x - px, z - pz) < I.prison.bastionR + 1) return true;
    const [ux, uz] = universityTowerAt(I), [hx, hz] = universityHallAt(I);
    return Math.hypot(x - ux, z - uz) < I.university.spireR + 1 || (Math.abs(x - hx) < I.university.hall / 2 + 0.5 && Math.abs(z - hz) < I.university.hall / 2 + 0.5);
  };
  const about = [...Array.from({ length: I.tombs.n }, (_, i) => [polar(22.5 + i * (360 / I.tombs.n), I.tombs.r), I.tombs.w]), [divinesAt(), I.divines.court], ...divinePlinths().map((q) => [q, 6]), [prisonAt(), 20], [polar(I.temple.b, I.temple.r), 60]];
  let asked = 0, closed = 0;
  for (const [[cx, cz], r] of about) for (let z = cz - r - 2; z <= cz + r + 2; z += 0.4) for (let x = cx - r - 2; x <= cx + r + 2; x += 0.4) {
    const got = imperialClosed(x, z);
    assert.equal(got, plain(x, z), `${x.toFixed(1)},${z.toFixed(1)}`);
    asked++; if (got) closed++;
  }
  assert.ok(asked > 50000 && closed > 5000, `${asked} asked, ${closed} closed`);
  // a set of measures of its own its own points
  const moved = { ...I, tombs: { ...I.tombs, r: I.tombs.r + 30 } }, [tx, tz] = polar(22.5, moved.tombs.r);
  assert.equal(imperialClosed(tx, tz, moved), true);
  assert.equal(imperialClosed(tx, tz), plain(tx, tz));
});

// ── C6: HELSTROM'S GATES ────────────────────────────────────────

test('AUDIT TESA II C6: Helstrom\'s gates open onto its hummocks - from each, across its width, ground to the plan\'s edge (the marsh\'s water where the roads ended before)', () => {
  const cap = CAPITALS.find((c) => c.key === 'helstrom'), P = HELSTROM.palisade;
  for (const [z0, z1] of [[P.north, -cap.anchor[1] * BLOCK_M], [P.south, (cap.plan.length - cap.anchor[1]) * BLOCK_M]]) {
    for (let s = -P.gate / 2; s <= P.gate / 2; s += 1) for (let t = 0; t <= 1; t += 0.02) {
      const z = z0 + (z1 - z0) * t, [X, Z] = planAt(cap, s, z), cell = cap.plan[Math.min(cap.plan.length - 1, Math.floor(Z / BLOCK_M))][Math.floor(X / BLOCK_M)];
      assert.notEqual(cell, 'L', `the marsh's water at ${s}, ${z.toFixed(0)}`);
    }
  }
});

// ── C7: EVERY SLICE'S ARRIVALS ──────────────────────────────────

test('AUDIT TESA II C7: every slice of a capital carries its own start markers on its carrier - the Imperial City\'s on its slice\'s own open ground inside the city wall, a harbour\'s sea slice on its quay - none under a model', () => {
  installCapitals({ addTextures: () => 0 });
  const fp = Object.fromEntries(CAPITALS.map((c) => [c.key, capitalFootprint(c)]));
  for (const cap of CAPITALS) {
    const D = capitalDims(cap);
    // PIN MOVED (IC-GRAND): of six hundred and twenty-five slices one in seven asked (each slice's markers worked when its
    // carrier is first built) - the centre among them
    for (const [s] of [...capitalSliceCarriers(cap)].filter(([q]) => !cap.family || q % 7 === 0 || q === capitalCentre(cap))) {
      const markers = capitalSliceMarkers(cap, s);
      // IC-GRAND: a slice of open lake the bridge or the piers cross carries its part and no arrival - none of its ground
      // open (as TS5's corner slices, which carried none)
      if (cap.family && imperialSliceName(s) === 'Lake Rumare') { assert.ok(markers.length === 0 || markers.length >= 2, `${cap.key} slice ${s}`); continue; }
      assert.ok(markers.length >= (s === capitalCentre(cap) ? 3 : 2), `${cap.key} slice ${s}`);
      for (const [dx, dz] of markers) {
        const B = BLOCK_M, own = cap.family ? imperialOwnLaws(Math.floor(dz / B + IMPERIAL_CELLS / 2), Math.floor(dx / B + IMPERIAL_CELLS / 2)) : Object.values(cap.blocks)[0];   // PIN MOVED (IC-GRAND): its cell's own laws
        assert.ok(own.tile(dx, dz) !== 0 && !own.closed(dx, dz) && !fp[cap.key](dx, dz), `${cap.key} slice ${s}: ${dx},${dz} on open ground`);
        assert.ok(!inCapitalRim(cap, ...planAt(cap, dx, dz)), `${cap.key} slice ${s}: ${dx},${dz} off the rim`);
        if (cap.key === 'imperial-city') {
          const S = 8 * BLOCK_M, x0 = (s % IMPERIAL_SPAN) * S - IMPERIAL_CELLS / 2 * BLOCK_M, z0 = Math.floor(s / IMPERIAL_SPAN) * S - IMPERIAL_CELLS / 2 * BLOCK_M;   // PIN MOVED (TS5): seven pixels a side; PIN MOVED (IC-GRAND): twenty-five
          assert.ok(dx >= x0 && dx < x0 + S && dz >= z0 && dz < z0 + S, `its own slice's: ${dx},${dz}`);
          assert.ok(imperialOpenAt(dx, dz), 'the city\'s open ground');
        }
        if ((D.sea ?? []).includes(s)) assert.ok(planAt(cap, dx, dz)[1] < 8 * BLOCK_M, 'a sea slice\'s on its quay, over the land\'s pixel');
      }
    }
  }
  const ic = CAPITALS[0], inside = [...capitalSliceCarriers(ic).keys()].filter((s) => s !== capitalCentre(ic) && s % 7 === 0).map((s) => capitalSliceMarkers(ic, s).filter(([x, z]) => Math.hypot(x, z) < IMPERIAL.cityWall.r).length);
  assert.ok(inside.filter((n) => n > 0).length >= 6, `the slices inside the wall: ${inside}`);
  // IC-GRAND: a slice the city wall crosses takes its arrivals on its open ground inside the wall first - the four on the
  // axes eight pixels out from the centre, the wall 6.9 km out across each of them
  const n = IMPERIAL_SPAN, c0 = (n - 1) / 2;
  for (const s of [c0 * n + c0 + 8, c0 * n + c0 - 8, (c0 - 8) * n + c0, (c0 + 8) * n + c0]) {
    const m = capitalSliceMarkers(ic, s);
    assert.ok(m.length >= 2 && m.every(([x, z]) => Math.hypot(x, z) < IMPERIAL.cityWall.r), `slice ${s}: inside the wall - ${m.map(([x, z]) => Math.round(Math.hypot(x, z)))}`);
  }
});

// ── C10: THE GATES' LANES ───────────────────────────────────────

test('AUDIT TESA II C10: Alinor\'s and Torval\'s north gates stand on their lanes off the palace\'s and the estate\'s blank backs, a tower either side of each; Solitude\'s main gate on its lane past the tavern\'s block (the real blocks\' lanes: the ARENA2 pin below)', () => {
  for (const [key, towers, W, back] of [['alinor', alinorTowers(), ALINOR.wall, ALINOR.palace.terraces[0][0] / 2], ['torval', torvalTowers(), TORVAL.wall, TORVAL.estate.half]]) {
    assert.ok(W.northGate - W.gate / 2 > back + 20, `${key}: its gate clear of the closed back`);
    const near = towers.filter(([x, z]) => z === W.north && Math.abs(x - W.northGate) < W.gate / 2 + 2 * W.tower + 1);
    assert.ok(near.some(([x]) => x < W.northGate) && near.some(([x]) => x > W.northGate), `${key}: a tower either side of its north gate`);
  }
  assert.equal(SOLITUDE.wall.southGate, 318.4);
});

// ── C13: THE BLOCK INDICES ──────────────────────────────────────

test('AUDIT TESA II C13: no fixed block index in the tree falls in another\'s - the capitals\' run from 901000 past every one (the Sky-Ketch\'s 900400 was theirs)', () => {
  const fixed = [];
  const walk = (dir) => { for (const e of readdirSync(new URL(dir, root), { withFileTypes: true })) { const p = `${dir}${e.name}`; if (e.isDirectory()) walk(`${p}/`); else if (e.name.endsWith('.js')) for (const m of read(p).matchAll(/export const (\w*BLOCK_INDEX) = (\d+);/g)) fixed.push([m[1], Number(m[2]), p]); } };
  walk('src/');
  assert.ok(fixed.length >= 7, fixed.map((f) => f[0]).join());
  const runs = fixed.map(([n, i, p]) => [n, i, n === 'CAPITAL_BLOCK_INDEX' ? capitalPortBlocks().length : 1, p]);
  assert.equal(CAPITAL_BLOCK_INDEX, 901000);
  for (const [a, i, n] of runs) for (const [b, j, m] of runs) if (a !== b) assert.ok(i + n <= j || j + m <= i, `${a} (${i}..${i + n - 1}) over ${b} (${j}..${j + m - 1})`);
  assert.deepEqual(capitalPortBlocks().map((b) => b.index), capitalPortBlocks().map((_, k) => CAPITAL_BLOCK_INDEX + k));
});

// ── C14: A QUAD ON ONE PLANE ────────────────────────────────────

test('AUDIT TESA II C14: a quad is mapped on one plane - no planar quad of any capital model shares a corner mapped two ways; a face at 45 degrees takes its normal\'s plane, never its rounding\'s (TESA-LORE\'s density held, tesalore_capitals.test.js)', () => {
  const all = models();
  let quads = 0;
  for (const [name, m] of Object.entries(all)) {
    const p = m.positions, ix = m.indices, uv = m.uvs;
    const nrm = (t) => { const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3], u = [0, 1, 2].map((k) => p[b + k] - p[a + k]), v = [0, 1, 2].map((k) => p[c + k] - p[a + k]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n); return n.map((x) => x / l); };
    for (let t = 0; t + 5 < ix.length; t += 6) {
      const a = ix[t], b = ix[t + 3];
      if (!(p[a * 3] === p[b * 3] && p[a * 3 + 1] === p[b * 3 + 1] && p[a * 3 + 2] === p[b * 3 + 2])) continue;
      const n1 = nrm(t), n2 = nrm(t + 3);
      if (!(Math.abs(n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]) > 1 - 1e-6)) continue;
      quads++;
      assert.ok(Math.abs(uv[a * 2] - uv[b * 2]) < 1e-4 && Math.abs(uv[a * 2 + 1] - uv[b * 2 + 1]) < 1e-4, `${name}: a quad at triangle ${t} on two planes`);
    }
  }
  assert.ok(quads > 50000, `${quads} quads`);
  // a wall at 45 degrees: its two halves' own crosses round x and z apart, the normal's plane both
  const s = Math.SQRT1_2, wall = { positions: new Float32Array([0, 0, 0, 3 * s, 0, -3 * s, 3 * s, 2, -3 * s, 0, 0, 0, 3 * s, 2, -3 * s, 0, 2, 0]), indices: new Uint32Array([0, 1, 2, 3, 4, 5]) };
  const map = (n) => vanillaTexels({ ...wall, normals: new Float32Array(Array(6).fill(n).flat()) }).uvs;
  const toZ = map([s, 0, s + 1e-4]), toX = map([s + 1e-4, 0, s]);
  assert.deepEqual([toZ[4], toZ[5]], [toZ[8], toZ[9]], 'the shared corner one way');
  // PIN MOVED (TS5): read from its first corner - each coordinate counts from a whole number of pictures nearest the model's middle
  assert.ok(Math.abs((toZ[2] - toZ[0]) * 1.6 - 3 * s) < 1e-4 && Math.abs((toX[2] - toX[0]) * 1.6 + 3 * s) < 1e-4, 'its normal\'s plane, never its rounding\'s');
});

// ── C15 AND THE CAPITALS' POINTS ────────────────────────────────

test('AUDIT TESA II C15: a capital\'s point is its TAMRIEL1 city\'s, read from its one home; the plans\' measures in BLOCK_M, no block\'s multiple written out', () => {
  for (const cap of CAPITALS) assert.deepEqual(cap.at, CITIES.find((c) => c.capital && c.name === cap.name).at, cap.key);
  for (const f of ['src/world/capitalPlans.js', 'src/world/tamrielCapitals.js']) {
    const code = read(f).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    assert.doesNotMatch(code, /(?<![\d.])(102\.4|204\.8|153\.6|307\.2|409\.6|51\.2)(?![\d])/, `${f}: a block's multiple written out`);
  }
});

// ── LANE R'S R2: A GATE THE ROADS CAN REACH ─────────────────────

test('AUDIT TESA II (lane R\'s R2): a capital\'s gate is the first pixel out from its side the roads walk with a neighbour they walk - none past GATE_REACH, and a capital with no gate the roads can reach said once', () => {
  const k = CAPITALS.findIndex((c) => c.key === 'mournhold'), [at] = capitalSpanPixels(k), base = (side) => [at.x + GATE_STEPS[side][0], at.y + GATE_STEPS[side][1]];
  const open = () => true;
  assert.deepEqual(capitalGates(k, { walkable: open }).map((g) => [g.side, g.x, g.y]), CAPITALS[k].gates.map((s) => [s, ...base(s)]));
  // the side's own pixel water: the next out
  const [nx, ny] = base('N'), wet = (x, y) => !(x === nx && y === ny);
  const north = (walkable) => { const g = capitalGates(k, { walkable }).find((q) => q.side === 'N'); return g && [g.x, g.y]; };
  assert.deepEqual(north(wet), [nx, ny - 1]);
  // an islet: walkable, no walkable neighbour - passed over
  const islet = (x, y) => (x === nx && y === ny) || (x === nx && y <= ny - 2);
  assert.deepEqual(north(islet), [nx, ny - 2]);
  // none within reach: no gate that side
  const far = (x, y) => !(x === nx && y > ny - GATE_REACH);
  assert.equal(north(far), undefined);
  // none at all: none, and said once
  const said = [], warn = console.warn;
  console.warn = (m) => said.push(String(m));
  try { capitalGates(k, { walkable: () => false }); capitalGates(k, { walkable: () => false }); } finally { console.warn = warn; }
  assert.equal(said.filter((m) => m.includes('Mournhold') && m.includes('no gate the roads can reach')).length, 1);
});

// ── WITH ARENA2: EVERY CAPITAL ON THE FREEWARE'S GROUND ─────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK', 'BLOCKS.BSA'].every((f) => existsSync(join(ARENA2, f)));
let _world = null;
async function world() {
  if (_world) return _world;
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { groundWoods, groundMaps } = await import('../../src/world/tamriel/tamrielGround.js');
  const wd = await import('../../src/formats/worldData/worldDataReplacement.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const blocks = new BlocksFile(); assert.ok(blocks.load(bytes('BLOCKS.BSA')));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  groundMaps(maps);
  wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
  installCapitals({ addTextures: () => 0 });
  _world = { trace, maps, rows, blocks, ground: groundWoods(woods) };
  return _world;
}
const onTrace = async () => { const w = await world(); setTamrielTrace(w.trace); setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 }); return w; };

test('AUDIT TESA II C1/C2 with ARENA2: every capital meets the land round it level - its seams to its neighbours and between its own slices 0.00 m on the drawn samples, DFU\'s cities\' tolerance; its rect Daggerfall\'s 11..116 on its outer sides; a shore capital at the sea\'s floor, the sea along its water\'s sides', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { rows, blocks, maps, ground } = await onTrace();
  const tc = await import('../../src/world/tamrielCapitals.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { STREAMING_TERRAIN_SCALE } = await import('../../src/world/terrain/terrainSampler.js');
  const base = tc.capitalBase(rows, isMainStoryDungeon), names = tc.cityBlockNames(rows), Dm = 129, M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
  const memo = new Map();
  const gen = (px, py) => {
    const key = `${px},${py}`;
    if (!memo.has(key)) {
      const at = tc.capitalOnPixel(px, py), tm = new Uint8Array(16384);
      let loc = null, rect = null;
      if (at) { loc = tc.synthesizeCapitalLocation(at, { base, names, blockOf: (n) => blocks.getBlockByName(n), px, py }); rect = setLocationTiles(loc, maps, blocks, tm); }
      memo.set(key, { rect, ...generatePixelTerrain({ woods: ground, px, py, tilemap: tm, locationRect: rect, hasLocation: !!loc, climateType: 0, flattenAt: loc?.capital?.flattenAt ?? null }) });
    }
    return memo.get(key);
  };
  const S = (r, x, y) => r.samples[y + x * Dm];
  const edge = (r, side) => Array.from({ length: Dm }, (_, i) => (side === 'W' ? S(r, 0, i) : side === 'E' ? S(r, 128, i) : side === 'N' ? S(r, i, 128) : S(r, i, 0)));
  const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
  CAPITALS.forEach((cap, k) => {
    const pix = capitalSpanPixels(k), mine = new Set(pix.map((p) => `${p.x},${p.y}`));
    assert.ok(pix.length, `${cap.key} stands`);
    let outer = 0, inner = 0;
    for (const p of pix) {
      const r = gen(p.x, p.y);
      for (const side of ['N', 'S', 'W', 'E']) {
        const [dx, dy] = GATE_STEPS[side], a = edge(r, side), b = edge(gen(p.x + dx, p.y + dy), OPP[side]);
        const w = Math.max(...a.map((v, i) => Math.abs(v - b[i]))) * M, own = mine.has(`${p.x + dx},${p.y + dy}`);
        if (own) inner = Math.max(inner, w); else outer = Math.max(outer, w);
        // DFU's rect on an outer side: its city's ground ends CAPITAL_RIM_TILES in
        const lim = { W: r.rect.xMin, E: 128 - r.rect.xMax, N: 128 - r.rect.yMax, S: r.rect.yMin }[side];
        if (!own) assert.equal(lim, CAPITAL_RIM_TILES, `${cap.key} ${p.x},${p.y}: its ${side} rect`);
      }
    }
    assert.ok(outer < 0.01 && inner < 0.01, `${cap.key}: its seams ${outer.toFixed(3)} m to its neighbours, ${inner.toFixed(3)} m inside`);
    const flat = gen(pix[0].x, pix[0].y).avg * M;
    if (cap.shore) assert.ok(Math.abs(flat - SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE) < 0.01, `${cap.key} at ${flat.toFixed(2)} m, the sea's floor`);
    // a water side: its shared edge the sea's height along most of it, its rim's tiles water out to it
    for (const side of cap.sea ?? []) {
      let sea = 0, all = 0, wet = 0, lanes = 0;
      for (const p of pix) {
        const [dx, dy] = GATE_STEPS[side];
        if (mine.has(`${p.x + dx},${p.y + dy}`)) continue;
        const r = gen(p.x, p.y), rec = (x, y) => r.tilemapBytes[x + y * 128] >> 2;
        for (const v of edge(r, side)) { all++; if (Math.abs(v * M - SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE) < 0.01) sea++; }
        for (let i = 0; i < 128; i++) {
          lanes++;
          let water = true;
          for (let t = 0; t < CAPITAL_RIM_TILES + 1 && water; t++) { const [x, y] = side === 'N' ? [i, 127 - t] : side === 'S' ? [i, t] : side === 'W' ? [t, i] : [127 - t, i]; water = rec(x, y) === 0; }
          if (water) wet++;
        }
      }
      assert.ok(sea / all > 0.5 && wet / lanes > 0.45, `${cap.key} ${side}: ${sea}/${all} of its edge at the sea's height, ${wet}/${lanes} lanes water to it`);
    }
  });
});

test('AUDIT TESA II C10/R2 with ARENA2: a gate\'s lane is clear - no building of Daggerfall\'s blocks within 9 m across Solitude\'s main gate, Alinor\'s and Torval\'s north gates and Alinor\'s bridges\' north ends; and every capital has a gate the roads can reach, each the first such pixel out from its side', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { rows, blocks } = await onTrace();
  const tc = await import('../../src/world/tamrielCapitals.js');
  const { tamrielHeightByte } = await import('../../src/world/tamriel/tamrielGround.js');
  const { WATER_BYTE } = await import('../../src/world/roadsProducer.js');
  const { hash32 } = await import('../../src/world/spawnedDungeons.js');
  const names = tc.cityBlockNames(rows);
  const building = (cap, k, X, Z) => {   // a classic block's automap byte at a plan point (capitalBlockNames' law)
    const cx = Math.floor(X / BLOCK_M), r = Math.floor(Z / BLOCK_M), cell = cap.cellAt ? cap.cellAt(r, cx) : cap.plan[r]?.[cx];   // PIN MOVED (IC-GRAND): the Imperial City's plan a law
    if (!cell || cell === 'L' || cell === 'G' || cell === 'O' || (cap.family ? !/^[A-Z]{4}$/.test(cell) : Object.hasOwn(cap.blocks, cell))) return 0;
    const list = [cell, 'RESI', 'GENR'].map((kd) => (cap.shore ? names : tc.dryKinds(names, (n) => blocks.getBlockByName(n))).get(kd)).find((l) => l?.length);
    const b = blocks.getBlockByName(list[hash32(tc.CAPITAL_SALT, k, cx, r) % list.length]), am = b.rmbBlock.fldHeader.autoMapData;
    return am[(63 - Math.floor(((r + 1) * BLOCK_M - Z) / 1.6)) * 64 + Math.floor((X - cx * BLOCK_M) / 1.6)];
  };
  const lane = (key, x, z, uz, w = 10) => {
    const k = CAPITALS.findIndex((c) => c.key === key), cap = CAPITALS[k];
    for (let s = -w / 2; s <= w / 2 + 1e-9; s += 1) for (let t = 0; t <= 9; t += 0.4) { const [X, Z] = planAt(cap, x + s, z + uz * t); assert.equal(building(cap, k, X, Z), 0, `${key} at ${x}, ${z}: a building ${t.toFixed(1)} m in, ${s} m across`); }
  };
  lane('solitude', SOLITUDE.wall.southGate, SOLITUDE.wall.south, -1);
  lane('alinor', ALINOR.wall.northGate, ALINOR.wall.north, 1);
  lane('torval', TORVAL.wall.northGate, TORVAL.wall.north, 1);
  for (const x of ALINOR.bridges) lane('alinor', x, ALINOR.river.z0, -1);
  // the roads' ends: on the ground they walk, the first such out from the side
  const walk = (x, y) => tamrielHeightByte(x, y) > WATER_BYTE && !tc.capitalOnPixel(x, y);
  const ok = (x, y) => walk(x, y) && Object.values(GATE_STEPS).some(([dx, dy]) => walk(x + dx, y + dy));
  CAPITALS.forEach((cap, k) => {
    const gates = capitalGates(k), span = capitalSpanPixels(k);
    assert.ok(gates.length >= 1, `${cap.key}: a gate the roads reach`);
    for (const g of gates) {
      assert.ok(ok(g.x, g.y), `${cap.key} ${g.side} at ${g.x},${g.y}`);
      for (let t = 1; t <= GATE_REACH; t++) {
        const x = g.x + g.into[0] * t, y = g.y + g.into[1] * t;
        if (span.some((p) => p.x === x && p.y === y)) break;
        assert.ok(!ok(x, y), `${cap.key} ${g.side}: ${x},${y} the first`);
      }
    }
  });
});
