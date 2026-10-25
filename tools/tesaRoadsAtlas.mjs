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
import { arenaJoins, beyondPixel, joinLayer, joinRunPixels, mergeArenaRoads, unpackArenaRoads } from '../src/world/arenaRoads.js';
import { CAPITALS, capitalOnPixel, capitalGates, capitalSpanPixels } from '../src/world/tamrielCapitals.js';
import { loadModRoads, WATER_BYTE } from '../src/world/roadsProducer.js';
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
const bay = await loadModRoads(read);
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
const lattice = regionLattice(tamrielFrameInBay());
const regions = regionsByNearness(lattice, (r) => regionHasLand(r, heightAt), { x: 500, y: 250 });
console.log(`inputs: ${towns.length} Arena towns, ${gates.length} gates, ${joins.length} crossings (Basic Roads ${bay ? 'read' : 'NOT read'}), ${held.length} held pixels, the relief ${trace.relief ? 'on' : 'NOT on'}; ${regions.length} regions with land (lattice ${lattice.cols} x ${lattice.rows})`);

// ── the regions, through the roads' worker's own state ──────────
const worker = createRoadsWorkerState();
const f = tamrielFit();
worker.handle({ t: 'init', woodsBytes: file('WOODS.WLD'), trace: tamrielTrace(), fit: { ox: f.ox, oy: f.oy, ppu: f.ppu }, spec, nodes, obstacles, gates, held, lattice }, () => {});
const layer = joinLayer(joins);
const only = arg('--only')?.split(',').map(Number);
const before = arg('--before')?.split(';').map((t) => t.split(',').map(Number)) ?? [];
for (const [bi, bj] of before) { let m = null; worker.handle({ t: 'build', id: 0, i: bi, j: bj }, (x) => { m = x; }); console.log(`before (${bi}, ${bj}): ${m.layer.keys.length} path pixels`); }
const built = only ? regions.filter((r) => r.i === only[0] && r.j === only[1]) : regions.slice(0, arg('--regions') ? Number(arg('--regions')) : regions.length);
const t0 = Date.now();
let slowest = 0;
for (const region of built) {
  let got = null;
  worker.handle({ t: 'build', id: 1, i: region.i, j: region.j }, (m) => { got = m; });
  if (got.error) { console.log(`region (${region.i}, ${region.j}): ${got.error}`); continue; }
  const add = unpackArenaRoads(got.layer);
  mergeArenaRoads(layer, add);
  slowest = Math.max(slowest, got.ms);
  console.log(`region (${region.i}, ${region.j}): ${got.stats.places} places, ${got.stats.roadNodes} road and ${got.stats.trackNodes} track nodes, ${add.roads.size} road and ${add.tracks.size} track pixels, ${got.stats.unrouted} unrouted, ${got.stats.gated} gated, ${got.ms} ms`);
}
console.log(`built: ${built.length} of ${regions.length} regions in ${((Date.now() - t0) / 1000).toFixed(1)} s, the slowest ${slowest} ms; ${layer.roads.size} road and ${layer.tracks.size} track pixels`);

// ── what a player meets on it ───────────────────────────────────
const places = [];
for (const r of built) for (const p of worker.placesIn(r.core.x0, r.core.y0, r.core.x1, r.core.y1)) places.push(p);
const pop = (b) => { let n = 0; for (let i = 0; i < 8; i++) if (b & (1 << i)) n++; return n; };
const ends = new Set([...nodes, ...places].map((t) => `${t.x},${t.y}`));
for (const j of joins) ends.add(`${j.meet[0]},${j.meet[1]}`);
const dead = [], wet = [], onCapital = [];
for (const key of new Set([...layer.roads.keys(), ...layer.tracks.keys()])) {
  const bits = (layer.roads.get(key) ?? 0) | (layer.tracks.get(key) ?? 0);
  const [x, y] = beyondPixel(key);
  if (pop(bits) === 1 && !ends.has(`${x},${y}`) && !gates.some((g) => g.x === x && g.y === y)) dead.push([x, y]);
  if (!inBay(x, y) && heightAt(x, y) <= WATER_BYTE && !ends.has(`${x},${y}`)) wet.push([x, y]);
  if (capitalOnPixel(x, y)) onCapital.push([x, y]);
}
console.log(`dead ends ${dead.length} ${JSON.stringify(dead.slice(0, 10))}; path pixels over water ${wet.length} ${JSON.stringify(wet.slice(0, 10))}; on a capital ${onCapital.length}`);
const unreached = places.filter((p) => [1, 2, 5, 6, 8, 9, 13].includes(p.type)).filter((p) => !layer.roads.has(beyondKeyOf(p)) && !layer.tracks.has(beyondKeyOf(p)));
function beyondKeyOf(p) { return (p.y + 32768) * 65536 + (p.x + 32768); }
console.log(`places a road or track should reach (hamlets, villages, temples, inns, manors, shrines, covens): ${places.filter((p) => [1, 2, 5, 6, 8, 9, 13].includes(p.type)).length}, of them on no path ${unreached.length}`);
// AUDIT TESA II R2: every capital's gates, and whether a road reaches each - a gate on water or the Bay the host drops
const roadless = [];
CAPITALS.forEach((cap, k) => {
  const all = capitalGates(k, { walkable }), handed = all.filter((g) => gates.some((h) => h.x === g.x && h.y === g.y)), reached = handed.filter((g) => layer.roads.has((g.y + 32768) * 65536 + (g.x + 32768)));
  for (const g of handed) if (!reached.includes(g)) roadless.push(`${cap.name} ${g.side} (${g.x}, ${g.y})`);
  console.log(`  ${cap.name}: ${all.length} gates, ${handed.length} on land, ${reached.length} with a road${reached.length ? '' : ' - NO ROAD TO THE CAPITAL'}`);
});
console.log(`capitals' gates no road reaches ${roadless.length} ${JSON.stringify(roadless)}`);

// ── the picture ─────────────────────────────────────────────────
const crop = arg('--crop')?.split(',').map(Number) ?? [lattice.x0, lattice.y0, lattice.x0 + lattice.cols * 800, lattice.y0 + lattice.rows * 300];
const [cx0, cy0, cx1, cy1] = crop;
const step = Math.max(1, Math.ceil((cx1 - cx0) / 2400));
const W = Math.ceil((cx1 - cx0) / step), H = Math.ceil((cy1 - cy0) / step);
const rgb = new Uint8Array(W * H * 3);
const put = (x, y, c) => { const i = Math.floor((y - cy0) / step), j = Math.floor((x - cx0) / step); if (i < 0 || j < 0 || i >= H || j >= W) return; const o = (i * W + j) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2]; };
for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
  const x = cx0 + j * step, y = cy0 + i * step;
  const c = inBay(x, y) ? (bayLand(x, y) ? [150, 150, 130] : [80, 90, 120]) : heightAt(x, y) > WATER_BYTE ? [200, 185, 140] : [70, 110, 170];
  const o = (i * W + j) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2];
}
for (const p of obstacles) put(p.x, p.y, [40, 60, 220]);
for (const p of places) put(p.x, p.y, [120, 90, 60]);
for (const [key] of layer.tracks) { const [x, y] = beyondPixel(key); put(x, y, [230, 140, 30]); }
for (const [key] of layer.roads) { const [x, y] = beyondPixel(key); put(x, y, [200, 20, 20]); }
for (const t of nodes) for (let d = -2; d <= 2; d++) { put(t.x + d, t.y, [0, 0, 0]); put(t.x, t.y + d, [0, 0, 0]); }
const mark = (pts, c) => { for (const [x, y] of pts) for (let d = -3; d <= 3; d++) { put(x + d, y, c); put(x, y + d, c); } };
mark(wet, [0, 230, 230]);
mark(dead, [230, 0, 230]);
const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let i = 0; i < H; i++) Buffer.from(rgb.buffer, i * W * 3, W * 3).copy(raw, i * (W * 3 + 1) + 1);
writeFileSync(join(outDir, 'roads.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`picture: ${join(outDir, 'roads.png')} (${W} x ${H}, ${step} Bay px a pixel, x ${cx0}..${cx1}, y ${cy0}..${cy1})`);
