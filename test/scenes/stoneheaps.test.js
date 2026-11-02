// STONE-HEAPS (AUDIT TAMRIEL-NODES, bible/03-World/World-Wide.md): a boulder is a World of Daggerfall rock field's piece,
// and the fields stand on the Bay alone (scenes/pixelBuild.js TAMRIEL2), so past the Bay no boulder ever stood - WW-C1's
// stone-rich provinces stood none, and the Overworld's Mining groups counted veins alone. Where no field stands a boulder
// is a heap on the stone, as a vein with no piece is, and the heaps and the veins there keep NODE_SPACING_M apart where
// the stone allows. The zones' own ground is the terrain kernel's (the continent is authored, so no ARENA2 is read).
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createGatherHost, GROUP_REFRESH_MS, groupLabel } from '../../src/scenes/gatherHost.js';
import { herbKind } from '../../src/scenes/herbHost.js';
import { mineKind, standMineNodes, NODE_SPACING_M, VEIN_STONE_REACH } from '../../src/scenes/mineHost.js';
import { treeKind } from '../../src/scenes/treeHost.js';
import { boulders, veins, utcDayOfMs } from '../../src/net/nodeLaw.js';
import { WoodsFile } from '../../src/formats/woodsFile.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';
import { groundWoods, tamrielClimateAt, groundPoliticIndex } from '../../src/world/tamriel/tamrielGround.js';
import { generatePixelTerrain } from '../../src/world/terrain/terrainGen.js';
import { isTreeRecord } from '../../src/world/terrain/terrainNature.js';
import { tamrielBiomeAt } from '../../src/world/tamriel/tamrielBiomes.js';
import { getWorldClimateSettings, CLIMATES } from '../../src/formats/mapsFile.js';
import { TERRAIN_SIZE, HEIGHTMAP_DIMENSION } from '../../src/world/terrain/terrainSampler.js';
import { WORLD_MAP_TILE_DIM } from '../../src/world/terrain/terrainTiles.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const NOON_MS = (20500 * 86_400 + 43_200) * 1000;
const DAY = utcDayOfMs(NOON_MS);
const tick = () => new Promise((r) => setImmediate(r));
const wf = new WoodsFile();
assert.equal(wf.load(syntheticWoodsBytes()), true);
const woods = groundWoods(wf);
const politic = groundPoliticIndex(() => 0);
/** A pixel's ground as the game reads it past the Bay: its zone's climate, its province's region. */
const infoAt = (px, py) => ({ climate: tamrielClimateAt(px, py), region: politic(px, py) - 128 });

/** A stone zone of each province with boulders in its law (Black Marsh's swamps and rainforest stand none), a pixel
 *  inside it whole. */
const ZONES = Object.freeze([
  ['skyrimReach', 1426, -547], ['hammerfellAlikr', 290, 501], ['cyrodiilGoldCoast', 1806, 897], ['morrowindAshlands', 3752, -449],
  ['highRockNorthpoint', 366, -485], ['elsweyrAnequina', 1952, 1427], ['summersetEtonNir', 0, 1713], ['valenwoodReapersMarch', 1588, 1265],
]);
const _ground = new Map();
/** The kernel's ground for a pixel past the Bay, its zone's own flats - pixelBuild.js's call, its lands and woods on. */
function ground(px, py) {
  const k = `${px},${py}`;
  if (!_ground.has(k)) {
    const c = getWorldClimateSettings(tamrielClimateAt(px, py));
    _ground.set(k, generatePixelTerrain({ woods, px, py, tilemap: new Uint8Array(128 * 128), climateType: c.climateType,
      forests: { archive: c.natureArchive, hidden: false }, lands: { blend: false, archive: c.natureArchive, hidden: false }, landform: false }));
  }
  return _ground.get(k);
}
const apart = (nodes) => {
  const close = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (Math.hypot(nodes[i].local[0] - nodes[j].local[0], nodes[i].local[2] - nodes[j].local[2]) < NODE_SPACING_M) close.push([nodes[i].key, nodes[j].key]);
  return close;
};

test('STONE-HEAPS: past the Bay each province\'s stone zone stands its boulders as heaps on its own ground, with no rock field - all but one at most, on confirmed ground and not - and every mining node NODE_SPACING_M from the next; the veins the heaps take none of; the Bay\'s rule (fields) stands none there (mutants: the heap unstood; the heaps unspaced)', () => {
  let stood = 0, law = 0;
  for (const [key, px, py] of ZONES) {
    assert.equal(tamrielBiomeAt(px, py)?.key, key, `${px},${py} is still ${key}`);
    const { climate, region } = infoAt(px, py), g = ground(px, py);
    for (const confirmed of [false, true]) {
      const p = { px, py, day: DAY, climate, region, confirmed, samples: g.samples, tilemap: g.tilemap, rocks: [] };
      const nodes = standMineNodes({ ...p, fields: false });
      const heaps = nodes.filter((n) => n.what === 'boulder'), want = boulders({ x: px, y: py, day: DAY, climate, region, confirmed });
      assert.ok(want.length > 0, `${key}: its law stands boulders`);
      assert.ok(heaps.length >= want.length - 1, `${key}${confirmed ? ' (confirmed)' : ''}: ${heaps.length} of ${want.length} boulders stood`);
      assert.ok(heaps.every((h) => want.some((b) => h.key.endsWith(`:${b.slot}`) && h.tier === b.tier && h.material === b.material) && h.rock === null && Number.isFinite(h.local[1])), `${key}: the law's boulders, no piece`);
      assert.ok(heaps.every((h) => h.local[0] >= 0 && h.local[0] <= TERRAIN_SIZE && h.local[2] >= 0 && h.local[2] <= TERRAIN_SIZE), `${key}: on its own pixel`);
      assert.deepEqual(apart(nodes), [], `${key}: every mining node ${NODE_SPACING_M} m apart`);
      const bay = standMineNodes({ ...p, fields: true });
      assert.equal(bay.filter((n) => n.what === 'boulder').length, 0, `${key}: the Bay's rule - a boulder is a field's piece`);
      assert.equal(nodes.filter((n) => n.what === 'vein').length, bay.filter((n) => n.what === 'vein').length, `${key}: the heaps cost the veins none`);
      stood += heaps.length; law += want.length;
    }
  }
  assert.ok(stood >= law * 0.9, `${stood} of ${law} boulders stood past the Bay`);
});

/** A pixel of water with a row of `width` flat stone tiles from tile `a` east - the one stone a node can stand on. */
function patch(a, width) {
  const tilemap = new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM);
  for (let i = 0; i < width; i++) tilemap[a[1] * WORLD_MAP_TILE_DIM + a[0] + i] = 3;
  return { samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap };
}
const tileOf = (p) => [Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(p.u * WORLD_MAP_TILE_DIM)), Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(p.v * WORLD_MAP_TILE_DIM))];
const reaches = (t, a) => (a[0] - t[0]) ** 2 + (a[1] - t[1]) ** 2 <= VEIN_STONE_REACH ** 2;
const MOUNTAIN = CLIMATES.Mountain, PX = 1426, PY = -547;
/** The first day from DAY whose `nB` boulders and `nV` veins (the lowest slots that fit) reach every tile of a `width`
 *  patch west of it, and no other node any - so those alone stand, in the law's order: the heaps, then the veins. */
function sceneOf(nB, nV, width) {
  for (let day = DAY; day < DAY + 4000; day++) {
    const bs = boulders({ x: PX, y: PY, day, climate: MOUNTAIN }).map(tileOf), vs = veins({ x: PX, y: PY, day, climate: MOUNTAIN }).map(tileOf);
    const all = [...bs.map((t) => ({ t, b: true })), ...vs.map((t) => ({ t, b: false }))];
    for (const lead of all) {
      const a = [lead.t[0] + 1, lead.t[1]];
      if (a[0] + width >= WORLD_MAP_TILE_DIM - 1) continue;
      const tiles = Array.from({ length: width }, (_, i) => [a[0] + i, a[1]]);
      const inside = all.filter((n) => tiles.some((p) => reaches(n.t, p)));
      if (!inside.every((n) => n.t[0] < a[0] && tiles.every((p) => reaches(n.t, p)))) continue;
      if (inside.filter((n) => n.b).length === nB && inside.filter((n) => !n.b).length === nV) return { day, a };
    }
  }
  throw new Error('no day fits');
}
const standOn = ({ day, a }, width) => standMineNodes({ px: PX, py: PY, day, climate: MOUNTAIN, rocks: [], fields: false, ...patch(a, width) });

test('STONE-HEAPS spacing: two heaps never share a tile - of two boulders reaching one stone tile the first stands, the second none; a heap and two veins on a row of three stand one a tile, in the law\'s order; on one tile the veins still stand where they stood before, by the heap (mutants: a heap unspaced; a heap\'s foot untaken; a vein unspaced; a vein\'s foot untaken; a vein lost to the spacing)', () => {
  const at = (n) => [Math.round(n.local[0] / (TERRAIN_SIZE / WORLD_MAP_TILE_DIM)), Math.round(n.local[2] / (TERRAIN_SIZE / WORLD_MAP_TILE_DIM))];
  const h = sceneOf(2, 0, 1), two = standOn(h, 1);
  assert.deepEqual(two.map((n) => [n.what, ...at(n)]), [['boulder', ...h.a]], 'one heap on the one tile');
  const v = sceneOf(1, 2, 3), row = standOn(v, 3);
  assert.deepEqual(row.map((n) => [n.what, ...at(n)]).sort((p, q) => p[1] - q[1]), [['boulder', ...v.a], ['vein', v.a[0] + 1, v.a[1]], ['vein', v.a[0] + 2, v.a[1]]], 'a heap, then the veins east of it');
  assert.deepEqual(apart(row), []);
  const one = standOn(v, 1);
  assert.deepEqual(one.map((n) => [n.what, ...at(n)]).sort(), [['boulder', ...v.a], ['vein', ...v.a], ['vein', ...v.a]], 'the veins where the stone is, unspaced');
});

/** The real gathering host over pixels whose ground is handed in, its clock the test's; `pixelInfo` the game's reader. */
async function stage(entries, info, fact = () => ({ state: 'none' })) {
  const S = { now: NOON_MS };
  const book = {
    state: { open: true, today: {}, caps: { stores: 5000 } },
    stale: () => false, refresh: async () => ({ ok: true }), pixel: fact, askPixels: async () => [], pump: () => {},
    dungeon: () => null, askDungeon: async () => false, held: () => 0, taken: () => false, counting: () => false,
    track: () => ({ rank: 100, specs: { 50: null, 100: null } }), harvest: () => new Promise(() => {}),
  };
  const renderer = { createBillboardBatch: () => ({}), destroyBatch: () => {}, moveBillboardBatch: () => true };
  const built = new Map(entries.map((e) => [`${e.px},${e.py}`, e]));
  S.host = createGatherHost({
    book, kinds: [herbKind({ book }), mineKind({ book }), treeKind({ book, renderer })],
    hud: { setPrompt: () => {}, setMeter: () => {}, toast: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} },
    renderer, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = (x - entries[0].px) * TERRAIN_SIZE; out[1] = 0; out[2] = (entries[0].py - y) * TERRAIN_SIZE; return out; },
    pixelInfo: info, nowMs: () => S.now,
    eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), view: () => ({ yaw: 0, pitch: 0 }), feet: () => [0, 0, 0], entity: () => ({ items: [] }),
    keyLabel: () => 'E', input: () => ({ held: false, attack: false, choice: false }), active: () => true, activeDungeon: () => false,
  });
  for (const e of built.values()) S.host.onBuilt(e);
  await tick(); await tick();
  S.mid = (e) => [(e.px - entries[0].px + 0.5) * TERRAIN_SIZE, 0, (entries[0].py - e.py + 0.5) * TERRAIN_SIZE];
  return S;
}
/** A built pixel past the Bay as pixelBuild.js publishes it there: the kernel's ground, its forest's Tree flats, no rock. */
function builtPast(px, py) {
  const g = ground(px, py), c = getWorldClimateSettings(tamrielClimateAt(px, py));
  const trees = g.nature.filter((f) => isTreeRecord(f.archive ?? c.natureArchive, f.record)).map((f, i) => ({ id: i, group: 'g', i, x: f.x, y: f.y, z: f.z, wood: f.wood ?? 0 }));
  const forest = { base: c.natureArchive, archive: c.natureArchive, trees, groups: new Map([['g', { batch: {}, centers: trees.map((t) => [t.x, t.y, t.z]), size: { w: 4, h: 8 } }]]) };
  return { px, py, samples: g.samples, tilemap: g.tilemap, locationRect: null, batches: [], rocks: [], forest };
}

test('STONE-HEAPS on the Overworld: through the real gathering host a pixel past the Bay stands its heaps, and its Mining group counts them with its veins - beside its Herbalism and, where wood grows, its Logging - on confirmed ground and not (mutants: Mining\'s kind reads the Bay\'s rule everywhere)', async () => {
  for (const [key, px, py] of [ZONES[0], ZONES[1], ZONES[2]]) {
    const entry = builtPast(px, py), info = infoAt(px, py);
    for (const confirmed of [false, true]) {
      const s = await stage([entry], () => info, confirmed ? () => ({ state: 'confirmed', ...info }) : undefined);
      try {
        const mine = s.host.nodesOf(px, py).filter((n) => n.kind === 'mine');
        const heaps = mine.filter((n) => n.what === 'boulder');
        assert.ok(heaps.length >= boulders({ x: px, y: py, day: DAY, climate: info.climate, region: info.region, confirmed }).length - 1 && heaps.length > 0, `${key}: ${heaps.length} heaps`);
        s.now += GROUP_REFRESH_MS + 1;
        const groups = s.host.overworldGroups(s.mid(entry));
        const kinds = groups.map((m) => m.kind).sort();
        assert.deepEqual(kinds, info.climate === CLIMATES.Desert ? ['gather herbalism', 'gather mining'] : ['gather herbalism', 'gather logging', 'gather mining'], `${key}: its groups`);
        assert.equal(groups.find((m) => m.kind === 'gather mining').label, groupLabel('mining', mine.length), `${key}: the heaps in Mining's count`);
      } finally { s.host.dispose(); }
    }
  }
});

test('STONE-HEAPS the Bay as it was: on the same stone and the same climate a Bay pixel with no rock field stands no boulder, and one past the Bay its heaps - Mining\'s kind reads the fields off the Bay\'s ground, the ground pixelBuild.js stands World of Daggerfall\'s sites on (mutants: the Bay\'s pixel heaped; the rule never the Bay\'s)', async () => {
  const flat = (px, py) => ({ px, py, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5), tilemap: new Uint8Array(128 * 128).fill(3), locationRect: null, batches: [], rocks: [], forest: null });
  const info = () => ({ climate: CLIMATES.Mountain, region: 16 });
  for (const [px, py, bay] of [[405, 150, true], [1426, -547, false]]) {
    const s = await stage([flat(px, py)], info);
    try {
      const heaps = s.host.nodesOf(px, py).filter((n) => n.kind === 'mine' && n.what === 'boulder');
      assert.equal(heaps.length, bay ? 0 : boulders({ x: px, y: py, day: DAY, climate: CLIMATES.Mountain }).length, `${px},${py}: ${heaps.length} heaps`);
    } finally { s.host.dispose(); }
  }
  // the day rock fields stand past the Bay, `fields` is theirs to read again
  assert.match(read('src/scenes/pixelBuild.js'), /if \(picks\.length && onTheBay\(px, py\)\) \{ wodPicks = picks;/);
  assert.match(read('src/scenes/mineHost.js'), /const fields = inBay\(px, py\);/);
});
