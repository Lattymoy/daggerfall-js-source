// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): THE COFFER IN THE WORLD -
// which dungeons hold one (a Bay dungeon by its pixel id, a lair past the Bay by its whole id; no made level, Abyss
// Dungeon, arena floor or zone hall), where it stands (beside a treasure pile the cache's hash picks, clear of the walls,
// on the pile's floor), and the press (claimed once, opened, kept open for the account; refused, said why). On the
// freeware, a Bay dungeon and a lair of Cyrodiil each stand theirs. tools/mutants/aurum_caches.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  standAurumCache, aurumCachePlaceOf, aurumCacheFoot, aurumCacheStood, _resetAurumCaches, AURUM_CACHE_KEY, AURUM_CACHE_TEXT, AURUM_CACHE_STORE,
  AURUM_CACHE_OFF_M, AURUM_CACHE_CLEAR_M, AURUM_CACHE_SIDE_M, AURUM_CACHE_KNEE_M,
} from '../../src/scenes/aurumCacheHost.js';
import { AURUM_COFFER_ARCHIVE, AURUM_COFFER_ART } from '../../src/world/aurumCofferArt.js';
import { aurumCacheHolds, aurumCacheId, aurumCacheSpotOf, aurumCacheDayOf } from '../../src/net/aurumCacheLaw.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { GATE_ARENA_LOCATION_ID } from '../../src/world/gate/gateArena.js';
import { REFUSALS } from '../../src/net/accountClient.js';
import { TREASURE_ACTIVATION_DISTANCE } from '../../src/player/activate.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DAY0 = Math.floor(Date.UTC(2026, 10, 18) / 86_400_000);
const loc = (mapId, o = {}) => ({ name: 'D', hasDungeon: true, mapTableData: { mapId, dungeonType: 0 }, dungeon: { recordElement: { header: { locationId: 9 } }, blocks: [] }, ...o });
/** The first day from DAY0 a location holds a cache. */
const cacheDay = (l) => { for (let d = DAY0; ; d++) if (aurumCacheHolds(d, aurumCachePlaceOf(l))) return d; };
const at = (day) => () => (day * 86_400 + 43_200) * 1000;

/** A corridor along z, 4 m wide (walls at x = +-2), its floor at 0 - but a pit a metre deep from z 6 to 8, and a dais
 *  0.4 m high from z 9. */
const floorAt = (z) => (z >= 6 && z < 8 ? -1 : z >= 9 ? 0.4 : 0);
const CORRIDOR = {
  raycast(o, d, max) {
    if (d[1] < 0) { const t = o[1] - floorAt(o[2]); return t >= 0 && t <= max ? t : Infinity; }
    let best = Infinity;
    for (const wx of [2, -2]) { if (Math.abs(d[0]) < 1e-9) continue; const t = (wx - o[0]) / d[0]; if (t > 0 && t < best) best = t; }
    return best <= max ? best : Infinity;
  },
};

test('AURUM-CACHES which dungeons hold one: a Bay dungeon by its pixel id, a lair past the Bay by its whole id - never a made level, an Abyss Dungeon, the arena\'s floor or undercroft, a zone hall or a place with no id (mutants: a made level stands one, the Bay\'s id not masked)', () => {
  assert.equal(aurumCachePlaceOf(loc((5 << 20) | 123456)), 'd123456', 'the Bay: DFU\'s MapId & 0xfffff');
  const lair = lairPlaceId(4242);
  assert.equal(aurumCachePlaceOf(loc(lair)), `d${lair}`, 'past the Bay: the whole id');
  assert.equal(aurumCachePlaceOf(loc(lair, { gate: 3, dungeon: { recordElement: { header: { locationId: GATE_ARENA_LOCATION_ID } } } })), null, 'the Burning Court');
  assert.equal(aurumCachePlaceOf(loc(77, { superTier: true })), null, 'an Abyss Dungeon');
  assert.equal(aurumCachePlaceOf(loc((0xf << 28) | 5)), null, 'a zone hall');
  for (const bad of [loc(-1), loc(1.5), { mapTableData: {} }, null]) assert.equal(aurumCachePlaceOf(bad), null);
});

test('AURUM-CACHES where it stands: the random pile its hash picks (a fixed one only where none is random), then the first way from its bearing clear at knee height, AURUM_CACHE_OFF_M along it, clear either side, on the pile\'s floor - a ledge or a wall turns it to the next way, and no way stands it on the pile (mutants: the pick not the hash\'s, the clear ray unread, the step unread, the sides unread, the foot left at knee height)', () => {
  const piles = [{ pos: [0, 0, 0], isFixed: true }, { pos: [0, 0, 1] }, { pos: [0, 0, 2] }, { pos: [0, 0, 3] }, { pos: null }];
  assert.equal(aurumCacheFoot([], { pile: 0, bearing: 0 }, CORRIDOR), null);
  assert.deepEqual(aurumCacheFoot([{ pos: [1, 0, 1], isFixed: true }], { pile: 0.9, bearing: 0 }, CORRIDOR).map((v) => +v.toFixed(6)), [1, 0, 1.9], 'a fixed pile where none is random');
  // down the corridor (bearing 0, +z): clear, the sides 2 m off
  const f = aurumCacheFoot(piles, { pile: 0.5, bearing: 0 }, CORRIDOR);
  assert.deepEqual(f.map((v) => +v.toFixed(6)), [0, 0, 2 + AURUM_CACHE_OFF_M], 'the middle random pile, 0.9 m on');
  assert.equal(aurumCacheFoot(piles, { pile: 0, bearing: 0 }, CORRIDOR)[2].toFixed(6), (1 + AURUM_CACHE_OFF_M).toFixed(6), 'the first random pile - the fixed one is passed');
  assert.equal(aurumCacheFoot(piles, { pile: 0.99, bearing: 0 }, CORRIDOR)[2].toFixed(6), (3 + AURUM_CACHE_OFF_M).toFixed(6), 'the last');
  // toward a wall 2 m off (bearing +x): not clear for 1.5 m? it is (2 > 1.5) - but the coffer would stand 1.1 m from it, its
  // sides along z clear: it stands
  const east = aurumCacheFoot([{ pos: [0, 0, 0] }], { pile: 0, bearing: Math.PI / 2 }, CORRIDOR);
  assert.deepEqual(east.map((v) => +v.toFixed(6)), [AURUM_CACHE_OFF_M, 0, 0]);
  // a pile 1 m from the east wall: east is not clear, nor the next way (an eighth on, 1.41 m to the wall) - the one after, -z
  const nearWall = aurumCacheFoot([{ pos: [1, 0, 0] }], { pile: 0, bearing: Math.PI / 2 }, CORRIDOR);
  assert.deepEqual(nearWall.map((v) => +v.toFixed(6)), [1, 0, -AURUM_CACHE_OFF_M], 'turned from the wall');
  // a pile 1.7 m from the east wall heading +z: the way is clear but a side is 0.3 m short of AURUM_CACHE_SIDE_M - it turns on
  const tight = aurumCacheFoot([{ pos: [1.7, 0, 0] }], { pile: 0, bearing: 0 }, CORRIDOR);
  assert.ok(Math.abs(tight[0] - 1.7) > 0.1 || tight[2] < 0, `a wall at its side turns it (${tight})`);
  assert.ok(2 - tight[0] >= AURUM_CACHE_SIDE_M - 1e-9 && tight[0] + 2 >= AURUM_CACHE_SIDE_M, 'clear of both walls');
  // a pile at a ledge (z 5.5, the pit at 6): +z lands a metre down - turned to the next way
  const ledge = aurumCacheFoot([{ pos: [0, 0, 5.5] }], { pile: 0, bearing: 0 }, CORRIDOR);
  assert.ok(ledge[2] < 6 && ledge[1] === 0, `no coffer off a ledge (${ledge})`);
  // a pile before the dais (z 8.5, the dais at 9): +z and the next eighth land on it, 0.4 m up - a step too high; then +x
  const dais = aurumCacheFoot([{ pos: [0, 0, 8.5] }], { pile: 0, bearing: 0 }, CORRIDOR);
  assert.deepEqual(dais.map((v) => +v.toFixed(6)), [AURUM_CACHE_OFF_M, 0, 8.5], 'no coffer up on a dais');
  // nowhere clear: a box 1 m wide - the pile's own foot
  const BOX = { raycast: (o, d, max) => (d[1] < 0 ? (o[1] <= max ? o[1] : Infinity) : (0.5 <= max ? 0.5 : Infinity)) };
  assert.deepEqual(aurumCacheFoot([{ pos: [3, 0, 3] }], { pile: 0, bearing: 1 }, BOX), [3, 0, 3]);
  assert.ok(AURUM_CACHE_CLEAR_M > AURUM_CACHE_OFF_M + AURUM_CACHE_SIDE_M - 1e-9 && AURUM_CACHE_KNEE_M > 0, 'the way ahead clear past the coffer\'s far side');
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
const PILES = [{ pos: [0, 0, 0] }, { pos: [0, 0, 1] }, { pos: [0, 0, 2] }];

test('AURUM-CACHES the coffer stood: online and signed in, in a dungeon that holds today\'s cache - its shut picture at its foot, its target at a treasure pile\'s reach, its name, and a line that it is here; none offline, for a guest, with no session, on a day it holds none (mutants: offline stands one, a guest stands one, the day unread)', async () => {
  _resetAurumCaches();
  const L = loc(lairPlaceId(77)), day = cacheDay(L);
  const deps = (o = {}) => ({ online: () => true, session: () => ({ id: 'acct', kind: 'user' }), nowMs: at(day), storage: memory(), claim: async () => ({ ok: true }), audio: null, ...o });
  const ctx = fakeCtx();
  const c = standAurumCache(ctx, L, PILES, deps());
  assert.ok(c, 'stood');
  assert.equal(c.id, aurumCacheId(day, aurumCachePlaceOf(L)));
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
  for (const [why, o] of [['offline', { online: () => false }], ['a guest', { session: () => ({ id: 'g', kind: 'guest' }) }], ['no session', { session: () => null }],
    ['a day with none', { nowMs: at(DAY0 + [...Array(40).keys()].find((k) => !aurumCacheHolds(DAY0 + k, aurumCachePlaceOf(L)))) }]]) {
    assert.equal(standAurumCache(fakeCtx(), L, PILES, deps(o)), null, why);
  }
  assert.equal(standAurumCache(fakeCtx(), loc(77, { superTier: true }), PILES, deps()), null, 'an Abyss Dungeon');
  assert.equal(standAurumCache(fakeCtx(), L, [], deps()), null, 'no pile to stand it by');
});

test('AURUM-CACHES the press: the coffer asks the service once with its id - a second press while it asks is that ask - and on its yes opens, says its Aurum and is kept open for the account; pressed again it is empty and asks nothing; entered again the same day it stands open (mutants: the ask repeated, the open not kept, the picture not swapped)', async () => {
  _resetAurumCaches();
  const L = loc((3 << 20) | 4321), day = cacheDay(L), storage = memory();
  const asked = [];
  let answer;
  const claim = (id) => { asked.push(id); return new Promise((r) => { answer = r; }); };
  const deps = { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), nowMs: at(day), storage, claim, audio: null };
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
  // the same dungeon again, the same day: open, and no line that one is here
  const again = fakeCtx();
  const c2 = standAurumCache(again, L, PILES, deps);
  await tick();
  assert.equal(c2.open, true);
  assert.deepEqual(again.stood.map((b) => b.record), [AURUM_COFFER_ART.open]);
  assert.deepEqual(again.said, []);
  // another account on this device: shut
  const other = standAurumCache(fakeCtx(), L, PILES, { ...deps, session: () => ({ id: 'other', kind: 'user' }) });
  assert.equal(other.open, false);
  // the device keeps today's and yesterday's alone: an older id goes with the next one kept
  storage.setItem(AURUM_CACHE_STORE, JSON.stringify({ acct: [`${day - 2}:d1`, `${day - 1}:d2`, c.id], gone: [`${day - 5}:d3`] }));
  const L2 = loc((3 << 20) | [...Array(500).keys()].find((k) => aurumCacheHolds(day, `d${k}`) && k !== 4321));
  const next = standAurumCache(fakeCtx(), L2, PILES, { ...deps, claim: async () => ({ ok: true }) });
  next.press(AURUM_CACHE_KEY);
  await tick(); await tick();
  assert.deepEqual(JSON.parse(storage.getItem(AURUM_CACHE_STORE)), { acct: [`${day - 1}:d2`, c.id, next.id], gone: [] });
});

test('AURUM-CACHES a refusal: taken (another device emptied it) opens it and says so; capped stays shut and says the bound; closed says so and stands no coffer again this session; an answer after the level is gone touches nothing (mutants: taken left shut, closed forgotten, a late answer stands a picture)', async () => {
  _resetAurumCaches();
  const L = loc((3 << 20) | 999), day = cacheDay(L);
  const deps = (error) => ({ online: () => true, session: () => ({ id: 'acct', kind: 'user' }), nowMs: at(day), storage: memory(), claim: async () => ({ ok: false, error }), audio: null });
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

test('AURUM-CACHES THE FOUR HOSTS: the dungeon context stands the coffer once its level and piles are, and its takeLoot presses it; the modal dungeon arm and the standalone dungeon carry `aurum:` there in their loot arms, as DELVE II\'s `delve:`; the world and the street stand none (mutants: the ladder\'s arm dropped, the bench\'s arm dropped, the context\'s arm dropped)', () => {
  const dc = read('src/scenes/dungeonContext.js'), wm = read('src/scenes/worldModes.js'), sd = read('src/scenes/dungeon.js');
  assert.ok(dc.includes('  const _aurumCache = standAurumCache(api, dfLocation, lootPiles);'), 'stood at the build\'s end');
  assert.ok(dc.indexOf('const _aurumCache = standAurumCache(') > dc.indexOf('for (const pile of lootPiles) {'), 'after the piles stand on their floors');
  assert.ok(dc.includes("      if (kind === 'aurum') return _aurumCache?.press(key) ? 1 : 0;"), 'takeLoot\'s arm');
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

test('AURUM-CACHES on the player\'s data: a Bay dungeon (The Convocation of Elona) and a lair of Cyrodiil (The Androgulus Reformatory) each stand their coffer on a day they hold one - beside a random treasure pile, on its floor, clear of the walls, the same spot twice (mutants: the foot left at knee height)', { skip: HAS ? false : 'ARENA2_PATH not set - the freeware is fetched by tools/fetch-data.sh' }, async () => {
  const { standWorldPastBay } = await import('../systems/quest/r25World.mjs');
  const { layoutDungeon } = await import('../../src/world/dungeon/dungeonLayout.js');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { hostFireCollider, hostModelReader } = await import('../../tools/dungeonFireProbe.mjs');
  const { floorLanding } = await import('../../src/player/enterExit.js');
  const { RANDOM_TREASURE_MARKER_RECORD } = await import('../../src/systems/loot/loot.js');
  const w = await standWorldPastBay(ARENA2);
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  const getModel = hostModelReader(arch);
  const bay = w.maps.getLocationByName('Daggerfall', 'The Convocation of Elona');
  const lair = w.places.provinceQuestPlaces.lairCloneAt(2163, 479);
  assert.equal(lair?.name, 'The Androgulus Reformatory');
  const places = new Set();
  for (const [name, L, inBay] of [['the Bay', bay, true], ['Cyrodiil', lair, false]]) {
    const place = aurumCachePlaceOf(L);
    assert.ok(place, name);
    places.add(place);
    assert.equal(Number(place.slice(1)) < 0x80000, inBay, `${name}: ${place}`);
    const d = layoutDungeon(L, w.blocks, getModel);
    const col = hostFireCollider(d.blocks, getModel);
    const piles = [];
    for (const b of d.blocks) for (const m of b.layout.markers) if (!m.archive && m.record === RANDOM_TREASURE_MARKER_RECORD) piles.push({ pos: floorLanding(col, [m.x + b.originX, m.y + 0.2, m.z + b.originZ]) });
    assert.ok(piles.length >= 2, `${name}: its random treasure piles (${piles.length})`);
    const day = cacheDay(L), id = aurumCacheId(day, place);
    assert.equal(aurumCacheDayOf(at(day)() / 1000), day);
    const foot = aurumCacheFoot(piles, aurumCacheSpotOf(id), col);
    assert.deepEqual(aurumCacheFoot(piles, aurumCacheSpotOf(id), col), foot, `${name}: the same spot twice`);
    const near = piles.map((p) => Math.hypot(p.pos[0] - foot[0], p.pos[2] - foot[2])).sort((a, b) => a - b)[0];
    assert.ok(near <= AURUM_CACHE_OFF_M + 1e-6, `${name}: beside its pile (${near})`);
    const down = col.raycast([foot[0], foot[1] + 0.5, foot[2]], [0, -1, 0], 1, { only: ['dungeon'] });
    assert.ok(Math.abs(down - 0.5) < 0.02, `${name}: on the floor (${down})`);
    const sides = [0, 1, 2, 3].map((k) => col.raycast([foot[0], foot[1] + AURUM_CACHE_KNEE_M, foot[2]], [Math.sin(k * Math.PI / 2), 0, Math.cos(k * Math.PI / 2)], 3, { only: ['dungeon'] }));
    assert.ok(sides.filter((s) => s < AURUM_CACHE_SIDE_M - 1e-6).length <= 1, `${name}: clear of the walls (${sides.map((s) => s.toFixed(2))})`);
    // and the whole stand on the real foot: the coffer stood where the law says
    _resetAurumCaches();
    const ctx = { ...fakeCtx(), collider: col };
    const c = standAurumCache(ctx, L, piles, { online: () => true, session: () => ({ id: 'acct', kind: 'user' }), nowMs: at(day), storage: memory(), claim: async () => ({ ok: true }), audio: null });
    assert.deepEqual(c.foot, foot, name);
  }
  assert.equal(places.size, 2, 'two places, two caches');
});
