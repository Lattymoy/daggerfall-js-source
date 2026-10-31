#!/usr/bin/env node
// TESA14 (bible/03-World/Arena-Provinces.md TESA14) - THE ROADS PAST THE BAY, LAID AS THE PLAYER'S GAME LAYS THEM, LOOKED AT.
//
// What the world host and the roads' workers do with the player's own files, here in node: the trace and the fit
// (tools/tamrielFitProbe.mjs's way), the places past the Bay (world/arenaPlaces.js), the crossings onto Basic Roads'
// network (world/arenaRoads.js arenaJoins), the roll's numbers off MAPS.BSA's rows (world/tamrielRoads.js rollSpec), the
// capitals' gates - then every region with land built through the roads' worker's own state
// (world/tamrielRoadsWorker.js) and merged, as the terrain client merges them. What a player meets on it, counted and drawn:
//   DEAD ENDS   a path pixel with one step out that is no place's, node's or crossing's pixel - a road that stops in the open;
//   WET PIXELS  a path pixel whose ground is water (the beach line, roadsProducer.js WATER_BYTE) - a road over a lake;
//   CAPITALS    a path pixel on a capital's pixels (world/tamrielCapitals.js capitalOnPixel) - a road through its plan;
//   GATES       a capital's gate no road reaches, and a capital none of whose gates one does (AUDIT TESA II R2).
// AUDIT TESA II R5: the inputs the game hands - the trace with the relief on it (ui/tamrielTrace.js preloadTamrielTrace's
// loadRelief: the ground the roads are costed on), the towns that stand with their templates, the pixels Arena's places
// hold and the crossings' runs (TESA15's `held`, scenes/tamrielRoadsHost.js) - so its counts are the game's network's.
// Writes `roads.png` (land, water, the Bay; roads red, tracks orange, places brown, nodes black; dead ends magenta, wet
// path pixels cyan) and prints the counts and the time each region took. Nothing is committed. Host-specific
// differences: the host's Bay climate is dilated along the coast at boot (a few rates move); this reads MAPS.BSA's own.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 node tools/tesaRoadsAtlas.mjs [--out DIR] [--regions N] [--crop x0,y0,x1,y1]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { ImgFile } from '../src/formats/imgFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { PakFile } from '../src/formats/pakFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { MapsFile, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { traceTamrielPicture, paletteReader } from '../src/ui/tamrielTrace.js';
import { fitBayToPicture, setTamrielTrace, tamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { loadRelief } from '../src/world/tamriel/tamrielRelief.js';
import { setTamrielFit, tamrielFit, tamrielFrameInBay, inBay, BAY_W } from '../src/world/tamriel/tamrielFrame.js';
import { isWaterPixel } from '../src/ui/overworldModel.js';
import { landAt } from '../src/ui/ink/inkMap.js';
import { groundWoods } from '../src/world/tamriel/tamrielGround.js';
import { arenaPixels } from '../src/world/arenaPlaces.js';
import { arenaRoadTowns, arenaTemplates, arenaTemplateOf } from '../src/world/arenaLocations.js';
import { arenaJoins, beyondPixel, joinLayer, joinRunPixels, mergeArenaRoads, unpackArenaRoads, layerByte } from '../src/world/arenaRoads.js';
import { DIR_DELTA } from '../src/world/road/roadNetwork.js';
import { paintRoads } from '../src/world/road/roadPainter.js';
import { cyrodiilTrunksFor } from '../src/scenes/tamrielRoadsHost.js';
import { CAPITALS, capitalOnPixel, capitalGates, capitalSpanPixels } from '../src/world/tamrielCapitals.js';
import { WATER_BYTE } from '../src/world/roadsProducer.js';
import { bayRoads } from '../test/bayRoads.mjs';   // OWN-WORK2: the Bay's own network, off the same ARENA2
import { isMainStoryDungeon } from '../src/world/dungeon/dungeonTextures.js';
import { countryTemplates, countryCounts, bayLand as bayLandOf, countryRates } from '../src/world/tamrielCountry.js';
import { lairTemplates, lairPools, LAIR_TYPES } from '../src/world/tamrielDungeons.js';
import { regionLattice, regionsByNearness, regionHasLand, rollSpec } from '../src/world/tamrielRoads.js';
import { createRoadsWorkerState } from '../src/world/tamrielRoadsWorker.js';

const A2 = process.env.ARENA2_PATH;
if (!A2 || !existsSync(A2)) { console.error('ARENA2_PATH not set or missing'); process.exit(2); }
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const outDir = arg('--out') ?? 'tesa-roads';
mkdirSync(outDir, { recursive: true });
const file = (name) => {
  for (const n of [name, name.toLowerCase()]) { const p = join(A2, n); if (existsSync(p)) return readFileSync(p); }
  throw new Error(`${name} not in ${A2}`);
};

// ── the trace and the fit ───────────────────────────────────────
const picture = new ImgFile(); picture.load(file('TMAP00I0.IMG'), 'TMAP00I0.IMG');
const picker = new ImgFile(); picker.load(file('TAMRIEL2.IMG'), 'TAMRIEL2.IMG');
const pal = new DFPalette(); pal.load(file(picture.paletteName || 'ART_PAL.COL'), picture.paletteName || 'ART_PAL.COL');
const trace = traceTamrielPicture(picker.getDFBitmap(), picture.getDFBitmap(), paletteReader(pal));
trace.relief = await loadRelief(trace);   // AUDIT TESA II R5: TAMRIEL-RELIEF's cells, as preloadTamrielTrace hangs them
const woods = new WoodsFile(); woods.load(file('WOODS.WLD'));
const climatePak = new PakFile(); climatePak.load(file('CLIMATE.PAK'));
const bayLand = landAt({ heightBytes: woods.heightMapBuffer, width: BAY_W, climateAt: (x, y) => climatePak.getValue(x + 1, y) });
const fit = fitBayToPicture({ bayLand, trace });
setTamrielTrace(trace);
setTamrielFit({ ox: fit.ox * fit.ppu, oy: fit.oy * fit.ppu, ppu: fit.ppu });
const ground = groundWoods(woods);
const heightAt = (x, y) => ground.getHeightMapValue(x, y);

// ── the inputs, as the host gathers them ────────────────────────
const maps = new MapsFile();
maps.load(file('MAPS.BSA'), file('CLIMATE.PAK'), file('POLITIC.PAK'));
const climateBay = (x, y) => maps.getClimateIndex(x, y);
const rows = [];
for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
const land0 = bayLandOf(climateBay, (x, y, c) => isWaterPixel(c, woods.getHeightMapValue(x, y)));
const cT = countryTemplates(rows, isMainStoryDungeon), lT = lairTemplates(rows, isMainStoryDungeon);
const spec = rollSpec({ countryRates: countryRates(countryCounts(cT, climateBay), land0), countryTemplates: cT, lairRates: countryRates(countryCounts(lT, climateBay), land0, LAIR_TYPES), lairTemplates: lT, lairPools: lairPools(lT) });
const read = async (url) => { const p = fileURLToPath(url); return { ok: true, arrayBuffer: async () => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } }; };
const bay = bayRoads();
const joinLand = (x, y) => (inBay(x, y) ? !isWaterPixel(climateBay(x, y), woods.getHeightMapValue(x, y)) : heightAt(x, y) > WATER_BYTE);
const joins = bay ? arenaJoins(bay, joinLand) : [];
const gates = [], obstacles = [];
const walkable = (x, y) => !inBay(x, y) && heightAt(x, y) > WATER_BYTE && !capitalOnPixel(x, y);   // the host's (scenes/tamrielRoadsHost.js start)
CAPITALS.forEach((_, k) => { obstacles.push(...capitalSpanPixels(k)); gates.push(...capitalGates(k, { walkable })); });
const pixels = arenaPixels();
// AUDIT TESA II R5: the host's own reads (scenes/tamrielPlacesHost.js tamrielRoadTowns, tamrielRoadHeld): a place that
// stands with its template, a capital's own place its gates; the pixels they hold, and the crossings' runs
const templates = arenaTemplates(rows, isMainStoryDungeon);
const towns = arenaRoadTowns({ stood: pixels.stood.filter((p) => !p.pinned && arenaTemplateOf(templates, p)) }) ?? [];
const held = [...pixels.stood.filter((p) => arenaTemplateOf(templates, p)).map((p) => ({ x: p.bx, y: p.by })), ...joinRunPixels(joins)];
const nodes = [...towns, ...gates.map((g) => ({ x: g.x, y: g.y, type: LOCATION_TYPES.TownCity })), ...joins.map((j) => ({ x: j.gate[0], y: j.gate[1], type: LOCATION_TYPES.TownCity }))];
const trunks = process.argv.includes('--no-named') ? null : cyrodiilTrunksFor(pixels, walkable);   // VOYAGER-CYRODIIL: the host's own (scenes/tamrielRoadsHost.js start)
const lattice = regionLattice(tamrielFrameInBay());
const regions = regionsByNearness(lattice, (r) => regionHasLand(r, heightAt), { x: 500, y: 250 });
console.log(`inputs: ${towns.length} Arena towns, ${gates.length} gates, ${joins.length} crossings (the Bay's network ${bay ? 'built' : 'NOT built'}), ${held.length} held pixels, the relief ${trace.relief ? 'on' : 'NOT on'}, ${trunks?.roads.length ?? 0} named roads; ${regions.length} regions with land (lattice ${lattice.cols} x ${lattice.rows})`);
if (trunks) for (const r of trunks.roads) console.log(`  ${r.name}: ${r.fromRing ? 'the ring, ' : ''}${r.stops.map((s) => `(${s[0]}, ${s[1]})`).join(' ')}`);

// ── the regions, through the roads' worker's own state ──────────
const worker = createRoadsWorkerState();
const f = tamrielFit();
worker.handle({ t: 'init', woodsBytes: file('WOODS.WLD'), trace: tamrielTrace(), fit: { ox: f.ox, oy: f.oy, ppu: f.ppu }, spec, nodes, obstacles, gates, held, lattice, trunks }, () => {});
const layer = joinLayer(joins);
const only = arg('--only')?.split(',').map(Number);
const before = arg('--before')?.split(';').map((t) => t.split(',').map(Number)) ?? [];
for (const [bi, bj] of before) { let m = null; worker.handle({ t: 'build', id: 0, i: bi, j: bj }, (x) => { m = x; }); console.log(`before (${bi}, ${bj}): ${m.layer.keys.length} path pixels`); }
const onlyList = only ? [only] : arg('--onlies')?.split(';').map((t) => t.split(',').map(Number));   // --onlies "i,j;i,j"
const built = onlyList ? regions.filter((r) => onlyList.some(([i, j]) => r.i === i && r.j === j)) : regions.slice(0, arg('--regions') ? Number(arg('--regions')) : regions.length);
const t0 = Date.now();
let slowest = 0;
const named = new Set();   // VOYAGER-CYRODIIL: the named roads' pixels
for (const region of built) {
  let got = null;
  worker.handle({ t: 'build', id: 1, i: region.i, j: region.j }, (m) => { got = m; });
  if (got.error) { console.log(`region (${region.i}, ${region.j}): ${got.error}`); continue; }
  const add = unpackArenaRoads(got.layer);
  mergeArenaRoads(layer, add);
  slowest = Math.max(slowest, got.ms);
  const tp = got.stats.trunkPath ?? [];
  for (let k = 0; k + 1 < tp.length; k += 2) named.add(`${tp[k]},${tp[k + 1]}`);
  console.log(`region (${region.i}, ${region.j}): ${got.stats.places} places, ${got.stats.roadNodes} road and ${got.stats.trackNodes} track nodes, ${got.stats.trunkLegs ?? 0} named roads' legs, ${add.roads.size} road and ${add.tracks.size} track pixels, ${got.stats.unrouted} unrouted, ${got.stats.gated} gated, ${got.ms} ms`);
}
console.log(`built: ${built.length} of ${regions.length} regions in ${((Date.now() - t0) / 1000).toFixed(1)} s, the slowest ${slowest} ms; ${layer.roads.size} road and ${layer.tracks.size} track pixels`);

// ── what a player meets on it ───────────────────────────────────
const places = [];
for (const r of built) for (const p of worker.placesIn(r.core.x0, r.core.y0, r.core.x1, r.core.y1)) places.push(p);
const pop = (b) => { let n = 0; for (let i = 0; i < 8; i++) if (b & (1 << i)) n++; return n; };
const ends = new Set([...nodes, ...places].map((t) => `${t.x},${t.y}`));
for (const j of joins) ends.add(`${j.meet[0]},${j.meet[1]}`);
for (const [a, b] of worker.trunkLegs()) { ends.add(`${a[0]},${a[1]}`); ends.add(`${b[0]},${b[1]}`); }   // VOYAGER-CYRODIIL: a named road's own end
const dead = [], fords = [], onCapital = [];
for (const key of new Set([...layer.roads.keys(), ...layer.tracks.keys()])) {
  const bits = (layer.roads.get(key) ?? 0) | (layer.tracks.get(key) ?? 0);
  const [x, y] = beyondPixel(key);
  if (pop(bits) === 1 && !ends.has(`${x},${y}`) && !gates.some((g) => g.x === x && g.y === y)) dead.push([x, y]);
  if (!inBay(x, y) && heightAt(x, y) <= WATER_BYTE && !ends.has(`${x},${y}`)) fords.push([x, y]);   // VOYAGER1: a crossing, a ford's
  if (capitalOnPixel(x, y)) onCapital.push([x, y]);
}
console.log(`dead ends ${dead.length} ${JSON.stringify(dead.slice(0, 10))}; path pixels over water (VOYAGER1: fords) ${fords.length} ${JSON.stringify(fords.slice(0, 10))}; on a capital ${onCapital.length}`);
const unreached = places.filter((p) => [1, 2, 5, 6, 8, 9, 13].includes(p.type)).filter((p) => !layer.roads.has(beyondKeyOf(p)) && !layer.tracks.has(beyondKeyOf(p)));
function beyondKeyOf(p) { return (p.y + 32768) * 65536 + (p.x + 32768); }
console.log(`places a road or track should reach (hamlets, villages, temples, inns, manors, shrines, covens): ${places.filter((p) => [1, 2, 5, 6, 8, 9, 13].includes(p.type)).length}, of them on no path ${unreached.length}`);
// AUDIT TESA II R2: every capital's gates, and whether a road reaches each - a gate on water or the Bay the host drops
const roadless = [];
CAPITALS.forEach((cap, k) => {
  const all = capitalGates(k, { walkable }), handed = all.filter((g) => gates.some((h) => h.x === g.x && h.y === g.y)), reached = handed.filter((g) => layer.roads.has((g.y + 32768) * 65536 + (g.x + 32768)));
  for (const g of handed) if (!reached.includes(g)) roadless.push(`${cap.name} ${g.side} (${g.x}, ${g.y})`);
  if (built.some((r) => all.some((g) => g.x >= r.gx && g.y >= r.gy && g.x < r.gx + 1000 && g.y < r.gy + 500))) console.log(`  ${cap.name}: ${all.length} gates, ${handed.length} on land, ${reached.length} with a road${reached.length ? '' : ' - NO ROAD TO THE CAPITAL'}`);
});
console.log(`capitals' gates no road reaches ${roadless.length} ${JSON.stringify(roadless.slice(0, 8))}`);

// ── VOYAGER1: how the roads lie on the land ─────────────────────
// straight runs: a road's steps in one heading, end to end (a run starts where the pixel behind carries no such step);
// the grade: each road step's rise on the height averaged over 5 x 5 (roadNetwork.js landForRoutes' own smoothing)
const smooth = new Map();
const hs = (x, y) => {
  const k = `${x},${y}`;
  let v = smooth.get(k);
  if (v === undefined) { let s = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += inBay(x + dx, y + dy) ? 0 : heightAt(x + dx, y + dy); v = s / 25; smooth.set(k, v); }
  return v;
};
const runs = [];
let steps = 0, gradeSum = 0, steep6 = 0, steep10 = 0, high = 0;
for (const [key, bits] of layer.roads) {
  const [x, y] = beyondPixel(key);
  for (let k = 0; k < 4; k++) {   // N, NE, E, SE: each step once, from its west or south end's bit
    const [bit, dx, dy] = DIR_DELTA[k];
    if (!(bits & bit)) continue;
    const len = dx && dy ? Math.SQRT2 : 1, g = Math.abs(hs(x + dx, y + dy) - hs(x, y)) / len;
    steps++; gradeSum += g; if (g > 6) steep6++; if (g > 10) steep10++; if (hs(x, y) > 80) high++;
    if ((layer.roads.get(beyondKeyOf({ x: x - dx, y: y - dy })) ?? 0) & bit) continue;   // not a run's start
    let n = 0, px = x, py = y;
    while ((layer.roads.get(beyondKeyOf({ x: px, y: py })) ?? 0) & bit) { n++; px += dx; py += dy; }
    runs.push(n * len);
  }
}
runs.sort((a, b) => b - a);
const km = (px) => (px * 0.8192).toFixed(1);
// RULER LINES: a road between two junctions (a chain of two-step pixels) is cut into its longest stretches whose every
// pixel lies within RULER pixels (1.2 km) of the stretch's chord - a staircase of steps reads as a ruler line on the map
// as a run of one heading does - and its sinuosity (its length over its chord)
const RULER = 1.5;
const chains = [], seen = new Set();
const bitsAt = (x, y) => layer.roads.get(beyondKeyOf({ x, y })) ?? 0;
for (const [key, bits] of layer.roads) {
  if (pop(bits) === 2) continue;
  const [x0, y0] = beyondPixel(key);
  for (const [bit, dx, dy] of DIR_DELTA) {
    if (!(bits & bit) || seen.has(`${x0},${y0},${bit}`)) continue;
    const chain = [[x0, y0]];
    let x = x0 + dx, y = y0 + dy, from = DIR_DELTA.findIndex(([b]) => b === bit);
    for (let guard = 0; guard < 100000; guard++) {
      chain.push([x, y]);
      const b = bitsAt(x, y);
      if (pop(b) !== 2) { seen.add(`${x},${y},${DIR_DELTA[(from + 4) % 8][0]}`); break; }
      const back = (from + 4) % 8, k = DIR_DELTA.findIndex(([bb], i) => i !== back && (b & bb));
      if (k < 0) break;
      x += DIR_DELTA[k][1]; y += DIR_DELTA[k][2]; from = k;
    }
    chains.push(chain);
  }
}
const devOf = (c, i, j) => { const [ax, ay] = c[i], [bx, by] = c[j], L = Math.hypot(bx - ax, by - ay) || 1; let m = 0; for (let k = i + 1; k < j; k++) m = Math.max(m, Math.abs((bx - ax) * (ay - c[k][1]) - (ax - c[k][0]) * (by - ay)) / L); return m; };
let rulerLongest = 0, ruler25 = 0, chainLen = 0, chordLen = 0;
for (const c of chains) {
  if (c.length < 3) continue;
  let len = 0;
  for (let k = 1; k < c.length; k++) len += Math.hypot(c[k][0] - c[k - 1][0], c[k][1] - c[k - 1][1]);
  if (len >= 30) { chainLen += len; chordLen += Math.hypot(c.at(-1)[0] - c[0][0], c.at(-1)[1] - c[0][1]); }
  for (let i = 0; i < c.length - 1;) {
    let j = i + 1;
    while (j + 1 < c.length && devOf(c, i, j + 1) <= RULER) j++;
    const d = Math.hypot(c[j][0] - c[i][0], c[j][1] - c[i][1]);
    rulerLongest = Math.max(rulerLongest, d);
    if (d >= 30) ruler25 += d;
    i = j;
  }
}
console.log(`ruler lines (every pixel within ${RULER} of the chord): the longest ${km(rulerLongest)} km; ${km(ruler25)} km of road in ruler lines of 25 km and more; chains of 25 km and more: sinuosity ${(chainLen / Math.max(1, chordLen)).toFixed(3)}`);
console.log(`straight runs of road: ${runs.length}; the longest ${runs.slice(0, 5).map(km).join(', ')} km; ${runs.filter((r) => r >= 30).length} of 25 km and more, ${runs.filter((r) => r >= 61).length} of 50 km and more, ${runs.filter((r) => r >= 122).length} of 100 km and more; mean ${km(runs.reduce((a, b) => a + b, 0) / Math.max(1, runs.length))} km`);
console.log(`road steps: ${steps}; mean grade ${(gradeSum / Math.max(1, steps)).toFixed(2)} bytes a pixel; over 6: ${(100 * steep6 / Math.max(1, steps)).toFixed(2)}%, over 10: ${(100 * steep10 / Math.max(1, steps)).toFixed(2)}%; over 80 high: ${(100 * high / Math.max(1, steps)).toFixed(2)}%`);
console.log(`named roads (VOYAGER-CYRODIIL): ${named.size} pixels, ${worker.trunkLegs().length} legs planned`);

// ── the picture, over the relief ────────────────────────────────
const crop = arg('--crop')?.split(',').map(Number) ?? [lattice.x0, lattice.y0, lattice.x0 + lattice.cols * 800, lattice.y0 + lattice.rows * 300];
const [cx0, cy0, cx1, cy1] = crop;
const step = Math.max(1, Math.ceil((cx1 - cx0) / 2400));
const W = Math.ceil((cx1 - cx0) / step), H = Math.ceil((cy1 - cy0) / step);
const rgb = new Uint8Array(W * H * 3);
const put = (x, y, c) => { const i = Math.floor((y - cy0) / step), j = Math.floor((x - cx0) / step); if (i < 0 || j < 0 || i >= H || j >= W) return; const o = (i * W + j) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2]; };
const hAt = (x, y) => (inBay(x, y) ? (bayLand(x, y) ? 40 : 0) : heightAt(x, y));
for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
  const x = cx0 + j * step, y = cy0 + i * step, h = hAt(x, y);
  let c;
  if (h <= WATER_BYTE) c = inBay(x, y) ? [70, 80, 115] : [70, 110, 170];
  else {
    // the relief: low land green-gold, high land grey to white, lit from the north-west
    const t = Math.min(1, h / 140), lit = Math.max(0.55, Math.min(1.35, 1 + 0.045 * ((hAt(x - step, y) - hAt(x + step, y)) + (hAt(x, y - step) - hAt(x, y + step))) / step));
    const base = [150 + 80 * t, 160 + 60 * t, 105 + 120 * t];
    c = base.map((v) => Math.max(0, Math.min(255, Math.round(v * lit))));
    if (inBay(x, y)) c = c.map((v) => Math.round(v * 0.75));
  }
  const o = (i * W + j) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2];
}
for (const p of obstacles) put(p.x, p.y, [40, 60, 220]);
for (const [key] of layer.tracks) { const [x, y] = beyondPixel(key); put(x, y, [215, 130, 40]); }
for (const [key] of layer.roads) { const [x, y] = beyondPixel(key); put(x, y, [170, 20, 20]); }
for (const k of named) { const [x, y] = k.split(',').map(Number); for (let d = -1; d <= 1; d++) { put(x + d * step, y, [255, 225, 40]); put(x, y + d * step, [255, 225, 40]); } }
for (const t of nodes) for (let d = -2; d <= 2; d++) { put(t.x + d, t.y, [0, 0, 0]); put(t.x, t.y + d, [0, 0, 0]); }
const mark = (pts, c) => { for (const [x, y] of pts) for (let d = -3; d <= 3; d++) { put(x + d, y, c); put(x, y + d, c); } };
mark(fords, [0, 230, 230]);
mark(dead, [230, 0, 230]);
writePng(join(outDir, 'roads.png'), W, H, rgb);
console.log(`picture: ${join(outDir, 'roads.png')} (${W} x ${H}, ${step} Bay px a pixel, x ${cx0}..${cx1}, y ${cy0}..${cy1})`);

// ── VOYAGER2: the roads as the painter lays them, a tile an image pixel ──
const zoom = arg('--zoom')?.split(',').map(Number);
if (zoom) {
  const [zx0, zy0, zx1, zy1] = zoom, T = 128, ZW = (zx1 - zx0) * T, ZH = (zy1 - zy0) * T;
  for (const curve of [true, false]) {
    const img = new Uint8Array(ZW * ZH * 3);
    for (let py = zy0; py < zy1; py++) {
      for (let px = zx0; px < zx1; px++) {
        const water = heightAt(px, py) <= WATER_BYTE || inBay(px, py);
        const td = new Uint8Array(129 * 129).fill(water ? 0 : 2), tm = new Uint8Array(T * T);
        const road = layerByte(layer, 'roads', px, py), track = layerByte(layer, 'tracks', px, py);
        const corners = { road: (layerByte(layer, 'roads', px + 1, py) & 0x5) | (layerByte(layer, 'roads', px - 1, py) & 0x50), track: (layerByte(layer, 'tracks', px + 1, py) & 0x5) | (layerByte(layer, 'tracks', px - 1, py) & 0x50) };
        paintRoads(td, tm, road, track, null, 129, { corners, paths: new Uint8Array(T * T), curve: curve ? { px, py, byteAt: (kind, x, y) => layerByte(layer, kind, x, y) } : null });
        for (let ty = 0; ty < T; ty++) {
          for (let tx = 0; tx < T; tx++) {
            const t = tm[ty * T + tx], g = td[tx + ty * 129], base = t & 0x3f;
            const c = base === 46 ? [95, 88, 80] : base === 47 || base === 55 ? [140, 120, 95] : t ? [150, 120, 80] : g === 1 ? [155, 125, 80] : g === 0 ? [70, 110, 170] : [80, 135, 60];
            const ix = (px - zx0) * T + tx, iy = (py - zy0) * T + (T - 1 - ty), o = (iy * ZW + ix) * 3;   // north up
            const grid = tx === 0 || ty === T - 1;
            img[o] = grid ? Math.round(c[0] * 0.8) : c[0]; img[o + 1] = grid ? Math.round(c[1] * 0.8) : c[1]; img[o + 2] = grid ? Math.round(c[2] * 0.8) : c[2];
          }
        }
      }
    }
    const name = curve ? 'zoom.png' : 'zoom_arms.png';
    writePng(join(outDir, name), ZW, ZH, img);
    console.log(`zoom: ${join(outDir, name)} (${ZW} x ${ZH}, the painter's tiles${curve ? ', curved (VOYAGER2)' : ', the straight arms Basic Roads draws'}, x ${zx0}..${zx1}, y ${zy0}..${zy1})`);
  }
}

function writePng(path, w, h, data) {
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let i = 0; i < h; i++) Buffer.from(data.buffer, i * w * 3, w * 3).copy(raw, i * (w * 3 + 1) + 1);
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
