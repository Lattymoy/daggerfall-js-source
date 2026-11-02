// BREATHTAKER 2/3 and CYRODIIL-WATERS (2026-10-26, bible/03-World/Tamriel.md; KPbICA's spec, forwarded by the owner):
// the land past the Bay keeps the heightmap's ranges past the Bay's 7-bit top (continentLift, under LANDFORM_CEILING),
// wears its zone's own landforms below the heightmap's grain (world/tamriel/tamrielLandforms.js) over a smooth large map
// (tamrielGround.js tamrielLargeMap), and Cyrodiil's rivers and lakes are carved into it, with the law every other
// system asks of them (world/tamriel/tamrielWaters.js). The Bay is not moved by a byte. Where ARENA2_PATH names the data,
// the waters are held on the freeware's own trace: every river runs down to its water, no capital and no place past the
// Bay is reached, the queries answer what the carve and the paint do, and the ground meets itself at every pixel's edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  continentLift, byteBeyond, continentPixel, CONTINENT_LIFT, CONTINENT_CEILING, LANDFORM_CEILING, reliefLift, nodeGround, LANDFORM_KNEE, LANDFORM_FLOOR,
} from '../../src/world/landforms.js';
import {
  FAMILIES, TAMRIEL_LANDFORM_DIALS, TAMRIEL_TOP, topClip, ZONE_LANDS, CLIMATE_LANDS, zonePalette, landformLattice, tamrielLandformAt,
  LANDFORM_SHAPES, LANDFORM_CENTRES, continentShare, NODE,
} from '../../src/world/tamriel/tamrielLandforms.js';
import { tamrielLargeMap, largeOfByte, SEAM_PX, bayEdgeDistance, tamrielClimateAt } from '../../src/world/tamriel/tamrielGround.js';
import { setTamrielTrace as installTrace, tamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit as installFit } from '../../src/world/tamriel/tamrielFrame.js';
import { DIR } from '../../src/world/road/roadNetwork.js';
import { veilhaven, inEtherLaw } from '../../src/world/ethericSea.js';
import { BIOME_BY_KEY } from '../../src/world/tamriel/tamrielBiomes.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION, BASE_HEIGHT_SCALE, HEIGHTMAP_DIMENSION, NOISE_MAP_SCALE } from '../../src/world/terrain/terrainSampler.js';
import { MAP_HEIGHT, MAP_WIDTH } from '../../src/formats/woodsFile.js';

const LOW_TOP = 127 * BASE_HEIGHT_SCALE;

test('BREATHTAKER2: the lift goes on past the 7-bit top at CONTINENT_LIFT.gain to its top and is level after, nothing under byte 127; the continent\'s ceiling (the lift, its continuation, TAMRIEL_TOP) under LANDFORM_CEILING; the Bay\'s byte heights (beyond 0) the old law to the bit (mutants: the gain, the top, the 7-bit knee, the continuation on the Bay)', () => {
  assert.equal(continentLift(LOW_TOP), 0);
  assert.equal(continentLift(LOW_TOP - 40), 0);
  assert.equal(continentLift(0), 0);
  assert.equal(continentLift(150 * BASE_HEIGHT_SCALE), CONTINENT_LIFT.gain * (150 * BASE_HEIGHT_SCALE - LOW_TOP));
  assert.equal(continentLift(CONTINENT_LIFT.top), CONTINENT_LIFT.gain * (CONTINENT_LIFT.top - LOW_TOP));
  assert.equal(continentLift(255 * BASE_HEIGHT_SCALE), continentLift(CONTINENT_LIFT.top), 'level past its top');
  assert.equal(CONTINENT_LIFT.top, 180 * BASE_HEIGHT_SCALE, 'the relief\'s ceiling byte (TAMRIEL-RELIEF CEILING_BYTE)');
  assert.equal(CONTINENT_CEILING, MAX_TERRAIN_HEIGHT + reliefLift(LOW_TOP) + continentLift(CONTINENT_LIFT.top) + TAMRIEL_TOP);
  assert.ok(CONTINENT_CEILING <= LANDFORM_CEILING, `${CONTINENT_CEILING} under ${LANDFORM_CEILING}`);
  // PIN MOVED (RELIEF-PEAKS): a byte's height is its node's ground (world/landforms.js nodeGround) - the large map by its
  // law with the small term, held as the kernel holds them, where reliefByteHeight left the large map out
  for (let b = 0; b < 256; b++) {
    const low = b * BASE_HEIGHT_SCALE, held = Math.min(MAX_TERRAIN_HEIGHT, Math.max(low + largeOfByte(b) * NOISE_MAP_SCALE, SCALED_OCEAN_ELEVATION));
    assert.equal(nodeGround(b), held + reliefLift(low), `byte ${b}: the Bay's law`);
    assert.equal(nodeGround(b, 1, 0), nodeGround(b));
    assert.ok(Math.abs(nodeGround(b, 1, 1) - nodeGround(b, 1, 0) - continentLift(low)) < 1e-9, `byte ${b}: the continuation past the seam`);
  }
});

test('BREATHTAKER3: the continent\'s share of a sample - 0 on the Bay and in its seam band (SEAM_PX past its edge), rising to 1 over the ramp, never falling outward, the Chebyshev distance past the map\'s rectangle; the Eltheric Ocean\'s box none of it (mutants: the seam, the ramp, the distance, the Eltheric isles the continent\'s)', () => {
  const span = HEIGHTMAP_DIMENSION - 1, H = MAP_HEIGHT, W = MAP_WIDTH, ramp = TAMRIEL_LANDFORM_DIALS.ramp;
  const at = (bx, by) => continentShare(bx * span, (H + 1 - by) * span, span, H, W, SEAM_PX);   // a Bay point's sample
  assert.equal(at(500, 250), 0, 'the Bay');
  assert.equal(at(W + SEAM_PX, 250), 0, 'the seam band\'s far edge');
  assert.equal(at(-SEAM_PX, 250), 0);
  assert.equal(at(500, H + SEAM_PX), 0);
  assert.equal(at(500, -SEAM_PX), 0);
  assert.equal(at(W + SEAM_PX + ramp, 250), 1, 'whole a ramp past it');
  assert.equal(at(-SEAM_PX - ramp - 5, -SEAM_PX - ramp - 9), 1);
  for (const [x, y] of [[-SEAM_PX - ramp, 250], [500, -SEAM_PX - ramp], [500, H + SEAM_PX + ramp], [W + SEAM_PX + ramp, 250]]) assert.equal(at(x, y), 1, `every side (${x}, ${y})`);
  assert.ok(Math.abs(at(W + SEAM_PX + ramp / 2, 250) - 0.5) < 1e-12, 'half way, half');
  assert.equal(at(W + SEAM_PX + ramp / 2, 250), at(W + 3, H + SEAM_PX + ramp / 2), 'the larger of the two distances (a corner)');
  // a byte read off the map takes its node's share (the kernel stands pixel (x, y)'s byte at sample ((x + 1) * span, (H - y) * span))
  assert.equal(byteBeyond(500, 250), 0);
  assert.equal(byteBeyond(W + SEAM_PX - 1, 250), 0, 'the seam band\'s last byte the Bay\'s');
  assert.equal(byteBeyond(W + SEAM_PX + ramp, 250), 1);
  assert.equal(byteBeyond(-SEAM_PX - ramp - 1, 250), 1);
  for (const [x, y] of [[W + 4, 250], [-6, -3], [300, H + 5]]) assert.equal(byteBeyond(x, y), continentShare((x + 1) * span, (H - y) * span, span, H, W, SEAM_PX));
  // the Eltheric Ocean's box is no continent's: its isles keep their own climates' hills (AUDIT CAPTAIN'S SEA G3)
  const v = veilhaven();
  assert.ok(inEtherLaw(v.px, v.py) && bayEdgeDistance(v.px, v.py) > SEAM_PX + ramp, 'an isle past the map');
  assert.deepEqual([continentPixel(v.px, v.py), byteBeyond(v.px, v.py)], [false, 0]);
  assert.deepEqual([continentPixel(W + SEAM_PX, 250), continentPixel(W - 1 + SEAM_PX, 250), continentPixel(500, 250)], [true, false, false], 'the seam band (pixels SEAM_PX past the last of the Bay\'s) the Bay\'s');
  let last = 0;
  for (let d = 0; d <= SEAM_PX + ramp + 2; d += 0.25) { const s = at(W + d, 250); assert.ok(s >= last, `never falls (${d})`); last = s; }
});

test('BREATHTAKER3: the soft clip - itself to `clip` of TAMRIEL_TOP, then easing toward it and never past, odd and never falling (the bound the ceiling counts) (mutants: the knee, the ease)', () => {
  const T = TAMRIEL_TOP, k = TAMRIEL_LANDFORM_DIALS.clip * T;
  for (const v of [0, 1, -1, k * 0.5, k, -k]) assert.equal(topClip(v), v);
  let last = -Infinity;
  for (let v = -5 * T; v <= 5 * T; v += 0.37) {
    const c = topClip(v);
    assert.ok(Math.abs(c) < T, `${v} -> ${c}`);
    assert.ok(c >= last, 'never falls');
    assert.equal(topClip(-v), -c);
    last = c;
  }
  assert.ok(topClip(1e9) < T && topClip(1e9) > T * 0.999);
  assert.ok(Math.abs(topClip(k + 1e-6) - (k + 1e-6)) < 1e-9, 'its slope whole at the knee');
});

test('BREATHTAKER3: each shape\'s CENTRE its own mean over its field (60,000 world points, every frame) within 0.02 - the mix stands on the land\'s own mean, so the heightmap\'s macro is kept (mutants: a shape\'s offset, a centre)', () => {
  const S = LANDFORM_SHAPES, D = TAMRIEL_LANDFORM_DIALS;
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const N = 60000, sum = {};
  const add = (k, v) => { sum[k] = (sum[k] ?? 0) + v; };
  for (let i = 0; i < N; i++) {
    const x = (rnd() - 0.5) * 4e6, y = (rnd() - 0.5) * 4e6, k = Math.floor(rnd() * 6);
    add('ridge', S.ridgeIn(k, x, y, D.ridge.across, D.ridge.stretch, false));
    add('foot', S.ridgeIn(k, x, y, D.foot.across, D.foot.stretch, true));
    add('mesa', S.mesas(x, y)); add('dune', S.dunes(x, y, D.dune.spacing)); add('drum', S.drumIn(k, x, y, D.drum.cell));
    add('karst', S.cones(x, y, D.karst.cell) - 0.5 * S.knobs(x, y, D.karst.cell * 0.6, 0.2, 1, 151));
    add('outcrop', S.knobs(x, y, D.outcrop.cell, D.outcrop.fill, 0.55, 307, 0, 0.35)); add('gully', S.gullyIn(k, x, y, D.gully.across, D.gully.stretch));
    add('rolling', S.rolling(x, y)); add('marsh', S.marsh(x, y)); add('broken', S.broken(x, y));
  }
  for (const [k, c] of Object.entries(LANDFORM_CENTRES)) assert.ok(Math.abs(sum[k] / N - c) < 0.02, `${k}: mean ${(sum[k] / N).toFixed(4)} against ${c}`);
});

/** A ground of the module's own for the pins: a macro rising east (a flank) and north, every climate in bands, no zones. */
const G = {
  mapH: MAP_HEIGHT, knee: LANDFORM_KNEE,
  height: (x, y) => 300 + 9 * ((x % 40 + 40) % 40) + 4 * ((y % 30 + 30) % 30),
  zoneAt: () => null,
  climateAt: (x) => [CLIMATES.Woodlands, CLIMATES.Mountain, CLIMATES.Desert, CLIMATES.Desert2, CLIMATES.Rainforest, CLIMATES.Swamp, CLIMATES.HauntedWoodlands, CLIMATES.MountainWoods][((x >> 2) % 8 + 8) % 8],
};

test('BREATHTAKER3: the landforms never stand over TAMRIEL_TOP nor over the land\'s own height above the knee (a hill never taller than the land under it), nothing at or under the knee, every value within the dale it reports (the waters\' valley reads it) (mutants: the ease, the bound)', () => {
  const span = HEIGHTMAP_DIMENSION - 1, out = new Float64Array(1);
  let any = 0;
  for (const [px, py] of [[-200, 40], [-161, 300], [-133, 444], [-90, 71]]) {
    const ox = px * span, oy = (MAP_HEIGHT - py) * span, L = landformLattice(G, ox, oy, span, span);
    for (let i = 0; i < 600; i++) {
      const gx = ox + ((i * 37) % 129), gy = oy + ((i * 91) % 129);
      for (const macro of [LANDFORM_KNEE - 5, LANDFORM_KNEE, LANDFORM_KNEE + 3, LANDFORM_KNEE + 40, 700, 2400]) {
        const v = tamrielLandformAt(L, gx, gy, macro, out), e = macro - LANDFORM_KNEE;
        if (e <= 0) { assert.equal(v, 0); assert.equal(out[0], 0); continue; }
        assert.ok(Math.abs(v) <= TAMRIEL_TOP && Math.abs(v) < e, `${v} at ${gx},${gy} over ${e}`);
        assert.ok(Math.abs(v) <= out[0] + 1e-9, `within its dale ${out[0]}`);
        if (Math.abs(v) > 1) any++;
      }
    }
  }
  assert.ok(any > 2000, `the landforms stand (${any})`);
});

test('BREATHTAKER3: a sample\'s landform is one function of its world position - the same number, bit for bit, from a lattice over its own pixel, over its neighbour\'s (a shared edge and a ghost row) and over a box far off; deterministic (mutants: the fine table\'s placement, its margin)', () => {
  const span = HEIGHTMAP_DIMENSION - 1, px = -150, py = 210, ox = px * span, oy = (MAP_HEIGHT - py) * span;
  const own = landformLattice(G, ox, oy, span, span), east = landformLattice(G, ox + span, oy, span, span), north = landformLattice(G, ox, oy + span, span, span);
  const far = landformLattice(G, ox + 40 * span, oy - 17 * span, span, span);
  for (let t = -1; t <= 129; t++) {
    for (const macro of [500, 1600]) {
      const edgeE = [ox + span, oy + t], ghostW = [ox + span - 1, oy + t], edgeN = [ox + t, oy + span], ghostS = [ox + t, oy + span - 1];
      for (const [gx, gy] of [edgeE, ghostW]) {
        const a = tamrielLandformAt(own, gx, gy, macro), b = tamrielLandformAt(east, gx, gy, macro), c = tamrielLandformAt(far, gx, gy, macro);
        assert.ok(Object.is(a, b) && Object.is(a, c), `east edge ${gx - ox},${gy - oy}: ${a} ${b} ${c}`);
      }
      for (const [gx, gy] of [edgeN, ghostS]) {
        const a = tamrielLandformAt(own, gx, gy, macro), b = tamrielLandformAt(north, gx, gy, macro);
        assert.ok(Object.is(a, b), `north edge ${gx - ox},${gy - oy}: ${a} ${b}`);
      }
    }
  }
  const again = landformLattice(G, ox, oy, span, span);
  for (let i = 0; i < 200; i++) { const gx = ox + (i * 13) % 129, gy = oy + (i * 29) % 129; assert.ok(Object.is(tamrielLandformAt(own, gx, gy, 900), tamrielLandformAt(again, gx, gy, 900))); }
  assert.equal(NODE, 16);
});

test('BREATHTAKER3: every zone the landforms name is one of tamrielBiomes.js\'s, every palette names only FAMILIES and its three tilts; a zone not named and the land with no zone wear their climate\'s (mutants: a palette lost)', () => {
  const tilts = new Set(['dry', 'north', 'steps']), fam = new Set(FAMILIES);
  for (const [key, spec] of Object.entries(ZONE_LANDS)) {
    assert.ok(BIOME_BY_KEY.has(key), `${key} is a zone`);
    for (const k of Object.keys(spec)) assert.ok(fam.has(k) || tilts.has(k), `${key}.${k}`);
  }
  for (const spec of Object.values(CLIMATE_LANDS)) for (const k of Object.keys(spec)) assert.ok(fam.has(k) || tilts.has(k));
  const sum = (p) => p.slice(0, FAMILIES.length).reduce((a, v) => a + v, 0);
  for (const key of Object.keys(ZONE_LANDS)) assert.ok(Math.abs(sum(zonePalette({ key, climate: 0 }, 0)) - 1) < 1e-12);
  assert.deepEqual([...zonePalette({ key: 'nowhere', climate: CLIMATES.Swamp }, CLIMATES.Desert)], [...zonePalette(null, CLIMATES.Swamp)], 'an unnamed zone its own climate');
  assert.equal(zonePalette(null, CLIMATES.Swamp)[FAMILIES.indexOf('marsh')], 1);
  assert.equal(zonePalette({ key: 'skyrimPeaks', climate: 0 }, 0)[FAMILIES.indexOf('ridge')], 1);
});

// PIN MOVED (RELIEF-PEAKS, test/world/reliefpeaks.test.js): the large map past the Bay is no swell about a mean of 4.5 -
// a third of the ground's height left out of every range - but WOODS.WLD's own law of the small heightmap, read where the
// kernel reads each cell (tamrielGround.js largeOfByte, tamrielLargeMap). It stays kept and deterministic here.
test('BREATHTAKER3: the large map past the Bay is deterministic and kept, and within the law\'s own range', () => {
  assert.equal(tamrielLargeMap(1400, -80), tamrielLargeMap(1400, -80), 'kept');
  assert.deepEqual(tamrielLargeMap(1400, -80).map((c) => [...c]), tamrielLargeMap(1400, -80).map((c) => [...c]));
  let top = 0;
  for (let b = 0; b < 256; b++) top = Math.max(top, largeOfByte(b));
  for (let cy = -80; cy < -60; cy++) for (let cx = 1400; cx < 1420; cx++) for (const col of tamrielLargeMap(cx, cy)) for (const v of col) assert.ok(v >= 0 && v <= Math.round(top), `${cx},${cy}: ${v}`);
});

// PIN MOVED (SMOOTH-LAND, test/world/smoothland.test.js): CYRODIIL-SHORES' own smooth shore for Cyrodiil's lakes
// (tamrielGround.js lakeShores, lakeShoreAt) is folded into the land's one smooth law - every coast past the Bay, a
// lake's as the sea's, every province's border - and pinned there.

// ── WITH ARENA2: THE WATERS ON THE FREEWARE'S TRACE ──────────────

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const skip = HAVE ? false : 'ARENA2_PATH not set';
let _world = null;
async function world() {
  if (_world) return _world;
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { groundWoods, groundMaps, dropGroundCache } = await import('../../src/world/tamriel/tamrielGround.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const bay = new WoodsFile(); bay.load(bytes('WOODS.WLD'));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (audittesa2c_capitals.test.js's)
  setTamrielTrace(trace);
  dropGroundCache();
  groundMaps(maps);
  const W = await import('../../src/world/tamriel/tamrielWaters.js');
  _world = { trace, maps, woods: groundWoods(bay), W, law: W.tamrielWaters() };
  return _world;
}
const mid = (r) => { const i = r.n >> 1; return [r.pts[2 * i], r.pts[2 * i + 1], i]; };

test('CYRODIIL-WATERS with ARENA2: every river runs down to its water - its surface never rising from source to mouth, never under the floor; a lake\'s outflow from its level; a tributary\'s mouth on its river\'s line and never under it; a river into the trace\'s water ends on it (mutants: the running minimum, the outflow\'s start, the tributary\'s join, the floor)', { skip }, async () => {
  const { law, woods, W } = await world();
  assert.ok(law, 'the law compiles on the trace');
  assert.deepEqual(law.rivers.map((r) => r.key), W.CARVED_RIVERS.map((r) => r.key));
  assert.deepEqual(law.lakes.map((l) => l.key), W.LAKES.map((l) => l.key));
  const lakeOf = new Map(law.lakes.map((l) => [l.key, l])), riverOf = new Map(law.rivers.map((r) => [r.key, r]));
  for (const l of law.lakes) assert.ok(l.level >= LANDFORM_FLOOR + 1 && l.level < 2000, `${l.key} level ${l.level}`);
  for (const r of law.rivers) {
    for (let i = 1; i < r.n; i++) assert.ok(r.level[i] <= r.level[i - 1] + 1e-3, `${r.key} rises at ${i}: ${r.level[i - 1]} -> ${r.level[i]}`);
    for (let i = 0; i < r.n; i++) assert.ok(r.level[i] >= LANDFORM_FLOOR - 1e-3, `${r.key} under the floor at ${i}`);
    for (let i = 1; i < r.n; i++) assert.ok(r.width[i] >= r.width[i - 1] - 1e-3, `${r.key} narrows at ${i}`);
    if (r.from) assert.ok(r.level[0] <= lakeOf.get(r.from).level + 1e-3, `${r.key} from ${r.from}'s level`);
    const mx = r.pts[2 * r.n - 2], my = r.pts[2 * r.n - 1];
    if (r.into === 'water') {
      let wet = false;
      for (let dy = -1; dy <= 1 && !wet; dy++) for (let dx = -1; dx <= 1 && !wet; dx++) wet = woods.getHeightMapValue(Math.floor(mx) + dx, Math.floor(my) + dy) === 0;
      assert.ok(wet, `${r.key} ends on the trace's water`);
    } else {
      const main = riverOf.get(r.into);
      let best = Infinity, lv = 0;
      for (let i = 0; i < main.n; i++) { const d = Math.hypot(main.pts[2 * i] - mx, main.pts[2 * i + 1] - my); if (d < best) { best = d; lv = main.level[i]; } }
      assert.ok(best * 819.2 < main.width[0] + 400, `${r.key} joins ${r.into} (${(best * 819.2).toFixed(0)} m)`);
      assert.ok(Math.abs(r.level[r.n - 1] - lv) < 0.5, `${r.key} meets ${r.into} at its surface (${r.level[r.n - 1]} against ${lv})`);
      for (let i = 0; i < r.n; i++) assert.ok(r.level[i] >= lv - 0.5, `${r.key} never under ${r.into}'s surface where it joins`);
    }
  }
});

test('CYRODIIL-WATERS with ARENA2: no water reaches a capital - no slice of one, nor a pixel round it (the Imperial City\'s 25 x 25 - PIN MOVED, IC-GRAND; TS5\'s 7 x 7 - on its isle in Lake Rumare - its lake world/imperialCity.js IMPERIAL.lake past its isle, the trace\'s own water round that) - nor a place past the Bay\'s pixel (mutants: a river laid through a town)', { skip }, async () => {
  const { law } = await world();
  const TC = await import('../../src/world/tamrielCapitals.js');
  const AP = await import('../../src/world/arenaPlaces.js');
  const { IMPERIAL } = await import('../../src/world/imperialCity.js');
  const touched = (x, y) => law.index.has(x * 65536 + y) || law.lakeIndex.has(x * 65536 + y);
  for (const cap of TC.CAPITALS) {
    const p = TC.capitalPixel(cap);
    if (!p) continue;
    const D = TC.capitalDims(cap);
    for (let sy = -1; sy <= D.h; sy++) for (let sx = -1; sx <= D.w; sx++) assert.ok(!touched(p.px + sx - D.mx, p.py + sy - D.my), `${cap.key} slice ${sx},${sy}`);
  }
  const ic = TC.capitalPixel(TC.CAPITALS.find((c) => c.key === 'imperial-city'));
  const cx = ic.px + 0.5, cy = ic.py + 0.5, lakeR = IMPERIAL.lake / 819.2;
  for (const r of law.rivers) {
    for (let i = 0; i < r.n; i++) {
      const d = Math.hypot(r.pts[2 * i] - cx, r.pts[2 * i + 1] - cy) * 819.2 - r.width[i] / 2 - Math.min(1500, Math.max(220, 9 * r.width[i]));
      assert.ok(d > IMPERIAL.lake, `${r.key}'s valley ${d.toFixed(0)} m from the city's middle, inside its lake (${IMPERIAL.lake} m)`);
    }
  }
  // PIN MOVED (IC-GRAND, bible/03-World/Arena-Provinces.md IC-GRAND): the span's half its own - 12.5 pixels at twenty-five
  // (TS5's 3.5 at seven), the lake's far shore 10 km (12.2 pixels)
  assert.ok(lakeR < TC.capitalDims(TC.CAPITALS.find((c) => c.key === 'imperial-city')).w / 2, 'the city\'s lake inside its span');
  let n = 0;
  for (const key of AP.arenaPixels().byPixel.keys()) { const [x, y] = key.split(',').map(Number); assert.ok(!touched(x, y), `a place's pixel ${key}`); n++; }
  assert.ok(n > 200, `the places stand (${n})`);
  // PIN MOVED (SMOOTH-LAND, test/world/smoothland.test.js; CYRODIIL-SHORES folded into it): a place's pixel and a
  // capital's (and a pixel round one) stand on the ground's land exactly where the land's smooth law has land; a pixel the
  // law gave the land from the picture's water (Lake Rumare's and the Niben's shores) wears the land's climate, never the
  // sea's
  const { bayToPicture } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { provinceKeyAt } = await import('../../src/world/tamriel/tamrielLand.js');
  const { woods, trace } = await world();
  const lawLand = (x, y) => provinceKeyAt(...bayToPicture(x + 0.5, y + 0.5)) !== null;
  const picLand = (x, y) => { const [px, py] = bayToPicture(x + 0.5, y + 0.5); return !!trace.land[Math.floor(py) * trace.w + Math.floor(px)]; };
  const apart = (x, y) => (woods.getHeightMapValue(x, y) > 0) !== lawLand(x, y);
  for (const key of AP.arenaPixels().byPixel.keys()) { const [x, y] = key.split(',').map(Number); assert.ok(!apart(x, y), `a place's pixel ${key} the law's side`); }
  // PIN MOVED (RUMARE-WATER, test/world/rumarewater.test.js): the Imperial City's span's three pixels the Waterfront's mouth
  // crosses the sea's at the map's scale (world/rumareWaters.js rumareMouthPixel), its province's land to the law - the
  // canal's water laid on into the city
  const { rumareMouthPixel } = await import('../../src/world/rumareWaters.js');
  for (const cap of TC.CAPITALS) {
    const p = TC.capitalPixel(cap), D = p && TC.capitalDims(cap);
    if (p) for (let sy = -1; sy <= D.h; sy++) for (let sx = -1; sx <= D.w; sx++) { const x = p.px + sx - D.mx, y = p.py + sy - D.my; assert.ok(!apart(x, y) || rumareMouthPixel(x, y), `${cap.key} the law's side`); }
  }
  let land = 0;
  for (let y = 560; y < 900; y++) {
    for (let x = 1900; x < 2400; x++) {
      if (!lawLand(x, y) || picLand(x, y) || woods.getHeightMapValue(x, y) === 0) continue;
      land++;
      assert.notEqual(tamrielClimateAt(x, y), CLIMATES.Ocean, `${x}, ${y}: a lake's new shore the land's climate`);
    }
  }
  assert.ok(land > 100, `Lake Rumare's and the Niben's shores the law gave the land (${land})`);
});

test('CYRODIIL-WATERS with ARENA2: the queries - waterAt a river\'s channel, a lake, the trace\'s sea with its name, dry land and the Bay null; riverAt within a valley; riverCrossings a straight run across a channel once, where it crosses; watersIn a box\'s rivers and lakes (mutants: the channel\'s half width, a crossing missed, the index)', { skip }, async () => {
  const { law, W } = await world();
  for (const r of law.rivers) {
    const [x, y, i] = mid(r);
    const w = W.waterAt(x, y);
    assert.equal(w?.kind, 'river', `${r.key} at its middle`);
    assert.ok(w.key === r.key || w.key !== null, r.key);
    const tx = r.pts[2 * i + 2] - r.pts[2 * i - 2], ty = r.pts[2 * i + 3] - r.pts[2 * i - 1], tl = Math.hypot(tx, ty), nx = -ty / tl, ny = tx / tl;
    const reach = 0.75 * r.width[i] / 819.2;
    const xs = W.riverCrossings(x - nx * reach, y - ny * reach, x + nx * reach, y + ny * reach).filter((c) => c.key === r.key);
    assert.equal(xs.length, 1, `${r.key} crossed once`);
    assert.ok(Math.abs(xs[0].t - 0.5) < 0.05 && Math.abs(xs[0].width - r.width[i]) < 1, `${r.key} crossed at its middle`);
    const beside = W.riverAt(x + nx * (r.width[i] / 2 + 50) / 819.2, y + ny * (r.width[i] / 2 + 50) / 819.2);
    assert.equal(beside?.key, r.key);
    assert.ok(Math.abs(beside.distance - r.width[i] / 2 - 50) < 5 && Math.abs(beside.half - r.width[i] / 2) < 0.5 && beside.valley >= 220, `${r.key} beside: ${beside.distance} ${beside.half} ${r.width[i]}`);
    assert.equal(W.waterAt(x + nx * (r.width[i] / 2 + 50) / 819.2, y + ny * (r.width[i] / 2 + 50) / 819.2)?.kind ?? null, null, `${r.key}: its bank dry`);
    assert.ok(W.watersIn(x - 0.1, y - 0.1, x + 0.1, y + 0.1).rivers.includes(r.key));
  }
  // the rivers on the map's pixels (the roads'): each dense point's pixel a river's, its compass the way the line runs there
  for (const r of law.rivers) {
    const [x, y, i] = mid(r), p = W.riverPixel(Math.floor(x), Math.floor(y));
    assert.ok(p && p.width >= r.width[i] - 1e-6 && p.level <= r.level[i] * 1.25 + 1e-6, `${r.key}'s pixel`);
    if (p.key === r.key) {
      const dx = r.pts[2 * i + 2] - r.pts[2 * i - 2], dy = r.pts[2 * i + 3] - r.pts[2 * i - 1], ang = Math.atan2(-dy, dx) * 180 / Math.PI;   // degrees anticlockwise from east, north up
      const want = [DIR.E, DIR.NE, DIR.N, DIR.NW, DIR.W, DIR.SW, DIR.S, DIR.SE][((Math.round(ang / 45) % 8) + 8) % 8];
      if (Math.abs(((ang % 45) + 45) % 45 - 22.5) > 2) assert.equal(p.dir, want, `${r.key}'s compass at its middle (${ang.toFixed(1)} degrees)`);
    }
    for (let q = 0; q < r.n; q += 7) assert.ok(W.riverPixel(Math.floor(r.pts[2 * q]), Math.floor(r.pts[2 * q + 1])), `${r.key}: its line's pixels`);
  }
  const [bx, by] = [Math.floor(mid(law.rivers[0])[0]) - 20, Math.floor(mid(law.rivers[0])[1]) - 20], raster = W.riverRaster(bx, by, 41, 41);
  let cells = 0;
  for (let j = 0; j < 41; j++) for (let i = 0; i < 41; i++) {
    const p = W.riverPixel(bx + i, by + j);
    assert.equal(raster.dir[j * 41 + i], p ? p.dir : 0);
    assert.equal(raster.width[j * 41 + i], p ? Math.round(p.width) : 0);
    if (p) cells++;
  }
  assert.ok(cells > 30, `the raster holds the Corbolo (${cells})`);
  assert.equal(W.riverPixel(500, 250), null);
  for (const l of law.lakes) {
    const w = W.waterAt(l.at[0], l.at[1]);
    assert.deepEqual([w?.kind, w?.key], ['lake', l.key]);
    assert.equal(w.level, l.level * 1.25);
    assert.ok(W.watersIn(l.at[0] - 0.2, l.at[1] - 0.2, l.at[0] + 0.2, l.at[1] + 0.2).lakes.includes(l.key));
  }
  const { pictureToBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  const [rx, ry] = pictureToBay(170, 95.4);
  assert.deepEqual([W.waterAt(rx, ry)?.kind, W.waterAt(rx, ry)?.name], ['sea', 'Lake Rumare']);
  assert.equal(W.waterAt(500, 250), null, 'the Bay is its own');
  const [dx, dy] = pictureToBay(160, 90);
  assert.equal(W.waterAt(dx, dy), null, 'the Heartlands dry');
  assert.equal(W.riverAt(dx, dy), null);
  assert.deepEqual(W.watersIn(dx - 1, dy - 1, dx + 1, dy + 1), { rivers: [], lakes: [] });
});

test('CYRODIIL-WATERS with ARENA2: the ground it carves - a river\'s channel at its surface or under it and painted water to the tiles, its banks over it, the carve only ever lowering the land, a location\'s rect never painted; the ground meets itself at every pixel\'s edge, a river\'s pixels and the landforms\' alike (mutants: the carve\'s level, the paint\'s test, the seam)', { skip }, async () => {
  const { law, woods, maps, W } = await world();
  const LF = await import('../../src/world/landforms.js');
  const TS = await import('../../src/world/terrain/terrainSampler.js');
  const { WATER } = await import('../../src/world/terrain/terrainTiles.js');
  const climates = LF.landformClimates((x, y) => maps.getClimateIndex(x, y));
  const lf = LF.createLandforms({ woods, climates });
  const span = HEIGHTMAP_DIMENSION - 1, U = MAX_TERRAIN_HEIGHT;
  for (const key of ['corbolo', 'whiteRose', 'strid']) {
    const r = law.rivers.find((q) => q.key === key), [x, y] = mid(r), px = Math.floor(x), py = Math.floor(y);
    const s = TS.generateSamples(woods, px, py, HEIGHTMAP_DIMENSION, lf);
    // the channel's centre (the sample nearest the river's line) at or under its surface; a sample past its valley over it
    let inCh = 0, low = Infinity;
    for (let sx = 0; sx <= span; sx++) {
      for (let sy = 0; sy <= span; sy++) {
        const bx = px + sx / span, by = py + 1 - sy / span, w = W.waterAt(bx, by);
        if (w?.kind !== 'river') continue;
        inCh++;
        assert.ok(s[sx * HEIGHTMAP_DIMENSION + sy] * U <= w.level / 1.25 + 0.01, `${key}: a channel sample over its surface`);
        low = Math.min(low, s[sx * HEIGHTMAP_DIMENSION + sy] * U);
      }
    }
    assert.ok(inCh > 20, `${key}: its channel crosses the pixel (${inCh})`);
    const shaper = W.tamrielWatersShaper(px, py, span);
    for (let i = 0; i < 400; i++) {
      const gx = px * span + (i * 37) % 129, gy = (MAP_HEIGHT - py) * span + (i * 53) % 129, base = 200 + (i % 17) * 40, hh = ((i % 11) - 5) * 9;
      assert.ok(shaper.carve(gx, gy, base, hh) <= base + hh, 'the carve only lowers');
    }
    const td = new Uint8Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(7);
    const n = W.paintTamrielWaters(td, px, py);
    assert.ok(n > 20, `${key}: painted (${n})`);
    for (let ty = 0; ty < HEIGHTMAP_DIMENSION; ty++) {
      for (let tx = 0; tx < HEIGHTMAP_DIMENSION; tx++) {
        const wet = td[ty * HEIGHTMAP_DIMENSION + tx] === WATER, w = W.waterAt(px + tx / span, py + 1 - ty / span);
        assert.equal(wet, w?.kind === 'river' || w?.kind === 'lake', `${key} corner ${tx},${ty}`);
      }
    }
    const kept = new Uint8Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(7);
    assert.equal(W.paintTamrielWaters(kept, px, py, { xMin: -1, xMax: 129, yMin: -1, yMax: 129 }), 0, 'a location\'s rect is its own');
    // its seams: the east and north neighbours' shared edges, sample for sample
    const e = TS.generateSamples(woods, px + 1, py, HEIGHTMAP_DIMENSION, lf), nn = TS.generateSamples(woods, px, py - 1, HEIGHTMAP_DIMENSION, lf);
    for (let t = 0; t <= span; t++) {
      assert.equal(s[span * HEIGHTMAP_DIMENSION + t], e[t], `${key} east seam ${t}`);
      assert.equal(s[t * HEIGHTMAP_DIMENSION + span], nn[t * HEIGHTMAP_DIMENSION], `${key} north seam ${t}`);
    }
  }
  const lake = law.lakes[0], lpx = Math.floor(lake.at[0]), lpy = Math.floor(lake.at[1]);
  const ls = TS.generateSamples(woods, lpx, lpy, HEIGHTMAP_DIMENSION, lf), li = Math.round((lake.at[0] - lpx) * span), lj = Math.round((lpy + 1 - lake.at[1]) * span);
  assert.ok(ls[li * HEIGHTMAP_DIMENSION + lj] * U <= lake.level + 0.01, 'a lake\'s middle at its level');
  // across the Bay's own edge (its north, on the land north of it): the seam band the Bay's, the ramp's pixels each half
  // the continent's and half the Bay's hills, the whole continent past it - every pixel meeting the next
  for (let k = 0; k <= SEAM_PX + TAMRIEL_LANDFORM_DIALS.ramp + 3; k++) {
    const s = TS.generateSamples(woods, 800, -k, HEIGHTMAP_DIMENSION, lf), e = TS.generateSamples(woods, 801, -k, HEIGHTMAP_DIMENSION, lf), nn = TS.generateSamples(woods, 800, -k - 1, HEIGHTMAP_DIMENSION, lf);
    for (let t = 0; t <= span; t++) {
      assert.equal(s[span * HEIGHTMAP_DIMENSION + t], e[t], `the Bay's edge, ${k} out: east seam ${t}`);
      assert.equal(s[t * HEIGHTMAP_DIMENSION + span], nn[t * HEIGHTMAP_DIMENSION], `the Bay's edge, ${k} out: north seam ${t}`);
    }
  }
  // the landforms' own seams, in each country (Jerall, Colovia, Elsweyr, Black Marsh, Skyrim)
  const { pictureToBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  for (const [qx, qy] of [[165, 76], [140, 95], [165, 140], [220, 140], [150, 60]]) {
    const [bx, by] = pictureToBay(qx, qy), px = Math.floor(bx), py = Math.floor(by);
    const s = TS.generateSamples(woods, px, py, HEIGHTMAP_DIMENSION, lf), e = TS.generateSamples(woods, px + 1, py, HEIGHTMAP_DIMENSION, lf), nn = TS.generateSamples(woods, px, py - 1, HEIGHTMAP_DIMENSION, lf);
    for (let t = 0; t <= span; t++) {
      assert.equal(s[span * HEIGHTMAP_DIMENSION + t], e[t], `${qx},${qy} east seam ${t}`);
      assert.equal(s[t * HEIGHTMAP_DIMENSION + span], nn[t * HEIGHTMAP_DIMENSION], `${qx},${qy} north seam ${t}`);
    }
  }
});
