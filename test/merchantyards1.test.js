// MERCHANT-YARDS (2026-10-10): EVERY CITY'S AND TOWN'S STABLE AND WAGON YARD - systems/merchantYards.js (the trade, the
// keepers, the towns), world/merchantYardSites.js (where they stand), world/merchantYardModels.js and
// world/merchantYardArt.js (what they are made of), scenes/merchantYardsHost.js (the pool), the General Store's shelf
// they took the horse, the cart and the wagons from, and the wiring in the four hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  YARD_KIND_ORDER, YARD_KINDS, YARD_QUALITY, YARD_TOWN_TYPES, YARD_TEXT, YARD_ROWS, isYardTown, yardStock, yardBuysItem,
  yardKeeper, yardName, yardCounter, peopleRaceOf, validYardKind,
} from '../src/systems/merchantYards.js';   // peopleRaceOf re-exported from characters/mobilePerson.js
import {
  YARD_FOOT, YARD_PAD_M, BUILDING_CLEAR_M, PROP_CLEAR_M, FLAT_CLEAR_M, YARD_GAP_M, FRONT_ROAD_CELLS, NO_ROAD_COST, YARD_TURNS,
  yardSpans, yardGround, yardSite, yardSitesOn, yardSitesOf, carveYards,
} from '../src/world/merchantYardSites.js';
import { buildYardModel, SIGN_BOARD, STABLE_YARD, WAGON_YARD, YARD_FLOOR_Y, signBoxOf, yardPoints } from '../src/world/merchantYardModels.js';
import { yardArt, yardSignArt, YARD_ARCHIVE, YARD_REC, SIGN_GLYPHS, signGlyph, SIGN_ART_W, SIGN_ART_H, YARD_ART_SIZE } from '../src/world/merchantYardArt.js';
import { createMerchantYards, yardToScene, yardBoxToScene, feetInYard, YARD_REACH } from '../src/scenes/merchantYardsHost.js';
import { YARD_MARGIN } from '../src/scenes/homeYards.js';
import { stockShopShelf, SHOP_BUYS_GROUPS, shopBuysItem, TRANSPORT_HORSE, TRANSPORT_SMALL_CART } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { CityNavigation, NAV_CELL } from '../src/world/cityNavigation.js';
import { ROAD_WEIGHT } from '../src/systems/gothwayBoards.js';
import { WAGON_KINDS } from '../src/systems/wagonKinds.js';
import { getSeed, setSeed } from '../src/formats/dfRandom.js';
import { trs } from '../src/world/mat4.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { STATIC_NPC_ACTIVATION_DISTANCE, RAY_DISTANCE } from '../src/player/activate.js';
import { PERSON_TEXTURES } from '../src/characters/mobilePerson.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

/** A navgrid of `w` x `h` cells, every cell `weight` (CityNavigation's shape: weightAt). */
function grid(w, h, weightAt = () => 1) {
  return { width: w, height: h, weightAt: (gx, gy) => (gx < 0 || gy < 0 || gx >= w || gy >= h ? 0 : weightAt(gx, gy)) };
}
/** The cells a placed site covers. */
const cellsOf = (s) => { const out = []; for (let gy = s.gy; gy < s.gy + s.nz; gy++) for (let gx = s.gx; gx < s.gx + s.nx; gx++) out.push([gx, gy]); return out; };

test('MERCHANT-YARDS THE TOWNS: Daggerfall\'s cities and towns (TownCity, TownHamlet) stand both yards; no village, farm or manor does', () => {
  assert.deepEqual(YARD_KIND_ORDER, ['stable', 'transport']);
  assert.deepEqual([...YARD_TOWN_TYPES], [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet]);
  const at = (t) => isYardTown({ mapTableData: { locationType: t } });
  assert.deepEqual([at(LOCATION_TYPES.TownCity), at(LOCATION_TYPES.TownHamlet), at(LOCATION_TYPES.TownVillage), at(LOCATION_TYPES.HomeFarms), at(LOCATION_TYPES.HomeWealthy), at(LOCATION_TYPES.DungeonKeep)],
    [true, true, false, false, false, false]);
  assert.equal(isYardTown(null), false);
  assert.deepEqual([validYardKind('stable'), validYardKind('transport'), validYardKind('barn'), validYardKind(null)], ['stable', 'transport', null, null]);
});

test('MERCHANT-YARDS THE STOCK: the Stable sells a Horse, the Wagon Yard the Small Cart, the Open Wagon and the Caravan - each row minted as a shelf mints it, a fresh list every Buy (mutants: a horse at the wagon yard; the list kept)', () => {
  const s = yardStock('stable');
  assert.deepEqual(s.map((it) => [it.group, it.templateIndex, it.name]), [['Transportation', TRANSPORT_HORSE, 'Horse']]);
  assert.ok(s[0].value > 0 && s[0].maxCondition > 0 && s[0].currentCondition === s[0].maxCondition, 'named, valued and whole, as a shelf\'s row');
  const t = yardStock('transport');
  assert.deepEqual(t.map((it) => [it.templateIndex, it.wagonKind ?? null, it.value]), [[TRANSPORT_SMALL_CART, null, 150], [TRANSPORT_SMALL_CART, 'openWagon', WAGON_KINDS.openWagon.value], [TRANSPORT_SMALL_CART, 'caravan', WAGON_KINDS.caravan.value]]);
  assert.notEqual(yardStock('stable')[0], s[0], 'a yard never sells out: each Buy mints its stock afresh');
  assert.deepEqual(yardStock('barn'), []);
});

test('MERCHANT-YARDS WHAT EACH BUYS: the Stable a horse alone, the Wagon Yard a cart or a wagon of any kind alone - its counter the trade window reads (mutants: the stable buys carts; the yard buys a horse)', () => {
  const horse = yardStock('stable')[0], [cart, open, caravan] = yardStock('transport'), sword = { group: 'Weapons', templateIndex: 113 };
  assert.deepEqual([horse, cart, open, caravan, sword].map((it) => yardBuysItem('stable', it)), [true, false, false, false, false]);
  assert.deepEqual([horse, cart, open, caravan, sword].map((it) => yardBuysItem('transport', it)), [false, true, true, true, false]);
  assert.deepEqual([yardBuysItem('barn', horse), yardBuysItem('stable', null)], [false, false]);
  const c = yardCounter('transport', 17);
  assert.deepEqual([c.buildingType, c.quality, c.regionIndex, c.yard, c.buildingKey], ['yard:transport', YARD_QUALITY, 17, 'transport', 0]);
  assert.deepEqual([c.accepts(caravan), c.accepts(horse)], [true, false]);
  assert.equal(YARD_QUALITY, 10, 'a middling counter, the same in every town');
  assert.equal(SHOP_BUYS_GROUPS[c.buildingType], undefined, 'no table of Daggerfall\'s is keyed by a yard\'s type');
});

test('MERCHANT-YARDS THE GENERAL STORE: no horse, no cart and no wagon on any shelf, at any quality, online or off - and it buys none back (mutants: the horse back on the shelf; Transportation back in its list)', () => {
  const where = globalThis.location;
  try {
    for (const search of ['', '?online']) {
      globalThis.location = { search };
      for (const quality of [1, 10, 20]) for (const shelfIndex of [0, 1]) {
        const shelf = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality }, { items: [], level: 1 }, { rolls: () => 0.5, torchesFromItems: false, shelfIndex });
        assert.equal(shelf.some((it) => it.group === 'Transportation'), false, `quality ${quality}, shelf ${shelfIndex}, ${search || 'offline'}`);
      }
    }
  } finally { globalThis.location = where; }
  assert.equal(SHOP_BUYS_GROUPS[BUILDING_TYPES.GeneralStore].includes('Transportation'), false);
  assert.equal(shopBuysItem(BUILDING_TYPES.GeneralStore, yardStock('transport')[0]), false);
  assert.equal(shopBuysItem(BUILDING_TYPES.GeneralStore, { group: 'Books', templateIndex: 277 }), true, 'the rest of its list stands');
});

test('MERCHANT-YARDS THE KEEPER: named on the region\'s bank on the town and the kind\'s seed - the same keeper on every client, DFU\'s stream put back; the yard named for them', () => {
  setSeed(12345);
  const a = yardKeeper(4242, 'stable', 17), b = yardKeeper(4242, 'stable', 17), c = yardKeeper(4242, 'transport', 17);
  assert.equal(getSeed(), 12345, 'the global stream untouched');
  assert.deepEqual(a, b, 'the same town and kind, the same keeper');
  assert.notDeepEqual(a, c, 'the two yards keep two keepers');
  assert.ok(a.name.length > 2 && ['male', 'female'].includes(a.sex) && a.variant >= 0 && a.variant < 4);
  assert.equal(yardName('stable', 'Gwynara Moorhart'), 'Moorhart\'s Stables');
  assert.equal(yardName('transport', 'Jalib'), 'Jalib\'s Wagon Yard', 'a bank with no surname: the name');
  assert.equal(yardName('stable', ''), 'The Stables');
  assert.deepEqual([0, 1, 2, 3, undefined].map(peopleRaceOf), ['Nord', 'Breton', 'Redguard', 'Breton', 'Breton']);
  assert.ok(PERSON_TEXTURES[peopleRaceOf(0)].male.length === 4, 'four outfits to a race and sex - the variant\'s range');
});

test('MERCHANT-YARDS THE PLACE: its own ground open and off every road, a ring round it open (a road allowed there), its front onto a road, nearest the middle (mutants: a road under it; the ring unread; the front unread)', () => {
  // 128 x 128 cells of grass, a road two cells wide across row 64
  const g = yardGround(grid(128, 128, (x, y) => (y === 64 || y === 65 ? ROAD_WEIGHT : 1)));
  const s = yardSite(g, 'stable');
  const pad = Math.ceil(YARD_PAD_M / NAV_CELL - 1e-9);
  assert.ok(s, 'placed');
  const [nx, nz] = yardSpans('stable', s.turn);
  assert.deepEqual([s.nx, s.nz], [nx, nz]);
  for (const [gx, gy] of cellsOf(s)) assert.equal(g.road[gy * 128 + gx], 0, 'no road under it');
  // its front faces the road: within FRONT_ROAD_CELLS of its front edge
  const frontRow = s.turn === 0 ? s.gy + s.nz : s.gy - 1;
  assert.ok([0, 2].includes(s.turn), 'the road runs across x: it faces along z');
  assert.ok(Math.abs(frontRow - 64.5) <= FRONT_ROAD_CELLS, 'its gate onto the street');
  // the ring may be road; nothing else under the ring is closed
  for (let gy = s.gy - pad; gy < s.gy + s.nz + pad; gy++) for (let gx = s.gx - pad; gx < s.gx + s.nx + pad; gx++) assert.equal(g.blocked[gy * 128 + gx], 0);
  assert.deepEqual([s.x, s.z], [(s.gx + s.nx / 2) * NAV_CELL, (s.gy + s.nz / 2) * NAV_CELL]);
  assert.equal(s.yaw, YARD_TURNS[s.turn]);
  // a place facing no road loses to one facing a road up to NO_ROAD_COST cells further out: a road at row 76, the middle
  // open - the middle (no road before it) costs 12, a place whose gate opens on row 76 about 8 - so the road's wins
  assert.equal(NO_ROAD_COST, 12);
  const off = yardSite(yardGround(grid(128, 128, (x, y) => (y === 76 ? ROAD_WEIGHT : 1))), 'stable');
  const strip = off.turn === 0 ? [off.gy + off.nz, off.gy + off.nz + FRONT_ROAD_CELLS - 1] : off.turn === 2 ? [off.gy - FRONT_ROAD_CELLS, off.gy - 1] : null;
  assert.ok(strip && strip[0] <= 76 && 76 <= strip[1], 'its gate opens on the road, not the middle\'s open ground');
  const noRoad = yardSite(yardGround(grid(128, 128)), 'stable');
  assert.ok(noRoad, 'a town with no road still stands it');
  assert.ok(Math.hypot(noRoad.gx + noRoad.nx / 2 - 64, noRoad.gy + noRoad.nz / 2 - 64) < 1, 'and at its middle');
  // the ring: two walls eight cells apart round the middle - a yard turned to fit between them exactly has no ring, so it
  // stands clear of both, its ring on open ground
  const walls = yardGround(grid(128, 128, (x) => (x === 60 || x === 69 ? 0 : 1)));
  const clear = yardSite(walls, 'stable');
  for (let gy = clear.gy - pad; gy < clear.gy + clear.nz + pad; gy++) for (let gx = clear.gx - pad; gx < clear.gx + clear.nx + pad; gx++) assert.equal(walls.blocked[gy * 128 + gx], 0, 'its ring open');
  // nothing open: no place
  assert.equal(yardSite(yardGround(grid(128, 128, () => ROAD_WEIGHT)), 'stable'), null, 'all road: none');
  assert.equal(yardSite(yardGround(grid(8, 8)), 'stable'), null, 'too small: none');
  // the turns: the spans swap with a quarter turn
  assert.deepEqual(yardSpans('transport', 1), [...yardSpans('transport', 0)].reverse());
});

test('MERCHANT-YARDS THE MEASURES: a building kept BUILDING_CLEAR_M away (HOME-YARD\'s lot margin), a prop PROP_CLEAR_M, a flat FLAT_CLEAR_M, a palace\'s block whole, the monument\'s ground (mutants: no building clearance; a palace\'s court taken)', () => {
  assert.equal(BUILDING_CLEAR_M, YARD_MARGIN, 'no yard stands on a lot a player may decorate');
  assert.deepEqual([PROP_CLEAR_M, FLAT_CLEAR_M], [1, 0.8]);
  const g = yardGround(grid(128, 128), { buildings: [[60, 10, 70, 20]], props: [[20, 20, 21, 21]], flats: [[50, 50]], closedBlocks: [[1, 1]], keep: [[30, 150, 4]] });
  const at = (x, z) => g.blocked[Math.floor(z / NAV_CELL) * 128 + Math.floor(x / NAV_CELL)];
  assert.deepEqual([at(65, 15), at(60 - BUILDING_CLEAR_M + 0.5, 15), at(60 - BUILDING_CLEAR_M - 1.2, 15)], [1, 1, 0], 'the building and its margin; past it open');
  assert.deepEqual([at(20.5, 20.5), at(19.3, 20.5), at(17.5, 20.5)], [1, 1, 0], 'a prop and its metre');
  assert.deepEqual([at(50, 50), at(53, 50)], [1, 0], 'a flat\'s foot');
  assert.deepEqual([at(102.4 + 1, 102.4 + 1), at(204.8 - 1, 204.8 - 1), at(102.4 - 1, 102.4 + 1)], [1, 1, 0], 'the palace\'s block whole');
  assert.deepEqual([at(30, 150), at(30, 156)], [1, 0], 'the monument\'s disc');
  // and a yard placed on it never comes near the building
  const s = yardSite(g, 'stable');
  const F = YARD_FOOT.stable, half = s.turn % 2 ? [F.hz, F.hx] : [F.hx, F.hz];
  const gap = Math.max(60 - (s.x + half[0]), s.x - half[0] - 70, 10 - (s.z + half[1]), s.z - half[1] - 20);
  assert.ok(gap >= BUILDING_CLEAR_M - NAV_CELL, `its ground ${gap.toFixed(1)} m from the building`);
});

test('MERCHANT-YARDS BOTH YARDS: the Stable first, the Wagon Yard on what is left, YARD_GAP_M clear of it - never on one another; a laid-out town read as the people\'s navgrid is', () => {
  const g = yardGround(grid(128, 128, (x, y) => (y === 64 || y === 65 ? ROAD_WEIGHT : 1)));
  const sites = yardSitesOn(g);
  assert.deepEqual(sites.map((s) => s.kind), ['stable', 'transport']);
  const [a, b] = sites, gap = Math.ceil(YARD_GAP_M / NAV_CELL - 1e-9);
  const apart = b.gx >= a.gx + a.nx + gap || a.gx >= b.gx + b.nx + gap || b.gy >= a.gy + a.nz + gap || a.gy >= b.gy + b.nz + gap;
  assert.ok(apart, 'YARD_GAP_M between them');
  // a town laid out: one block of grass, its automap closing its west half (a building), a road along a ground row
  const auto = new Uint8Array(64 * 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (x < 20) auto[y * 64 + x] = 1;
  const tiles = Array.from({ length: 16 }, (_, tx) => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: ty === 8 ? 46 : 2 })));
  const loc = { width: 1, height: 1, blocks: [{ x: 0, y: 0, dfBlock: { rmbBlock: { fldHeader: { autoMapData: auto, groundData: { groundTiles: tiles } } } } }] };
  const nav = new CityNavigation(1, 1);
  nav.setBlockData(0, 0, auto, (tx, ty) => tiles[tx][ty].textureRecord, { enhancedWater: true });
  assert.deepEqual(yardSitesOf(loc), yardSitesOn(yardGround(nav)), 'the same ground the people walk');
  for (const s of yardSitesOf(loc)) for (const [gx] of cellsOf(s)) assert.ok(gx >= 20, 'never on the built half');
  assert.deepEqual(yardSitesOf({ width: 0, height: 0, blocks: [] }), []);
});

test('MERCHANT-YARDS THE CARVE: the people\'s navgrid closed over each yard\'s own ground, and only there', () => {
  const nav = new CityNavigation(1, 1);
  nav.grid.fill(1 << 4);
  const s = { gx: 10, gy: 12, nx: 4, nz: 3 };
  assert.equal(carveYards(nav, [s]), 12);
  assert.deepEqual([nav.weightAt(10, 12), nav.weightAt(13, 14), nav.weightAt(9, 12), nav.weightAt(14, 12), nav.weightAt(10, 15)], [0, 0, 1, 1, 1]);
  assert.equal(carveYards(nav, [s]), 0, 'closed once');
  assert.equal(carveYards(null, [s]), 0);
});

test('MERCHANT-YARDS THE TIMBER: both yards the port\'s own geometry inside their ground (its ring for the eaves), in the port\'s own pictures, the sign hung over a walker\'s head, the wagons\' places inside the fence', () => {
  for (const kind of YARD_KIND_ORDER) {
    const m = buildYardModel(kind), F = YARD_FOOT[kind];
    assert.ok(m.positions.length > 0 && m.positions.every(Number.isFinite), `${kind}: built`);
    assert.equal(m.indices.length, m.positions.length / 3);
    for (let i = 0; i < m.positions.length; i += 3) {
      assert.ok(Math.abs(m.positions[i]) <= F.hx + YARD_PAD_M && Math.abs(m.positions[i + 2]) <= F.hz + YARD_PAD_M, `${kind}: inside its ground and ring`);
    }
    assert.ok(m.subMeshes.every((s) => s.textureArchive === YARD_ARCHIVE && Object.values(YARD_REC).includes(s.textureRecord)));
    const recs = m.subMeshes.map((s) => s.textureRecord);
    assert.ok(recs.includes(kind === 'stable' ? YARD_REC.signStable : YARD_REC.signTransport), `${kind}: its own signboard`);
    assert.ok(recs.includes(kind === 'stable' ? YARD_REC.dirt : YARD_REC.gravel), `${kind}: its own floor`);
    const sb = signBoxOf(kind);
    assert.ok(sb[1] > CAPSULE_HEIGHT + 0.3, `${kind}: the sign clears a walker`);
  }
  assert.ok(YARD_FLOOR_Y > 0 && YARD_FLOOR_Y < 0.05);
  assert.ok(STABLE_YARD.gate.beamY - 0.2 - SIGN_BOARD.h > CAPSULE_HEIGHT + 0.3, 'the gate\'s board over a walker\'s head');
  for (const [, x, z] of WAGON_YARD.wagons) assert.ok(Math.abs(x) < WAGON_YARD.fence.x1 && z > WAGON_YARD.shed.z1 && z < WAGON_YARD.fence.z1);
  assert.deepEqual(WAGON_YARD.wagons.map((w) => w[0]), ['cart', 'openWagon', 'caravan'], 'the three on show, cheapest first');
  assert.equal(yardPoints('stable').horses.length, 3);
});

test('MERCHANT-YARDS THE SIGN READS FROM THE STREET AND FROM THE YARD - its picture\'s left on the viewer\'s left either side (the world left-handed: from the street, looking along -z, +x is on the left) (mutants: the front mirrored)', () => {
  for (const [kind, rec] of [['stable', YARD_REC.signStable], ['transport', YARD_REC.signTransport]]) {
    const m = buildYardModel(kind), sm = m.subMeshes.find((s) => s.textureRecord === rec);
    const verts = [];
    for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i++) verts.push({ p: [...m.positions.slice(i * 3, i * 3 + 3)], n: [...m.normals.slice(i * 3, i * 3 + 3)], uv: [...m.uvs.slice(i * 2, i * 2 + 2)] });
    const front = verts.filter((v) => v.n[2] > 0.9), back = verts.filter((v) => v.n[2] < -0.9);
    assert.equal(front.length + back.length, verts.length, `${kind}: two faces`);
    const topLeft = (vs) => vs.find((v) => v.uv[0] === 0 && v.uv[1] === 0).p;
    const xs = verts.map((v) => v.p[0]), xMax = Math.max(...xs), xMin = Math.min(...xs), yMax = Math.max(...verts.map((v) => v.p[1]));
    assert.deepEqual([topLeft(front)[0], topLeft(front)[1]], [xMax, yMax], `${kind}: from the street its left edge is +x`);
    assert.deepEqual([topLeft(back)[0], topLeft(back)[1]], [xMin, yMax], `${kind}: from the yard its left edge is -x`);
  }
  // the handedness the rule reads: trs turns +z to +x at a quarter (world/mat4.js), and an eye looking along +z has +x on
  // its right - so turned to look along -z it has +x on its left
  const m = trs(0, 0, 0, 0, 90, 0);
  assert.deepEqual([m[8], m[10]].map((v) => Math.round(v)), [1, 0]);
});

test('MERCHANT-YARDS THE ART: ten pictures, opaque, the same on every client; each board its emblem and its word, every letter drawn', () => {
  const art = yardArt(), again = yardArt();
  assert.deepEqual(art.map(([r]) => r), Object.values(YARD_REC));
  for (const [i, [rec, img]] of art.entries()) {
    assert.equal(img.colors.length, img.width * img.height * 4);
    for (let k = 3; k < img.colors.length; k += 4) assert.equal(img.colors[k], 255, `record ${rec} opaque`);
    assert.deepEqual(img.colors, again[i][1].colors, `record ${rec} the same twice`);
  }
  assert.deepEqual([art[0][1].width, art[0][1].height], [YARD_ART_SIZE, YARD_ART_SIZE]);
  const stable = yardSignArt('stable'), transport = yardSignArt('transport');
  assert.deepEqual([stable.width, stable.height], [SIGN_ART_W, SIGN_ART_H]);
  assert.notDeepEqual(stable.colors, transport.colors);
  for (const kind of YARD_KIND_ORDER) for (const ch of YARD_KINDS[kind].sign) assert.ok(signGlyph(ch), `${kind}: "${ch}" is drawn`);
  assert.equal(signGlyph('Q'), null);
  assert.ok(Object.values(SIGN_GLYPHS).every((g) => g.length === 7 && g.every((row) => row.length === 5)));
});

/** A renderer, a collider and the deps the pool reads, recorded. */
function rig({ sites = null, ground = 2, feet = null, horses = true } = {}) {
  const log = { uploads: [], meshes: 0, batches: [], destroyed: [], buckets: new Map(), drawn: 0, wagonsDrawn: [], say: [], mid: [], opened: [] };
  const renderer = {
    textures: new Set(),
    uploadTexture: (a, r) => log.uploads.push([a, r]),
    createMesh: () => { log.meshes++; return { mesh: log.meshes }; },
    destroyMesh: () => {},
    drawMesh: () => { log.drawn++; },
    createBillboardBatch: (a, r, size, centers) => { const b = { a, r, size, centers }; log.batches.push(b); return b; },
    destroyBillboardBatch: (b) => log.destroyed.push(b),
  };
  const collider = { addMesh: (key, pos, idx, m) => log.buckets.set(key, { pos, idx, m }), removeBucket: (key) => log.buckets.delete(key) };
  const tex = { getSize: () => ({ width: 40, height: 76 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 3 };
  const keeper = { name: 'Gwynara Moorhart', sex: 'female', variant: 1 };
  const st = {
    sites: sites ?? [
      { key: '7:stable', kind: 'stable', x: 100, z: 50, yaw: 0, comp: 0, regionIndex: 17, race: 'Breton', keeper },
      { key: '7:transport', kind: 'transport', x: 140, z: 50, yaw: 90, comp: 0, regionIndex: 17, race: 'Breton', keeper: { name: 'Jalib', sex: 'male', variant: 0 } },
    ],
    ground, feet, boxes: new Map(), horses, open: true, t: 1000,
  };
  const deps = {
    renderer, collider: () => collider, getTexture: async () => tex, uploadRecordFrame: (a, r, f) => log.uploads.push([a, `${r}#${f}`]),
    sites: () => st.sites, groundAt: () => st.ground, eye: () => [100, 3, 70], feet: () => st.feet,
    horseArt: () => st.horses, showWagon: (r, remap, pos, rot, kind) => { log.wagonsDrawn.push({ pos, rot, kind }); return true; },
    wagonBox: (kind) => st.boxes.get(kind) ?? null,
    open: (site, mode) => { log.opened.push([site.key, mode]); return st.open; },
    say: (t) => log.say.push(t), midText: (t) => log.mid.push(t), now: () => st.t,
  };
  return { log, st, deps };
}

test('MERCHANT-YARDS THE POOL STANDS THEM - each on its site\'s ground, its timber once a kind, its bucket under its key, its keeper and its horses on the flats\' axis, its boxes in the ray', async () => {
  const { log, st, deps } = rig();
  const y = createMerchantYards(deps);
  assert.equal(y.frame(), 2);
  await new Promise((r) => setTimeout(r, 0));   // the keeper's picture comes in
  y.frame();
  assert.equal(log.meshes, 2, 'one mesh a kind');
  assert.deepEqual(log.uploads.filter(([a]) => a === YARD_ARCHIVE).map(([, r]) => r), Object.values(YARD_REC), 'its pictures, once, under its own archive');
  assert.deepEqual([...log.buckets.keys()], ['yard:7:stable', 'yard:7:transport']);
  assert.deepEqual([...log.buckets.get('yard:7:stable').m].slice(12, 15), [100, 2, 50]);
  const state = y.state();
  assert.deepEqual(state.map((s) => [s.kind, s.keeper, s.horses, s.name]), [['stable', true, 3, 'Moorhart\'s Stables'], ['transport', true, 0, 'Jalib\'s Wagon Yard']]);
  assert.equal(y.batches().length, 1 + 3 + 1, 'two keepers and the Stable\'s three horses');
  assert.equal(y.draw(deps.renderer), 2, 'the timber; no wagon yet (its box not in)');
  // the ray's boxes: each keeper and sign, the three horses; their reach a static NPC's
  const keys = y.targets().map((t) => t.key);
  assert.deepEqual(keys, ['yard:7:stable|keeper', 'yard:7:stable|sign', 'yard:7:stable|horse.0', 'yard:7:stable|horse.1', 'yard:7:stable|horse.2', 'yard:7:transport|keeper', 'yard:7:transport|sign']);
  assert.ok(y.targets().every((t) => t.reach === YARD_REACH && t.distance === RAY_DISTANCE));
  assert.equal(YARD_REACH, STATIC_NPC_ACTIVATION_DISTANCE);
  // the wagons' boxes come in: drawn, their boxes in the ray, the bucket stood again with them
  const before = log.buckets.get('yard:7:transport');
  st.boxes.set('cart', [-1, 0.1, -2, 1, 2, 2]); st.boxes.set('openWagon', [-1.2, 0, -3, 1.2, 2.5, 3]); st.boxes.set('caravan', [-1.3, 0, -3.5, 1.3, 3.2, 3.5]);
  y.frame();
  assert.notEqual(log.buckets.get('yard:7:transport'), before, 'stood again with its wagons');
  assert.ok(log.buckets.get('yard:7:transport').pos.length > before.pos.length);
  assert.equal(y.targets().filter((t) => t.key.includes('|wagon.')).length, 3);
  log.wagonsDrawn.length = 0;
  y.draw(deps.renderer);
  assert.deepEqual(log.wagonsDrawn.map((w) => w.kind), ['cart', 'openWagon', 'caravan']);
  const cart = log.wagonsDrawn[0];
  assert.ok(Math.abs(cart.pos[1] - (2 - 0.1)) < 1e-9, 'its lowest point on the ground');
  assert.ok(cart.rot.every(Number.isFinite) && Math.abs(cart.rot[1] - Math.SQRT1_2) < 1e-9, 'turned with its yard');
  // a site gone: its yard down
  st.sites = [st.sites[0]];
  y.frame();
  assert.deepEqual([...log.buckets.keys()], ['yard:7:stable']);
  assert.equal(y.targets().some((t) => t.key.startsWith('yard:7:transport')), false);
  // no ground (its pixel not built finer yet): it does not stand - read again as the yard moves
  st.ground = -Infinity; st.sites[0] = { ...st.sites[0], x: 99 };
  y.frame();
  assert.equal(log.buckets.size, 0);
  y.destroyAll();
  assert.equal(y.state().length, 0);
});

test('MERCHANT-YARDS THE POOL HOLDS A YARD BACK from feet standing on its ground as it first rises, and stands it once they step off (mutants: never held)', () => {
  const { log, st, deps } = rig({ feet: [101, 2, 51] });
  const y = createMerchantYards(deps);
  y.frame();
  assert.deepEqual([...log.buckets.keys()], ['yard:7:transport'], 'the Stable held back; the Wagon Yard, clear of the feet, stood');
  st.feet = [100, 2, 40];
  y.frame();
  assert.ok(log.buckets.has('yard:7:stable'));
  st.feet = [101, 2, 51];
  st.sites[0] = { ...st.sites[0], x: 101 };   // a recentre carries it, the feet on it: it moves with them, never dropped
  y.frame();
  assert.deepEqual([...log.buckets.get('yard:7:stable').m].slice(12, 15), [101, 2, 50]);
  // the footprint law
  const site = { kind: 'stable', yaw: 90 };
  assert.equal(feetInYard(site, [0, 0, 0], [YARD_FOOT.stable.hz - 0.1, 0, 0]), true, 'turned: its depth along x');
  assert.equal(feetInYard(site, [0, 0, 0], [YARD_FOOT.stable.hz + 0.2, 0, 0]), false);
});

test('MERCHANT-YARDS THE PRESS - the Buy row (or no row) buys, the Sell row sells to the yard, Info names the keeper, Steal takes nothing; a horse or a wagon on show buys; the plaque names each', () => {
  const { log, st, deps } = rig();
  const y = createMerchantYards(deps);
  y.frame();
  assert.equal(y.activate('yard:7:stable|keeper', 'grab', null), true);
  assert.equal(y.activate('yard:7:stable|keeper', 'grab', 'sell'), true);
  assert.equal(y.activate('yard:7:stable|sign', 'grab', 'buy'), true);
  assert.equal(y.activate('yard:7:stable|horse.1', 'grab', null), true);
  assert.equal(y.activate('yard:7:stable|horse.1', 'grab', 'sell'), true, 'a horse on show is bought, never sold to');
  assert.deepEqual(log.opened, [['7:stable', 'Buy'], ['7:stable', 'Sell'], ['7:stable', 'Buy'], ['7:stable', 'Buy'], ['7:stable', 'Buy']]);
  y.activate('yard:7:stable|keeper', 'info', null);
  assert.match(log.say.at(-1), /Gwynara Moorhart, the stablemaster/);
  y.activate('yard:7:stable|keeper', 'steal', null);
  assert.equal(log.mid.at(-1), YARD_TEXT.steal);
  assert.equal(log.opened.length, 5, 'neither Info nor Steal opens the counter');
  st.open = false;
  y.activate('yard:7:transport|keeper', 'grab', null);
  assert.equal(log.mid.at(-1), YARD_TEXT.shut, 'a counter that will not open says so');
  assert.equal(y.activate('lefay:monument', 'grab', null), false, 'another\'s key is not its');
  assert.equal(y.activate('yard:9:stable|keeper', 'grab', null), false, 'a yard not standing');
  // the plaque
  const keeper = y.hoverName('yard:7:stable|keeper');
  assert.deepEqual(keeper, { title: 'Moorhart\'s Stables', subs: ['Stablemaster: Gwynara Moorhart', 'Horses bought and sold'], actions: YARD_ROWS.map((r) => ({ ...r })) });
  assert.equal(y.hoverName('yard:7:stable|horse.0').title, 'Horse');
  st.boxes.set('caravan', [-1.3, 0, -3.5, 1.3, 3.2, 3.5]);
  y.frame();
  assert.deepEqual(y.hoverName('yard:7:transport|wagon.2'), { title: 'Caravan', subs: ['Carries 2,000 kg - a room to live in', 'Ask the wagonwright to buy.'], actions: [YARD_ROWS[0]] });
  assert.equal(y.hoverName('board:0'), null);
});

test('MERCHANT-YARDS THE YARD\'S FRAME IN THE SCENE: a point and a box turned with the yard as trs turns its timber', () => {
  for (const yaw of YARD_TURNS) {
    const m = trs(10, 2, 20, 0, yaw, 0), p = [1.5, 0.5, -3];
    const want = [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
    assert.deepEqual(yardToScene([10, 2, 20], yaw, ...p).map((v) => Math.round(v * 1e6) / 1e6), want.map((v) => Math.round(v * 1e6) / 1e6), `yaw ${yaw}`);
  }
  const b = yardBoxToScene([0, 0, 0], 90, [0, 0, 0, 2, 1, 1]), r = (v) => Math.round(v * 1e6) / 1e6 + 0;
  assert.deepEqual([b.min.map(r), b.max.map(r)], [[0, 0, -2], [1, 1, 0]], 'a quarter turn: its width along -z, its depth along x');
});

test('MERCHANT-YARDS THE FOUR HOSTS - world.js places, stands, draws and names them and hands the press; worldModes\' street ray reaches them and opens their counter; exterior.js flagged; the dungeon none', () => {
  const world = read('src/scenes/world.js'), modes = read('src/scenes/worldModes.js'), host = read('src/scenes/merchantYardsHost.js');
  const ext = read('src/scenes/exterior.js'), dungeon = read('src/scenes/dungeonContext.js');
  assert.match(world, /if \(isYardTown\(dfLocation\)\) yardSites = merchantYardSitesFor\(dfLocation, lefaySpot, climate\?\.people\);/);
  assert.match(world, /layoutLocation\(dfLocation, maps, blocks, \{ enhanced: true, windmills: true \}\)/, 'one layout for every lane');
  assert.match(world, /if \(yardSites\?\.length\) carveYards\(nav, yardSites\);/, 'the people walk round them');
  assert.match(world, /merchantYards: yardSites,/);
  assert.match(world, /merchantYards = createMerchantYards\(\{/);
  assert.match(world, /merchantYards\?\.frame\(\)/);
  assert.match(world, /merchantYards\?\.draw\(renderer\)/);
  assert.match(world, /livePersonBatches\.push\(\.\.\.merchantYards\.batches\(\)\)/);
  assert.equal((world.match(/merchantYards\?\.destroyAll\(\);/g) ?? []).length, 2, 'a re-anchor and a load');
  assert.match(world, /\(key\) => merchantYards\?\.hoverName\(key\) \?\? null,/);
  assert.match(world, /yardTargets: \(\) => merchantYards\?\.targets\(\) \?\? \[\],/);
  assert.match(world, /activateYard: \(key, mode, verb\) => merchantYards\?\.activate\(key, mode, verb\) \?\? false,/);
  assert.match(world, /open: \(site, mode\) => modes\?\.openYardTrade\?\.\(site\.kind, site\.regionIndex, mode\) \?\? false,/);
  assert.match(world, /showWagon: \(r, texRemap, position, rotation, kind\) => hcc\.drawShowWagon\(r, texRemap, position, rotation, kind\),/);
  assert.match(world, /race: peopleRaceOf\(climate\?\.people\),/, 'the walkers and the keepers one race law');
  assert.match(modes, /for \(const t of host\.yardTargets\?\.\(\) \?\? \[\]\) targets\.push\(t\);/);
  assert.match(modes, /key\.startsWith\('yard:'\)\) \{[^\n]*\n\s*if \(_hitDist > _hitReach\) \{ setMidScreenText\(TOO_FAR_AWAY_TEXT\); return true; \}\n\s*return host\.activateYard\?\.\(key, getInteractionMode\(\), plaqueActionFor\(key\)\) \?\? true;/);
  assert.match(modes, /accepts: \(it\) => \(typeof b\.accepts === 'function' \? b\.accepts\(it\) : shopBuysItem\(b\.buildingType, it\)\),/, 'the counter asks the yard what it buys');
  assert.match(modes, /const win = openTradeWindow\(\{ items: tradeMode === 'Sell' \? \[\] : yardStock\(kind\) \}, b, tradeMode === 'Sell' \? 'Sell' : 'Buy'\);\n\s*if \(!win\) return true;[^\n]*\n\s*mountServiceWindow\(win\);/, 'the counter in the street\'s slot, never the interior\'s (undrawn outdoors)');
  assert.match(modes, /ensureShopFont\(\)\.then\(\(\) => \{ if \(!openYardTrade\(kind, regionIndex, tradeMode, true\)\) setMidScreenText\(YARD_TEXT\.shut\); \}\);/, 'a press before the counter\'s art waits for it, once');
  assert.match(modes, /    openYardTrade,/);
  assert.match(host, /scenes\/exterior\.js - FLAGGED/);
  assert.equal(/merchantYard|openYardTrade/.test(ext), false, 'the bench stands none (flagged)');
  assert.equal(/merchantYard|yard:/.test(dungeon), false, 'the dungeon host stands no street');
});
