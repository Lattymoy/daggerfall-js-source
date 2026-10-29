// THE SEABED (src/world/dungeon/dungeonFlora.js; AUDIT SHIP-REFIT): Daggerfall's own seabed flats grown under a flooded
// block's water. Held here, each over a fake probe so CI holds it: the pick's weights and kinds (no bubbles); a spot in
// its own block's water a metre down, on a floor level a metre round and under a wide plant's own width, clear of doors'
// middles, markers and the layout's flats, 2.4 m from every plant of the dungeon; the room - its foot to its top on
// enough bearings, a face met from behind refused; the host's call - swum through, by its centre; the wiring; and, with
// ARENA2_PATH, whole dungeons and lairs past the Bay held by tools/dungeonFloraCheck.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEABED, FLORA_KINDS, floraPick, dungeonFloraPlan, standDungeonFlora, colliderFloraProbe, clearanceBearings, floraDoors } from '../../src/world/dungeon/dungeonFlora.js';
import { RDB_SIDE } from '../../src/world/rdbLayout.js';
import { DOOR_TYPE } from '../../src/world/meshReader.js';
import { checkDungeonFlora } from '../../tools/dungeonFloraCheck.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'ARCH3D.BSA', 'MAPS.BSA', 'TEXTURE.105', 'TEXTURE.106'].every((f) => existsSync(join(ARENA2, f)));

const WATER = 10;   // waterLevel -400: 400 classic units up
/** A flooded block: `seeds` model origins (no markers), at `originX`. */
const block = (seeds = [[0, 0, 0]], extra = {}, originX = 0) => ({
  layout: { waterLevel: -400, markers: [], placements: seeds.map(([x, y, z]) => ({ matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1] })), ...extra },
  originX, originZ: 0,
});
const level = (y = 0, ny = 1) => ({ floor: () => ({ y, ny }), room: () => true });
const small = () => ({ w: 1, h: 1 });
const plan = (args) => dungeonFloraPlan({ probe: level(), sizeOf: small, ...args });
const far = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
const spaced = (list) => list.every((f, i) => list.slice(i + 1).every((g) => far(f, g) >= SEABED.spacingM));
const isKind = (f, kind) => FLORA_KINDS.find((k) => k.kind === kind).records.some(([a, r]) => a === f.archive && r === f.record);
const at = (list, x, z) => list.some((f) => Math.abs(f.pos[0] - x) < 1e-6 && Math.abs(f.pos[2] - z) < 1e-6);
/** A probe where one spot alone can stand: a floor `reach` m round (x, z) under the water, the rest above it. */
const only = (x, z, reach = 1.2) => ({ floor: (p) => ({ y: Math.hypot(p[0] - x, p[2] - z) <= reach ? 0 : WATER + 5, ny: 1 }), room: () => true });

test('SEABED the pick: each kind by its weight, every record of a kind picked; the column of bubbles (106_6) none of them', () => {
  const sum = FLORA_KINDS.reduce((n, k) => n + k.weight, 0);
  const seen = new Map(FLORA_KINDS.map((k) => [k.kind, new Set()]));
  const counts = new Map(FLORA_KINDS.map((k) => [k.kind, 0]));
  for (let h = 0; h < sum * 4096; h++) {
    const [a, r] = floraPick(h);
    const k = FLORA_KINDS.find((kind) => kind.records.some(([ka, kr]) => ka === a && kr === r));
    counts.set(k.kind, counts.get(k.kind) + 1);
    seen.get(k.kind).add(`${a}_${r}`);
  }
  for (const k of FLORA_KINDS) {
    assert.equal(counts.get(k.kind), k.weight * 4096, `${k.kind}: ${k.weight} in ${sum}`);
    assert.equal(seen.get(k.kind).size, k.records.length, `${k.kind}: every record`);
  }
  assert.ok(!FLORA_KINDS.some((k) => k.records.some(([a, r]) => a === 106 && r === 6)), 'bubbles are no plant');
});

test('SEABED in its own block\'s water: a dry block, a shallow or sloped floor grow nothing, and no spot leaves the block its seed is in - a ring past its edge is the next block\'s water (mutants: SEABED-*)', () => {
  assert.deepEqual(plan({ blocks: [block([[0, 0, 0]], { waterLevel: 10000 })] }), []);
  assert.deepEqual(plan({ blocks: [block([[0, -300, 0]], { waterLevel: 10000 })], probe: level(-300) }), [], 'dry however deep its floor');
  assert.deepEqual(plan({ blocks: [{ originX: 0, originZ: 0 }, null] }), []);
  assert.deepEqual(plan({ blocks: [block()], probe: level(WATER - 0.99) }), [], 'the floor 0.99 m under the water');
  assert.ok(plan({ blocks: [block()], probe: level(WATER - SEABED.depthM) }).length > 0, 'a metre under: it grows');
  assert.deepEqual(plan({ blocks: [block()], probe: level(0, 0.98) }), [], 'a slope (the fires\' 0.99)');
  assert.ok(plan({ blocks: [block()], probe: level(0, SEABED.flatNy) }).length > 0);
  const tilted = { floor: (p) => ({ y: 0, ny: Math.hypot(p[0] - 20, p[2] - 20) < 0.01 ? 0.98 : 1 }), room: () => true };
  assert.ok(!at(plan({ blocks: [block([[20, 0, 20]])], probe: tilted }), 20, 20), 'the spot\'s own floor sloped, its ring level: none there');
  assert.deepEqual(plan({ blocks: [block()], probe: { floor: () => null, room: () => true } }), [], 'no floor');
  assert.deepEqual(plan({ blocks: [block()], probe: { floor: () => ({ y: 0, ny: 1 }), room: () => false } }), [], 'no room');
  assert.deepEqual(plan({ blocks: [block()], sizeOf: () => null }), [], 'no record to stand');
  // a seed by the block's +x edge, a dry block beyond it: nothing stands past the edge
  const edge = plan({ blocks: [block([[RDB_SIDE - 0.5, 0, 20]]), block([], { waterLevel: 10000 }, RDB_SIDE)] });
  assert.ok(edge.length > 0 && edge.every((f) => f.pos[0] < RDB_SIDE), 'its own block alone');
  const moved = plan({ blocks: [block([[10, 0, 10]], {}, 100)], probe: level(2) });
  assert.ok(moved.length > 0 && moved.every((f) => Math.hypot(f.pos[0] - 110, f.pos[2] - 10) <= 3.6 + 1e-9 && f.pos[1] === 2), 'round the seed at the block\'s origin, on its floor');
});

test('SEABED clear of a door\'s middle (1.5 m), a marker a pile, a quest\'s item, a foe or the way in stands on, and the layout\'s flats', () => {
  const d = 1.8 * Math.SQRT1_2, s0 = [20, 0, 20], spot = [20 + d, 20 + d];   // a ring spot 1.47 m from a door at (20, 22) - inside 1.5, past 1.22
  const probe = only(spot[0], spot[1]);
  assert.ok(at(plan({ blocks: [block([s0])], probe }), spot[0], spot[1]), 'with no door it stands');
  assert.deepEqual(plan({ blocks: [block([s0])], probe, doors: [[20, 0, 22]] }), [], '1.47 m from the door\'s middle: none');
  const doored = plan({ blocks: [block([s0])], doors: [[20, 0, 22]] });
  assert.ok(doored.length && doored.every((f) => Math.hypot(f.pos[0] - 20, f.pos[2] - 22) >= SEABED.doorM), 'every plant 1.5 m from the door');
  const lone = only(20, 20);
  assert.ok(at(plan({ blocks: [block([[20, 0, 20]])], probe: lone }), 20, 20), 'the spot alone stands');
  for (const record of [19, 18, 10, 15]) {   // treasure, a quest's item, the start, a foe
    assert.deepEqual(plan({ blocks: [block([[20, 0, 20]], { markers: [{ x: 20.8, y: 0, z: 20.8, record }] })], probe: lone }), [], `199.${record}: nothing 1.13 m from it`);
    const marked = plan({ blocks: [block([[20, 0, 20]], { markers: [{ x: 20, y: 0, z: 20, record }] })] });
    assert.ok(marked.length && marked.every((f) => Math.hypot(f.pos[0] - 20, f.pos[2] - 20) >= SEABED.markerM), `199.${record}: every plant clear of it`);
  }
  assert.ok(at(plan({ blocks: [block([[20, 0, 20]], { markers: [{ x: 20, y: 8, z: 20, record: 19 }] })], probe: lone }), 20, 20), 'a marker a storey up leaves this floor be');
  assert.deepEqual(plan({ blocks: [block([[20, 0, 20]], { flats: [{ x: 20.5, y: 0.5, z: 20.5, archive: 210, record: 0 }] })], probe: lone }), [], 'clear of the layout\'s flat');
});

test('SEABED 2.4 m apart across the whole dungeon - the next block\'s plants counted - the farthest spot next, a block\'s count, the same plan on every client', () => {
  const one = plan({ blocks: [block()] });
  assert.ok(one.length >= 2 && spaced(one), 'one seed: never two ring spots 1.8 m apart');
  const grid = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) grid.push([5 + i * 10, 0, 5 + j * 10]);
  const many = plan({ blocks: [block(grid)], seed: 3 });
  assert.equal(many.length, SEABED.perBlock);
  assert.ok(spaced(many));
  assert.deepEqual(plan({ blocks: [block(grid)], seed: 3 }), many, 'the same plan on every client');
  assert.notDeepEqual(plan({ blocks: [block(grid)], seed: 4 }), many, 'another dungeon, another seabed');
  const two = plan({ blocks: [block([[5, 0, 5], [45, 0, 5]])] });
  assert.ok(far(two[0], two[1]) > 30, 'the second plant is the spot farthest from the first');
  // two flooded blocks side by side, seeds either side of their edge: no pair across it nearer than 2.4 m
  const pair = plan({ blocks: [block([[RDB_SIDE - 0.4, 0, 20]]), block([[0.4, 0, 20]], {}, RDB_SIDE)] });
  assert.ok(pair.some((f) => f.pos[0] < RDB_SIDE) && pair.some((f) => f.pos[0] >= RDB_SIDE), 'both blocks grow');
  assert.ok(spaced(pair), 'spaced across the blocks\' edge');
});

test('SEABED level a metre round (no step, ramp, ledge or tabletop) and under a wide plant\'s own width; the narrow kelp where a pick does not fit', () => {
  // a table 1.2 m across, its top 0.8 m up, at (5, 0): a spot on it is level half a metre round, never a metre
  const table = { floor: ([x, , z]) => ({ y: Math.abs(x - 5) < 0.6 && Math.abs(z) < 0.6 ? 0.8 : 0, ny: 1 }), room: () => true };
  assert.ok(!at(dungeonFloraPlan({ blocks: [block([[5, 0.8, 0]])], probe: table, sizeOf: small }), 5, 0), 'never on the table');
  assert.ok(at(dungeonFloraPlan({ blocks: [block([[5, 0, 0]])], probe: level(), sizeOf: small }), 5, 0), 'the same spot on a floor stands');
  // a floor 1.3 m round the one spot: the level rings (1 m) hold, a 3 m plant would overhang its edge - the narrow kelp
  const wide = (a, r) => (FLORA_KINDS[0].records.some(([ka, kr]) => ka === a && kr === r) ? { w: 0.4, h: 2 } : { w: 3, h: 1 });
  const seed = [...Array(64).keys()].find((k) => !isKind(dungeonFloraPlan({ blocks: [block([[20, 0, 20]])], probe: only(20, 20, 1.6), sizeOf: wide, seed: k })[0], 'kelp'));
  assert.ok(seed != null, 'a seed whose pick there is a wide one, on a floor 1.6 m round');
  const stepped = dungeonFloraPlan({ blocks: [block([[20, 0, 20]])], probe: only(20, 20, 1.3), sizeOf: wide, seed });
  assert.ok(stepped.length === 1 && isKind(stepped[0], 'kelp'), 'the same pick over a floor 1.3 m round would overhang it: the kelp');
  assert.deepEqual(dungeonFloraPlan({ blocks: [block([[20, 0, 20]])], probe: only(20, 20, 0.9), sizeOf: wide }), [], 'a floor under a metre round: none at all');
  const open = dungeonFloraPlan({ blocks: [block([[20, 0, 20]])], probe: level(), sizeOf: wide });
  assert.ok(open.some((f) => !isKind(f, 'kelp')), 'on an open floor the wide ones stand');
  const narrowRoom = { floor: () => ({ y: 2, ny: 1 }), room: (p, half) => half < 0.5 };
  const kelp = dungeonFloraPlan({ blocks: [block([[20, 0, 20]])], probe: narrowRoom, sizeOf: wide });
  assert.ok(kelp.length > 0 && kelp.every((f) => isKind(f, 'kelp')), 'only kelp fits');
  assert.deepEqual(kelp.map((f) => f.pos), plan({ blocks: [block([[20, 0, 20]])], probe: level(2) }).map((f) => f.pos), 'and it fills every spot a wide pick would leave bare');
});

/** A collider of rays: the floor under every point at 0, a ceiling at `ceil`, walls `wall` m out every way, `back` if
 *  the walls are met from behind; `low` a stone { dist, top } and `over` a lintel { dist, bottom } all round; counts its
 *  rays. */
function fakeCollider({ ceil = 5, wall = 6, back = false, ceilBack = false, pillar = null, low = null, over = null, floorKey = 'dungeon' } = {}) {
  const c = { rays: 0 };
  c.raycastHit = (from, dir, max) => {
    c.rays++;
    let hit = null;
    if (dir[1] < 0) hit = { dist: from[1], normal: [0, 1, 0], back: false, key: floorKey };
    else if (dir[1] > 0) hit = { dist: ceil - from[1], normal: [0, -1, 0], back: ceilBack, key: 'dungeon' };
    else {
      hit = { dist: wall, normal: [-dir[0], 0, -dir[2]], back, key: 'dungeon' };
      if (pillar && Math.abs(Math.atan2(dir[0], dir[2]) - pillar.bearing) < pillar.halfAngle) hit = { dist: pillar.dist, normal: [0, 0, 1], back: false, key: 'dungeon' };
      if ((low && from[1] < low.top) || (over && from[1] >= over.bottom)) hit = { dist: (low ?? over).dist, normal: [-dir[0], 0, -dir[2]], back: false, key: 'dungeon' };
    }
    return hit && hit.dist <= max ? hit : { dist: Infinity, key: null, normal: [0, 0, 0], back: false };
  };
  c.raycast = (from, dir, max) => c.raycastHit(from, dir, max).dist;
  return c;
}

test('SEABED the room: clear from its foot to its top on enough bearings that no gap at a plant\'s edge passes 15 cm - every client\'s the same - and a face met from behind is the inside of a solid', () => {
  assert.deepEqual([0.1, 0.25, 0.5, 1, 1.55].map((h) => clearanceBearings(h).length), [8, 16, 32, 64, 64]);
  for (const n of [0.1, 0.25, 0.5, 1]) for (const [x, z] of clearanceBearings(n)) assert.ok(Math.abs(Math.hypot(x, z) - 1) < 1e-12);
  assert.deepEqual(clearanceBearings(0.1)[1], [0.7071067811865475, 0.7071067811865476], 'turned by literals, never Math.sin');
  const room = (opts, half = 0.5, height = 1) => { const col = fakeCollider(opts); return [colliderFloraProbe(col).room([0, 0, 0], half, height), col.rays]; };
  const [ok, rays] = room({});
  assert.equal(ok, true);
  assert.equal(rays, 1 + 6 * 32 + 8, 'the ceiling, six heights of 32 bearings, the eight walls round it');
  assert.equal(room({ back: true })[0], false, 'walls met from behind: inside a solid');
  assert.equal(room({ ceil: 0.9 })[0], false, 'no room over it');
  assert.equal(room({ ceilBack: true })[0], false, 'a roof met from below its top: the void between storeys');
  assert.equal(room({ wall: 0.4 })[0], false, 'a wall inside its half width');
  // AUDIT SHIP-REFIT, the full sweep: rays from a tenth to nine tenths of its height passed a fan under a lintel and over
  // a stone
  assert.equal(room({ low: { dist: 0.4, top: 0.1 } })[0], false, 'a 10 cm stone at its foot');
  assert.equal(room({ low: { dist: 0.4, top: SEABED.levelM - 0.01 } })[0], true, 'a floor risen within the level rule\'s 5 cm');
  assert.equal(room({ over: { dist: 0.4, bottom: 0.95 } })[0], false, 'a lintel over its top');
  // a column 1.2 m off at 337.5 degrees: between the eight bearings, found by the 64 a 2.8 m bed casts
  const pillar = { bearing: -Math.PI / 8, halfAngle: 0.08, dist: 1.2 };
  assert.equal(room({ pillar }, 1.5, 1)[0], false, 'a wide plant finds the column between eight bearings');
  assert.equal(colliderFloraProbe(fakeCollider({})).floor([0, 0, 0]).y, 0);
  assert.equal(colliderFloraProbe(fakeCollider({ floorKey: 'act:0:7' })).floor([0, 0, 0]), null, 'a lift\'s platform is no floor (the fires\' C4)');
});

test('SEABED a door is measured from its middle - its model\'s box under its matrix, never its hinge - and an exit door from its face', () => {
  const blocks = [{
    originX: 100, originZ: 0,
    layout: {
      actionDoors: [{ modelIdNum: 55005, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1] }],
      exitDoors: [{ doorType: DOOR_TYPE.DUNGEON_EXIT, centre: { x: 1, y: 1, z: 2 }, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 5, 1] }, { doorType: 0, centre: { x: 0, y: 0, z: 0 }, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }],
    },
  }];
  const box = new Float32Array([0, 0, 0, 1.2, 2.4, 0.1]);
  assert.deepEqual(floraDoors(blocks, (id) => (id === 55005 ? box : null)).map((p) => p.map((v) => +v.toFixed(3))), [[110.6, 1.2, 0.05], [106, 1, 7]]);
  assert.deepEqual(floraDoors(blocks).map((p) => p.map((v) => +v.toFixed(3)))[0], [110, 0, 0], 'no model: its origin');
});

test('SEABED the host\'s call: each plant into the batches by its centre, swum through (no body, no cover); a dry dungeon reads no texture; a missing archive stands nothing', async () => {
  const groups = new Map();
  const asked = [];
  const tex = { recordCount: 16, getSize: () => ({ width: 40, height: 40 }), getScale: () => ({ width: 0, height: 0 }) };
  const stood = await standDungeonFlora({ blocks: [block([[5, 0, 5], [10, 0, 10]])], collider: fakeCollider({ wall: 6 }), getTexture: async (a) => { asked.push(a); return tex; }, flatGroups: groups, seed: 9 });
  assert.ok(stood.length > 0);
  assert.deepEqual(asked, [105, 106]);
  const all = [...groups.values()].flat();
  assert.equal(all.length, stood.length);
  assert.ok(all.every((p) => p.noCover === true), 'swum through: no body clamps the swimmer, no cover');
  for (const f of stood) assert.ok(groups.get(`${f.archive}_${f.record}`).some((p) => p[0] === f.pos[0] && p[2] === f.pos[2] && p[1] === f.pos[1] + 0.5), 'a 40 px flat\'s centre 0.5 m over its foot');
  const dry = [];
  assert.deepEqual(await standDungeonFlora({ blocks: [block([[0, 0, 0]], { waterLevel: 10000 })], collider: fakeCollider(), getTexture: async (a) => { dry.push(a); return null; }, flatGroups: new Map() }), []);
  assert.deepEqual(dry, []);
  assert.deepEqual(await standDungeonFlora({ blocks: [block()], collider: fakeCollider(), getTexture: async () => { throw new Error('no TEXTURE'); }, flatGroups: new Map() }), []);
});

test('SEABED wired into the dungeon host after the fires\' block, before the batches, on the fires\' seed, the host\'s models handed in for the doors', () => {
  const host = readFileSync(join(ROOT, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.match(host, /import \{ standDungeonFlora \} from '\.\.\/world\/dungeon\/dungeonFlora\.js';/);
  const seed = 'seed: dfLocation?.dungeon?.recordElement?.header?.locationId ?? 0';
  const call = host.indexOf(`  await standDungeonFlora({ blocks: dungeon.blocks, collider, getTexture, flatGroups, positionsOf: (id) => cpuModels.get(id)?.positions ?? null, ${seed} });`);
  assert.ok(call > 0, 'the call');
  assert.ok(host.indexOf('  function dropDungeonFires(isFixture) {') < call, 'after the fires\' block (the fires\' tests mount it alone)');
  assert.ok(call < host.indexOf('for (const [key, centers] of flatGroups) {'), 'before the batches are built');
  assert.ok(host.indexOf(`    ${seed},`) > 0 && host.indexOf(`    ${seed},`) < call, 'the fires\' seed');
});

test('SEABED with ARENA2: every flooded block at twenty seeds, the dungeons the audit named and lairs past the Bay - every plant in its own block\'s water, level, on no island, clear, inside no solid, spaced; no flooded block bare', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, () => {
  const r = checkDungeonFlora(ARENA2);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.bare, []);
  assert.ok(r.blocks >= 30 && r.dungeons >= 30, `${r.blocks} flooded blocks, ${r.dungeons} whole dungeons`);
});
