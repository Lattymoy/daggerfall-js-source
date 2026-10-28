// DLV1 (bible/03-World/Delve-II.md section 4): THE SITE LAW - how many sites a layout stands, the grid of candidates,
// every rule a spot must keep (each pinned at its edge), the collider's room, the choice (deepest first, then spread,
// a storey served first, the seed's tie), the kinds, the small room's second pass and the vault's spot. Each pin is held
// to fail under a one-character change of the rule it names (tools/mutants/dlv1.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DSITE, DSITE_SMALL, delveSiteCount, colliderSiteProbe, siteCandidates, landDelveSites, chooseSites, siteKinds, delveSitePlan,
} from '../../src/world/dungeon/delveSites.js';
import { DELVE_KINDS, delvePlanHash } from '../../src/net/delve/delveLaw.js';
import { Collider } from '../../src/player/collider.js';
import { RDB_SIDE } from '../../src/world/rdbLayout.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';

const mk = (record, x, z, y = 0.5, archive) => (archive == null ? { record, x, y, z } : { record, x, y, z, archive });
/** `n` blocks in a row along x, then a border block; the first the starting block with its start marker. */
function row(n, { castle = false, markers = () => [] } = {}) {
  const inner = Array.from({ length: n }, (_, i) => ({
    name: `N000000${i}.RDB`, originX: i * RDB_SIDE, originZ: 0, isStartingBlock: i === 0,
    layout: { waterLevel: 10000, castleBlock: castle && i === 1, markers: [...(i === 0 ? [mk(10, 5, 5)] : []), ...markers(i)], startMarkers: i === 0 ? [mk(10, 5, 5)] : [] },
  }));
  return [...inner, { name: 'B0000001.RDB', originX: n * RDB_SIDE, originZ: 0, isStartingBlock: false, layout: { waterLevel: 10000, markers: [mk(19, 5, 5)] } }];
}
/** Walls `near` m off on the first bearing (+x) and 20 m on the rest. */
const walls = (near = 20) => [near, 20, 20, 20, 20, 20, 20, 20];
const open = { floor: () => ({ y: 0, ny: 1 }), room: () => ({ walls: walls() }) };

test('DLV1 THE COUNT: one site for two non-border blocks, one to three; the border uncounted; a palace none (mutants: one for three; the cap lifted; the floor of one dropped)', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 9].map((n) => delveSiteCount(row(n).slice(0, n))), [1, 1, 1, 1, 2, 2, 3, 3, 3]);
  assert.equal(delveSiteCount(row(3)), 1, 'the border block is no block of the count');
  assert.equal(delveSiteCount(row(6, { castle: true })), 0);
  assert.equal(delveSiteCount(null), 1);
});

test('DLV1 THE NUMBERS: a 4 m disc on a 4 m grid, 4.5 m from a door, 4 from an item, 20 from the way in, 12 from a fire, 60 between sites; the small room a 3 m disc on a 2 m grid, 3.5, 3, 12 and 8 (mutants: each moved)', () => {
  assert.deepEqual(
    [DSITE.r, DSITE.flatNy, DSITE.levelM, DSITE.rings, DSITE.ceilingM, DSITE.enclosedM, DSITE.enclosedRays, DSITE.gridM, DSITE.doorM, DSITE.enemyM, DSITE.itemM, DSITE.startM, DSITE.fireM, DSITE.dryM, DSITE.storeyM, DSITE.spacingM, DSITE.perBlocks, DSITE.max],
    [4, 0.99, 0.25, [1.5, 3, 4], 12, 30, 4, 4, 4.5, 2, 4, 20, 12, 0.5, 6, 60, 2, 3]);
  assert.deepEqual([DSITE_SMALL.r, DSITE_SMALL.rings, DSITE_SMALL.gridM, DSITE_SMALL.doorM, DSITE_SMALL.itemM, DSITE_SMALL.startM, DSITE_SMALL.fireM], [3, [1.5, 3], 2, 3.5, 3, 12, 8]);
  assert.deepEqual([DSITE_SMALL.enemyM, DSITE_SMALL.spacingM, DSITE_SMALL.levelM, DSITE_SMALL.storeyM], [2, 60, 0.25, 6], 'the rest the large room\'s');
  assert.ok(Object.isFrozen(DSITE) && Object.isFrozen(DSITE_SMALL) && Object.isFrozen(DSITE_SMALL.rings));
});

test('DLV1 THE CANDIDATES: a grid over each non-border block, centred, at each storey its markers stand on - heights within 6 m one storey, a fixed treasure no storey of its own; never the border, never a palace\'s castle block (mutants: the grid off-centre; the storey band; the castle stood in)', () => {
  const blocks = [{
    name: 'N1.RDB', originX: 100, originZ: 50, isStartingBlock: true,
    layout: { waterLevel: 10000, markers: [mk(15, 1, 1, 7), mk(19, 2, 2, 0.5), mk(19, 3, 3, 1), mk(19, 4, 4, 50, 216), mk(11, 5, 5, 6.4)] },
  }, { name: 'B1.RDB', originX: 0, originZ: 0, layout: { waterLevel: 10000, markers: [] } },
  { name: 'N2.RDB', originX: 300, originZ: 0, layout: { waterLevel: 10000, castleBlock: true, markers: [] } },
  { name: 'N3.RDB', originX: 400, originZ: 0, layout: { waterLevel: 40, markers: [] } }];
  const c = siteCandidates(blocks).map((x) => ({ ...x, pos: x.pos.map((v) => Math.round(v * 1000) / 1000) }));
  const per = 12 * 12;
  assert.equal(c.length, 3 * per, 'the first block two storeys (0.5 and 7 - 1 and 6.4 inside 0.5\'s band), the last one at 0');
  assert.deepEqual(c[0], { pos: [103.6, 0.5, 53.6], block: 0, start: true, water: -Infinity });
  assert.deepEqual(c[1].pos, [107.6, 0.5, 53.6], 'along x first');
  assert.deepEqual(c[12].pos, [103.6, 0.5, 57.6]);
  assert.deepEqual(c[per - 1].pos, [147.6, 0.5, 97.6], 'centred: 3.6 m in from each edge');
  assert.deepEqual(c[per].pos, [103.6, 7, 53.6], 'the next storey');
  assert.deepEqual(c[2 * per].pos, [403.6, 0, 3.6], 'a block without markers: its floor at 0');
  assert.equal(c[2 * per].water, -40 * GLOBAL_SCALE, 'its water, the layout\'s level turned down');
  assert.equal(c[2 * per].start, false);
  const two = siteCandidates(blocks, 2).map((x) => ({ ...x, pos: x.pos.map((v) => Math.round(v * 1000) / 1000) }));
  assert.equal(two.length, 3 * 25 * 25);
  assert.deepEqual(two[0].pos, [101.6, 0.5, 51.6]);
  assert.deepEqual(siteCandidates(null), []);
});

test('DLV1 THE RULES: a floor, flat, dry, clear of a door by 4.5 m, an enemy marker\'s heart by 2 on its storey, an item by 4, the way in by 20, a fire by 12, level on every ring, a room - each refused spot tallied by its first broken rule (mutants: each rule\'s edge)', () => {
  const at = (k) => ({ pos: [k * 100, 1, 0], water: -Infinity, block: 0, start: false });
  const asked = [];
  const probe = {
    floor: (p) => (p[0] === 100 ? null : p[0] === 200 ? { y: 0, ny: 0.98 } : p[0] === 904 ? { y: 0.26, ny: 1 } : { y: 0, ny: 1 }),
    room: (p, r) => { asked.push(r); return p[0] === 1000 ? null : { walls: walls(9) }; },
  };
  const cands = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(at);
  cands[2] = { ...cands[2], water: -0.4 };
  const marks = {
    doors: [[400, 0, 4.49], [1100, 0, 4.5]],
    enemies: [[500, 0, 1.99], [1100, 0, 2], [1100, 6, 0]],
    items: [[600, 0, 3.99], [1100, 0, 4], [1100, 6, 0]],
    start: [700, 0, 19.99],
    fires: [[800, 0, 11.99], [1100, 0, 12]],
  };
  const tally = {};
  const kept = landDelveSites(cands, { probe, ...marks, tally });
  assert.deepEqual(kept.map((k) => k.pos[0] / 100), [11], 'every rule at its edge, kept');
  assert.deepEqual(kept[0].pos, [1100, 0, 0], 'landed on its floor');
  assert.deepEqual(kept[0].walls, walls(9));
  assert.deepEqual(tally, { floor: 2, water: 1, door: 1, enemy: 1, item: 1, start: 1, fire: 1, level: 1, room: 1 });
  assert.deepEqual(asked, [4, 4], 'the room asked for the large disc');
  asked.length = 0;
  const small = landDelveSites(cands, { probe, ...marks, law: DSITE_SMALL });
  assert.deepEqual(small.map((k) => k.pos[0] / 100), [4, 6, 7, 8, 9, 11], 'the small room: nearer a door, an item, the way in and a fire; level to 3 m only');
  assert.ok(asked.every((r) => r === 3));
  assert.deepEqual(landDelveSites(cands, { probe: { floor: () => ({ y: 0.4, ny: 1 }), room: () => ({ walls: walls() }) } }).length, 11, 'level is the disc against its heart, not against the grid');
  assert.deepEqual(landDelveSites([{ ...at(3), water: -0.5 }], { probe: open }).length, 1, 'half a metre over the water, kept');
});

/** A square room `2H` across and `T` high, centred on the origin: floor, ceiling, four walls - the 'dungeon' bucket. */
function room({ H = 10, T = 4, ceiling = true } = {}) {
  const c = new Collider(() => -Infinity);
  const v = [], idx = [];
  const quad = (a, b, cc, d) => { const n = v.length / 3; v.push(...a, ...b, ...cc, ...d); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  quad([-H, 0, -H], [-H, 0, H], [H, 0, H], [H, 0, -H]);
  if (ceiling) quad([-H, T, -H], [H, T, -H], [H, T, H], [-H, T, H]);
  quad([-H, 0, -H], [H, 0, -H], [H, T, -H], [-H, T, -H]); quad([-H, 0, H], [H, 0, H], [H, T, H], [-H, T, H]);
  quad([-H, 0, -H], [-H, 0, H], [-H, T, H], [-H, T, -H]); quad([H, 0, -H], [H, 0, H], [H, T, H], [H, T, -H]);
  c.addMesh('dungeon', v, idx, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return c;
}

test('DLV1 THE ROOM (colliderSiteProbe, the host\'s and the census\'s): walls round it within 30 m and none inside the disc, a roof within 12 m, the body clear - with the eight walls for the vault (mutants: the disc\'s wall check; the roof\'s reach; the rays\' count)', () => {
  const pr = colliderSiteProbe(room());
  const f = pr.floor([0, 0.5, 0]);
  assert.ok(Math.abs(f.y) < 1e-6 && f.ny > 0.99);
  const mid = pr.room([0, 0, 0]);
  assert.ok(mid);
  assert.deepEqual(mid.walls.map((d) => Math.round(d * 100) / 100), [10, 10, 10, 10, 14.14, 14.14, 14.14, 14.14]);
  assert.equal(pr.room([6.5, 0, 0]), null, 'a wall 3.5 m off: inside the large disc');
  assert.ok(pr.room([6.5, 0, 0], 3), 'outside the small one');
  assert.ok(pr.room([6, 0, 0]), 'a wall at 4 m exactly');
  assert.equal(pr.room([0, 4, 0]), null, 'on its roof: nothing over it');
  assert.equal(pr.room([0, 0, 40]), null, 'the void beside it');
  assert.equal(colliderSiteProbe(room({ ceiling: false })).room([0, 0, 0]), null, 'open overhead');
  assert.ok(colliderSiteProbe(room({ T: 11.5 })).room([0, 0, 0]), 'a roof 11.5 m up');
  assert.equal(colliderSiteProbe(room({ T: 12.5 })).room([0, 0, 0]), null, 'a roof past 12 m');
  assert.equal(colliderSiteProbe(room({ H: 40 })).room([0, 0, 0]), null, 'a hall: no wall within 30 m on any bearing');
  assert.ok(colliderSiteProbe(room({ H: 40 })).room([25, 0, 25]), 'its corner: walls within 30 m on five bearings');
});

test('DLV1 THE CHOICE: the deepest spot first, height counted twice; then the farthest, 60 m from every site, a storey with none served first; a tie the seed\'s; a taken spot counted as a site (mutants: height counted once; the spacing; the band; the tie)', () => {
  const at = (x, y = 0, z = 0) => ({ pos: [x, y, z] });
  assert.deepEqual(chooseSites([at(50), at(0, -30), at(10)], { start: [0, 0, 0], count: 1 }).map((c) => c.pos), [[0, -30, 0]], '30 m down beats 50 m along');
  assert.deepEqual(chooseSites([at(70), at(0, -30), at(10)], { start: [0, 0, 0], count: 1 }).map((c) => c.pos), [[70, 0, 0]]);
  const line = Array.from({ length: 21 }, (_, i) => at(i * 10));
  assert.deepEqual(chooseSites(line, { start: [0, 0, 0], count: 3 }).map((c) => c.pos[0]), [200, 0, 100], 'deepest, farthest, then the middle 100 m from both');
  assert.deepEqual(chooseSites(line.slice(0, 12), { start: [0, 0, 0], count: 3 }).map((c) => c.pos[0]), [110, 0], 'nothing 60 m from both');
  assert.deepEqual(chooseSites([at(0), at(60), at(59.9)], { start: [0, 0, 0], count: 2 }).map((c) => c.pos[0]), [60, 0], '60 m exactly is far enough');
  const banded = [at(0), at(400), at(200), at(100, -30)];
  assert.deepEqual(chooseSites(banded, { start: [0, 0, 0], count: 3 }).map((c) => c.pos[0]), [400, 100, 200], 'the lower storey before the far middle');
  const twins = [at(-100), at(100)];
  const picks = new Set();
  for (let s = 0; s < 40; s++) {
    const p = chooseSites(twins, { seed: s, start: [0, 0, 0], count: 1 })[0].pos[0];
    picks.add(p);
    assert.equal(chooseSites(twins, { seed: s, start: [0, 0, 0], count: 1 })[0].pos[0], p, 'the same every call');
  }
  assert.equal(picks.size, 2, 'the seed breaks the tie both ways');
  assert.deepEqual(chooseSites(line, { start: [0, 0, 0], count: 1, taken: [[200, 0, 0]] }).map((c) => c.pos[0]), [0], 'a taken site: no deepest pick, the farthest from it');
  assert.deepEqual(chooseSites(line.slice(15), { count: 1, taken: [[200, 0, 0]] }), [], 'nothing 60 m from the taken one');
  assert.deepEqual(chooseSites([], { count: 2 }), []);
  assert.deepEqual(chooseSites(line, { count: 0 }), []);
});

test('DLV1 THE KINDS: drawn off the seed; two sites hold one of each family; a kind not built never drawn (mutants: the salt; the second site\'s family drawn too)', () => {
  const fam = (k) => DELVE_KINDS[k].family;
  const firsts = new Set();
  for (let s = 0; s < 64; s++) {
    const two = siteKinds(2, s);
    assert.notEqual(fam(two[0]), fam(two[1]), `seed ${s}: one of each`);
    firsts.add(siteKinds(1, s)[0]);
    assert.deepEqual(siteKinds(3, s).slice(0, 2), two, 'a third site does not move the first two');
  }
  assert.equal(firsts.size, 2, 'a lone site either');
  assert.deepEqual(siteKinds(3, 7, ['hold']), ['hold', 'hold', 'hold']);
  assert.deepEqual(siteKinds(2, 7, []), []);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((s) => siteKinds(1, s)[0]), [0, 1, 2, 3, 4, 5].map((s) => siteKinds(1, s)[0]));
  assert.deepEqual(siteKinds(3, 1234), siteKinds(3, 1234));
  assert.deepEqual([siteKinds(1, 1)[0], siteKinds(1, 2)[0], siteKinds(1, 3)[0], siteKinds(1, 4)[0]], PINNED_KINDS);
});
const PINNED_KINDS = ['hold', 'litany', 'hold', 'hold'];

test('DLV1 THE WHOLE PLAN: the count\'s sites, one of each family, 60 m apart, each a 4 m disc with its vault 3.4 m toward its nearest wall; the same every call; none for the caller\'s none (mutants: the vault toward the farthest wall; the vault\'s reach; the plan ignoring none)', () => {
  const blocks = row(4);
  const plan = delveSitePlan({ blocks, probe: open, seed: 99 });
  assert.equal(plan.sites.length, 2);
  assert.equal(plan.small, 0);
  assert.equal(plan.candidates, 4 * 144);
  assert.notEqual(DELVE_KINDS[plan.sites[0].kind].family, DELVE_KINDS[plan.sites[1].kind].family);
  const [a, b] = plan.sites;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >= 60);
  for (const s of plan.sites) {
    assert.equal(s.r, 4); assert.equal(s.tier, 'regular');
    assert.deepEqual(s.vault, [Math.round((s.x + 3.4) * 100) / 100, s.y, s.z], 'toward the wall on +x, 3.4 m out');
  }
  assert.deepEqual(plan.sites.map((s) => s.i), [0, 1]);
  assert.deepEqual(delveSitePlan({ blocks, probe: open, seed: 99 }), plan, 'the same every call');
  assert.equal(delvePlanHash(delveSitePlan({ blocks, probe: open, seed: 99 }).sites), delvePlanHash(plan.sites));
  assert.deepEqual(delveSitePlan({ blocks, probe: open, seed: 99, none: true }).sites, []);
  assert.deepEqual(delveSitePlan({ blocks: row(4, { castle: true }), probe: open, seed: 99 }).sites, []);
  assert.equal(delveSitePlan({ blocks, probe: open, seed: 99, tier: 'elite' }).sites[0].tier, 'elite');
  assert.deepEqual(delveSitePlan({ blocks, probe: open, seed: 99, kinds: ['litany'] }).sites.map((s) => s.kind), ['litany', 'litany']);
  const diag = { ...open, room: () => ({ walls: [20, 20, 20, 20, 20, 20, 20, 5] }) };
  const s0 = delveSitePlan({ blocks, probe: diag, seed: 99 }).sites[0];
  assert.deepEqual(s0.vault, [Math.round((s0.x - 3.4 * Math.SQRT1_2) * 100) / 100, s0.y, Math.round((s0.z - 3.4 * Math.SQRT1_2) * 100) / 100], 'the last bearing');
  const tie = { ...open, room: () => ({ walls: [20, 20, 6, 20, 20, 20, 20, 6] }) };
  const s1 = delveSitePlan({ blocks, probe: tie, seed: 99 }).sites[0];
  assert.deepEqual(s1.vault, [s1.x, s1.y, Math.round((s1.z + 3.4) * 100) / 100], 'a tie: the first bearing of the two');
});

test('DLV1 THE SMALL ROOM: where the large rooms leave the count short, a 3 m disc on the 2 m grid fills it, 60 m from what they stood - its vault 2.4 m out; a dungeon with large rooms enough never asks (mutants: the second pass never run; run always; its sites crowding the first\'s)', () => {
  const blocks = row(4);
  // only small rooms: nothing at 4 m, everything at 3
  const smallOnly = { floor: () => ({ y: 0, ny: 1 }), room: (p, r) => (r <= 3 ? { walls: walls() } : null) };
  const plan = delveSitePlan({ blocks, probe: smallOnly, seed: 99 });
  assert.equal(plan.sites.length, 2); assert.equal(plan.small, 2); assert.equal(plan.valid, 0);
  for (const s of plan.sites) { assert.equal(s.r, 3); assert.deepEqual(s.vault, [Math.round((s.x + 2.4) * 100) / 100, s.y, s.z]); }
  // one large room, the rest small: the large one first, the small 60 m from it
  const oneLarge = { floor: () => ({ y: 0, ny: 1 }), room: (p, r) => (r <= 3 || (p[0] > 180 && p[0] < 190) ? { walls: walls() } : null) };
  const mixed = delveSitePlan({ blocks, probe: oneLarge, seed: 99 });
  assert.equal(mixed.sites.length, 2); assert.equal(mixed.small, 1);
  assert.equal(mixed.sites[0].r, 4); assert.equal(mixed.sites[1].r, 3);
  assert.ok(Math.hypot(mixed.sites[0].x - mixed.sites[1].x, mixed.sites[0].z - mixed.sites[1].z) >= 60);
  // a small room only the 2 m grid finds: 1.6 m into the third block, off every point of the 4 m grid
  const nook = { floor: () => ({ y: 0, ny: 1 }), room: (p, r) => (r <= 3 && Math.abs(p[0] - (2 * RDB_SIDE + 1.6)) < 0.01 && Math.abs(p[2] - 1.6) < 0.01 ? { walls: walls() } : null) };
  assert.deepEqual(delveSitePlan({ blocks, probe: nook, seed: 99 }).sites.map((s) => [s.x, s.z, s.r]), [[104, 1.6, 3]], 'the 2 m grid');
  let asked = 0;
  const counting = { floor: () => ({ y: 0, ny: 1 }), room: (p, r) => { if (r === 3) asked++; return { walls: walls() }; } };
  delveSitePlan({ blocks, probe: counting, seed: 99 });
  assert.equal(asked, 0, 'large rooms enough: no second pass');
  const tally = {};
  delveSitePlan({ blocks, probe: smallOnly, seed: 99, tally });
  assert.ok(tally.room > 0 && tally.small && !tally.small.room, 'each pass tallied apart');
});
