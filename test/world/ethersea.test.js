// ETHER-SEA (2026-10-11, the owner: "A brand new open sea map ... The etheric sea is a infinite procedural oceanscape with
// procedural islands with towns, dungeons, exotic resources, deadly legendary ships") - THE ELTHERIC OCEAN'S LAW
// (bible/03-World/Eltheric-Ocean.md): its box on the Bay's grid, the Veil and the bands, the isles' lattice, the ground the
// kernel grows there and the composition that hands it to the kernels, the stream and the far ring, and the crossing's
// waters. tools/mutants/ethersea.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ETHER_BOX, ETHER_MARGIN, LEAGUE_M, LEAGUE_PX, VEIL_PX, VEIL_X, inEther, inEtherLaw, inVeil, etherFrame, BANDS, etherDepthAt, etherBandOf, etherBandAt,
  etherHash, etherRng, ISLE_CELL_PX, ISLE_KINDS, KIND_IDS, ETHER_GOODS, CLIMATE_REACH_PX, etherCellOf, CELLS_W, CELLS_H, VEILHAVEN_CELL, VEILHAVEN_NAME,
  isleOfCell, isleAt, islesNear, isleByKey, veilhaven, isleName, isleByte, etherHeightByte, etherLargeMap, etherClimateAt, etherWoods,
  etherClimateIndex, etherPoliticIndex, crossingWaters, CROSS_X, CROSS_LAND_PX, HOME_WATERS, landfall, LANDFALL_OFF_PX, dropIsleCache, isleCacheSize,
  ETHER_SEA_NAME, NAME_HEADS, NAME_TAILS, HEIGHT_NOISE, etherLight, ETHER_LIGHT_TINT, ETHER_KEY_TINT, compassPoint,
} from '../../src/world/ethericSea.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { WoodsFile } from '../../src/formats/woodsFile.js';
import { isWaterPixel } from '../../src/ui/overworldModel.js';
import { POSE_BOUND, WORLD_PIXEL_BOUND, PIXEL_UNITS } from '../../src/net/wire.js';
import { PIXEL_M as GATE_PIXEL_M } from '../../src/net/gate/gateLaw.js';
import { setTamrielFit, tamrielFrameInBay } from '../../src/world/tamriel/tamrielFrame.js';
import { StreamingWorldState } from '../../src/world/streamingWorld.js';
import { spawnPlateauFloor, SPAWN_DRY_ELEVATION } from '../../src/world/spawnedDungeons.js';
import { generateSamples, MAX_TERRAIN_HEIGHT, SCALED_OCEAN_ELEVATION, HEIGHTMAP_DIMENSION } from '../../src/world/terrain/terrainSampler.js';
import { GOODS } from '../../src/systems/naval/tradeGoods.js';
import { LEAGUE_M as LEDGER_LEAGUE_M } from '../../src/systems/naval/captainLedger.js';
import { buildFarRingGrid } from '../../src/render/farRing.js';
import { TerrainGenClient } from '../../src/world/terrain/terrainGenClient.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A stub reader: the open sea everywhere (byte 0, no detail) - the Eltheric Ocean composed over it. */
const seaWoods = () => {
  const w = Object.create(WoodsFile.prototype);
  w.getHeightMapValue = () => 0;
  w.getLargeMapData = () => Array.from({ length: 5 }, () => new Uint8Array(5));
  return w;
};
const seaShare = (woods, px, py) => {
  const s = generateSamples(woods, px, py, HEIGHTMAP_DIMENSION, null);
  const arr = s.samples ?? s, sea = SCALED_OCEAN_ELEVATION / MAX_TERRAIN_HEIGHT;
  let above = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] > sea + 1e-6) above++;
  return above / arr.length;
};
/** Every isle of a strip of cells. */
const strip = (c0, c1, r0, r1) => { const out = []; for (let cy = r0; cy < r1; cy++) for (let cx = c0; cx < c1; cx++) { const i = isleOfCell(cx, cy); if (i) out.push(i); } return out; };

test('ETHER-SEA the box: inside the wire\'s world (a pose\'s x and z within POSE_BOUND, a pixel within WORLD_PIXEL_BOUND), positive world units both ways, and clear of Tamriel\'s frame at every fit the probe reads (mutants: the box\'s bounds, the margin, the frame)', () => {
  assert.deepEqual({ ...ETHER_BOX }, { x0: 64, x1: 8128, y0: -7680, y1: -2688 });
  for (const [x, y] of [[ETHER_BOX.x0, ETHER_BOX.y0], [ETHER_BOX.x1 - 1, ETHER_BOX.y0], [ETHER_BOX.x0, ETHER_BOX.y1 - 1], [ETHER_BOX.x1 - 1, ETHER_BOX.y1 - 1]]) {
    assert.ok(Math.abs((x + 1) * PIXEL_UNITS) <= POSE_BOUND && Math.abs((500 - y) * PIXEL_UNITS) <= POSE_BOUND, `${x},${y}: a pose there is the wire's`);
    assert.ok(Math.abs(x) < WORLD_PIXEL_BOUND && Math.abs(y) < WORLD_PIXEL_BOUND);
    assert.ok(x * PIXEL_UNITS > 0 && (499 - y) * PIXEL_UNITS > 0, 'positive: worldCoordToMapPixel truncates');
  }
  assert.equal(LEAGUE_PX, LEAGUE_M / GATE_PIXEL_M, 'a league in pixels over the map pixel\'s metres - gateLaw.js PIXEL_M\'s');
  assert.equal(GATE_PIXEL_M, PIXEL_UNITS / 40);
  // the fit's farthest north: the picture's row 76 (TAMRIEL3: 52 and 24 either way) at its largest scale, 21
  for (const ppu of [15, 18.75, 21]) {
    setTamrielFit({ ox: 76 * ppu, oy: 76 * ppu, ppu });
    try {
      const f = tamrielFrameInBay();
      assert.ok(f.y0 - ETHER_BOX.y1 > 1000, `the continent's frame at x${ppu} ends a thousand pixels and more south of the sea (${f.y0})`);
    } finally { setTamrielFit(null); }
  }
  assert.ok(tamrielFrameInBay().y0 - ETHER_BOX.y1 > 1000);
  assert.equal(inEther(ETHER_BOX.x0, ETHER_BOX.y0), true); assert.equal(inEther(ETHER_BOX.x1, ETHER_BOX.y0), false); assert.equal(inEther(ETHER_BOX.x0, ETHER_BOX.y1), false);
  assert.equal(inEther(ETHER_BOX.x0 - 1, -5000), false); assert.equal(inEther(500, 250), false, 'the Bay is not the sea');
  // PIN MOVED (AUDIT CAPTAIN'S SEA G1): the margin the far ring's whole reach from a ship in the box - four drew the Bay's
  // clamped row 0 on the Veil's horizon
  assert.equal(ETHER_MARGIN, 64);
  assert.equal(inEtherLaw(ETHER_BOX.x0 - 64, ETHER_BOX.y0 - 64), true); assert.equal(inEtherLaw(ETHER_BOX.x0 - 65, -5000), false); assert.equal(inEtherLaw(ETHER_BOX.x1 + 63, -5000), true); assert.equal(inEtherLaw(ETHER_BOX.x1 + 64, -5000), false);
  assert.deepEqual(etherFrame(), { x0: 64, y0: -7680, w: 8064, h: 4992 });
  // PIN MOVED (ELTHERIC, 2026-10-12, the owner: "Apparently the ocean is suppose to be eltheric not etheric"): the lore's
  // Eltheric Ocean, the name the intro map already gave the waters west of the Bay - it was 'the Etheric Sea'
  assert.equal(ETHER_SEA_NAME, 'the Eltheric Ocean');
});

test('ETHER-SEA the Veil and the bands: the Veil the box\'s eastmost VEIL_PX, depth leagues west of it, the bands from 0, 12, 45 and 140 leagues - each deadlier and richer, its isles\' kinds and its sea\'s law (mutants: the Veil, the league, each band\'s bound)', () => {
  assert.equal(VEIL_PX, 16); assert.equal(VEIL_X, 8112);
  assert.equal(inVeil(8112, -5000), true); assert.equal(inVeil(8111, -5000), false); assert.equal(inVeil(8127, -5000), true); assert.equal(inVeil(8128, -5000), false);
  assert.equal(LEAGUE_M, 4828); assert.equal(LEDGER_LEAGUE_M, LEAGUE_M, 'one league - the log\'s is the sea\'s');
  assert.equal(LEAGUE_PX, 4828 / 819.2);
  assert.equal(etherDepthAt(VEIL_X), 0); assert.equal(etherDepthAt(VEIL_X + 5), 0, 'none in the Veil');
  assert.ok(Math.abs(etherDepthAt(VEIL_X - LEAGUE_PX * 10) - 10) < 1e-9);
  assert.deepEqual(BANDS.map((b) => [b.id, b.from]), [['shallows', 0], ['reaches', 12], ['deep', 45], ['abyss', 140]]);
  assert.equal(etherBandOf(0).id, 'shallows'); assert.equal(etherBandOf(11.99).id, 'shallows'); assert.equal(etherBandOf(12).id, 'reaches'); assert.equal(etherBandOf(44.9).id, 'reaches');
  assert.equal(etherBandOf(45).id, 'deep'); assert.equal(etherBandOf(139.9).id, 'deep'); assert.equal(etherBandOf(140).id, 'abyss'); assert.equal(etherBandOf(5000).id, 'abyss');
  assert.equal(etherBandAt(VEIL_X - 13 * LEAGUE_PX).id, 'reaches');
  for (let i = 1; i < BANDS.length; i++) {
    const a = BANDS[i - 1], b = BANDS[i];
    assert.ok(b.level > a.level && b.tier > a.tier && b.pirate > a.pirate, `${b.id}: deadlier and richer than ${a.id}`);
    assert.ok(b.kinds.port < a.kinds.port && b.kinds.ruin > a.kinds.ruin, `${b.id}: fewer ports, more ruins`);
    assert.ok(b.lift > a.lift, 'its isles higher');
  }
  assert.deepEqual(BANDS.map((b) => b.chance), [0.5, 0.48, 0.42, 0.36]);
});

test('ETHER-SEA the hash and the stream: the same numbers on every client, apart for every input (mutants: the salt, the mix, the stream\'s step)', () => {
  assert.equal(etherHash(1, 2, 3), 1637308696, 'the one value every client has');
  assert.equal(etherRng(42)(), 0.6011037519201636);
  assert.deepEqual([veilhaven().px, veilhaven().py, veilhaven().seed], [8068, -5185, 3290208304], 'the same haven on every client');
  assert.notEqual(etherHash(1, 2, 3), etherHash(1, 3, 2));
  assert.notEqual(etherHash(-1, 2), etherHash(1, 2));
  const a = etherRng(42), b = etherRng(42);
  const xs = Array.from({ length: 8 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 8 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1)); assert.equal(new Set(xs).size, 8);
  let mean = 0; const r = etherRng(7); for (let i = 0; i < 4000; i++) mean += r(); mean /= 4000;
  assert.ok(Math.abs(mean - 0.5) < 0.03, `a fair stream (${mean})`);
});

test('ETHER-SEA the isles: a lattice of ISLE_CELL_PX cells, an isle on its band\'s chance, its kind by the band\'s weights, its land (and the kernel\'s pixel past it) inside its cell - one cell answers any pixel; cached, the same isle twice (mutants: the cell, the chance, the margin, the kinds\' ranges, the cache)', () => {
  assert.equal(ISLE_CELL_PX, 10);
  assert.deepEqual([...KIND_IDS], ['port', 'ruin', 'wild', 'rock']);
  assert.equal(CELLS_W, 806); assert.equal(CELLS_H, 499);
  assert.deepEqual(etherCellOf(ETHER_BOX.x0, ETHER_BOX.y0), [0, 0]); assert.deepEqual(etherCellOf(ETHER_BOX.x0 + 19, ETHER_BOX.y0 + 10), [1, 1]);
  dropIsleCache();
  const isles = strip(500, 560, 200, 260);
  assert.ok(isleCacheSize() >= 3600, 'every cell asked remembered, an empty one too');
  assert.equal(isleOfCell(isles[0].cx, isles[0].cy), isles[0], 'the cache\'s own');
  dropIsleCache();
  const again = isleOfCell(isles[0].cx, isles[0].cy);
  assert.deepEqual({ ...again }, { ...isles[0] }, 'the same isle grown again');
  const share = isles.length / 3600;
  const band = etherBandAt(ETHER_BOX.x0 + 530 * ISLE_CELL_PX);
  assert.ok(Math.abs(share - band.chance) < 0.04, `about the band's chance of a cell (${share.toFixed(3)} for ${band.chance})`);
  const kinds = Object.fromEntries(KIND_IDS.map((k) => [k, isles.filter((i) => i.kind === k).length / isles.length]));
  const total = Object.values(band.kinds).reduce((s, w) => s + w, 0);
  for (const k of KIND_IDS) assert.ok(Math.abs(kinds[k] - band.kinds[k] / total) < 0.05, `${k}: ${kinds[k].toFixed(3)} by the band's weight`);
  for (const i of isles) {
    const k = ISLE_KINDS[i.kind];
    assert.ok(i.r >= k.r[0] && i.r <= k.r[1], `${i.key}'s radius in its kind's`);
    const lift = i.kind === 'port' ? 1 : 1 + BANDS.find((b) => b.id === i.band).lift;
    assert.ok(i.peak >= Math.round(k.peak[0] * lift) && i.peak <= Math.round(k.peak[1] * lift), `${i.key}'s peak in its kind's, lifted by its band (ports never)`);
    assert.ok(k.climates.includes(i.climate));
    assert.equal(i.good != null, i.kind === 'wild', 'a wild isle bears a good, and only one');
    const x0 = ETHER_BOX.x0 + i.cx * ISLE_CELL_PX, y0 = ETHER_BOX.y0 + i.cy * ISLE_CELL_PX;
    assert.ok(i.px - i.r >= x0 + 1 - 1e-9 && i.px + i.r + 1 <= x0 + ISLE_CELL_PX - 1 + 1e-9, `${i.key}: its land and the kernel's pixel past it inside its cell (x)`);
    assert.ok(i.py - i.r >= y0 + 1 - 1e-9 && i.py + i.r + 1 <= y0 + ISLE_CELL_PX - 1 + 1e-9, `${i.key}: (y)`);
    assert.deepEqual({ ...isleAt(i.px, i.py) }, { ...i });
    assert.deepEqual({ ...isleByKey(i.key) }, { ...i });
  }
  assert.equal(isleByKey('nonsense'), null); assert.equal(isleOfCell(-1, 4), null); assert.equal(isleOfCell(CELLS_W, 4), null);
  assert.equal(isleAt(500, 250), null, 'none on the Bay');
});

test('ETHER-SEA no isle stands in the box\'s edge cells or east of Veilhaven - the Veil\'s still water, the landfall\'s way clear; Veilhaven is a port of its own in its own cell whatever the hash says (mutants: the edge, the strip, the haven\'s draw)', () => {
  for (let cy = 0; cy < CELLS_H; cy += 37) {
    assert.equal(isleOfCell(0, cy), null, 'the west edge');
    for (let cx = VEILHAVEN_CELL[0] + 1; cx < CELLS_W; cx++) assert.equal(isleOfCell(cx, cy), null, `east of Veilhaven (${cx},${cy})`);
  }
  for (let cx = 1; cx < CELLS_W; cx += 41) { assert.equal(isleOfCell(cx, 0), null); assert.equal(isleOfCell(cx, CELLS_H - 1), null); }
  assert.deepEqual([...VEILHAVEN_CELL], [800, 249]);
  const h = veilhaven();
  assert.equal(h.name, VEILHAVEN_NAME); assert.equal(h.name, 'Veilhaven');
  assert.equal(h.kind, 'port'); assert.equal(h.haven, true); assert.equal(h.r, 1); assert.equal(h.peak, 12); assert.equal(h.climate, CLIMATES.Subtropical);   // PIN MOVED (AUDIT CAPTAIN'S SEA H1): a port's small isle, its town's harbour in reach
  assert.equal(etherBandAt(h.px).id, 'shallows');
  assert.ok(etherDepthAt(h.px) < 8, 'a few leagues from the Veil');
  assert.deepEqual(landfall(), { px: h.px + LANDFALL_OFF_PX, py: h.py });
  assert.equal(LANDFALL_OFF_PX, 4);
});

test('ETHER-SEA the names: a head, a middle on half, a tail - by the kind\'s forms, the same off the same seed; a port is Port / -haven / Landing / Anchorage / -mouth, a ruin always carries its root (the automap keys on it) (mutants: the forms, the middle\'s share, the draw)', () => {
  assert.equal(NAME_HEADS.length, 40); assert.equal(NAME_TAILS.length, 30);
  const isles = strip(600, 640, 220, 260);
  const named = (k) => isles.filter((i) => i.kind === k).map((i) => i.name);
  for (const n of named('port')) assert.match(n, /^Port [A-Z]|haven$| Landing$|'s Anchorage$|mouth$/);
  for (const n of named('ruin')) assert.match(n, /^the Isle of [A-Z]|'s (Grave|Barrow|Hollow|Tomb|Sepulchre|Vault)$|^Old [A-Z]|^the (Grave|Barrow|Hollow|Tomb|Sepulchre|Vault) of [A-Z]/);
  for (const n of named('rock')) assert.match(n, /(Stack|Teeth|Rocks|Spire|Fang|Skerry|Crag|Needles|Anvil|Crown)$/);
  const i = isles[0];
  assert.equal(isleName(i), isleName({ ...i }), 'off its seed alone');
  assert.notEqual(isleName({ ...i, seed: i.seed + 1 }), isleName(i));
  const ports = strip(300, 700, 100, 400).filter((x) => x.kind === 'port');
  const roots = ports.map((p) => p.name.replace(/^Port |haven$| Landing$|'s Anchorage$|mouth$/g, ''));
  const threeSyllable = roots.filter((r) => r.length > 0 && !NAME_HEADS.some((h) => NAME_TAILS.some((t) => r === h + t))).length / roots.length;
  assert.ok(threeSyllable > 0.35 && threeSyllable < 0.65, `a middle on about half (${threeSyllable.toFixed(2)})`);
  assert.ok(new Set(ports.map((p) => p.name)).size / ports.length > 0.9, 'few ports share a name');
  // and the compass's sixteen points the chart's ways and the rumours share (map y runs south)
  assert.deepEqual([[0, -1], [1, 0], [0, 1], [-1, 0], [-2, -1], [1, -2], [-1, 1]].map(([dx, dy]) => compassPoint(dx, dy)),
    ['north', 'east', 'south', 'west', 'west-north-west', 'north-north-east', 'south-west']);
});

test('ETHER-SEA the ground: 0 at sea, the isle\'s peak at its centre falling to its rim by its kind\'s fall, the noise only on its land; the large map\'s detail small on land and all but none at sea; the climate the isle\'s to CLIMATE_REACH_PX past its rim, the Ocean\'s else - and the map\'s one water law agrees (mutants: the fall, the rim, the noise, the detail\'s tops, the reach)', () => {
  const h = veilhaven();
  // PIN MOVED (AUDIT CAPTAIN'S SEA H1/P2): a port's land the four bytes framing its town's pixel (its land's centre half a
  // pixel north-west of it: the kernel lays a byte at its pixel's south-east corner), the peak's (1 - t^2)^fall at t ~0.71
  assert.deepEqual([h.lx, h.ly], [h.px - 0.5, h.py - 0.5]);
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) assert.ok(Math.abs(etherHeightByte(h.px + dx, h.py + dy) - h.peak * 0.5) <= HEIGHT_NOISE, `the land about the town (${dx},${dy})`);
  assert.equal(isleByte(h, h.px + 1, h.py), 0, 'past the rim');
  assert.equal(isleByte(h, h.px, h.py + 1), 0, 'past the rim');
  assert.ok(isleByte({ ...h, peak: 40, fall: 0.8 }, h.px, h.py) > isleByte({ ...h, peak: 40, fall: 1.5 }, h.px, h.py), 'the slower fall the higher land');
  assert.equal(isleByte(h, h.px, h.py), isleByte({ ...h, fall: 1 }, h.px, h.py), 'its kind\'s fall, read');
  assert.equal(ISLE_KINDS.port.fall, 1); assert.equal(ISLE_KINDS.rock.fall, 1.5);
  const wild = strip(600, 640, 220, 260).find((i) => i.kind === 'wild');
  assert.deepEqual([wild.lx, wild.ly], [wild.px, wild.py], 'every other kind\'s land on its centre');
  // AUDIT CAPTAIN'S SEA (the touched run over 8cf4a1804: SEA-rim-unkept survived) - H1 gave a port a fall of 1, whose
  // tail past the rim is below nothing and clamps to 0 without the rim; a fall of no whole number (1.5) leaves NaN there,
  // so the rim is asked of a wild isle too
  assert.equal(isleByte(wild, Math.floor(wild.lx + wild.r) + 2, wild.ly), 0, 'past a wild isle\'s rim');
  assert.ok(Math.abs(etherHeightByte(wild.px, wild.py) - wild.peak) <= HEIGHT_NOISE, 'the peak at its centre');
  assert.equal(etherHeightByte(VEIL_X + 4, h.py), 0, 'the Veil\'s water');
  const sea = etherLargeMap(VEIL_X + 4, h.py);
  assert.equal(sea.length, 5); assert.ok(sea.every((c) => c instanceof Uint8Array && c.length === 5 && [...c].every((v) => v <= 1)), 'the open sea\'s detail never lifts it out');
  const land = etherLargeMap(h.px, h.py);
  assert.ok(land.some((c) => [...c].some((v) => v > 1)) && land.every((c) => [...c].every((v) => v <= 9)), 'the land\'s, 0..9');
  assert.equal(etherClimateAt(VEIL_X + 4, h.py), CLIMATES.Ocean);
  assert.equal(etherClimateAt(h.px, h.py), h.climate);
  assert.equal(CLIMATE_REACH_PX, 1.5);
  // PIN MOVED (AUDIT CAPTAIN'S SEA H1): its smaller isle's reach - the pixel past its bytes, where the kernel carries its land
  assert.equal(etherClimateAt(h.px + 1, h.py + 1), h.climate, 'a pixel past its rim wears it (the kernel carries its land there)');
  assert.equal(etherClimateAt(h.px + 3, h.py), CLIMATES.Ocean);
  assert.equal(isWaterPixel(etherClimateAt(h.px, h.py), etherHeightByte(h.px, h.py)), false, 'its centre is land to the map');
  assert.equal(isWaterPixel(etherClimateAt(h.px + 4, h.py), etherHeightByte(h.px + 4, h.py)), true);
  assert.equal(etherHeightByte(500, 250), 0, 'off the sea, nothing');
});

test('ETHER-SEA the composition: a prototype child of the reader it is handed - the sea\'s own in the law\'s box, the reader\'s to the byte else, the range reads through the overrides; the climate and the politic composed the same way (mutants: each arm, the box asked)', () => {
  const bay = Object.create(WoodsFile.prototype);
  bay.getHeightMapValue = (x, y) => 7 + ((x + y) & 3);
  bay.getLargeMapData = () => Array.from({ length: 5 }, () => new Uint8Array(5).fill(4));
  const g = etherWoods(bay);
  assert.equal(Object.getPrototypeOf(g), bay); assert.equal(g.isEtherGround, true); assert.equal(g.under, bay);
  for (const [x, y] of [[0, 0], [500, 250], [999, 499], [-300, 800]]) {
    assert.equal(g.getHeightMapValue(x, y), bay.getHeightMapValue(x, y), `the reader's own at ${x},${y}`);
    assert.equal(g.getLargeMapData(x, y)[0][0], 4);
  }
  const h = veilhaven();
  assert.equal(g.getHeightMapValue(h.px, h.py), etherHeightByte(h.px, h.py));
  assert.equal(g.getHeightMapValue(ETHER_BOX.x0 - 64, ETHER_BOX.y0), 0, 'the margin answers the sea');   // PIN MOVED (AUDIT CAPTAIN'S SEA G1): its margin 64
  assert.equal(g.getHeightMapValue(ETHER_BOX.x0 - 65, ETHER_BOX.y0), bay.getHeightMapValue(ETHER_BOX.x0 - 65, ETHER_BOX.y0));
  assert.equal(g.etherLaw, inEtherLaw, 'AUDIT CAPTAIN\'S SEA G5: the composition says where it answers the ground itself');
  assert.equal(g.getLargeMapData(VEIL_X + 4, h.py)[0][0] <= 1, true);
  const range = g.getHeightMapValuesRange1Dim(h.px - 2, h.py - 2, 4);
  assert.equal(range[2 * 4 + 2] ?? range[10], etherHeightByte(h.px, h.py), 'the range read through the override');
  const climate = etherClimateIndex(() => CLIMATES.Woodlands);
  assert.equal(climate(500, 250), CLIMATES.Woodlands); assert.equal(climate(h.px, h.py), h.climate); assert.equal(climate(VEIL_X + 4, h.py), CLIMATES.Ocean);
  const politic = etherPoliticIndex(() => 145, 19);
  assert.equal(politic(500, 250), 145); assert.equal(politic(h.px, h.py), 147, 'the region\'s politic: its index and 128');
});

test('ETHER-SEA through the kernel: the open sea all water, every port and ruin of a strip on a dry plateau (a place stands there), Veilhaven\'s landfall pixel all water and its centre all land (mutants: the peaks, the fall, the detail at sea)', () => {
  const w = etherWoods(seaWoods());
  assert.equal(seaShare(w, VEIL_X + 4, -5000), 0, 'the Veil');
  const h = veilhaven(), lf = landfall();
  assert.equal(seaShare(w, lf.px, lf.py), 0, 'the landfall\'s pixel, open water');
  assert.equal(seaShare(w, h.px, h.py), 1, 'the haven\'s own pixel, land');
  const places = strip(640, 700, 240, 270).filter((i) => i.kind === 'port' || i.kind === 'ruin');
  assert.ok(places.length > 30);
  for (const p of places) assert.ok(spawnPlateauFloor(w, p.px, p.py) > SPAWN_DRY_ELEVATION, `${p.name} (${p.kind}) stands dry`);
  let empty = null;
  for (let cx = 640; cx < 700 && !empty; cx++) if (!isleOfCell(cx, 255)) empty = cx;
  assert.equal(seaShare(w, ETHER_BOX.x0 + empty * ISLE_CELL_PX + 5, ETHER_BOX.y0 + 255 * ISLE_CELL_PX + 5), 0, 'an empty cell\'s middle, open water');
});

test('ETHER-SEA the crossing\'s waters: out on the open Abecean - west of CROSS_X, CROSS_LAND_PX pixels and more from any land - and never the sea\'s own; home through the Veil; the Bay\'s mouth the way home\'s fallback (mutants: the west, the land\'s distance, the box\'s refusal)', () => {
  // PIN MOVED (AUDIT CAPTAIN'S SEA X4): west of the Bay's mouth (its line crosses this row at about 243)
  assert.equal(CROSS_X, 230); assert.equal(CROSS_LAND_PX, 20);
  assert.equal(crossingWaters(200, 300, 20), true);
  assert.equal(crossingWaters(200, 300, 19), false, 'too near land');
  assert.equal(crossingWaters(229, 300, 30), true); assert.equal(crossingWaters(230, 300, 30), false, 'east of the mouth: the Bay itself');
  assert.equal(crossingWaters(HOME_WATERS.px, HOME_WATERS.py, Infinity), true, 'the way home\'s fallback is crossing water still');
  assert.equal(crossingWaters(-200, 300, Infinity), true, 'past the Bay\'s west edge, the Eltheric');
  assert.equal(crossingWaters(200, 300, NaN), false, 'a distance nobody measured');
  assert.equal(crossingWaters(200, -5000, Infinity), false, 'never in the sea\'s box - west of CROSS_X there too');
  assert.deepEqual({ ...HOME_WATERS }, { px: 180, py: 300 });
});

test('ETHER-SEA the goods the wild isles bear are the exchange\'s Eltheric goods, one for one (mutants: the list)', () => {
  assert.deepEqual([...ETHER_GOODS], GOODS.filter((g) => g.ether).map((g) => g.id));
});

test('ETHER-SEA the stream\'s other boxes: `streams` admits a pixel of a frame in StreamingWorldState.frames as it does the continent\'s, and none outside them (mutants: the arm, each edge)', () => {
  const was = StreamingWorldState.frames, wasFrame = StreamingWorldState.frame;
  try {
    StreamingWorldState.frame = null;
    StreamingWorldState.frames = [];
    assert.equal(StreamingWorldState.streams(1000, -5000), false);
    StreamingWorldState.frames = [etherFrame()];
    assert.equal(StreamingWorldState.streams(ETHER_BOX.x0, ETHER_BOX.y0), true);
    assert.equal(StreamingWorldState.streams(ETHER_BOX.x1 - 1, ETHER_BOX.y1 - 1), true);
    assert.equal(StreamingWorldState.streams(ETHER_BOX.x1, ETHER_BOX.y0), false);
    assert.equal(StreamingWorldState.streams(ETHER_BOX.x0 - 1, ETHER_BOX.y0), false);
    assert.equal(StreamingWorldState.streams(ETHER_BOX.x0, ETHER_BOX.y1), false);
    assert.equal(StreamingWorldState.streams(ETHER_BOX.x0, ETHER_BOX.y0 - 1), false);
    assert.equal(StreamingWorldState.streams(500, 250), true, 'the map\'s own as ever');
  } finally { StreamingWorldState.frames = was; StreamingWorldState.frame = wasFrame; }
});

test('ETHER-SEA the far ring: past the map it reads the host\'s climate where the host hands one (`climatePast`) - an isle in its own, the clamp\'s edge never (mutants: the arm)', () => {
  const heightBytes = new Uint8Array(1000 * 500);
  const h = veilhaven();
  const grid = (climatePast) => buildFarRingGrid({ heightBytes, mapWidth: 1000, mapHeight: 500, climateAt: () => CLIMATES.Mountain, baseX: h.px, baseY: h.py, radius: 2, byteAt: (x, y) => etherHeightByte(x, y), climatePast });
  const at = (g) => g.colors.slice(12 * 3, 12 * 3 + 3);   // the ring's middle vertex - the haven's centre
  const own = grid((x, y) => etherClimateAt(x, y)), clamped = grid(null);
  assert.notDeepEqual([...at(own)], [...at(clamped)], 'its own climate, not the edge\'s');
  const sea = grid((x, y) => etherClimateAt(x, y));
  assert.equal(sea.sea[0], 255, 'the open sea about it a sea vertex');
});

test('ETHER-SEA by source: the host composes the sea over the ground between the repairs and the client (its climate and its politic too) and streams its box; the worker composes its own copy on the client\'s word, through a pure module (mutants: the order, the word)', () => {
  const src = read('src/scenes/world.js');
  const i = src.indexOf('woods.syncHeightMapBytes();'), j = src.indexOf('const terrainGen = new TerrainGenClient({ woods, woodsBytes });');
  const between = src.slice(i, j);
  assert.match(between, /const etherSea = etherSeaOn\(\);/);
  assert.match(between, /woods = etherWoods\(woods\);/);
  assert.match(between, /maps\.getClimateIndex = etherClimateIndex\(maps\.getClimateIndex\.bind\(maps\)\);/);
  assert.match(between, /maps\.getPoliticIndex = etherPoliticIndex\(maps\.getPoliticIndex\.bind\(maps\), ETHER_REGION\);/);
  assert.match(between, /StreamingWorldState\.frames = etherSea \? \[etherFrame\(\)\] : \[\];/);
  assert.ok(between.indexOf('woods = groundWoods(woods);') < between.indexOf('woods = etherWoods(woods);'), 'over the continent\'s ground');
  // PIN MOVED (AUDIT CAPTAIN'S SEA G4/G9): the continent's past the map wherever it stands, the sea's in its law, the Bay edge's clamp else
  assert.match(src, /climatePast: tamrielLand \? \(x, y\) => maps\.getClimateIndex\(x, y\)\n\s+: etherSea \? \(x, y\) => maps\.getClimateIndex\(\.\.\.\(inEtherLaw\(x, y\) \? \[x, y\] : \[Math\.max\(0, Math\.min\(MAP_WIDTH - 1, x\)\), Math\.max\(0, Math\.min\(MAP_HEIGHT - 1, y\)\)\]\)\) : null,/);
  const worker = read('src/world/terrain/terrainGenWorker.js');
  assert.match(worker, /import \{ etherWoods \} from '\.\.\/ethericSea\.js';/);
  assert.match(worker, /if \(m\.ether\) woods = etherWoods\(woods\);/);
  const sea = read('src/world/ethericSea.js');
  assert.deepEqual([...sea.matchAll(/^import[^'"]*from ['"]([^'"]+)['"]/gm)].map((m) => m[1]), ['../formats/mapsTables.js'], 'worker-safe: formats alone');
  for (const bad of ['document', 'globalThis.', 'fetch(', 'localStorage', 'getPref']) assert.ok(!sea.includes(bad), `pure: no ${bad}`);
  const posted = [];
  new TerrainGenClient({ woods: etherWoods(seaWoods()), woodsBytes: new Uint8Array(16), workerFactory: () => ({ postMessage: (m) => posted.push(m), terminate() {} }) });
  assert.equal(posted[0].ether, true, 'the client\'s word');
  new TerrainGenClient({ woods: seaWoods(), woodsBytes: new Uint8Array(16), workerFactory: () => ({ postMessage: (m) => posted.push(m), terminate() {} }) });
  assert.equal(posted[1].ether, false);
});

test('ETHER-LIGHT the light past the Veil: cold and violet - the ambient leaned to ETHER_LIGHT_TINT, the sun to ETHER_KEY_TINT, by the weight; nothing made at none (the light handed in handed back); the world leans both lights in the sea alone, the sky\'s dome its own (mutants: each tint, the weight, the gate)', () => {
  assert.deepEqual([...ETHER_LIGHT_TINT], [0.88, 0.9, 1.14]); assert.deepEqual([...ETHER_KEY_TINT], [0.95, 0.93, 1.07]);
  const rgb = new Float32Array([0.5, 0.6, 0.7]);
  assert.equal(etherLight(rgb, 0), rgb); assert.equal(etherLight(rgb, NaN), rgb);
  assert.deepEqual([...etherLight(rgb, 1)], [...new Float32Array([0.5 * 0.88, 0.6 * 0.9, 0.7 * 1.14])]);
  assert.deepEqual([...etherLight(rgb, 0.5, ETHER_KEY_TINT)], [...new Float32Array([0.5 * 0.975, 0.6 * 0.965, 0.7 * 1.035])]);
  assert.deepEqual([...etherLight(rgb, 7)], [...etherLight(rgb, 1)], 'the weight kept to one');
  assert.deepEqual([...rgb], [...new Float32Array([0.5, 0.6, 0.7])], 'never written');
  assert.ok(etherLight([0.5, 0.6, 0.7], 0) instanceof Float32Array);
  const src = read('src/scenes/world.js');
  assert.match(src, /const etherAirW = etherPx && inEther\(etherPx\.x, etherPx\.y\) \? 1 : 0;/);
  assert.match(src, /etherLight\(sdBrassLight\(sunbabyLight\(/, 'the ambient');
  assert.match(src, /etherLight\(sdBrassLight\(sunbabyKey\(dreadLight\(SUN_RIG_COLOR, skyDreadW\), sunbabyW, sunbabyFace\.evil\), sdAirW\), etherAirW, ETHER_KEY_TINT\)\);/, 'the sun');
});
