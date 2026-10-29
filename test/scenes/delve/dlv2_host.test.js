// DLV2 (bible/03-World/Delve-II.md sections 3, 5 and 6): A DUNGEON'S ENCOUNTERS, STOOD - the Hold's foes at its gates and
// on its leash, the Litany's plates seen and stepped, the marks on the floor, the chest, and the host that runs each
// site's ledger on the player's own words: built on a real collider's room, a Hold and a Litany each won end to end, the
// vault sealed then opened, a save's word kept, and the dungeons that stand none. Pins held to fail under the mutations in
// tools/mutants/dlv2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDelveHost, delveStandsNone, delveKeySite, chestYaw, DELVE_PREF, DELVE_KEY, DELVE_NEAR_M, DELVE_AWAY_SAY_MS } from '../../../src/scenes/delve/delveHost.js';
import { createHoldFoes, holdStandPlaces, holdLeashM, HOLD_LEASH_PAD_M, HOLD_RANK_STEP_M } from '../../../src/scenes/delve/delveHold.js';
import { plateLooks, shownPlate, createPlateSteps, PLATE_LOOK, PLATE_WRONG_MS, DELVE_SOUNDS } from '../../../src/scenes/delve/delveLitany.js';
import { siteShapes, siteFloor, chestMatrix, DELVE_COLORS, DELVE_CHEST_MODEL, DELVE_DRAW_M } from '../../../src/scenes/delve/delvePieces.js';
import { DP, holdGates, litanyPlates, newDelveLedger, foldDelveWord, HOLD_GATHER_MS, HOLD_BREATH_MS, HOLD_CAPTAIN_MIN_MS, litanyShowMs } from '../../../src/net/delve/delveLaw.js';
import { siteKinds } from '../../../src/world/dungeon/delveSites.js';
import { starClearFloorMs } from '../../../src/net/starfall/starfallLaw.js';
import { TELEGRAPH_KIND } from '../../../src/render/gate/gateTelegraph.js';
import { Collider } from '../../../src/player/collider.js';
import { RDB_SIDE } from '../../../src/world/rdbLayout.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { midScreenText } from '../../../src/ui/midScreenText.js';
import { PRIVATEERS_HOLD_MAP_ID } from '../../../src/world/dungeon/dungeonTextures.js';
import { KT_SHIP_LOCATION_ID } from '../../../src/world/ketch/ketchShip.js';
import { ARENA_FLOOR_LOCATION_ID } from '../../../src/world/arena/arenaFloor.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setImmediate(r));
const site = (o = {}) => ({ i: 0, kind: 'hold', x: 10, y: 0, z: 20, r: 4, tier: 'regular', vault: [13.4, 0, 20], ...o });

test('DLV2 THE HOLD\'S PLACES: the four gates in turn, each next rank 0.9 m nearer the heart; the leash the ward and 2 m (mutants: the rank\'s step; one gate for all; the leash\'s pad)', () => {
  const s = site();
  const p = holdStandPlaces(s, 6);
  assert.deepEqual(p.slice(0, 4), holdGates(s));
  const d = (q) => Math.hypot(q[0] - s.x, q[2] - s.z);
  assert.ok(Math.abs(d(p[4]) - (d(p[0]) - 0.9)) < 1e-9, 'the second rank a step in');
  assert.ok(Math.abs(d(p[5]) - (d(p[1]) - 0.9)) < 1e-9);
  assert.equal(p[5][1], s.y);
  assert.equal(new Set(p.map((q) => q.join())).size, 6, 'no two on one spot');
  assert.deepEqual([HOLD_LEASH_PAD_M, HOLD_RANK_STEP_M, holdLeashM(s), holdLeashM(site({ r: 3 }))], [2, 0.9, 8, 7]);
});

/** A fake dungeon: foes that stand where asked, die when told, and leave when removed. */
function fakeFoes() {
  const stood = [], removed = [];
  const host = {
    spawn: async (type, at, opts) => { const f = { type, at, opts, dead: false, ai: {}, entity: { maxHealth: 50, health: 50 } }; stood.push(f); return f; },
    remove: (f) => { removed.push(f); f.gone = true; },
    pick: () => 7, elites: () => true, alive: () => true, rolls: () => 0.3,
  };
  return { host, stood, removed };
}

test('DLV2 THE HOLD\'S FOES: a wave stands its size at the gates, a step off the floor, facing the heart and leashed to it; its deaths and its clear said in the word; the captain an elite with the ledger\'s traits; a failed attempt\'s living foes crumble, and one that stands late is taken back (mutants: the leash unset; the clear before the last stood; the captain\'s traits; the crumble keeping a foe; the late one kept)', async () => {
  const s = site(), { host, stood, removed } = fakeFoes();
  const H = createHoldFoes(s, host);
  assert.deepEqual(H.word(), { o: 1, kw: 0, kn: 0, wc: 0, cf: 0 });
  H.on({ k: 'wave', w: 1, wz: 5 });
  assert.equal(H.word().wc, 0, 'nothing has stood yet: no clear');
  await flush();
  assert.equal(stood.length, 5);
  const places = holdStandPlaces(s, 5);
  stood.forEach((f, j) => {
    assert.deepEqual(f.at, [places[j][0], places[j][1] + 1.25, places[j][2]], 'the placement\'s separation over the floor');
    assert.equal(f._delve, 0);
    assert.deepEqual(f.ai.follow.feet(), [s.x, s.y, s.z], 'leashed to the heart');
    assert.equal(f.ai.follow.leash, 8); assert.equal(f.ai.follow.stop, 2);
    assert.ok(Math.abs(f.opts.yawRad - Math.atan2(s.x - places[j][0], s.z - places[j][2])) < 1e-12, 'facing the heart');
  });
  stood[0].dead = true; stood[3].dead = true;
  assert.deepEqual(H.word(), { o: 1, kw: 1, kn: 2, wc: 0, cf: 0 });
  for (const f of stood) f.dead = true;
  assert.deepEqual(H.word(), { o: 1, kw: 1, kn: 5, wc: 1, cf: 0 }, 'every one down: cleared');
  H.on({ k: 'wave', w: 2, wz: 3 });
  assert.deepEqual(H.word(), { o: 1, kw: 2, kn: 0, wc: 0, cf: 0 }, 'a new wave counts its own');
  await flush();
  H.on({ k: 'captain', traits: 2 });
  await flush();
  const cap = stood.at(-1);
  assert.equal(cap.opts.eliteFoe, true);
  assert.equal(cap.entity.bossTraits.length, 2);
  assert.equal(H.word().cf, 0);
  cap.dead = true;
  assert.equal(H.word().cf, 1);
  stood[5].dead = true;
  H.on({ k: 'failed' });
  assert.deepEqual(removed, [stood[6], stood[7]], 'the living crumble; the dead keep their bodies');
  assert.deepEqual(H.word(), { o: 1, kw: 0, kn: 0, wc: 0, cf: 0 });
  // a wave called, then failed before it stood: what stands after is taken back
  H.on({ k: 'wave', w: 1, wz: 2 });
  H.on({ k: 'failed' });
  await flush();
  assert.equal(removed.length, 4, 'the two late ones taken back as they stood');
  assert.equal(H.state().all, 0);
  // an elite only where elites stand; no foe where the table has none
  const plain = fakeFoes(); plain.host.elites = () => false;
  const P = createHoldFoes(s, plain.host);
  P.on({ k: 'captain', traits: 1 });
  await flush();
  assert.equal(plain.stood[0].opts.eliteFoe, false);
  assert.equal(plain.stood[0].entity.bossTraits.length, 1);
  const empty = fakeFoes(); empty.host.pick = () => -1;
  const E = createHoldFoes(s, empty.host);
  E.on({ k: 'wave', w: 1, wz: 4 });
  await flush();
  assert.equal(empty.stood.length, 0);
  assert.equal(E.word().wc, 0, 'nothing stood: nothing cleared (the wave runs its 90 s)');
  // a wave half stood: its dead are not its clear while one is still coming
  const slow = fakeFoes(); let release = null;
  const spawn = slow.host.spawn;
  slow.host.spawn = (...a) => (slow.stood.length === 2 ? new Promise((r) => { release = () => r(spawn(...a)); }) : spawn(...a));
  const S2 = createHoldFoes(s, slow.host);
  S2.on({ k: 'wave', w: 1, wz: 3 });
  await flush();
  assert.equal(slow.stood.length, 2);
  for (const f of slow.stood) f.dead = true;
  assert.equal(S2.word().wc, 0, 'one still coming');
  release(); await flush(); await flush();
  assert.equal(slow.stood.length, 3);
  slow.stood[2].dead = true;
  assert.equal(S2.word().wc, 1);
  // a failed attempt takes a living captain too
  const cap2 = fakeFoes();
  const C2 = createHoldFoes(s, cap2.host);
  C2.on({ k: 'captain', traits: 1 });
  await flush();
  C2.on({ k: 'failed' });
  assert.deepEqual(cap2.removed, [cap2.stood[0]], 'the captain crumbles with the rest');
});

test('DLV2 THE LITANY SEEN: the order shown a plate a second, the lit lit as worked, all lit when won, a wrong plate red for 0.7 s; a step said once as a plate is stepped onto (mutants: the shown step; the lit count; the wrong\'s span; a step said every frame)', () => {
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
  const steps = createPlateSteps();
  assert.deepEqual([steps.at(-1), steps.at(2), steps.at(2), steps.at(2), steps.at(-1), steps.at(2), steps.at(3)], [-1, 2, -1, -1, -1, 2, 3]);
  steps.reset();
  assert.equal(steps.at(3), 3, 'reset: the plate stood on is said again');
  assert.deepEqual([1, 2, 4].map((n) => DELVE_SOUNDS.chime(n).pitch.toFixed(2)), ['0.90', '1.02', '1.26'], 'the chime rises with the numeral');
});

test('DLV2 THE MARKS: a Hold\'s ward ring and four gates (awake while it runs), a Litany\'s ring and its plates by their looks, the vault\'s seal while sealed; a won site green with no gates and no seal; the floor its ward\'s circle (mutants: a gate missing; the seal kept open; the plate\'s look ignored)', () => {
  const h = site();
  const idle = siteShapes(h, null, []);
  assert.equal(idle.length, 6, 'ring, four gates, seal');
  assert.equal(idle[0].kind, TELEGRAPH_KIND.ring); assert.equal(idle[0].r1, 4); assert.deepEqual(idle[0].color, DELVE_COLORS.ward);
  assert.deepEqual(idle.slice(1, 5).map((g) => [g.kind, Math.round(Math.hypot(...g.origin) * 10) / 10]), Array(4).fill([TELEGRAPH_KIND.disc, 3.5]), 'the gates, half a metre in');
  assert.deepEqual(idle[5].origin.map((x) => Math.round(x * 100) / 100), [3.4, 0]); assert.deepEqual(idle[5].color, DELVE_COLORS.seal);
  const run = siteShapes(h, { p: DP.wave }, []);
  assert.deepEqual(run[0].color, DELVE_COLORS.wake); assert.equal(run[1].alpha, 0.75);
  const won = siteShapes(h, { p: DP.won }, [], { won: true, sealed: false });
  assert.equal(won.length, 1); assert.deepEqual(won[0].color, DELVE_COLORS.won);
  const l = site({ kind: 'litany', vault: [10, 0, 20] });
  const ls = siteShapes(l, null, [PLATE_LOOK.dark, PLATE_LOOK.shown, PLATE_LOOK.lit, PLATE_LOOK.wrong]);
  assert.equal(ls.length, 6, 'ring, four plates, seal');
  assert.deepEqual(ls.slice(1, 5).map((s) => s.color), [DELVE_COLORS.stone, DELVE_COLORS.shown, DELVE_COLORS.lit, DELVE_COLORS.wrong]);
  assert.deepEqual(ls.slice(1, 5).map((s) => s.origin), litanyPlates(l).map((p) => [p[0] - 10, p[2] - 20]));
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
});

/** One block, a 40 m room in it - the start in a corner - and the context's doors as fakes. */
function dungeonOf(seed) {
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
  const said = [], opened = [], stood = [], removed = [];
  let targets = null, namer = null;
  const api = {
    collider: c, dynamicDraws: [],
    spawnLooseFoe: async (type, p, opts) => { const f = { type, at: p, opts, dead: false, ai: {}, entity: { maxHealth: 50, health: 50 } }; stood.push(f); return f; },
    removeLooseFoe: (f) => { removed.push(f); return true; },
    hudSay: (t) => said.push(t), openLootList: (items) => { opened.push(items); return true; },
    addActivationTargets: (fn) => { targets = fn; return () => { targets = null; }; },
    addActivationNamer: (fn) => { namer = fn; return () => { namer = null; }; },
  };
  const location = { hasDungeon: true, mapTableData: { dungeonType: 0, mapId: 7 }, dungeon: { recordElement: { header: { locationId: seed } } } };
  const host = createDelveHost({ api, location, blocks, player: () => ({ level: 6 }), rollPile: () => [{ name: 'Silver Mace' }] });
  return { host, api, said, opened, stood, removed, get targets() { return targets; }, get namer() { return namer; } };
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
  assert.equal(D.namer('delve:vault:0').title, 'Sealed Vault');
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
    for (const f of wave) f.dead = true;
    await run(starClearFloorMs(2 + w, 1) + 200);
    assert.equal(host.state()[0].p, DP.breath, `wave ${w} cleared`);
    await run(HOLD_BREATH_MS);
    if (w < 3) assert.equal(D.stood.length, [3, 7, 12][w], `wave ${w + 1} stood`);
  }
  assert.equal(host.state()[0].p, DP.captain);
  const cap = D.stood.at(-1);
  assert.equal(cap.entity.bossTraits.length, 1, 'one trait in a regular dungeon');
  cap.dead = true;
  await run(HOLD_CAPTAIN_MIN_MS + 200);
  assert.equal(host.state()[0].won, true);
  assert.equal(midScreenText.text, 'The ward holds. The vault is open.');
  assert.equal(D.namer('delve:vault:0').title, 'Vault');
  assert.equal(host.press('delve:vault:0'), 1);
  assert.deepEqual(D.opened, [[{ name: 'Silver Mace' }]]);
  assert.equal(host.press('delve:vault:0', 'info'), 1);
  assert.equal(D.said.at(-1), 'Vault', 'Info mode names it');
  // the save: the won site and its vault, under this plan alone
  const snap = host.snapshot();
  assert.deepEqual(snap.won, [{ i: 0, items: [{ name: 'Silver Mace' }] }]);
  host.restore(null);
  assert.equal(host.state()[0].won, false, 'a save with no word: nothing won');
  host.restore({ ...snap, h: snap.h + 1 });
  assert.equal(host.state()[0].won, false, 'another plan\'s word: refused');
  host.restore(snap);
  assert.equal(host.state()[0].won, true);
  assert.equal(host.press('delve:vault:0'), 1);
  assert.equal(D.opened.length, 2);
  host.destroy();
  assert.equal(D.targets, null, 'its doors closed');
  assert.equal(host.press('delve:vault:0'), 0);
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
  assert.equal(host.state()[0].vault, 1);
});

test('DLV2 NONE STOOD: online (until DLV3), the row off, or a dungeon of none - no plan, no frame, no mark, no press (mutants: online stood)', () => {
  _resetForTests();
  const D = dungeonOf(seedFor('hold'));
  const host2 = createDelveHost({ api: D.api, location: { hasDungeon: true, superTier: true, dungeon: { recordElement: { header: { locationId: 1 } } } }, blocks: [] });
  assert.deepEqual(host2.sites, []);
  const s = D.host.sites[0];
  const online = createDelveHost({ api: D.api, location: { hasDungeon: true, mapTableData: { dungeonType: 0, mapId: 7 }, dungeon: { recordElement: { header: { locationId: seedFor('hold') } } } }, blocks: [{ name: 'N0000001.RDB', originX: 0, originZ: 0, isStartingBlock: true, layout: { waterLevel: 10000, markers: [{ record: 10, x: RDB_SIDE / 2 - 17, y: 0.5, z: RDB_SIDE / 2 - 17 }], startMarkers: [{ record: 10, x: RDB_SIDE / 2 - 17, y: 0.5, z: RDB_SIDE / 2 - 17 }] } }], online: () => true });
  online.frame(0.1, [s.x, s.y, s.z]);
  assert.equal(online.state()[0].p, DP.idle, 'online: nothing woken');
  assert.equal(online.press('delve:vault:0'), 0);
  assert.equal(online.drawPass(new Float32Array(16), new Float32Array(16), [s.x, 1, s.z]), false);
});

test('DLV2 THE WIRING (HOST-SPLIT): the context builds it after its api and before the Rift\'s stand, ticks it and draws it in drawFoes, presses its vault through takeLoot, keeps its word in a save beside the world record and lays it back at the load, and destroys it; both dungeon hosts send `delve:` to takeLoot; the row on the Dungeons tab (mutants: a press arm missing; the save unkept)', () => {
  const ctx = rd('src/scenes/dungeonContext.js');
  assert.match(ctx, /const delve = createDelveHost\(\{ api, deps, location: dfLocation, blocks: dungeon\.blocks, hearths: dungeonHearths, fires: dungeonFires, player: \(\) => playerEntity, rollPile: rollPileItems, online: onlineRoom \}\);\n {2}if \(sdEnd && !_sdEndAsked\)[^\n]*\n {2}return api;/);
  assert.match(ctx, /sweepColdPeers\(dt\);[^\n]*\n {4}delve\.frame\(dt, playerFeet\);/);
  assert.match(ctx, /opts\.lateWorldDraw\?\.\(\);\n {4}senseFrame\(eye\);[^\n]*\n {4}delve\.drawPass\(proj, view, eye\);/);
  assert.match(ctx, /if \(kind === 'delve'\) return delve\.press\(key, mode\);/);
  assert.match(ctx, /world: \{ \.\.\.collectWorld\(\)[^\n]*\n {8}delve: delve\.snapshot\(\),/);
  assert.match(ctx, /if \(extras\.locationKey === _locationKey && !otherLayout\) delve\.restore\(extras\.delve\);/);
  assert.doesNotMatch(ctx.slice(ctx.indexOf('function collectWorld()'), ctx.indexOf('function applyWorld(')), /delve/, 'the world record and its apply hold none of it (the room\'s memory is DLV3\'s)');
  assert.match(ctx, /delve\.destroy\(\);/);
  for (const h of ['src/scenes/worldModes.js', 'src/scenes/dungeon.js']) assert.match(rd(h), /key\.startsWith\('search:'\) \|\| key\.startsWith\('delve:'\)/, `${h}'s press arm`);
  assert.match(rd('src/ui/settings/settingsMap.js'), /"feat:world-dungeon-sizes", "feat:dungeon-encounters"/);
});
