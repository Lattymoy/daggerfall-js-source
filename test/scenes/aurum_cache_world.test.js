// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): THE COFFER IN THE WORLD -
// which dungeons hold one (CACHES-ONCE: every one - a Bay dungeon by its pixel id, a lair past the Bay by its whole id; no made level, Abyss
// Dungeon, arena floor or zone hall), where it stands (beside a treasure pile the cache's hash picks, clear of the walls,
// on the pile's floor), and the press (claimed once, opened, kept open for the account; refused, said why). On the
// freeware, a Bay dungeon and a lair of Cyrodiil each stand theirs. tools/mutants/aurum_caches.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';

import {
  standAurumCache, aurumCofferYaw, aurumCachePlaceOf, aurumCacheFoot, aurumCacheStood, _resetAurumCaches, AURUM_CACHE_KEY, AURUM_CACHE_TEXT, AURUM_CACHE_STORE,
  AURUM_CACHE_GAP_M, AURUM_CACHE_SIDE_M, AURUM_CACHE_KNEE_M, aurumCofferBox, aurumPileBox,
} from '../../src/scenes/aurumCacheHost.js';
import { AURUM_COFFER_ARCHIVE, AURUM_COFFER_ART, AURUM_COFFER_SIZE } from '../../src/world/aurumCofferArt.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { aurumCacheSpotOf } from '../../src/net/aurumCacheLaw.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { GATE_ARENA_LOCATION_ID } from '../../src/world/gate/gateArena.js';
import { REFUSALS } from '../../src/net/accountClient.js';
import { mintCacheProof, keepCacheProof, _resetCacheProof } from '../../src/net/cacheProof.js';
import { AURUM_COFFER_MODELS } from '../../src/world/chestModel.js';
import { TREASURE_ACTIVATION_DISTANCE } from '../../src/player/activate.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const loc = (mapId, o = {}) => ({ name: 'D', hasDungeon: true, mapTableData: { mapId, dungeonType: 0 }, dungeon: { recordElement: { header: { locationId: 9 } }, blocks: [] }, ...o });

/** A corridor along z, 4 m wide (walls at x = +-2), its floor at 0 - but a pit a metre deep from z 26 to 28, a dais
 *  0.4 m high from z 29 to 35, a lift's deck 0.1 m up from z 40 to 42 (its bucket `act:0:7`), a curb 0.3 m high at x 1.4
 *  from z 50 to 56, and a ceiling 0.55 m up from z 59 to 62. `boxes`: its doors' and movers' boxes, as
 *  player/collider.js bucketBoxes answers them with the mesh skipped. */
const floorAt = (z) => (z >= 26 && z < 28 ? -1 : z >= 29 && z < 35 ? 0.4 : 0);
const corridor = (boxes = []) => ({
  raycastHit(o, d, max, f) {
    let best = { dist: Infinity, key: null };
    const hit = (t, key) => { if (t >= 0 && t <= max && t < best.dist && (!f?.only || f.only.includes(key)) && !f?.skip?.includes(key)) best = { dist: t, key }; };
    if (d[1] < 0) { hit(o[1] - floorAt(o[2]), 'dungeon'); if (o[2] >= 40 && o[2] <= 42) hit(o[1] - 0.1, 'act:0:7'); return best; }
    if (d[1] > 0) { if (o[2] >= 59 && o[2] <= 62) hit(0.55 - o[1], 'dungeon'); return best; }
    for (const wx of [2, -2]) if (Math.abs(d[0]) > 1e-9) hit((wx - o[0]) / d[0], 'dungeon');
    if (o[1] < 0.3 && o[2] >= 50 && o[2] <= 56 && d[0] > 1e-9) hit((1.4 - o[0]) / d[0], 'dungeon');
    return best;
  },
  raycast(o, d, max, f) { return this.raycastHit(o, d, max, f).dist; },
  bucketBoxes: () => boxes,
});
const CORRIDOR = corridor();
/** A cell where every way is walled 0.4 m off: no pile in it has room. */
const CELL = {
  raycastHit: (o, d, max) => { const t = d[1] < 0 ? o[1] : 0.4; return t <= max ? { dist: t, key: 'dungeon' } : { dist: Infinity, key: null }; },
  raycast(o, d, max, f) { return this.raycastHit(o, d, max, f).dist; },
  bucketBoxes: () => [],
};
/** A pile as the dungeon's build leaves it (dungeonContext.js): on its floor, its size from the archive. */
const H = [0.5, 0.4];
const pile = (pos, o = {}) => ({ pos, lawHalf: H, ...o });
const HW = (AURUM_COFFER_SIZE.shut.w * GLOBAL_SCALE) / 2;
/** How far along an axis the coffer stands from a pile of half-width `hx`: its box AURUM_CACHE_GAP_M clear of the pile's. */
const reach = (hx = H[0]) => hx + HW + AURUM_CACHE_GAP_M;
const R = reach();
const fix = (f) => f.map((v) => +v.toFixed(6));

test('AURUM-CACHES which dungeons hold one: a Bay dungeon by its pixel id, a lair past the Bay by its whole id - never a made level, an Abyss Dungeon, the arena\'s floor or undercroft, a zone hall or a place with no id (mutants: a made level stands one, the Bay\'s id not masked)', () => {
  assert.equal(aurumCachePlaceOf(loc((5 << 20) | 123456)), 'd123456', 'the Bay: DFU\'s MapId & 0xfffff');
  const lair = lairPlaceId(4242);
  assert.equal(aurumCachePlaceOf(loc(lair)), `d${lair}`, 'past the Bay: the whole id');
  assert.equal(aurumCachePlaceOf(loc(lair, { gate: 3, dungeon: { recordElement: { header: { locationId: GATE_ARENA_LOCATION_ID } } } })), null, 'the Burning Court');
  assert.equal(aurumCachePlaceOf(loc(77, { superTier: true })), null, 'an Abyss Dungeon');
  assert.equal(aurumCachePlaceOf(loc((0xf << 28) | 5)), null, 'a zone hall');
  for (const bad of [loc(-1), loc(1.5), { mapTableData: {} }, null]) assert.equal(aurumCachePlaceOf(bad), null);
});

// PIN MOVED (AUDIT-STOREFRONT III D1, D2): the coffer stood a fixed 0.9 m from its pile, and on the pile's own foot
// where no way was clear. It now stands by the pile's size, clear of every pile's box, and nowhere where no pile has room.
test('AURUM-CACHES where it stands: the random pile its hash picks (a fixed one only where none is random, a pile with no picture none), then the first way from its bearing clear at knee height, clear either side, on the pile\'s floor - a ledge, a dais or a wall turns it to the next way (mutants: the pick not the hash\'s, the clear ray unread, the step unread, the sides unread, the foot left at knee height)', () => {
  const piles = [pile([0, 0, 0], { isFixed: true }), pile([0, 0, 4]), pile([0, 0, 8]), pile([0, 0, 12]), { pos: null }, { pos: [0, 0, 20] }];
  const east = { bearing: Math.PI / 2 };
  assert.equal(aurumCacheFoot([], { pile: 0, bearing: 0 }, CORRIDOR), null);
  assert.equal(aurumCacheFoot([{ pos: [0, 0, 0] }], { pile: 0, bearing: 0 }, CORRIDOR), null, 'a pile with no picture is none to stand by');
  assert.deepEqual(fix(aurumCacheFoot(piles, { pile: 0.5, ...east }, CORRIDOR)), fix([R, 0, 8]), 'the middle random pile');
  assert.deepEqual(fix(aurumCacheFoot(piles, { pile: 0, ...east }, CORRIDOR)), fix([R, 0, 4]), 'the first random pile - the fixed one is passed');
  assert.deepEqual(fix(aurumCacheFoot(piles, { pile: 0.99, ...east }, CORRIDOR)), fix([R, 0, 12]), 'the last');
  assert.deepEqual(fix(aurumCacheFoot([pile([1, 0, 1], { isFixed: true })], { pile: 0.9, bearing: 0 }, CORRIDOR)), fix([1, 0, 1 + R]), 'a fixed pile where none is random');
  // a pile 1 m from the east wall: east is not clear, nor the next way (an eighth on) - the one after, -z
  assert.deepEqual(fix(aurumCacheFoot([pile([1, 0, 0])], { pile: 0, ...east }, CORRIDOR)), fix([1, 0, -R]), 'turned from the wall');
  // a pile 0.3 m from the east wall heading +z: the way is clear but a side is short of AURUM_CACHE_SIDE_M - it turns on
  // until a way leaves the wall: five eighths round, down and away from it
  assert.deepEqual(fix(aurumCacheFoot([pile([1.7, 0, 0])], { pile: 0, bearing: 0 }, CORRIDOR)), fix([1.7 - R, 0, -R]), 'a wall at its side turns it');
  // a pile at a ledge (z 25.5, the pit at 26): +z and the next eighth land a metre down - then +x
  assert.deepEqual(fix(aurumCacheFoot([pile([0, 0, 25.5])], { pile: 0, bearing: 0 }, CORRIDOR)), fix([R, 0, 25.5]), 'no coffer off a ledge');
  // a pile before the dais (z 28.5, the dais at 29): +z and the next eighth land on it, 0.4 m up - a step too high; then +x
  assert.deepEqual(fix(aurumCacheFoot([pile([0, 0, 28.5])], { pile: 0, bearing: 0 }, CORRIDOR)), fix([R, 0, 28.5]), 'no coffer up on a dais');
  // AUDIT-STOREFRONT III D1: no wall cuts its picture, any eighth round - a curb under knee height 0.34 m off, east and
  // an eighth on, turns it to -z; a ceiling lower than the coffer, +z and an eighth on, turns it to +x
  assert.deepEqual(fix(aurumCacheFoot([pile([0, 0, 53])], { pile: 0, bearing: Math.PI / 2 }, CORRIDOR)), fix([0, 0, 53 - R]), 'a curb at its shin');
  assert.deepEqual(fix(aurumCacheFoot([pile([0, 0, 58.2])], { pile: 0, bearing: 0 }, CORRIDOR)), fix([R, 0, 58.2]), 'a ceiling over it');
  assert.ok(HW < AURUM_CACHE_SIDE_M, 'no wall cuts its picture');
});

test('AUDIT-STOREFRONT III D1 the coffer stands by its pile\'s size: its box AURUM_CACHE_GAP_M clear of the pile\'s along the way (on a diagonal too), and clear of every other pile\'s box, fixed ones too - a pile where it would stand turns it to the next way (mutants: the distance fixed, the diagonal unscaled, the other piles unread)', () => {
  const at = (p, bearing, col = CORRIDOR) => aurumCacheFoot(p, { pile: 0, bearing }, col);
  assert.deepEqual(fix(at([pile([0, 0, 0])], 0)), fix([0, 0, R]));
  // the archive's largest pile, 2.3 m wide: the old fixed 0.9 m stood the coffer inside its box
  const big = pile([0, 0, 0], { lawHalf: [1.15, 0.6] }), f = at([big], 0);
  assert.deepEqual(fix(f), fix([0, 0, reach(1.15)]));
  assert.ok(Math.abs(aurumCofferBox(f).min[2] - aurumPileBox(big).max[2] - AURUM_CACHE_GAP_M) < 1e-9, 'the gap between the boxes');
  assert.ok(aurumCofferBox([0, 0, 0.9]).min[2] < aurumPileBox(big).max[2], 'where the old law stood it: inside');
  // an eighth round: as far along each axis, the box as clear on both
  assert.deepEqual(fix(at([pile([0, 0, 0])], Math.PI / 4)), fix([R, 0, R]), 'a diagonal');
  // another pile 1.6 m on (its box from 1.1 m): +z would meet it - the next way, an eighth round, is clear of both
  assert.deepEqual(fix(at([pile([0, 0, 0]), pile([0, 0, 1.6])], 0)), fix([R, 0, R]), 'another pile\'s box turns it');
  assert.deepEqual(fix(at([pile([0, 0, 0]), pile([0, 0, 1.6], { isFixed: true })], 0)), fix([R, 0, R]), 'and a fixed pile\'s');
});

test('AUDIT-STOREFRONT III D2 a pile with no room - or not on the dungeon\'s own floor (a mover\'s deck) - passes to the next pile in the list\'s order from the hash\'s, round to the first; no pile with room stands no coffer, never one on a pile\'s own foot (mutants: the mover\'s pile kept, one pile tried, the order from the first, the pile\'s foot kept)', () => {
  const east = (p) => ({ pile: p, bearing: Math.PI / 2 });
  const A = pile([0, 0, 10]), C = pile([0, 0, 16]), deck = pile([0, 0.1, 41]);
  assert.deepEqual(fix(aurumCacheFoot([A, deck, C], east(0.5), CORRIDOR)), fix([R, 0, 16]), 'the deck\'s pile passed, the next one taken');
  assert.deepEqual(fix(aurumCacheFoot([A, C, deck], east(0.99), CORRIDOR)), fix([R, 0, 10]), 'past the last, the first');
  assert.equal(aurumCacheFoot([pile([3, 0, 3]), pile([9, 0, 3])], east(0), CELL), null, 'no room: no coffer, not a pile\'s foot');
  assert.equal(aurumCacheFoot([deck], east(0), CORRIDOR), null, 'a pile on a lift alone: none, though the floor beside it is a step down');
});

test('AUDIT-STOREFRONT III D3 the rays read the dungeon\'s mesh alone, so a way through a doorway reads clear - a door\'s box or a mover\'s, as the build stands them, turns the coffer to the next way (mutants: the doors and movers unread)', () => {
  const door = { key: 'act:3:9', min: [-1, 0, 1.2], max: [1, 2.5, 1.4] }, lift = { key: 'act:0:2', min: [-1, -0.3, 0.6], max: [1, 0, 2] };
  assert.deepEqual(fix(aurumCacheFoot([pile([0, 0, 0])], { pile: 0, bearing: 0 }, CORRIDOR)), fix([0, 0, R]), 'nothing there: down the corridor');
  for (const [name, box] of [['a shut door across the way', door], ['a lift\'s deck under it', lift]]) {
    assert.deepEqual(fix(aurumCacheFoot([pile([0, 0, 0])], { pile: 0, bearing: 0 }, corridor([box]))), fix([R, 0, 0]), name);
  }
});

/** A context's api as the coffer reads it (dungeonContext.js): the doors it stands its picture, its target and its name by. */
function fakeCtx() {
  const said = [], stood = [], dropped = [], targets = [], namers = [], downs = [];
  let n = 0;
  return {
    said, stood, dropped, targets, namers, downs, collider: CORRIDOR,
    hudSay: (l) => said.push(l),
    standProfFlats: async (archive, record, scale, centers) => { const b = { id: ++n, archive, record, scale, centers }; stood.push(b); return b; },
    dropProfFlats: (b) => dropped.push(b.id),
    addActivationTargets: (fn) => targets.push(fn),
    addActivationNamer: (fn) => namers.push(fn),
    addTeardown: (fn) => downs.push(fn),
    name: (k) => namers.map((f) => f(k)).find(Boolean)?.title ?? null,
    pick: () => targets.flatMap((f) => f()),
  };
}
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const PILES = [pile([0, 0, 0]), pile([0, 0, 4]), pile([0, 0, 8])];

// PIN MOVED (CACHES-ONCE): a dungeon that held today's cache, none on a day it held none
test('AURUM-CACHES the coffer stood: online and signed in, in a dungeon - its id the dungeon\'s key, its shut picture at its foot, its target at a treasure pile\'s reach, its name, and a line that it is here; none offline, for a guest, with no session (mutants: offline stands one, a guest stands one)', async () => {
  _resetAurumCaches();
  const L = loc(lairPlaceId(77));
  const deps = (o = {}) => ({ online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage: memory(), claim: async () => ({ ok: true }), audio: null, ...o });
  const ctx = fakeCtx();
  const c = standAurumCache(ctx, L, PILES, deps());
  assert.ok(c, 'stood');
  assert.equal(c.id, aurumCachePlaceOf(L));
  assert.equal(c.id, `d${lairPlaceId(77)}`);
  assert.deepEqual(c.foot, aurumCacheFoot(PILES, aurumCacheSpotOf(c.id), CORRIDOR), 'the law\'s foot');
  await tick();
  assert.deepEqual(ctx.stood.map((b) => [b.archive, b.record, b.scale, b.centers]), [[AURUM_COFFER_ARCHIVE, AURUM_COFFER_ART.shut, 1, [c.foot]]]);
  const [t] = ctx.pick();
  assert.equal(t.key, AURUM_CACHE_KEY);
  assert.equal(t.reach, TREASURE_ACTIVATION_DISTANCE, 'a treasure pile\'s reach');
  assert.ok(t.aabb.min[1] === c.foot[1] && t.aabb.max[1] > c.foot[1] + 0.5, 'its box stands on its foot');
  assert.equal(ctx.name(AURUM_CACHE_KEY), AURUM_CACHE_TEXT.name());
  assert.equal(ctx.name('loot:0'), null, 'it names its own key alone');
  assert.deepEqual(ctx.said, [AURUM_CACHE_TEXT.here()]);
  assert.equal(aurumCacheStood(), c);
  ctx.downs.forEach((f) => f());
  assert.equal(aurumCacheStood(), null, 'let go with the level');
  for (const [why, o] of [['offline', { online: () => false }], ['a guest', { session: () => ({ id: 'g', kind: 'guest' }) }], ['no session', { session: () => null }]]) {
    assert.equal(standAurumCache(fakeCtx(), L, PILES, deps(o)), null, why);
  }
  assert.equal(standAurumCache(fakeCtx(), loc(77, { superTier: true }), PILES, deps()), null, 'an Abyss Dungeon');
  assert.equal(standAurumCache(fakeCtx(), L, [], deps()), null, 'no pile to stand it by');
  const cell = { ...fakeCtx(), collider: CELL };
  assert.equal(standAurumCache(cell, L, PILES, deps()), null, 'AUDIT-STOREFRONT III D2: no pile with room');
  assert.deepEqual([cell.said, cell.stood, cell.pick()], [[], [], []], 'and nothing said, stood or pressed');
});

test('AURUM-CACHES the press: the coffer asks the service once with its id - a second press while it asks is that ask - and on its yes opens, says its Aurum and is kept open for the account; pressed again it is empty and asks nothing; entered again it stands open, every id kept (mutants: the ask repeated, the open not kept, the picture not swapped)', async () => {
  _resetAurumCaches();
  const L = loc((3 << 20) | 4321), storage = memory();
  const asked = [];
  let answer;
  const claim = (id) => { asked.push(id); return new Promise((r) => { answer = r; }); };
  const deps = { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage, claim, audio: null };
  const ctx = fakeCtx();
  const c = standAurumCache(ctx, L, PILES, deps);
  await tick();
  assert.equal(c.press('loot:0'), false, 'not its key');
  assert.equal(c.press(AURUM_CACHE_KEY), true);
  assert.equal(c.press(AURUM_CACHE_KEY), true);
  await tick();
  assert.deepEqual(asked, [c.id], 'one ask');
  answer({ ok: true, data: { aurum: 15 } });
  await tick(); await tick();
  assert.equal(c.open, true);
  assert.equal(ctx.said.at(-1), AURUM_CACHE_TEXT.found(15));
  assert.equal(ctx.said.at(-1), '+15 Aurum');
  assert.deepEqual(ctx.stood.map((b) => b.record), [AURUM_COFFER_ART.shut, AURUM_COFFER_ART.open], 'the open picture stood');
  assert.deepEqual(ctx.dropped, [1], 'the shut one let go');
  assert.equal(ctx.name(AURUM_CACHE_KEY), AURUM_CACHE_TEXT.emptyName());
  assert.deepEqual(JSON.parse(storage.getItem(AURUM_CACHE_STORE)), { acct: [c.id] });
  c.press(AURUM_CACHE_KEY);
  await tick();
  assert.equal(ctx.said.at(-1), AURUM_CACHE_TEXT.empty());
  assert.equal(asked.length, 1, 'an open coffer asks nothing');
  // the same dungeon again: open, and no line that one is here
  const again = fakeCtx();
  const c2 = standAurumCache(again, L, PILES, deps);
  await tick();
  assert.equal(c2.open, true);
  assert.deepEqual(again.stood.map((b) => b.record), [AURUM_COFFER_ART.open]);
  assert.deepEqual(again.said, []);
  // another account on this device: shut
  const other = standAurumCache(fakeCtx(), L, PILES, { ...deps, session: () => ({ id: 'other', kind: 'user' }) });
  assert.equal(other.open, false);
  // PIN MOVED (CACHES-ONCE): the device kept today's and yesterday's alone. Now every id, and a day's id or mark goes
  storage.setItem(AURUM_CACHE_STORE, JSON.stringify({ acct: ['20756:d1', 'd2', '20757:cap', c.id], gone: ['20751:d3'] }));
  const next = standAurumCache(fakeCtx(), loc((3 << 20) | 4322), PILES, { ...deps, claim: async () => ({ ok: true }) });
  next.press(AURUM_CACHE_KEY);
  await tick(); await tick();
  assert.deepEqual(JSON.parse(storage.getItem(AURUM_CACHE_STORE)), { acct: ['d2', c.id, next.id], gone: [] });
});

test('AURUM-CACHES a refusal: taken (another device emptied it) opens it and says so; capped stays shut and says the bound; closed says so and stands no coffer again this session; an answer after the level is gone touches nothing (mutants: taken left shut, closed forgotten, a late answer stands a picture)', async () => {
  _resetAurumCaches();
  const L = loc((3 << 20) | 999);
  const deps = (error) => ({ online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage: memory(), claim: async () => ({ ok: false, error }), audio: null });
  const taken = fakeCtx(), t = standAurumCache(taken, L, PILES, deps('cache-taken'));
  t.press(AURUM_CACHE_KEY);
  await tick(); await tick();
  assert.equal(t.open, true);
  assert.equal(taken.said.at(-1), REFUSALS['cache-taken']);
  const capped = fakeCtx(), c = standAurumCache(capped, L, PILES, deps('cache-capped'));
  c.press(AURUM_CACHE_KEY);
  await tick(); await tick();
  assert.equal(c.open, false);
  assert.equal(capped.said.at(-1), REFUSALS['cache-capped']);
  // a late answer, the level gone
  let answer;
  const late = fakeCtx(), l = standAurumCache(late, L, PILES, { ...deps(), claim: () => new Promise((r) => { answer = r; }) });
  await tick();
  l.press(AURUM_CACHE_KEY);
  await tick();
  late.downs.forEach((f) => f());
  answer({ ok: true });
  await tick(); await tick();
  assert.equal(late.stood.length, 1, 'no open picture stood after the level went');
  const closed = fakeCtx(), x = standAurumCache(closed, L, PILES, deps('cache-closed'));
  x.press(AURUM_CACHE_KEY);
  await tick(); await tick();
  assert.equal(closed.said.at(-1), REFUSALS['cache-closed']);
  assert.equal(standAurumCache(fakeCtx(), L, PILES, deps()), null, 'closed: none stands again');
  _resetAurumCaches();
});

// PIN MOVED (CACHES-ONCE): a UTC day's caches spent stood no coffer, kept by a `<day>:cap` mark on the device
test('CACHES-ONCE a day the forgery bound is met stands every coffer still: a capped answer keeps nothing and the coffer stays shut, said why; entered again it stands and is said; a later press asks again and its yes opens it - no coffer is lost to a day (mutants: a capped coffer kept as emptied)', async () => {
  _resetAurumCaches();
  const L = loc((3 << 20) | 999), storage = memory(), asked = [];
  let reply = { ok: false, error: 'cache-capped' };
  const deps = { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage, claim: async (id) => { asked.push(id); return reply; }, audio: null };
  const ctx = fakeCtx(), c = standAurumCache(ctx, L, PILES, deps);
  c.press(AURUM_CACHE_KEY);
  await tick(); await tick();
  assert.deepEqual([c.open, ctx.said.at(-1), storage.getItem(AURUM_CACHE_STORE)], [false, REFUSALS['cache-capped'], null]);
  const again = fakeCtx();
  assert.equal(standAurumCache(again, L, PILES, deps)?.open, false, 'it still stands, shut');
  assert.deepEqual(again.said, [AURUM_CACHE_TEXT.here()]);
  reply = { ok: true, data: { aurum: 10, today: 1, max: 10 } };
  c.press(AURUM_CACHE_KEY);
  await tick(); await tick();
  assert.deepEqual([asked.length, c.open, ctx.said.at(-1)], [2, true, '+10 Aurum']);
  assert.deepEqual(JSON.parse(storage.getItem(AURUM_CACHE_STORE)), { acct: [c.id] });
});

// PIN MOVED (CACHES-ONCE): the service no longer knew one stood before one midnight and pressed after the next
test('AUDIT-STOREFRONT III D4 a coffer the service does not know (cache-id: a page and a service of two laws) is taken away: its picture, its target and its name go, and the refusal is said once (mutants: cache-id left standing)', async () => {
  _resetAurumCaches();
  const L = loc((3 << 20) | 999), ctx = fakeCtx();
  const c = standAurumCache(ctx, L, PILES, { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage: memory(), claim: async () => ({ ok: false, error: 'cache-id' }), audio: null });
  await tick();
  c.press(AURUM_CACHE_KEY);
  await tick(); await tick();
  assert.deepEqual([ctx.pick(), ctx.name(AURUM_CACHE_KEY), ctx.dropped, aurumCacheStood()], [[], null, [1], null]);
  assert.deepEqual(ctx.said.slice(1), [REFUSALS['cache-id']]);
  assert.equal(c.press(AURUM_CACHE_KEY), false, 'no press reaches it');
});

test('AUDIT-STOREFRONT III D5 a yes that lands after the level is gone is kept: the id kept for the account (entered again, the coffer stands open and unannounced) and the find said on the HUD\'s line that outlives the level, no picture stood; a late refusal says nothing (mutants: kept after the gone check, the late find unsaid)', async () => {
  _resetAurumCaches();
  const L = loc((3 << 20) | 999), storage = memory(), late = [];
  let answer;
  const deps = { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage, claim: () => new Promise((r) => { answer = r; }), audio: null, lateSay: (l) => late.push(l) };
  for (const [reply, said] of [[{ ok: false, error: 'server' }, []], [{ ok: true, data: { aurum: 10, today: 1, max: 10 } }, ['+10 Aurum']]]) {
    const ctx = fakeCtx(), c = standAurumCache(ctx, L, PILES, deps);
    await tick();
    c.press(AURUM_CACHE_KEY);
    await tick();
    ctx.downs.forEach((f) => f());
    answer(reply);
    await tick(); await tick();
    assert.deepEqual([ctx.stood.length, late], [1, said]);
  }
  assert.deepEqual(JSON.parse(storage.getItem(AURUM_CACHE_STORE)), { acct: [aurumCachePlaceOf(L)] });
  const again = fakeCtx(), c2 = standAurumCache(again, L, PILES, { ...deps, claim: async () => assert.fail('asked again') });
  assert.deepEqual([c2.open, again.said], [true, []]);
});

test('AURUM-CACHES THE FOUR HOSTS: the dungeon context stands the coffer once its level and piles are, and its takeLoot presses it; the modal dungeon arm and the standalone dungeon carry `aurum:` there in their loot arms, as DELVE II\'s `delve:`; the world and the street stand none (mutants: the ladder\'s arm dropped, the bench\'s arm dropped, the context\'s arm dropped)', () => {
  const dc = read('src/scenes/dungeonContext.js'), wm = read('src/scenes/worldModes.js'), sd = read('src/scenes/dungeon.js');
  assert.ok(dc.includes('  const _aurumCache = standAurumCache(api, dfLocation, lootPiles, { meshes: deps });'), 'stood at the build\'s end - PIN MOVED (CHEST3D): with the pipeline\'s mesh door');
  assert.ok(dc.indexOf('const _aurumCache = standAurumCache(') > dc.indexOf('for (const pile of lootPiles) {'), 'after the piles stand on their floors');
  assert.ok(dc.includes("      if (kind === 'aurum') return _aurumCache?.press(key) ? 1 : 0;"), 'takeLoot\'s arm');
  // AUDIT-STOREFRONT III D1: each pile carries its size from the archive - never a texture mod's, which is one device's
  assert.ok(dc.includes('    const size = billboardSize(t, pile.record), law = classicBillboardSize(t, pile.record);'), 'the archive\'s size read');
  assert.ok(dc.includes('    [pile.half, pile.lawHalf] = [[size.w / 2, size.h / 2], [law.w / 2, law.h / 2]];'), 'and kept on the pile');
  for (const [name, host] of [['the modal arm', wm], ['the standalone arm', sd]]) {
    const arm = host.split('\n').find((l) => l.includes("key.startsWith('loot:')") && l.includes("key.startsWith('delve:')"));
    assert.ok(arm?.includes("key.startsWith('aurum:')"), name);
  }
  assert.ok(wm.indexOf("key.startsWith('aurum:')") > wm.indexOf('if (_pick.distance > _pick.reach)'), 'after the reach is judged');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.ok(!read(host).includes('standAurumCache'), host);
});

// ─── THE PLAYER'S DATA ───────────────────────────────────────────────────────────────
const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA')) && existsSync(join(ARENA2, 'ARCH3D.BSA'));

/** The freeware as the game reads it, stood once for the tests that read it. */
let _world = null;
async function freeware() {
  if (_world) return _world;
  const { standWorldPastBay } = await import('../systems/quest/r25World.mjs');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { hostModelReader } = await import('../../tools/dungeonFireProbe.mjs');
  const { cacheDungeon, treasureTexture } = await import('../../tools/aurumCacheLayout.mjs');
  const w = await standWorldPastBay(ARENA2);
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const getModel = hostModelReader(arch), tex = treasureTexture(ARENA2);
  return (_world = { w, built: (L) => cacheDungeon(L, w.blocks, getModel, tex) });
}
const NO_ARENA2 = HAS ? false : 'ARENA2_PATH not set - the freeware is fetched by tools/fetch-data.sh';

// PIN MOVED (AUDIT-STOREFRONT III D1): beside its pile by the pile's size, its piles the game's own (tools/aurumCacheLayout.mjs)
test('AURUM-CACHES on the player\'s data: a Bay dungeon (The Convocation of Elona) and a lair of Cyrodiil (The Androgulus Reformatory) each stand their coffer - beside a random treasure pile, on its floor, clear of the walls, the same spot twice (mutants: the foot left at knee height)', { skip: NO_ARENA2 }, async () => {
  const { w, built } = await freeware();
  const { cofferMeets } = await import('../../tools/aurumCacheLayout.mjs');
  const bay = w.maps.getLocationByName('Daggerfall', 'The Convocation of Elona');
  const lair = w.places.provinceQuestPlaces.lairCloneAt(2163, 479);
  assert.equal(lair?.name, 'The Androgulus Reformatory');
  const places = new Set();
  for (const [name, L, inBay] of [['the Bay', bay, true], ['Cyrodiil', lair, false]]) {
    const place = aurumCachePlaceOf(L);
    assert.ok(place, name);
    places.add(place);
    assert.equal(Number(place.slice(1)) < 0x80000, inBay, `${name}: ${place}`);
    const { col, piles } = built(L);
    assert.ok(piles.filter((p) => !p.isFixed && p.lawHalf).length >= 2, `${name}: its random treasure piles (${piles.length})`);
    const id = place;
    const foot = aurumCacheFoot(piles, aurumCacheSpotOf(id), col);
    assert.deepEqual(aurumCacheFoot(piles, aurumCacheSpotOf(id), col), foot, `${name}: the same spot twice`);
    assert.ok(piles.some((p) => p.lawHalf && Math.hypot(p.pos[0] - foot[0], p.pos[2] - foot[2]) <= reach(p.lawHalf[0]) * Math.SQRT2 + 1e-6), `${name}: beside its pile`);
    assert.deepEqual(cofferMeets(foot, piles, col), [], `${name}: clear of every pile, door and mover`);
    const down = col.raycast([foot[0], foot[1] + 0.5, foot[2]], [0, -1, 0], 1, { only: ['dungeon'] });
    assert.ok(Math.abs(down - 0.5) < 0.02, `${name}: on the floor (${down})`);
    const sides = [0, 1, 2, 3].map((k) => col.raycast([foot[0], foot[1] + AURUM_CACHE_KNEE_M, foot[2]], [Math.sin(k * Math.PI / 2), 0, Math.cos(k * Math.PI / 2)], 3, { only: ['dungeon'] }));
    assert.ok(sides.filter((s) => s < AURUM_CACHE_SIDE_M - 1e-6).length <= 1, `${name}: clear of the walls (${sides.map((s) => s.toFixed(2))})`);
    // and the whole stand on the real foot: the coffer stood where the law says
    _resetAurumCaches();
    const ctx = { ...fakeCtx(), collider: col };
    const c = standAurumCache(ctx, L, piles, { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage: memory(), claim: async () => ({ ok: true }), audio: null });
    assert.deepEqual(c.foot, foot, name);
  }
  assert.equal(places.size, 2, 'two places, two caches');
});

test('AUDIT-STOREFRONT III D1-D3 on the player\'s data, the auditor\'s own coffers: a lair of Morrowind spawned at (3293,548), Ruins of Chirtir Hall and Ruins of The F\'ormte Cabin (each whole and online) and The Laboratory of Perore (a door through its old spot) - each stands its coffer clear of every pile\'s, door\'s and mover\'s box, never on a pile\'s foot', { skip: NO_ARENA2 }, async () => {
  const { w, built } = await freeware();
  const { cofferMeets } = await import('../../tools/aurumCacheLayout.mjs');
  const { dungeonLocationFor } = await import('../../src/world/smallerDungeons.js');
  const { synthesizeDungeonLocation, WORLD_SALT } = await import('../../src/world/spawnedDungeons.js');
  const chirtir = w.maps.getLocationByName('Dragontail Mountains', 'Ruins of Chirtir Hall'), formte = w.maps.getLocationByName('Alik\'r Desert', 'Ruins of The F\'ormte Cabin');
  const cases = [
    ['Morrowind (3293,548)', dungeonLocationFor(synthesizeDungeonLocation(chirtir, { salt: WORLD_SALT, px: 3293, py: 548 }), { online: true }), 'd1226386653'],
    ['Chirtir Hall, whole', chirtir, 'd411869'], ['Chirtir Hall, online', dungeonLocationFor(chirtir, { online: true }), 'd411869'],
    ['F\'ormte Cabin, whole', formte, 'd439449'], ['F\'ormte Cabin, online', dungeonLocationFor(formte, { online: true }), 'd439449'],
    ['Perore, whole', w.maps.getLocationByName('Wrothgarian Mountains', 'The Laboratory of Perore'), 'd130893'],
  ];
  for (const [name, L, id] of cases) {
    assert.equal(aurumCachePlaceOf(L), id, name);
    const { col, piles } = built(L), foot = aurumCacheFoot(piles, aurumCacheSpotOf(id), col);
    assert.ok(foot, `${name}: a coffer stands`);
    assert.deepEqual(cofferMeets(foot, piles, col), [], name);
  }
});

test('AUDIT-STOREFRONT III D1-D3 on the player\'s data, the world over: every 16th Bay dungeon (the online layout and the whole by turns) and lairs of every theatre past the Bay, each its one cache - no coffer\'s box meets a pile\'s, a door\'s or a mover\'s, none stands on a pile\'s foot, and a dungeon with a pile to stand by stands its coffer in all but a few (mutants: the mesh read as a door)', { skip: NO_ARENA2 }, async () => {
  const { w, built } = await freeware();
  const { cofferMeets } = await import('../../tools/aurumCacheLayout.mjs');
  const { dungeonLocationFor } = await import('../../src/world/smallerDungeons.js');
  const { theatreAt, THEATRE_KEYS } = await import('../../src/world/worldWide/worldGrid.js');
  const { lairSite, LAIR_COLS, LAIR_ROWS } = await import('../../src/world/tamrielDungeons.js');
  const by = {}, met = [];
  const check = (L, label, theatre) => {
    const place = aurumCachePlaceOf(L);
    if (!place) return;
    const { col, piles } = built(L), id = place, T = (by[theatre] ??= { piled: 0, coffers: 0 });
    const foot = aurumCacheFoot(piles, aurumCacheSpotOf(id), col);
    if (!piles.some((p) => p.lawHalf)) return assert.equal(foot, null, `${label}: no pile, no coffer`);
    T.piled++;
    if (!foot) return;
    T.coffers++;
    const m = cofferMeets(foot, piles, col);
    if (m.length) met.push(`${label} ${id}: ${m}`);
  };
  let k = 0;
  for (const loc of w.rows) if (loc?.hasDungeon && k++ % 16 === 0) check(dungeonLocationFor(loc, { online: true, whole: k % 32 === 17 }), `${loc.regionName}/${loc.name}`, 'IliacBay');
  for (let c = 0; c < LAIR_COLS * LAIR_ROWS; c += 173) {
    const s = lairSite(c), th = theatreAt(s.px, s.py), L = th > 0 ? w.places.provinceQuestPlaces.lairCloneAt(s.px, s.py) : null;
    if (L) check(dungeonLocationFor(L, { online: true }), `${THEATRE_KEYS[th]}/${L.name} (${s.px},${s.py})`, THEATRE_KEYS[th]);
  }
  assert.deepEqual(met, [], 'no coffer meets a pile, a door or a mover');
  assert.ok(by.IliacBay.coffers >= 200, `the Bay: ${JSON.stringify(by.IliacBay)}`);
  const provinces = Object.keys(by).filter((t) => t !== 'IliacBay' && by[t].coffers >= 20);
  assert.ok(provinces.length >= 2 && provinces.includes('Morrowind') && provinces.includes('Skyrim'), `the provinces: ${JSON.stringify(by)}`);
  const all = Object.values(by).reduce((a, t) => ({ piled: a.piled + t.piled, coffers: a.coffers + t.coffers }), { piled: 0, coffers: 0 });
  assert.ok(all.piled - all.coffers <= all.piled * 0.02, `a dungeon with a pile stands its coffer in all but a few: ${JSON.stringify(all)}`);
});

test('AUDIT AURUM-CACHES E1 and lane 3 F2, F6: the press carries the proof the dungeon\'s welcome brought and the account the coffer was stood for; a corrupt device note starts again and keeps the yes (mutants: the proof unsent, the account unsent, a corrupt note kept)', async () => {
  const L = loc((3 << 20) | 4400);
  const k = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const mapId = (3 << 20) | 4400, proof = await mintCacheProof({ s: 'acct', m: mapId }, k.privateKey, { subtle: webcrypto.subtle, nowS: Math.floor(Date.now() / 1000) });
  for (const bad of ['[]', '5', '"x"', 'true', '{"acct":["d1"', 'null']) {
    _resetAurumCaches(); _resetCacheProof();
    keepCacheProof(`dungeon:m${mapId}`, proof);
    const storage = memory(), asked = [];
    storage.setItem(AURUM_CACHE_STORE, bad);
    const c = standAurumCache(fakeCtx(), L, PILES, { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage, claim: async (...a) => { asked.push(a); return { ok: true }; }, audio: null });
    assert.equal(c.open, false, bad);
    c.press(AURUM_CACHE_KEY);
    await tick(); await tick();
    assert.deepEqual(asked, [[c.id, proof, 'acct']], `${bad}: the id, the relay's proof, the account`);
    assert.deepEqual(JSON.parse(storage.getItem(AURUM_CACHE_STORE)), { acct: [c.id] }, `${bad}: started again`);
  }
  _resetCacheProof();
});

test('CHEST3D: the coffer is the owner\'s chest in gold where the host hands the mesh door - shut in the level\'s draws at its foot, its front away from its pile, the open one once its yes lands, gone when the level is; no door, its picture (mutants: the model unstood, the yes not swapped, the facing toward the pile, the teardown leaving it)', async () => {
  _resetAurumCaches();
  const L = loc((3 << 20) | 4410), storage = memory(), asked = [];
  const ctx = { ...fakeCtx(), dynamicDraws: [] };
  const meshes = { getGpuMesh: async (id) => { asked.push(id); return { id }; } };
  const c = standAurumCache(ctx, L, PILES, { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage, claim: async () => ({ ok: true }), audio: null, meshes });
  await tick(); await tick();
  assert.deepEqual(asked, [AURUM_COFFER_MODELS.shut]);
  assert.equal(ctx.dynamicDraws.length, 1);
  assert.deepEqual(ctx.stood, [], 'no picture beside it');
  const m = ctx.dynamicDraws[0].object.matrix;
  assert.deepEqual([m[12], m[13], m[14]].map((v) => +v.toFixed(5)), c.foot.map((v) => +v.toFixed(5)), 'at its foot');
  const near = PILES.reduce((a, p) => ((p.pos[0] - c.foot[0]) ** 2 + (p.pos[2] - c.foot[2]) ** 2 < (a.pos[0] - c.foot[0]) ** 2 + (a.pos[2] - c.foot[2]) ** 2 ? p : a));
  const front = [m[8], m[10]], away = [c.foot[0] - near.pos[0], c.foot[2] - near.pos[2]];
  assert.ok(front[0] * away[0] + front[1] * away[1] > 0.99 * Math.hypot(...away), 'its front (+z) away from its pile');
  assert.equal(aurumCofferYaw([], [1, 0, 1]), 0, 'no pile: its own facing');
  c.press(AURUM_CACHE_KEY);
  await tick(); await tick(); await tick();
  assert.deepEqual(asked, [AURUM_COFFER_MODELS.shut, AURUM_COFFER_MODELS.open], 'emptied: the open one');
  assert.deepEqual(ctx.dynamicDraws.map((d) => d.gpu.id), [AURUM_COFFER_MODELS.open], 'one stands');
  for (const f of ctx.downs) f();
  assert.deepEqual(ctx.dynamicDraws, [], 'gone with the level');
  _resetAurumCaches();
  const bare = fakeCtx();
  standAurumCache(bare, loc((3 << 20) | 4411), PILES, { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), storage: memory(), claim: async () => ({ ok: true }), audio: null });
  await tick();
  assert.deepEqual(bare.stood.map((b) => b.record), [AURUM_COFFER_ART.shut], 'no mesh door: its picture');
});
