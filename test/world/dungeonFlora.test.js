// THE SEABED (src/world/dungeon/dungeonFlora.js): Daggerfall's own seabed flats grown under a flooded block's water.
// Held here: the pick's weights; the law over a fake probe - only under the water, on a level floor, clear of doors and
// of each other, spread from the least hash, a block's count, the narrow kelp where a pick is too wide, the block's
// origin; the host's call - each plant into the flat batches by its centre, nothing asked of a dry dungeon; the
// wiring; and, with ARENA2_PATH, every flooded block BLOCKS.BSA carries (tools/dungeonFloraCheck.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLORA, FLORA_KINDS, floraPick, dungeonFloraPlan, standDungeonFlora } from '../../src/world/dungeon/dungeonFlora.js';
import { checkDungeonFlora } from '../../tools/dungeonFloraCheck.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'ARCH3D.BSA', 'TEXTURE.105', 'TEXTURE.106'].every((f) => existsSync(join(ARENA2, f)));

const WATER = 10;   // waterLevel -400: 400 classic units up
const block = (markers = [[0, 0, 0]], extra = {}) => ({ layout: { waterLevel: -400, markers: markers.map(([x, y, z]) => ({ x, y, z })), placements: [], ...extra }, originX: 0, originZ: 0 });
const level = (y = 0, ny = 1) => ({ floor: () => ({ y, ny }), room: () => true });
const small = () => ({ w: 1, h: 1 });
const plan = (args) => dungeonFloraPlan({ probe: level(), sizeOf: small, ...args });
const far = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
const isKind = (f, kind) => FLORA_KINDS.find((k) => k.kind === kind).records.some(([a, r]) => a === f.archive && r === f.record);

test('SEABED the pick: each kind by its weight, every record of a kind picked', () => {
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
});

test('SEABED only under the water: a dry block, a block with no layout and a floor under a metre of water grow nothing; a slope grows nothing (mutants: SEABED-*)', () => {
  assert.deepEqual(plan({ blocks: [block([[0, 0, 0]], { waterLevel: 10000 })] }), []);
  assert.deepEqual(plan({ blocks: [block([[0, -300, 0]], { waterLevel: 10000 })], probe: level(-300) }), [], 'dry however deep its floor');
  assert.deepEqual(plan({ blocks: [{ originX: 0, originZ: 0 }, null] }), []);
  assert.deepEqual(plan({ blocks: [block()], probe: level(WATER - 0.99) }), [], 'the floor 0.99 m under the water');
  assert.ok(plan({ blocks: [block()], probe: level(WATER - FLORA.depthM) }).length > 0, 'a metre under: it grows');
  assert.deepEqual(plan({ blocks: [block()], probe: level(0, 0.89) }), [], 'a slope');
  assert.ok(plan({ blocks: [block()], probe: level(0, FLORA.flatNy) }).length > 0);
  assert.deepEqual(plan({ blocks: [block()], probe: { floor: () => null, room: () => true } }), [], 'no floor');
  assert.deepEqual(plan({ blocks: [block()], probe: { floor: () => ({ y: 0, ny: 1 }), room: () => false } }), [], 'no room');
  assert.deepEqual(plan({ blocks: [block()], sizeOf: () => null }), [], 'no record to stand');
});

test('SEABED clear of doors and of each other: 1.5 m from a door, 2.4 m between plants, a block\'s count, the farthest spot next', () => {
  const nearDoor = plan({ blocks: [block()], doors: [[0, 0, 0]] });
  assert.ok(nearDoor.length > 0 && nearDoor.every((f) => Math.hypot(f.pos[0], f.pos[2]) >= FLORA.doorM), 'the ring stands, the door\'s own spot does not');
  const grid = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) grid.push([i * 10, 0, j * 10]);
  const many = plan({ blocks: [block(grid)], seed: 3 });
  assert.equal(many.length, FLORA.perBlock);
  for (const [i, f] of many.entries()) for (const g of many.slice(i + 1)) assert.ok(far(f, g) >= FLORA.spacingM, 'spaced');
  assert.deepEqual(plan({ blocks: [block(grid)], seed: 3 }), many, 'the same plan on every client');
  assert.notDeepEqual(plan({ blocks: [block(grid)], seed: 4 }), many, 'another dungeon, another seabed');
  const two = plan({ blocks: [block([[0, 0, 0], [50, 0, 0]])] });
  assert.ok(far(two[0], two[1]) > 40, 'the second plant is the spot farthest from the first');
  const one = plan({ blocks: [block()] });
  assert.ok(one.length >= 2 && one.length <= 17);
});

test('SEABED the narrow kelp where the pick is too wide; the block\'s origin; the plant\'s foot on the floor', () => {
  const wide = (a, r) => (FLORA_KINDS[0].records.some(([ka, kr]) => ka === a && kr === r) ? { w: 0.4, h: 2 } : { w: 3, h: 1 });
  const narrowRoom = { floor: () => ({ y: 2, ny: 1 }), room: (p, half) => half < 0.5 };
  const kelp = dungeonFloraPlan({ blocks: [block()], probe: narrowRoom, sizeOf: wide });
  assert.ok(kelp.length > 0 && kelp.every((f) => isKind(f, 'kelp')), 'only kelp fits');
  assert.deepEqual(kelp.map((f) => f.pos), plan({ blocks: [block()], probe: level(2) }).map((f) => f.pos), 'and it fills every spot a wide pick would leave bare');
  const moved = plan({ blocks: [{ ...block(), originX: 100, originZ: -40 }], probe: level(2) });
  assert.ok(moved.length > 0 && moved.every((f) => Math.hypot(f.pos[0] - 100, f.pos[2] + 40) <= 3.6 + 1e-9 && f.pos[1] === 2), 'round the marker at the block\'s origin, on its floor');
});

/** A room 20 m square round (cx, cz): floor at 0, ceiling at 5; every ray in the 'dungeon' bucket. */
function fakeRoom(cx = 0, cz = 0) {
  return {
    raycastHit: (from, dir, max) => (dir[1] < 0 && from[1] <= max ? { dist: from[1], normal: [0, 1, 0], back: false, key: 'dungeon' } : null),
    raycast: (from, dir, max) => {
      let d = Infinity;
      if (dir[1] > 0) d = 5 - from[1];
      else {
        for (const [o, c, k] of [[from[0], cx, dir[0]], [from[2], cz, dir[2]]]) if (k) d = Math.min(d, ((k > 0 ? c + 10 : c - 10) - o) / k);
      }
      return d <= max ? d : Infinity;
    },
  };
}
const fakeTexture = (records, px) => ({ recordCount: records, getSize: () => ({ width: px, height: px }), getScale: () => ({ width: 0, height: 0 }) });

test('SEABED the host\'s call: each plant into the batches by its centre, half its classic height over its foot; a dry dungeon asks for nothing', async () => {
  const groups = new Map();
  const asked = [];
  const getTexture = async (a) => { asked.push(a); return fakeTexture(16, 40); };
  const stood = await standDungeonFlora({ blocks: [block([[0, 0, 0], [5, 0, 5]])], collider: fakeRoom(), getTexture, flatGroups: groups, seed: 9 });
  assert.ok(stood.length > 0);
  assert.deepEqual(asked, [105, 106]);
  const all = [...groups.values()].flat();
  assert.equal(all.length, stood.length);
  for (const f of stood) {
    const at = groups.get(`${f.archive}_${f.record}`);
    assert.ok(at.some((p) => p[0] === f.pos[0] && p[2] === f.pos[2] && p[1] === f.pos[1] + 0.5), 'a 40 px flat\'s centre 0.5 m over its foot');
  }
  const dry = [];
  assert.deepEqual(await standDungeonFlora({ blocks: [block([[0, 0, 0]], { waterLevel: 10000 })], collider: fakeRoom(), getTexture: async (a) => { dry.push(a); return null; }, flatGroups: new Map() }), []);
  assert.deepEqual(dry, [], 'no texture read for a dry dungeon');
  const none = await standDungeonFlora({ blocks: [block()], collider: fakeRoom(), getTexture: async () => { throw new Error('no TEXTURE'); }, flatGroups: new Map() });
  assert.deepEqual(none, [], 'a missing archive stands nothing and throws nothing');
});

test('SEABED wired into the dungeon host after its fires, before its batches, on the fires\' seed', () => {
  const host = readFileSync(join(ROOT, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.match(host, /import \{ standDungeonFlora \} from '\.\.\/world\/dungeon\/dungeonFlora\.js';/);
  const seed = 'seed: dfLocation?.dungeon?.recordElement?.header?.locationId ?? 0';
  const call = host.indexOf(`await standDungeonFlora({ blocks: dungeon.blocks, collider, getTexture, flatGroups, ${seed} });`);
  assert.ok(call > 0, 'the call');
  assert.ok(host.indexOf('const placedFires = firePlan?.fires ?? [];') < call, 'after the fires');
  assert.ok(call < host.indexOf('for (const [key, centers] of flatGroups) {'), 'before the batches are built');
  assert.ok(host.indexOf(`    ${seed},`) > 0 && host.indexOf(`    ${seed},`) < call, 'the fires\' seed');
});

test('SEABED with ARENA2: every flooded block grows plants; each on a level floor under its water, clear of walls, doors and the others; the same plan twice', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, () => {
  const r = checkDungeonFlora(ARENA2);
  assert.deepEqual(r.problems, []);
  assert.ok(r.flooded >= 30, `${r.flooded} flooded blocks`);
  assert.deepEqual(Object.entries(r.counts).filter(([, n]) => n === 0), [], 'no flooded block bare');
});
