// RAID-PACKS, RAID-SCALE, RAID-STALL, RAID-REACH, RAID-BANNER (2026-10-31: "make sure my fixes for staff raid are carried
// over to town raid", "Address spawn in the wall of mobs by checking pathfinding", "Increase spawn rate for banner raid";
// bible/03-World/Raiding-Parties.md RAID-PACKS): a town raid stands its raiders the way a staff event stands its packs.
//
// Held here: a classic raid's packs about every player in the town in turn; its cap by the players there; a leader with
// no spot about one player going to the next; the standard's packs bigger and quicker, a stuck side of the square left
// for another; and a spot with no street to its player refused (the sites host on a grid of its own, and the wiring).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  raidFrame as frame, restoreRaidSaveData as restoreSaveData, raidState, setRaidingPartiesHost, _resetRaidingParties,
  MAX_RAID_ENEMIES, STAFF_PACK_LEADER_TRIES, STAFF_PACK_CAP_PER, STAFF_PACK_STEP_S, RAID_CLASSIC_PACK_MIN, RAID_CLASSIC_PACK_MAX,
} from '../../src/systems/raidingParties.js';
import { raidKindOf, RAID_BANNER_KILLS_X, raidKillsX, RAID_DEFEND_PACK_MIN, RAID_DEFEND_PACK_MAX, RAID_DEFEND_PACK_GAP_S, RAID_DEFEND_FROM_M } from '../../src/systems/raidKinds.js';
import { createRaidSites, streetCellAt, RAID_REACH_RING } from '../../src/scenes/raidSitesHost.js';
import { NAV_CELL } from '../../src/world/city/cityNavigation.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { _resetRenownKillsForTests } from '../../src/net/renownTracker.js';
import { _resetModSettings } from '../../src/systems/modSettings.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));
const DAY = 400;
const AT = (min) => DAY * MINUTES_PER_DAY + min;
const raidRec = (o = {}) => ({
  regionIndex: 3, locationIndex: 7, startDay: DAY, locationName: 'Gothway Garden', type: 2,
  startMinute: AT(600), endMinute: AT(720), killed: 0, attackAmount: 99, cleansed: false,
  announced: true, struck: false, px: 200, py: 100, ...o,
});
function raidOf(kind) {
  for (let m = 600; m < 700; m++) { const r = raidRec({ startMinute: AT(m) }); if (raidKindOf(r) === kind) return r; }
  throw new Error(`no ${kind} tuple`);
}
const SQUARE = [10, 0, 10];

/** A recording host: each raider with the place it was asked at (`o`). */
function rig({ sites = false, players = [] } = {}) {
  const at = { now: AT(610), roll: 0.5, refuse: () => false };
  const log = { raiders: [], bearers: [], asked: [] };
  let seq = 0;
  const foe = (mt, feet = [seq, 0, 0]) => ({ mobileType: mt, dead: false, corpse: false, entity: { health: 10, maxHealth: 10 }, uid: ++seq,
    ai: { feet: [...feet], target: null, makeEnemyHostileToAttacker: () => {} } });
  const h = {
    now: () => at.now, random: () => at.roll, wallNow: () => 1e5, selfId: () => 'mmm-0005',
    regionIndex: () => 3, regionName: (r) => `Region${r}`, townHere: () => ({ regionIndex: 3, locationIndex: 7 }), playerPixel: () => ({ x: 200, y: 100 }),
    peerFeetInTown: () => [['mmm-0005', [0, 0, 0], 1], ...players],
    standRaider: (mt, o) => { log.asked.push(o); if (at.refuse(o)) return Promise.resolve(null); const f = foe(mt); f.o = o; log.raiders.push(f); return Promise.resolve(f); },
    standDefender: () => Promise.resolve(null), defenderCount: () => 0, defendersAllowed: () => false,
    removeFoe: (f) => { f.dead = true; }, outOfSight: () => true, reputation: () => ({ player: {}, store: { dict: new Map() } }), say: () => {},
  };
  if (sites) h.sites = () => ({ square: () => SQUARE, way: () => null, standBearer: (post) => { const g = foe(146, post); g.raidBearer = true; log.bearers.push(g); return Promise.resolve(g); } });
  setRaidingPartiesHost(h);
  return { at, log, h };
}
async function run(secs, dt, until = () => false) { for (let t = 0; t < secs && !until(); t += dt) { frame(dt); await tick(); } }

beforeEach(() => {
  _resetRaidingParties();
  _resetRenownKillsForTests();
  _resetModSettings();
  setSharedClock(null);
});

test('RAID-PACKS: a classic raid stands its raiders in packs of 3-5, each pack about the next player in the town in turn - me and each peer - not one a few seconds about me (mutants: every pack about me; one raider a pack)', async () => {
  const far = [300, 0, 0], other = [-200, 0, 50];
  const { log } = rig({ players: [['aaa-0001', far, 1], ['zzz-0009', other, 1]] });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  await run(60, 0.05, () => log.raiders.length >= 18);
  const leaders = log.raiders.filter((f) => !f.o?.at);
  assert.ok(leaders.length >= 3 && leaders.length < log.raiders.length / 2, 'packs, each led');
  assert.ok(leaders.some((f) => f.o.near === null) && leaders.some((f) => f.o.near?.[0] === far[0]) && leaders.some((f) => f.o.near?.[0] === other[0]), 'every player had a pack');
  assert.ok(RAID_CLASSIC_PACK_MIN >= 3 && RAID_CLASSIC_PACK_MAX <= 5);
});

test('RAID-SCALE: a town raid\'s cap grows with its players - PACK-SCALE\'s, STAFF_PACK_CAP_PER more each (mutants: the mod\'s 25 however many play)', async () => {
  const { log } = rig({ players: [['aaa-0001', [40, 0, 0], 1], ['bbb-0002', [-40, 0, 0], 1]] });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  await run(200, 0.1, () => log.raiders.length >= MAX_RAID_ENEMIES + 2 * STAFF_PACK_CAP_PER);
  await run(20, 0.1);
  assert.equal(log.raiders.length, MAX_RAID_ENEMIES + 2 * STAFF_PACK_CAP_PER, 'three players: 35 standing, and no more');
});

test('RAID-STALL: a classic raid\'s leader with no spot about one player goes to the next after STAFF_PACK_LEADER_TRIES - the raid never stalls on one (mutants: tried about the stuck player for ever)', async () => {
  const stuck = [500, 0, 500];
  const { at, log } = rig({ players: [['aaa-0001', stuck, 1]] });
  at.refuse = (o) => !o?.at && o?.near?.[0] === stuck[0];
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  await run(200, 0.05, () => log.raiders.length >= MAX_RAID_ENEMIES);
  assert.equal(log.raiders.length, MAX_RAID_ENEMIES, 'the cap stood although one player has no spot about them');
  assert.ok(log.asked.filter((o) => !o?.at && o?.near?.[0] === stuck[0]).length >= STAFF_PACK_LEADER_TRIES, 'the stuck player was tried');
});

test('RAID-BANNER: the Siege of the Standard\'s packs are 3-5, 4 s apart (2-3 every 9 s before); a side of the square with no spot is left for another (mutants: the old pace; the stuck side tried for ever)', async () => {
  assert.deepEqual([RAID_DEFEND_PACK_MIN, RAID_DEFEND_PACK_MAX, RAID_DEFEND_PACK_GAP_S], [3, 5, 4]);
  const { at, log, h } = rig({ sites: true });
  let seed = 7;
  h.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // the bearings vary, as the game's roll
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('defend')] });
  await run(2, 0.05, () => log.bearers.length > 0);
  assert.equal(log.bearers.length, 1, 'the bearer first');
  await run(30, 0.05, () => log.raiders.length >= 12);
  assert.ok(log.raiders.length >= 12, `twelve in under half a minute (${log.raiders.length})`);
  // a side with no spot: every leader about one bearing refused - the next comes from another
  const t0 = log.raiders.length;
  let first = null;
  at.refuse = (o) => { if (o?.at) return false; first ??= o?.near?.join(); return o?.near?.join() === first; };
  await run(30, 0.05, () => log.raiders.length >= t0 + 6);
  assert.ok(log.raiders.length >= t0 + 6, 'the packs came on from another side');
  const leaders = log.raiders.slice(t0).filter((f) => !f.o?.at);
  assert.ok(leaders.every((f) => Math.abs(Math.hypot(f.o.near[0] - SQUARE[0], f.o.near[2] - SQUARE[2]) - RAID_DEFEND_FROM_M) < 1e-6), 'each about the square');
  assert.ok(STAFF_PACK_STEP_S < 1);
});

test('RAID-REACH: a raid\'s spot stands only on a street that meets its player\'s - never in a wall, a building or a closed yard; off a town\'s grid any spot stands (mutants: a wall cell let stand; the other side of a wall let stand; an area event refused)', () => {
  // a 20 x 20 grid, a wall down column 10 with no gap: two streets
  const W = 20, H = 20, wall = (x) => x === 10;
  const nav = { width: W, height: H, weightAt: (x) => (wall(x) ? 0 : 1) };
  const local = (x, z) => [x, z];   // scene = the town's frame
  const sites = createRaidSites({
    townAt: (x, z) => (x >= 0 && z >= 0 && x < W * NAV_CELL && z < H * NAV_CELL ? { town: 1, nav, local: local(x, z), toScene: (u, v) => [u, v] } : null),
    feet: () => null, groundAt: () => 0, standGuard: async () => null, spawnFoe: async () => null,
  });
  const c = (gx, gz) => [(gx + 0.5) * NAV_CELL, 0, (gz + 0.5) * NAV_CELL];
  assert.equal(sites.reachable(c(3, 3), c(5, 15)), true, 'the same street');
  assert.equal(sites.reachable(c(10, 3), c(5, 15)), false, 'in the wall');
  assert.equal(sites.reachable(c(15, 3), c(5, 15)), false, 'the wall\'s other side');
  assert.equal(sites.reachable(c(15, 3), c(16, 8)), true, 'the other side, its own player there');
  assert.equal(sites.reachable(c(3, 3), c(10, 5)), true, 'a player at the wall\'s foot: the street beside them');
  assert.equal(sites.reachable([-50, 0, -50], c(5, 5)), true, 'off the grid: an area\'s event, the fields');
  assert.equal(streetCellAt(nav, new Int32Array(W * H), [0, 0], RAID_REACH_RING), 0, 'no street: none');
  // the stand asks it, for every raid and event
  assert.match(rd('src/scenes/hostEnchant.js'), /if \(spot && reach && !reach\(\[spot\.x, spot\.y, spot\.z\]\)\) spot = null;/);
  assert.ok(rd('src/scenes/raidHost.js').includes('reach: (spot) => host.raidSites?.reachable?.(spot, at?.at ?? at?.near ?? enchantFeet()) ?? true'));
});

test('RAID-BANNER: a Standard\'s raid counts every third death - the relay\'s target of 15-25 stands for 45-75 deaths - and the map shows the deaths; any other kind counts each (mutants: every death counted; the map in counts)', async () => {
  assert.equal(RAID_BANNER_KILLS_X, 3);
  const { log } = rig({ sites: true });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidOf('defend')] });
  await run(30, 0.05, () => log.raiders.length >= 7);
  for (const f of log.raiders.slice(0, 7)) { f.dead = true; f.corpse = true; }
  frame(0.05); await tick();
  const r = raidState().raids[0];
  assert.equal(r.killed, 2, 'seven deaths: two counts');
  assert.equal(raidKillsX(r), 3);
  assert.equal(raidKillsX({ kind: 'waves' }), 1);
  const { raidMapMarks } = await import('../../src/ui/eventMapMarks.js');
  assert.ok(raidMapMarks([r], AT(610))[0].tip.lines.includes(`6 of ${r.attackAmount * 3} driven off`), 'in deaths');
});
