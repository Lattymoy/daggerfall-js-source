// DLV2 (bible/03-World/Delve-II.md sections 3, 5 and 6): A DUNGEON'S ENCOUNTERS, STOOD - the Hold's foes at its gates and
// on its leash, the Litany's plates seen and stepped, the marks on the floor, the chest, and the host that runs each
// site's ledger on the player's own words: built on a real collider's room, a Hold and a Litany each won end to end, the
// vault sealed then opened, a save's word kept, and the dungeons that stand none. Pins held to fail under the mutations in
// tools/mutants/dlv2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDelveHost, delveStandsNone, delveKindsFor, delveKeySite, chestYaw, DELVE_PREF, DELVE_KEY, DELVE_NEAR_M, DELVE_AWAY_SAY_MS } from '../../../src/scenes/delve/delveHost.js';
import { createHoldFoes, holdStandPlaces, holdDowned, HOLD_RANK_STEP_M, HOLD_STAND_TRIES, HOLD_RESTAND_MS } from '../../../src/scenes/delve/delveHold.js';
import { plateLooks, shownPlate, PLATE_LOOK, PLATE_WRONG_MS, DELVE_SOUNDS } from '../../../src/scenes/delve/delveLitany.js';
import { siteShapes, siteFloor, chestMatrix, createDelvePieces, delveChestBucket, DELVE_COLORS, DELVE_CHEST_MODEL, DELVE_DRAW_M } from '../../../src/scenes/delve/delvePieces.js';
import { DP, holdGates, litanyPlates, newDelveLedger, foldDelveWord, HOLD_GATHER_MS, HOLD_BREATH_MS, HOLD_CAPTAIN_MIN_MS, HOLD_CAPTAIN_MAX_MS, litanyShowMs, DELVE_KIND_NAMES } from '../../../src/net/delve/delveLaw.js';
import { siteKinds } from '../../../src/world/dungeon/delveSites.js';
import { starClearFloorMs } from '../../../src/net/starfall/starfallLaw.js';
import { TELEGRAPH_KIND, TELEGRAPH_POOL } from '../../../src/render/gate/gateTelegraph.js';
import { quickLootArm, resetQuickLoot, foldQuickLoot } from '../../../src/systems/quickLoot.js';
import { registerEncounterTableSelector } from '../../../src/characters/encounterTableDoor.js';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { resolveHover } from '../../../src/systems/worldHover.js';
import { setPref as setUiPref } from '../../../src/systems/uiPrefs.js';
import { Collider } from '../../../src/player/collider.js';
import { RDB_SIDE } from '../../../src/world/rdbLayout.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { midScreenText, setMidScreenText } from '../../../src/ui/midScreenText.js';
import { PRIVATEERS_HOLD_MAP_ID } from '../../../src/world/dungeon/dungeonTextures.js';
import { KT_SHIP_LOCATION_ID } from '../../../src/world/ketch/ketchShip.js';
import { ARENA_FLOOR_LOCATION_ID } from '../../../src/world/arena/arenaFloor.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setImmediate(r));
const site = (o = {}) => ({ i: 0, kind: 'hold', x: 10, y: 0, z: 20, r: 4, tier: 'regular', vault: [13.4, 0, 20], ...o });

test('DLV2 THE HOLD\'S PLACES: the four gates in turn, each next rank 0.9 m nearer the heart; a foe asked three times, a lost captain again after 2 s (mutants: the rank\'s step; one gate for all; the tries; the restand\'s wait)', () => {
  const s = site();
  const p = holdStandPlaces(s, 6);
  assert.deepEqual(p.slice(0, 4), holdGates(s));
  const d = (q) => Math.hypot(q[0] - s.x, q[2] - s.z);
  assert.ok(Math.abs(d(p[4]) - (d(p[0]) - 0.9)) < 1e-9, 'the second rank a step in');
  assert.ok(Math.abs(d(p[5]) - (d(p[1]) - 0.9)) < 1e-9);
  assert.equal(p[5][1], s.y);
  assert.equal(new Set(p.map((q) => q.join())).size, 6, 'no two on one spot');
  assert.deepEqual([HOLD_RANK_STEP_M, HOLD_STAND_TRIES, HOLD_RESTAND_MS], [0.9, 3, 2_000]);
});

/** A fake dungeon's pool: foes that stand where asked (null while `fail` says so), die when struck, and leave it - dead
 *  and gone, spliced out - when removed, as removeLooseFoe's dropOwnPuppet does. */
function fakeFoes() {
  const pool = [], stood = [], removed = [];
  let clock = 0;
  const host = {
    fail: 0,
    spawn: async (type, at, opts) => {
      if (host.fail > 0) { host.fail--; return null; }
      const f = { type, at, opts, dead: false, ai: {}, entity: { maxHealth: 50, health: 50 } };
      stood.push(f); pool.push(f); return f;
    },
    remove: (f) => { removed.push(f); f.dead = true; f._gone = true; const k = pool.indexOf(f); if (k >= 0) pool.splice(k, 1); return true; },
    pick: () => 7, elites: () => true, alive: () => true, rolls: () => 0.3,
    foes: () => pool, now: () => clock,
  };
  return { host, pool, stood, removed, tick: (ms) => { clock += ms; } };
}
const kill = (f) => { f.entity.health = 0; f.dead = true; };
const read = (H) => { H.frame(); return H.word(); };

test('DLV2 THE HOLD\'S FOES: a wave stands its size at the gates, a step off the floor, facing the heart, stamped and unleashed (the Enhanced AI fights with it); its downed and its clear read off the pool; a foe removed is out of the wave but no kill; a body that takes another\'s place stands for it (mutants: the clear before the last stood; a removal counted a kill; a leash set)', async () => {
  const s = site(), { host, pool, stood } = fakeFoes();
  const H = createHoldFoes(s, host);
  assert.deepEqual(read(H), { o: 1, kw: 0, kn: 0, wc: 0, cf: 0 });
  H.on({ k: 'wave', w: 1, wz: 5 });
  assert.equal(read(H).wc, 0, 'nothing has stood yet: no clear');
  await flush();
  assert.equal(stood.length, 5);
  const places = holdStandPlaces(s, 5);
  stood.forEach((f, j) => {
    assert.deepEqual(f.at, [places[j][0], places[j][1] + 1.25, places[j][2]], 'the placement\'s separation over the floor');
    assert.deepEqual(f._delve, { i: 0, g: 0, w: 1, cap: false });
    assert.equal(f.ai.follow, undefined, 'no leash: a follower takes no tactics (ai/tactics.js)');
    assert.ok(Math.abs(f.opts.yawRad - Math.atan2(s.x - places[j][0], s.z - places[j][2])) < 1e-12, 'facing the heart');
  });
  kill(stood[0]); kill(stood[3]);
  assert.deepEqual(read(H), { o: 1, kw: 1, kn: 2, wc: 0, cf: 0 });
  host.remove(stood[1]);   // a dispel's, a mod's: out of the fight, no kill
  assert.deepEqual(read(H), { o: 1, kw: 1, kn: 2, wc: 0, cf: 0 }, 'gone, not downed');
  // the Wabbajack's change of stood[2]: the old body removed alive (no kill), the new one stamped as the context's door stamps it
  const changed = { type: 9, dead: false, ai: {}, entity: { maxHealth: 20, health: 20 } };
  stood[2].dead = true; pool.push(changed); changed._delve = stood[2]._delve;
  kill(stood[4]);
  assert.deepEqual(read(H), { o: 1, kw: 1, kn: 3, wc: 0, cf: 0 }, 'the changed body still stands for the wave');
  kill(changed);
  assert.deepEqual(read(H), { o: 1, kw: 1, kn: 4, wc: 1, cf: 0 }, 'every one down or gone: cleared');
  for (const f of [{ dead: true, entity: { health: 5 }, executed: true }, { dead: true, entity: { health: 5 }, _swornAway: true }, { dead: true, entity: { health: 5 }, escaped: true }]) assert.equal(holdDowned(f), true);
  assert.equal(holdDowned({ dead: true, entity: { health: 5 } }), false, 'removed alive: not down');
  assert.equal(holdDowned({ dead: false, entity: { health: 0 } }), false);
  H.on({ k: 'wave', w: 2, wz: 3 });
  assert.deepEqual(read(H), { o: 1, kw: 2, kn: 0, wc: 0, cf: 0 }, 'a new wave counts its own');
});

test('DLV2 THE HOLD\'S CAPTAIN AND ITS ENDS: an elite with the ledger\'s traits; fallen only when downed; one gone without its fall (or never stood) stood again after 2 s; a foe that will not stand asked three times; a crumble takes every living foe of the site\'s, a late one as it stands, and leaves the next attempt\'s count whole (mutants: the captain\'s traits; a gone captain fallen; no restand; the tries; the late one kept; the count spoilt by a crumble)', async () => {
  const s = site(), F = fakeFoes(), { host, pool, stood, removed } = F;
  const H = createHoldFoes(s, host);
  H.on({ k: 'captain', traits: 2 });
  await flush();
  const cap = stood.at(-1);
  assert.equal(cap.opts.eliteFoe, true);
  assert.equal(cap.entity.bossTraits.length, 2);
  assert.deepEqual(cap._delve, { i: 0, g: 0, w: 0, cap: true });
  assert.equal(read(H).cf, 0);
  host.remove(cap);   // gone without its fall
  F.tick(HOLD_RESTAND_MS - 1);
  assert.equal(read(H).cf, 0); await flush();
  assert.equal(stood.length, 1, 'not yet stood again');
  F.tick(1); read(H); await flush();
  assert.equal(stood.length, 2, 'a new captain');
  assert.equal(stood[1].entity.bossTraits.length, 2);
  kill(stood[1]);
  assert.equal(read(H).cf, 1, 'downed: fallen');
  // a captain that will not stand: three asks, then again after the wait
  const G = fakeFoes(); G.host.fail = 3;
  const C = createHoldFoes(s, G.host);
  C.on({ k: 'captain', traits: 1 });
  await flush(); await flush();
  assert.equal(G.stood.length, 0); assert.equal(G.host.fail, 0, 'asked three times');
  G.tick(HOLD_RESTAND_MS); read(C); await flush();
  assert.equal(G.stood.length, 1, 'asked again: it stands');
  assert.equal(G.stood[0].entity.bossTraits.length, 1);
  // an elite only where elites stand; nothing where the table has none
  const plain = fakeFoes(); plain.host.elites = () => false;
  const P = createHoldFoes(s, plain.host);
  P.on({ k: 'captain', traits: 1 });
  await flush();
  assert.equal(plain.stood[0].opts.eliteFoe, false);
  const empty = fakeFoes(); empty.host.pick = () => -1;
  const E = createHoldFoes(s, empty.host);
  E.on({ k: 'wave', w: 1, wz: 4 });
  await flush();
  assert.equal(empty.stood.length, 0);
  assert.equal(read(E).wc, 0, 'nothing stood: nothing cleared (the wave runs its 90 s)');
  // the crumble: the living go (any attempt's - a load's revived ones), the dead keep their bodies
  H.on({ k: 'wave', w: 1, wz: 2 });
  await flush();
  const revived = { dead: false, ai: {}, entity: { health: 9 }, _delve: { i: 0, g: -5, w: 3, cap: false } };
  const stranger = { dead: false, ai: {}, entity: { health: 9 }, _delve: { i: 1, g: 0, w: 1, cap: false } };
  pool.push(revived, stranger);
  const n0 = removed.length;
  H.on({ k: 'failed' });
  assert.deepEqual(removed.slice(n0), [stood[2], stood[3], revived], 'this site\'s living, a revived one too; never another site\'s');
  assert.equal(stranger.dead, false);
  assert.deepEqual(read(H), { o: 1, kw: 0, kn: 0, wc: 0, cf: 0 });
  // a wave called, then failed before it stood: what stands after is taken back, and the next attempt counts whole
  let release = null;
  const spawn = host.spawn;
  host.spawn = (...a) => new Promise((r) => { release = () => r(spawn(...a)); });
  H.on({ k: 'wave', w: 1, wz: 1 });
  H.on({ k: 'failed' });
  host.spawn = spawn;
  H.on({ k: 'wave', w: 1, wz: 2 });
  await flush();
  release(); await flush(); await flush();
  assert.equal(stood.at(-1).dead, true, 'the late one taken back as it stood');
  assert.equal(H.state().pending, 0, 'never below nothing');
  for (const f of H.foes()) kill(f);
  assert.equal(read(H).wc, 1, 'the next attempt clears');
  // a half stood wave: its dead are not its clear while one is still coming
  const slow = fakeFoes(); let let1 = null;
  const sp = slow.host.spawn;
  slow.host.spawn = (...a) => (slow.stood.length === 2 ? new Promise((r) => { let1 = () => r(sp(...a)); }) : sp(...a));
  const S2 = createHoldFoes(s, slow.host);
  S2.on({ k: 'wave', w: 1, wz: 3 });
  await flush();
  for (const f of slow.stood) kill(f);
  assert.equal(read(S2).wc, 0, 'one still coming');
  let1(); await flush(); await flush();
  kill(slow.stood[2]);
  assert.equal(read(S2).wc, 1);
});

test('DLV2 THE LITANY SEEN: the order shown a plate a second, the lit lit as worked, all lit when won, a wrong plate red for 0.7 s (mutants: the shown step; the lit count; the wrong\'s span)', () => {
  const s = site({ kind: 'litany' });
  const led = newDelveLedger(s, 'me', 1, 0);
  assert.deepEqual(plateLooks(null, 4), [0, 0, 0, 0]);
  foldDelveWord(led, 'me', '', { lv: 1 }, { party: true, inWard: true, plate: -1, nowMs: 0 });
  assert.equal(led.p, DP.show);
  const order = led.order;
  for (let step = 0; step < 4; step++) {
    led.ec = step * 1000 + 500;
    const want = [0, 0, 0, 0]; want[order[step]] = PLATE_LOOK.shown;
    assert.deepEqual(plateLooks(led, 4), want, `step ${step}`);
    assert.equal(shownPlate(led), order[step]);
  }
  led.ec = 4500;
  assert.deepEqual(plateLooks(led, 4), [0, 0, 0, 0], 'the held step: all dark');
  assert.equal(shownPlate(led), -1);
  led.p = DP.work; led.next = 2;
  const lit = [0, 0, 0, 0]; lit[order[0]] = PLATE_LOOK.lit; lit[order[1]] = PLATE_LOOK.lit;
  assert.deepEqual(plateLooks(led, 4), lit);
  const wrong = { j: order[3], at: led.ec };
  const red = [...lit]; red[order[3]] = PLATE_LOOK.wrong;
  assert.deepEqual(plateLooks(led, 4, wrong), red);
  assert.equal(PLATE_WRONG_MS, 700);
  led.ec += 699;
  assert.deepEqual(plateLooks(led, 4, wrong), red, 'still red at 699 ms');
  led.ec += 1;
  assert.deepEqual(plateLooks(led, 4, wrong), lit, 'the red gone at 0.7 s');
  led.p = DP.won;
  assert.deepEqual(plateLooks(led, 4), [2, 2, 2, 2]);
  const kept = [9, 9, 9, 9, 9, 9];
  assert.equal(plateLooks(null, 4, null, kept), kept, 'filled in place');
  assert.deepEqual(kept, [0, 0, 0, 0], 'to its count');
  assert.deepEqual([1, 2, 4].map((n) => DELVE_SOUNDS.chime(n).pitch.toFixed(2)), ['0.90', '1.02', '1.26'], 'the chime rises with the numeral');
});

test('DLV2 THE MARKS: a Hold\'s ward ring and four gates (filled as a wave comes), a Litany\'s ring and its plates by their looks (a dark plate a line alone, the rest filled), the vault\'s seal while sealed; a won site green with no gates and no seal; the telegraph\'s lit grammar, never burning ground\'s; every mark kept and filled in place; the floor its ward\'s circle (mutants: a gate missing; the seal kept open; the plate\'s look ignored; burning ground\'s pool; a mark made anew)', () => {
  const h = site();
  const idle = siteShapes(h, null, []);
  assert.equal(idle.length, 6, 'ring, four gates, seal');
  assert.equal(idle[0].kind, TELEGRAPH_KIND.ring); assert.equal(idle[0].r1, 4); assert.equal(idle[0].r0, 4 - 0.14); assert.deepEqual(idle[0].color, DELVE_COLORS.ward);
  assert.deepEqual(idle.slice(1, 5).map((g) => [g.kind, Math.round(Math.hypot(...g.origin) * 10) / 10]), Array(4).fill([TELEGRAPH_KIND.disc, 3.5]), 'the gates, half a metre in');
  assert.deepEqual(idle.slice(1, 5).map((g) => g.t), [0, 0, 0, 0], 'a line alone at rest');
  assert.deepEqual(idle[5].origin.map((x) => Math.round(x * 100) / 100), [3.4, 0]); assert.deepEqual(idle[5].color, DELVE_COLORS.seal);
  for (const m of idle) {
    assert.equal(m.pool, TELEGRAPH_POOL.blow, 'the lit grammar (burning ground darkens the floor)');
    assert.deepEqual(m.edge, m.color, 'its line its own colour');
    assert.ok(m.since >= 1 && m.since < m.span - 1, 'never at a wind-up\'s end');
  }
  const kept = [];
  const run = siteShapes(h, { p: DP.wave }, [], {}, kept);
  assert.equal(run, kept, 'filled into the caller\'s');
  assert.deepEqual(run[0].color, DELVE_COLORS.wake); assert.equal(run[1].alpha, 0.9); assert.equal(run[1].t, 1, 'a wave\'s gates filled');
  const firstRing = kept[0];
  const won = siteShapes(h, { p: DP.won }, [], { won: true, sealed: false }, kept);
  assert.equal(won.length, 1); assert.deepEqual(won[0].color, DELVE_COLORS.won);
  assert.equal(won[0], firstRing, 'the same mark, filled again');
  const l = site({ kind: 'litany', vault: [10, 0, 20] });
  const ls = siteShapes(l, null, [PLATE_LOOK.dark, PLATE_LOOK.shown, PLATE_LOOK.lit, PLATE_LOOK.wrong]);
  assert.equal(ls.length, 6, 'ring, four plates, seal');
  assert.deepEqual(ls.slice(1, 5).map((x) => x.color), [DELVE_COLORS.stone, DELVE_COLORS.shown, DELVE_COLORS.lit, DELVE_COLORS.wrong]);
  assert.deepEqual(ls.slice(1, 5).map((x) => x.t), [0, 1, 1, 1]);
  assert.deepEqual(ls.slice(1, 5).map((x) => x.origin), litanyPlates(l).map((p) => [p[0] - 10, p[2] - 20]));
  assert.deepEqual(ls[5].origin, [0, 0], 'the seal at the heart');
  assert.deepEqual(siteFloor(h), { r: 6, courts: [[0, 0]], ks: null });
  assert.equal(DELVE_CHEST_MODEL, 41811); assert.equal(DELVE_DRAW_M, 48);
});

test('DLV2 THE CHEST: Daggerfall\'s own, its lowest point on the floor, facing the heart (mutants: the foot off the floor; the yaw away)', () => {
  const m = chestMatrix([5, 2, 7], 0, [0, -0.4, 0, 1, 0.3, 1]);
  assert.deepEqual([m[12], m[13], m[14]].map((x) => Math.round(x * 1000) / 1000), [5, 2.4, 7]);
  assert.deepEqual([...chestMatrix([5, 2, 7], 0)].slice(12, 15), [5, 2, 7]);
  assert.equal(Math.round(chestYaw(site())), -90, 'the vault on +x faces -x');
  assert.equal(Math.round(chestYaw(site({ vault: [10, 0, 17] }))), 0);
  assert.equal(chestYaw(site({ vault: null })), 0);
});

test('DLV2 THE PIECES: the chest stands once, in the mesh list and the collider (solid, as a block\'s chest is), and both go at the teardown; a teardown builds no pass the dungeon never drew; the marks drawn under the frame\'s fog (mutants: the chest walked through; its bucket left; the teardown building the pass; the fog unread)', async () => {
  const draws = [], buckets = new Map();
  const collider = { addMesh: (k, pos, idx, m) => buckets.set(k, { pos, idx, m }), removeBucket: (k) => buckets.delete(k) };
  const cpu = { positions: [0, -0.4, 0, 1, 0.3, 1, 0, 0.3, 1], indices: [0, 1, 2] };
  const meshes = { getGpuMesh: async () => ({ gpu: 1 }), cpuModels: new Map([[DELVE_CHEST_MODEL, cpu]]) };
  let glCalls = 0;   // a GL that counts what is asked of it
  const gl = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : () => { glCalls++; return {}; }) });
  const P = createDelvePieces({ renderer: { gl, markForeignPass: () => {} }, meshes, draws, collider });
  P.standChest(0, [5, 2, 7], 90); P.standChest(0, [5, 2, 7], 90);
  await flush();
  assert.equal(draws.length, 1, 'once');
  assert.ok(buckets.has(delveChestBucket(0)), 'solid'); assert.equal(delveChestBucket(3), 'delve:chest:3');
  assert.deepEqual(buckets.get('delve:chest:0').m, chestMatrix([5, 2, 7], 90, cpu.positions));
  assert.deepEqual(buckets.get('delve:chest:0').idx, cpu.indices);
  assert.ok(P.chest(0)); assert.equal(P.chest(1), null);
  P.destroy();
  assert.equal(draws.length, 0); assert.equal(buckets.size, 0, 'its bucket gone with it');
  assert.equal(glCalls, 0, 'nothing compiled or built at the teardown');
  P.standChest(1, [0, 0, 0], 0); await flush();
  assert.equal(draws.length, 0, 'nothing stands after it');
  assert.match(rd('src/scenes/delve/delvePieces.js'), /fog\.mode = renderer\._fogMode; fog\.density = renderer\._fogDensity; fog\.range = renderer\._fogRange;[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n {8}for \(const sh of shapes\) \{ pass\.draw\(sh, proj, view, eye, s, fog, centre, null, floor\);/, 'the frame\'s fog, as nodeGlow.js passes it');
});

test('DLV2 THE KEY AND THE NONE: a vault\'s key its site; no site in a dungeon the row turns off, a made level, an arena\'s sand, an Abyss Hollow or Privateer\'s Hold (mutants: the row unread; the Hollow stood; the Hold stood)', () => {
  assert.deepEqual(['delve:vault:3', 'delve:vault:', 'delve:vault:x', 'loot:3', null].map(delveKeySite), [3, -1, -1, -1, -1]);
  assert.equal(DELVE_KEY, 'delve:');
  const loc = { hasDungeon: true, mapTableData: { mapId: 12345 } };
  _resetForTests();
  assert.equal(delveStandsNone(loc), false, 'a plain dungeon stands its sites');
  setPref(DELVE_PREF, false);
  assert.equal(delveStandsNone(loc), true, 'the row off');
  _resetForTests();
  assert.equal(delveStandsNone({ ...loc, superTier: true }), true, 'an Abyss Hollow');
  assert.equal(delveStandsNone({ ...loc, mapTableData: { mapId: PRIVATEERS_HOLD_MAP_ID } }), true, 'Privateer\'s Hold');
  assert.equal(delveStandsNone({ ...loc, ketch: { key: 'k' }, dungeon: { recordElement: { header: { locationId: KT_SHIP_LOCATION_ID } } } }), true, 'a made level (the Ketch)');
  assert.equal(delveStandsNone({ ...loc, arenaFloor: 'sand', dungeon: { recordElement: { header: { locationId: ARENA_FLOOR_LOCATION_ID } } } }), true, 'an arena\'s sand');
  assert.equal(delveStandsNone({ hasDungeon: false }), true);
  assert.equal(delveStandsNone(null), true);
  assert.deepEqual(delveKindsFor(loc), ['litany', 'brazier', 'weighing', 'seals'], 'no table to stand foes from: no kind fought in waves (DLV4: nor the Wellsprings or the Vigil)');
  assert.deepEqual(delveKindsFor({ ...loc, mapTableData: { dungeonType: 4 } }), DELVE_KIND_NAMES);
});

/** One block, a 40 m room in it - the start in a corner - and the context's doors as fakes. */
function dungeonOf(seed, opts = {}, header = {}) {
  const c = new Collider(() => -Infinity);
  const v = [], idx = [], H = 20, cx = RDB_SIDE / 2, T = 4;
  const quad = (a, b, cc, d) => { const n = v.length / 3; v.push(...a, ...b, ...cc, ...d); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const at = (x, y, z) => [cx + x, y, cx + z];
  quad(at(-H, 0, -H), at(-H, 0, H), at(H, 0, H), at(H, 0, -H));
  quad(at(-H, T, -H), at(H, T, -H), at(H, T, H), at(-H, T, H));
  quad(at(-H, 0, -H), at(H, 0, -H), at(H, T, -H), at(-H, T, -H)); quad(at(-H, 0, H), at(H, 0, H), at(H, T, H), at(-H, T, H));
  quad(at(-H, 0, -H), at(-H, 0, H), at(-H, T, H), at(-H, T, -H)); quad(at(H, 0, -H), at(H, 0, H), at(H, T, H), at(H, T, -H));
  c.addMesh('dungeon', v, idx, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const start = { record: 10, x: cx - 17, y: 0.5, z: cx - 17 };
  const blocks = [{ name: 'N0000001.RDB', originX: 0, originZ: 0, isStartingBlock: true, layout: { waterLevel: 10000, markers: [start], startMarkers: [start] } }];
  const said = [], opened = [], stood = [], removed = [], pool = [];
  let targets = null, namer = null;
  const api = {
    collider: c, dynamicDraws: [], foes: pool,
    spawnLooseFoe: async (type, p, opts) => { const f = { type, at: p, opts, dead: false, ai: {}, entity: { maxHealth: 50, health: 50 } }; stood.push(f); pool.push(f); return f; },
    removeLooseFoe: (f) => { removed.push(f); f.dead = true; f._gone = true; const k = pool.indexOf(f); if (k >= 0) pool.splice(k, 1); return true; },
    hudSay: (t) => said.push(t), openLootList: (items) => { opened.push(items); return true; },
    addActivationTargets: (fn) => { targets = fn; return () => { targets = null; }; },
    addActivationNamer: (fn) => { namer = fn; return () => { namer = null; }; },
  };
  const location = { hasDungeon: true, mapTableData: { dungeonType: 0, mapId: 7 }, dungeon: { recordElement: { header: { locationId: seed, ...header } } } };
  const me = { level: 6, items: [], goldPieces: 0, stats: { strength: 50 } };
  const deps = { getGpuMesh: async () => ({ gpu: 1 }), cpuModels: new Map([[DELVE_CHEST_MODEL, { positions: [-0.5, 0, -0.4, 0.5, 0.8, 0.4], indices: [0, 1, 0] }]]) };
  const host = createDelveHost({ api, deps, location, blocks, player: () => me, rollPile: () => [{ name: 'Silver Mace', group: 'Weapons', templateIndex: 121 }], ...opts });
  return { host, api, me, said, opened, stood, removed, pool, location, blocks, deps, get targets() { return targets; }, get namer() { return namer; } };
}
const seedFor = (kind) => { for (let s = 1; s < 500; s++) if (siteKinds(1, s)[0] === kind) return s; return -1; };

test('DLV2 THE HOLD, WON IN A ROOM: the plan on the collider, the near line, the ward woken by a step in, three waves and the captain stood and killed, the vault sealed then opened, a save\'s word kept and laid back (mutants: the near line\'s reach; the clock run under a window; the vault opened sealed; the save under another plan)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('hold')), { host } = D;
  assert.equal(host.sites.length, 1);
  const s = host.sites[0];
  assert.equal(s.kind, 'hold');
  const feet = [s.x, s.y, s.z];
  // the near line, once, from the ward's edge and 6 m
  assert.deepEqual([DELVE_NEAR_M, DELVE_AWAY_SAY_MS], [6, 2_000]);
  const near = s.r + 2 + DELVE_NEAR_M;
  host.frame(0.1, [s.x + near + 0.5, s.y, s.z]);
  assert.notEqual(midScreenText.text, 'An old ward is cut into this floor. Step inside it to wake it.');
  host.frame(0.1, [s.x + near - 0.5, s.y, s.z]);
  assert.equal(midScreenText.text, 'An old ward is cut into this floor. Step inside it to wake it.');
  assert.equal(host.state()[0].p, DP.idle, 'near is not in');
  await flush();
  assert.equal(D.api.dynamicDraws.length, 1, 'the chest stood on the first frame');
  assert.ok(D.targets().length === 1 && D.targets()[0].key === 'delve:vault:0');
  assert.deepEqual(D.namer('delve:vault:0'), { title: 'Sealed Vault', subs: ['Hold the ward to open it'], unlisted: true }, 'a name, never a list');
  assert.equal(host.contents('delve:vault:0'), null);
  assert.equal(host.press('delve:vault:0'), 1);
  assert.deepEqual(D.said, ['The vault is sealed.']);
  assert.deepEqual(D.opened, []);
  host.frame(0.1, feet);
  assert.equal(host.state()[0].p, DP.gather);
  assert.equal(midScreenText.text, 'The ward wakes. Hold the circle.');
  let t = 0;
  const run = async (ms, at = feet) => { for (let k = 0; k < ms; k += 100) { host.frame(0.1, at); t += 100; } await flush(); };
  await run(HOLD_GATHER_MS);
  assert.equal(host.state()[0].w, 1);
  assert.equal(D.stood.length, 3, 'one member: three foes');
  host.frame(0, null);
  for (let w = 1; w <= 3; w++) {
    const wave = D.stood.slice(-(2 + w));
    for (const f of wave) kill(f);
    await run(starClearFloorMs(2 + w, 1) + 200);
    assert.equal(host.state()[0].p, DP.breath, `wave ${w} cleared`);
    await run(HOLD_BREATH_MS);
    if (w < 3) assert.equal(D.stood.length, [3, 7, 12][w], `wave ${w + 1} stood`);
  }
  assert.equal(host.state()[0].p, DP.captain);
  const cap = D.stood.at(-1);
  assert.equal(cap.entity.bossTraits.length, 1, 'one trait in a regular dungeon');
  kill(cap);
  await run(HOLD_CAPTAIN_MIN_MS + 200);
  assert.equal(host.state()[0].won, true);
  assert.equal(midScreenText.text, 'The ward holds. The vault is open.');
  assert.equal(D.namer('delve:vault:0').title, 'Vault');
  const mace = { name: 'Silver Mace', group: 'Weapons', templateIndex: 121 };
  const vault = host.contents('delve:vault:0');
  assert.deepEqual([vault.length, vault[1], vault[0].isIdentified, vault[2].group], [3, mace, true, 'Currency'], 'DELVE-VAULT: a known piece, the pile\'s own roll, then gold');
  assert.equal(host.press('delve:vault:0'), 1);
  assert.deepEqual(D.opened, [vault]);
  assert.equal(host.press('delve:vault:0', 'info'), 1);
  assert.equal(D.said.at(-1), 'Vault', 'Info mode names it');
  assert.deepEqual(host.contents('delve:vault:0'), vault, 'the plaque lists a won vault');
  assert.equal(host.contents('delve:vault:9'), null);
  // the save: the won site and its vault, under this plan alone
  const snap = host.snapshot();
  assert.deepEqual(snap.won, [{ i: 0, items: vault }]);
  // through the save's own envelope (systems/save/save.js - it keeps only the options it names): inside the world record
  const env = JSON.parse(JSON.stringify(snapshotPlayer({ items: [], stats: {} }, { world: { foes: [], delve: snap } })));
  assert.deepEqual(restorePlayer({ items: [], stats: {} }, env).world.delve, snap, 'the vaults come back from a real save');
  host.restore(null);
  assert.equal(host.state()[0].won, false, 'a save with no word: nothing won');
  host.restore({ ...snap, h: snap.h + 1 });
  assert.equal(host.state()[0].won, false, 'another plan\'s word: refused');
  // a load: the world record's restore stands a foe the save held alive up again - the host's restore takes it
  const revived = D.stood[0];
  revived.dead = false; revived.entity.health = 50;
  const n0 = D.removed.length;
  host.restore(snap);
  assert.equal(host.state()[0].won, true);
  assert.deepEqual(D.removed.slice(n0), [revived], 'no foe of a running attempt outlives a load');
  assert.equal(host.press('delve:vault:0'), 1);
  assert.equal(D.opened.length, 2);
  // the plaque lists it as a pile (systems/worldHover.js), and quick loot's P takes the lot through it - no window
  setUiPref('quickLoot', true);
  try {
    const frame = resolveHover({ key: 'delve:vault:0', distance: 1, reach: 2 }, { name: (k) => D.namer(k), contents: (k) => host.contents(k) });
    assert.equal(frame.kind, 'items'); assert.equal(frame.title, 'Vault'); assert.deepEqual(frame.rows.map((r) => r.name), [vault[0].name, 'Silver Mace', 'Gold Pieces']);
    foldQuickLoot(frame);
    assert.equal(quickLootArm('QuickLootAll'), true);
    assert.equal(host.press('delve:vault:0'), 1);
  } finally { resetQuickLoot(); _resetForTests(); }
  assert.deepEqual(D.me.items.map((i) => i.name), [vault[0].name, 'Silver Mace']);
  assert.equal(D.me.goldPieces, vault[2].stackCount, 'the gold to the purse');
  assert.deepEqual(host.contents('delve:vault:0'), [], 'taken out of the vault');
  assert.equal(D.opened.length, 2, 'no window opened');
  host.destroy();
  assert.equal(D.api.dynamicDraws.length, 0, 'the chest gone with it');
  assert.equal(D.targets, null, 'its doors closed');
  assert.equal(host.press('delve:vault:0'), 0);
});

test('DLV2 THE TABLE: the Hold\'s foes off the dungeon\'s own table, as its layout\'s were rolled - a mod\'s pick for this dungeon (DEX3, dungeonPlace), never whatever table was written last (mutants: the table read without the place)', async () => {
  _resetForTests();
  registerEncounterTableSelector({ table: (index, place) => (place?.dungeon?.unknown2 === 777 ? Array(20).fill(42) : null), choices: () => null });
  const D = dungeonOf(seedFor('hold'), {}, { unknown2: 777 }), { host } = D, s = host.sites[0];
  for (let k = 0; k <= HOLD_GATHER_MS / 100; k++) host.frame(0.1, [s.x, s.y, s.z]);
  await flush();
  assert.equal(D.stood.length, 3);
  assert.deepEqual(D.stood.map((f) => f.type), [42, 42, 42], 'the mod\'s table for this dungeon');
});

test('DLV2 THE HOLD LEFT: out of the ward 2 s, told to go back once; 30 s, the attempt fails, its foes crumble, and a step back in wakes it again (mutants: the away line\'s wait; the away line every frame)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('hold')), { host } = D, s = host.sites[0];
  const feet = [s.x, s.y, s.z], out = [s.x + 9, s.y, s.z];
  host.frame(0.1, feet);
  for (let k = 0; k < 50; k++) host.frame(0.1, feet);
  await flush();
  assert.equal(D.stood.length, 3);
  host.frame(0.1, out);
  for (let k = 0; k < (DELVE_AWAY_SAY_MS / 100) - 2; k++) host.frame(0.1, out);
  assert.notEqual(midScreenText.text, 'Go back into the circle. The ward fails when nobody holds it.');
  host.frame(0.1, out); host.frame(0.1, out);
  assert.equal(midScreenText.text, 'Go back into the circle. The ward fails when nobody holds it.');
  midScreenText._reset();
  host.frame(0.1, out);
  assert.equal(midScreenText.text, '', 'said once');
  for (let k = 0; k < 300; k++) host.frame(0.1, out);
  assert.equal(host.state()[0].p, DP.idle);
  assert.equal(D.removed.length, 3, 'the living crumble');
  assert.equal(midScreenText.text, 'Nobody held the ward. It goes dark and its foes crumble.');
  host.frame(0.1, feet);
  assert.equal(host.state()[0].p, DP.gather, 'back in: woken again');
});

test('DLV2 THE CAPTAIN OUTLASTS THE WARD: alive 5 min after it stands, the attempt ends with its own line and its foes crumble, and the ward stays dark until a step back in; a frame of no number moves no clock (mutants: the outlasted said as the left; woken again at once; a NaN clock)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('hold')), { host } = D, s = host.sites[0];
  const feet = [s.x, s.y, s.z];
  host.frame(NaN, feet);
  assert.equal(host.state()[0].p, DP.gather);
  const run = async (ms) => { for (let k = 0; k < ms; k += 100) host.frame(0.1, feet); await flush(); };
  await run(HOLD_GATHER_MS);
  host.frame(NaN, feet); host.frame(Infinity, feet);
  for (let w = 1; w <= 3; w++) {
    for (const f of D.stood.slice(-(2 + w))) kill(f);
    await run(starClearFloorMs(2 + w, 1) + 200);
    await run(HOLD_BREATH_MS);
  }
  assert.equal(host.state()[0].p, DP.captain, 'the clock ran on after the frames of no number');
  const cap = D.stood.at(-1);
  await run(HOLD_CAPTAIN_MAX_MS - 1_000);
  assert.equal(host.state()[0].p, DP.captain);
  await run(1_100);
  assert.equal(host.state()[0].p, DP.idle);
  assert.equal(midScreenText.text, 'The captain outlasted the ward. It goes dark and its foes crumble.');
  assert.ok(D.removed.includes(cap), 'the captain crumbles');
  await run(2_000);
  assert.equal(host.state()[0].p, DP.idle, 'still standing in it: dark until a step back in');
  host.frame(0.1, [s.x + 20, s.y, s.z]);
  host.frame(0.1, feet);
  assert.equal(host.state()[0].p, DP.gather, 'out and in again: woken');
});

test('DLV2 IN THE WARD IS IN ITS ROOM: past the disc, a wall between the player and the heart keeps the ward asleep - a corridor behind it is no part of it (mutants: presence through the wall)', () => {
  _resetForTests();
  const D = dungeonOf(seedFor('hold')), { host } = D, s = host.sites[0];
  // a wall of the dungeon's own across the ward's +x pad, 5 m from the heart (the plan already made)
  const x = s.x + 5, v = [x, s.y, s.z - 3, x, s.y, s.z + 3, x, s.y + 3, s.z + 3, x, s.y + 3, s.z - 3];
  D.api.collider.addMesh('dungeon', v, [0, 1, 2, 0, 2, 3], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  host.frame(0.1, [s.x + 5.5, s.y, s.z]);
  assert.equal(host.state()[0].p, DP.idle, 'behind the wall, 5.5 m off: asleep');
  host.frame(0.1, [s.x - 5.5, s.y, s.z]);
  assert.equal(host.state()[0].p, DP.gather, 'the open side, 5.5 m off: woken');
});

test('DLV2 THE LITANY, WON IN A ROOM: the order shown, a wrong plate shown again, every plate stepped in order - the vault opens (mutants: a plate said every frame; the show cut short; the vault never rolled)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('litany')), { host } = D, s = host.sites[0];
  assert.equal(s.kind, 'litany');
  assert.deepEqual(s.vault, [s.x, s.y, s.z], 'its vault at its heart');
  const plates = litanyPlates(s), heart = [s.x, s.y, s.z];
  host.frame(0.1, heart);
  assert.equal(host.state()[0].p, DP.show);
  assert.equal(midScreenText.text, 'Watch the plates.');
  const order = newDelveLedger(s, 'me', seedFor('litany'), 0).order;
  for (let k = 0; k < litanyShowMs(4) / 100; k++) host.frame(0.1, heart);
  assert.equal(host.state()[0].p, DP.work);
  assert.equal(midScreenText.text, 'Step on the plates in the same order.');
  host.frame(0.1, plates[order[0]]);
  assert.equal(host.state()[0].next, 1);
  for (let k = 0; k < 10; k++) host.frame(0.1, plates[order[0]]);
  assert.equal(host.state()[0].next, 1, 'standing on it says it once');
  host.frame(0.1, plates[order[2]]);
  assert.equal(host.state()[0].p, DP.show, 'out of turn: the order again');
  assert.equal(midScreenText.text, 'Wrong plate. Watch again.');
  for (let k = 0; k < litanyShowMs(4) / 100 + 1; k++) host.frame(0.1, heart);
  for (const j of order) { host.frame(0.1, heart); host.frame(0.1, plates[j]); }
  assert.equal(host.state()[0].won, true);
  assert.equal(midScreenText.text, 'All the plates are lit. The vault is open.');
  assert.equal(D.stood.length, 0, 'a regular Litany wakes no foe');
  assert.equal(host.state()[0].vault, 3, 'the piece, the pile and the gold');
});

test('LITANY-STAND OFFLINE: a player who walks onto the first plate while the order shows has it lit as the work begins; one who stays on a wrong plate hears it once, not again after the order is shown again (mutants: no plate said; judged every word)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('litany')), { host } = D, s = host.sites[0];
  const plates = litanyPlates(s), order = newDelveLedger(s, 'me', seedFor('litany'), 0).order;
  host.frame(0.1, [s.x, s.y, s.z]);
  for (let k = 0; k < litanyShowMs(4) / 100; k++) host.frame(0.1, plates[order[0]]);
  assert.deepEqual([host.state()[0].p, host.state()[0].next], [DP.work, 1], 'lit as the work begins');
  host.frame(0.1, plates[order[2]]);
  assert.equal(midScreenText.text, 'Wrong plate. Watch again.');
  let wrongs = 0;
  setMidScreenText('');
  for (let k = 0; k < litanyShowMs(4) / 100 + 20; k++) { host.frame(0.1, plates[order[2]]); if (midScreenText.text === 'Wrong plate. Watch again.') { wrongs++; setMidScreenText(''); } }
  assert.deepEqual([wrongs, host.state()[0].p], [0, DP.work], 'stood on through the order shown again: no second wrong');
  host.destroy();
});

test('DLV2 NONE STOOD: online (until DLV3), the row off, or a dungeon of none - no plan, no frame, no chest, no mark, no press, no list (mutants: online stood; a chest stood online)', async () => {
  _resetForTests();
  const D = dungeonOf(seedFor('hold'));
  const host2 = createDelveHost({ api: D.api, location: { hasDungeon: true, superTier: true, dungeon: { recordElement: { header: { locationId: 1 } } } }, blocks: [] });
  assert.deepEqual(host2.sites, []);
  const s = D.host.sites[0];
  const O = dungeonOf(seedFor('hold'), { online: () => true });
  O.host.frame(0.1, [s.x, s.y, s.z]);
  await flush();
  assert.equal(O.host.state()[0].p, DP.idle, 'online: nothing woken');
  assert.equal(O.api.dynamicDraws.length, 0, 'online: no chest');
  assert.equal(O.host.press('delve:vault:0'), 0);
  assert.equal(O.host.contents('delve:vault:0'), null);
  assert.equal(O.host.drawPass(new Float32Array(16), new Float32Array(16), [s.x, 1, s.z]), false);
});

test('DLV2 THE WIRING (HOST-SPLIT): the context builds it after its api and before the Rift\'s stand, ticks it and draws it in drawFoes, presses its vault through takeLoot and lists it through lootContents, keeps its word in the save\'s world record (the envelope keeps what it names) and lays it back at the load, carries a replaced body\'s place, and destroys it; both dungeon hosts send `delve:` to takeLoot; the plaque lists a vault and the look round calls it a find; the row on the Dungeons tab (mutants: a press arm missing; the save unkept; the carry dropped)', () => {
  const ctx = rd('src/scenes/dungeonContext.js');
  assert.match(ctx, /const delve = createDelveHost\(\{ api, deps, location: dfLocation, blocks: dungeon\.blocks, hearths: dungeonHearths, fires: dungeonFires, player: \(\) => playerEntity, rollPile: rollPileItems, online: onlineRoom \}\);\n {2}if \(sdEnd && !_sdEndAsked\)[^\n]*\n {2}return api;/);
  assert.match(ctx, /sweepColdPeers\(dt\);[^\n]*\n {4}delve\.frame\(dt, playerFeet, _fpYaw, playerWeapon\);/);   // DLV4: the facing a carried piece is held to, the weapon a carry puts up
  assert.match(ctx, /opts\.lateWorldDraw\?\.\(\);\n {4}senseFrame\(eye\);[^\n]*\n {4}delve\.drawPass\(proj, view, eye\);/);
  assert.match(ctx, /if \(kind === 'delve'\) return delve\.press\(key, mode\);/);
  assert.match(ctx, /if \(kind === 'delve'\) return delve\.contents\(key\);/);
  assert.match(ctx, /world: \{ \.\.\.collectWorld\(\), outerCamps: opts\.outerCampsSave\?\.\(\) \?\? null, delve: delve\.snapshot\(\) \},/);
  assert.doesNotMatch(ctx, /^\s+delve: delve\.snapshot\(\),/m, 'never beside the world record: snapshotPlayer drops a name it does not know');
  assert.match(ctx, /if \(extras\.locationKey === _locationKey && !otherLayout\) delve\.restore\(extras\.world\?\.delve\);/);
  assert.match(ctx, /function takeRoomPlace\(old, rec\) \{\n(?: {4}[^\n]*\n){3} {4}rec\._delve = old\._delve;/);
  assert.match(ctx, /renownFoeCarry\(f, nf\);[^\n]*\n {6}nf\._delve = f\._delve;/);
  assert.doesNotMatch(ctx.slice(ctx.indexOf('function collectWorld()'), ctx.indexOf('function applyWorld(')), /delve/, 'the world record and its apply hold none of it (the room\'s memory is DLV3\'s)');
  assert.match(ctx, /delve\.destroy\(\);/);
  for (const h of ['src/scenes/worldModes.js', 'src/scenes/dungeon.js']) assert.match(rd(h), /key\.startsWith\('search:'\) \|\| key\.startsWith\('delve:'\)/, `${h}'s press arm`);
  assert.match(rd('src/systems/worldHover.js'), /'spoil:', 'delve:'\]\);/);
  assert.match(rd('src/systems/dungeon/dungeonSense.js'), /'srch:', 'delve:'\]\);/);
  assert.match(rd('src/ui/settings/settingsMap.js'), /"feat:world-dungeon-sizes", "feat:dungeon-encounters"/);
});
